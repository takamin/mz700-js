var IMem = require("./imem");

//
// MemoryBlock
//
var MemoryBlock = function(opt) {
    this.create(opt);
};

MemoryBlock.prototype = new IMem();

MemoryBlock.prototype.create = function(opt) {
    IMem.prototype.create.call(this, opt);
	this.mem = new Array(this.size);
};

MemoryBlock.prototype.peekByte = function(address) {
    return this.mem[(address - this.startAddr) & 0xffff] & 0xff;
};

MemoryBlock.prototype.pokeByte = function(address, value) {
    this.mem[(address - this.startAddr)  & 0xffff] = value & 0xff;
};

module.exports = MemoryBlock;
