var IMem = getModule("IMem") || require("./imem");

//
// MemoryBank
//
// TODO: change the type of field `memblk` to `Array` instead of `object`
// to improve the speed to access.
//
MemoryBank = function(opt) {
    this.create(opt);
};
MemoryBank.prototype = new IMem();

MemoryBank.prototype.create = function(opt) {
    IMem.prototype.create.call(this, opt);
    this.mem = new Array(this.size);
    this.memblk = {};
};

MemoryBank.prototype.setMemoryBlock = function(name, memblk) {
    if(memblk == null) {
        if(name in this.memblk) {
            var size = this.memblk[name].size;
            var startAddr = this.memblk[name].startAddr;
            for(var j = 0; j < size; j++) {
                this.mem[startAddr + j] = null;
            }
            delete this.memblk[name];
        }
    } else {
        this.memblk[name] = memblk;
        var size = this.memblk[name].size;
        var startAddr = this.memblk[name].startAddr;
        for(var j = 0; j < size; j++) {
            this.mem[startAddr + j] = memblk;
        }
    }
};

MemoryBank.prototype.peekByte = function(address) {
    return (this.mem[(address - this.startAddr) & 0xffff]).peek(address) & 0xff;
};

MemoryBank.prototype.pokeByte = function(address, value) {
    (this.mem[(address - this.startAddr) & 0xffff]).poke(address, value & 0xff);
};
module.exports = MemoryBank;
