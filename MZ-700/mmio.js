(function() {
    "use strict";

    //
    // Memory Mapped I/O
    //
    var MMIO = function () {
        this.mmio = [ ];
        for(var addr = 0xE000; addr < 0xE800; addr++) {
            this.mmio.push({ "r":[],"w":[] });
        }
    };
    window.MMIO = MMIO;

    // Map a peripheral to adresses
    MMIO.prototype.entry = function (peripheral, inputs, outputs)
    {
        inputs.forEach(function(address) {
            if(!("readMMIO" in peripheral) ||
                    typeof(peripheral.readMMIO) != "function" )
            {
                console.error(
                        "The periferal does not have a method 'readMMIO' "
                        + "for memory mapped I/O at", address.HEX(4) + "h");
            } else {
                this.mmio[address - 0xE000].r.push(peripheral);
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
                this.mmio[address - 0xE000].w.push(peripheral);
            }
        }, this);
    };

    // Read MMIO
    MMIO.prototype.read = function(address, value) {
        this.mmio[address - 0xE000].r.forEach(function(peripheral) {
            value = peripheral.readMMIO(address, value);
        });
        return read;
    };

    // Write MMIO
    MMIO.prototype.write = function(address, value) {
        this.mmio[address - 0xE000].w.forEach(function(peripheral) {
            value = peripheral.writeMMIO(address, value);
        });
    };

    module.exports = {
        "create": function() { return new MMIO(); }
    };
}());

