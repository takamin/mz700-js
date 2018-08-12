"use strict";
const $ = require("jquery");
const jquery_plugin_class = require("../lib/jquery_plugin_class");
jquery_plugin_class("ToggleButton");

/**
 * Toggle button widget.
 * @constructor
 * @param {HTMLButtonElement} button A button element for the widget
 */
function ToggleButton(button) {
    this._button = $(button);
    this._opt = {
        on: (/*button*/)=>{},
        off: (/*button*/)=>{},
        autoState: true,
    }
}
// Export to window
window.ToggleButton = ToggleButton;

/**
 * Create A ToggleButton.
 * @param {object} opt options
 * @returns {undefined}
 */
ToggleButton.prototype.create = function(opt) {

    opt = opt || {};
    Object.keys(this._opt).forEach( key => {
        if(key in opt) {
            this._opt[key] = opt[key];
        }
    });

    this._button.attr("type", "button").addClass("toggle")
        .click(event => {
            event.stopPropagation();
            if(this._button.hasClass("on")) {
                this.off();
            } else {
                this.on();
            }
        });
};

/**
 * Set this widget style to 'on'.
 * @returns {undefined}
 */
ToggleButton.prototype.setOn = function() {
    this._button.addClass("on");
    this._button.removeClass("off");
};

/**
 * Push this button and perform its action.
 * @returns {undefined}
 */
ToggleButton.prototype.on = function() {
    if(this._opt.autoState) {
        this.setOn();
    }
    this._opt.on(this._button);
};

/**
 * Set this widget style to 'off'.
 * @returns {undefined}
 */
ToggleButton.prototype.setOff = function() {
    this._button.removeClass("on");
    this._button.addClass("off");
};

/**
 * Release this button and perform its action.
 * @returns {undefined}
 */
ToggleButton.prototype.off = function() {
    if(this._opt.autoState) {
        this.setOff();
    }
    this._opt.off(this._button);
};
