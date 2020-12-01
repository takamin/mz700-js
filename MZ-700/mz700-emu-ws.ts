"use strict";
import TransWorker from "transworker";
import MZ700 from "./mz700";
import MZ700Scrn from "../lib/mz700-scrn";
import MZ700WebUI from "./mz700-web-ui";

async function main() {
    // Create MZ-700 Emulator
    const mz700js = await TransWorker.WebSocketClient.createInterface(
        "ws://localhost:5000", MZ700,
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
    mz700scrn.setupRendering();
    mz700js.subscribe("onUpdateScrn", canvasData => {
        const buffer = Buffer.from(canvasData, "base64");
        const array = Uint8ClampedArray.from(buffer);
        const imageData = new ImageData(array, 320, 200);
        mz700scrn._ctx.putImageData(imageData, 0, 0);
    });

    // Create user interface
    await MZ700WebUI.createUI(mz700js, mz700screen, canvas);
}

main().catch(err => console.warn(err.stack));
