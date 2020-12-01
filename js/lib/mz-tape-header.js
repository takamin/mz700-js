"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const number_util_1 = __importDefault(require("./number-util"));
const { HEX } = number_util_1.default;
class MZ_TapeHeader {
    constructor(buf, offset) {
        const arrayToString = (arr, start, end) => {
            let s = "";
            for (let i = start; i < end; i++) {
                if (arr[i] === 0x0d) {
                    break;
                }
                if (arr[i] !== 0) {
                    s += String.fromCharCode(arr[i]);
                }
            }
            return s;
        };
        const readArrayUInt8 = (arr, index) => {
            return (0xff & arr[index]);
        };
        const readArrayUInt16LE = (arr, index) => {
            return (0xff & arr[index]) + (0xff & arr[index + 1]) * 256;
        };
        this.attr = readArrayUInt8(buf, offset + 0);
        const filename = arrayToString(buf, offset + 0x01, offset + 0x12);
        this.filename = filename;
        this.fileSize = readArrayUInt16LE(buf, offset + 0x12);
        this.addrLoad = readArrayUInt16LE(buf, offset + 0x14);
        this.addrExec = readArrayUInt16LE(buf, offset + 0x16);
        const headerBuffer = [];
        for (let i = 0; i < 128; i++) {
            headerBuffer.push(buf[offset + i]);
        }
        this.buffer = headerBuffer;
    }
    setFilename(filename) {
        if (filename.length > 0x10) {
            filename = filename.substr(0, 0x10);
        }
        this.filename = filename;
        let i;
        for (i = 0; i <= 0x10; i++) {
            this.buffer[0x01 + i] = 0;
        }
        filename += "\r";
        for (i = 0; i < filename.length; i++) {
            this.buffer[0x01 + i] = (filename.charCodeAt(i) & 0xff);
        }
    }
    setFilesize(filesize) {
        this.fileSize = filesize;
        this.buffer[0x12] = ((filesize >> 0) & 0xff);
        this.buffer[0x13] = ((filesize >> 8) & 0xff);
    }
    setAddrLoad(addr) {
        this.addrLoad = addr;
        this.buffer[0x14] = ((addr >> 0) & 0xff);
        this.buffer[0x15] = ((addr >> 8) & 0xff);
    }
    setAddrExec(addr) {
        this.addrExec = addr;
        this.buffer[0x16] = ((addr >> 0) & 0xff);
        this.buffer[0x17] = ((addr >> 8) & 0xff);
    }
    getHeadline() {
        return [
            ";======================================================",
            "; attribute :   " + HEX(this.attr, 2) + "H",
            "; filename  :   '" + this.filename + "'",
            "; filesize  :   " + this.fileSize + " bytes",
            "; load addr :   " + HEX(this.addrLoad, 4) + "H",
            "; start addr:   " + HEX(this.addrExec, 4) + "H",
            ";======================================================"
        ].join("\n");
    }
    static get1stFilename(mztArray) {
        if (mztArray && Array.isArray(mztArray) && mztArray.length > 0) {
            return mztArray[0].header.filename;
        }
        return null;
    }
    static createNew() {
        const buf = new Array(128);
        for (let i = 0; i < 128; i++) {
            buf[i] = 0;
        }
        buf[0] = 1;
        return new MZ_TapeHeader(buf, 0);
    }
}
exports.default = MZ_TapeHeader;
module.exports = MZ_TapeHeader;
//# sourceMappingURL=mz-tape-header.js.map