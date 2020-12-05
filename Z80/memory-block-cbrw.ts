"use strict";
import MemoryBlockCbw from "./memory-block-cbw";

/**
 * MemoryBlock
 * @constructor
 * @param {object} opt the options.
 */
export default class MemoryBlockCbrw extends MemoryBlockCbw {
    /* callback on peek */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onPeek = (addr:number, value:number):number => (0);
    constructor(opt?:{
        size?:number,
        startAddr?:number,
        onPeek?:(addr:number, value:number)=>number,
        onPoke?:(addr:number, value:number)=>void,
    }) {
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
