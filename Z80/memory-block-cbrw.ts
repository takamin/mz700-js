"use strict";
import MemoryBlockCbw from "./memory-block-cbw";

/**
 * MemoryBlock
 * @constructor
 * @param {object} opt the options.
 */
export default class MemoryBlockCbrw extends MemoryBlockCbw {
    onPeek = (addr:number, value:number):number => (0);
    constructor(opt) {
        super(opt);
        if(opt.onPeek) {
            this.onPeek = opt.onPeek;
        }
    }

    /**
     * Read a byte data.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peek(address:number):number {
        const value:number = super.peekByte(address);
        const override = this.onPeek(address, value);
        if (override != null && override !== undefined) {
            return override;
        }
        return value;
    }
}

module.exports = MemoryBlockCbrw;
