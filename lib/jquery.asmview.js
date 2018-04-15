"use strict";
var $ = require("jquery");
var jquery_plugin_class = require("../lib/jquery_plugin_class");

require("./jquery.tabview.js");
require("./jquery.asmlist.js");

jquery_plugin_class("asmview");

var asmview = function(element) {
    this._root = $(element);
    this._name = "";
    this._root.tabview("create");
};

// Export
window.asmview = asmview;

asmview.prototype.create = function() { };

asmview.prototype.addTab = function(id, caption) {
    var tabPage = $("<div/>").asmlist("create");
    this._root
        .tabview("add", id, tabPage)
        .tabview("caption", id, caption);
};

asmview.prototype.setCurrentAddr = function(tabIndex, regPC) {
    this._root.tabview("page", tabIndex).asmlist("setCurrentAddr", regPC);
};

asmview.prototype.clearCurrentAddr = function(tabIndex) {
    this._root.tabview("page", tabIndex)
        .asmlist("clearCurrentAddr");
};

asmview.prototype.setSource = function(tabIndex, source) {
    this._root.tabview("page", tabIndex)
        .asmlist("text", source);
};

asmview.prototype.name = function(tabIndex, name) {
    if(name == null) {
        return this._name;
    }
    this._name = name;
    this._root.tabview("caption", tabIndex, this._name);
};

asmview.prototype.setAsmList = function(tabIndex, asm_list, breakpoints) {
    this._root.tabview("page", tabIndex)
        .asmlist("writeList", asm_list, breakpoints);
};
