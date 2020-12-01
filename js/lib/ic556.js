"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const flip_flop_counter_1 = __importDefault(require("../lib/flip-flop-counter"));
class IC556 extends flip_flop_counter_1.default {
    constructor(freq) {
        super(freq);
        this._reset = false;
    }
    count() {
        if (this._reset) {
            return flip_flop_counter_1.default.prototype.count.call(this);
        }
        return false;
    }
    loadReset(value) {
        if (!value) {
            if (this._reset) {
                this._reset = false;
                this.initialize();
            }
        }
        else {
            if (!this._reset) {
                this._reset = true;
            }
        }
    }
}
exports.default = IC556;
module.exports = IC556;
//# sourceMappingURL=ic556.js.map