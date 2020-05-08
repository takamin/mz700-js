//
// Codes for Worker context.
// Override the methods in Worker context
//
"use strict";
const TransWorker = require('transworker');
const MZ700 = require('./mz700.js');
const MZ700CanvasRenderer = require('../lib/mz700-canvas-renderer.js');
const PCG700 = require("../lib/PCG-700.js");
const MZ700CG = require("../lib/mz700-cg.js");

//Create MZ700 and TransWorker.
const transworker = new TransWorker();
const mz700 = new MZ700();
const mz700CanvasRenderer = new MZ700CanvasRenderer();

mz700.create({
    started: () => transworker.postNotify("start"),
    stopped: () => transworker.postNotify("stop"),
    onBreak: () => transworker.postNotify("onBreak"),
    onVramUpdate: (index, dispcode, attr) => {
        mz700CanvasRenderer.writeVram(index, attr, dispcode);
    },
    startSound: freq => transworker.postNotify("startSound", [ freq ]),
    stopSound: () => transworker.postNotify("stopSound"),
    onStartDataRecorder: () => transworker.postNotify("onStartDataRecorder"),
    onStopDataRecorder: () => transworker.postNotify("onStopDataRecorder"),
});
const pcg700 = new PCG700(mz700CanvasRenderer);
pcg700.setupMMIO(mz700.mmio);

transworker.create(mz700);

//Receive offscreen canvas from the UI-thread
//and create a renderer and MMIO for PCG-700.
transworker.listenTransferableObject("offscreenCanvas", offscreenCanvas => {
    mz700CanvasRenderer.create({
        canvas: offscreenCanvas,
        CG: new MZ700CG(MZ700CG.ROM, 8, 8),
    });
    mz700CanvasRenderer.setupRendering();
});
