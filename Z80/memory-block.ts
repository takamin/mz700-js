"use strict";
import IMem from "./imem";

/**
 * MemoryBlock
 * @constructor
 * @param {object} opt the options.
 */
export default class MemoryBlock extends IMem {
    mem:Array<number>;
    constructor(opt?) {
        super();
        super.create(opt);
        this.mem = new Array(this.size);
    }
    /**
     * Read a byte data.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peekByte(address:number):number {
        return this.mem[address - this.startAddr];
    }
    /**
     * Write a byte data.
     * @param {number} address an address.
     * @param {number} value a data.
     * @returns {undefined}
     */
    pokeByte(address:number, value:number):void {
        this.mem[address - this.startAddr] = value;
    }
}

module.exports = MemoryBlock;
