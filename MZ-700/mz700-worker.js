//
// Codes for Worker context.
// Override the methods in Worker context
//
"use strict";
const TransWorker = require('transworker');
const MZ700 = require('./mz700.js');

const transworker = new TransWorker();
transworker.create(new MZ700({
    onClockFactorUpdate: param => {
        try {
            transworker.postNotify("onClockFactorUpdate", param);
        } catch(ex) {
            console.error(ex);
        }
    },
    started: () => transworker.postNotify("start"),
    stopped: () => transworker.postNotify("stop"),
    notifyClockFreq: tCyclePerSec => transworker.postNotify(
        "onNotifyClockFreq", [ tCyclePerSec ]),
    onBreak: () => transworker.postNotify("onBreak"),
    onUpdateScreen: screenUpdateData => transworker.postNotify(
        "onUpdateScreen", screenUpdateData),
    onMmioRead: (address, value) => transworker.postNotify(
        "onMmioRead", { address: address, value: value }),
    onMmioWrite: (address, value) => transworker.postNotify(
        "onMmioWrite", { address: address, value: value }),
    startSound: freq => transworker.postNotify("startSound", [ freq ]),
    stopSound: () => transworker.postNotify("stopSound"),
    onStartDataRecorder: () => transworker.postNotify("onStartDataRecorder"),
    onStopDataRecorder: () => transworker.postNotify("onStopDataRecorder"),
}));
