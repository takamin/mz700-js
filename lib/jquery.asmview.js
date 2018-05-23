"use strict";
var $ = require("jquery");
var jquery_plugin_class = require("../lib/jquery_plugin_class");

require("./jquery.tabview.js");
require("./jquery.asmlist.js");

jquery_plugin_class("asmview");

var asmview = function(element) {
    this._root = $(element);
    this._root.tabview("create");
};

// Export
window.asmview = asmview;

asmview.prototype.create = function() { };

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
