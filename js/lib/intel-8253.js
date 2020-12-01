"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const event_dispatcher_1 = __importDefault(require("./event-dispatcher"));
class Intel8253 {
    constructor() {
        this._counter = [
            new Intel8253Counter(),
            new Intel8253Counter(),
            new Intel8253Counter()
        ];
    }
    setCtrlWord(ctrlword) {
        const index = (ctrlword & 0xc0) >> 6;
        this._counter[index].setCtrlWord(ctrlword & 0x3f);
    }
    ;
    counter(index) {
        return this._counter[index];
    }
}
exports.default = Intel8253;
class Intel8253Counter extends event_dispatcher_1.default {
    constructor() {
        super();
        this.counter = 0xffff;
        this._written = true;
        this._read = true;
        this.out = true;
        this.gate = false;
        this.declareEvent("timeup");
        this.RL = 3;
        this.MODE = 3;
        this.BCD = 0;
        this.value = 0xffff;
        this.counter = 0xffff;
        this._written = true;
        this._read = true;
        this.out = true;
        this.gate = false;
    }
    setCtrlWord(ctrlword) {
        this.RL = (ctrlword & 0x30) >> 4;
        this.MODE = (ctrlword & 0x0e) >> 1;
        this.BCD = (ctrlword & 0x01) !== 0 ? 1 : 0;
        this.value = 0;
        this.counter = 0;
        this._written = true;
        this._read = true;
        this.out = false;
        this.gate = false;
    }
    initCount(counter, handler) {
        this.value = counter;
        this.counter = counter;
        this.addEventListener("timeup", handler);
    }
    load(value) {
        this.counter = 0;
        let setComp = false;
        switch (this.RL) {
            case 0:
                break;
            case 1:
                this.value = (value & 0x00ff);
                this.counter = this.value;
                this.out = false;
                setComp = true;
                break;
            case 2:
                this.value = (value & 0x00ff) << 8;
                this.counter = this.value;
                setComp = true;
                break;
            case 3:
                if (this._written) {
                    this._written = false;
                    this.value = (this.value & 0xff00) | (value & 0x00ff);
                    this.counter = this.value;
                    setComp = false;
                }
                else {
                    this._written = true;
                    this.value = (this.value & 0x00ff) | ((value & 0x00ff) << 8);
                    this.counter = this.value;
                    this.out = false;
                    setComp = true;
                }
                break;
        }
        if (setComp) {
            switch (this.MODE) {
                case 0:
                    this.out = false;
                    break;
                case 1:
                    break;
                case 2:
                case 6:
                    this.out = true;
                    break;
                case 3:
                case 7:
                    this.out = true;
                    break;
                case 4:
                    break;
                case 5:
                    break;
            }
        }
        return setComp;
    }
    read() {
        switch (this.RL) {
            case 0:
                break;
            case 1:
                return (this.counter & 0x00ff);
            case 2:
                return ((this.counter >> 8) & 0x00ff);
            case 3:
                if (this._read) {
                    this._read = false;
                    return (this.counter & 0x00ff);
                }
                else {
                    this._read = true;
                    return ((this.counter >> 8) & 0x00ff);
                }
        }
        return null;
    }
    setGate(gate) {
        this.gate = gate;
    }
    count(count) {
        const prevOut = this.out;
        switch (this.MODE) {
            case 0:
                if (this.counter > 0) {
                    this.counter -= count;
                    if (this.counter <= 0) {
                        this.counter = 0;
                        if (!this.out) {
                            this.out = true;
                        }
                    }
                }
                else {
                    this.counter = this.value;
                }
                break;
            case 1:
                break;
            case 2:
            case 6:
                this.counter -= count;
                if (this.out && this.counter <= 0) {
                    this.out = false;
                    this.counter = this.value;
                }
                else if (!this.out) {
                    this.out = true;
                }
                break;
            case 3:
            case 7:
                this.counter -= count;
                if (this.counter >= this.value / 2) {
                    this.out = true;
                }
                else if (this.counter > 0) {
                    this.out = false;
                }
                else {
                    this.out = true;
                    this.counter = this.value;
                }
                break;
            case 4:
                break;
            case 5:
                break;
        }
        if (!prevOut && this.out) {
            this.fireEvent("timeup");
        }
    }
}
module.exports = Intel8253;
//# sourceMappingURL=intel-8253.js.map