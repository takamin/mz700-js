"use strict";
import { CanvasRenderingContext2D } from "canvas";
import mz700cg from "./mz700-cg";

/* tslint:disable: no-bitwise */

export default class MZ700CanvasRenderer {

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
    // A canvas element
    _canvas:HTMLCanvasElement;
    // A canvas context to draw
    _ctx:CanvasRenderingContext2D = null;

    opt:{
        canvas?:HTMLCanvasElement,
        cols?:number,
        rows?:number,
        CG?:mz700cg,
        color?:number,
        backgroundColor?:number,
        width?:string,
        alt?:string,
        title?:string,
    } = {
        canvas: null,
        cols: MZ700CanvasRenderer.size.cols,
        rows: MZ700CanvasRenderer.size.rows,
        CG: null,
        color: MZ700CanvasRenderer.colors.white,
        backgroundColor: MZ700CanvasRenderer.colors.blue,
    };
    vramText:number[] = [];
    vramAttr:number[] = [];
    _font;
    idxloc:{x:number, y:number}[];

    constructor() { /* empty */ }

    //
    // Create screen
    //
    create(opt:{
        canvas?:HTMLCanvasElement,
        CG?:mz700cg,
        cols?:number,
        rows?:number,
        color?:number,
        backgroundColor?:number,
    }):void {
        opt = opt || {};
        Object.keys(this.opt).forEach(key => {
            if (key in opt) {
                this.opt[key] = opt[key];
            }
        });

        this._canvas = this.opt.canvas;

        if (this.opt.CG == null) {
            this.opt.CG = new mz700cg(mz700cg.ROM, 8, 8);
        }
        this._font = this.opt.CG;

        // Create text/attr vram
        this.vramText = [];
        this.vramAttr = [];
        for (let i = 0; i < this.opt.cols * this.opt.rows; i++) {
            this.vramText.push(0x00);
            this.vramAttr.push(0x71);
        }

        //
        // A translation table to convert an address index on the VRAM
        // to the X-Y pixel position where a character shown.
        //
        this.idxloc = ((idxloc, cols, rows) => {
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    idxloc.push({
                        x: MZ700CanvasRenderer.charSize.dotWidth * x,
                        y: MZ700CanvasRenderer.charSize.dotHeight * y
                    });
                }
            }
            return idxloc;
        })([], this.opt.cols, this.opt.rows);
    }
    setupRendering():void {
        // Save canvas context
        this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D;
        (this._ctx as any).mozImageSmoothingEnabled = true;
        (this._ctx as any).webkitImageSmoothingEnabled = true;
        (this._ctx as any).msImageSmoothingEnabled = true;
        this._ctx.imageSmoothingEnabled = true;
    }
    /**
     * Redraw specified characters on the screen.
     * @param {number} atb attribute bit to select CG page.
     * @param {number} dispCode The display code to redraw.
     * @returns {undefined}
     */
    redrawChar(atb, dispCode) {
        const abit = atb << 7;
        const n = this.opt.cols * this.opt.rows;
        for (let i = 0; i < n; i++) {
            const attr = this.vramAttr[i];
            if (this.vramText[i] === dispCode && (attr & 0x80) === abit) {
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
    writeVram(addr:number, attr:number, dispcode:number):void {
        this._writeVram(addr, attr, dispcode);
        this.vramText[addr] = dispcode;
        this.vramAttr[addr] = attr;
    }
    private _writeVram(addr:number, attr:number, dispcode:number):void {
        const loc:{x:number, y:number} = this.idxloc[addr];
        if(!this._ctx) {
            return;
        }
        this._ctx.putImageData(
            this._font.get(attr, dispcode).getImageData(),
            loc.x, loc.y);
    }
    // Redraw VRAM
    redraw():void {
        const n:number = this.opt.cols * this.opt.rows;
        for (let i = 0; i < n; i++) {
            this._writeVram(i, this.vramAttr[i], this.vramText[i]);
        }
    }
    /**
     * @returns canvas image data of screen.
     */
    getImageData():ImageData {
        return this._ctx.getImageData(0, 0, 320, 200);
    }

    // Change Character Generator
    changeCG(cgData):void {
        this._font = cgData;
    }
    // Restore Character Generator
    restoreCG():void {
        this._font = this.opt.CG;
    }
    /**
     * Clear the screen
     * @returns {undefined}
     */
    clear():void {
        const limit:number = this.opt.rows * this.opt.cols;
        const chars:string[] = MZ700CanvasRenderer.str2chars(' ');
        for (let relAddr = 0; relAddr < limit; relAddr++) {
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
        const chars = MZ700CanvasRenderer.str2chars(s);
        return this.putChars(chars, x, y);
    }
    putChars(chars:string[], x:number, y:number):number {
        const limit = this.opt.rows * this.opt.cols;
        const colorSpec = this.opt.color << 4 | this.opt.backgroundColor;
        let n = 0;
        let relAddr = y * this.opt.cols + x;
        chars.forEach(function (c) {
            if (relAddr < limit) {
                const data = MZ700CanvasRenderer.char2dispcode(c);
                this.writeVram(relAddr, (data.attr << 7) | colorSpec, data.dispcode);
                relAddr++;
                n++;
            }
        }, this);
        return n;
    }

    private static TableDispCode2Char:string[][][] = [
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
    static MapChar2DispCode:object = {};

    /**
     * A dummy field like a static constructor
     */
    static initializer = (() => {
        MZ700CanvasRenderer.TableDispCode2Char.forEach((table, attr) => {
            table.forEach((line, upper) => {
                line.forEach((c, lower) => {
                    if(!(c in MZ700CanvasRenderer.MapChar2DispCode)) {
                        MZ700CanvasRenderer.MapChar2DispCode[c] = {
                            "attr": attr,
                            "dispcode" : upper << 4 | lower,
                        };
                    }
                });
            });
        });
    })();

    static char2dispcode(c:string):{attr:number, dispcode:number} {
        const charData = MZ700CanvasRenderer.MapChar2DispCode[c];
        if(!charData) {
            return { attr:0, dispcode : 0xef };
        }
        return charData;
    }

    static str2chars(s:string):string[] {
        const chars = s.split('');
        const entities = [];
        let entityRef = false;
        let entity = "";
        chars.forEach((c) => {
            if(!entityRef) {
                if(c === '&') {
                    entityRef = true;
                    entity = '';
                } else {
                    entities.push(c);
                }
            } else {
                if(c === ';') {
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

module.exports = MZ700CanvasRenderer;
