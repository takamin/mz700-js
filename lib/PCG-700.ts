"use strict";

import mz700cg from "./mz700-cg";
import mz700scrn from "./mz700-scrn";
import MZ700CanvasRenderer from "./mz700-canvas-renderer";

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
export default class PCG700 {
    static COPY:number = 0x20;
    static WE:number = 0x10;
    static SSW:number = 0x08;
    static ADDR:number = 0x07;

    _screen:MZ700CanvasRenderer;
    addr:number = 0x000;
    pattern:number = 0x00;
    we:number = 0;
    ssw:number = 1;
    copy:number = 0;
    _cg:mz700cg;

    /**
     * @param {mz700scrn} screen object.
     * @constructor
     */
    constructor(screen:MZ700CanvasRenderer) {
        this._screen = screen;

        //Copy original CGROM
        const patternBuffer = [];
        for (var code = 0; code < 512; code++) {
            patternBuffer.push([0, 0, 0, 0, 0, 0, 0, 0]);
            for (var row = 0; row < 8; row++) {
                patternBuffer[code][row] = mz700cg.ROM[code][row];
            }
        }
        this._cg = new mz700cg(patternBuffer, 8, 8);
    }
    setupMMIO(mmio) {
        // Set CG pattern
        mmio.onWrite(0xE010, value => {
            this.pattern = value & 0xff;
        });
        // Set lower 8 bit address
        mmio.onWrite(0xE011, value => {
            this.addr = ((this.addr & 0x700) | ((value & 0xff) << 0));
        });
        // Set higher 3 bit address, flags and program the pattern or copy
        mmio.onWrite(0xE012, value => {
            this.addr = ((this.addr & 0x0FF) | ((value & PCG700.ADDR) << 8));
            this.copy = ((value & PCG700.COPY) == 0) ? 0 : 1;
            // Write data on negative edge of WE.
            const we = this.we;
            this.we = ((value & PCG700.WE) == 0) ? 0 : 1;
            if (we && !this.we) {
                this.write();
            }
            // Software switch
            const ssw = this.ssw;
            this.ssw = ((value & PCG700.SSW) == 0) ? 0 : 1;
            if (ssw != this.ssw) {
                this.applySSW();
            }
        });
    }
    /**
     * Apply PCG or restore original CG to the screen.
     * @returns {undefined}
     */
    applySSW() {
        if (this.ssw == 0) {
            this._screen.changeCG(this._cg);
            this._screen.redraw();
        }
        else {
            this._screen.restoreCG();
            this._screen.redraw();
        }
    }
    /**
     * Write the pattern buffer to the specific address.
     * Or copy original pattern.
     * @returns {undefined}
     */
    write() {
        const atb = (this.addr >> 10) & 0x01;
        const dispCode = 0x80 + ((this.addr >> 3) & 0x7f);
        const cpos = atb * 256 + dispCode;
        const row = (this.addr >> 0) & 0x07;
        const pattern = ((this.copy == 0) ? this.pattern : mz700cg.ROM[cpos][row]);
        this._cg.setPattern(atb, dispCode, row, pattern);
        if (this.ssw == 0) {
            this._screen.redrawChar(atb, dispCode);
        }
    }
}

module.exports = PCG700;
