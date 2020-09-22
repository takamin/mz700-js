"use strict";
const TransWorker = require("transworker");
const MZ700 = require("./mz700.js");
const MZ700WebUI = require("./mz700-web-ui.js");
require("../lib/jquery-plugin/jquery.mz700-scrn.js");

async function main() {
    // Create MZ-700 Emulator
    const mz700js = TransWorker.createInterface(
        "./js/bundle-mz700-worker.js", MZ700,
        { syncType: TransWorker.SyncTypePromise });

    // MZ-700 Screen
    const mz700screen = $("#mz700screen").css("display", "none");
    const canvas = document.createElement("CANVAS");
    mz700screen.append($(canvas));
    mz700screen.mz700scrn("create", { canvas });
    $(canvas).css("height", "calc(100% - 1px)");

    // Setup Rendering
    mz700js.transferObject("offscreenCanvas",
        canvas.transferControlToOffscreen());

    // Create user interface
    await MZ700WebUI.createUI(mz700js, mz700screen, canvas);
}

main().catch(err => console.warn(err.stack));
