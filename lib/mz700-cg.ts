"use strict";
const global = Function("return this")();
if(!global.ImageData) {
    global.ImageData = require("canvas").ImageData;
}

/**
 * MZ-700 Character Generator.
 *
 * @constructor
 *
 * @param {number[]} patternBuffer
 * character pattern memory.
 *
 * @param {number} width
 * Pixel width of a character.
 *
 * @param {number} height
 * Pixel height of a character.
 */
export default class mz700cg {
    _fontTable = null;
    _patternBuffer:Array<Array<number>>;
    _width:number;
    _height:number;
    constructor(patternBuffer:Array<Array<number>>, width:number, height:number) {
        patternBuffer = patternBuffer;
        width = width;
        height = height;
        this._fontTable = null;
        this._patternBuffer = patternBuffer;
        this._width = width;
        this._height = height;
        this.createFontTable();
    }
    /**
     * Create font table.
     *
     * @returns {undefined}
     */
    createFontTable() {
        // 256 attributes x 256 character display codes
        // attribute: b7 b6 b5 b4 b3 b2 b1 b0
        //            -- -------- -- --------
        //             ^        ^  ^        ^
        //             |        |  |        |
        //             |        |  |        +--- bgc: background color
        //             |        |  +------------ xxx: (not used)
        //             |        +--------------- fgc: foreground color
        //             +------------------------ atb: bank selector bit
        this._fontTable = new Array(256 * 256);
        for (let atb = 0; atb < 2; atb++) {
            for (let dispCode = 0; dispCode < 256; dispCode++) {
                this.initFont(atb, dispCode);
            }
        }
        for (let i = 0; i < 256 * 256; i++) {
            if (!this._fontTable[i]) {
                console.warn(`mz700cg._fontTable[0x${i.toString(16)}] is null`);
            }
        }
    }
    /**
     * Initialize specific font in the table.
     *
     * @param {number} atb
     * An attribute bit which select charactoer bank by zero or one.
     *
     * @param {number} dispCode
     * A display code.
     *
     * @returns {undefined}
     */
    initFont(atb, dispCode) {
        var pattern = this._patternBuffer[atb * 256 + dispCode];
        for (var bg = 0; bg < 8; bg++) {
            for (var fg = 0; fg < 8; fg++) {
                var attr = (atb << 7) | (fg << 4) | bg;
                const index0 = mz700cg.tableIndex(attr | 0x00, dispCode);
                const index1 = mz700cg.tableIndex(attr | 0x08, dispCode);
                const font = new FontImage(pattern,
                    mz700cg.Colors[fg], mz700cg.Colors[bg],
                    this._width, this._height);
                this._fontTable[index0] = font;
                this._fontTable[index1] = font;
            }
        }
    }
    /**
     * @param {number} atb
     * An attribute bit which select charactoer bank by zero or one.
     *
     * @param {number} dispCode
     * A display code.
     *
     * @param {number} row
     * Index of row to be set the pattern.
     *
     * @param {number} pattern
     * Bit pattern to be set at the row.
     *
     * @returns {undefined}
     */
    setPattern(atb, dispCode, row, pattern) {
        var cpos = atb * 256 + dispCode;
        this._patternBuffer[cpos][row] = pattern;
        this.initFont(atb, dispCode);
    }
    /**
     * Get a font image instance.
     *
     * @param {number} attr
     * An attribute 8 bits value including atb and fore and background color.
     * [ atb:1 bit ][ fg color index:3 bits ][ bg color index: 3 bits ]
     *
     * @param {number} dispCode
     * A display code.
     *
     * @returns {FontImage} A font image.
     */
    get(attr, dispCode) {
        return this._fontTable[mz700cg.tableIndex(attr, dispCode)];
    }
    /**
     * Get a index of the font table by attribute and display code
     *
     * @param {number} attr
     * An attribute 8 bits value including atb and fore and background color.
     * [ atb:1 bit ][ fg color index:3 bits ][ bg color index: 3 bits ]
     *
     * @param {number} dispCode
     * A display code.
     *
     * @returns {number} an index of the font table.
     */
    static tableIndex(attr, dispCode) {
        return attr << 8 | dispCode;
    }

