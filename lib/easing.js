"use strict";

/**
 * Easing a value smooth and notify the handler.
 *
 * @param {number} sValue starting value
 * @param {number} eValue ending value
 * @param {number} duration execution duration
 * @param {function} onValueChange handler called on value change.
 * @param {function|undefined} onStop handler on complete
 * @returns {object} A handle object to cancel this process.
 */
function easing(sValue, eValue, duration, onValueChange, onStop) {
    onStop = onStop || onValueChange;
    let t0 = (new Date()).getTime();
    window.setTimeout( ()=>{ onValueChange.call(null, sValue); }, 0);
    let tid = window.setInterval(function() {
        let t = Date.now() - t0;
        if(t >= duration) {
            window.clearInterval(tid);
            onStop.call(null, eValue);
        } else {
            let value = (eValue - sValue) * t / duration + sValue;
            onValueChange.call(null, value);
        }
    }, 1);
    let cancelHandle = {
        tid: tid,
        onStop: onStop,
        sValue: sValue,
        eValue: eValue,
    };
    return cancelHandle
}

/**
 * Cancel the easing.
 * The starting value is notified to onStop handler.
 * @param {object} cancelHandle A handle that easing returns.
 * @returns {undefined}
 */
easing.cancel = function(cancelHandle) {
    window.clearInterval(cancelHandle.tid);
    cancelHandle.tid = null;
    cancelHandle.onStop.call(null, cancelHandle.sValue);
};

/**
 * Complete the easing.
 * The ending value is notified to onStop handler.
 * @param {object} cancelHandle A handle that easing returns.
 * @returns {undefined}
 */
easing.complete = function(cancelHandle) {
    window.clearInterval(cancelHandle.tid);
    cancelHandle.tid = null;
    cancelHandle.onStop.call(null, cancelHandle.eValue);
};

module.exports = easing;
