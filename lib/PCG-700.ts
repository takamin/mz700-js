"use strict";

/* tslint:disable:no-bitwise */

import mz700cg from "./mz700-cg";
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
    static COPY = 0x20;
    static WE = 0x10;
    static SSW = 0x08;
    static ADDR = 0x07;

    _screen:MZ700CanvasRenderer;
    addr = 0x000;
    pattern = 0x00;
    we = 0;
    ssw = 1;
    copy = 0;
    _cg:mz700cg;

    /**
     * @param {MZ700CanvasRenderer} screen object.
     * @constructor
     */
    constructor(screen:MZ700CanvasRenderer) {
        this._screen = screen;

        // Copy original CGROM
        const patternBuffer = [];
        for (let code = 0; code < 512; code++) {
            patternBuffer.push([0, 0, 0, 0, 0, 0, 0, 0]);
            for (let row = 0; row < 8; row++) {
                patternBuffer[code][row] = mz700cg.ROM[code][row];
            }
        }
        this._cg = new mz700cg(patternBuffer, 8, 8);
    }

    /**
     * Set scan line 8 bit pattern for character generator.
     * @param {number} pattern 8 bit CG pattern
     * @returns {undefined}
     */
    setPattern(pattern:number):void {
        this.pattern = pattern & 0xff;
    }

    /**
     * Set lower 8 bit of address to operate.
     * @param {number} addr lower 8 bit address
     * @returns {undefined}
     */
    setAddrLo(addr:number):void {
        this.addr = ((this.addr & 0x700) | ((addr & 0xff) << 0));
    }
    /**
     * Set higher 8 bit of address to operate.
     * @param {number} addr higher 8 bit address
     * @returns {undefined}
     */
    setAddrHi(addr:number):void {
        this.addr = ((this.addr & 0x0FF) | ((addr & PCG700.ADDR) << 8));
    }
    /**
     * Set COPY flag.
     * If this flag is zero, the programmed CG pattern will be written when
     * the WE flag makes negative edge. Otherwise it is one, the preset CG
     * pattern will be used.
     * @param {number} value the flag value.
     *      A value of zero would clears the flag, otherwise set.
     * @returns {undefined}
     */
    setCopy(value:number):void {
        this.copy = (value === 0) ? 0 : 1;
    }
    /**
     * Set WE(Write Edge) flag.
     * When the flag makes negative edge, The CG pattern will be written.
     * @param {number} value the flag value.
     *      A value of zero would clears the flag, otherwise set.
     * @returns {undefined}
     */
    setWE(value:number):void {
        const we = this.we;
        this.we = (value === 0) ? 0 : 1;
        if (we && !this.we) {
            this.write();
        }
    }
    /**
     * Set SSW(Software Switch) flag.
     * When this flag is changed to zero, PCG will be displayed to the screen.
     * When it is changed to one, the original CG will be displayed.
     * @param {number} value the flag value.
     *      A value of zero would clears the flag, otherwise set.
     * @returns {undefined}
     */
    setSSW(value:number):void {
        // Software switch
        const ssw = this.ssw;
        this.ssw = (value === 0) ? 0 : 1;
        if (ssw !== this.ssw) {
            this.applySSW();
        }
    }
    /**
     * Apply PCG or restore original CG to the screen.
     * @returns {undefined}
     */
    applySSW():void {
        if (this.ssw === 0) {
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
    write():void {
        const atb = (this.addr >> 10) & 0x01;
        const dispCode = 0x80 + ((this.addr >> 3) & 0x7f);
        const cpos = atb * 256 + dispCode;
        const row = (this.addr >> 0) & 0x07;
        const pattern = ((this.copy === 0) ? this.pattern : mz700cg.ROM[cpos][row]);
        this._cg.setPattern(atb, dispCode, row, pattern);
        if (this.ssw === 0) {
            this._screen.redrawChar(atb, dispCode);
        }
    }
}

module.exports = PCG700;
