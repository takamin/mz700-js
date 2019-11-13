"use strict";
import MZMMIO from "./mz-mmio";
import PCG700 from "./PCG-700";
import mz700cg from "./mz700-cg";

export default class mz700scrn {

    static colors = {
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
    static size = {"cols":40, "rows":25};

    //
    // Dot size of a character
    //
    static charSize = {"dotWidth":8, "dotHeight":8};
    //A Container container
    _container:HTMLElement = null;
    //A canvas context to draw
    _ctx = null;

    opt:{
        cols:number,
        rows:number,
        CG:mz700cg,
        color:number,
        backgroundColor:number,
        width:string,
        alt:string,
        title:string,
    };
    vramText:Array<number> = [];
    vramAttr:Array<number> = [];
    _font;
    idxloc:Array<{x:number, y:number}>;

    constructor(container) {
        this._container = container;
    }

    //
    // Create screen
    //
    create(opt:object) {
        this.opt = {
            cols: mz700scrn.size.cols,
            rows: mz700scrn.size.rows,
            CG: null,
            color: mz700scrn.colors.white,
            backgroundColor: mz700scrn.colors.blue,
            width: '100%',
            alt: "", title: "",
        };
        opt = opt || {};
        Object.keys(this.opt).forEach(function (key) {
            if (key in opt) {
                this.opt[key] = opt[key];
            }
        }, this);
        if (this.opt.CG == null) {
            this.opt.CG = new mz700cg(mz700cg.ROM, 8, 8);
        }
        this._font = this.opt.CG;
        // Create text/attr vram
        this.vramText = [];
        this.vramAttr = [];
        for (var i = 0; i < this.opt.cols * this.opt.rows; i++) {
            this.vramText.push(0x00);
            this.vramAttr.push(0x71);
        }
        //Create canvas object
        const canvas = document.createElement("CANVAS") as HTMLCanvasElement;
        canvas.setAttribute("width", mz700scrn.charSize.dotWidth * this.opt.cols + "px");
        canvas.setAttribute("height", mz700scrn.charSize.dotHeight * this.opt.rows + "px");
        canvas.setAttribute("style", `width:${this.opt.width};height:auto`);
        if (this.opt.alt != null) {
            canvas.setAttribute("alt", this.opt.alt);
        }
        if (this.opt.title != null) {
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
        this.idxloc = (function (idxloc, cols, rows) {
            for (var y = 0; y < rows; y++) {
                for (var x = 0; x < cols; x++) {
                    idxloc.push({
                        x: mz700scrn.charSize.dotWidth * x,
                        y: mz700scrn.charSize.dotHeight * y
                    });
                }
            }
            return idxloc;
        } ([], this.opt.cols, this.opt.rows));
    }
    mz700js(mz700js) {
        mz700js.subscribe('onUpdateScreen', updateData => {
            for (const addr of Object.keys(updateData)) {
                const chr = updateData[addr];
                this.writeVram(parseInt(addr), chr.attr, chr.dispcode);
            }
        });
        // Setup PCG-700
        const mzMMIO = new MZMMIO();
        const pcg700 = new PCG700(this);
        mz700js.subscribe("onMmioRead", (param) => {
            const { address, value } = param;
            mzMMIO.read(address, value);
        });
        mz700js.subscribe("onMmioWrite", (param) => {
            const { address, value } = param;
            mzMMIO.write(address, value);
        });
        pcg700.setupMMIO(mzMMIO);
    }
    /**
     * Redraw specified characters on the screen.
     * @param {number} atb attribute bit to select CG page.
     * @param {number} dispCode The display code to redraw.
     * @returns {undefined}
     */
    redrawChar(atb, dispCode) {
        var abit = atb << 7;
        var n = this.opt.cols * this.opt.rows;
        for (var i = 0; i < n; i++) {
            var attr = this.vramAttr[i];
            if (this.vramText[i] == dispCode && (attr & 0x80) == abit) {
                this.writeVram(i, attr, dispCode);
            }
        }
    }
    /**
     * Write a character to relative address with attribute.
     * @param {number} addr     A relative address index from the top left of screen to put.
     * @param {number} attr     An attribute value for MZ-700.
     * @param {number} dispcode A display code of character to put.
     * @returns {undefined}
     */
    writeVram(addr, attr, dispcode) {
        this._writeVram(addr, attr, dispcode);
        this.vramText[addr] = dispcode;
        this.vramAttr[addr] = attr;
    }
    _writeVram(addr, attr, dispcode) {
        var loc = this.idxloc[addr];
        this._ctx.putImageData(this._font.get(attr, dispcode).getImageData(), loc.x, loc.y);
    }
    // Redraw VRAM
    redraw() {
        var n = this.opt.cols * this.opt.rows;
        for (var i = 0; i < n; i++) {
            this._writeVram(i, this.vramAttr[i], this.vramText[i]);
        }
    }
    // Change Character Generator
    changeCG(cgData) {
        this._font = cgData;
    }
    // Restore Character Generator
    restoreCG() {
        this._font = this.opt.CG;
    }
    /**
     * Clear the screen
     * @returns {undefined}
     */
    clear() {
        var limit = this.opt.rows * this.opt.cols;
        var chars = mz700scrn.str2chars(' ');
        for (var relAddr = 0; relAddr < limit; relAddr++) {
            this.putChars(chars, relAddr, 0);
        }
    }
    /**
     * Put string
     * @param {string} s strings to put
     * @param {number} x horizontal starting position
     * @param {number} y vertical starting position
     * @returns {number} The length of the letters that outputed
     */
    puts(s:string, x:number, y:number):number {
        const chars = mz700scrn.str2chars(s);
        return this.putChars(chars, x, y);
    }
    putChars(chars:Array<string>, x:number, y:number):number {
        const limit = this.opt.rows * this.opt.cols;
        const colorSpec = this.opt.color << 4 | this.opt.backgroundColor;
        let n = 0;
        let relAddr = y * this.opt.cols + x;
        chars.forEach(function (c) {
            if (relAddr < limit) {
                const data = mz700scrn.char2dispcode(c);
                this.writeVram(relAddr, (data.attr << 7) | colorSpec, data.dispcode);
                relAddr++;
                n++;
            }
        }, this);
        return n;
    }

    static TableDispCode2Char = [
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
    static MapChar2DispCode = {};

    /**
     * A dummy field like a static constructor
     */
    static initializer = (() => {
        mz700scrn.TableDispCode2Char.forEach(function(table, attr) {
            table.forEach(function(line, upper) {
                line.forEach(function(c, lower) {
                    if(!(c in mz700scrn.MapChar2DispCode)) {
                        mz700scrn.MapChar2DispCode[c] = {
                            "attr": attr,
                            "dispcode" : upper << 4 | lower
                        };
                    }
                });
            });
        });
    })();

    static char2dispcode(c) {
        var charData = mz700scrn.MapChar2DispCode[c];
        if(!charData) {
            charData = {attr:0, dispcode : 0xef };
        }
        return charData;
    }

    static str2chars(s) {
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
}


module.exports = mz700scrn;
