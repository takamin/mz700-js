"use strict";
import MemoryBlock from "./memory-block";

/**
 * MemoryBlock
 * @class
 */
export default class MemoryBlockCbw extends MemoryBlock {
    /* callback on poke */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onPoke = (addr:number, value:number):void => { /* empty */ };
    /**
     * @constructor
     * @param {object} opt the options.
     */
    constructor(opt?:{size?:number, startAddr?:number, onPoke?:(addr:number, value:number)=>void}) {
        super(opt);
        if(opt.onPoke) {
            this.onPoke = opt.onPoke;
        }
    }

    /**
     * Write a byte data.
     * @param {number} address an address.
     * @param {number} value a data.
     * @returns {undefined}
     */
    poke(address:number, value:number):void {
        super.pokeByte(address, value);
        this.onPoke(address, this.peekByte(address));
    }
}

module.exports = MemoryBlockCbw;
