"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mz700_cg_1 = __importDefault(require("./mz700-cg"));
class MZ700CanvasRenderer {
    constructor() {
        this._ctx = null;
        this.opt = {
            canvas: null,
            cols: MZ700CanvasRenderer.size.cols,
            rows: MZ700CanvasRenderer.size.rows,
            CG: null,
            color: MZ700CanvasRenderer.colors.white,
            backgroundColor: MZ700CanvasRenderer.colors.blue,
        };
        this.vramText = [];
        this.vramAttr = [];
    }
    create(opt) {
        opt = opt || {};
        Object.keys(this.opt).forEach(key => {
            if (key in opt) {
                this.opt[key] = opt[key];
            }
        });
        this._canvas = this.opt.canvas;
        if (this.opt.CG == null) {
            this.opt.CG = new mz700_cg_1.default(mz700_cg_1.default.ROM, 8, 8);
        }
        this._font = this.opt.CG;
        this.vramText = [];
        this.vramAttr = [];
        for (let i = 0; i < this.opt.cols * this.opt.rows; i++) {
            this.vramText.push(0x00);
            this.vramAttr.push(0x71);
        }
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
    setupRendering() {
        this._ctx = this._canvas.getContext('2d');
        this._ctx.mozImageSmoothingEnabled = false;
        this._ctx.webkitImageSmoothingEnabled = false;
        this._ctx.msImageSmoothingEnabled = false;
        this._ctx.imageSmoothingEnabled = false;
    }
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
    writeVram(addr, attr, dispcode) {
        this._writeVram(addr, attr, dispcode);
        this.vramText[addr] = dispcode;
        this.vramAttr[addr] = attr;
    }
    _writeVram(addr, attr, dispcode) {
        const loc = this.idxloc[addr];
        if (!this._ctx) {
            return;
        }
        this._ctx.putImageData(this._font.get(attr, dispcode).getImageData(), loc.x, loc.y);
    }
    redraw() {
        const n = this.opt.cols * this.opt.rows;
        for (let i = 0; i < n; i++) {
            this._writeVram(i, this.vramAttr[i], this.vramText[i]);
        }
    }
    changeCG(cgData) {
        this._font = cgData;
    }
    restoreCG() {
        this._font = this.opt.CG;
    }
    clear() {
        const limit = this.opt.rows * this.opt.cols;
        const chars = MZ700CanvasRenderer.str2chars(' ');
        for (let relAddr = 0; relAddr < limit; relAddr++) {
            this.putChars(chars, relAddr, 0);
        }
    }
    puts(s, x, y) {
        const chars = MZ700CanvasRenderer.str2chars(s);
        return this.putChars(chars, x, y);
    }
    putChars(chars, x, y) {
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
    static char2dispcode(c) {
        const charData = MZ700CanvasRenderer.MapChar2DispCode[c];
        if (!charData) {
            return { attr: 0, dispcode: 0xef };
        }
        return charData;
    }
    static str2chars(s) {
        const chars = s.split('');
        const entities = [];
        let entityRef = false;
        let entity = "";
        chars.forEach((c) => {
            if (!entityRef) {
                if (c === '&') {
                    entityRef = true;
                    entity = '';
                }
                else {
                    entities.push(c);
                }
            }
            else {
                if (c === ';') {
                    entities.push(entity.toUpperCase());
                    entityRef = false;
                    entity = '';
                }
                else {
                    entity += c;
                }
            }
        });
        return entities;
    }
}
exports.default = MZ700CanvasRenderer;
MZ700CanvasRenderer.colors = {
    "black": 0,
    "blue": 1,
    "red": 2,
    "magenta": 3,
    "green": 4,
    "cyan": 5,
    "yellow": 6,
    "white": 7,
};
MZ700CanvasRenderer.size = { "cols": 40, "rows": 25 };
MZ700CanvasRenderer.charSize = { "dotWidth": 8, "dotHeight": 8 };
MZ700CanvasRenderer.TableDispCode2Char = [
    [
        [" ", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"],
        ["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "┼", "└", "┘", "├", "┴"],
        ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "=", ";", "/", ".", ","],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["→", "SPADE", "", "", "DIA", "←", "CLUB", "●", "○", "?", "●反転", "", "", "", "", "", ":"],
        ["↑", "<", "[", "HEART", "]", "@", "", ">", "", "BACKSLASH", "HATCH", "", "", "", "", ""],
        ["π", "!", '"', "#", "$", "%", "AMP", "'", "(", ")", "+", "*", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["↓", "チ", "コ", "ソ", "シ", "イ", "ハ", "キ", "ク", "ニ", "マ", "ノ", "リ", "モ", "ミ", "ラ"],
        ["セ", "タ", "ス", "ト", "カ", "ナ", "ヒ", "テ", "サ", "ン", "ツ", "ロ", "ケ", "「", "ァ", "ャ"],
        ["ワ", "ヌ", "フ", "ア", "ウ", "エ", "オ", "ヤ", "ユ", "ヨ", "ホ", "ヘ", "レ", "メ", "ル", "ネ"],
        ["ム", "」", "ィ", "ュ", "ヲ", "、", "ゥ", "ョ", "゜", "・", "ェ", "ッ", "゛", "。", "ォ", "ー"],
        ["PUSHDOWN", "~DOWN", "~UP", "~RIGHT", "~LEFT", "~HOME", "~CLEAR", "UFO", "CARRIGHT", "CARUP", "HUMAN", "LHUMAN", "RHUMAN", "DHUMAN", "FILLEDFACE", "FACE"],
        ["日", "月", "火", "水", "木", "金", "土", "生", "年", "時", "分", "秒", "円", "￥", "￡", "蛇"],
        [" ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        [" ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
    ],
    [
        [" ", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o"],
        ["p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "", "", "", "", "",],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "ち", "こ", "そ", "し", "い", "は", "き", "く", "に", "ま", "の", "り", "も", "み", "ら"],
        ["せ", "た", "す", "と", "か", "な", "ひ", "て", "さ", "ん", "つ", "ろ", "け", "", "ぁ", "ゃ"],
        ["わ", "ぬ", "ふ", "あ", "う", "え", "お", "や", "ゆ", "よ", "ほ", "へ", "れ", "め", "る", "ね"],
        ["む", "", "ぃ", "ゅ", "を", "", "ぅ", "ょ", "", "", "ぇ", "っ", "", "", "ぉ", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ]
];
MZ700CanvasRenderer.MapChar2DispCode = {};
MZ700CanvasRenderer.initializer = (() => {
    MZ700CanvasRenderer.TableDispCode2Char.forEach((table, attr) => {
        table.forEach((line, upper) => {
            line.forEach((c, lower) => {
                if (!(c in MZ700CanvasRenderer.MapChar2DispCode)) {
                    MZ700CanvasRenderer.MapChar2DispCode[c] = {
                        "attr": attr,
                        "dispcode": upper << 4 | lower,
                    };
                }
            });
        });
    });
})();
module.exports = MZ700CanvasRenderer;
//# sourceMappingURL=mz700-canvas-renderer.js.map