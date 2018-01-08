/*
 * jquery.mz700scrn.js - MZ-700 Screen
 *
 * The MZ-700 is an 8-bit personal computer released by Sharp in Nov 15 1982,
 * belong in the company's MZ series.
 *
 * Copyright (c) 2016 Koji Takami
 * Released under the MIT license
 */

/*
The MIT License (MIT)

Copyright (c) 2016 Koji Takami

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
(function() {
    "use strict";

    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("mz700scrn");
    var mz700scrn = function(container) {

        //A Container container
        this._container = container;

        //A canvas context to draw
        this._ctx = null;
    };
    window.mz700scrn = mz700scrn;

    mz700scrn.colors = {
        "black":0,
        "blue":1,
        "red":2,
        "magenta":3,
        "green":4,
        "cyan":5,
        "yellow":6,
        "white":7,
    };

    //
    // default screen size by character
    //
    mz700scrn.size = {"cols":40, "rows":25};

    //
    // Dot size of a character
    //
    mz700scrn.charSize = {"dotWidth":8, "dotHeight":8};

    //
    // Create screen
    //
    mz700scrn.prototype.create = function(opt) {

        this.opt = {
            cols: mz700scrn.size.cols,
            rows: mz700scrn.size.rows,
            CG: mz700scrn.CGROMDATA,
            color : mz700scrn.colors.white,
            backgroundColor : mz700scrn.colors.blue,
            width: '100%',
            alt: null, title: "MZ-700 FULL JAVASCRIPT EMULATOR"
        };
        opt = opt || {};
        Object.keys(this.opt).forEach(function(key) {
            if(key in opt) {
                this.opt[key] = opt[key];
            }
        }, this);

        // Create text/attr vram
        this.vramText = [];
        this.vramAttr = [];
        for(var i = 0; i < this.opt.cols * this.opt.rows; i++) {
            this.vramText.push(0x00);
            this.vramAttr.push(0x71);
        }

        //Create canvas object
        var canvas = document.createElement("CANVAS");
        canvas.setAttribute("width", mz700scrn.charSize.dotWidth * this.opt.cols + "px");
        canvas.setAttribute("height", mz700scrn.charSize.dotHeight * this.opt.rows + "px");
        canvas.setAttribute("style", "width:100%;height:auto");
        $(canvas).css("width", this.opt.width);
        if(this.opt.alt != null) {
            canvas.setAttribute("alt", this.opt.alt);
        }
        if(this.opt.title != null) {
            canvas.setAttribute("title", this.opt.title);
        }

        //Append to the container
        this._container.appendChild(canvas);

        //Save canvas context
        this._ctx = canvas.getContext('2d');

        //
        // A translation table to convert an address index on the VRAM
        // to the X-Y pixel position where a character shown.
        //
        this.idxloc = (function(idxloc, cols, rows) {
            for(var y = 0; y < rows; y++) {
                for(var x = 0; x < cols; x++) {
                    idxloc.push({
                        x: mz700scrn.charSize.dotWidth * x,
                        y: mz700scrn.charSize.dotHeight * y
                    });
                }
            }
            return idxloc;
        }([], this.opt.cols, this.opt.rows));

        createFontTable(this);
    };

    // Create the font table
    function createFontTable(scrn) {
        scrn.fonts = {};
        for(var atb = 0; atb < 2; atb++) {
            for(var dispCode = 0; dispCode < 256; dispCode++) {
                createFont(scrn, atb, dispCode);
            }
        }
    }

    // Create a font of all color combinations
    //
    // atb      : Attribute Bit     0 or 1
    // dispCode : Display Code      0x00 to 0xff
    //
    function createFont(scrn, atb, dispCode) {
        //Loop for background-color
        for(var bg = 0; bg < 8; bg++) {
            //Loop for fore-ground-color
            for(var fg = 0; fg < 8; fg++) {
                //the value of ATTRIBUTE VRAM
                var attr = (atb << 7)|(fg << 4) | bg;
                //Font table's key
                var code = attr << 8 | dispCode;
                //Drawing (initially creating) routine
                scrn.fonts[code] = getInitDrawFunction(
                            scrn, atb, fg, bg, attr, dispCode, code);
            }
        }
    }

    /**
     * Redraw specified characters on the screen.
     * @param {number} atb attribute bit to select CG page.
     * @param {number} dispCode The display code to redraw.
     * @returns {undefined}
     */
    mz700scrn.prototype.redrawChar = function(atb, dispCode) {
        var abit = atb << 7;
        var chars = {};
        for(var i = 0; i < this.opt.cols * this.opt.rows; i++) {
            if(this.vramText[i] == dispCode && (this.vramAttr[i] & 0x80) == abit) {
                chars[i] = { dispcode: dispCode, attr: this.vramAttr[i] };
            }
        }
        this.write(chars);
    };

    mz700scrn.prototype.write = function(relAddrToChars) {
        Object.keys(relAddrToChars).forEach(function(relAddr) {
            var charData = relAddrToChars[relAddr];
            var loc = this.idxloc[relAddr];
            var code = charData.attr << 8 | charData.dispcode;
            this.fonts[code](this._ctx, loc.x, loc.y);
            this.vramText[relAddr] = charData.dispcode;
            this.vramAttr[relAddr] = charData.attr;
        }, this);
    };

    // Redraw VRAM
    mz700scrn.prototype.redraw = function() {
        var dispData = {};
        for(var i = 0; i < this.opt.cols * this.opt.rows; i++) {
            dispData[i] = {
                dispcode: this.vramText[i],
                attr: this.vramAttr[i],
            };
        }
        this.write(dispData);
    };

    // Change CG to default CGROM
    mz700scrn.prototype.useCGROM = function() {
        this.useCG(mz700scrn.CGROMDATA);
    };

    // Change Character Generator
    mz700scrn.prototype.useCG = function(cgData) {
        this.opt.CG = cgData;
        createFontTable(this);
        this.redraw();
    };

    /**
     * Clear the screen
     * @returns {undefined}
     */
    mz700scrn.prototype.clear = function () {
        var limit = this.opt.rows * this.opt.cols;
        var chars = str2chars(' ');
        for(var relAddr = 0; relAddr < limit; relAddr++) {
            this.putChars(chars, relAddr, 0);
        }
    };

    /**
     * Put string
     * @param {string} s strings to put
     * @param {number} x horizontal starting position
     * @param {number} y vertical starting position
     * @returns {undefined}
     */
    mz700scrn.prototype.puts = function (s, x, y) {
        var chars = str2chars(s);
        return this.putChars(chars, x, y);
    };

    /**
     * Convert the inner text of the HTML element to MZ-700 VRAM
     * @param {HTMLElement} element the element to convert
     * @return {undefined}
     */
    mz700scrn.convert = function(element) {
        var charSize = parseInt($(element).attr("charSize")) || 8;
        var padding = parseInt($(element).attr("padding")) || 0;
        var fg = (7 & parseInt($(element).attr("color") || "7"));
        var bg = (7 & parseInt($(element).attr("bgColor") || "1"));
        var text = element.innerText;
        var chars = str2chars(text);
        $(element).empty().mz700scrn("create", {
            cols: chars.length + padding * 2,
            rows: 1 + padding * 2,
            width: charSize * (chars.length + padding * 2) + "px",
            color: fg, backgroundColor: bg,
            alt: text, title: text
        }).mz700scrn("clear").mz700scrn("putChars", chars, padding, padding);
        $(element).find("canvas").css("display", "inherit");
    };

    /*
     * Convert the innerText of all the elements "span.mz700scrn"
     */
    $(function() {
        $("span.mz700scrn").each(function() {
            $(this).hide();
        });
        setTimeout(function() {
            $("span.mz700scrn").each(function() {
                mz700scrn.convert(this);
                $(this).show();
            });
        }, 1);
    });

    //
    // Color table
    // [Black, Blue, Red, Magenta, Green, Cyan, Yellow, White]
    //
    mz700scrn.Colors = [
        "rgb(0,0,0)",
        "rgb(0,0,255)",
        "rgb(255,0,0)",
        "rgb(255,0,255)",
        "rgb(0,255,0)",
        "rgb(0,255,255)",
        "rgb(255,255,0)",
        "rgb(255,255,255)",
    ];

    //
    // Initial character creation and drawing routine.
    //
    function getInitDrawFunction(scrn, atb, fg, bg, attr, dispCode, code) {
        return function(ctxScrn, x, y) {

            //Create canvas object for the font
            var cvs = document.createElement("CANVAS");
            cvs.setAttribute("width", mz700scrn.charSize.dotWidth + "px");
            cvs.setAttribute("height",mz700scrn.charSize.dotHeight + "px");

            //Save its context
            var ctxFont = cvs.getContext("2d");

            //Draw the bit patterns
            var rowData = scrn.opt.CG[atb * 256 + dispCode];
            for(var row = 0; row < 8; row++) {
                var rowBits = rowData[row];
                for(var col = 0; col < 8; col++) {
                    if((rowBits & (0x80 >> col)) != 0) {
                        ctxFont.fillStyle = mz700scrn.Colors[fg];
                    } else {
                        ctxFont.fillStyle = mz700scrn.Colors[bg];
                    }
                    ctxFont.fillRect(col, row, 1, 1);
                }
            }

            //Replace this function to drawing only one in the font table.
            scrn.fonts[code] = (function(ctxFont) {
                return function(ctxScrn, x,y) {
                    ctxScrn.putImageData(
                            ctxFont.getImageData(0, 0,
                                mz700scrn.charSize.dotWidth,
                                mz700scrn.charSize.dotHeight), x, y);
                };
            }(ctxFont));

            //Draw this character
            scrn.fonts[code](ctxScrn, x, y);

        }
    }

    var TableDispCode2Char = [
        [
            [" ","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O"],
            ["P","Q","R","S","T","U","V","W","X","Y","Z","┼","└","┘","├","┴"],
            ["0","1","2","3","4","5","6","7","8","9","-","=",";","/",".",","],
            ["","","","","","","","","","","","","","","",""],

            ["→","SPADE","","","DIA","←","CLUB","●","○","?","●反転","","","","","",":"],
            ["↑","<","[","HEART","]","@","",">","","BACKSLASH","HATCH","","","","",""],
            ["π","!", '"', "#", "$", "%", "AMP", "'", "(", ")","+","*","","","",""],
            ["","","","","","","","","","","","","","","",""],
            
            ["↓", "チ","コ","ソ","シ","イ","ハ","キ","ク","ニ","マ","ノ","リ","モ","ミ","ラ"],
            ["セ","タ","ス","ト","カ","ナ","ヒ","テ","サ","ン","ツ","ロ","ケ","「","ァ","ャ"],
            ["ワ","ヌ","フ","ア","ウ","エ","オ","ヤ","ユ","ヨ","ホ","ヘ","レ","メ","ル","ネ"],
            ["ム","」","ィ","ュ","ヲ","、","ゥ","ョ","゜","・","ェ","ッ","゛","。","ォ","ー"],
            
            ["PUSHDOWN","~DOWN","~UP","~RIGHT","~LEFT","~HOME","~CLEAR","UFO","CARRIGHT","CARUP","HUMAN","LHUMAN","RHUMAN","DHUMAN","FILLEDFACE","FACE"],
            ["日","月","火","水","木","金","土","生","年","時","分","秒","円","￥","￡","蛇"],
            [" ","","","","","","","","","","","","","","",""],
            [" ","","","","","","","","","","","","","","",""]
        ],
        [
            [" ","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o"],
            ["p","q","r","s","t","u","v","w","x","y","z","", "", "", "", "", ],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],

            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            
            ["",  "ち","こ","そ","し","い","は","き","く","に","ま","の","り","も","み","ら"],
            ["せ","た","す","と","か","な","ひ","て","さ","ん","つ","ろ","け","",  "ぁ","ゃ"],
            ["わ","ぬ","ふ","あ","う","え","お","や","ゆ","よ","ほ","へ","れ","め","る","ね"],
            ["む","",  "ぃ","ゅ","を","",  "ぅ","ょ","",  "",  "ぇ","っ","",  "",  "ぉ",""],
            
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
        ]
    ];

    /*
     * Create a dictionary to retrieve the display code of MZ-700
     * by one normal character or string of entity reference.
     */
    var MapChar2DispCode = (function(map) {
        TableDispCode2Char.forEach(function(table, attr) {
            table.forEach(function(line, upper) {
                line.forEach(function(c, lower) {
                    if(!(c in map)) {
                        map[c] = {
                            "attr": attr,
                            "dispcode" : upper << 4 | lower
                        };
                    }
                });
            });
        });
        return map;
    }({}));

    function char2dispcode(c) {
        var charData = MapChar2DispCode[c];
        if(!charData) {
            charData = {attr:0, dispcode : 0xef };
        }
        return charData;
    }

    function str2chars(s) {
        var chars = s.split('');
        var entityRef = false;
        var entities = [];
        var entity = "";
        chars.forEach(function(c) {
            if(!entityRef) {
                if(c == '&') {
                    entity = '';
                    entityRef = true;
                } else {
                    entities.push(c);
                }
            } else {
                if(c == ';') {
                    entities.push(entity.toUpperCase());
                    entityRef = false;
                    entity = '';
                } else {
                    entity += c;
                }
            }
        });
        return entities;
    }

    mz700scrn.prototype.putChars = function(chars, x, y) {
        var limit = this.opt.rows * this.opt.cols;
        var dispData = {};
        var n = 0;
        var relAddr = y * this.opt.cols + x;
        var colorSpec = this.opt.color << 4 | this.opt.backgroundColor;
        chars.forEach(function(c) {
            if(relAddr < limit) {
                var data = char2dispcode(c);
                dispData[relAddr] = {
                    attr: (data.attr << 7) | colorSpec,
                    dispcode: data.dispcode
                };
                relAddr++;
                n++;
            }
        });
        this.write(dispData);
        return n;
    };

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
    mz700scrn.CGROMDATA = [
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

}());
