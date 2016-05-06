//
// IMem
//
IMem = function() {
};

IMem.prototype.create = function(opt) {
    opt = opt || {};
    this.onPeek = opt.onPeek || function(address, value) {};
    this.onPoke = opt.onPoke || function(address, value) {};
    this.size = opt.size || 0x10000;
    this.startAddr = opt.startAddr || 0;
};
IMem.prototype.clear = function() {
    for(var i = 0; i < this.size; i++) {
        this.pokeByte(0);
    }
};

IMem.prototype.peek = function(address) {
    var value = this.peekByte(address);
    var override = this.onPeek.call(this, address, value);
    if(override != null && override != undefined) {
        value = override;
    }
    return value;
};

IMem.prototype.poke = function(address, value) {
    this.pokeByte(address, value);
    this.onPoke.call(this, address, this.peekByte(address));
};

IMem.prototype.peekPair = function(address) {
    var H = this.peek(address + 1);
    var L = this.peek(address + 0);
    return Z80.pair(H,L);
};

//
// MemoryBlock
//
MemoryBlock = function(opt) {
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

//
// MemoryBank
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
