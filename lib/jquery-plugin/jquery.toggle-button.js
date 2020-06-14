"use strict";
const jquery_plugin_class = require("./jquery_plugin_class");
jquery_plugin_class("ToggleButton");

const MZ700ImgButton = require("./jquery.mz700-img-button.js");

/**
 * Toggle button widget.
 * @constructor
 * @param {HTMLButtonElement} button A button element for the widget
 */
function ToggleButton(button) {
    MZ700ImgButton.call(this, button);
}
ToggleButton.prototype = new MZ700ImgButton();

// Export to window
window.ToggleButton = ToggleButton;

/**
 * Create A ToggleButton.
 * @param {object} opt options
 * @returns {undefined}
 */
ToggleButton.prototype.create = function(opt) {
    MZ700ImgButton.prototype.create.call(this, opt);

    const thisOpts = {
        on: (/*button*/)=>{},
        off: (/*button*/)=>{},
        autoState: true,
        imgOff: null,
        imgOn: null,
    };
    opt = opt || {};
    Object.keys(thisOpts).forEach(key => {
        if(key in opt) {
            thisOpts[key] = opt[key];
        }
        this._opt[key] = thisOpts[key];
    });

    this._button.addClass("toggle").click(event => {
        event.stopPropagation();
        if(this._button.hasClass("on")) {
            this.off();
        } else {
            this.on();
        }
    });
    if(this._opt.autoState) {
        if(this._button.hasClass("on")) {
            this.setOn();
        } else {
            this.setOff();
        }
    }
};

/**
 * Set this widget style to 'on'.
 * @returns {undefined}
 */
ToggleButton.prototype.setOn = function() {
    this._button.addClass("on");
    this._button.removeClass("off");
    this.setImg(this._opt.imgOn);
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
    this.setImg(this._opt.imgOff);
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

/**
 * Current button state.
 * @returns {boolean} true when the state is 'on', otherwise false.
 */
ToggleButton.prototype.state = function() {
    return this._button.hasClass("on");
};

/**
 * Toggle the button state.
 * @returns {undefined}
 */
ToggleButton.prototype.toggle = function() {
    if(this.state()) {
        this.off();
    } else {
        this.on();
    }
};