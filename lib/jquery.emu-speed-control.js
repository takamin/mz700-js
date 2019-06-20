"use strict";
const jquery_plugin_class = require("../lib/jquery_plugin_class");
jquery_plugin_class("EmuSpeedControl");

function EmuSpeedControl(element) {
    this._element = element;
}

const SLIDER_MIN = -10;
const SLIDER_ZERO = 0;
const SLIDER_MAX = 10;
const VALUE_MIN = 0.005;
const VALUE_ZERO = 1;
const VALUE_MAX = 10;

EmuSpeedControl.prototype.create = function(baseClock) {
    this._baseClock = baseClock;

    this._slider = document.createElement("INPUT");
    this._slider.setAttribute("type", "range");
    this._slider.setAttribute("min", SLIDER_MIN);
    this._slider.setAttribute("max", SLIDER_MAX);
    this._slider.setAttribute("step", 0.1);
    this._slider.setAttribute("value", 0.0);

    this._factorRef = document.createElement("SPAN");
    this._factorRef.classList.add("input-value");
    this._factorRef.innerHTML = "";

    this._cpuClock = document.createElement("SPAN");
    this._cpuClock.classList.add("cpu-clock");
    this._cpuClock.innerHTML = "";

    this._clockFactor = document.createElement("SPAN");
    this._clockFactor.classList.add("clock-factor");
    this._clockFactor.innerHTML = "";

    this._slider.addEventListener("input", ()=>{
        const sliderValue = parseFloat(this._slider.value);
        const clockFactor = (sliderValue < 0) ?
            (VALUE_ZERO - VALUE_MIN) *
                (sliderValue - SLIDER_MIN) / (SLIDER_ZERO - SLIDER_MIN) +
                VALUE_MIN
            :
            (VALUE_MAX - VALUE_ZERO) *
                (sliderValue - SLIDER_ZERO) / (SLIDER_MAX - SLIDER_ZERO) +
                VALUE_ZERO;
        const event = new Event("clockFactorChange");
        event.clockFactor = clockFactor;
        this._factorRef.innerHTML = `${Math.round(clockFactor * 100)}`;
        this._element.dispatchEvent(event);
    });
    this._slider.addEventListener("keydown", event => {
        event.stopPropagation();
    });

    this._element.classList.add("speed-control-slider");
    const label = document.createElement("LABEL");
    label.innerHTML = "Speed:";
    label.appendChild(this._slider);
    label.appendChild(this._factorRef);
    label.appendChild(this._cpuClock);
    label.appendChild(this._clockFactor);
    this._element.appendChild(label);
    return $(this._element);
};

EmuSpeedControl.prototype.clockFactor = function(clockFactor) {
    this._factorRef.innerHTML = `${Math.round(clockFactor * 100)}`;
    const sliderValue = (clockFactor < VALUE_ZERO) ?
        (SLIDER_ZERO - SLIDER_MIN) *
            (clockFactor - VALUE_MIN) / (VALUE_ZERO - VALUE_MIN) +
            SLIDER_MIN
        :
        (SLIDER_MAX - SLIDER_ZERO) *
            (clockFactor - VALUE_ZERO) / (VALUE_MAX - VALUE_ZERO) +
            SLIDER_ZERO;
    $(this._element).find("input[type='range']").val(sliderValue);
};

EmuSpeedControl.prototype.actualClock = function(actualClock) {
    const m = Math.round((actualClock / this._baseClock) * 100);
    const clock = Math.round((actualClock / 1000000) * 100) / 100;
    this._cpuClock.innerHTML = `${clock}`;
    this._clockFactor.innerHTML = `${m}`;
};

window.EmuSpeedControl = EmuSpeedControl;
module.exports = EmuSpeedControl;
