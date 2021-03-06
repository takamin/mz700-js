"use strict";
/* tslint:disable:no-console */
import TransWorker from "transworker";
import MZ700 from "./mz700";
import MZ700Scrn from "../lib/mz700-scrn";
import MZ700WebUI from "./mz700-web-ui";

async function main() {
    // Create MZ-700 Emulator
    const mz700js = TransWorker.createInterface(
        "./js/mz700-worker.min.js", MZ700,
        { syncType: TransWorker.SyncTypePromise });

    // MZ-700 Screen
    const mz700screen = document.querySelector("#mz700screen") as HTMLElement;
    const mz700scrn = new MZ700Scrn(mz700screen);
    const canvas = document.createElement("CANVAS") as HTMLCanvasElement;
    mz700screen.style.display = "none";
    mz700screen.appendChild(canvas);
    mz700scrn.create({canvas});
    canvas.style.height = "calc(100% - 1px)";

    mz700scrn.setupRendering();
    const mz700screen2 = document.createElement("DIV") as HTMLElement;
    const mz700scrn2 = new MZ700Scrn(mz700screen2);
    const canvas2 = document.createElement("CANVAS") as HTMLCanvasElement;
    mz700screen2.style.display = "none";
    mz700screen2.appendChild(canvas2);
    mz700scrn2.create({canvas: canvas2});
    mz700js.transferObject("offscreenCanvas",
        canvas2.transferControlToOffscreen());
    mz700js.subscribe("onUpdateScrn", (imageData:ImageData) => {
        mz700scrn._ctx.putImageData(imageData, 0, 0);
    });

    // Create user interface
    await MZ700WebUI.createUI(mz700js, mz700screen, canvas);
}

main().catch(err => console.warn(err.stack));
