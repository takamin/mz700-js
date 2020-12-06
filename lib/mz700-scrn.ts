"use strict";
import MZ700CanvasRenderer from "./mz700-canvas-renderer";

/* tslint:disable: class-name */

export default class mz700scrn extends MZ700CanvasRenderer {

    // A Container container
    _container:HTMLElement = null;

    constructor(container:HTMLElement) {
        super();
        this._container = container;
    }

    //
    // Create screen
    //
    create(opt:{
        canvas?:HTMLCanvasElement,
        cols?:number,
        rows?:number,
        color?:number,
        backgroundColor?:number,
        width?:string,
        alt?:string,
        title?:string,
    }):void {
        super.create(opt);

        // Create canvas object
        if(!this.opt.canvas) {
            this.opt.canvas = document.createElement("CANVAS") as HTMLCanvasElement;
            this._container.appendChild(this.opt.canvas);
        }
        this._canvas = this.opt.canvas;
        this._canvas.setAttribute("width", `${MZ700CanvasRenderer.charSize.dotWidth * this.opt.cols}px`);
        this._canvas.setAttribute("height", `${MZ700CanvasRenderer.charSize.dotHeight * this.opt.rows}px`);
        this._canvas.setAttribute("style", `width:${this.opt.width};height:auto`);
        if (this.opt.alt != null) {
            this._canvas.setAttribute("alt", this.opt.alt);
        }
        if (this.opt.title != null) {
            this._canvas.setAttribute("title", this.opt.title);
        }
    }
    /**
     * Convert the inner text of the HTML element to MZ-700 VRAM
     * @param {HTMLElement} element the element to convert
     * @return {undefined}
     */
    static convert(element:HTMLElement):void {
        const $e = $(element);
        const charSize = parseInt($e.attr("charSize")) || 8;
        const padding = parseInt($e.attr("padding")) || 0;
        const fg = (7 & parseInt($e.attr("color") || "7"));
        const bg = (7 & parseInt($e.attr("bgColor") || "1"));
        const text = element.innerText;
        const chars = mz700scrn.str2chars(text);

        $e.empty();
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

module.exports = mz700scrn;
