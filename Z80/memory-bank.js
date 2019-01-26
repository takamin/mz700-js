"use strict";
const IMem = require("./imem.js");

/**
 * MemoryBank
 * @constructor
 * @param {object} opt the options.
 */
function MemoryBank(opt) {
    this.create(opt);
}

MemoryBank.prototype = new IMem();

/**
 * Create
 * @param {object} opt the options.
 * @returns {undefined}
 */
MemoryBank.prototype.create = function(opt) {
    IMem.prototype.create.call(this, opt);
    this.mem = new Array(this.size);
    this.memblk = {};
};

/**
 * Set named memory block.
 * @param {string} name A name of a memory bank.
 * @param {IMem} memblk A memory block.
 * @returns {undefined}
 */
MemoryBank.prototype.setMemoryBlock = function(name, memblk) {
    if(memblk == null) {
        if(name in this.memblk) {
            const size = this.memblk[name].size;
            const startAddr = this.memblk[name].startAddr;
            const endAddr = startAddr + size;
            const nullMem = { peek:()=>0, poke: ()=>{} };
            for(let j = startAddr; j < endAddr; j++) {
                this.mem[j] = nullMem;
            }
            delete this.memblk[name];
        }
    } else {
        this.memblk[name] = memblk;
        const size = this.memblk[name].size;
        const startAddr = this.memblk[name].startAddr;
        const endAddr = startAddr + size;
        for(let j = startAddr; j < endAddr; j++) {
            this.mem[j] = memblk;
        }
    }
};

/**
 * Read a byte data.
 * @param {number} address an address.
 * @returns {number} the value in the memory.
 */
MemoryBank.prototype.peekByte = function(address) {
    return (this.mem[address - this.startAddr]).peek(address);
};

/**
 * Write a byte data.
 * @param {number} address an address.
 * @param {number} value a data.
 * @returns {undefined}
 */
MemoryBank.prototype.pokeByte = function(address, value) {
    (this.mem[address - this.startAddr]).poke(address, value);
};

module.exports = MemoryBank;
