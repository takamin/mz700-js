"use strict";
const TransWorker = require("transworker");
const MZ700 = require("./mz700.js");
const MZ700WebUI = require("./mz700-web-ui.js");
require("../lib/jquery-plugin/jquery.mz700-scrn.js");

async function main() {
    // Create MZ-700 Emulator
    const mz700js = TransWorker.createInterface(
        "./js/mz700-worker.min.js", MZ700,
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

    //<!-- Go to www.addthis.com/dashboard to customize your tools -->
    const addThisBox = $("<div/>").css("height", "48px").css("line-height","48px")
        .append($("<div/>").css("box-sizing", "border-box").css("text-align", "right")
            .addClass("addthis_inline_share_toolbox"));
    const addThisScript = $("<script/>").attr("type", "text/javascript")
        .attr("src", "//s7.addthis.com/js/300/addthis_widget.js#pubid=ra-596c4b9e47c8c585");
    addThisBox.insertBefore($(".emulation-panel"));
    $(document.body).append(addThisScript);

    // Create user interface
    await MZ700WebUI.createUI(mz700js, mz700screen, canvas);
}

main().catch(err => console.warn(err.stack));
