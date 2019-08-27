require("fullscrn");
require("../lib/context.js");
const       NumberUtil = require("../lib/number-util.js");
const      TransWorker = require("transworker");
const     Z80_assemble = require("../Z80/assembler.js");
const              Z80 = require("../Z80/Z80.js");
const            MZ700 = require("./mz700.js");
const MZ700_MonitorRom = require("./mz700-new-monitor.js");
const          MZ_Tape = require("../lib/mz-tape.js");
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
const MZBeep = require("../lib/mz-beep.js");
const parseRequest = require("../lib/parse-request");
const requestJsonp = require("../lib/jsonp");

((async () => {

    const liquidRoot = dock_n_liquid.select($("#liquid-panel-MZ-700").get(0));

    // Set module version to the page title
    const pageTitle = [
        packageJson.description,"(",
        packageJson.name,
        "@",packageJson.version,")"
    ].join("");
    $("title").html(pageTitle);
    $("h1 .mz700scrn").html(pageTitle);

    const dockPanelHeader = $("#dock-panel-header");
    document.addEventListener("fullscreenchange", () => {
        if(document.fullscreenElement == null) {
            dockPanelHeader.show();
        } else {
            dockPanelHeader.hide();
        }
    });
    const dockPanelRight = $("#dock-panel-right");
    if(getDeviceType() !== "pc") {
        dockPanelRight.remove();
    } else {
        document.addEventListener("fullscreenchange", () => {
            if(document.fullscreenElement == null) {
                dockPanelRight.show();
            } else {
                dockPanelRight.hide();
            }
        });
    }

    // Create MZ-700 Emulator
    const mz700js = TransWorker.createInterface(
        "./js/bundle-mz700-worker.js", MZ700,
        { syncType: TransWorker.SyncTypePromise });

    mz700js.subscribe("start", () => {
        $(".MZ-700").addClass("running");
    });
    mz700js.subscribe("stop", async () => {
        $(".MZ-700").removeClass("running");
    });
    mz700js.subscribe("onBreak", ()=> mz700js.stop());

    // MZ-700 Screen
    const mz700screen = $(".MZ-700-body .screen")
        .mz700scrn("create", { CG: new MZ700CG(), })
        .mz700scrn("mz700js", mz700js).hide();
    mz700screen.find("canvas").css("height", "calc(100% - 1px)");

    // MZ-700 Beep sound
    const mzBeep = new MZBeep(mz700js);

    // Control panel
    const mz700container = $(".MZ-700-body");
    await mz700container.MZControlPanel(
        "create", mz700js, mzBeep, MZ700.Z80_CLOCK);

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

    // Register View
    {
        const regview = $("<div/>").Z80RegView("init", mz700js);
        $("#wndRegView")
            .append($("<div/>").css("display", "inline-block").append(regview))
            .on("show", () => regview.Z80RegView("visibility", true))
            .on("hide", () => regview.Z80RegView("visibility", false));

        // Fire the events when the jquery elements was shown or hidden
        for(const ev of ["show", "hide"]) {
            const el = $.fn[ev];
            $.fn[ev] = function() {
                this.trigger(ev);
                return el.apply(this, arguments);
            }
        }
    }

    // Create dump list
    {
        const dumplist = $("<div/>").dumplist("init", { mz700js: mz700js });
        $("#wndDumpList")
            .append(dumplist.dumplist("addrSpecifier"))
            .append(dumplist);
    }

    // Create assemble list
    $("#wndAsmList").asmview("create", mz700js);

    // Disassemble MONITOR ROM and show that source.
    {
        const monRom = $("#wndAsmList").asmview("newAsmList",
            "monitor-rom", "MZ-700 NEW MONITOR");
        const dasmlist = Z80.dasm(MZ700_MonitorRom.Binary, 0x0000, 0x1000, 0x0000);
        const dasmlines = Z80.dasmlines(dasmlist);
        await monRom.asmlist("assemble", [
            ";;;",
            ";;; This is a disassembled list of the MZ-NEW MONITOR",
            ";;; provided from the Marukun's website 'MZ-Memories'",
            ";;; ( http://retropc.net/mz-memories/mz700/ ).",
            ";;; ",
        ].join("\n") + "\n" + dasmlines.join("\n") + "\n");
    }

    // Show a sample assemble source
    const asmlistMzt = $("#wndAsmList").asmview("newAsmList",
            "mzt", "PCG-700 sample");
    await asmlistMzt.asmlist("assemble", $("textarea.default.source").val());

    //直接実行ボタン
    const btnExecImm = $("<button/>").attr("type", "button").html("Execute")
        .click(async function() {
            const par = $(this).parent();
            const addrToken = par.find("input.address").val();
            const addr = parseAddress.parseAddress(addrToken);
            if(addr != null) {
                let src = 'ORG ' + NumberUtil.HEX(addr, 4) + "H\r\n";
                src += par.find("input.mnemonic").val() + "\r\n";
                const bin = Z80_assemble.assemble([src]).obj[0];
                const reg = await mz700js.getRegister();
                const execAddr = await mz700js.writeAsmCode( bin );
                await mz700js.setPC(execAddr);
                await mz700js.step();
                await mz700js.setPC(reg.PC);
            }
        });
    mz700js.subscribe("start", () => btnExecImm.prop("disabled", true));
    mz700js.subscribe("stop", () => btnExecImm.prop("disabled", false));

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
        .append(btnExecImm)
        .append($("<br/>"))
    );

    // Tools on the right pane
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

    // Convert MZ-700 character
    for(const element of document.querySelectorAll("span.mz700scrn")) {
        window.mz700scrn.convert(element);
    }

    // Layout
    const resizeScreen = function() {
        liquidRoot.layout();
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
        mz700container.MZControlPanel("resize");
    };
    window.addEventListener("resize", () => resizeScreen());
    document.addEventListener("fullscreenchange", () => {
        resizeScreen();
    });
    mz700screen.show();
    resizeScreen();

    await mz700js.reset();
    await mz700js.start();

    {
        // Disassemble MZTape array
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

        // Set a cassette tape to data recorder of MZ-700 and
        // load the MZT to memory directly.
        const setMztData = async function(tape_data) {
            await mz700js.stop();
            await mz700js.setCassetteTape(tape_data);
            if(tape_data != null) {
                const mztape_array = MZ_Tape.parseMZT(tape_data);
                await mz700js.loadCassetteTape();
                await disassemble(mztape_array);
                await mz700js.setPC(mztape_array[0].header.addr_exec);
                await mz700js.start();
            }
            await mz700container.MZControlPanel("updateCmtSlot");
        };

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
                console.warn(err.stack);
            }
        }
    }

    //<!-- Go to www.addthis.com/dashboard to customize your tools -->
    const addThisBox = $("<div/>").css("height", "48px").css("line-height","48px")
        .append($("<div/>").css("box-sizing", "border-box").css("text-align", "right")
            .addClass("addthis_inline_share_toolbox"));
    const addThisScript = $("<script/>").attr("type", "text/javascript")
        .attr("src", "//s7.addthis.com/js/300/addthis_widget.js#pubid=ra-596c4b9e47c8c585");
    addThisBox.insertBefore($(".emulation-panel"));
    $(document.body).append(addThisScript);

})());
