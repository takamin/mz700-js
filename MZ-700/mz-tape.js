var MZ_TapeHeader = getModule("MZ_TapeHeader") || require('./mz-tape-header');
var MZ_Tape = function(tapeData) {
    this._index = 0;
    this._tapeData = tapeData;
};

MZ_Tape.prototype.isThereSignal = function(signal, n) {
    for(var i = 0; i < n; i++) {
        if(this._tapeData[this._index + i] != signal) {
            console.warn("MZ_Tape.isThereSignal signal", signal, "x", i, "but not", n);
            return false;
        }
    }
    this._index += n;
    return true;
};

MZ_Tape.prototype.recognizeStartingMark = function() {
    // START MARK
    if(!this.isThereSignal(false, 11000)) {
        console.error("NO STARTING MARK: Short x 11000.");
        return false;
    }
    if(!this.isThereSignal(true, 40)) {
        console.error("NO STARTING MARK: Long x 40.");
        return false;
    }
    if(!this.isThereSignal(false, 40)) {
        console.error("NO STARTING MARK: Short x 40.");
        return false;
    }
    if(!this.isThereSignal(true, 1)) {
        console.error("NO STARTING MARK: Long x 1.");
        return false;
    }
    return true;
};

MZ_Tape.prototype.recognizeStarting2Mark = function() {
    // START MARK
    if(!this.isThereSignal(false, 2750)) {
        console.error("NO STARTING MARK: Short x 2750.");
        return false;
    }
    if(!this.isThereSignal(true, 20)) {
        console.error("NO STARTING MARK: Long x 20.");
        return false;
    }
    if(!this.isThereSignal(false, 20)) {
        console.error("NO STARTING MARK: Short x 20.");
        return false;
    }
    if(!this.isThereSignal(true, 1)) {
        console.error("NO STARTING MARK: Long x 1.");
        return false;
    }
    return true;
};

MZ_Tape.prototype.readSignal = function() {
    if(this._index < this._tapeData.length) {
        return this._tapeData[this._index++];
    }
    return null;
};

MZ_Tape.prototype.writeSignal = function(signal) {
    this._tapeData.push(signal);
};

MZ_Tape.prototype.writeByte = function(data) {
    this.writeSignal(true);
    for(var j = 0; j < 8; j++) {
        if((data & (0x01 << j)) != 0) {
            this.writeSignal(true);
        } else {
            this.writeSignal(false);
        }
    }
};

MZ_Tape.prototype.writeBlock = function(data) {
    data.forEach(function(d) {
        this.writeByte(d);
    }, this);
    var cs = this.countOnBit(data);
    this.writeByte((cs >> 0) & 0xff);
    this.writeByte((cs >> 8) & 0xff);
    this.writeSignal(true);
};

MZ_Tape.prototype.writeDuplexBlock = function(data) {
    this.writeBlock(data);
    for(var i = 0; i < 256; i++) {
        this.writeSignal(false);
    }
    this.writeBlock(data);
};

MZ_Tape.prototype.readByte = function() {

    //fast forward to starting bit
    var startBit = null;
    do {
        startBit = this.readSignal();
        if(startBit == null) {
            return null; // End Of Stream
        }
        if(!startBit) {
            console.log("NO START BIT");
        }
    } while(!startBit);

    // Read 8 bits and build 1 byte.
    // The bits are read from MSB to LSB.
    var buf = 0x00;
    for(var i = 0; i < 8; i++) {
        var bit = this.readSignal();
        if(bit == null) {
            return null;
        } else if(bit) {
            buf |= (0x01 << (7 - i));
        }
    }
    return buf;
};

MZ_Tape.prototype.readBytes = function(n) {
    var buf = [];
    for(var i = 0; i < n; i++) {
        var data = this.readByte();
        if(data == null) {
            break;
        }
        buf.push(data);
    }
    return buf;
};

MZ_Tape.prototype.countOnBit = function(blockBytes) {
    var onBitCount = 0;
    var bitno = [0,1,2,3,4,5,6,7];
    blockBytes.forEach(function(data) {
        bitno.forEach(function(n) {
            if((data & (1 << n)) != 0) {
                onBitCount++;
            }
        });
    });
    onBitCount &= 0xffff;
    return onBitCount;
};

