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
    asmview.prototype.setCurrentAddr = function(regPC) {
        this._root.tabview("currentPage")
            .asmlist("setCurrentAddr", regPC);
    };
    asmview.prototype.clearCurrentAddr = function() {
        this._root.tabview("currentPage")
            .asmlist("clearCurrentAddr");
    };
    asmview.prototype.setSource = function(source, name, needToBeAssembled) {
        this._root.tabview("currentPage")
            .asmlist("text", source, needToBeAssembled);
        this._root.tabview("caption", this._root.tabview("index"), name);
    };
    asmview.prototype.setAsmList = function(asm_list, breakpoints) {
        this._root.tabview("currentPage").asmlist(
            "writeList", asm_list, breakpoints);
    };
}());
