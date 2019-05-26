"use strict";
import IMem from "./imem.js";

/**
 * MemoryBank
 * @constructor
 * @param {object} opt the options.
 */
export default class MemoryBank extends IMem {
    mem:Array<any>;
    memblk:any;
    constructor(opt:any) {
        super();
        this.create(opt);
    }
    /**
     * Create
     * @param {any} opt the options.
     * @returns {undefined}
     */
    create(opt:any) {
        super.create(opt);
        this.mem = new Array(this.size);
        this.memblk = {};
    }
    /**
     * Set named memory block.
     * @param {string} name A name of a memory bank.
     * @param {IMem} memblk A memory block.
     * @returns {undefined}
     */
    setMemoryBlock(name, memblk) {
        if (memblk == null) {
            if (name in this.memblk) {
                const size = this.memblk[name].size;
                const startAddr = this.memblk[name].startAddr;
                const endAddr = startAddr + size;
                const nullMem = { peek: () => 0, poke: () => { } };
                for (let j = startAddr; j < endAddr; j++) {
                    this.mem[j] = nullMem;
                }
                delete this.memblk[name];
            }
        }
        else {
            this.memblk[name] = memblk;
            const size = this.memblk[name].size;
            const startAddr = this.memblk[name].startAddr;
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
    peekByte(address) {
        return (this.mem[address - this.startAddr]).peek(address);
    }
    /**
     * Write a byte data.
     * @param {number} address an address.
     * @param {number} value a data.
     * @returns {undefined}
     */
    pokeByte(address, value) {
        (this.mem[address - this.startAddr]).poke(address, value);
    }
}

module.exports = MemoryBank;
