"use strict";

var $ = require("jquery");
var jquery_plugin_class = require("../lib/jquery_plugin_class");
var CodeMirror = require("codemirror");

require("../node_modules/codemirror/mode/z80/z80");

jquery_plugin_class("asmeditor");

/**
 * A Z80 Assembler editor using CodeMirror.
 *
 * @constructor
 *
 * @param {HTMLElement} element
 * A root element for jquery plug-in.
 *
 * @see [CodeMirror: User Manual](http://codemirror.net/doc/manual.html)
 */
function asmeditor(element) {
    this._root = $(element);
    this._editor = null;    // editor object of codemirror
}

// Exports
window.asmeditor = asmeditor;
module.exports = asmeditor;

/**
 * Create editor.
 *
 * @param {object} eventMap
 * An object which has event names as key and its handler as value.
 *
 * @returns {undefined}
 */
asmeditor.prototype.create = function(eventMap) {
    var $textarea = $("<textarea type='text'/>");
    this._root.append($textarea);
    this._editor = CodeMirror.fromTextArea(
            $textarea.get(0), { mode: "z80" });
    Object.keys(eventMap).forEach(e => {
        this._editor.on(e, eventMap[e]);
    });
};

/**
 * Refresh the editor view.
 * @returns {undefined}
 */
asmeditor.prototype.refresh = function() {
    this._editor.refresh();
    this._editor.focus();
};

/**
 * Set or get source as text.
 *
 * @param {string|undefined} text
 * source file to be set.
 *
 * @returns {undefined|string}
 * returns source text, if text parameter was not provided.
 */
asmeditor.prototype.text = function(text) {
    if(text == null) {
        return this._editor.getValue();
    } else {
        this._editor.setValue(text);
        this._editor.markClean();
    }
};
