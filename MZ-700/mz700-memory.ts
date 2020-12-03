"use strict";
/* tslint:disable:class-name */
import MZ700_NewMonitor from "./mz700-new-monitor";
import MemoryBlock from "../Z80/memory-block";
import MemoryBlockCbw from "../Z80/memory-block-cbw";
import MemoryBlockCbrw from "../Z80/memory-block-cbrw";
import MemoryBank from '../Z80/memory-bank';
import IMem from '../Z80/imem';

export default class MZ700_Memory extends MemoryBank {
    memblks;
    _block1VRAM = true;
    _disabledBlock1 = false;
    constructor() {
        super({});
    }
    create(opt) {

        super.create(opt);

        const monitorRom = new MZ700_NewMonitor();
        monitorRom.create();

        //
        // Create callbacks when the VRAMs are updated
        //
        const onVramUpdate = opt.onVramUpdate || (() => { /* empty */ });
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
            TEXT_VRAM: new MemoryBlockCbw({
                startAddr: 0xD000, size: 0x0800,
                onPoke: (addr, dispcode) => {
                    if (0xD000 <= addr && addr < 0xD000 + 1000) {
                        const i = addr - 0xD000;
                        cacheText[i] = dispcode;
                        onVramUpdate(i, dispcode, cacheAttr[i]);
                    }
                },
            }),
            ATTR_VRAM: new MemoryBlockCbw({
                startAddr: 0xD800, size: 0x0800,
                onPoke: (addr, attr) => {
                    if (0xD800 <= addr && addr < 0xD800 + 1000) {
                        const i = addr - 0xD800;
                        cacheAttr[i] = attr;
                        onVramUpdate(i, cacheText[i], attr);
                    }
                },
            }),
            MMAPED_IO: new MemoryBlockCbrw({
                startAddr: 0xE000, size: 0x0800,
                onPeek: opt.onMappedIoRead || (()=>{ /* empty */ }),
                onPoke: opt.onMappedIoUpdate || (()=>{ /* empty */ })
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
        for (let i = 0; i < 0x800; i++) {
            this.memblks.ATTR_VRAM.pokeByte(0xD800 + i, 0x71);
        }
    }
    setMonitorRom(bin) {
        this.memblks.IPL_AREA_ROM.setBinary(bin);
    }
    clear() {
        MemoryBank.prototype.clear.call(this);
        Object.values(this.memblks).forEach((memblk:IMem) => memblk.clear())
    }
    getTextVram() {
        return this.memblks.TEXT_VRAM;
    }
    getAttrVram() {
        return this.memblks.ATTR_VRAM;
    }
    changeBlock0_MONITOR() {
        this.setMemoryBlock("IPL_AREA", this.memblks.IPL_AREA_ROM);
    }
    changeBlock0_DRAM() {
        this.setMemoryBlock("IPL_AREA", this.memblks.IPL_AREA_RAM);
    }
    changeBlock1_DRAM() {
        this._block1VRAM = false;
        this._disabledBlock1 = false;
        this.setMemoryBlock("TEXT_VRAM", null);
        this.setMemoryBlock("ATTR_VRAM", null);
        this.setMemoryBlock("MMAPED_IO", null);
        this.setMemoryBlock("EXTND_ROM", null);
        this.setMemoryBlock("DRAM", this.memblks.DRAM);
    }
    changeBlock1_VRAM() {
        this._block1VRAM = true;
        this._disabledBlock1 = false;
        this.setMemoryBlock("DRAM", null);
        this.setMemoryBlock("TEXT_VRAM", this.memblks.TEXT_VRAM);
        this.setMemoryBlock("ATTR_VRAM", this.memblks.ATTR_VRAM);
        this.setMemoryBlock("MMAPED_IO", this.memblks.MMAPED_IO);
        this.setMemoryBlock("EXTND_ROM", this.memblks.EXTND_ROM);
    }
    disableBlock1() {
        if (!this._disabledBlock1) {
            this._disabledBlock1 = true;
            this.setMemoryBlock("TEXT_VRAM", null);
            this.setMemoryBlock("ATTR_VRAM", null);
            this.setMemoryBlock("MMAPED_IO", null);
            this.setMemoryBlock("EXTND_ROM", null);
            this.setMemoryBlock("DRAM", null);
        }
    }
    enableBlock1() {
        if (this._disabledBlock1) {
            if (this._block1VRAM) {
                this.changeBlock1_VRAM();
            } else {
                this.changeBlock1_DRAM();
            }
            this._disabledBlock1 = false;
        }
    }
}
module.exports = MZ700_Memory;
