"use strict";

/**
 * Memory Mapped I/O
 * @class
 */
export default class MZMMIO {
    _map:{r:(n:number)=>any, w:(n:number)=>void}[] = [];

    constructor() {
        for (let addr:number = 0xE000; addr < 0xE800; addr++) {
            this._map.push({
                "r": (value:number) => value,
                "w": (value:number) => value,
            });
        }
    }

    /**
     * Entry event listener on read.
     * @param address address of MMIO.
     * @param handler invoked when the address is read.
     */
    onRead(address:number, handler:(n:number)=>any):void {
        this._map[address - 0xE000].r = handler;
    }

    /**
     * Entry event listener on write.
     * @param address address of MMIO.
     * @param handler invoked when the address is write.
     */
    onWrite(address:number, handler:(n:number)=>void):void {
        this._map[address - 0xE000].w = handler;
    }

    /**
     * Invoke the read handlers of this memory mapped I/O.
     * @param {number} address An address
     * @param {number} value A value
     * @returns {any}
     */
    read(address:number, value:number):any {
        return this._map[address - 0xE000].r(value);
    }

    /**
     * Invoke the write handlers of this memory mapped I/O.
     * @param {number} address An address
     * @param {number} value A value
     * @returns {undefined}
     */
    write(address:number, value:number) {
        this._map[address - 0xE000].w(value);
    }
}

module.exports = MZMMIO;
