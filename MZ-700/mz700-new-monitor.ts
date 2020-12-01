"use strict";
import MemoryBlock from "../Z80/memory-block";
export default class MZ700_NewMonitor extends MemoryBlock {
    constructor() {
        super();
    }
    create() {
        MemoryBlock.prototype.create.call(this, { startAddr: 0x0000, size: 0x1000 });
    }
    setBinary(bin) {
        for (let i = 0; i < this.size; i++) {
            const address = this.startAddr + i;
            MemoryBlock.prototype.pokeByte.call(this,
                address, bin[address]);
        }
    }
    pokeByte( /*address, value*/) {
        /* IGNORE ALL WRITING */
    }
}
module.exports = MZ700_NewMonitor;