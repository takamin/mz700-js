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

    var jquery_plugin_class = require("./jquery_plugin_class");
    const MZMMIO = require("./mz-mmio.js");
    const PCG700 = require("./PCG-700");
    var mz700cg = require("./mz700-cg.js");

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
            CG: null,
            color : mz700scrn.colors.white,
            backgroundColor : mz700scrn.colors.blue,
            width: '100%',
            alt: "", title: "",
        };
        opt = opt || {};
        Object.keys(this.opt).forEach(function(key) {
            if(key in opt) {
                this.opt[key] = opt[key];
            }
        }, this);

        if(this.opt.CG == null) {
            this.opt.CG = new mz700cg();
        }
        this._font = this.opt.CG;

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

    };

    mz700scrn.prototype.mz700js = function(mz700js) {
        mz700js.subscribe('onUpdateScreen', updateData => {
            for(const addr of Object.keys(updateData)) {
                const chr = updateData[addr];
                this.writeVram(parseInt(addr), chr.attr, chr.dispcode);
            }
        });
        // Setup PCG-700
        const mzMMIO = new MZMMIO(mz700js);
        const pcg700 = new PCG700(this);
        pcg700.setupMMIO(mzMMIO);
    };

    /**
     * Redraw specified characters on the screen.
     * @param {number} atb attribute bit to select CG page.
     * @param {number} dispCode The display code to redraw.
     * @returns {undefined}
     */
    mz700scrn.prototype.redrawChar = function(atb, dispCode) {
        var abit = atb << 7;
        var n = this.opt.cols * this.opt.rows;
        for(var i = 0; i < n; i++) {
            var attr = this.vramAttr[i];
            if(this.vramText[i] == dispCode && (attr & 0x80) == abit) {
                this.writeVram(i, attr, dispCode);
            }
        }
    };

    /**
     * Write a character to relative address with attribute.
     * @param {number} addr     A relative address index from the top left of screen to put.
     * @param {number} attr     An attribute value for MZ-700.
     * @param {number} dispcode A display code of character to put.
     * @returns {undefined}
     */
    mz700scrn.prototype.writeVram = function(addr, attr, dispcode) {
        this._writeVram(addr, attr, dispcode);
        this.vramText[addr] = dispcode;
        this.vramAttr[addr] = attr;
    };
    mz700scrn.prototype._writeVram = function(addr, attr, dispcode) {
        var loc = this.idxloc[addr];
        this._ctx.putImageData(
            this._font.get(attr, dispcode).getImageData(),
            loc.x, loc.y);
    };

    // Redraw VRAM
    mz700scrn.prototype.redraw = function() {
        var n = this.opt.cols * this.opt.rows;
        for(var i = 0; i < n; i++) {
            this._writeVram(i, this.vramAttr[i], this.vramText[i]);
        }
    };

    // Change Character Generator
    mz700scrn.prototype.changeCG = function(cgData) {
        this._font = cgData;
    };

    // Restore Character Generator
    mz700scrn.prototype.restoreCG = function() {
        this._font = this.opt.CG;
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
        var n = 0;
        var relAddr = y * this.opt.cols + x;
        var colorSpec = this.opt.color << 4 | this.opt.backgroundColor;
        chars.forEach(function(c) {
            if(relAddr < limit) {
                var data = char2dispcode(c);
                this.writeVram(
                        relAddr,
                        (data.attr << 7) | colorSpec,
                        data.dispcode);
                relAddr++;
                n++;
            }
        }, this);
        return n;
    };

}());
