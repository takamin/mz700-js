window.jQuery = require("jquery");
const $ = window.jQuery;
require("jquery-ui");
require("fullscrn");
const      packageJson = require("../package.json");
const    dock_n_liquid = require("dock-n-liquid");
const             BBox = require("b-box");
const     Z80_assemble = require("../Z80/assembler.js");
const              Z80 = require("../Z80/Z80.js");
const            MZ700 = require("./mz700.js");
const     MZ700EmuBase = require("./mz700-emu-base.js");
const MZ700_MonitorRom = require("./mz700-new-monitor.js");
const          cookies = require("../lib/cookies");
const     requestJsonp = require("../lib/jsonp");
const     parseRequest = require("../lib/parse-request");
const     parseAddress = require("../lib/parse-addr.js");
require("../lib/jquery.mz700-kb.js");
require("../lib/jquery.soundctrl.js");
require("../lib/jquery.Z80-reg.js");
require("../lib/jquery.toggle-button.js");

/**
 * class MZ700Js
 * @constructor
 */
var MZ700Js = function() {
    MZ700EmuBase.call(this);

    // identify user agent
    let ua = navigator.userAgent;
    this.deviceType = null;
    if (ua.indexOf('iPhone') >= 0 || ua.indexOf('iPod') >= 0 ||
        ua.indexOf('Android') >= 0 && ua.indexOf('Mobile') >= 0)
    {
        this.deviceType = "mobile";
    } else if (ua.indexOf('iPad') >= 0 || ua.indexOf('Android') >= 0) {
        this.deviceType = "tablet";
    } else {
        this.deviceType = "pc";
    }

    this.container = $(".MZ-700-body");
    this.screen = this.container.find(".screen");
    this.screen.find("canvas").css("height", "calc(100% - 1px)");
    this.uiElement = $("#human-interface");
    this.mouseMoveTimeoutId = null;
    this.fullscreenElement = document.body;

    // Dock'n'Liquid panels
    this.liquidRoot = dock_n_liquid.select($("#liquid-panel-MZ-700").get(0));
    this.dockPanelHeader = $("#dock-panel-header");
    this.dockPanelRight = $("#dock-panel-right");

    this.request = parseRequest();
};

/**
 * MZ700Js extends MZ700EmuBase.
 * @type {MZ700EmuBase}
 */
MZ700Js.prototype = new MZ700EmuBase();

/**
 * Create emulator on the Web.
 * @async
 * @returns {Promise<undefined>} to sync.
 */
MZ700Js.prototype.create = async function() {

    let title = [
        packageJson.description,"(",
        packageJson.name,
        "@",packageJson.version,")"
    ].join("");
    $("title").html(title);
    $("h1 .mz700scrn").html(title);

    await MZ700EmuBase.prototype.create.call(this, {
        urlPrefix : "./",
        screenElement : document.querySelector(".MZ-700 .screen"),
        mztDroppableElement: document.querySelector(".MZ-700 .cmt-slot"),
        dataRecorderElement: document.querySelector(".MZ-700 .data-recorder"),
    });

    if(this.deviceType !== "pc") {
        this.dockPanelRight.remove();
    }

    dock_n_liquid.init(() => this.resizeScreen() );
    dock_n_liquid.select($(".MZ-700").get(0)).layout();
    window.addEventListener("resize", () => {
        this.liquidRoot.layout();
        this.resizeScreen();
    });

    this.createSoftwareKeyboard();
    this.createDataRecorderControl();
    this.createControlPanel();
    this.createWndRegView();
    this.createWndDumpList();
    await this.createWndAsmList();
    this.createWndImmExec();

    let taskbar = $("#toolwndTaskbar");
    let wndBase = $(".toolwnd:first").parent();
    let updateWndButton = () => {
        wndBase.find(".toolwnd .move-up-button").prop("disabled", false);
        wndBase.find(".toolwnd .move-down-button").prop("disabled", false);
        wndBase.find(".toolwnd:visible:first .move-up-button")
            .prop("disabled", true);
        wndBase.find(".toolwnd:visible:last .move-down-button")
            .prop("disabled", true);
    };
    $(".toolwnd").each(function() {
        let wnd = $(this);
        let wndSw = $("<button/>").html(wnd.attr("title"))
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
        let title = $("<div/>").addClass("titlebar")
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
        let content = $("<div/>").addClass("content").append(wnd.children());
        wnd.append(title).append(content);

        taskbar.append(wndSw);
    });
    updateWndButton();

    await this.createPublicMztLoadingButtons();
    this.setupControlPanel();

    $("span.mz700scrn").each(function() {
        window.mz700scrn.convert(this);
    });

    this.liquidRoot.layout();
    this.resizeScreen();

    await this.reset();

    // Load the MZT file, if specified at QUERY_STRING
    if("mzt" in this.request.parameters) {
        await requestJsonp("loadMZT",
            "https://takamin.github.io/MZ-700/mzt/" + this.request.parameters.mzt + ".js",
            async tape_data => { await this.setMztData(tape_data); });
    }
};

