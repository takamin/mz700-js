"use strict";
const jquery_plugin_class = require("../lib/jquery_plugin_class");
const cookies = require("../lib/cookies");
jquery_plugin_class("EmuSpeedControl");

function EmuSpeedControl(element) {
    this._element = element;
}

EmuSpeedControl.prototype.create = function(
    mz700js, mz700DefaultTimerInterval, setEmuTimerInterval)
{
    let slider = $(this._element).attr("type", "range")
        .attr("min", 0).attr("max", 1.0).attr("step", 0.01)
        .val(7).bind("change", () => {
            const sliderValue = slider.val();
            const timerInterval = mz700DefaultTimerInterval / Math.pow(10, sliderValue);
            setEmuTimerInterval(timerInterval);
        });
    if(cookies.hasItem("speedSliderValue")) {
        const param = parseFloat(cookies.getItem("speedSliderValue"));
        setEmuTimerInterval(param);
    } else {
        (async ()=> {
            setEmuTimerInterval(await mz700js.getExecutionParameter());
        })();
    }
    mz700js.subscribe("onExecutionParameterUpdate", param => {
        const timerInterval = param;
        const sliderValue = Math.log10(mz700DefaultTimerInterval / timerInterval);
        slider.val(sliderValue);
        cookies.setItem("speedSliderValue", timerInterval, Infinity);
    });
    return $("<span/>")
        .addClass("speed-control-slider")
        .html("Speed:").append(slider);
};

window.EmuSpeedControl = EmuSpeedControl;
module.exports = EmuSpeedControl;
