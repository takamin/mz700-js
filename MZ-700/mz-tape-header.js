var MZ_TapeHeader = function(buf, offset) {
    var arrayToString = function(arr, start, end) {
        var s = "";
        for(var i = start; i < end; i++) {

            // End by CR
            if(arr[i] == 0x0d) {
                break;
            }

            // Add char except null.
            if(arr[i] != 0) {
                s += String.fromCharCode(arr[i]);
            }

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
    this.filename = filename;
    this.file_size = readArrayUInt16LE(buf, offset + 0x12);
    this.addr_load = readArrayUInt16LE(buf, offset + 0x14);
    this.addr_exec = readArrayUInt16LE(buf, offset + 0x16);
    var header_buffer = [];
    for(var i = 0; i < 128; i++) {
        header_buffer.push(buf[offset + i]);
    }
    this.buffer = header_buffer;
};

MZ_TapeHeader.createNew = function() {
    var buf = new Array(128);
    for(var i = 0; i < 128; i++) {
        buf[i] = 0;
    }
    buf[0] = 1;
    return new MZ_TapeHeader(buf, 0);
};

MZ_TapeHeader.prototype.setFilename = function(filename) {

    // Limit 16 char length
    if(filename.length > 0x10) {
        filename = filename.substr(0, 0x10);
    }

    // Save to the field
    this.filename = filename;

    // Clear buffer by null
    for(var i = 0; i <= 0x10; i++) {
        this.buffer[0x01 + i] = 0;
    }

    // Add CR as end mark
    filename += "\r";

    // Copy its character codes to the buffer with CR
    for(var i = 0; i < filename.length; i++) {
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

MZ_TapeHeader.prototype.getHeadline = function() {
    return [
        ";======================================================",
        "; attribute :   " + this.attr.HEX(2) + "H",
        "; filename  :   '" + this.filename + "'",
        "; filesize  :   " + this.file_size + " bytes",
        "; load addr :   " + this.addr_load.HEX(4) + "H",
        "; start addr:   " + this.addr_exec.HEX(4) + "H",
        ";======================================================"
        ].join("\n");
};
module.exports = MZ_TapeHeader;
