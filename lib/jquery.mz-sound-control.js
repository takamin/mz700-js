"use strict";
const jquery_plugin_class = require("../lib/jquery_plugin_class");
const cookies = require("../lib/cookies");
require("../lib/jquery.soundctrl.js");

jquery_plugin_class("MZSoundControl");

function MZSoundControl(element) {
    this._element = element;
}

MZSoundControl.prototype.create = function(mzBeep) {
    let mute = false;
    if(!mzBeep.resumed()) {
        mute = true;
    } else if(cookies.hasItem("mute")) {
        mute = (cookies.getItem("mute")=="true");
    }
    let volume = 10;
    if(cookies.hasItem("volume")) {
        volume = parseInt(cookies.getItem("volume"));
    }
    const soundCtrl = $(this._element).soundctrl("create", {
        "sound": mzBeep,
        "maxVolume": 10,
        "initialVolume": volume,
        "initialMute": mute,
        "onChangeVolume": volume => {
            if(!soundCtrl.mute) {
                cookies.setItem("volume", volume, Infinity);
            }
        },
        "onChangeMute": mute => {
            cookies.setItem("mute", mute, Infinity);
        },
        "urlIconOn": "./image/icon-sound-on.svg",
        "urlIconOff": "./image/icon-sound-off.svg",
        "colOn": 'blue', "colOff":"silver"
    });
    return soundCtrl;
};

window.MZSoundControl = MZSoundControl;
module.exports = MZSoundControl;
