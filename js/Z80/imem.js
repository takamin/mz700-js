"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bin_util_1 = __importDefault(require("./bin-util"));
class IMem {
    constructor() {
    }
    create(opt) {
        opt = opt || {};
        this.size = opt.size || 0x10000;
        this.startAddr = opt.startAddr || 0;
        if (this.startAddr < 0 || this.startAddr > 0xffff) {
            throw new Error("Invalid start address of memory");
        }
        if (this.size < 0) {
            throw new Error("Invalid memory size");
        }
        if (this.startAddr + this.size > 0x10000) {
            throw new Error("Invalid combination of start address and memory size.");
        }
    }
    peekByte(address) {
        const msg = "Error: abstruct pokeByte was invoked." +
            `This method must be overrided by the class ${this.constructor.name}`;
        console.error(msg);
        throw new Error(msg);
        return 0;
    }
    pokeByte(address, value) {
        const msg = "Error: abstruct pokeByte was invoked." +
            `This method must be overrided by the class ${this.constructor.name}`;
        console.error(msg);
        throw new Error(msg);
    }
    clear() {
        for (let i = 0; i < this.size; i++) {
            this.pokeByte(i, 0);
        }
    }
    peek(address) {
        return this.peekByte(address);
    }
    poke(address, value) {
        this.pokeByte(address, value);
    }
    peekPair(address) {
        return bin_util_1.default.pair(this.peek(address + 1), this.peek(address + 0));
    }
}
exports.default = IMem;
module.exports = IMem;
//# sourceMappingURL=imem.js.map