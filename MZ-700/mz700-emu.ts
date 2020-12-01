"use strict";
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

    // Setup Rendering
    mz700js.transferObject("offscreenCanvas",
        canvas.transferControlToOffscreen());

    // Create user interface
    await MZ700WebUI.createUI(mz700js, mz700screen, canvas);
}

main().catch(err => console.warn(err.stack));