MZ_Tape.prototype.readBlock = function(n) {
    
    // Read block bytes
    var blockBytes = this.readBytes(n);

    // read 2 bytes of checksum
    var checkBytes = this.readBytes(2);
    if(checkBytes.length != 2) {
        console.error("NO BLOCK CHECKSUM");
        return null;
    }
    var checksum = (checkBytes[0] * 256) + checkBytes[1];
    console.log("CHECKSUM:", checksum.HEX(4) + "H");

    // Read block end signal(long)
    if(!this.isThereSignal(true,1)) {
        console.error("NO BLOCK END BIT");
        return null;
    }

    var onBitCount = this.countOnBit(blockBytes);
    console.log("BIT COUNT", onBitCount.HEX(4) + "H");
    if(onBitCount != checksum) {
        console.error("CHECKSUM ERROR");
        return null;
    }
    return blockBytes;
};

MZ_Tape.prototype.readDuplexBlocks = function(n) {
    console.log("BLOCK[1]");
    var bytes = this.readBlock(n);
    if(bytes == null) {
        console.error("FAIL TO READ BLOCK[1]");
        return null;
    }

    // Block delimitor
    if(!this.isThereSignal(false, 256)) {
        console.error("NO DELIMITOR: Short x 256.");
        return null;
    }

    console.log("BLOCK[2]");
    var bytes2 = this.readBlock(n);
    if(bytes2 == null) {
        console.error("FAIL TO READ BLOCK[2]");
        return null;
    }

    //Check each bytes
    for(var i = 0; i < bytes.length; i++) {
        if(bytes[i] != bytes2[i]) {
            return null;
        }
    }
    return bytes;
};

MZ_Tape.prototype.readHeader = function() {

    // Header starting block
    if(!this.recognizeStartingMark()) {
        console.error("NO STARTING MARK recognized");
        return null;
    }

    // MZT header
    var mztBytes = this.readDuplexBlocks(128);
    if(mztBytes == null) {
        console.error("CANNOT READ MZT HEADER");
    }

    return new MZ_TapeHeader(mztBytes, 0);
};

MZ_Tape.prototype.readDataBlock = function(n) {
    // Data starting mark
    if(!this.recognizeStarting2Mark()) {
        console.error("NO STARTING MARK 2 recognized");
        return null;
    }
    // Read duplexed data bytes
    return this.readDuplexBlocks(n);
};

MZ_Tape.toBytes = function(bits) {
    var reader = new MZ_Tape(bits);

    var header = reader.readHeader();
    if(header == null) {
        console.error("FAIL TO READ HEADER");
    }
    console.log("MZT HEADER:");
    console.log("  FILENAME:", header.filename);
    console.log("  FILESIZE:", header.file_size.HEX(4)+"H");
    console.log("  ADDRLOAD:", header.addr_load.HEX(4)+"H");
    console.log("  ADDREXEC:", header.addr_exec.HEX(4)+"H");

    var body = reader.readDataBlock(header.file_size);
    if(body == null) {
        console.error("FAIL TO READ DATA");
    }

    var extra = [];
    var extraByte;
    while(extraByte = reader.readByte()) {
        console.warn(
                "MZ_Tape.toBytes rest bytes["
                + extraByte.length + "] =",
                extraByte.HEX(2));
        extra.push(extraByte);
    }

    //MZT + body
    return header.buffer.concat(body);
};

MZ_Tape.fromBytes = function(bytes) {
    var writer = new MZ_Tape([]);

    // Header mark
    for(var i = 0; i < 11000; i++) {
        writer.writeSignal(false);
    }
    for(var i = 0; i < 40; i++) {
        writer.writeSignal(true);
    }
    for(var i = 0; i < 40; i++) {
        writer.writeSignal(false);
    }
    writer.writeSignal(true);

    // Header
    writer.writeDuplexBlock(bytes.slice(0,128));

    // Body mark
    for(var i = 0; i < 2750; i++) {
        writer.writeSignal(false);
    }
    for(var i = 0; i < 20; i++) {
        writer.writeSignal(true);
    }
    for(var i = 0; i < 20; i++) {
        writer.writeSignal(false);
    }
    writer.writeSignal(true);

    // Body
    writer.writeDuplexBlock(bytes.slice(128));

    return writer._tapeData;
};
module.exports = MZ_Tape;