MZ700Js.prototype.updateRegister = function () {
    this.mz700comworker.getRegister(reg => {
        this.regview.Z80RegView("update", reg);
    });
    this.mz700comworker.getRegisterB(regB => {
        this.regview.Z80RegView("update_", regB);
    });
    this.mz700comworker.getIFF1( iff => {
        this.regview.Z80RegView("IFF1", iff);
    });
    this.mz700comworker.getIFF2( iff => {
        this.regview.Z80RegView("IFF2", iff);
    });
    this.mz700comworker.getIM( im => {
        this.regview.Z80RegView("IM", im);
    });
    this.mz700comworker.getHALT( halt => {
        this.regview.Z80RegView("HALT", halt);
    });
};

MZ700Js.prototype.createSoftwareKeyboard = function() {
    let kb = $(".MZ-700 .keyboard").mz700keyboard("create", {
        onStateChange: (strobe, bit, state) => {
            this.mz700comworker.setKeyState(strobe, bit, state, null);
        }
    });
    window.addEventListener("keyStateChanged", event => {
        let matrix = event.matrix;
        let state = event.keyState;
        kb.mz700keyboard("setState", matrix.strobe, matrix.bit, state);
    });
    window.addEventListener("keyup", async event => {
        switch(event.keyCode) {
        case 119://F8 - RUN/STOP
            event.stopPropagation();
            if(this.isRunning) {
                await this.stop();
            } else {
                await this.start();
            }
            return;
        case 120://F9 - STEP OVER
            event.stopPropagation();
            this.stepOver();
            return;
        }
    });
};

MZ700Js.prototype.createDataRecorderControl = function() {
    let dataRecorder = $(this.opt.dataRecorderElement);
    this.btnCmtRec = $("<button/>").attr("type", "button")
        .html("<span style='color:red'>●</span> RECPLAY").click( () => {
            this.cmtMessageArea.empty().html("Recording ...");
            this.mz700comworker.dataRecorder_pushRec( () => { } );
        });
    this.btnCmtPlay = $("<button/>").attr("type", "button")
        .html("<span class='cmtPlayImage'>▼</span> PLAY").click( () => {
            this.mz700comworker.dataRecorder_pushPlay( () => { } );
        });
    this.btnCmtStop = $("<button/>").attr("type", "button")
        .html("<span>■</span> STOP").click( () => {
            this.mz700comworker.dataRecorder_pushStop( () => { } );
        });
    this.btnCmtEject = $("<button/>").attr("type", "button")
        .html("<span>▲</span>EJECT").click( () => {
            this.mz700comworker.dataRecorder_ejectCmt( bytes => {
                this.createCmtDownloadLink(bytes);
            });
        });
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        let el = dataRecorder.get(0);
        el.addEventListener('dragover', event => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
        }, false);
        el.addEventListener('drop', event => {
            event.stopPropagation();
            event.preventDefault();
            let files = event.dataTransfer.files; // FileList object.
            if(files.length > 0) {
                let f = files[0];
                let reader = new FileReader();
                reader.onload = async () => {
                    let tape_data = new Uint8Array(reader.result);
                    await this.setCassetteTape(tape_data);
                    this.createCmtDownloadLink(tape_data);
                };
                reader.readAsArrayBuffer(f);
            }
        }, false);
    }
    this.cmtMessageArea = $("<span/>").addClass("cmt-message").html("(EMPTY)");
    dataRecorder
        .html("CMT: ")
        .attr("title", "Drop MZT file here to load with 'L' command")
        .append(this.cmtMessageArea)
        .append(this.btnCmtRec)
        .append(this.btnCmtPlay)
        .append(this.btnCmtStop)
        .append(this.btnCmtEject);

    window.addEventListener("onStartDataRecorder", () => {
        this.btnCmtRec.prop("disabled", true);
        this.btnCmtEject.prop("disabled", true);
        this.btnCmtStop.prop("disabled", false);
    });

    window.addEventListener("onStopDataRecorder", () => {
        let bytes = this.getCassetteTape();
        this.createCmtDownloadLink(bytes);
        this.btnCmtRec.prop("disabled", false);
        this.btnCmtEject.prop("disabled", false);
        this.btnCmtStop.prop("disabled", true);
    });
};

