"use strict";
import MemoryBlock from "./memory-block";

/**
 * MemoryBlock
 * @constructor
 * @param {object} opt the options.
 */
export default class MemoryBlockCbrw extends MemoryBlock {
    onPeek:Function = null;
    onPoke:Function = null;
    constructor(opt) {
        super(opt);
        this.onPeek = opt.onPeek;
        this.onPoke = opt.onPoke;
    }

    /**
     * Read a byte data.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peek(address:number):number {
        const value:number = super.peekByte(address);
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
        super.pokeByte(address, value);
        this.onPoke(address, super.peekByte(address));
    }
}

module.exports = MemoryBlockCbrw;
