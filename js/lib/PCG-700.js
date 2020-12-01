"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mz700_cg_1 = __importDefault(require("./mz700-cg"));
class PCG700 {
    constructor(screen) {
        this.addr = 0x000;
        this.pattern = 0x00;
        this.we = 0;
        this.ssw = 1;
        this.copy = 0;
        this._screen = screen;
        const patternBuffer = [];
        for (let code = 0; code < 512; code++) {
            patternBuffer.push([0, 0, 0, 0, 0, 0, 0, 0]);
            for (let row = 0; row < 8; row++) {
                patternBuffer[code][row] = mz700_cg_1.default.ROM[code][row];
            }
        }
        this._cg = new mz700_cg_1.default(patternBuffer, 8, 8);
    }
    setPattern(pattern) {
        this.pattern = pattern & 0xff;
    }
    setAddrLo(addr) {
        this.addr = ((this.addr & 0x700) | ((addr & 0xff) << 0));
    }
    setAddrHi(addr) {
        this.addr = ((this.addr & 0x0FF) | ((addr & PCG700.ADDR) << 8));
    }
    setCopy(value) {
        this.copy = (value === 0) ? 0 : 1;
    }
    setWE(value) {
        const we = this.we;
        this.we = (value === 0) ? 0 : 1;
        if (we && !this.we) {
            this.write();
        }
    }
    setSSW(value) {
        const ssw = this.ssw;
        this.ssw = (value === 0) ? 0 : 1;
        if (ssw !== this.ssw) {
            this.applySSW();
        }
    }
    applySSW() {
        if (this.ssw === 0) {
            this._screen.changeCG(this._cg);
            this._screen.redraw();
        }
        else {
            this._screen.restoreCG();
            this._screen.redraw();
        }
    }
    write() {
        const atb = (this.addr >> 10) & 0x01;
        const dispCode = 0x80 + ((this.addr >> 3) & 0x7f);
        const cpos = atb * 256 + dispCode;
        const row = (this.addr >> 0) & 0x07;
        const pattern = ((this.copy === 0) ? this.pattern : mz700_cg_1.default.ROM[cpos][row]);
        this._cg.setPattern(atb, dispCode, row, pattern);
        if (this.ssw === 0) {
            this._screen.redrawChar(atb, dispCode);
        }
    }
}
exports.default = PCG700;
PCG700.COPY = 0x20;
PCG700.WE = 0x10;
PCG700.SSW = 0x08;
PCG700.ADDR = 0x07;
module.exports = PCG700;
//# sourceMappingURL=PCG-700.js.map