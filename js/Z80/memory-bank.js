"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const imem_1 = __importDefault(require("./imem"));
class MemoryBank extends imem_1.default {
    constructor(opt) {
        super();
        this.create(opt);
    }
    create(opt) {
        super.create(opt);
        this.mem = new Array(this.size);
        this.memblk = new Map();
    }
    setMemoryBlock(name, memblk) {
        if (memblk == null) {
            if (this.memblk.has(name)) {
                const mem = this.memblk.get(name);
                const size = mem.size;
                const startAddr = mem.startAddr;
                const endAddr = startAddr + size;
                const nullMem = { peek: () => 0, poke: () => { } };
                for (let j = startAddr; j < endAddr; j++) {
                    this.mem[j] = nullMem;
                }
                this.memblk.delete(name);
            }
        }
        else {
            this.memblk.set(name, memblk);
            const mem = this.memblk.get(name);
            const size = mem.size;
            const startAddr = mem.startAddr;
            const endAddr = startAddr + size;
            for (let j = startAddr; j < endAddr; j++) {
                this.mem[j] = memblk;
            }
        }
    }
    peekByte(address) {
        return this.mem[address - this.startAddr].peek(address) & 0xff;
    }
    pokeByte(address, value) {
        this.mem[address - this.startAddr].poke(address, value & 0xff);
    }
}
exports.default = MemoryBank;
module.exports = MemoryBank;
//# sourceMappingURL=memory-bank.js.map