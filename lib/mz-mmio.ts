"use strict";

/**
 * Memory Mapped I/O
 * @class
 */
export default class MZMMIO {
    _map:Array<{
        r:Array<(n:number)=>{}>,
        w:Array<(n:number)=>{}>,
    }> = [];

    constructor() {
        for (let addr:number = 0xE000; addr < 0xE800; addr++) {
            this._map.push({ "r": [], "w": [] });
        }
    }

    /**
     * Entry event listener on read.
     * @param address address of MMIO.
     * @param handler invoked when the address is read.
     */
    onRead(address:number, handler:(n:number)=>{}):void {
        this._map[address - 0xE000].r.push(handler);
    }

    /**
     * Entry event listener on write.
     * @param address address of MMIO.
     * @param handler invoked when the address is write.
     */
    onWrite(address:number, handler:(n:number)=>{}):void {
        this._map[address - 0xE000].w.push(handler);
    }

    /**
     * Invoke the read handlers of this memory mapped I/O.
     * @param {number} address An address
     * @param {number} value A value
     * @returns {undefined}
     */
    read(address:number, value:number):void {
        const handlers = this._map[address - 0xE000];
        if (handlers) {
            for (const handler of handlers.r) {
                handler(value);
            }
        }
    }

    /**
     * Invoke the write handlers of this memory mapped I/O.
     * @param {number} address An address
     * @param {number} value A value
     * @returns {undefined}
     */
    write(address:number, value:number):void {
        const handlers:{
            r:Array<(n:number)=>{}>,
            w:Array<(n:number)=>{}>} = this._map[address - 0xE000];
        if (handlers) {
            for (const handler of handlers.w) {
                handler(value);
            }
        }
    }
}

module.exports = MZMMIO;
