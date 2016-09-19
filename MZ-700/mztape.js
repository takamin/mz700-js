function MZ_TapeHeader(buf, offset) {
    var arrayToString = function(arr, start, end) {
        var s = "";
        for(var i = start; i < end; i++) {
            s += String.fromCharCode(arr[i]);
        }
        return s;
    };
    var readArrayUInt8 = function(arr, offset) {
        return (0xff & arr[offset]);
    };
    var readArrayUInt16LE = function(arr, offset) {
        return (0xff & arr[offset]) + (0xff & arr[offset + 1]) * 256;
    };
    // header 128 bytes
    //      00h     attribute
    //      01h-11h filename
    //      12h-13h file size
    //      14h-15h address to load
    //      16h-17h execution address
    //      18h-7Fh patch and zero pad
    this.attr = readArrayUInt8(buf, offset + 0);
    var filename = arrayToString(buf, offset + 0x01, offset + 0x12);
    filename = filename.replace(/[^a-zA-Z0-9_!\"#\$%&'\(\)-=^~<>,\.]+$/, '');
    this.filename = filename;
    this.file_size = readArrayUInt16LE(buf, offset + 0x12);
    this.addr_load = readArrayUInt16LE(buf, offset + 0x14);
    this.addr_exec = readArrayUInt16LE(buf, offset + 0x16);
    var header_buffer = [];
    for(var i = 0; i < 128; i++) {
        header_buffer.push(buf[offset + i]);
    }
    this.buffer = header_buffer;
}
MZ_TapeHeader.createNew = function() {
    var buf = new Array(128);
    for(var i = 0; i < 128; i++) {
        buf[i] = 0;
    }
    buf[0] = 1;
    return new MZ_TapeHeader(buf, 0);
};
MZ_TapeHeader.prototype.setFilename = function(filename) {
    while(filename.length < 11) {
        filename += ' ';
    }
    this.filename = filename;
    for(var i = 0; i < 11; i++) {
        this.buffer[0x01 + i] = (filename.charCodeAt(i) & 0xff);
    }
};
MZ_TapeHeader.prototype.setFilesize = function(filesize) {
    this.file_size = filesize
    this.buffer[0x12] = ((filesize >> 0) & 0xff);
    this.buffer[0x13] = ((filesize >> 8) & 0xff);
};
MZ_TapeHeader.prototype.setAddrLoad = function(addr) {
    this.addr_load = addr;
    this.buffer[0x14] = ((addr >> 0) & 0xff);
    this.buffer[0x15] = ((addr >> 8) & 0xff);
};
MZ_TapeHeader.prototype.setAddrExec = function(addr) {
    this.addr_exec = addr;
    this.buffer[0x16] = ((addr >> 0) & 0xff);
    this.buffer[0x17] = ((addr >> 8) & 0xff);
};


function MZ_Tape(tapeData) {
    this._index = 0;
    this._tapeData = tapeData;
}
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
MZ_Tape.prototype.writeSignal = function() {
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
    while((extraByte = reader.readByte()) != null) {
        console.warn(
                "MZ_Tape.toBytes rest bytes["
                + bytes.length + "] =",
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

function MZ_DataRecorder(motorCallback) {
    this._m_on = false;
    this._play = false;
    this._rec = false;
    this._motor = false;
    this._wdata = null;
    this._rbit = null;
    this._twdata = 0;
    this._trdata = 0;
    this._cmt = null;
    this._pos = 0;
    this._motorCallback = motorCallback;
};
MZ_DataRecorder.prototype.isCmtSet = function() {
    return (this._cmt != null);
};
MZ_DataRecorder.prototype.setCmt = function(cmt) {
    var m = this.motor();
    if(m) {
        this.stop();
    }
    this._cmt = cmt;
    this._pos = 0;
};
MZ_DataRecorder.prototype.play = function() {
    var m = this.motor();
    if(this._cmt != null) {
        this._play = true;
    }
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
};
MZ_DataRecorder.prototype.rec = function() {
    var m = this.motor();
    if(this._cmt != null) {
        this._play = true;
        this._rec = true;
    }
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
};
MZ_DataRecorder.prototype.stop = function() {
    var m = this.motor();
    this._play = false;
    this._rec = false;
    if(m && !this.motor()) {
        this._motorCallback(false);
    }
};
MZ_DataRecorder.prototype.ejectCmt = function() {
    this.stop();
    var cmt = this._cmt;
    this._cmt = null;
    this._pos = 0;
    return cmt;
};
MZ_DataRecorder.prototype.m_on = function(state) {
    var m = this.motor();
    if(!this._m_on && state) {
        this._motor = !this._motor;
    }
    this._m_on = state;
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
    if(m && !this.motor()) {
        this._motorCallback(false);
    }
};
MZ_DataRecorder.prototype.motor = function() {
    return this._cmt != null && this._play && this._motor;
};
MZ_DataRecorder.prototype.wdata = function(wdata, tick) {
    if(this.motor() && this._rec) {
        if(this._wdata != wdata) {
            this._wdata = wdata;
            if(wdata) {
                this._twdata = tick;
            } else {
                var bit = (tick - this._twdata > 1400);
                if(this._pos < this._cmt.length) {
                    this._cmt[this._pos] = bit;
                    this._pos++;
                } else {
                    this._cmt.push(bit);
                    this._pos = this._cmt.length;
                }
            }
        }
    }
};

MZ_DataRecorder.prototype.rdata = function(tick) {
    if(this.motor()) {
        if(this._pos < this._cmt.length) {
            if(this._rbit == null) {
                var bit = 0;
                if(this._pos < this._cmt.length) {
                    bit = this._cmt[this._pos];
                    this._pos++;
                }
                this._rbit = bit;
            }
            var rdata = this._rbit;
            if(this._trdata == null) {
                this._trdata = tick;
            }
            var ticks = tick - this._trdata;
            if(this._rbit) {
                if(ticks > 1500) {
                    this._rbit = null;
                    this._trdata = null;
                }
            } else {
                if(ticks > 700) {
                    this._rbit = null;
                    this._trdata = null;
                }
            }
            return rdata;
        }
    }
    return null;
};

