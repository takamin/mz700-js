"use strict";
const Cookies = require("js-cookie");
const jquery_plugin_class = require("./jquery_plugin_class");
require("./jquery.soundctrl.js");

jquery_plugin_class("MZSoundControl");

function MZSoundControl(element) {
    this._element = element;
}

MZSoundControl.prototype.create = function(mzBeep) {
    let mute = false;
    if(!mzBeep.resumed()) {
        mute = true;
    } else if(Cookies.get("mute")) {
        mute = (Cookies.get("mute") == "true");
    }
    let volume = 10;
    if(Cookies.get("volume")) {
        volume = parseInt(Cookies.get("volume"));
    }

    const cookieOpt = {
        expires: 365 * 100,
        path: window.location.pathname.replace(/\/[^/]*$/, ""),
    };

    const soundCtrl = $(this._element).soundctrl("create", {
        "sound": mzBeep,
        "maxVolume": 10,
        "initialVolume": volume,
        "initialMute": mute,
        "onChangeVolume": volume => {
            if(!soundCtrl.mute) {
                Cookies.set("volume", volume, cookieOpt);
            }
        },
        "onChangeMute": mute => {
            Cookies.set("mute", mute, cookieOpt);
        },
        "urlIconOn": "./image/icon-sound-on.svg",
        "urlIconOff": "./image/icon-sound-off.svg",
        "colOn": 'blue', "colOff":"silver"
    });
    return soundCtrl;
};

window.MZSoundControl = MZSoundControl;
module.exports = MZSoundControl;
