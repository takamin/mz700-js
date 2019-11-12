"use strict";

/**
 * Memory Mapped I/O
 * @constructor
 */
function MZMMIO() {
    this._map = [ ];
    for(var addr = 0xE000; addr < 0xE800; addr++) {
        this._map.push({ "r":[],"w":[] });
    }
}

MZMMIO.prototype.onRead = function(address, handler) {
    this._map[address - 0xE000].r.push(handler);
};

MZMMIO.prototype.onWrite = function(address, handler) {
    this._map[address - 0xE000].w.push(handler);
};

/**
 * Invoke the read handlers of this memory mapped I/O.
 * @param {number} address An address
 * @param {number} value A value
 * @returns {undefined}
 */
MZMMIO.prototype.read = function(address, value) {
    const handlers = this._map[address - 0xE000];
    if(handlers) {
        for(const handler of handlers.r) {
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
MZMMIO.prototype.write = function(address, value) {
    const handlers = this._map[address - 0xE000];
    if(handlers) {
        for(const handler of handlers.w) {
            handler(value);
        }
    }
};

module.exports = MZMMIO;
