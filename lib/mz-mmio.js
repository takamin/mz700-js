"use strict";

/**
 * Memory Mapped I/O
 * @constructor
 */
function MZ_MMIO() {
    this._mz700js = null;
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
    const mmio = new MZ_MMIO();
    mmio.setMZ700Js(mz700js)
    return mmio;
};

/**
 * Setup with the MZ-700 Emulator.
 * @param {MZ700Js} mz700js Instance of the MZ-700 Full JavaScript Emulator.
 * @returns {undefined}
 */
MZ_MMIO.prototype.setMZ700Js = function(mz700js) {
    this._mz700js = mz700js;
    this._mz700js.subscribe("onMmioRead", param => {
        for(const handler of this._map[param.address - 0xE000].r) {
            handler(param.value);
        }
    });
    this._mz700js.subscribe("onMmioWrite", param => {
        for(const handler of this._map[param.address - 0xE000].w) {
            handler(param.value);
        }
    });
};

/**
 * Entry a callback when the address was read.
 * @param {number} address An address in Memory Mapped I/O $E000..$E800.
 * @param {Function} handler A handler function
 * @returns {undefined}
 */
MZ_MMIO.prototype.onRead = function(address, handler) {
    this._mz700js.mmioMapToRead([address]);
    this._map[address - 0xE000].r.push(handler);
};

/**
 * Entry a callback when the address was written.
 * @param {number} address An address in Memory Mapped I/O $E000..$E800.
 * @param {Function} handler A handler function
 * @returns {undefined}
 */
MZ_MMIO.prototype.onWrite = function(address, handler) {
    this._mz700js.mmioMapToWrite([address]);
    this._map[address - 0xE000].w.push(handler);
};

module.exports = MZ_MMIO;
