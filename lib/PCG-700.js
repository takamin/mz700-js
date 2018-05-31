(function() {
    "use strict";

    var mz700cg = require("../lib/mz700cg.js");
    //
    // http://www.maroon.dti.ne.jp/youkan/mz700/mziomap.html
    //
    // ADDR  R/W Explanation
    // E010h W   The pattern data to be writen to PCG-RAM
    // E011h W   The lower 8-bit address of PCG-RAM
    // E012h W   D0-D2 ADDR
    //           D3    SSW  0:use PCG
    //                      1:NOT use PCG
    //           D4    WE   Write data when the bit change 0 to 1 to 0.
    //           D5    COPY 0:Write data at E010h
    //                      1:Write data from CGROM
    //
    // http://www.sharpmz.org/mz-700/pcg700_01.htm Installation
    // http://www.sharpmz.org/mz-700/pcg700_02.htm Overview
    // http://www.sharpmz.org/mz-700/pcg700_03.htm Operation
    // http://www.sharpmz.org/mz-700/pcg700_04.htm PCG-AID
    // http://www.sharpmz.org/mz-700/pcg700_05.htm Programming
    // http://www.sharpmz.org/mz-700/pcg700_06.htm Games
    //

    var PCG700 = function() {
        this.addr = 0x000;
        this.pattern = 0x00;
        this.we = 0;
        this.ssw = 1;
        this.copy = 0;

        //Copy original CGROM
        var patternBuffer = [];
        for(var code = 0; code < 512; code++) {
            patternBuffer.push([0,0,0,0,0,0,0,0]);
            for(var row = 0; row < 8; row++) {
                patternBuffer[code][row] = mz700cg.ROM[code][row];
            }
        }
        this._cg = new mz700cg(patternBuffer, 8, 8);
    };

    PCG700.COPY = 0x20;
    PCG700.WE = 0x10;
    PCG700.SSW = 0x08;
    PCG700.ADDR = 0x07;

    // Extends MmioPeripheral
    const MmioPeripheral = require("./mz-mmio-peripheral.js");
    Object.keys(MmioPeripheral.prototype).forEach( m => {
        PCG700.prototype[m] = MmioPeripheral.prototype[m];
    });

    PCG700.prototype.readMMIO = function(/* addr, value */) {}

    PCG700.prototype.writeMMIO = function(addr, value) {
        //console.info("PCG700.writeMMIO(" + addr.HEX(4) + "h, " + value.HEX(4) + "h)");
        switch(addr) {
            case 0xE010:
                this.pattern = value & 0xff;
                break;
            case 0xE011:
                this.addr = ((this.addr & 0x700) | ((value & 0xff) << 0));
                break;
            case 0xE012:
                this.addr = ((this.addr & 0x0FF) | ((value & PCG700.ADDR) << 8));
                this.copy = ((value & PCG700.COPY) == 0) ? 0 : 1;

                // Write data on negative edge of WE.
                {
                    var we = this.we;
                    this.we = ((value & PCG700.WE) == 0) ? 0 : 1;
                    if(we && !this.we) {
                        this.write();
                    }
                }
                // Software switch
                {
                    var ssw = this.ssw;
                    this.ssw = ((value & PCG700.SSW) == 0) ? 0 : 1;
                    if(ssw != this.ssw) {
                        this.applySSW();
                    }
                }
                break;
            default:
                //console.warn("PCG700.onPoke unrecognized address ",  addr);
                break;
        }
    };

    PCG700.prototype.applySSW = function() {
        if(this.ssw == 0) {
            window.dispatchEvent(new Event("enablePCG700"));
        } else {
            window.dispatchEvent(new Event("disablePCG700"));
        }
    };

    PCG700.prototype.write = function() {
        var atb = (this.addr >> 10) & 0x01;
        var dispCode = 0x80 + ((this.addr >> 3) & 0x7f);
        var cpos = atb * 256 + dispCode;
        var row = (this.addr >> 0) & 0x07;
        var pattern = ((this.copy == 0) ?
                this.pattern :
                mz700cg.ROM[cpos][row]);

        //this._cg._patternBuffer[cpos][row] = pattern;
        this._cg.setPattern(atb, dispCode, row, pattern);
        if(this.ssw == 0) {
            var e = new CustomEvent("updatePCG700", {
                detail: { atb: atb, dispCode: dispCode }
            });
            window.dispatchEvent(e);
        }
    };

    module.exports = {
        "create" : function() {
            return new PCG700();
        }
    }
}());
