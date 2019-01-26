require("fullscrn");
require("../lib/context.js");
require("../lib/ex_number.js");
const      TransWorker = require("transworker");
const     Z80_assemble = require("../Z80/assembler.js");
const              Z80 = require("../Z80/Z80.js");
const            MZ700 = require("./mz700.js");
const MZ700_MonitorRom = require("./mz700-new-monitor.js");
const    MZ_TapeHeader = require("../lib/mz-tape-header.js");
const     parseAddress = require("../lib/parse-addr.js");
require("../lib/jquery.mz700-kb.js");
require("../lib/jquery.Z80-reg.js");
require("../lib/jquery.toggle-button.js");
require("../lib/jquery.asmview.js");
require("../lib/jquery.asmlist.js");
require("../lib/jquery.tabview.js");
require("../lib/jquery.Z80-mem.js");
require("../lib/jquery.mz700-scrn.js");
require("../lib/jquery.mz-sound-control.js");
require("../lib/jquery.emu-speed-control.js");
require("../lib/jquery.mz-control-panel.js");


const BBox = require("b-box");
const dock_n_liquid = require("dock-n-liquid");
const packageJson = require("../package.json");
const { getDeviceType } = require("../lib/user-agent-util.js");
const MZ700CG = require("../lib/mz700-cg.js");
const MMIO = require("../lib/mz-mmio.js");
const PCG700 = require("../lib/PCG-700");
const MZBeep = require("../lib/mz-beep.js");
const parseRequest = require("../lib/parse-request");
const requestJsonp = require("../lib/jsonp");

