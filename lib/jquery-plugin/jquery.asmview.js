"use strict";
var jquery_plugin_class = require("./jquery_plugin_class");

require("./jquery.tabview.js");
require("./jquery.asmlist.js");

jquery_plugin_class("asmview");

var asmview = function(element) {
    this._root = $(element);
    this._root.tabview("create");
    this._opts = {
        onSetBreak: ()=>{},
    };
};

// Export
window.asmview = asmview;

asmview.prototype.create = function(opts) {
    opts = opts || {};
    Object.keys(this._opts).filter(k=>(k in opts))
        .forEach(k=>(this._opts[k] = opts[k]));
};

asmview.prototype.newAsmList = function(pageId, name) {
    const onSetBreak = this._opts.onSetBreak;
    const asmlist = $("<div/>").asmlist("create", { onSetBreak });
    this._root.asmview("addAsmList",
        pageId, name, asmlist);
    return asmlist;
};

asmview.prototype.addAsmList = function(pageId, name, asmList) {
    this._root.tabview("add", pageId, asmList);
    this._root.tabview("caption", pageId, name);
};

asmview.prototype.activate = function(pageId) {
    this._root.tabview("show", pageId);
};

asmview.prototype.name = function(pageId, name) {
    this._root.tabview("caption", pageId, name);
};

asmview.prototype.pages = function() {
    return this._root.tabview("pages");
};

asmview.prototype.currentLine = function(address) {
    for(const asmview of this.pages()) {
        const loadAddr = asmview.page.asmlist("loadAddr");
        const lastAddr = asmview.page.asmlist("lastAddr");
        if(loadAddr <= address && address <= lastAddr) {
            this.activate(asmview.id);
            asmview.page.asmlist("setCurrentAddr", address);
            return;
        }
    }
};

asmview.prototype.clearCurrentLine = function() {
    for(const asmview of this.pages()) {
        asmview.page.asmlist("clearCurrentAddr");
    }
};
