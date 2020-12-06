"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mz700_canvas_renderer_1 = __importDefault(require("./mz700-canvas-renderer"));
class mz700scrn extends mz700_canvas_renderer_1.default {
    constructor(container) {
        super();
        this._container = null;
        this._container = container;
    }
    create(opt) {
        super.create(opt);
        if (!this.opt.canvas) {
            this.opt.canvas = document.createElement("CANVAS");
            this._container.appendChild(this.opt.canvas);
        }
        this._canvas = this.opt.canvas;
        this._canvas.setAttribute("width", `${mz700_canvas_renderer_1.default.charSize.dotWidth * this.opt.cols}px`);
        this._canvas.setAttribute("height", `${mz700_canvas_renderer_1.default.charSize.dotHeight * this.opt.rows}px`);
        this._canvas.setAttribute("style", `width:${this.opt.width};height:auto`);
        if (this.opt.alt != null) {
            this._canvas.setAttribute("alt", this.opt.alt);
        }
        if (this.opt.title != null) {
            this._canvas.setAttribute("title", this.opt.title);
        }
    }
    static convert(element) {
        const $e = $(element);
        const charSize = parseInt($e.attr("charSize")) || 8;
        const padding = parseInt($e.attr("padding")) || 0;
        const fg = (7 & parseInt($e.attr("color") || "7"));
        const bg = (7 & parseInt($e.attr("bgColor") || "1"));
        const text = element.innerText;
        const chars = mz700scrn.str2chars(text);
        const scrnText = new mz700scrn(element);
        scrnText.create({
            cols: chars.length + padding * 2,
            rows: 1 + padding * 2,
            width: charSize * (chars.length + padding * 2) + "px",
            color: fg, backgroundColor: bg,
            alt: text, title: text
        });
        scrnText.setupRendering();
        scrnText.clear();
        scrnText.putChars(chars, padding, padding);
        $e.find("canvas").css("display", "inherit");
    }
}
exports.default = mz700scrn;
module.exports = mz700scrn;
//# sourceMappingURL=mz700-scrn.js.map