MZ700Js.prototype.createControlPanel = function() {
    $(".MZ-700 .ctrl-panel")
        .append(this.KeyInState_create())
        .append(this.SoundCtrl_create())
        .append(this.btnStart_create())
        .append(this.btnReset_create())
        .append(this.btnStep_create())
        .append(this.emuSpeedCtrl_create())
        .append(this.createScreenKeyboardButton())
        .append(this.createFullscreenButton());
};

MZ700Js.prototype.KeyInState_create = function() {
    let keyAccptor = $("<span/>")
        .addClass("key-switcher")
        .html("Key-In");
    window.addEventListener("keyinAcceptanceEnabled", () => {
        keyAccptor.addClass("on");
    });
    window.addEventListener("keyinAcceptanceDisabled", () => {
        keyAccptor.removeClass("on");
    });
    return keyAccptor;
};

MZ700Js.prototype.SoundCtrl_create = function() {
    let mute = false;
    if(cookies.hasItem("mute")) {
        mute = (cookies.getItem("mute")=="true");
    }
    let volume = 10;
    if(cookies.hasItem("volume")) {
        volume = parseInt(cookies.getItem("volume"));
    }
    let soundCtrl = $("<span/>").soundctrl("create", {
        "maxVolume": 10,
        "initialVolume": volume,
        "initialMute": mute,
        "onChangeVolume": volume => {
            this.allowToPlaySound();
            if(!soundCtrl.mute) {
                cookies.setItem("volume", volume, Infinity);
            }
            this.sound.setGain(volume / 10);
        },
        "onChangeMute": mute => {
            this.allowToPlaySound();
            cookies.setItem("mute", mute, Infinity);
        },
        "urlIconOn": this.opt.urlPrefix + "image/icon-sound-on.svg",
        "urlIconOff": this.opt.urlPrefix + "image/icon-sound-off.svg",
        "colOn": 'blue', "colOff":"silver"
    });
    return soundCtrl;
};

//
// Reset Button
//
MZ700Js.prototype.btnReset_create = function() {
    let btnReset = $("<button/>").attr("type", "button")
        .addClass("imaged").append(
            $("<img/>").attr("title", "Reset").attr("alt", "Reset"))
        .click(async () => { await this.reset(); });

    let btnReset_hover = () => {
        btnReset.find("img")
            .attr("src", `${this.opt.urlPrefix}image/btnReset-on.png`);
    };

    let btnReset_notHover = () => {
        btnReset.find("img")
            .attr("src", `${this.opt.urlPrefix}image/btnReset-off.png`);
    };

    btnReset.hover(btnReset_hover, btnReset_notHover);
    btnReset_notHover();
    return btnReset;
};

