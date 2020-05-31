"use strict";
const jquery_plugin_class = require("./jquery_plugin_class");
jquery_plugin_class("MZ700ImgButton");
function MZ700ImgButton(element) {
    MZ700ImgButton.inst++;
    this._element = element;
    this._button = $(this._element).attr("type", "button").addClass("imaged");
    this._opt = {
        img: null,
    };
}
window.MZ700ImgButton = MZ700ImgButton;
module.exports = MZ700ImgButton;

MZ700ImgButton.inst = 0;

MZ700ImgButton.prototype.create = function(opt) {
    opt = opt || {};
    Object.keys(this._opt).forEach( key => {
        if(key in opt) {
            this._opt[key] = opt[key];
        }
    });
    this.setImg(this._opt.img);
};

MZ700ImgButton.prototype.setImg = function(img) {
    this._button.html($(img));
};