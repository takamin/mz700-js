"use strict";
const IMem = require("./imem");

/**
 * MemoryBlock
 * @constructor
 * @param {object} opt the options.
 */
function MemoryBlock(opt) {
    this.create(opt);
}

MemoryBlock.prototype = new IMem();

/**
 * Create
 * @param {object} opt the options.
 * @returns {undefined}
 */
MemoryBlock.prototype.create = function(opt) {
    IMem.prototype.create.call(this, opt);
	this.mem = new Array(this.size);
};

/**
 * Read a byte data.
 * @param {number} address an address.
 * @returns {number} the value in the memory.
 */
MemoryBlock.prototype.peekByte = function(address) {
    return this.mem[address - this.startAddr];
};

/**
 * Write a byte data.
 * @param {number} address an address.
 * @param {number} value a data.
 * @returns {undefined}
 */
MemoryBlock.prototype.pokeByte = function(address, value) {
    this.mem[address - this.startAddr] = value;
};

module.exports = MemoryBlock;
