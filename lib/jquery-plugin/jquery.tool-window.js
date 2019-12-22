"use strict";
const jquery_plugin_class = require("./jquery_plugin_class");
jquery_plugin_class("ToolWindow");

function ToolWindow(element) {
    this._element = element;
    this.content = $(this._element);
    this.wndBase = $("<div/>").addClass("toolwnd");
}
window.ToolWindow = ToolWindow;

ToolWindow.prototype.create = function() {
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

ToolWindow.prototype.open = function() {
    if(!this.content.hasClass("open")) {
        this.content.addClass("open");
        this.wndBase.children(".content").show(100);
    }
};

ToolWindow.prototype.close = function() {
    if(this.content.hasClass("open")) {
        this.content.removeClass("open");
        this.wndBase.children(".content").hide(100);
    }
};