//
// Run/Stop Button
//
MZ700Js.prototype.btnStart_create = function() {
    let btnStart = $("<button/>")
        .attr("type", "button")
        .attr("title", "[F8]")
        .addClass("imaged")
        .click(async () => {
            if(this.isRunning) {
                await this.stop();
            } else {
                await this.start();
            }
        });
    let img = $("<img/>");
    btnStart.append(img);
    let setImg = relURL => {
        img.attr("src", `${this.opt.urlPrefix}${relURL}`);
    };
    let setAlt = caption => {
        img.attr("title", caption).attr("alt", caption);
    };
    btnStart.hover( () => {
        setImg(this.isRunning ?
            "image/btnStop-on.png" :
            "image/btnRun-on.png");
    }, () => {
        setImg(this.isRunning ?
            "image/btnStop-off.png" :
            "image/btnRun-off.png");
    });
    window.addEventListener("mz700started", () => {
        setImg("image/btnStop-off.png");
        setAlt("Stop");
    });
    window.addEventListener("mz700stopped", () => {
        setImg("image/btnRun-off.png");
        setAlt("Run");
    });
    return btnStart;
};

//
// Step-In Button
//
MZ700Js.prototype.btnStep_create = function() {
    let btnStep = $("<button/>").attr("type", "button")
        .attr("title", "[F9]").addClass("imaged")
        .click(async () => {
            await this.stepIn();
        });
    let img = $("<img/>")
        .attr("title", "Step-In")
        .attr("alt", "Step-In");
    btnStep.append(img);
    let setImg = relURL => {
        img.attr("src", `${this.opt.urlPrefix}${relURL}`);
    };
    btnStep.hover(() => {
        if(!this.isRunning) {
            btnStep.prop('disabled', '');
            setImg("image/btnStepIn-on.png");
        }
    }, () => {
        if(!this.isRunning) {
            btnStep.prop('disabled', '');
            setImg("image/btnStepIn-off.png");
        }
    });
    window.addEventListener("mz700started", () => {
        btnStep.prop('disabled', 'disabled')
        setImg("image/btnStepIn-disabled.png");
    });
    window.addEventListener("mz700stopped", () => {
        btnStep.prop('disabled', '');
        setImg("image/btnStepIn-off.png");
    });
    setImg("image/btnStepIn-off.png");
    return btnStep;
};

MZ700Js.prototype.stepIn = async function() {
    this.clearCurrentExecLine();
    await this.execute(1);
    this.scrollToShowPC();
    this.updateRegister();
};

MZ700Js.prototype.stepOver = async function() {
    await this.stepIn();
};

MZ700Js.prototype.emuSpeedCtrl_create = function() {
    let speedSlider = $("<input/>")
        .attr("type", "range").attr("min", 0).attr("max", 1.0).attr("step", 0.01)
        .val(7).bind("change", () => {
            let sliderValue = speedSlider.val();
            let timerInterval = MZ700.DEFAULT_TIMER_INTERVAL / Math.pow(10, sliderValue);
            this.setEmuTimerInterval(timerInterval);
        });
    if(cookies.hasItem("speedSliderValue")) {
        let param = parseFloat(cookies.getItem("speedSliderValue"));
        this.setEmuTimerInterval(param);
    } else {
        this.mz700comworker.getExecutionParameter(timerInterval => {
            this.setEmuTimerInterval(timerInterval);
        });
    }
    window.addEventListener("emulationSpeedUpdated", event => {
        let timerInterval = event.timerInterval;
        let sliderValue = Math.log10(MZ700.DEFAULT_TIMER_INTERVAL / timerInterval);
        speedSlider.val(sliderValue);
        cookies.setItem("speedSliderValue", timerInterval, Infinity);
    });
    return $("<span/>")
        .addClass("speed-control-slider")
        .html("Speed:").append(speedSlider);
};

/**
 * Create Screen keyboard button.
 * @returns {ToggleButton} The ToggleButton widget.
 */
MZ700Js.prototype.createScreenKeyboardButton = function() {
    let screenKeyboardButton = $("<button/>")
        .addClass("imaged").attr("id", "btnToggleScreenKeyboard")
        .append($("<img/>")
            .attr("src", `${this.opt.urlPrefix}image/btnKeyboard-off.png`)
            .attr("title", "Keyboard").attr("alt", "Keyboard"))
        .ToggleButton("create", {
            on: button => {
                button.find("img")
                    .attr("src", `${this.opt.urlPrefix}image/btnKeyboard-on.png`);
                $(".keyboard").show();
                this.resizeScreen();
            },
            off: button => {
                button.find("img")
                    .attr("src", `${this.opt.urlPrefix}image/btnKeyboard-off.png`);
                $(".keyboard").hide();
                this.resizeScreen();
            },
        });
    switch(this.deviceType) {
        case "mobile":
            screenKeyboardButton.ToggleButton("on");
            break;
        case "tablet":
            screenKeyboardButton.ToggleButton("off");
            break;
        case "pc":
            screenKeyboardButton.ToggleButton("off");
            break;
    }
    return screenKeyboardButton;
};

