"use strict";

/**
 * Memory Mapped I/O
 * @constructor
 */
function MZ_MMIO() {
    this._map = [ ];
    for(var addr = 0xE000; addr < 0xE800; addr++) {
        this._map.push({ "r":[],"w":[] });
    }
}

/**
 * Map a peripheral to adresses
 * @param {MZ_MmioPeripheral} peripheral 周辺機器オブジェクト
 * @param {Array<number>} inputs Input addresses
 * @param {Array<number>} outputs Output addresses
 * @returns {undefined}
 */
MZ_MMIO.prototype.entry = function (peripheral, inputs, outputs)
{
    inputs.forEach(function(address) {
        if(!("readMMIO" in peripheral) ||
                typeof(peripheral.readMMIO) != "function" )
        {
            console.error(
                    "The periferal does not have a method 'readMMIO' "
                    + "for memory mapped I/O at", address.HEX(4) + "h");
        } else {
            this._map[address - 0xE000].r.push(peripheral);
        }
    }, this);
    outputs.forEach(function(address) {
        if(!("writeMMIO" in peripheral) ||
                typeof(peripheral.readMMIO) != "function" )
        {
            console.error(
                    "The periferal does not have a method 'writeMMIO' "
                    + "for memory mapped I/O at", address.HEX(4) + "h");
        } else {
            this._map[address - 0xE000].w.push(peripheral);
        }
    }, this);
};

// Read MMIO
MZ_MMIO.prototype.read = function(address, value) {
    this._map[address - 0xE000].r.forEach(function(peripheral) {
        value = peripheral.readMMIO(address, value);
    });
    return undefined;
};

// Write MMIO
MZ_MMIO.prototype.write = function(address, value) {
    this._map[address - 0xE000].w.forEach(function(peripheral) {
        value = peripheral.writeMMIO(address, value);
    });
};

module.exports = {
    "create": function() { return new MZ_MMIO(); }
};
