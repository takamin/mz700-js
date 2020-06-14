"use strict";
const jquery_plugin_class = require("./jquery_plugin_class");
jquery_plugin_class("ToolWindow");

function ToolWindow(element) {
    this._element = element;
    this._opts = {
        onOpened: ()=>{},
        onClosed: ()=>{},
    }
    this.content = $(this._element);
    this.wndBase = $("<div/>").addClass("toolwnd");
}
window.ToolWindow = ToolWindow;

ToolWindow.prototype.create = function(opts) {
    opts = opts || {};
    const unknownOpt = Object.keys(opts)
        .filter( key => !(key in this._opts) ).shift();
    if(unknownOpt) {
        throw new Error(`Unknown option ${JSON.stringify(unknownOpt)}`);
    }
    Object.keys(this._opts)
        .filter( key => (key in opts) )
        .forEach( key => (this._opts[key] = opts[key]) );

    this.wndBase.insertBefore(this.content).append(
        $("<div/>").addClass("titlebar")
            .append(
                $("<span/>").addClass("title")
                .html(this.content.attr("title")))
            .append(
                $("<span/>").addClass("buttons")
                .append(
                    $("<button/>").attr("type","button")
                    .html("■").attr("title", "Open/Close")
                    .click(()=>{
                        if(this.content.hasClass("open")) {
                            this.close();
                        } else {
                            this.open();
                        }
                    }))))
    .append($("<div/>").addClass("content").append(this.content));
    if(this.content.hasClass("open")) {
        this.wndBase.children(".content").show(100);
    } else {
        this.wndBase.children(".content").hide(100);
    }
};

ToolWindow.prototype.isOpen = function() {
    return this.content.hasClass("open");
};

ToolWindow.prototype.open = function() {
    if(!this.isOpen()) {
        this.content.addClass("open");
        this.wndBase.children(".content")
        .show(100, ()=> this._opts.onOpened());
    }
};

ToolWindow.prototype.close = function() {
    if(this.isOpen()) {
        this.content.removeClass("open");
        this.wndBase.children(".content")
            .hide(100, ()=>this._opts.onClosed());
    }
};