/**
 * Create Full screen button.
 * @returns {ToggleButton} The ToggleButton widget.
 */
MZ700Js.prototype.createFullscreenButton = function() {
    let onclick = () => {
        if(document.fullscreenElement === this.fullscreenElement) {
            document.exitFullscreen().then(() => {
                this.liquidRoot.layout();
                this.resizeScreen();
            });
        } else {
            this.fullscreenElement.requestFullscreen().then(() => {
                this.liquidRoot.layout();
                this.resizeScreen();
                this.acceptKey(true);
            });
        }
    };
    let fullscreenButton = $("<button/>")
        .attr("id", "fullscreenButton").addClass("imaged off")
        .append($("<img/>")
            .attr("src", `${this.opt.urlPrefix}image/btnFullscreen-off.png`)
            .attr("title", "Fullscreen")
            .attr("alt", "Fullscreen"))
        .ToggleButton("create", { autoState: false, on: onclick, off: onclick, });

    document.addEventListener("fullscreenchange", () => {
        if(document.fullscreenElement == null) {
            this.dockPanelHeader.show();
            this.dockPanelRight.show();
            fullscreenButton.ToggleButton("setOff")
                .find("img")
                    .attr("src", `${this.opt.urlPrefix}image/btnFullscreen-off.png`)
                    .attr("title", "Fullscreen")
                    .attr("alt", "Fullscreen");
        } else {
            this.dockPanelHeader.hide();
            this.dockPanelRight.hide();
            fullscreenButton.ToggleButton("setOn")
                .find("img")
                    .attr("src", `${this.opt.urlPrefix}image/btnFullscreen-on.png`)
                    .attr("title", "Exit Fullscreen")
                    .attr("alt", "Exit Fullscreen");
        }
        this.liquidRoot.layout();
        this.resizeScreen();
    });
    return fullscreenButton;
};

MZ700Js.prototype.createWndRegView = function() {
    this.regview = $("<div/>").Z80RegView("init");
    $("#wndRegView").append(
        $("<div/>").css("display", "inline-block")
        .append(this.regview));
    window.addEventListener("mz700started", () => {
        if(!this.reg_upd_tid) {
            this.reg_upd_tid = setInterval(()=>{
                this.updateRegister();
            }, 50);
        }
    });
    window.addEventListener("mz700stopped", () => {
        if(this.reg_upd_tid) {
            clearInterval(this.reg_upd_tid);
            this.reg_upd_tid = null;
            this.updateRegister();
        }
        this.updateRegister();
    });
};

MZ700Js.prototype.createWndDumpList = function() {
    let $dumplist = $("<div/>").dumplist("init")
        .on("querymemory", (event, addr, callback) => {
            this.mz700comworker.readMemory(addr, callback);
        });
    $("#wndDumpList").append(
        $("<div/>")
        .Z80AddressSpecifier("create")
        .on("queryregister", async (event, regName, callback) => {
            let reg = await this.getRegister();
            callback(reg[regName]);
        })
        .on("notifyaddress", (event, address) => {
            $dumplist.dumplist("topAddr", address);
        })
    ).append($dumplist);
};

MZ700Js.prototype.createWndAsmList = async function() {
    $("#wndAsmList").asmview("create")
        .on("setbreak", (e, addr, size, state) => {
            if(state) {
                this.mz700comworker.addBreak(addr, size, null);
            } else {
                this.mz700comworker.removeBreak(addr, size, null);
            }
        });
    window.addEventListener("mz700started", () => {
        this.clearCurrentExecLine();
    });
    window.addEventListener("mz700stopped", () => {
        this.scrollToShowPC();
    });

    // Debugging panel
    await this.addMonitorRomTabPage();
    await this.addSampleAsmTabPage();
};

