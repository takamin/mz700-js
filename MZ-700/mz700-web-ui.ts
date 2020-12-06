"use strict";
/* tslint:disable: no-var-requires no-console */
require("fullscrn");
import BBox from "b-box";
import dock_n_liquid from "dock-n-liquid";

import MZ700 from "./mz700";
import mz700scrn from "../lib/mz700-scrn";
import MZBeep from "../lib/mz-beep";
import MZ_Tape from "../lib/mz-tape";
import MZ_TapeHeader from "../lib/mz-tape-header";
import Z80 from "../Z80/Z80.js";
import Z80_assemble from "../Z80/assembler";

import NumberUtil from "../lib/number-util";
import parseAddress from "../lib/parse-addr";
import parseRequest from "../lib/parse-request";
import requestJsonp from "../lib/jsonp";
import {getDeviceType} from "../lib/user-agent-util";

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

type MZ700ImgButton = JQuery<HTMLElement> & { MZ700ImgButton: (method:string, ...any) => MZ700ImgButton };
type mz700keyboard = JQuery<HTMLElement> & { mz700keyboard: (method:string, ...any) => mz700keyboard };
type ToggleButton = JQuery<HTMLElement> & { ToggleButton: (method:string, ...any) => ToggleButton };
type MZSoundControl = JQuery<HTMLElement> & { MZSoundControl: (method:string, ...any) => MZSoundControl };
type EmuSpeedControl = JQuery<HTMLElement> & { EmuSpeedControl: (method:string, ...any) => EmuSpeedControl };
type MZDataRecorder = JQuery<HTMLElement> & { MZDataRecorder: (method:string, ...any) => MZDataRecorder };
type Z80RegView = JQuery<HTMLElement> & { Z80RegView: (method:string, ...any) => Z80RegView };
type ToolWindow = JQuery<HTMLElement> & { ToolWindow: (method:string, ...any) => ToolWindow };
type dumplist = JQuery<HTMLElement> & { dumplist: (method:string, ...any) => dumplist };
type asmview = JQuery<HTMLElement> & {
    asmview: (method:string, ...any) => asmview,
    asmlist: (method:string, ...any) => asmview,
};

/**
 * MONITOR ROM を読み込む。
 * @param {string} filename ROM filename
 * @return {Array<number>} Uint8Arrayを配列に変換したもの
 */
async function loadMonitorROM(filename):Promise<number[]> {
    const monitorRom = await new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `./mz_newmon/ROMS/${filename}`, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = () => {
            const arrayBuffer = xhr.response;
            if (arrayBuffer) {
                const byteArray = Array.from(new Uint8Array(arrayBuffer));
                resolve(byteArray);
            }
        };
        xhr.send(null);
    }) as number[];
    return monitorRom;
}

/**
 * Load an IMG element.
 * @param {string} src source attribute value.
 * @param {string|null} alt alt attribute value.
 * @param {any} width (Optional) Width attribute value.
 * @param {any} height (Optional) Height attibute value.
 * @returns {Promise<Image>} a promise to be resolved by image element.
 */