    //
    // Color table
    // [Black, Blue, Red, Magenta, Green, Cyan, Yellow, White]
    //
    static Colors:Array<{R:number,G:number,B:number,A:number}> = [
        {R:0x00, G:0x00, B:0x00, A: 0xff},
        {R:0x00, G:0x00, B:0xff, A: 0xff},
        {R:0xff, G:0x00, B:0x00, A: 0xff},
        {R:0xff, G:0x00, B:0xff, A: 0xff},
        {R:0x00, G:0xff, B:0x00, A: 0xff},
        {R:0x00, G:0xff, B:0xff, A: 0xff},
        {R:0xff, G:0xff, B:0x00, A: 0xff},
        {R:0xff, G:0xff, B:0xff, A: 0xff},
    ];

    //
    // Font bit pattern data for standard MZ-700
    //
    //  An array of array that 512 characters are defined.
    //
    //  [0x000 .. 0x0ff]: Uppercase alphabets, numbers, Japanese Kata-kana
    //  [0x100 .. 0x1ff]: Lower case alphabets, number, Japanese Hira-gana
    //
    //  These represent a bit pattern in 8 bytes by one character.
    //
    // ----
    //
    // This is own data converted from the file 'mz700fon.txt' in
    // a MZ700WIN distribution downloaded from
    // http://www.retropc.net/mz-memories/mz700/
    //
    static ROM:Array<Array<number>> = [
        [0,0,0,0,0,0,0,0],
        [24,36,66,126,66,66,66,0],
        [124,34,34,60,34,34,124,0],
        [28,34,64,64,64,34,28,0],
        [120,36,34,34,34,36,120,0],
        [126,64,64,120,64,64,126,0],
        [126,64,64,120,64,64,64,0],
        [28,34,64,78,66,34,28,0],
        [66,66,66,126,66,66,66,0],
        [28,8,8,8,8,8,28,0],
        [14,4,4,4,4,68,56,0],
        [66,68,72,112,72,68,66,0],
        [64,64,64,64,64,64,126,0],
        [66,102,90,90,66,66,66,0],
        [66,98,82,74,70,66,66,0],
        [24,36,66,66,66,36,24,0],
        [124,66,66,124,64,64,64,0],
        [24,36,66,66,74,36,26,0],
        [124,66,66,124,72,68,66,0],
        [60,66,64,60,2,66,60,0],
        [62,8,8,8,8,8,8,0],
        [66,66,66,66,66,66,60,0],
        [66,66,66,36,36,24,24,0],
        [66,66,66,90,90,102,66,0],
        [66,66,36,24,36,66,66,0],
        [34,34,34,28,8,8,8,0],
        [126,2,4,24,32,64,126,0],
        [8,8,8,8,255,8,8,8],
        [8,8,8,8,15,0,0,0],
        [8,8,8,8,248,0,0,0],
        [8,8,8,8,15,8,8,8],
        [8,8,8,8,255,0,0,0],
        [60,66,70,90,98,66,60,0],
        [8,24,40,8,8,8,62,0],
        [60,66,2,12,48,64,126,0],
        [60,66,2,60,2,66,60,0],
        [4,12,20,36,126,4,4,0],
        [126,64,120,4,2,68,56,0],
        [28,32,64,124,66,66,60,0],
        [126,66,4,8,16,16,16,0],
        [60,66,66,60,66,66,60,0],
        [60,66,66,62,2,4,56,0],
        [0,0,0,126,0,0,0,0],
        [0,0,126,0,126,0,0,0],
        [0,0,8,0,0,8,8,16],
        [0,2,4,8,16,32,64,0],
        [0,0,0,0,0,24,24,0],
        [0,0,0,0,0,8,8,16],
        [0,255,0,0,0,0,0,0],
        [64,64,64,64,64,64,64,64],
        [128,128,128,128,128,128,128,255],
        [1,1,1,1,1,1,1,255],
        [0,0,0,255,0,0,0,0],
        [16,16,16,16,16,16,16,16],
        [255,255,0,0,0,0,0,0],
        [192,192,192,192,192,192,192,192],
        [0,0,0,0,0,255,0,0],
        [4,4,4,4,4,4,4,4],
        [0,0,0,0,255,255,255,255],
        [15,15,15,15,15,15,15,15],
        [0,0,0,0,0,0,0,255],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,255,255],
        [3,3,3,3,3,3,3,3],
        [0,0,8,4,254,4,8,0],
        [8,28,62,127,127,28,62,0],
        [255,127,63,31,15,7,3,1],
        [255,255,255,255,255,255,255,255],
        [8,28,62,127,62,28,8,0],
        [0,0,16,32,127,32,16,0],
        [8,28,42,127,42,8,8,0],
        [0,60,126,126,126,126,60,0],
        [0,60,66,66,66,66,60,0],
        [60,66,2,12,16,0,16,0],
        [255,195,129,129,129,129,195,255],
        [0,0,0,0,3,4,8,8],
        [0,0,0,0,192,32,16,16],
        [128,192,224,240,248,252,254,255],
        [1,3,7,15,31,63,127,255],
        [0,0,8,0,0,8,0,0],
        [0,8,28,42,8,8,8,0],
        [14,24,48,96,48,24,14,0],
        [60,32,32,32,32,32,60,0],
        [54,127,127,127,62,28,8,0],
        [60,4,4,4,4,4,60,0],
        [28,34,74,86,76,32,30,0],
        [255,254,252,248,240,224,192,128],
        [112,24,12,6,12,24,112,0],
        [160,80,160,80,160,80,160,80],
        [0,64,32,16,8,4,2,0],
        [170,85,170,85,170,85,170,85],
        [240,240,240,240,15,15,15,15],
        [0,0,0,0,15,8,8,8],
        [0,0,0,0,248,8,8,8],
        [8,8,8,8,248,8,8,8],
        [0,0,0,0,255,8,8,8],
        [0,0,1,62,84,20,20,0],
        [8,8,8,8,0,0,8,0],
        [36,36,36,0,0,0,0,0],
        [36,36,126,36,126,36,36,0],
        [8,30,40,28,10,60,8,0],
        [0,98,100,8,16,38,70,0],
        [48,72,72,48,74,68,58,0],
        [4,8,16,0,0,0,0,0],
        [4,8,16,16,16,8,4,0],
        [32,16,8,8,8,16,32,0],
        [0,8,8,62,8,8,0,0],
        [8,42,28,62,28,42,8,0],
        [15,15,15,15,240,240,240,240],
        [129,66,36,24,24,36,66,129],
        [16,16,32,192,0,0,0,0],
        [8,8,4,3,0,0,0,0],
        [255,0,0,0,0,0,0,0],
        [128,128,128,128,128,128,128,128],
        [255,128,128,128,128,128,128,128],
        [255,1,1,1,1,1,1,1],
        [0,0,255,0,0,0,0,0],
        [32,32,32,32,32,32,32,32],
        [1,2,4,8,16,32,64,128],
        [128,64,32,16,8,4,2,1],
        [0,0,0,0,255,0,0,0],
        [8,8,8,8,8,8,8,8],
        [255,255,255,255,0,0,0,0],
        [240,240,240,240,240,240,240,240],
        [0,0,0,0,0,0,255,0],
        [2,2,2,2,2,2,2,2],
        [0,0,0,0,0,255,255,255],
        [7,7,7,7,7,7,7,7],
        [0,8,8,8,42,28,8,0],
        [4,56,8,62,8,8,16,0],
        [0,62,2,2,2,2,62,0],
        [0,34,34,18,2,4,24,0],
        [0,48,2,50,2,4,56,0],
        [2,4,8,24,40,8,8,0],
        [0,8,4,34,34,34,34,0],
        [8,62,8,62,8,8,8,0],
        [0,30,18,34,2,4,24,0],
        [0,28,0,0,0,0,62,0],
        [0,62,2,2,20,8,4,0],
        [4,4,4,4,4,8,16,0],
        [36,36,36,36,4,8,16,0],
        [0,62,16,62,16,16,14,0],
        [0,28,0,28,0,60,2,0],
        [28,0,62,2,2,4,8,0],
        [16,62,18,20,16,16,14,0],
        [0,30,18,42,6,4,24,0],
        [0,62,2,4,8,20,34,0],
        [16,16,16,24,20,16,16,0],
        [16,62,18,18,18,18,36,0],
        [8,8,62,8,8,16,32,0],
        [32,32,62,32,32,32,30,0],
        [28,0,62,8,8,8,16,0],
        [20,62,20,20,4,8,16,0],
        [0,48,0,2,2,4,56,0],
        [0,42,42,42,2,4,8,0],
        [0,62,34,34,34,34,62,0],
        [16,30,36,4,4,4,8,0],
        [30,16,16,16,0,0,0,0],
        [0,0,62,2,12,8,16,0],
        [0,0,16,62,18,20,16,0],
        [0,62,34,34,2,4,8,0],
        [0,62,2,20,8,20,32,0],
        [0,62,2,2,2,4,24,0],
        [62,2,10,12,8,8,16,0],
        [8,62,34,34,2,4,8,0],
        [0,62,8,8,8,8,62,0],
        [4,62,4,12,20,36,4,0],
        [16,16,62,18,20,16,16,0],
        [0,28,4,4,4,4,62,0],
        [0,62,2,62,2,2,62,0],
        [8,62,8,8,42,42,8,0],
        [0,16,40,4,2,2,0,0],
        [0,32,32,34,36,40,48,0],
        [0,2,2,20,8,20,32,0],
        [0,8,40,40,42,42,44,0],
        [8,62,4,8,28,42,8,0],
        [0,8,16,32,34,62,2,0],
        [0,0,0,8,8,8,120,0],
        [0,0,4,8,24,40,8,0],
        [0,0,0,28,4,4,62,0],
        [0,62,2,62,2,4,8,0],
        [0,0,0,0,64,32,16,0],
        [0,0,8,62,34,2,12,0],
        [0,0,60,4,60,4,60,0],
        [112,80,112,0,0,0,0,0],
        [0,0,0,0,0,0,32,0],
        [0,0,0,62,8,8,62,0],
        [0,0,0,42,42,2,12,0],
        [16,72,32,0,0,0,0,0],
        [0,0,0,0,112,80,112,0],
        [0,0,4,62,12,20,36,0],
        [0,0,0,28,0,0,0,0],
        [28,28,62,28,8,0,62,0],
        [255,247,247,247,213,227,247,255],
        [255,247,227,213,247,247,247,255],
        [255,255,247,251,129,251,247,255],
        [255,255,239,223,129,223,239,255],
        [187,187,187,131,187,187,187,255],
        [227,221,191,191,191,221,227,255],
        [24,36,126,255,90,36,0,0],
        [224,71,66,126,66,71,224,0],
        [34,62,42,8,8,73,127,65],
        [28,28,8,62,8,8,20,34],
        [0,17,210,252,210,17,0,0],
        [0,136,75,63,75,136,0,0],
        [34,20,8,8,62,8,28,28],
        [60,126,255,219,255,231,126,60],
        [60,66,129,165,129,153,66,60],
        [62,34,34,62,34,34,62,0],
        [62,34,62,34,62,34,66,0],
        [8,42,42,8,20,34,65,0],
        [8,9,58,12,28,42,73,0],
        [8,8,62,8,28,42,73,0],
        [8,20,62,73,62,28,127,0],
        [0,8,8,62,8,8,127,0],
        [8,72,126,72,62,8,127,0],
        [32,62,72,60,40,126,8,0],
        [4,126,84,127,82,127,10,0],
        [8,20,34,127,18,18,36,0],
        [56,18,127,23,59,82,20,0],
        [127,73,73,127,65,65,65,0],
        [34,20,62,8,62,8,8,0],
        [12,18,16,56,16,16,62,0],
        [0,192,200,84,84,85,34,0],
        [0,0,0,0,0,2,255,2],
        [2,2,2,2,2,2,7,2],
        [2,2,2,2,2,2,255,2],
        [0,0,32,80,136,5,2,0],
        [0,14,17,34,196,4,2,1],
        [0,255,0,129,66,66,129,0],
        [0,112,136,68,35,32,64,128],
        [0,196,164,148,143,148,164,196],
        [0,35,37,41,241,41,37,35],
        [136,144,160,192,192,168,152,184],
        [168,176,184,192,192,160,144,136],
        [128,64,32,16,31,32,64,128],
        [0,0,36,36,231,36,36,0],
        [8,8,62,0,0,62,8,8],
        [8,16,32,16,8,4,2,4],
        [85,170,85,170,85,170,85,170],
        [0,0,0,0,0,0,0,0],
        [0,112,112,112,0,0,0,0],
        [0,7,7,7,0,0,0,0],
        [0,119,119,119,0,0,0,0],
        [0,0,0,0,0,112,112,112],
        [0,112,112,112,0,112,112,112],
        [0,7,7,7,0,112,112,112],
        [0,119,119,119,0,112,112,112],
        [0,0,0,0,0,7,7,7],
        [0,112,112,112,0,7,7,7],
        [0,7,7,7,0,7,7,7],
        [0,119,119,119,0,7,7,7],
        [0,0,0,0,0,119,119,119],
        [0,112,112,112,0,119,119,119],
        [0,7,7,7,0,119,119,119],
        [0,119,119,119,0,119,119,119],
        [0,0,0,0,0,0,0,0],
        [0,0,56,4,60,68,58,0],
        [64,64,92,98,66,98,92,0],
        [0,0,60,66,64,66,60,0],
        [2,2,58,70,66,70,58,0],
        [0,0,60,66,126,64,60,0],
        [12,18,16,124,16,16,16,0],
        [0,0,58,70,70,58,2,60],
        [64,64,92,98,66,66,66,0],
        [8,0,24,8,8,8,28,0],
        [4,0,12,4,4,4,68,56],
        [64,64,68,72,80,104,68,0],
        [24,8,8,8,8,8,28,0],
        [0,0,118,73,73,73,73,0],
        [0,0,92,98,66,66,66,0],
        [0,0,60,66,66,66,60,0],
        [0,0,92,98,98,92,64,64],
        [0,0,58,70,70,58,2,2],
        [0,0,92,98,64,64,64,0],
        [0,0,62,64,60,2,124,0],
        [16,16,124,16,16,18,12,0],
        [0,0,66,66,66,66,60,0],
        [0,0,66,66,66,36,24,0],
        [0,0,65,73,73,73,54,0],
        [0,0,68,40,16,40,68,0],
        [0,0,66,66,70,58,2,60],
        [0,0,126,4,24,32,126,0],
        [8,8,8,8,255,8,8,8],
        [8,8,8,8,15,0,0,0],
        [8,8,8,8,248,0,0,0],
        [8,8,8,8,15,8,8,8],
        [8,8,8,8,255,0,0,0],
        [60,66,70,90,98,66,60,0],
        [8,24,40,8,8,8,62,0],
        [60,66,2,12,48,64,126,0],
        [60,66,2,60,2,66,60,0],
        [4,12,20,36,126,4,4,0],
        [126,64,120,4,2,68,56,0],
        [28,32,64,124,66,66,60,0],
        [126,66,4,8,16,16,16,0],
        [60,66,66,60,66,66,60,0],
        [60,66,66,62,2,4,56,0],
        [0,0,0,126,0,0,0,0],
        [0,0,126,0,126,0,0,0],
        [0,0,8,0,0,8,8,16],
        [0,2,4,8,16,32,64,0],
        [0,0,0,0,0,24,24,0],
        [0,0,0,0,0,8,8,16],
        [0,255,0,0,0,0,0,0],
        [64,64,64,64,64,64,64,64],
        [128,128,128,128,128,128,128,255],
        [1,1,1,1,1,1,1,255],
        [0,0,0,255,0,0,0,0],
        [16,16,16,16,16,16,16,16],
        [255,255,0,0,0,0,0,0],
        [192,192,192,192,192,192,192,192],
        [0,0,0,0,0,255,0,0],
        [4,4,4,4,4,4,4,4],
        [0,0,0,0,255,255,255,255],
        [15,15,15,15,15,15,15,15],
        [0,0,0,0,0,0,0,255],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,255,255],
        [3,3,3,3,3,3,3,3],
        [0,0,8,4,254,4,8,0],
        [8,28,62,127,127,28,62,0],
        [255,127,63,31,15,7,3,1],
        [255,255,255,255,255,255,255,255],
        [8,28,62,127,62,28,8,0],
        [0,0,16,32,127,32,16,0],
        [8,28,42,127,42,8,8,0],
        [0,60,126,126,126,126,60,0],
        [0,60,66,66,66,66,60,0],
        [60,66,2,12,16,0,16,0],
        [255,195,129,129,129,129,195,255],
        [0,0,0,0,3,4,8,8],
        [0,0,0,0,192,32,16,16],
        [128,192,224,240,248,252,254,255],
        [1,3,7,15,31,63,127,255],
        [0,0,8,0,0,8,0,0],
        [0,8,28,42,8,8,8,0],
        [14,24,48,96,48,24,14,0],
        [60,32,32,32,32,32,60,0],
        [54,127,127,127,62,28,8,0],
        [60,4,4,4,4,4,60,0],
        [28,34,74,86,76,32,30,0],
        [255,254,252,248,240,224,192,128],
        [112,24,12,6,12,24,112,0],
        [160,80,160,80,160,80,160,80],
        [0,64,32,16,8,4,2,0],
        [170,85,170,85,170,85,170,85],
        [240,240,240,240,15,15,15,15],
        [0,0,0,0,15,8,8,8],
        [0,0,0,0,248,8,8,8],
        [8,8,8,8,248,8,8,8],
        [0,0,0,0,255,8,8,8],
        [0,0,1,62,84,20,20,0],
        [8,8,8,8,0,0,8,0],
        [36,36,36,0,0,0,0,0],
        [36,36,126,36,126,36,36,0],
        [8,30,40,28,10,60,8,0],
        [0,98,100,8,16,38,70,0],
        [48,72,72,48,74,68,58,0],
        [4,8,16,0,0,0,0,0],
        [4,8,16,16,16,8,4,0],
        [32,16,8,8,8,16,32,0],
        [0,8,8,62,8,8,0,0],
        [8,42,28,62,28,42,8,0],
        [15,15,15,15,240,240,240,240],
        [129,66,36,24,24,36,66,129],
        [16,16,32,192,0,0,0,0],
        [8,8,4,3,0,0,0,0],
        [255,0,0,0,0,0,0,0],
        [128,128,128,128,128,128,128,128],
        [255,128,128,128,128,128,128,128],
        [255,1,1,1,1,1,1,1],
        [0,0,255,0,0,0,0,0],
        [32,32,32,32,32,32,32,32],
        [4,8,17,34,68,136,16,32],
        [32,16,136,68,34,17,8,4],
        [0,0,0,0,255,0,0,0],
        [8,8,8,8,8,8,8,8],
        [255,255,255,255,0,0,0,0],
        [240,240,240,240,240,240,240,240],
        [0,0,0,0,0,0,255,0],
        [2,2,2,2,2,2,2,2],
        [0,0,0,0,0,255,255,255],
        [7,7,7,7,7,7,7,7],
        [0,8,8,8,42,28,8,0],
        [16,254,32,124,2,2,252,0],
        [0,252,2,0,0,128,126,0],
        [60,8,16,126,8,16,12,0],
        [64,64,64,64,68,68,56,0],
        [132,130,130,130,130,144,96,0],
        [132,158,132,132,156,166,92,0],
        [16,126,8,126,4,2,96,24],
        [12,24,48,96,48,24,12,0],
        [158,128,128,128,128,144,222,0],
        [16,126,16,126,16,112,156,114],
        [56,84,146,146,146,146,100,0],
        [68,68,68,100,4,8,16,0],
        [32,248,32,248,34,34,28,0],
        [112,16,20,126,148,148,100,0],
        [96,0,156,162,194,130,28,0],
        [68,68,254,68,88,64,62,0],
        [32,252,64,94,128,160,190,0],
        [8,254,8,56,72,56,8,16],
        [32,34,44,48,64,128,126,0],
        [34,249,37,36,36,36,72,0],
        [32,250,65,68,156,166,28,0],
        [224,38,69,132,132,136,112,0],
        [254,4,8,16,16,8,4,0],
        [32,254,16,8,68,32,24,0],
        [16,32,32,112,72,136,134,0],
        [128,124,2,2,2,4,24,0],
        [124,8,16,44,66,2,36,24],
        [132,190,132,132,132,132,72,0],
        [30,16,16,16,0,0,0,0],
        [0,32,112,32,120,148,104,0],
        [0,0,88,228,40,32,16,0],
        [32,228,42,50,98,162,36,0],
        [4,68,124,74,178,151,102,0],
        [56,0,16,74,74,138,48,0],
        [32,252,32,124,170,146,100,0],
        [24,0,60,66,2,4,8,0],
        [16,0,124,8,16,40,70,0],
        [32,253,33,124,162,162,100,0],
        [72,76,50,226,36,16,16,8],
        [8,156,170,202,202,140,24,0],
        [8,14,8,8,120,142,120,0],
        [158,132,158,132,156,166,220,0],
        [0,32,80,136,4,2,2,0],
        [32,230,44,52,100,164,34,0],
        [4,68,124,74,178,146,100,0],
        [124,8,16,60,66,26,36,24],
        [32,228,42,50,102,171,38,0],
        [32,253,33,96,160,98,62,0],
        [0,0,0,0,8,8,8,120],
        [0,0,72,68,68,68,32,0],
        [0,0,16,184,212,152,48,0],
        [16,254,32,116,184,72,126,0],
        [0,0,0,0,0,64,32,16],
        [0,32,0,120,4,4,8,0],
        [0,0,32,56,32,120,96,0],
        [112,80,112,0,0,0,0,0],
        [0,0,0,0,0,0,32,0],
        [0,32,0,120,16,48,76,0],
        [0,0,0,248,4,4,24,0],
        [32,144,64,0,0,0,0,0],
        [0,0,0,0,0,112,80,112],
        [0,32,116,32,120,164,104,0],
        [0,0,0,28,0,0,0,0],
        [28,28,62,28,8,0,62,0],
        [255,247,247,247,213,227,247,255],
        [255,247,227,213,247,247,247,255],
        [255,255,247,251,129,251,247,255],
        [255,255,239,223,129,223,239,255],
        [187,187,187,131,187,187,187,255],
        [227,221,191,191,191,221,227,255],
        [24,36,126,255,90,36,0,0],
        [224,71,66,126,66,71,224,0],
        [34,62,42,8,8,73,127,65],
        [28,28,8,62,8,8,20,34],
        [0,17,210,252,210,17,0,0],
        [0,136,75,63,75,136,0,0],
        [34,20,8,8,62,8,28,28],
        [60,126,255,219,255,231,126,60],
        [60,66,129,165,129,153,66,60],
        [62,34,34,62,34,34,62,0],
        [62,34,62,34,62,34,66,0],
        [8,42,42,8,20,34,65,0],
        [8,9,58,12,28,42,73,0],
        [8,8,62,8,28,42,73,0],
        [8,20,62,73,62,28,127,0],
        [0,8,8,62,8,8,127,0],
        [8,72,126,72,62,8,127,0],
        [32,62,72,60,40,126,8,0],
        [4,126,84,127,82,127,10,0],
        [8,20,34,127,18,18,36,0],
        [56,18,127,23,59,82,20,0],
        [127,73,73,127,65,65,65,0],
        [34,20,62,8,62,8,8,0],
        [12,18,16,56,16,16,62,0],
        [0,192,200,84,84,85,34,0],
        [0,0,0,0,0,2,255,2],
        [2,2,2,2,2,2,7,2],
        [2,2,2,2,2,2,255,2],
        [0,0,32,80,136,5,2,0],
        [0,14,17,34,196,4,2,1],
        [0,255,0,129,66,66,129,0],
        [0,112,136,68,35,32,64,128],
        [0,196,164,148,143,148,164,196],
        [0,35,37,41,241,41,37,35],
        [136,144,160,192,192,168,152,184],
        [168,176,184,192,192,160,144,136],
        [128,64,32,16,31,32,64,128],
        [0,0,36,36,231,36,36,0],
        [8,8,62,0,0,62,8,8],
        [8,16,32,16,8,4,2,4],
        [85,170,85,170,85,170,85,170],
        [0,0,0,0,0,0,0,0],
        [0,112,112,112,0,0,0,0],
        [0,7,7,7,0,0,0,0],
        [0,119,119,119,0,0,0,0],
        [0,0,0,0,0,112,112,112],
        [0,112,112,112,0,112,112,112],
        [0,7,7,7,0,112,112,112],
        [0,119,119,119,0,112,112,112],
        [0,0,0,0,0,7,7,7],
        [0,112,112,112,0,7,7,7],
        [0,7,7,7,0,7,7,7],
        [0,119,119,119,0,7,7,7],
        [0,0,0,0,0,119,119,119],
        [0,112,112,112,0,119,119,119],
        [0,7,7,7,0,119,119,119],
        [0,119,119,119,0,119,119,119]
    ];
}

