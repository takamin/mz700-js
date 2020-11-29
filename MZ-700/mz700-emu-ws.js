"use strict";
const TransWorker = require("transworker");
const MZ700 = require("./mz700.js");
const MZ700WebUI = require("./mz700-web-ui.js");
require("../lib/jquery-plugin/jquery.mz700-scrn.js");

async function main() {
    // Create MZ-700 Emulator
    const mz700js = await TransWorker.WebSocketClient.createInterface(
        "ws://localhost:5000", MZ700,
        { syncType: TransWorker.SyncTypePromise });

    // MZ-700 Screen
    const mz700screen = $("#mz700screen").css("display", "none");
    const canvas = document.createElement("CANVAS");
    mz700screen.append($(canvas));
    mz700screen.mz700scrn("create", { canvas });
    $(canvas).css("height", "calc(100% - 1px)");

    // Setup Rendering
    mz700screen.mz700scrn("setupRendering");
    const mzScrn = mz700screen.get(0).mz700scrn;
    mz700js.subscribe("onUpdateScrn", canvasData => {
        const buffer = Buffer.from(canvasData, "base64");
        const array = Uint8ClampedArray.from(buffer);
        const imageData = new ImageData(array, 320, 200);
        mzScrn._ctx.putImageData(imageData, 0, 0);
    });

    // Create user interface
    await MZ700WebUI.createUI(mz700js, mz700screen, canvas);
}

main().catch(err => console.warn(err.stack));
