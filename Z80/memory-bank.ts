"use strict";
import IMem from "./imem.js";

/* tslint:disable:no-bitwise */

/**
 * MemoryBank
 * @constructor
 * @param {object} opt the options.
 */
export default class MemoryBank extends IMem {
    mem:any[];
    memblk:Map<string, IMem>;
    constructor(opt:any) {
        super();
        this.create(opt);
    }
    /**
     * Create
     * @param {any} opt the options.
     * @returns {undefined}
     */
    create(opt:any):void {
        super.create(opt);
        this.mem = new Array(this.size);
        this.memblk = new Map<string, IMem>();
    }
    /**
     * Set named memory block.
     * @param {string} name A name of a memory bank.
     * @param {IMem} memblk A memory block.
     * @returns {undefined}
     */
    setMemoryBlock(name:string, memblk:IMem):void {
        if (memblk == null) {
            if (this.memblk.has(name)) {
                const mem = this.memblk.get(name);
                const size = mem.size;
                const startAddr = mem.startAddr;
                const endAddr = startAddr + size;
                const nullMem = { peek: () => 0, poke: () => { /* empty */ } };
                for (let j = startAddr; j < endAddr; j++) {
                    this.mem[j] = nullMem;
                }
                this.memblk.delete(name);
            }
        }
        else {
            this.memblk.set(name, memblk);
            const mem = this.memblk.get(name);
            const size = mem.size;
            const startAddr = mem.startAddr;
            const endAddr = startAddr + size;
            for (let j = startAddr; j < endAddr; j++) {
                this.mem[j] = memblk;
            }
        }
    }
    /**
     * Read a byte data.
     * @param {number} address an address.
     * @returns {number} the value in the memory.
     */
    peekByte(address:number):number {
        return (this.mem[address - this.startAddr]).peek(address) & 0xff;
    }
    /**
     * Write a byte data.
     * @param {number} address an address.
     * @param {number} value a data.
     * @returns {undefined}
     */
    pokeByte(address:number, value:number):void {
        (this.mem[address - this.startAddr]).poke(address, value & 0xff);
    }
}

module.exports = MemoryBank;
