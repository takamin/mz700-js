(function() {
    "use strict";
    var $ = require("jquery");
    require("./jquery.tabview.js");
    require("./jquery.asmlist.js");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("asmview");
    var asmview = function(element) {
        this._root = $(element);
        this._root.tabview("create");
    };
    window.asmview = asmview;
    asmview.prototype.create = function() {
    };
    asmview.prototype.addTab = function(tabName, asmsrc, opt) {
        var tabPage = $("<div/>").asmlist("create", {
            onAssemble: opt.onAssemble,
            onSetBreakPoint: opt.onSetBreakPoint,
        });
        this._root.tabview("add", tabName, tabPage);
        tabPage.asmlist("text", asmsrc);
    };
    asmview.prototype.setCurrentAddr = function(tabIndex, regPC) {
        this._root.tabview("page", tabIndex)
            .asmlist("setCurrentAddr", regPC);
    };
    asmview.prototype.clearCurrentAddr = function(tabIndex) {
        this._root.tabview("page", tabIndex)
            .asmlist("clearCurrentAddr");
    };
    asmview.prototype.setSource = function(tabIndex, source, name, needToBeAssembled) {
        this._root.tabview("page", tabIndex)
            .asmlist("text", source, needToBeAssembled);
        this._root.tabview("caption", tabIndex, name);
    };
    asmview.prototype.setAsmList = function(tabIndex, asm_list, breakpoints) {
        this._root.tabview("page", tabIndex).asmlist(
            "writeList", asm_list, breakpoints);
    };
}());
