"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("fullscrn");
const b_box_1 = __importDefault(require("b-box"));
const dock_n_liquid_1 = __importDefault(require("dock-n-liquid"));
const mz700_1 = __importDefault(require("./mz700"));
const mz700_scrn_1 = __importDefault(require("../lib/mz700-scrn"));
const mz_beep_1 = __importDefault(require("../lib/mz-beep"));
const mz_tape_1 = __importDefault(require("../lib/mz-tape"));
const mz_tape_header_1 = __importDefault(require("../lib/mz-tape-header"));
const Z80_js_1 = __importDefault(require("../Z80/Z80.js"));
const assembler_1 = __importDefault(require("../Z80/assembler"));
const number_util_1 = __importDefault(require("../lib/number-util"));
const parse_addr_1 = __importDefault(require("../lib/parse-addr"));
const parse_request_1 = __importDefault(require("../lib/parse-request"));
const jsonp_1 = __importDefault(require("../lib/jsonp"));
const user_agent_util_1 = require("../lib/user-agent-util");
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
function loadMonitorROM(filename) {
    return __awaiter(this, void 0, void 0, function* () {
        const monitorRom = yield new Promise(resolve => {
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
        });
        return monitorRom;
    });
}
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
function loadPackageJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch("/mz700-js/package.json");
        if (!response.ok) {
            throw new Error("Fail to load package.json");
        }
        return yield response.json();
    });
}
function createUI(mz700js, mz700screen, canvas) {
    return __awaiter(this, void 0, void 0, function* () {
        const pageRequest = parse_request_1.default();
        mz700screen = $(mz700screen);
        const [packageJson, monitorRom, imgBtnResetOff, imgBtnResetOn, imgBtnRunOff, imgBtnRunOn, imgBtnStopOff, imgBtnStopOn, imgBtnStepOff, imgBtnStepOn, imgBtnStepDi, imgBtnScrnKbOff, imgBtnScrnKbOn, imgBtnFullScrnOff, imgBtnFullScrnOn,] = yield Promise.all([
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
        {
            const { name, version, description } = packageJson;
            const pageTitle = `${description}(${name}@${version})`;
            $("title").html(pageTitle);
            $("h1 .mz700scrn").html(pageTitle);
        }
        mz700js.setMonitorRom(monitorRom);
        mz700js.subscribe("onBreak", () => mz700js.stop());
        const mzBeep = new mz_beep_1.default();
        mz700js.subscribe("startSound", freq => mzBeep.startSound(freq[0]));
        mz700js.subscribe("stopSound", () => mzBeep.stopSound());
        const mz700container = $("#mz700container");
        const ctrlPanel = $("<div/>").attr("id", "control-panel").css("display", "none");
        mz700container.append(ctrlPanel);
        const resizeScreen = () => {
            dock_n_liquid_1.default.select($("#liquid-panel-MZ-700").get(0)).layout();
            const bboxContainer = new b_box_1.default(mz700container.get(0));
            const bboxScreen = new b_box_1.default(mz700screen.get(0));
            const containerSize = bboxContainer.getSize();
            containerSize._h -= bboxScreen.px("border-top-width");
            containerSize._h -= bboxScreen.px("border-bottom-width");
            const orgSize = new b_box_1.default.Size(320, 200);
            const innerSize = containerSize.getMaxInscribedSize(orgSize);
            const margin = new b_box_1.default.Size((containerSize._w - innerSize._w) / 2, 0);
            if (margin._w < 0) {
                margin._w = 0;
            }
            mz700screen
                .css("margin-left", margin._w + "px")
                .css("margin-top", margin._h + "px")
                .css("width", innerSize._w + "px")
                .css("height", innerSize._h + "px");
            if (ctrlPanel.is(":visible")) {
                const phifBBox = new b_box_1.default(ctrlPanel.get(0));
                const phifSize = phifBBox.getSize();
                const phifMargin = new b_box_1.default.Size((containerSize._w - phifSize._w) / 2, innerSize._h - phifSize._h);
                if (phifMargin._w < 0) {
                    phifMargin._w = 0;
                }
                if (phifMargin._h < 0) {
                    phifMargin._h = 0;
                }
                ctrlPanel.css("margin-left", phifMargin._w + "px")
                    .css("margin-top", phifMargin._h + "px");
            }
        };
        const showCtrlPanel = () => {
            if (!ctrlPanel.is(":visible")) {
                ctrlPanel.addClass("hover");
                ctrlPanel.show(0, () => {
                    resizeScreen();
                });
            }
        };
        const hideCtrlPanel = () => {
            if (ctrlPanel.is(":visible")) {
                ctrlPanel.removeClass("hover");
                ctrlPanel.hide(0, () => {
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
            if (tidHideCtrlPanel) {
                clearTimeout(tidHideCtrlPanel);
                tidHideCtrlPanel = null;
            }
        };
        const deviceType = user_agent_util_1.getDeviceType();
        if (deviceType === "pc") {
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
            }).mouseleave(event => {
                event.stopPropagation();
                cancelHideCtrlPanelTimer();
                installHideCtrlPanelTimer();
            });
        }
        const btnReset = $("<button/>").MZ700ImgButton("create", {
            img: imgBtnResetOff,
        }).click(() => __awaiter(this, void 0, void 0, function* () {
            yield mz700js.stop();
            yield mz700js.reset();
            yield mz700js.start();
            yield dataRecorder.MZDataRecorder("updateCmtSlot");
        })).hover(() => btnReset.MZ700ImgButton("setImg", imgBtnResetOn), () => btnReset.MZ700ImgButton("setImg", imgBtnResetOff));
        let _isRunning = false;
        const btnStart = $("<button/>").MZ700ImgButton("create", {
            img: imgBtnRunOff,
        }).click(() => {
            _isRunning ? mz700js.stop() : mz700js.start();
        }).hover(() => btnStart.MZ700ImgButton("setImg", _isRunning ? imgBtnStopOn : imgBtnRunOn), () => btnStart.MZ700ImgButton("setImg", _isRunning ? imgBtnStopOff : imgBtnRunOff));
        const btnStep = $("<button/>").MZ700ImgButton("create", {
            img: imgBtnStepOff,
        }).click(() => mz700js.step()).hover(() => {
            if (!_isRunning) {
                btnStep.MZ700ImgButton("setImg", imgBtnStepOn);
            }
        }, () => {
            if (!_isRunning) {
                btnStep.MZ700ImgButton("setImg", imgBtnStepOff);
            }
        });
        window.addEventListener("keyup", (event) => __awaiter(this, void 0, void 0, function* () {
            if (event.code === "F9") {
                if (event.ctrlKey) {
                    event.stopPropagation();
                    _isRunning ? mz700js.stop() : mz700js.start();
                }
                else if (!event.shiftKey) {
                    event.stopPropagation();
                    _isRunning ? mz700js.stop() : mz700js.step();
                }
            }
        }));
        mz700js.subscribe("start", () => __awaiter(this, void 0, void 0, function* () {
            if (!_isRunning && regVisibility) {
                yield Z80RegViewAutoUpdate(true);
            }
            _isRunning = true;
            $(".MZ-700").addClass("running");
            btnStart.MZ700ImgButton("setImg", imgBtnStopOff);
            btnStep.prop('disabled', 'disabled');
            btnStep.MZ700ImgButton("setImg", imgBtnStepDi);
            asmView.asmview("clearCurrentLine");
            btnExecImm.prop("disabled", true);
        }));
        mz700js.subscribe("stop", () => __awaiter(this, void 0, void 0, function* () {
            if (_isRunning && regVisibility) {
                yield Z80RegViewAutoUpdate(false);
            }
            _isRunning = false;
            $(".MZ-700").removeClass("running");
            btnStart.MZ700ImgButton("setImg", imgBtnRunOff);
            btnStep.prop('disabled', '');
            btnStep.MZ700ImgButton("setImg", imgBtnStepOff);
            const [reg] = yield mz700js.getRegister();
            asmView.asmview("currentLine", reg.PC);
            btnExecImm.prop("disabled", false);
        }));
        const keyboard = $("<div/>").css("display", "none").addClass("keyboard");
        ctrlPanel.append(keyboard);
        keyboard.mz700keyboard("create", mz700js);
        if (user_agent_util_1.getDeviceType() === "pc") {
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
        const screenKbButton = $("<button/>").ToggleButton("create", {
            img: imgBtnScrnKbOff,
            imgOff: imgBtnScrnKbOff,
            imgOn: imgBtnScrnKbOn,
            alt: "Keyboard",
            on: () => keyboard.show(0, resizeScreen),
            off: () => keyboard.hide(0, resizeScreen),
        });
        const fullscreenButton = $("<button/>").ToggleButton("create", {
            img: imgBtnFullScrnOff,
            imgOff: imgBtnFullScrnOff,
            imgOn: imgBtnFullScrnOn,
            autoState: false,
            on: () => __awaiter(this, void 0, void 0, function* () {
                if (document.fullscreenElement !== document.body) {
                    yield document.body.requestFullscreen();
                    keyboard.mz700keyboard("acceptKey", true);
                }
            }),
            off: () => {
                if (document.fullscreenElement === document.body) {
                    document.exitFullscreen();
                }
            },
        });
        const emulationPanel = $("<div/>").addClass("emulation-panel");
        emulationPanel
            .append($("<span/>").MZSoundControl("create", mzBeep))
            .append(btnStart).append(btnReset).append(btnStep)
            .append($("<span/>").EmuSpeedControl("create", mz700js, mz700_1.default.Z80_CLOCK))
            .append(screenKbButton)
            .append(fullscreenButton);
        ctrlPanel.append(emulationPanel);
        const dataRecorder = $("<div/>").MZDataRecorder("create", {
            mz700js,
            onRecPushed: () => mz700js.dataRecorder_pushRec(),
            onPlayPushed: () => mz700js.dataRecorder_pushPlay(),
            onStopPushed: () => mz700js.dataRecorder_pushStop(),
            onEjectPushed: () => mz700js.dataRecorder_ejectCmt(),
        });
        mz700js.subscribe("onStartDataRecorder", () => dataRecorder.MZDataRecorder("start"));
        mz700js.subscribe("onStopDataRecorder", () => dataRecorder.MZDataRecorder("stop"));
        ctrlPanel.append(dataRecorder);
        const mztButtons = yield new Promise(resolve => {
            jsonp_1.default("mztList", "https://takamin.github.io/MZ-700/mzt/mzt-list.js", files => {
                const div = $("<div/>");
                files.forEach(mzt => {
                    div.append($("<button/>").attr("type", "button")
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
        ctrlPanel.append(mztButtons);
        const dockPanelRight = $("#dock-panel-right").css("display", "none");
        const regview = $("<div/>").Z80RegView("create");
        const wndRegView = $("<div class='register-monitor tool-window close' title='REGISTER'/>");
        dockPanelRight.append(wndRegView);
        let regUpdTid = null;
        let regVisibility = false;
        const Z80RegViewUpdateRegister = () => __awaiter(this, void 0, void 0, function* () {
            const [reg, _reg] = yield mz700js.getRegister();
            regview.Z80RegView("updateRegister", [reg, _reg]);
        });
        const Z80RegViewAutoUpdate = (status) => __awaiter(this, void 0, void 0, function* () {
            if (status) {
                if (!regUpdTid) {
                    regUpdTid = setInterval(() => Z80RegViewUpdateRegister(), 50);
                }
            }
            else {
                if (regUpdTid) {
                    clearInterval(regUpdTid);
                    regUpdTid = null;
                }
                yield Z80RegViewUpdateRegister();
            }
        });
        const Z80RegViewVisibility = (status) => __awaiter(this, void 0, void 0, function* () {
            if (regVisibility !== status) {
                regVisibility = status;
                if (_isRunning) {
                    if (regVisibility) {
                        yield Z80RegViewAutoUpdate(true);
                    }
                    else {
                        yield Z80RegViewAutoUpdate(false);
                    }
                }
            }
        });
        wndRegView
            .append($("<div/>").css("display", "inline-block").append(regview))
            .ToolWindow("create", {
            onOpened: () => Z80RegViewVisibility(true),
            onClosed: () => Z80RegViewVisibility(false),
        });
        const dumplist = $("<div/>").dumplist("init", { mz700js });
        const wndDumpList = $("<div class='tool-window memory open' title='MEMORY'/>");
        dockPanelRight.append(wndDumpList);
        wndDumpList
            .append(dumplist.dumplist("addrSpecifier"))
            .append(dumplist).ToolWindow("create");
        const asmView = $("<div/>").asmview("create", {
            onSetBreak: (addr, size, state) => __awaiter(this, void 0, void 0, function* () {
                return (state ?
                    yield mz700js.addBreak(addr, size) :
                    yield mz700js.removeBreak(addr, size));
            })
        });
        const wndAsmList = $("<div class='tool-window open' title='Z80 ASM'/>");
        dockPanelRight.append(wndAsmList);
        wndAsmList.append(asmView).ToolWindow("create");
        const asmlistAssemble = (asmlistObj, asmsrc) => __awaiter(this, void 0, void 0, function* () {
            asmlistObj.asmlist("text", asmsrc);
            const shouldBeResumed = _isRunning;
            if (shouldBeResumed) {
                yield mz700js.stop();
            }
            const assembled = assembler_1.default.assemble([asmsrc]).obj[0];
            yield mz700js.writeAsmCode(assembled);
            asmlistObj.asmlist("writeList", assembled.list, yield mz700js.getBreakPoints());
            if (shouldBeResumed) {
                yield mz700js.start();
            }
        });
        const asmlistMzt = asmView.asmview("newAsmList", "mzt", "PCG-700 sample");
        const asmlistSrc = yield new Promise(resolve => $.get("./MZ-700/pcg700-sample.asm", {}, resolve));
        yield asmlistAssemble(asmlistMzt, asmlistSrc);
        const getText = (url) => {
            return new Promise(resolve => $.get(url, {}, resolve));
        };
        const readme = yield getText("./mz_newmon/newmon_readme.txt");
        console.log(readme);
        const commandHelp = yield getText("./mz_newmon/newmon_command.txt");
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
        const source = comment + "\n" + Z80_js_1.default.dasmlines(Z80_js_1.default.dasm(monitorRom, 0x0000, 0x1000, 0x0000)).join("\n") + "\n";
        const monRom = asmView.asmview("newAsmList", "monitor-rom", "MZ-700 NEW MONITOR");
        yield asmlistAssemble(monRom, source);
        const btnExecImm = $("<button/>").attr("type", "button").html("Execute")
            .click(function () {
            return __awaiter(this, void 0, void 0, function* () {
                const par = $(this).parent();
                const addrToken = par.find("input.address").val();
                const addr = parse_addr_1.default.parseAddress(addrToken);
                if (addr != null) {
                    let src = 'ORG ' + number_util_1.default.HEX(addr, 4) + "H\r\n";
                    src += par.find("input.mnemonic").val() + "\r\n";
                    const bin = assembler_1.default.assemble([src]).obj[0];
                    const [reg] = yield mz700js.getRegister();
                    const execAddr = yield mz700js.writeAsmCode(bin);
                    yield mz700js.setPC(execAddr);
                    yield mz700js.step();
                    yield mz700js.setPC(reg.PC);
                }
            });
        });
        const wndImmExec = $("<div class='tool-window' title='IMM.EXEC.'/>");
        dockPanelRight.append(wndImmExec);
        wndImmExec.append($("<div/>").addClass("imm-exec")
            .css("padding", "15px 5px")
            .append($("<label/>")
            .css("display", "inline-block").css("width", "80px")
            .css("text-align", "right").css("padding-right", "10px")
            .html("Address"))
            .append($("<input/>")
            .attr("type", "text").attr("value", "CF00h")
            .addClass("address"))
            .append($("<br/>"))
            .append($("<label/>")
            .css("display", "inline-block").css("width", "80px")
            .css("text-align", "right").css("padding-right", "10px")
            .html("Mnemonic"))
            .append($("<input/>")
            .attr("type", "text").attr("value", "NOP")
            .addClass("mnemonic"))
            .append(btnExecImm)
            .append($("<br/>"))).ToolWindow("create");
        const dockPanelHeader = $("#dock-panel-header");
        window.addEventListener("resize", resizeScreen);
        document.addEventListener("fullscreenchange", () => __awaiter(this, void 0, void 0, function* () {
            if (document.fullscreenElement == null) {
                dockPanelHeader.show(0, () => fullscreenButton.ToggleButton("setOff"));
                if (deviceType === "pc") {
                    yield new Promise(resolve => dockPanelRight.show(0, resolve));
                    if (wndRegView.ToolWindow("isOpen")) {
                        yield Z80RegViewVisibility(true);
                    }
                }
            }
            else {
                dockPanelHeader.hide(0, () => fullscreenButton.ToggleButton("setOn"));
                if (deviceType === "pc") {
                    yield new Promise(resolve => dockPanelRight.hide(0, resolve));
                    if (wndRegView.ToolWindow("isOpen")) {
                        yield Z80RegViewVisibility(false);
                    }
                }
            }
            resizeScreen();
        }));
        const readBinFile = (file) => {
            return new Promise((resolve, reject) => {
                try {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result);
                    };
                    reader.readAsArrayBuffer(file);
                }
                catch (err) {
                    reject(err);
                }
            });
        };
        const readTextFile = (file) => {
            return new Promise((resolve, reject) => {
                try {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsText(file);
                }
                catch (err) {
                    reject(err);
                }
            });
        };
        const getOnLoadHandler = (filename, onloadHandlers) => {
            const ext = filename.replace(/^.*\./, "").toLowerCase();
            const types = Object.keys(onloadHandlers);
            const index = types.map(type => type.toLowerCase()).indexOf(ext);
            if (index >= 0) {
                const type = types[index];
                return onloadHandlers[type];
            }
            return null;
        };
        const setMztData = (mz700, tapeData, execAddr) => __awaiter(this, void 0, void 0, function* () {
            yield mz700.stop();
            yield mz700.setCassetteTape(tapeData);
            yield mz700.loadCassetteTape();
            yield mz700.setPC(execAddr);
            yield mz700.start();
        });
        const showMztDisasm = (mztArray) => __awaiter(this, void 0, void 0, function* () {
            const name = mz_tape_header_1.default.get1stFilename(mztArray) || "(empty)";
            const result = mz700_1.default.disassemble(mztArray);
            asmView.asmview("name", "mzt", name);
            asmlistMzt.asmlist("text", result.outbuf);
            asmlistMzt.asmlist("writeList", result.asmlist, yield mz700js.getBreakPoints());
            yield dataRecorder.MZDataRecorder("updateCmtSlot");
        });
        const setMztAndRun = (tapeData) => __awaiter(this, void 0, void 0, function* () {
            const mztArray = mz_tape_1.default.parseMZT(tapeData);
            yield showMztDisasm(mztArray);
            yield setMztData(mz700js, tapeData, mztArray[0].header.addrExec);
        });
        const setupDragDrop = (element, onloadHandlers) => {
            element.addEventListener("dragenter", (event) => __awaiter(this, void 0, void 0, function* () {
                event.stopPropagation();
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
            }), false);
            element.addEventListener('drop', (event) => __awaiter(this, void 0, void 0, function* () {
                event.stopPropagation();
                event.preventDefault();
                try {
                    const file = Array.from(event.dataTransfer.files).shift();
                    if (file) {
                        const onload = getOnLoadHandler(file.name, onloadHandlers);
                        if (onload) {
                            yield onload(file);
                        }
                    }
                }
                catch (err) {
                    console.error(`Error: ${err.stack}`);
                }
            }), false);
        };
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            setupDragDrop(dataRecorder.get(0), {
                "MZT": (tapeData) => __awaiter(this, void 0, void 0, function* () { return yield mz700js.setCassetteTape(tapeData); }),
            });
            const mztFileLoader = (file) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const arrayBuffer = yield readBinFile(file);
                    if (arrayBuffer) {
                        const mzt = new Uint8Array(arrayBuffer);
                        yield setMztAndRun(Array.from(mzt));
                    }
                }
                catch (err) {
                    console.error(`Error: Loading file ${file.name} ${err.message}`);
                }
            });
            const asmFileLoader = (file) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const src = yield readTextFile(file);
                    const obj = assembler_1.default.assemble([src]);
                    const hdr = mz_tape_header_1.default.createNew();
                    hdr.setFilename(file.name);
                    hdr.setAddrLoad(obj.minAddr);
                    hdr.setAddrExec(obj.minAddr);
                    hdr.setFilesize(obj.buffer.length);
                    const mzt = Buffer.from(hdr.buffer.concat(obj.buffer));
                    yield setMztAndRun(Array.from(mzt));
                }
                catch (err) {
                    console.error(`Error: Loading file ${file.name} ${err.message}`);
                }
                return;
            });
            setupDragDrop(canvas, {
                "MZT": mztFileLoader,
                "M12": mztFileLoader,
                "ASM": asmFileLoader,
            });
        }
        fullscreenButton.ToggleButton("off");
        switch (deviceType) {
            case "mobile":
                screenKbButton.ToggleButton("on");
                dockPanelRight.remove();
                break;
            case "tablet":
                ctrlPanel.click(event => {
                    event.stopPropagation();
                    if (ctrlPanel.is(":visible")) {
                        hideCtrlPanel();
                    }
                    else {
                        showCtrlPanel();
                    }
                });
                screenKbButton.ToggleButton("off");
                mz700screen.click(event => {
                    event.stopPropagation();
                    if (ctrlPanel.is(":visible")) {
                        hideCtrlPanel();
                    }
                    else {
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
                yield new Promise(resolve => dockPanelRight.show(0, resolve));
                break;
        }
        for (const element of document.querySelectorAll("span.mz700scrn")) {
            mz700_scrn_1.default.convert(element);
        }
        yield new Promise(resolve => mz700screen.show(0, resolve));
        resizeScreen();
        yield mz700js.reset();
        yield mz700js.start();
        if ("mzt" in pageRequest.parameters) {
            const filename = pageRequest.parameters["mzt"];
            const url = `https://takamin.github.io/MZ-700/mzt/${filename}.js`;
            const tapeData = yield jsonp_1.default("loadMZT", url);
            if (tapeData) {
                yield setMztAndRun(tapeData);
            }
        }
    });
}
exports.default = module.exports = {
    loadMonitorROM,
    createUI,
};
//# sourceMappingURL=mz700-web-ui.js.map