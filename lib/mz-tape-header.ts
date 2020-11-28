"use strict";
import NumberUtil from "./number-util";
const { HEX } = NumberUtil;

/* tslint:disable: class-name no-bitwise */

export default class MZ_TapeHeader {
    attr:number;
    filename:string;
    fileSize:number;
    addrLoad:number;
    addrExec:number;
    buffer:any[];
    constructor(buf, offset) {
        const arrayToString = (arr:number[], start:number, end:number):string => {
            let s = "";
            for (let i = start; i < end; i++) {
                // End by CR
                if (arr[i] === 0x0d) {
                    break;
                }
                // Add char except null.
                if (arr[i] !== 0) {
                    s += String.fromCharCode(arr[i]);
                }
            }
            return s;
        };
        const readArrayUInt8 = (arr:number[], index:number):number => {
            return (0xff & arr[index]);
        };
        const readArrayUInt16LE = (arr:number[], index:number):number => {
            return (0xff & arr[index]) + (0xff & arr[index + 1]) * 256;
        };
        // header 128 bytes
        //      00h     attribute
        //      01h-11h filename
        //      12h-13h file size
        //      14h-15h address to load
        //      16h-17h execution address
        //      18h-7Fh patch and zero pad
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
    setFilename(filename:string):void {
        // Limit 16 char length
        if (filename.length > 0x10) {
            filename = filename.substr(0, 0x10);
        }
        // Save to the field
        this.filename = filename;
        let i;
        // Clear buffer by null
        for (i = 0; i <= 0x10; i++) {
            this.buffer[0x01 + i] = 0;
        }
        // Add CR as end mark
        filename += "\r";
        // Copy its character codes to the buffer with CR
        for (i = 0; i < filename.length; i++) {
            this.buffer[0x01 + i] = (filename.charCodeAt(i) & 0xff);
        }
    }
    setFilesize(filesize:number):void {
        this.fileSize = filesize;
        this.buffer[0x12] = ((filesize >> 0) & 0xff);
        this.buffer[0x13] = ((filesize >> 8) & 0xff);
    }
    setAddrLoad(addr:number):void {
        this.addrLoad = addr;
        this.buffer[0x14] = ((addr >> 0) & 0xff);
        this.buffer[0x15] = ((addr >> 8) & 0xff);
    }
    setAddrExec(addr:number):void {
        this.addrExec = addr;
        this.buffer[0x16] = ((addr >> 0) & 0xff);
        this.buffer[0x17] = ((addr >> 8) & 0xff);
    }
    getHeadline():string {
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
    /**
     * Get first filename in MZT tape images.
     *
     * @param {array} mztArray
     * the tape images. The each element has MZT header.
     *
     * @returns {string|null} The filename in the first MZT header.
     */
    static get1stFilename(mztArray):string|null {
        if (mztArray && Array.isArray(mztArray) && mztArray.length > 0) {
            return mztArray[0].header.filename;
        }
        return null;
    }
    static createNew():MZ_TapeHeader {
        const buf = new Array(128);
        for (let i = 0; i < 128; i++) {
            buf[i] = 0;
        }
        buf[0] = 1;
        return new MZ_TapeHeader(buf, 0);
    }
}
module.exports = MZ_TapeHeader;
