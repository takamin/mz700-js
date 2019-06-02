"use strict";
const jquery_plugin_class = require("../lib/jquery_plugin_class");
jquery_plugin_class("EmuSpeedControl");

function EmuSpeedControl(element) {
    this._element = element;
}

EmuSpeedControl.prototype.create = function(
    mz700DefaultTimerInterval)
{
    this._element.DEFAULT_TIMER_INTERVAL = mz700DefaultTimerInterval; 
    let slider = $("<input/>").attr("type", "range")
        .attr("min", 0).attr("max", 1.0).attr("step", 0.01)
        .val(0).bind("change", () => {
            const sliderValue = slider.val();
            const timerInterval = this._element.DEFAULT_TIMER_INTERVAL / Math.pow(10, sliderValue);
            const event = new Event("timerIntervalChange");
            event.timerInterval = timerInterval;
            this._element.dispatchEvent(event);
        });
    return $(this._element).addClass("speed-control-slider")
        .html("Speed:").append(slider);
};

EmuSpeedControl.prototype.timerInterval = function(timerInterval) {
    const sliderValue = Math.log10(this._element.DEFAULT_TIMER_INTERVAL / timerInterval);
    $(this._element).find("input[type='range']").val(sliderValue);
};
window.EmuSpeedControl = EmuSpeedControl;
module.exports = EmuSpeedControl;
