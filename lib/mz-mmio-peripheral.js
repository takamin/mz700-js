"use strict";

/**
 * The Interface for MZ-Serias Memory mapped peripheral.
 * @constructor
 */
function MZ_MmioPeripheral() {}

/**
 * Input from MMIO.
 * @param {number} addr The address to read.
 * @param {number} value The value read.
 * @returns {undefined}
 */
MZ_MmioPeripheral.prototype.readMMIO = function(addr, value) {
    console.error(this.constructor.name +
        ".readMMIO(", addr, ",", value, ") has no implementation.");
};

/**
 * Output to MMIO.
 * @param {number} addr The address to read.
 * @param {number} value The value read.
 * @returns {undefined}
 */
MZ_MmioPeripheral.prototype.writeMMIO = function(addr, value) {
    console.error(this.constructor.name +
        ".writeMMIO(", addr, ",", value, ") has no implementation.");
};

module.exports = MZ_MmioPeripheral;
