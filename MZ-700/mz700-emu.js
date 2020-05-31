require("fullscrn");
const       NumberUtil = require("../lib/number-util.js");
const      TransWorker = require("transworker");
const     Z80_assemble = require("../Z80/assembler.js");
const            MZ700 = require("./mz700.js");
const          MZ_Tape = require("../lib/mz-tape.js");
const    MZ_TapeHeader = require("../lib/mz-tape-header.js");
const     parseAddress = require("../lib/parse-addr.js");
const              Z80 = require("../Z80/Z80.js");
require("../lib/jquery-plugin/jquery.mz700-kb.js");
require("../lib/jquery-plugin/jquery.Z80-reg.js");
require("../lib/jquery-plugin/jquery.asmview.js");
require("../lib/jquery-plugin/jquery.asmlist.js");
require("../lib/jquery-plugin/jquery.tabview.js");
require("../lib/jquery-plugin/jquery.Z80-mem.js");
require("../lib/jquery-plugin/jquery.mz700-img-button.js");
require("../lib/jquery-plugin/jquery.mz700-scrn.js");
require("../lib/jquery-plugin/jquery.mz-sound-control.js");
require("../lib/jquery-plugin/jquery.emu-speed-control.js");
require("../lib/jquery-plugin/jquery.mz-data-recorder.js");
require("../lib/jquery-plugin/jquery.toggle-button.js");
require("../lib/jquery-plugin/jquery.tool-window.js");
const BBox = require("b-box");
const dock_n_liquid = require("dock-n-liquid");
const packageJson = require("../package.json");
const { getDeviceType } = require("../lib/user-agent-util.js");
const MZBeep = require("../lib/mz-beep.js");
const parseRequest = require("../lib/parse-request");
const requestJsonp = require("../lib/jsonp");

const deviceType = getDeviceType();

/**
 * Load an IMG element.
 * @param {string} src source attribute value.
 * @param {string|null} alt alt attribute value.
 * @param {any} width (Optional) Width attribute value.
 * @param {any} height (Optional) Height attibute value.
 * @returns {Promise<Image>} a promise to be resolved by image element.
 */
function loadImage(src, alt, width, height) {
    return new Promise((resolve, reject) => {
        const image = new Image(width, height);
        image.onload = () => {
            resolve(image);
        };
        image.onerror = () => {
            reject(new Error(`Fail to load an image from ${src}`));
        };
        image.src = src;
        image.setAttribute("alt", alt);
        image.setAttribute("title", alt);
    });
}

