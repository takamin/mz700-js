"use strict";
/* tslint:disable:class-name */
import MemoryBlock from "../Z80/memory-block";
export default class MZ700_NewMonitor extends MemoryBlock {
    constructor() {
        super();
    }
    create():void {
        MemoryBlock.prototype.create.call(this, { startAddr: 0x0000, size: 0x1000 });
    }
    setBinary(bin:number[]):void {
        for (let i = 0; i < this.size; i++) {
            const address = this.startAddr + i;
            MemoryBlock.prototype.pokeByte.call(this,
                address, bin[address]);
        }
    }
    // eslint-disable-next-line  @typescript-eslint/no-unused-vars
    pokeByte(address:number, value:number):void {
        /* IGNORE ALL WRITING */
    }
}
module.exports = MZ700_NewMonitor;
