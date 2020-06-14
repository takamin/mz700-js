var MZ700_NewMonitor = require("./mz700-new-monitor.js");
var MemoryBlock = require("../Z80/memory-block.js");
var MemoryBank = require('../Z80/memory-bank.js');

function MZ700_Memory() { }
MZ700_Memory.prototype = new MemoryBank();
MZ700_Memory.prototype.create = function(opt) {

    MemoryBank.prototype.create.call(this, opt);

    const monitorRom = new MZ700_NewMonitor();
    monitorRom.create();

    //
    // Create callbacks when the VRAMs are updated
    //
    const onVramUpdate = opt.onVramUpdate || (()=>{});
    const cacheText = Array(1000).fill(0x00);
    const cacheAttr = Array(1000).fill(0x71);

    this.memblks = {
        IPL_AREA_ROM: monitorRom,
        IPL_AREA_RAM: new MemoryBlock({
            startAddr: 0x0000, size: 0x1000
        }),
        FREE_RAM: new MemoryBlock({
            startAddr: 0x1000, size: 0xC000
        }),
        TEXT_VRAM: new MemoryBlock({
            startAddr: 0xD000, size: 0x0800,
            onPoke: (addr, dispcode) => {
                if(0xD000 <= addr && addr < 0xD000 + 1000) {
                    const i = addr - 0xD000;
                    cacheText[i] = dispcode;
                    onVramUpdate(i, dispcode, cacheAttr[i]);
                }
            },
        }),
        ATTR_VRAM: new MemoryBlock({
            startAddr: 0xD800, size: 0x0800,
            onPoke: (addr, attr) => {
                if(0xD800 <= addr && addr < 0xD800 + 1000) {
                    const i = addr - 0xD800;
                    cacheAttr[i] = attr;
                    onVramUpdate(i, cacheText[i], attr);
                }
            },
        }),
        MMAPED_IO: new MemoryBlock({
            startAddr: 0xE000, size: 0x0800,
            onPeek: opt.onMappedIoRead || function(){},
            onPoke: opt.onMappedIoUpdate || function(){}
        }),
        EXTND_ROM: new MemoryBlock({
            startAddr: 0xE800, size: 0x10000 - 0xE800
        }),
        DRAM: new MemoryBlock({
            startAddr: 0xD000, size: 0x3000
        })
    };

    this._block1VRAM = true;
    this._disabledBlock1 = false;
    this.changeBlock0_MONITOR();
    this.setMemoryBlock("FREE_RAM", this.memblks.FREE_RAM);
    this.changeBlock1_VRAM();

    // fill attribute VRAM by 71h foreground white and background blue
    for(let i = 0; i < 0x800; i++) {
        this.memblks.ATTR_VRAM.pokeByte(0xD800 + i, 0x71);
    }
}

MZ700_Memory.prototype.setMonitorRom = function(bin) {
    this.memblks.IPL_AREA_ROM.setBinary(bin);
};

MZ700_Memory.prototype.clear = function() {
    MemoryBank.prototype.clear.call(this);
    for(var name in this.memblks) {
        this.memblks[name].clear();
    }
}
MZ700_Memory.prototype.getTextVram = function() {
    return this.memblks.TEXT_VRAM;
}
MZ700_Memory.prototype.getAttrVram = function() {
    return this.memblks.ATTR_VRAM;
}
MZ700_Memory.prototype.changeBlock0_MONITOR = function() {
    this.setMemoryBlock("IPL_AREA", this.memblks.IPL_AREA_ROM);
}
MZ700_Memory.prototype.changeBlock0_DRAM = function() {
    this.setMemoryBlock("IPL_AREA", this.memblks.IPL_AREA_RAM);
}
MZ700_Memory.prototype.changeBlock1_DRAM = function() {
    this._block1VRAM = false;
    this._disabledBlock1 = false;
    this.setMemoryBlock("TEXT_VRAM", null);
    this.setMemoryBlock("ATTR_VRAM", null);
    this.setMemoryBlock("MMAPED_IO", null);
    this.setMemoryBlock("EXTND_ROM", null);
    this.setMemoryBlock("DRAM", this.memblks.DRAM);
}
MZ700_Memory.prototype.changeBlock1_VRAM = function() {
    this._block1VRAM = true;
    this._disabledBlock1 = false;
    this.setMemoryBlock("DRAM", null);
    this.setMemoryBlock("TEXT_VRAM", this.memblks.TEXT_VRAM);
    this.setMemoryBlock("ATTR_VRAM", this.memblks.ATTR_VRAM);
    this.setMemoryBlock("MMAPED_IO", this.memblks.MMAPED_IO);
    this.setMemoryBlock("EXTND_ROM", this.memblks.EXTND_ROM);
}
MZ700_Memory.prototype.disableBlock1 = function() {
    if(!this._disabledBlock1) {
        this._disabledBlock1 = true;
        this.setMemoryBlock("TEXT_VRAM", null);
        this.setMemoryBlock("ATTR_VRAM", null);
        this.setMemoryBlock("MMAPED_IO", null);
        this.setMemoryBlock("EXTND_ROM", null);
        this.setMemoryBlock("DRAM", null);
    }
}
MZ700_Memory.prototype.enableBlock1 = function() {
    if(this._disabledBlock1) {
        if(this._block1VRAM) {
            this.changeBlock1_VRAM();
        } else {
            this.changeBlock1_DRAM();
        }
        this._disabledBlock1 = false;
    }
}
module.exports = MZ700_Memory;