((async () => {

    // Set module version to the page title
    const pageTitle = [
        packageJson.description,"(",
        packageJson.name,
        "@",packageJson.version,")"
    ].join("");
    $("title").html(pageTitle);
    $("h1 .mz700scrn").html(pageTitle);

    const dockPanelHeader = $("#dock-panel-header");

    // Create MZ-700 Emulator
    const mz700js = TransWorker.createInterface(
        "./js/bundle-mz700-worker.js", MZ700,
        { syncType: TransWorker.SyncTypePromise });
    let _isRunning = false;

    const monitorRom = await new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "./mz_newmon/ROMS/NEWMON7.ROM", true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function () {
            const arrayBuffer = xhr.response;
            if (arrayBuffer) {
                const byteArray = Array.from(new Uint8Array(arrayBuffer));
                resolve(byteArray);
            }
        };
        xhr.send(null);
    });

    mz700js.setMonitorRom(monitorRom);

    mz700js.subscribe("onBreak", ()=> mz700js.stop());

    // MZ-700 Beep sound
    const mzBeep = new MZBeep(mz700js);
    mz700js.subscribe("startSound", freq => mzBeep.startSound(freq[0]));
    mz700js.subscribe("stopSound", () => mzBeep.stopSound());

    // MZ-700 Screen
    const mz700screen = $("#mz700screen").css("display", "none");
    const canvas = document.createElement("CANVAS");
    mz700screen.get(0).appendChild(canvas);
    mz700screen.mz700scrn("create", { canvas });
    mz700js.transferObject("offscreenCanvas",
        canvas.transferControlToOffscreen());
    mz700screen.find("canvas").css("height", "calc(100% - 1px)");

    // Control panel
    const mz700container = $("#mz700container");
    const ctrlPanel = $("<div/>").attr("id", "control-panel").css("display", "none");
    mz700container.append(ctrlPanel);
    const resizeScreen = function() {
        dock_n_liquid.select($("#liquid-panel-MZ-700").get(0)).layout();
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
        if(ctrlPanel.is(":visible")) {
            const phifBBox = new BBox(ctrlPanel.get(0));
            const phifSize = phifBBox.getSize();
            const phifMargin = new BBox.Size(
                    (containerSize._w - phifSize._w) / 2,
                    innerSize._h - phifSize._h);
            if(phifMargin._w < 0) {
                phifMargin._w = 0;
            }
            if(phifMargin._h < 0) {
                phifMargin._h = 0;
            }
            ctrlPanel.css("margin-left", phifMargin._w + "px")
                .css("margin-top", phifMargin._h + "px");
        }
    };

    /**
     * Show the panel to operate MZ-700.
     * @param {Function} resize resize handler.
     * @returns {undefined}
     */
    const showCtrlPanel = () => {
        if(!ctrlPanel.is(":visible")) {
            ctrlPanel.addClass("hover");
            ctrlPanel.show(0, () => {
                resizeScreen();
            });
        }
    };

    /**
     * Hide the panel to operate MZ-700.
     * @param {Function} resize resize handler.
     * @returns {undefined}
     */
    const hideCtrlPanel = () => {
        if(ctrlPanel.is(":visible")) {
            ctrlPanel.removeClass("hover");
            ctrlPanel.hide(0, ()=> {
                resizeScreen();
            });
        }
    };


    let tidHideCtrlPanel = null;
    const installHideCtrlPanelTimer = () => {
        tidHideCtrlPanel = setTimeout(() => {
            hideCtrlPanel();
            tidHideCtrlPanel = null;
        }, 1000);
    };
    const cancelHideCtrlPanelTimer = () => {
        if(tidHideCtrlPanel) {
            clearTimeout(tidHideCtrlPanel);
            tidHideCtrlPanel = null;
        }
    };
    if(deviceType === "pc") {
        mz700container.mouseenter(() => {
            cancelHideCtrlPanelTimer();
            showCtrlPanel();
            installHideCtrlPanelTimer();
        }).mouseleave(() => {
            cancelHideCtrlPanelTimer();
            hideCtrlPanel();
        });
        ctrlPanel.mouseenter(event => {
            event.stopPropagation();
            cancelHideCtrlPanelTimer();
        }).mouseleave(event =>{
            event.stopPropagation();
            cancelHideCtrlPanelTimer();
            installHideCtrlPanelTimer();
        });
    }

    // Reset Button
    const imgBtnResetOff = await loadImage("./image/btnReset-off.png", "Reset");
    const imgBtnResetOn = await loadImage("./image/btnReset-on.png", "Reset");
    const btnReset = $("<button/>").MZ700ImgButton("create", {
        img: imgBtnResetOff,
    }).click(async () => {
        await mz700js.stop();
        await mz700js.reset();
        await mz700js.start();
        await dataRecorder.MZDataRecorder("updateCmtSlot");
    }).hover(
        () => btnReset.MZ700ImgButton("setImg", imgBtnResetOn),
        () => btnReset.MZ700ImgButton("setImg", imgBtnResetOff)
    );

    // Run/Stop/Step Button
    const imgBtnRunOff = await loadImage("image/btnRun-off.png", "[F8] Run");
    const imgBtnRunOn = await loadImage("image/btnRun-on.png", "[F8] Run");
    const imgBtnStopOff = await loadImage("image/btnStop-off.png", "[F8] Stop");
    const imgBtnStopOn = await loadImage("image/btnStop-on.png", "[F8] Stop");
    const btnStart = $("<button/>").MZ700ImgButton("create", {
        img: imgBtnRunOff,
    }).click(() => {
        _isRunning ? mz700js.stop() : mz700js.start();
    }).hover(
        () => btnStart.MZ700ImgButton("setImg",
                _isRunning ? imgBtnStopOn : imgBtnRunOn),
        () => btnStart.MZ700ImgButton("setImg",
                _isRunning ? imgBtnStopOff : imgBtnRunOff),
    );
    const imgBtnStepOff = await loadImage("image/btnStepIn-off.png", "[F9] Step-In");
    const imgBtnStepOn = await loadImage("image/btnStepIn-on.png", "[F9] Step-In");
    const imgBtnStepDi = await loadImage("image/btnStepIn-disabled.png", "[F9] Step-In");
    const btnStep = $("<button/>").MZ700ImgButton("create", {
        img: imgBtnStepOff,
    }).click( () => mz700js.step() ).hover(
        () => {
            if(!_isRunning) {
                btnStep.MZ700ImgButton("setImg", imgBtnStepOn);
            }
        }, () => {
            if(!_isRunning) {
                btnStep.MZ700ImgButton("setImg", imgBtnStepOff);
            }
        }
    );

    // Operate the emulation state by key
    window.addEventListener("keyup", async event => {
        switch(event.keyCode) {
        case 119://F8 - RUN/STOP
            event.stopPropagation();
            _isRunning ? mz700js.stop() : mz700js.start();
            break;
        case 120://F9 - STEP In
            event.stopPropagation();
            _isRunning ? mz700js.stop() : mz700js.step();
            break;
        }
    });

    // Emulation started
    mz700js.subscribe("start", async () => {
        if(!_isRunning && reg_visibility) {
            await Z80RegViewAutoUpdate(true);
        }
        btnExecImm.prop("disabled", true);
        $(".MZ-700").addClass("running");
        _isRunning = true;
        btnStart.MZ700ImgButton("setImg", imgBtnStopOff);
        btnStep.prop('disabled', 'disabled')
        btnStep.MZ700ImgButton("setImg", imgBtnStepDi);
    });

    // Emulation stopped
    mz700js.subscribe("stop", async () => {
        if(_isRunning && reg_visibility) {
            await Z80RegViewAutoUpdate(false);
        }
        btnExecImm.prop("disabled", false);
        $(".MZ-700").removeClass("running");
        _isRunning = false;
        btnStart.MZ700ImgButton("setImg", imgBtnRunOff);
        btnStep.prop('disabled', '');
        btnStep.MZ700ImgButton("setImg", imgBtnStepOff);
    });

    // Software keyboard
    const keyboard = $("<div/>").css("display", "none").addClass("keyboard");
    ctrlPanel.append(keyboard);
    keyboard.mz700keyboard("create", mz700js);
    if(getDeviceType() === "pc") {
        mz700container.mouseenter(() => {
            keyboard.mz700keyboard("acceptKey", true);
        }).mouseleave(() => {
            keyboard.mz700keyboard("acceptKey", false);
        });
        ctrlPanel.mouseenter(event => {
            event.stopPropagation();
            keyboard.mz700keyboard("acceptKey", true);
        });
    }

    // Create Screen keyboard button.
    const imgBtnScrnKbOff = await loadImage("image/btnKeyboard-off.png", "Open Keyboard");
    const imgBtnScrnKbOn = await loadImage("image/btnKeyboard-on.png", "Close Keyboard");
    const screenKbButton = $("<button/>").ToggleButton("create", {
        img: imgBtnScrnKbOff,
        imgOff: imgBtnScrnKbOff,
        imgOn: imgBtnScrnKbOn,
        alt: "Keyboard",
        on: ()=>keyboard.show(0, resizeScreen),
        off: ()=>keyboard.hide(0, resizeScreen),
    });

    // Create Full screen button.
    const imgBtnFullScrnOff = await loadImage("./image/btnFullscreen-off.png", "Fullscreen");
    const imgBtnFullScrnOn = await loadImage("./image/btnFullscreen-on.png", "Cancel Fullscreen");
    const fullscreenButton = $("<button/>").ToggleButton("create", {
        img: imgBtnFullScrnOff,
        imgOff: imgBtnFullScrnOff,
        imgOn: imgBtnFullScrnOn,
        autoState: false,
        on: async ()=>{
            if(document.fullscreenElement !== document.body) {
                await document.body.requestFullscreen();
                keyboard.mz700keyboard("acceptKey", true);
            }
        },
        off: ()=>{
            if(document.fullscreenElement === document.body) {
                document.exitFullscreen();
            }
        },
    });

    const emulationPanel = $("<div/>").addClass("emulation-panel");
    emulationPanel
        .append($("<span/>").MZSoundControl("create", mzBeep))
        .append(btnStart).append(btnReset).append(btnStep)
        .append($("<span/>").EmuSpeedControl(
            "create", mz700js, MZ700.Z80_CLOCK))
        .append(screenKbButton)
        .append(fullscreenButton);
    ctrlPanel.append(emulationPanel)

    // Data Recorder UI
    const dataRecorder = $("<div/>").MZDataRecorder("create", {
        mz700js,
        onRecPushed: ()=>mz700js.dataRecorder_pushRec(),
        onPlayPushed: ()=>mz700js.dataRecorder_pushPlay(),
        onStopPushed: ()=>mz700js.dataRecorder_pushStop(),
        onEjectPushed: ()=>mz700js.dataRecorder_ejectCmt(),
    });
    // Events handling
    mz700js.subscribe("onStartDataRecorder",
        ()=>dataRecorder.MZDataRecorder("start"));
    mz700js.subscribe("onStopDataRecorder",
        ()=>dataRecorder.MZDataRecorder("stop"));
    ctrlPanel.append(dataRecorder)

    const mztButtons = await new Promise( resolve => {
        requestJsonp("mztList",
            "https://takamin.github.io/MZ-700/mzt/mzt-list.js",
            files => {
                const mztButtons = $("<div/>");
                files.forEach(mzt => {
                    mztButtons.append(
                        $("<button/>").attr("type", "button")
                        .css("padding", 0).css("height", "24px")
                        .css("border", "solid 0px transparent")
                        .css("padding", 0).css("margin", "4px 2px")
                        .append($("<span/>").addClass("mz700scrn")
                            .attr("charSize", "8").attr("padding", "1")
                            .attr("color", mzt.mz700_buttonStyle.color)
                            .attr("bgColor", mzt.mz700_buttonStyle.bgColor)
                            .html(mzt.name))
                        .click(() => {
                            const request = parseRequest();
                            window.location.href =
                                request.path + "?mzt=" + mzt.path;
                        }));
                });
                resolve(mztButtons);
            });
    });
    ctrlPanel.append(mztButtons);

    const dockPanelRight = $("#dock-panel-right").css("display", "none");

    // Register View
    const regview = $("<div/>").Z80RegView("create");
    const wndRegView = $("<div class='register-monitor tool-window close' title='REGISTER'/>");
    dockPanelRight.append(wndRegView);

    let reg_upd_tid = null;
    let reg_visibility = false;
    const Z80RegViewUpdateRegister = async () => {
        const reg = await mz700js.getRegister();
        regview.Z80RegView("updateRegister", reg);
    }
    const Z80RegViewAutoUpdate = async status => {
        if(status) {
            if(!reg_upd_tid) {
                reg_upd_tid = setInterval(()=>Z80RegViewUpdateRegister(), 50);
            }
        } else {
            if(reg_upd_tid) {
                clearInterval(reg_upd_tid);
                reg_upd_tid = null;
            }
            await Z80RegViewUpdateRegister();
        }
    };
    const Z80RegViewVisibility = async status => {
        if(reg_visibility != status) {
            reg_visibility = status;
            if(_isRunning) {
                if(reg_visibility) {
                    await Z80RegViewAutoUpdate(true);
                } else {
                    await Z80RegViewAutoUpdate(false);
                }
            }
        }
    };
    wndRegView
        .append($("<div/>").css("display", "inline-block").append(regview))
        .ToolWindow("create", {
            onOpened: () => Z80RegViewVisibility(true),
            onClosed: () => Z80RegViewVisibility(false),
        });

    // Create dump list
    const dumplist = $("<div/>").dumplist("init", { mz700js: mz700js });
    const wndDumpList = $("<div class='tool-window memory open' title='MEMORY'/>");
    dockPanelRight.append(wndDumpList);
    wndDumpList
        .append(dumplist.dumplist("addrSpecifier"))
        .append(dumplist).ToolWindow("create");

    // Create assemble list
    const asmView = $("<div/>").asmview("create", mz700js);
    const wndAsmList = $("<div  class='tool-window open' title='Z80 ASM'/>");
    dockPanelRight.append(wndAsmList);
    wndAsmList.append(asmView).ToolWindow("create");

    // Show a sample assemble source
    const asmlistMzt = asmView.asmview("newAsmList", "mzt", "PCG-700 sample");
    await asmlistMzt.asmlist("assemble", await new Promise(resolve => {
        $.get("./MZ-700/pcg700-sample.asm", {}, resolve);
    }));

    // Disassemble MONITOR ROM and show that source.
    try {
        const getText = url => {
            return new Promise(resolve => $.get(url, {}, resolve));
        };
        const readme = await getText("./mz_newmon/newmon_readme.txt");
        console.log(readme);
        const commandHelp = await getText("./mz_newmon/newmon_command.txt");
        console.log(commandHelp);
        const comment = [
            ";;;",
            ";;; This is a disassembled list of the MZ-NEW MONITOR",
            ";;; provided from the Marukun's website 'MZ-Memories'",
            ";;; ( http://retropc.net/mz-memories/mz700/ ).",
            ";;; ",
            ";----",
            ...commandHelp.split(/\r*\n/).map(line => `;${line}`),
            ";----",
        ].join("\n");

        const source = comment +  "\n" + Z80.dasmlines(Z80.dasm(
            monitorRom, 0x0000, 0x1000, 0x0000
        )).join("\n") + "\n";

        const monRom = asmView.asmview("newAsmList",
            "monitor-rom", "MZ-700 NEW MONITOR");
        await monRom.asmlist("assemble", source);
    } catch(err) {
        console.error(JSON.stringify(err));
    }

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
    const wndImmExec = $("<div class='tool-window' title='IMM.EXEC.'/>");
    dockPanelRight.append(wndImmExec);
    wndImmExec.append(
        $("<div/>").addClass("imm-exec")
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
    ).ToolWindow("create");

    // Layout
    window.addEventListener("resize", resizeScreen);
    document.addEventListener("fullscreenchange", async () => {
        if(document.fullscreenElement == null) {
            dockPanelHeader.show(0,
                () => fullscreenButton.ToggleButton("setOff"));
            if(deviceType === "pc") {
                await new Promise(
                    resolve => dockPanelRight.show(0, resolve));
                if(wndRegView.ToolWindow("isOpen")) {
                    await Z80RegViewVisibility(true);
                }
            }
        } else {
            dockPanelHeader.hide(0,
                () => fullscreenButton.ToggleButton("setOn"));
            if(deviceType === "pc") {
                await new Promise(
                    resolve => dockPanelRight.hide(0, resolve));
                if(wndRegView.ToolWindow("isOpen")) {
                    await Z80RegViewVisibility(false);
                }
            }
        }
        resizeScreen();
    });

    fullscreenButton.ToggleButton("off");
    switch(deviceType) {
    case "mobile":
        screenKbButton.ToggleButton("on");
        dockPanelRight.remove();
        break;
    case "tablet":
        ctrlPanel.click(event => {
            event.stopPropagation();
            if(ctrlPanel.is(":visible")) {
                hideCtrlPanel();
            } else {
                showCtrlPanel();
            }
        });
        screenKbButton.ToggleButton("off");
        mz700screen.click(event => {
            event.stopPropagation();
            if(ctrlPanel.is(":visible")) {
                hideCtrlPanel();
            } else {
                showCtrlPanel();
            }
        });
        dockPanelRight.remove();
        break;
    case "pc":
        screenKbButton.ToggleButton("off");
        mz700screen.mousemove(event => {
            event.stopPropagation();
            keyboard.mz700keyboard("acceptKey", true);
            showCtrlPanel();
        });
        await new Promise(resolve => dockPanelRight.show(0, resolve));
        break;
    }

    // Convert MZ-700 character
    for(const element of document.querySelectorAll("span.mz700scrn")) {
        window.mz700scrn.convert(element);
    }

    await new Promise(resolve => mz700screen.show(0, resolve));
    resizeScreen();

    await mz700js.reset();
    await mz700js.start();

    // Disassemble MZTape array
    const showMztDisasm = async function(mztape_array) {
        const name = MZ_TapeHeader.get1stFilename(mztape_array) || "(empty)";
        const result = MZ700.disassemble(mztape_array);
        asmView.asmview("name", "mzt", name);
        asmlistMzt.asmlist("text", result.outbuf);
        asmlistMzt.asmlist("writeList",
            result.asmlist, await mz700js.getBreakPoints());
    };

    // Set a cassette tape to data recorder of MZ-700 and
    // load the MZT to memory directly.
    const setMztData = async function(tape_data) {
        await mz700js.stop();
        await mz700js.setCassetteTape(tape_data);
        if(tape_data != null) {
            const mztape_array = MZ_Tape.parseMZT(tape_data);
            await mz700js.loadCassetteTape();
            await showMztDisasm(mztape_array);
            await mz700js.setPC(mztape_array[0].header.addr_exec);
            await mz700js.start();
        }
        await dataRecorder.MZDataRecorder("updateCmtSlot");
    };

    // Accept MZT file to drop to the data recorder and MZ-700 screen
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        const el = dataRecorder.get(0);
        el.addEventListener('dragover', event => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
        }, false);
        el.addEventListener('drop', event => {
            event.stopPropagation();
            event.preventDefault();
            const files = event.dataTransfer.files; // FileList object.
            if(files.length > 0) {
                const f = files[0];
                const reader = new FileReader();
                reader.onload = async () => {
                    const tapeData = new Uint8Array(reader.result);
                    await mz700js.setCassetteTape(tapeData);
                };
                reader.readAsArrayBuffer(f);
            }
        }, false);
        mz700screen.get(0).addEventListener("dragover", event => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy"; // Explicitly show this is a copy.
        }, false);
        mz700screen.get(0).addEventListener("drop", event => {
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

    //<!-- Go to www.addthis.com/dashboard to customize your tools -->
    const addThisBox = $("<div/>").css("height", "48px").css("line-height","48px")
        .append($("<div/>").css("box-sizing", "border-box").css("text-align", "right")
            .addClass("addthis_inline_share_toolbox"));
    const addThisScript = $("<script/>").attr("type", "text/javascript")
        .attr("src", "//s7.addthis.com/js/300/addthis_widget.js#pubid=ra-596c4b9e47c8c585");
    addThisBox.insertBefore($(".emulation-panel"));
    $(document.body).append(addThisScript);

})());
