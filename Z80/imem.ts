"use strict";
import Z80BinUtil from "./bin-util";

/* tslint:disable:no-console */

/**
 * IMem - Z80 emulator's memory interface
 * @constructor
 */
export default class IMem {
    size:number;
    startAddr:number;
    constructor() {
        /* empty */
    }
    /**
     * Create
     * @param {any} opt the options.
     * @returns {undefined}
     */
    create(opt?:{size?:number, startAddr?:number}):void {
        opt = opt || {};
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    peekByte(address:number):number {
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pokeByte(address:number, value:number):void {
        const msg = "Error: abstruct pokeByte was invoked." +
            `This method must be overrided by the class ${this.constructor.name}`;
        console.error(msg);
        throw new Error(msg);
    }
    /**
     * Clear memory by zero.
     * @returns {undefined}
     */
    clear():void {
        for (let i = 0; i < this.size; i++) {
            this.pokeByte(i, 0);
        }
    }
    /**
     * Read a byte data.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peek(address:number):number {
        return this.peekByte(address);
    }
    /**
     * Write a byte data.
     * @param {number} address an address.
     * @param {number} value a data.
     * @returns {undefined}
     */
    poke(address:number, value:number):void {
        this.pokeByte(address, value);
    }
    /**
     * Read a 16bit data.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peekPair(address:number):number {
        return Z80BinUtil.pair(this.peek(address + 1), this.peek(address + 0));
    }
}

module.exports = IMem;
