"use strict";

/**
 * Memory Mapped I/O
 * @constructor
 * @param {MZ700Js} mz700js Instance of the MZ-700 Full JavaScript Emulator.
 */
function MZ_MMIO(mz700js) {
    this._mz700js = mz700js;
    this._map = [ ];
    for(var addr = 0xE000; addr < 0xE800; addr++) {
        this._map.push({ "r":[],"w":[] });
    }
}

/**
 * Create Memory Mapped I/O Object for the MZ-700 Emulator.
 * @param {MZ700Js} mz700js Instance of the MZ-700 Full JavaScript Emulator.
 * @returns {undefined}
 */
MZ_MMIO.create = mz700js => {
    return new MZ_MMIO(mz700js);
};

MZ_MMIO.prototype.onRead = function(address, handler) {
    this._mz700js.mmioMapToRead([address]);
    this._map[address - 0xE000].r.push(handler);
};

MZ_MMIO.prototype.onWrite = function(address, handler) {
    this._mz700js.mmioMapToWrite([address]);
    this._map[address - 0xE000].w.push(handler);
};

/**
 * Invoke the read handlers of this memory mapped I/O.
 * @param {number} address An address
 * @param {number} value A value
 * @returns {undefined}
 */
MZ_MMIO.prototype.read = function(address, value) {
    if(this._map[address - 0xE000]) {
        for(let handler of this._map[address - 0xE000].r) {
            handler(value);
        }
    }
};

/**
 * Invoke the write handlers of this memory mapped I/O.
 * @param {number} address An address
 * @param {number} value A value
 * @returns {undefined}
 */
MZ_MMIO.prototype.write = function(address, value) {
    if(this._map[address - 0xE000]) {
        for(let handler of this._map[address - 0xE000].w) {
            handler(value);
        }
    }
};

module.exports = MZ_MMIO;
