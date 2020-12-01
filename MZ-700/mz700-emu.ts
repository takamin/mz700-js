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