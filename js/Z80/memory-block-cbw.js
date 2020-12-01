"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const memory_block_1 = __importDefault(require("./memory-block"));
class MemoryBlockCbw extends memory_block_1.default {
    constructor(opt) {
        super(opt);
        this.onPoke = (addr, value) => { };
        if (opt.onPoke) {
            this.onPoke = opt.onPoke;
        }
    }
    poke(address, value) {
        super.pokeByte(address, value);
        this.onPoke(address, this.peekByte(address));
    }
}
exports.default = MemoryBlockCbw;
module.exports = MemoryBlockCbw;
//# sourceMappingURL=memory-block-cbw.js.map