MZ700Js.prototype.addMonitorRomTabPage = async function() {
    this._asmlistMonitorRom = $("<div/>").asmlist("create").on("assemble",
        async (e, asmsrc) => {
            await this.assemble(asmsrc, this._asmlistMonitorRom);
        });
    $("#wndAsmList").asmview("addAsmList",
        "monitor-rom", "", this._asmlistMonitorRom);
    let asmlist = Z80.dasm(MZ700_MonitorRom.Binary,
        0x0000, 0x1000, 0x0000);
    let dasmlines = Z80.dasmlines(asmlist);
    let outbuf = dasmlines.join("\n") + "\n";
    $("#wndAsmList").asmview("name", "monitor-rom", "MZ-700 NEW MONITOR");
    this._asmlistMonitorRom.asmlist("text", [
        ";;;",
        ";;; This is a disassembled list of the MZ-NEW MONITOR",
        ";;; provided from the Marukun's website 'MZ-Memories'",
        ";;; ( http://retropc.net/mz-memories/mz700/ ).",
        ";;; ",
    ].join("\n") + "\n" + outbuf);
    await this.assemble( outbuf, this._asmlistMonitorRom );
};

MZ700Js.prototype.addSampleAsmTabPage = async function() {
    // Show a sample assemble source
    this._asmlistMzt = $("<div/>").asmlist("create").on("assemble",
        async (e, asmsrc) => {
            await this.assemble(asmsrc, this._asmlistMzt);
        });
    $("#wndAsmList").asmview("addAsmList",
        "mzt", "PCG-700 sample", this._asmlistMzt);
    let sampleSource = $($("textarea.default.source").get(0)).val();
    this._asmlistMzt.asmlist("text", sampleSource);
    await this.assemble( sampleSource, this._asmlistMzt );
};

MZ700Js.prototype.createWndImmExec = function() {
    //
    //直接実行ボタン
    //
    let runImm = src => {
        let bin = Z80_assemble.assemble([src]).obj[0];
        this.mz700comworker.getRegister(async reg => {
            let savedPC = reg.PC;
            let execAddr = await this.writeAsmCode( bin );
            await this.setPC(execAddr);
            await this.execute(1);
            await this.setPC(savedPC);
            this.updateRegister();
        });
    };

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
                .click(function() {
                    let par = $(this).parent();
                    let addrToken = par.find("input.address").val();
                    let addr = parseAddress(addrToken);
                    if(addr != null) {
                        let src = 'ORG ' + addr.HEX(4) + "H\r\n";
                        src += par.find("input.mnemonic").val() + "\r\n";
                        runImm(src);
                    }
                }))
        .append($("<br/>"))
    );
};

/**
 * Create the buttons to download and run the public MZT binary.
 * @async
 * @returns {Promise<undefined>} The promise to synchronize
 */
MZ700Js.prototype.createPublicMztLoadingButtons = async function() {
    await requestJsonp("mztList",
        "https://takamin.github.io/MZ-700/mzt/mzt-list.js",
        files => {
            var mztButtons = $("<div/>");
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
                        window.location.href =
                            this.request.path + "?mzt=" + mzt.path;
                    }));
            });
            $("#human-interface").append(mztButtons);
        });
};

/**
 * Setup screen apearance and behavior by each device type.
 * @returns {undefined}
 */
MZ700Js.prototype.setupControlPanel = function() {

    switch(this.deviceType) {
        case "tablet":
            this.screen.click(event => {
                event.stopPropagation();
                this.toggleCtrlPanel();
            });
            this.uiElement.click( event => {
                event.stopPropagation();
                this.toggleCtrlPanel();
            });
            break;
        case "pc":
            this.showCtrlPanel();
            this.screen.mousemove(event => {
                event.stopPropagation();
                this.acceptKey(true);
                this.showCtrlPanel();
            });
            this.uiElement.mouseenter(event => {
                event.stopPropagation();
                this.acceptKey(true);
                this.cancelCtrlPanelTimeout();
                this.uiElement.show(0, () => {
                    this.resizeScreen();
                    this.resizeScreen();
                });
            });
            this.container.mouseenter(() => {
                this.acceptKey(true);
            }).mouseleave(() => {
                this.acceptKey(false);
                this.hideCtrlPanel();
                this.cancelCtrlPanelTimeout();
            });
            break;
    }
};

