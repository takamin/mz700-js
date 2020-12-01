"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MZMMIO {
    constructor() {
        this._map = [];
        for (let addr = 0xE000; addr < 0xE800; addr++) {
            this._map.push({
                "r": (value) => value,
                "w": (value) => value,
            });
        }
    }
    onRead(address, handler) {
        this._map[address - 0xE000].r = handler;
    }
    onWrite(address, handler) {
        this._map[address - 0xE000].w = handler;
    }
    read(address, value) {
        return this._map[address - 0xE000].r(value);
    }
    write(address, value) {
        this._map[address - 0xE000].w(value);
    }
}
exports.default = MZMMIO;
module.exports = MZMMIO;
//# sourceMappingURL=mz-mmio.js.map