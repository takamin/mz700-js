"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const memory_block_1 = __importDefault(require("../Z80/memory-block"));
class MZ700_NewMonitor extends memory_block_1.default {
    constructor() {
        super();
    }
    create() {
        memory_block_1.default.prototype.create.call(this, { startAddr: 0x0000, size: 0x1000 });
    }
    setBinary(bin) {
        for (let i = 0; i < this.size; i++) {
            const address = this.startAddr + i;
            memory_block_1.default.prototype.pokeByte.call(this, address, bin[address]);
        }
    }
    pokeByte(address, value) {
    }
}
exports.default = MZ700_NewMonitor;
module.exports = MZ700_NewMonitor;
//# sourceMappingURL=mz700-new-monitor.js.map