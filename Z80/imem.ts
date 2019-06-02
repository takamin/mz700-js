"use strict";
import Z80BinUtil from "./bin-util.js";

/**
 * IMem - Z80 emulator's memory interface
 * @constructor
 */
export default class IMem {
    onPeek:Function = function(addr:number):number {return 0;};
    onPoke:Function = function(addr:number, value:number):void {};
    size:number;
    startAddr:number;
    constructor() {
    }
    /**
     * Create
     * @param {any} opt the options.
     * @returns {undefined}
     */
    create(opt?:any):void {
        opt = opt || {};
        this.onPeek = opt.onPeek || (( /*address, value*/) => { });
        this.onPoke = opt.onPoke || (( /*address, value*/) => { });
        this.size = opt.size || 0x10000;
        this.startAddr = opt.startAddr || 0;
        if (this.startAddr < 0 || this.startAddr > 0xffff) {
            throw new Error("Invalid start address of memory");
        }
        if (this.size < 0) {
            throw new Error("Invalid memory size");
        }
        if (this.startAddr + this.size > 0x10000) {
            throw new Error("Invalid combination of start address and memory size.");
        }
    }
    /**
     * Read a byte data.
     * This peekByte is an abstruct called from `peek`.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peekByte( address:number ):number {
        const msg = "Error: abstruct pokeByte was invoked." +
            `This method must be overrided by the class ${this.constructor.name}`;
        console.error(msg);
        throw new Error(msg);
        return 0;
    }
    /**
     * Write a byte data.
     * This pokeByte is an abstruct called from `poke`.
     * @param {number} address an address.
     * @param {number} value a data.
     * @returns {undefined}
     */
    pokeByte( address:number, value:number) {
        const msg = "Error: abstruct pokeByte was invoked." +
            `This method must be overrided by the class ${this.constructor.name}`;
        console.error(msg);
        throw new Error(msg);
    }
    /**
     * Clear memory by zero.
     * @returns {undefined}
     */
    clear() {
        for (var i = 0; i < this.size; i++) {
            this.pokeByte(i, 0);
        }
    }
    /**
     * Read a byte data.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peek(address:number):number {
        const value:number = this.peekByte(address);
        const override = this.onPeek(address, value);
        if (override != null && override != undefined) {
            return override;
        }
        return value;
    }
    /**
     * Write a byte data.
     * @param {number} address an address.
     * @param {number} value a data.
     * @returns {undefined}
     */
    poke(address:number, value:number) {
        this.pokeByte(address, value);
        this.onPoke(address, this.peekByte(address));
    }
    /**
     * Read a 16bit data.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peekPair(address) {
        return Z80BinUtil.pair(this.peek(address + 1), this.peek(address + 0));
    }
}

module.exports = IMem;