((async () => {

    // Set module version to the page title
    const pageTitle = [
        packageJson.description,"(",
        packageJson.name,
        "@",packageJson.version,")"
    ].join("");
    $("title").html(pageTitle);
    $("h1 .mz700scrn").html(pageTitle);

    //
    // Create MZ-700 Emulator
    //
    const mz700js = TransWorker.createInterface(
        "./js/bundle-mz700-worker.js", MZ700,
        { syncType: TransWorker.SyncTypePromise });

    let isRunning = false;

    // MZ-700 Screen
    const mz700container = $(".MZ-700-body");
    const mz700screen = $(".MZ-700-body .screen");
    mz700screen.mz700scrn("create", { CG: new MZ700CG(), });
    mz700screen.find("canvas").css("height", "calc(100% - 1px)");

    const liquidRoot = dock_n_liquid.select($("#liquid-panel-MZ-700").get(0));
    const screenElement = mz700screen.get(0)["mz700scrn"];

    /**
     * Resize the MZ-700 Screen.
     * @returns {undefined}
     */
    const resizeScreen = function() {
        const bboxContainer = new BBox(mz700container.get(0));
        const bboxScreen = new BBox(mz700screen.get(0));
        const containerSize = bboxContainer.getSize();
        containerSize._h -= bboxScreen.px("border-top-width");
        containerSize._h -= bboxScreen.px("border-bottom-width");
        const orgSize = new BBox.Size(320,200);
        const innerSize = containerSize.getMaxInscribedSize(orgSize);

        const margin = new BBox.Size((containerSize._w - innerSize._w) / 2, 0);
        if(margin._w < 0) {
            margin._w = 0;
        }
        mz700screen
            .css("margin-left", margin._w + "px")
            .css("margin-top", margin._h + "px")
            .css("width", innerSize._w + "px")
            .css("height", innerSize._h + "px");
    };

    mz700js.subscribe("start", () => {
        isRunning = true;
        window.dispatchEvent(new Event("mz700started"));
        $(".MZ-700").addClass("running");
    });
    mz700js.subscribe("stop", () => {
        isRunning = false;
        window.dispatchEvent(new Event("mz700stopped"));
        $(".MZ-700").removeClass("running");
    });
    mz700js.subscribe("onBreak", ()=> mz700js.stop());
    mz700js.subscribe("onNotifyClockFreq", tCyclePerSec => {
        $(".speed-control-slider").attr("title",
            `Clock: ${(Math.round((tCyclePerSec / 1000000) * 100) / 100)} MHz`);
    });
    mz700js.subscribe("onPortRead", ()=>{});
    mz700js.subscribe("onPortWrite", ()=>{});

    //
    // Setup memory map I/O system
    //
    const mmio = MMIO.create(mz700js);

    // MZ-700 Beep sound
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = (window.AudioContext ? new AudioContext() : null);
    const mzBeep = new MZBeep(mz700js, audioContext);
    const elementToResume = mz700screen.find("canvas");
    elementToResume.click(()=>{ mzBeep.allowToPlaySound(); });
    audioContext.addEventListener("statechange", event=>{
        event.stopPropagation();
        checkSound();
    });
    const originalTitle = elementToResume.attr("title");
    const checkSound = () => {
        if(!mzBeep.resumed()) {
            elementToResume.attr("title",
                "The Audio API is suspended by autoplay policy. " +
                "To resume the sound, click here or volume controls.");
        } else {
            elementToResume.attr("title", originalTitle);
        }
    };
    checkSound();

    // Setup PCG-700
    PCG700.create(mmio, screenElement);

    mz700js.subscribe('onUpdateScreen', updateData => {
        for(const addr of Object.keys(updateData)) {
            const chr = updateData[addr];
            screenElement.writeVram(
                    parseInt(addr), chr.attr, chr.dispcode);
        }
    });

    //
    // Register View
    //
    const regview = $("<div/>").Z80RegView("init", mz700js);
    $("#wndRegView").append(
        $("<div/>").css("display", "inline-block")
        .append(regview));

    //
    // Create dump list
    //
    const $dumplist = $("<div/>").dumplist("init")
        .on("querymemory", async (event, addr, callback) => {
            callback(await mz700js.readMemory(addr));
        });
    $("#wndDumpList").append(
        $("<div/>")
        .Z80AddressSpecifier("create")
        .on("queryregister", async (event, regName, callback) => {
            const reg = await mz700js.getRegister();
            callback(reg[regName]);
        })
        .on("notifyaddress", (event, address) => {
            $dumplist.dumplist("topAddr", address);
        })
    ).append($dumplist);

    //
    // Create assemble list
    //
    $("#wndAsmList").asmview("create", mz700js);

    //
    // Debugging panel
    //
    //
    /**
     * Assemble and display the list.
     * @async
     * @param {string} asmsrc
     * The source to be assemble with Z80 assembler.
     * @param {object} asmlist
     * jquery.asmlist object
     * @returns {Promise<object>} as a result of assemble.
     */
    const assemble = async function( asmsrc, asmlist ) {
        const shouldBeResumed = isRunning;
        if(shouldBeResumed) {
            await mz700js.stop();
        }
        const assembled = Z80_assemble.assemble([asmsrc]).obj[0];
        await mz700js.writeAsmCode( assembled );
        asmlist.asmlist("writeList",
            assembled.list, await mz700js.getBreakPoints());
        if(shouldBeResumed) {
            await mz700js.start();
        }
        return assembled;
    };

    const asmlistMonitorRom = $("<div/>").asmlist("create")
        .on("assemble", (e, src) => assemble(src, asmlistMonitorRom));
    $("#wndAsmList").asmview("addAsmList",
        "monitor-rom", "", asmlistMonitorRom);
    const asmlist = Z80.dasm(MZ700_MonitorRom.Binary, 0x0000, 0x1000, 0x0000);
    const dasmlines = Z80.dasmlines(asmlist);
    const outbuf = dasmlines.join("\n") + "\n";
    $("#wndAsmList").asmview("name", "monitor-rom", "MZ-700 NEW MONITOR");
    asmlistMonitorRom.asmlist("text", [
        ";;;",
        ";;; This is a disassembled list of the MZ-NEW MONITOR",
        ";;; provided from the Marukun's website 'MZ-Memories'",
        ";;; ( http://retropc.net/mz-memories/mz700/ ).",
        ";;; ",
    ].join("\n") + "\n" + outbuf);
    await assemble( outbuf, asmlistMonitorRom );

    //
    // Show a sample assemble source
    //
    const asmlistMzt = $("<div/>").asmlist("create")
        .on("assemble", (e, src) => mz700js.assemble(src, asmlistMzt));
    $("#wndAsmList").asmview("addAsmList",
        "mzt", "PCG-700 sample", asmlistMzt);

    const sampleSource = $($("textarea.default.source").get(0)).val();
    asmlistMzt.asmlist("text", sampleSource);
    await assemble( sampleSource, asmlistMzt );

    // Accept MZT file to drop to the MZ-700 screen
    const mztLoader = document.querySelector(".MZ-700 .cmt-slot");
    if(mztLoader &&
        window.File && window.FileReader &&
        window.FileList && window.Blob)
    {
        const el = mztLoader;
        el.addEventListener("dragover", event => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy"; // Explicitly show this is a copy.
        }, false);
        el.addEventListener("drop", event => {
            event.stopPropagation();
            event.preventDefault();
            const files = event.dataTransfer.files; // FileList object.
            if(files.length > 0) {
                const f = files[0];
                const reader = new FileReader();
                reader.onload = () => {
                    const tape_data = new Uint8Array(reader.result);
                    setMztData(tape_data);
                };
                reader.readAsArrayBuffer(f);
            }
        }, false);
    }

    const setMztData = async function(tape_data) {
        await mz700js.stop();
        await mz700js.setCassetteTape(tape_data);
        if(tape_data != null) {
            const mztape_array = MZ700.parseMZT(tape_data);
            await mz700js.loadCassetteTape();
            await disassemble(mztape_array);
            await mz700js.setPC(mztape_array[0].header.addr_exec);
            await mz700js.start();
        }
        await mz700container.MZControlPanel("updateCmtSlot");
    };

    const disassemble = async function(mztape_array) {
        const name = MZ_TapeHeader.get1stFilename(mztape_array) || "(empty)";
        const result = MZ700.disassemble(mztape_array);
        if($(".source-list").length > 0) {
            $(".source-list").asmview("name", "mzt", name);
            asmlistMzt.asmlist("text", result.outbuf);
            asmlistMzt.asmlist("writeList",
                result.asmlist, await mz700js.getBreakPoints());
        }
    };

    //
    //直接実行ボタン
    //
    $("#wndImmExec").append(
        $("<div/>").addClass("imm-exec").css("height", "306px")
        .css("padding","15px 5px")
        .append($("<label/>")
            .css("display","inline-block").css("width", "80px")
            .css("text-align", "right").css("padding-right", "10px")
            .html("Address"))
        .append($("<input/>")
                .attr("type", "text").attr("value", "CF00h")
                .addClass("address"))
        .append($("<br/>"))
        .append($("<label/>")
            .css("display","inline-block").css("width", "80px")
            .css("text-align", "right").css("padding-right", "10px")
            .html("Mnemonic"))
        .append($("<input/>")
                .attr("type", "text").attr("value", "NOP")
                .addClass("mnemonic"))
        .append($("<button/>").attr("type", "button").html("Execute")
                .click(async function() {
                    const par = $(this).parent();
                    const addrToken = par.find("input.address").val();
                    const addr = parseAddress(addrToken);
                    if(addr != null) {
                        let src = 'ORG ' + addr.HEX(4) + "H\r\n";
                        src += par.find("input.mnemonic").val() + "\r\n";
                        const bin = Z80_assemble.assemble([src]).obj[0];
                        const reg = await mz700js.getRegister();
                        const execAddr = await mz700js.writeAsmCode( bin );
                        await mz700js.setPC(execAddr);
                        await mz700js.exec(1);
                        await mz700js.setPC(reg.PC);
                        await regview.Z80RegView("updateRegister");
                    }
                }))
        .append($("<br/>"))
    );

    //
    // Tools on the right pane
    //
    const taskbar = $("#toolwndTaskbar");
    const wndBase = $(".toolwnd:first").parent();
    const updateWndButton = () => {
        wndBase.find(".toolwnd .move-up-button").prop("disabled", false);
        wndBase.find(".toolwnd .move-down-button").prop("disabled", false);
        wndBase.find(".toolwnd:visible:first .move-up-button")
            .prop("disabled", true);
        wndBase.find(".toolwnd:visible:last .move-down-button")
            .prop("disabled", true);
    };
    $(".toolwnd").each(function() {
        const wnd = $(this);
        const wndSw = $("<button/>").html(wnd.attr("title"))
            .addClass(wnd.hasClass("open")?"on":"off")
            .ToggleButton("create", {
                "on": () => {
                    wnd.show();
                    updateWndButton();
                },
                "off": () => {
                    wnd.hide();
                    updateWndButton();
                }
            });
        const title = $("<div/>").addClass("titlebar")
            .append($("<span/>").addClass("title").html(wnd.attr("title")))
            .append($("<span/>").addClass("buttons")
                .append($("<button/>").attr("type","button")
                    .html("▼").attr("title", "Down").addClass("move-down-button")
                    .click(()=>{
                        wnd.next().after(wnd);
                        wndSw.next().after(wndSw);
                        updateWndButton();
                    })
                ).append($("<button/>").attr("type","button")
                    .html("▲").attr("title", "Up").addClass("move-up-button")
                    .click(()=>{
                        wnd.prev().before(wnd);
                        wndSw.prev().before(wndSw);
                        updateWndButton();
                    })
                ).append($("<button/>").attr("type","button")
                    .html("■").attr("title", "Expand")
                    .click(()=>{
                        taskbar.find("button").ToggleButton("off");
                        wndSw.ToggleButton("on");
                        wndBase.find(".toolwnd:first-child").before(wnd);
                        taskbar.find("button:first-child").before(wndSw);
                        updateWndButton();
                    })
                ).append($("<button/>").attr("type","button")
                    .html("×").attr("title", "Close")
                    .click(()=>{
                        wndSw.ToggleButton("off");
                    })
                )
            );
        const content = $("<div/>").addClass("content").append(wnd.children());
        wnd.append(title).append(content);

        taskbar.append(wndSw);
    });
    updateWndButton();

    //
    // Control panel
    //
    await mz700container.MZControlPanel("create", mz700js, mzBeep);
    mz700container
        .on("reset", async () => {
            await mz700js.stop();
            await mz700js.reset();
            await mz700js.start();
            await mz700container.MZControlPanel("updateCmtSlot");
        })
        .on("start", () => mz700js.start())
        .on("stop", () => mz700js.stop())
        .on("stepIn", async () => {
            $("#wndAsmList").asmview("clearCurrentLine");
            await mz700js.exec(1);
            const reg = await mz700js.getRegister();
            $("#wndAsmList").asmview("currentLine", reg.PC);
            await regview.Z80RegView("updateRegister");
        });

    // Convert MZ-700 character
    for(const element of document.querySelectorAll("span.mz700scrn")) {
        window.mz700scrn.convert(element);
    }

    switch(getDeviceType()) {
    case "tablet":
        mz700screen.click(event => {
            event.stopPropagation();
            mz700container.MZControlPanel("toggleVisibility");
        });
        break;
    case "pc":
        mz700screen.mousemove(event => {
            event.stopPropagation();
            mz700container.MZControlPanel("acceptKey", true);
            mz700container.MZControlPanel("show");
        });
        break;
    }

    //
    // Update after emulation status changed
    //
    let reg_upd_tid = null;
    window.addEventListener("mz700started", () => {
        if(!reg_upd_tid) {
            reg_upd_tid = setInterval(()=>{
                regview.Z80RegView("updateRegister");
            }, 50);
        }
        $("#wndAsmList").asmview("clearCurrentLine");
    });
    window.addEventListener("mz700stopped", async () => {
        const reg = await mz700js.getRegister();
        $("#wndAsmList").asmview("currentLine", reg.PC);
        if(reg_upd_tid) {
            clearInterval(reg_upd_tid);
            reg_upd_tid = null;
        }
        await regview.Z80RegView("updateRegister");
    });

    //
    // Layout
    //
    window.addEventListener("resize", () => {
        liquidRoot.layout();
        resizeScreen();
        mz700container.MZControlPanel("resize");
    });

    const dockPanelHeader = $("#dock-panel-header");
    const dockPanelRight = $("#dock-panel-right");
    if(getDeviceType() !== "pc") {
        dockPanelRight.remove();
    }
    document.addEventListener("fullscreenchange", () => {
        if(document.fullscreenElement == null) {
            dockPanelHeader.show();
            dockPanelRight.show();
        } else {
            dockPanelHeader.hide();
            dockPanelRight.hide();
        }
        liquidRoot.layout();
        resizeScreen();
        mz700container.MZControlPanel("resize");
    });

    dock_n_liquid.init(() => {
        resizeScreen();
        mz700container.MZControlPanel("resize");
    });
    dock_n_liquid.select($(".MZ-700").get(0)).layout();
    liquidRoot.layout();
    resizeScreen();
    mz700container.MZControlPanel("resize");

    await mz700js.reset();
    await mz700js.start();
    //await mz700container.MZControlPanel("updateCmtSlot");

    // Load MZT file when the filename is included in URL
    const request = parseRequest();
    if("mzt" in request.parameters) {
        const filename = request.parameters.mzt;
        const url = `https://takamin.github.io/MZ-700/mzt/${filename}.js`;
        try {
            const tape_data = await requestJsonp("loadMZT", url);
            await setMztData(tape_data);
        } catch (err) {
            console.warn(err.message);
        }
    }

})());