/**
 * Show the panel to operate MZ-700.
 * @returns {undefined}
 */
MZ700Js.prototype.showCtrlPanel = function() {
    if(this.mouseMoveTimeoutId) {
        clearTimeout(this.mouseMoveTimeoutId);
    } else {
        this.uiElement.addClass("hover");
        this.uiElement.show(0, () => {
            this.resizeScreen();
            this.resizeScreen();
        });
    }
    this.mouseMoveTimeoutId = setTimeout(() => {
        this.hideCtrlPanel();
        this.mouseMoveTimeoutId = null;
    }, 1000);
};

/**
 * Hide the panel to operate MZ-700.
 * @returns {undefined}
 */
MZ700Js.prototype.hideCtrlPanel = function() {
    this.uiElement.removeClass("hover");
    this.uiElement.hide();
};

/**
 * Cancel the timeout timer of control panel showing.
 * @returns {undefined}
 */
MZ700Js.prototype.cancelCtrlPanelTimeout = function() {
    if(this.mouseMoveTimeoutId) {
        clearTimeout(this.mouseMoveTimeoutId);
        this.mouseMoveTimeoutId = null;
    }
};

/**
 * Toggle the control panel visibility.
 * @returns {undefined}
 */
MZ700Js.prototype.toggleCtrlPanel = function() {
    if(this.uiElement.css("display") !== "none") {
        this.uiElement.hide(0, () => {
            this.resizeScreen();
            this.resizeScreen();
        });
    } else {
        this.uiElement.show(0, () => {
            this.resizeScreen();
            this.resizeScreen();
        });
    }
};

/**
 * Resize the MZ-700 Screen.
 * @returns {undefined}
 */
MZ700Js.prototype.resizeScreen = function() {
    var bboxContainer = new BBox(this.container.get(0));
    var bboxScreen = new BBox(this.screen.get(0));
    var containerSize = bboxContainer.getSize();
    containerSize._h -= bboxScreen.px("border-top-width");
    containerSize._h -= bboxScreen.px("border-bottom-width");

    var orgSize = new BBox.Size(320,200);
    var innerSize = containerSize.getMaxInscribedSize(orgSize);
    var margin = new BBox.Size((containerSize._w - innerSize._w) / 2, 0);
    if(margin._w < 0) {
        margin._w = 0;
    }
    this.screen
        .css("margin-left", margin._w + "px")
        .css("margin-top", margin._h + "px")
        .css("width", innerSize._w + "px")
        .css("height", innerSize._h + "px");

    if(this.uiElement.is(":visible")) {
        var phifBBox = new BBox(this.uiElement.get(0));
        var phifSize = phifBBox.getSize();
        var phifMargin = new BBox.Size(
                (containerSize._w - phifSize._w) / 2,
                innerSize._h - phifSize._h);
        if(phifMargin._w < 0) {
            phifMargin._w = 0;
        }
        if(phifMargin._h < 0) {
            phifMargin._h = 0;
        }
        this.uiElement.css("margin-left", phifMargin._w + "px")
            .css("margin-top", phifMargin._h + "px");
    }
};

//
// Show the next exec line in a window
//
MZ700Js.prototype.scrollToShowPC = function() {
    this.mz700comworker.getRegister(function(reg) {
        if(reg.PC <= 0x1000) {
            $("#wndAsmList").asmview("activate", "monitor-rom");
            this._asmlistMonitorRom.asmlist("setCurrentAddr", reg.PC);
        } else {
            $("#wndAsmList").asmview("activate", "mzt");
            this._asmlistMzt.asmlist("setCurrentAddr", reg.PC);
        }
    });
};

MZ700Js.prototype.clearCurrentExecLine = function() {
    this._asmlistMonitorRom.asmlist("clearCurrentAddr");
    this._asmlistMzt.asmlist("clearCurrentAddr");
};

(new MZ700Js()).create();
