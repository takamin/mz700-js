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
}

module.exports = mz700scrn;
