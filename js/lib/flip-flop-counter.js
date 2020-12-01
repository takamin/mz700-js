"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const event_dispatcher_1 = __importDefault(require("./event-dispatcher"));
class FlipFlopCounter extends event_dispatcher_1.default {
    constructor(count) {
        super();
        this.declareEvent("change");
        this.initialize();
        this._counterMax = count;
    }
    initialize() {
        this._out = false;
        this._counter = 0;
    }
    readOutput() {
        return this._out;
    }
    count() {
        this._counter++;
        if (this._counter >= this._counterMax / 2) {
            this._out = !this._out;
            this._counter = 0;
            this.fireEvent("change");
            return true;
        }
        return false;
    }
}
exports.default = FlipFlopCounter;
module.exports = FlipFlopCounter;
//# sourceMappingURL=flip-flop-counter.js.map