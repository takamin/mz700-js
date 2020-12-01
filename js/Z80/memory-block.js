"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const imem_1 = __importDefault(require("./imem"));
class MemoryBlock extends imem_1.default {
    constructor(opt) {
        super();
        super.create(opt);
        this.mem = new Array(this.size);
    }
    peekByte(address) {
        return this.mem[address - this.startAddr];
    }
    pokeByte(address, value) {
        this.mem[address - this.startAddr] = value;
    }
}
exports.default = MemoryBlock;
module.exports = MemoryBlock;
//# sourceMappingURL=memory-block.js.map