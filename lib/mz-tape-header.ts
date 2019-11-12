"use strict";
import NumberUtil from "./number-util";
const { HEX } = NumberUtil;

export default class MZ_TapeHeader {
    attr:number;
    filename:string;
    file_size:number;
    addr_load:number;
    addr_exec:number;
    buffer:Array<any>;
    constructor(buf, offset) {
        const arrayToString = function (arr:Array<number>, start:number, end:number):string {
            let s = "";
            for (let i = start; i < end; i++) {
                // End by CR
                if (arr[i] == 0x0d) {
                    break;
                }
                // Add char except null.
                if (arr[i] != 0) {
                    s += String.fromCharCode(arr[i]);
                }
            }
            return s;
        };
        const readArrayUInt8 = function (arr:Array<number>, offset:number):number {
            return (0xff & arr[offset]);
        };
        const readArrayUInt16LE = function (arr:Array<number>, offset:number):number {
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
        const filename = arrayToString(buf, offset + 0x01, offset + 0x12);
        this.filename = filename;
        this.file_size = readArrayUInt16LE(buf, offset + 0x12);
        this.addr_load = readArrayUInt16LE(buf, offset + 0x14);
        this.addr_exec = readArrayUInt16LE(buf, offset + 0x16);
        const header_buffer = [];
        for (let i = 0; i < 128; i++) {
            header_buffer.push(buf[offset + i]);
        }
        this.buffer = header_buffer;
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
        this.file_size = filesize;
        this.buffer[0x12] = ((filesize >> 0) & 0xff);
        this.buffer[0x13] = ((filesize >> 8) & 0xff);
    }
    setAddrLoad(addr:number):void {
        this.addr_load = addr;
        this.buffer[0x14] = ((addr >> 0) & 0xff);
        this.buffer[0x15] = ((addr >> 8) & 0xff);
    }
    setAddrExec(addr:number):void {
        this.addr_exec = addr;
        this.buffer[0x16] = ((addr >> 0) & 0xff);
        this.buffer[0x17] = ((addr >> 8) & 0xff);
    }
    getHeadline():string {
        return [
            ";======================================================",
            "; attribute :   " + HEX(this.attr, 2) + "H",
            "; filename  :   '" + this.filename + "'",
            "; filesize  :   " + this.file_size + " bytes",
            "; load addr :   " + HEX(this.addr_load, 4) + "H",
            "; start addr:   " + HEX(this.addr_exec, 4) + "H",
            ";======================================================"
        ].join("\n");
    }
    /**
     * Get first filename in MZT tape images.
     *
     * @param {array} mzt_array
     * the tape images. The each element has MZT header.
     *
     * @returns {string|null} The filename in the first MZT header.
     */
    static get1stFilename(mzt_array):string|null {
        if (mzt_array && Array.isArray(mzt_array) && mzt_array.length > 0) {
            return mzt_array[0].header.filename;
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
