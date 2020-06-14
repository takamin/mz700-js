"use strict";
const Cookies = require("js-cookie");
const jquery_plugin_class = require("./jquery_plugin_class");
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

// Handling Cookie 'clockFactor'
const COOKIE_CLOCK_FACTOR = "clockFactor";
const COOKIE_CLOCK_FACTOR_OPTS = {
    expires: 365 * 100,
    path: window.location.pathname.replace(/\/[^/]*$/, ""),
};
const getCookieClockFactor = () => {
    const value = Cookies.get(COOKIE_CLOCK_FACTOR);
    return value ? parseFloat(value) : undefined;
};
const setCookieClockFactor = clockFactor => {
    Cookies.set(COOKIE_CLOCK_FACTOR, clockFactor, COOKIE_CLOCK_FACTOR_OPTS);
};


EmuSpeedControl.prototype.create = function(mz700js, baseClock) {
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

    this._element.classList.add("speed-control-slider");
    const label = document.createElement("LABEL");
    label.innerHTML = "Speed:";

    label.appendChild(this._slider);
    this._element.appendChild(label);
    this._element.appendChild(this._factorRef);
    this._element.appendChild(this._cpuClock);
    this._element.appendChild(this._clockFactor);

    // The slider events
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
        mz700js.setClockFactor(clockFactor);
        this.clockFactor(clockFactor);
        setCookieClockFactor(clockFactor);
        this._factorRef.innerHTML = `${Math.round(clockFactor * 100)}`;
    });
    this._slider.addEventListener("keydown", event => {
        event.stopPropagation();
    });

    // Actual MZ700 clock
    setInterval(async ()=> {
        const actualClockFreq = await mz700js.getActualClockFreq();
        this.actualClock(actualClockFreq);
    }, 1000);

    // Cookie for the emulation speed control slider value.
    const clockFactor = getCookieClockFactor();
    if(clockFactor) {
        mz700js.setClockFactor(clockFactor);
        this.clockFactor(clockFactor);
        setCookieClockFactor(clockFactor);
    } else {
        mz700js.getClockFactor().then(
            clockFactor => {
                this.clockFactor(clockFactor);
                setCookieClockFactor(clockFactor);
            }
        );
    }

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
