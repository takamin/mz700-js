"use strict";
import MemoryBlock from "./memory-block";

/**
 * MemoryBlock
 * @constructor
 * @param {object} opt the options.
 */
export default class MemoryBlockCbw extends MemoryBlock {
    onPoke:Function = function(addr:number, value:number):void {};
    constructor(opt) {
        super(opt);
        this.onPoke = opt.onPoke;
    }

    /**
     * Write a byte data.
     * @param {number} address an address.
     * @param {number} value a data.
     * @returns {undefined}
     */
    poke(address:number, value:number) {
        super.pokeByte(address, value);
        this.onPoke(address, this.peekByte(address));
    }
}

module.exports = MemoryBlockCbw;
