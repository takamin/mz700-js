//
// Codes for Worker context.
// Override the methods in Worker context
//
"use strict";
/* tslint:disable:no-console */
import TransWorker = require('transworker');
import MZ700 from './mz700';
import MZ700CanvasRenderer from '../lib/mz700-canvas-renderer';
import MZ700CG from "../lib/mz700-cg.js";
import PCG700 from "../lib/PCG-700.js";

function createMZ700(transworker, mz700CanvasRenderer) {
    const mz700 = new MZ700();
    let vramUpdated = true;
    const onVramUpdate = () => {
        vramUpdated = true;
    };
    mz700.create({
        started: () => transworker.postNotify("start"),
        stopped: () => transworker.postNotify("stop"),
        onBreak: () => transworker.postNotify("onBreak"),
        onVramUpdate: (index, dispcode, attr) => {
            mz700CanvasRenderer.writeVram(index, attr, dispcode);
            onVramUpdate();
        },
        startSound: freq => transworker.postNotify("startSound", [ freq ]),
        stopSound: () => transworker.postNotify("stopSound"),
        onStartDataRecorder: () => transworker.postNotify("onStartDataRecorder"),
        onStopDataRecorder: () => transworker.postNotify("onStopDataRecorder"),
    });

    transworker.listenTransferableObject("offscreenCanvas", offscreenCanvas => {
        mz700CanvasRenderer.create({
            canvas: offscreenCanvas,
            CG: new MZ700CG(MZ700CG.ROM, 8, 8),
        });
        mz700CanvasRenderer.setupRendering();
        setInterval(()=>{
            if(vramUpdated) {
                const imageData = mz700CanvasRenderer.getImageData();
                transworker.postNotify("onUpdateScrn", imageData, [imageData.data.buffer]);
                vramUpdated = false;
            }
        }, 1000/24);
    });
    return mz700;
}

async function main() {
    const transworker = new TransWorker();

    const mz700CanvasRenderer = new MZ700CanvasRenderer();
    const mz700 = createMZ700(transworker, mz700CanvasRenderer);
    const pcg700 = new PCG700(mz700CanvasRenderer);
    mz700.attachPCG700(pcg700);

    transworker.create(mz700);
}
main().catch(err => console.error(`Error: ${err.stack}`));