/**
 * Font image offering CANVAS element.
 *
 * @param {number[]} pattern
 * A pixel bit pattern of font. An 8 length array of 8 bit numbers.
 *
 * @param {number} fg
 * An index of foreground color (0-7).
 *
 * @param {number} bg
 * An index of foreground color (0-7).
 *
 * @param {number} width
 * Pixel width of a character.
 *
 * @param {number} height
 * Pixel height of a character.
 *
 * @constructor
 */
class FontImage {
    getImageData:Function;
    constructor(
        pattern:Array<number>,
        fg:{R:number,G:number,B:number,A:number},
        bg:{R:number,G:number,B:number,A:number},
        width:number,
        height:number)
    {
        this.getImageData = () => {
            const buf:Array<number> = Array(width * 4 * height).fill(0);
            let index = 0;
            for(let row = 0; row < 8; row++) {
                const bits = pattern[row];
                for(let col = 0; col < 8; col++) {
                    if((bits & (0x80 >> col)) != 0) {
                        buf[index + 0] = fg.R;
                        buf[index + 1] = fg.G;
                        buf[index + 2] = fg.B;
                        buf[index + 3] = fg.A;
                    } else {
                        buf[index + 0] = bg.R;
                        buf[index + 1] = bg.G;
                        buf[index + 2] = bg.B;
                        buf[index + 3] = bg.A;
                    }
                    index += 4;
                }
            }

            const array = Uint8ClampedArray.from(buf);
            const imageData = new ImageData(array, width, height);
            this.getImageData = () => imageData;

            return this.getImageData();
        };
    }
}

module.exports = mz700cg;
