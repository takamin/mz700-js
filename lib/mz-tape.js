var MZ_TapeHeader = require('./mz-tape-header');
const NumberUtil = require("./number-util.js");
var MZ_Tape = function(tapeData) {
    this._index = 0;
    this._tapeData = tapeData;
};

MZ_Tape.prototype.isThereSignal = function(signal, n) {
    for(var i = 0; i < n; i++) {
        if(this._tapeData[this._index + i] != signal) {
            return false;
        }
    }
    this._index += n;
    return true;
};

MZ_Tape.prototype.recognizeStartingMark = function() {
    // START MARK
    if(!this.isThereSignal(false, 11000)) {
        return false;
    }
    if(!this.isThereSignal(true, 40)) {
        return false;
    }
    if(!this.isThereSignal(false, 40)) {
        return false;
    }
    if(!this.isThereSignal(true, 1)) {
        return false;
    }
    return true;
};

MZ_Tape.prototype.recognizeStarting2Mark = function() {
    // START MARK
    if(!this.isThereSignal(false, 2750)) {
        return false;
    }
    if(!this.isThereSignal(true, 20)) {
        return false;
    }
    if(!this.isThereSignal(false, 20)) {
        return false;
    }
    if(!this.isThereSignal(true, 1)) {
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
        if((data & (0x01 << (7 - j))) != 0) {
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
    this.writeByte((cs >> 8) & 0xff);
    this.writeByte((cs >> 0) & 0xff);
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
            throw "NO START BIT";
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
        throw "NO BLOCK CHECKSUM";
    }
    var checksum = (checkBytes[0] * 256) + checkBytes[1];

    // Read block end signal(long)
    if(!this.isThereSignal(true,1)) {
        throw "NO BLOCK END BIT";
    }

    var onBitCount = this.countOnBit(blockBytes);
    if(onBitCount != checksum) {
        throw "CHECKSUM ERROR";
    }
    return blockBytes;
};

MZ_Tape.prototype.readDuplexBlocks = function(n) {
    var bytes = this.readBlock(n);
    if(bytes == null) {
        throw "FAIL TO READ BLOCK[1]";
    }

    // Block delimitor
    if(!this.isThereSignal(false, 256)) {
        throw "NO DELIMITOR: Short x 256.";
    }

    var bytes2 = this.readBlock(n);
    if(bytes2 == null) {
        throw "FAIL TO READ BLOCK[2]";
    }

    //Check each bytes
    for(var i = 0; i < bytes.length; i++) {
        if(bytes[i] != bytes2[i]) {
            throw "FAIL TO VERIFY BLOCK 1 and 2";
        }
    }
    return bytes;
};

MZ_Tape.prototype.readHeader = function() {

    // Header starting block
    if(!this.recognizeStartingMark()) {
        throw "NO STARTING MARK recognized";
    }

    // MZT header
    var mztBytes = this.readDuplexBlocks(128);
    if(mztBytes == null) {
        throw "CANNOT READ MZT HEADER";
    }

    return new MZ_TapeHeader(mztBytes, 0);
};

MZ_Tape.prototype.readDataBlock = function(n) {
    // Data starting mark
    if(!this.recognizeStarting2Mark()) {
        throw "NO STARTING MARK 2 recognized";
    }
    // Read duplexed data bytes
    return this.readDuplexBlocks(n);
};

MZ_Tape.toBytes = function(bits) {
    try {
        var reader = new MZ_Tape(bits);

        var header = reader.readHeader();
        if(header == null) {
            throw "FAIL TO READ HEADER";
        }
        var body = reader.readDataBlock(header.file_size);
        if(body == null) {
            throw "FAIL TO READ DATA";
        }

        var extra = [];
        var nonZeroRead = true;
        var extraByte;
        while(nonZeroRead) {
            extraByte = reader.readByte();
            nonZeroRead = (extraByte ? true : false);
            if(nonZeroRead) {
                console.warn(
                        "MZ_Tape.toBytes rest bytes["
                        + extraByte.length + "] =",
                        NumberUtil.HEX(extraByte, 2));
                extra.push(extraByte);
            }
        }

        //MZT + body
        return header.buffer.concat(body);
    } catch(err) {
        console.log("MZ_Tape.toBytes:Error " + err);
    }
    return [];
};

MZ_Tape.fromBytes = function(bytes) {
    if(bytes.length < 128) {
        throw "FAIL TO WRITE HEADER";
    }
    var header = new MZ_TapeHeader(bytes.slice(0,128), 0);
    var writer = new MZ_Tape([]);
    writer.writeHeader(header.buffer);
    writer.writeDataBlock(bytes.slice(128));
    return writer._tapeData;
};

MZ_Tape.prototype.outputStartingMark = function() {
    var i;

    // START MARK
    for(i = 0; i < 11000; i++) {
        this.writeSignal(false);
    }
    for(i = 0; i < 40; i++) {
        this.writeSignal(true);
    }
    for(i = 0; i < 40; i++) {
        this.writeSignal(false);
    }
    this.writeSignal(true);
};

MZ_Tape.prototype.writeHeader = function(buffer) {
    this.outputStartingMark();
    this.writeDuplexBlock(buffer);
};

MZ_Tape.prototype.writeStarting2Mark = function() {
    var i;

    // Body mark
    for(i = 0; i < 2750; i++) {
        this.writeSignal(false);
    }
    for(i = 0; i < 20; i++) {
        this.writeSignal(true);
    }
    for(i = 0; i < 20; i++) {
        this.writeSignal(false);
    }
    this.writeSignal(true);

};
MZ_Tape.prototype.writeDataBlock = function(buffer) {
    // Data starting mark
    this.writeStarting2Mark();
    this.writeDuplexBlock(buffer);
};

MZ_Tape.parseMZT = function(buf) {
    var sections = [];
    var offset = 0;
    while(offset + 128 <= buf.length) {
        var header = new MZ_TapeHeader(buf, offset);
        offset += 128;

        var body_buffer = [];
        for(var i = 0; i < header.file_size; i++) {
            body_buffer.push(buf[offset + i]);
        }
        offset += header.file_size;

        sections.push({
            "header": header,
            "body": {
                "buffer": body_buffer
            }
        });
    }
    return sections;
};

module.exports = MZ_Tape;
