//
// Codes for Worker context.
// Override the methods in Worker context
//
"use strict";
const TransWorker = require('transworker');
const MZ700 = require('./mz700.js');
const MZ700CanvasRenderer = require('../lib/mz700-canvas-renderer.js');
const MZ700CG = require("../lib/mz700-cg.js");

const transworker = new TransWorker();

MZ700.prototype.transferScreenCanvas = function(offscreenCanvas) {
    transworker.mz700CanvasRenderer = new MZ700CanvasRenderer();
    transworker.mz700CanvasRenderer.create({
        canvas: offscreenCanvas,
        CG: new MZ700CG(MZ700CG.ROM, 8, 8),
    });
    transworker.mz700CanvasRenderer.setupRendering();
};

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
    onUpdateScreen: screenUpdateData => {
        if(transworker.mz700CanvasRenderer) {
            for (const addr of Object.keys(screenUpdateData)) {
                const chr = screenUpdateData[addr];
                transworker.mz700CanvasRenderer.writeVram(
                    parseInt(addr), chr.attr, chr.dispcode);
            }
        } else {
            transworker.postNotify( "onUpdateScreen", screenUpdateData);
        }
    },
    onMmioRead: (address, value) => transworker.postNotify(
        "onMmioRead", { address: address, value: value }),
    onMmioWrite: (address, value) => transworker.postNotify(
        "onMmioWrite", { address: address, value: value }),
    startSound: freq => transworker.postNotify("startSound", [ freq ]),
    stopSound: () => transworker.postNotify("stopSound"),
    onStartDataRecorder: () => transworker.postNotify("onStartDataRecorder"),
    onStopDataRecorder: () => transworker.postNotify("onStopDataRecorder"),
}));
