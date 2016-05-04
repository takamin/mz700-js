function MZ700_Memory(opt) {
    this.create(opt);
}
MZ700_Memory.prototype = new MemoryBank();
MZ700_Memory.prototype.create = function(opt) {
    MemoryBank.prototype.create.call(this, opt);
    var THIS = this;

    //
    // Create callbacks when the VRAMs are updated
    //

    // callback for VRAM
    var onUpdateTextVram = function(){};//text
    var onUpdateAttrVram = function(){};//attributes

    // Implement when the destination is given
    if(opt.onVramUpdate) {
        var onVramUpdate = opt.onVramUpdate;
        var cache = new Array(0x10000);
        var onUpdateTextVram_ = new Array(0x10000);
        var onUpdateAttrVram_ = new Array(0x10000);
        for(var i = 0; i < 1000; i++) {
            cache[0xD000 + i] = [ i, 0, 0x71 ];
            cache[0xD800 + i] = [ i, 0, 0x71 ];
            onUpdateTextVram_[0xD000 + i] = (function(textAddr, attrAddr) {
                return function(dispcode) {
                    attrAddr[1] = dispcode;
                    onVramUpdate(textAddr[0], dispcode, textAddr[2]);
                };
            }(cache[0xD000 + i], cache[0xD800 + i]));
            onUpdateAttrVram_[0xD800 + i] = (function(textAddr, attrAddr) {
                return function(attr) {
                    textAddr[2] = attr;
                    onVramUpdate(attrAddr[0], attrAddr[1], attr);
                };
            }(cache[0xD000 + i], cache[0xD800 + i]));
        }
        onUpdateTextVram = function(addr, dispcode) {
            if(0xD000 <= addr && addr < 0xD000 + 1000) {
                onUpdateTextVram_[addr](dispcode);
            }
        };
        onUpdateAttrVram = function(addr, attr) {
            if(0xD800 <= addr && addr < 0xD800 + 1000) {
                onUpdateAttrVram_[addr](attr);
            }
        };
    }
    this.memblks = {
        IPL_AREA_ROM: new MZ700_MonitorRom(),
        IPL_AREA_RAM: new MemoryBlock({
            startAddr: 0x0000, size: 0x1000
        }),
        FREE_RAM: new MemoryBlock({
            startAddr: 0x1000, size: 0xC000
        }),
        TEXT_VRAM: new MemoryBlock({
            startAddr: 0xD000, size: 0x0800,
            onPoke: onUpdateTextVram
        }),
        ATTR_VRAM: new MemoryBlock({
            startAddr: 0xD800, size: 0x0800,
            onPoke: onUpdateAttrVram
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
            startAddr: 0xD800, size: 0x3000
        })
    };

    this._block1VRAM = true;
    this._disabledBlock1 = false;
    this.changeBlock0_MONITOR();
    this.setMemoryBlock("FREE_RAM", this.memblks.FREE_RAM);
    this.changeBlock1_VRAM();

    // fill attribute VRAM by 71h foreground white and background blue
    for(var i = 0; i < 0x800; i++) {
        this.memblks.ATTR_VRAM.pokeByte(0xD800 + i, 0x71);
    }
}
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