function loadImage(src, alt, width?, height?) {
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

async function loadPackageJson():Promise<{name:string, version:string, description:string}> {
    const response = await fetch("/mz700-js/package.json");
    if(!response.ok) {
        throw new Error("Fail to load package.json");
    }
    return await response.json();
}

async function createUI(mz700js, mz700screen, canvas) {
    const pageRequest = parseRequest();
    mz700screen = $(mz700screen);

    const [
        packageJson,
        monitorRom,
        imgBtnResetOff,
        imgBtnResetOn,
        imgBtnRunOff,
        imgBtnRunOn,
        imgBtnStopOff,
        imgBtnStopOn,
        imgBtnStepOff,
        imgBtnStepOn,
        imgBtnStepDi,
        imgBtnScrnKbOff,
        imgBtnScrnKbOn,
        imgBtnFullScrnOff,
        imgBtnFullScrnOn,
    ] = await Promise.all([
        loadPackageJson(),
        loadMonitorROM("NEWMON7.ROM"),
        loadImage("image/btnReset-off.png", "Reset"),
        loadImage("image/btnReset-on.png", "Reset"),
        loadImage("image/btnRun-off.png", "[Ctrl]+[F9] Run"),
        loadImage("image/btnRun-on.png", "[Ctrl]+[F9] Run"),
        loadImage("image/btnStop-off.png", "[Ctrl]+[F9] Stop"),
        loadImage("image/btnStop-on.png", "[Ctrl]+[F9] Stop"),
        loadImage("image/btnStepIn-off.png", "[F9] Step"),
        loadImage("image/btnStepIn-on.png", "[F9] Step"),
        loadImage("image/btnStepIn-disabled.png", "[F9] Step"),
        loadImage("image/btnKeyboard-off.png", "Open Keyboard"),
        loadImage("image/btnKeyboard-on.png", "Close Keyboard"),
        loadImage("image/btnFullscreen-off.png", "Fullscreen"),
        loadImage("image/btnFullscreen-on.png", "Cancel Fullscreen"),
    ]);

    // Set module version to the page title
    {
        const {name, version, description} = packageJson as {name:string, version:string, description:string};
        const pageTitle = `${description}(${name}@${version})`;
        $("title").html(pageTitle);
        $("h1 .mz700scrn").html(pageTitle);
    }

    mz700js.setMonitorRom(monitorRom);

    // Stop on break point
    mz700js.subscribe("onBreak", ()=> mz700js.stop());

    // MZ-700 Beep sound
    const mzBeep = new MZBeep();
    mz700js.subscribe("startSound", freq => mzBeep.startSound(freq[0]));
    mz700js.subscribe("stopSound", () => mzBeep.stopSound());

    // Control panel
    const mz700container = $("#mz700container");
    const ctrlPanel = $("<div/>").attr("id", "control-panel").css("display", "none");
    mz700container.append(ctrlPanel);

    const resizeScreen = () => {
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

    const deviceType = getDeviceType();
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
    const btnReset = ($("<button/>") as MZ700ImgButton).MZ700ImgButton("create", {
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

    // MZ-700 Running status
    let _isRunning = false;

    // Run/Stop/Step Button
    const btnStart = ($("<button/>") as MZ700ImgButton).MZ700ImgButton("create", {
        img: imgBtnRunOff,
    }).click(() => {
        _isRunning ? mz700js.stop() : mz700js.start();
    }).hover(
        () => btnStart.MZ700ImgButton("setImg",
                _isRunning ? imgBtnStopOn : imgBtnRunOn),
        () => btnStart.MZ700ImgButton("setImg",
                _isRunning ? imgBtnStopOff : imgBtnRunOff),
    );
    const btnStep = ($("<button/>") as MZ700ImgButton).MZ700ImgButton("create", {
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
        if(event.code === "F9") {
            if(event.ctrlKey) {
                event.stopPropagation();
                _isRunning ? mz700js.stop() : mz700js.start();
            } else if(!event.shiftKey) {
                event.stopPropagation();
                _isRunning ? mz700js.stop() : mz700js.step();
            }
        }
    });

    // Emulation started
    mz700js.subscribe("start", async () => {
        if(!_isRunning && regVisibility) {
            await Z80RegViewAutoUpdate(true);
        }
        _isRunning = true;

        $(".MZ-700").addClass("running");

        btnStart.MZ700ImgButton("setImg", imgBtnStopOff);
        btnStep.prop('disabled', 'disabled')
        btnStep.MZ700ImgButton("setImg", imgBtnStepDi);

        asmView.asmview("clearCurrentLine");

        btnExecImm.prop("disabled", true);
    });

    // Emulation stopped
    mz700js.subscribe("stop", async () => {
        if(_isRunning && regVisibility) {
            await Z80RegViewAutoUpdate(false);
        }
        _isRunning = false;

        $(".MZ-700").removeClass("running");

        btnStart.MZ700ImgButton("setImg", imgBtnRunOff);
        btnStep.prop('disabled', '');
        btnStep.MZ700ImgButton("setImg", imgBtnStepOff);

        const [reg] = await mz700js.getRegister();
        asmView.asmview("currentLine", reg.PC);

        btnExecImm.prop("disabled", false);
    });

    // Software keyboard
    const keyboard = $("<div/>").css("display", "none").addClass("keyboard") as mz700keyboard;
    ctrlPanel.append(keyboard);
    (keyboard as mz700keyboard).mz700keyboard("create", mz700js);
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
    const screenKbButton = ($("<button/>") as ToggleButton).ToggleButton("create", {
        img: imgBtnScrnKbOff,
        imgOff: imgBtnScrnKbOff,
        imgOn: imgBtnScrnKbOn,
        alt: "Keyboard",
        on: ()=>keyboard.show(0, resizeScreen),
        off: ()=>keyboard.hide(0, resizeScreen),
    });

    // Create Full screen button.
    const fullscreenButton = ($("<button/>") as ToggleButton).ToggleButton("create", {
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
        .append(($("<span/>") as MZSoundControl).MZSoundControl("create", mzBeep))
        .append(btnStart).append(btnReset).append(btnStep)
        .append(($("<span/>") as EmuSpeedControl).EmuSpeedControl(
            "create", mz700js, MZ700.Z80_CLOCK))
        .append(screenKbButton)
        .append(fullscreenButton);
    ctrlPanel.append(emulationPanel)

    // Data Recorder UI
    const dataRecorder = ($("<div/>") as MZDataRecorder).MZDataRecorder("create", {
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
                const div = $("<div/>");
                files.forEach(mzt => {
                    div.append(
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
                            window.location.href =
                                pageRequest.path + "?mzt=" + mzt.path;
                        }));
                });
                resolve(div);
            });
    });
    ctrlPanel.append(mztButtons as JQuery<HTMLElement>);

    const dockPanelRight = $("#dock-panel-right").css("display", "none");

    // Register View
    const regview = ($("<div/>") as Z80RegView).Z80RegView("create");
    const wndRegView = $("<div class='register-monitor tool-window close' title='REGISTER'/>");
    dockPanelRight.append(wndRegView);

    let regUpdTid = null;
    let regVisibility = false;
    const Z80RegViewUpdateRegister = async () => {
        const [reg, _reg] = await mz700js.getRegister();
        regview.Z80RegView("updateRegister", [reg, _reg]);
    }
    const Z80RegViewAutoUpdate = async status => {
        if(status) {
            if(!regUpdTid) {
                regUpdTid = setInterval(()=>Z80RegViewUpdateRegister(), 50);
            }
        } else {
            if(regUpdTid) {
                clearInterval(regUpdTid);
                regUpdTid = null;
            }
            await Z80RegViewUpdateRegister();
        }
    };
    const Z80RegViewVisibility = async status => {
        if(regVisibility !== status) {
            regVisibility = status;
            if(_isRunning) {
                if(regVisibility) {
                    await Z80RegViewAutoUpdate(true);
                } else {
                    await Z80RegViewAutoUpdate(false);
                }
            }
        }
    };
    (wndRegView
        .append($("<div/>").css("display", "inline-block").append(regview)) as ToolWindow)
        .ToolWindow("create", {
            onOpened: () => Z80RegViewVisibility(true),
            onClosed: () => Z80RegViewVisibility(false),
        });

    // Create dump list
    const dumplist = ($("<div/>") as dumplist).dumplist("init", {mz700js});
    const wndDumpList = $("<div class='tool-window memory open' title='MEMORY'/>");
    dockPanelRight.append(wndDumpList);
    (wndDumpList
        .append(dumplist.dumplist("addrSpecifier"))
        .append(dumplist) as ToolWindow).ToolWindow("create");

    // Create assemble list
    const asmView = ($("<div/>") as asmview).asmview("create", {
        onSetBreak: async (addr, size, state) =>
            (state ?
                await mz700js.addBreak(addr, size) :
                await mz700js.removeBreak(addr, size))
    });

    const wndAsmList = $("<div class='tool-window open' title='Z80 ASM'/>");
    dockPanelRight.append(wndAsmList);
    (wndAsmList.append(asmView) as ToolWindow).ToolWindow("create");

    const asmlistAssemble = async (asmlistObj, asmsrc) => {
        asmlistObj.asmlist("text", asmsrc);
        const shouldBeResumed = _isRunning;
        if(shouldBeResumed) {
            await mz700js.stop();
        }
        const assembled = Z80_assemble.assemble([asmsrc]).obj[0];
        await mz700js.writeAsmCode( assembled );
        asmlistObj.asmlist("writeList",
            assembled.list,
            await mz700js.getBreakPoints());
        if(shouldBeResumed) {
            await mz700js.start();
        }
    };

    // Show a sample assemble source
    const asmlistMzt = asmView.asmview("newAsmList", "mzt", "PCG-700 sample");
    const asmlistSrc = await new Promise(resolve =>
        $.get("./MZ-700/pcg700-sample.asm", {}, resolve));
    await asmlistAssemble(asmlistMzt, asmlistSrc);

    // Disassemble MONITOR ROM and show that source.
    const getText = (url:string):Promise<string> => {
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
        monitorRom as number[], 0x0000, 0x1000, 0x0000
    )).join("\n") + "\n";

    const monRom = asmView.asmview("newAsmList",
        "monitor-rom", "MZ-700 NEW MONITOR");
    await asmlistAssemble(monRom, source);

    // 直接実行ボタン
    const btnExecImm = $("<button/>").attr("type", "button").html("Execute")
        .click(async function() {
            const par = $(this).parent();
            const addrToken = par.find("input.address").val() as string;
            const addr = parseAddress.parseAddress(addrToken);
            if(addr != null) {
                let src = 'ORG ' + NumberUtil.HEX(addr, 4) + "H\r\n";
                src += par.find("input.mnemonic").val() + "\r\n";
                const bin = Z80_assemble.assemble([src]).obj[0];
                const [reg] = await mz700js.getRegister();
                const execAddr = await mz700js.writeAsmCode( bin );
                await mz700js.setPC(execAddr);
                await mz700js.step();
                await mz700js.setPC(reg.PC);
            }
        });
    const wndImmExec = $("<div class='tool-window' title='IMM.EXEC.'/>");
    dockPanelRight.append(wndImmExec);
    (wndImmExec.append(
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
    ) as ToolWindow).ToolWindow("create");

    // Layout
    const dockPanelHeader = $("#dock-panel-header");
    window.addEventListener("resize", resizeScreen);
    document.addEventListener("fullscreenchange", async () => {
        if(document.fullscreenElement == null) {
            dockPanelHeader.show(0,
                () => fullscreenButton.ToggleButton("setOff"));
            if(deviceType === "pc") {
                await new Promise(
                    resolve => dockPanelRight.show(0, resolve));
                if((wndRegView as ToolWindow).ToolWindow("isOpen")) {
                    await Z80RegViewVisibility(true);
                }
            }
        } else {
            dockPanelHeader.hide(0,
                () => fullscreenButton.ToggleButton("setOn"));
            if(deviceType === "pc") {
                await new Promise(
                    resolve => dockPanelRight.hide(0, resolve));
                if((wndRegView as ToolWindow).ToolWindow("isOpen")) {
                    await Z80RegViewVisibility(false);
                }
            }
        }
        resizeScreen();
    });

    // Accept MZT file to drop to the data recorder and MZ-700 screen

    const readBinFile = (file:Blob):Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                reader.onload = () => {
                    resolve(reader.result as ArrayBuffer);
                };
                reader.readAsArrayBuffer(file);
            } catch(err) {
                reject(err);
            }
        });
    };

    const readTextFile = (file:Blob):Promise<string|ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsText(file);
            } catch(err) {
                reject(err);
            }
        });
    };

    const getOnLoadHandler = (filename, onloadHandlers) => {
        const ext = filename.replace(/^.*\./, "").toLowerCase();
        const types = Object.keys(onloadHandlers);
        const index = types.map(type => type.toLowerCase()).indexOf(ext);
        if(index >= 0) {
            const type = types[index];
            return onloadHandlers[type];
        }
        return null;
    };

    // Set a cassette tape to data recorder of MZ-700 and
    // load the MZT to memory directly.
    const setMztData = async (mz700, tapeData, execAddr) => {
        await mz700.stop();
        await mz700.setCassetteTape(tapeData);
        await mz700.loadCassetteTape();
        await mz700.setPC(execAddr);
        await mz700.start();
    };

    // Disassemble MZTape array
    const showMztDisasm = async (mztArray) => {
        const name = MZ_TapeHeader.get1stFilename(mztArray) || "(empty)";
        const result = MZ700.disassemble(mztArray);
        asmView.asmview("name", "mzt", name);
        asmlistMzt.asmlist("text", result.outbuf);
        asmlistMzt.asmlist("writeList",
            result.asmlist, await mz700js.getBreakPoints());
        await dataRecorder.MZDataRecorder("updateCmtSlot");
    };

    const setMztAndRun = async tapeData => {
        const mztArray = MZ_Tape.parseMZT(tapeData);
        await showMztDisasm(mztArray);
        await setMztData(mz700js, tapeData,
            mztArray[0].header.addrExec);
    };

    const setupDragDrop = (element, onloadHandlers) => {
        element.addEventListener("dragenter", async event => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        }, false);
        element.addEventListener('drop', async event => {
            event.stopPropagation();
            event.preventDefault();
            try {
                const file = Array.from(event.dataTransfer.files).shift() as File;
                if(file) {
                    const onload = getOnLoadHandler(file.name, onloadHandlers);
                    if(onload) {
                        await onload(file);
                    }
                }
            } catch(err) {
                console.error(`Error: ${err.stack}`);
            }
        }, false);
    };

    if (window.File && window.FileReader && window.FileList && window.Blob) {
        setupDragDrop(dataRecorder.get(0), {
            "MZT": async tapeData => await mz700js.setCassetteTape(tapeData),
        });
        const mztFileLoader = async file => {
            try {
                const arrayBuffer = await readBinFile(file);
                if(arrayBuffer) {
                    const mzt = new Uint8Array(arrayBuffer);
                    await setMztAndRun(Array.from(mzt));
                }
            } catch(err) {
                console.error(`Error: Loading file ${file.name} ${err.message}`);
            }
        };
        const asmFileLoader = async (file:File):Promise<undefined> => {
            try {
                const src = await readTextFile(file) as string;
                const obj = Z80_assemble.assemble([src]);
                const hdr = MZ_TapeHeader.createNew();
                hdr.setFilename(file.name);
                hdr.setAddrLoad(obj.minAddr);
                hdr.setAddrExec(obj.minAddr);
                hdr.setFilesize(obj.buffer.length);
                const mzt = Buffer.from(hdr.buffer.concat(obj.buffer));
                await setMztAndRun(Array.from(mzt));
            } catch(err) {
                console.error(`Error: Loading file ${file.name} ${err.message}`);
            }
            return;
        };
        setupDragDrop(canvas, {
            "MZT": mztFileLoader,
            "M12": mztFileLoader,
            "ASM": asmFileLoader,
        });
    }

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
        mz700scrn.convert(element as HTMLElement);
    }

    await new Promise(resolve => mz700screen.show(0, resolve));
    resizeScreen();

    await mz700js.reset();
    await mz700js.start();

    // Load MZT file when the filename is included in URL
    if("mzt" in pageRequest.parameters) {
        /* tslint:disable:no-string-literal */
        const filename = pageRequest.parameters["mzt"];
        const url = `https://takamin.github.io/MZ-700/mzt/${filename}.js`;
        const tapeData = await requestJsonp("loadMZT", url);
        if(tapeData) {
            await setMztAndRun(tapeData);
        }
    }
}
export default module.exports = {
    loadMonitorROM,
    createUI,
};
