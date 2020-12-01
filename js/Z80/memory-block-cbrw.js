"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const memory_block_cbw_1 = __importDefault(require("./memory-block-cbw"));
class MemoryBlockCbrw extends memory_block_cbw_1.default {
    constructor(opt) {
        super(opt);
        this.onPeek = (addr, value) => (0);
        if (opt.onPeek) {
            this.onPeek = opt.onPeek;
        }
    }
    peek(address) {
        const value = super.peekByte(address);
        const override = this.onPeek(address, value);
        if (override != null && override !== undefined) {
            return override;
        }
        return value;
    }
}
exports.default = MemoryBlockCbrw;
module.exports = MemoryBlockCbrw;
//# sourceMappingURL=memory-block-cbrw.js.map