"use strict";

/* tslint:disable:no-console */
/**
 * Run the job after only once even if invoked frequentry short intervals.
 *
 * Even if this is called frequently many times at short intervals,
 * this invoke only last one once.
 *
 * This is useful to run heavy process in a scroll or mouse event handler.
 *
 * @param {()=>void} job the process to invoked once
 * @param {number} duration duration in milliseconds.
 * @returns {undefined}
 *
 * @author K.Takami
 * @version 2012-01-24
 */
function doLater(job, duration) {
    if(job in doLater.TID) {
        clearTimeout(doLater.TID[job]);
    }
    doLater.TID[job] = setTimeout(() => {
        delete doLater.TID[job];
        try {
            job.call();
        } catch(e) {
            console.error("doLater fail on " + job + "\n" + e.stack);
        }
    }, duration);
}

// Timer ID by function.
doLater.TID = {};

module.exports = doLater;
