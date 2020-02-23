"use strict"
var MemoryBlock = require("../Z80/memory-block.js");
function MZ700_NewMonitor() { }
MZ700_NewMonitor.prototype = new MemoryBlock();
MZ700_NewMonitor.prototype.create = function() {
    MemoryBlock.prototype.create.call(this, { startAddr: 0x0000, size: 0x1000});
};

MZ700_NewMonitor.prototype.setBinary = function(bin) {
    for(let i = 0; i < this.size; i++) {
        const address = this.startAddr + i;
        MemoryBlock.prototype.pokeByte.call(this,
            address, bin[address]);
    }
};

MZ700_NewMonitor.prototype.pokeByte = function(/*address, value*/) {
    /* IGNORE ALL WRITING */
};

module.exports = MZ700_NewMonitor;
