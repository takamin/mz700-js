/* global Uint8Array */
const $ = require("jquery");
require("../lib/context.js");
require("../lib/ex_number.js");
const TransWorker = require('transworker');
const Z80_assemble = require("../Z80/assembler.js");
const MZ_TapeHeader = require('../MZ-700/mz-tape-header');
const MZ700 = require("../MZ-700/emulator.js");
const MZ700_Sound = require("../MZ-700/sound.js");
const MMIO = require("../MZ-700/mmio");
const mz700cg = require("../lib/mz700cg.js");
const parseAddress = require("../lib/parse-addr.js");
require("../lib/jquery.asmview.js");
require("../lib/jquery.soundctrl.js");
require("../lib/jquery.Z80-mem.js");
require("../lib/jquery.Z80-reg.js");
require("../lib/jquery.mz700scrn");
require("../lib/jquery.MZ-700-kb.js");

const cookies = require("../lib/cookies");

const MZ700Js = function() {
    this.opt = {
        urlPrefix: "",
        screenElement: null,
        mztDroppableElement: null,
        controlPanelElement: null,
        dataRecorderElement: null,
        keyboardElement: null,
    };
    this.isRunning = false;
    this.scrn = null;
    this.sound = null;
    this.keyAcceptanceState = false;
    this.keystates = {};
};
MZ700Js.create = function(opt) {
    let obj = new MZ700Js();
    obj.create(opt);
    return obj;
};
MZ700Js.prototype.create = async function(opt) {
    Object.keys(this.opt).forEach(function(key) {
        if(key in opt) {
            this.opt[key] = opt[key];
        }
    }, this);

    // Monoral buzzer sound
    this.sound = new MZ700_Sound();

    // MZ-700 Screen
    if(this.opt.screenElement) {
        $(this.opt.screenElement).mz700scrn("create", {
            CG: new mz700cg(),
        });
        this.scrn = this.opt.screenElement["mz700scrn"];

        // Resume the AudioContext if it is suspended.
        let canvas = $(this.opt.screenElement).find("canvas");
        canvas.click(()=>{ this.allowToPlaySound(); });
        let title = canvas.attr("title");
        let checkSound = () => {
            if(!this.sound.resumed()) {
                canvas.attr("title", "To enable the sound, click here.");
            } else {
                canvas.attr("title", title);
            }
        };
        this.sound.audio.addEventListener("statechange", event=>{
            event.stopPropagation();
            checkSound();
        });
        checkSound();
    }

    // Accept MZT file to drop to the MZ-700 screen
    if(this.opt.mztDroppableElement &&
        window.File && window.FileReader &&
        window.FileList && window.Blob)
    {
        let el = this.opt.mztDroppableElement;
        el.addEventListener('dragover', function(event) {
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
                    await this.setMztData(tape_data);
                };
                reader.readAsArrayBuffer(f);
            }
        }, false);
    }

    if(this.opt.controlPanelElement) {
        // MZ-700 Control buttons
        this.keyInAcceptionIndicator = $("<span/>")
            .addClass("key-switcher")
            .html("Key-In");

        //
        // Emulation control buttons
        //
        this.btnReset = this.btnReset_create();
        this.btnStart = this.btnStart_create();
        this.btnStep = this.btnStep_create();
        this.btnReset_notHover(); 
        this.btnStart_toStop();
        this.btnStep_disable();

        //
        // Slider for timerInterval
        //
        this.sliderExecParamTimerInterval = $("<input/>")
            .attr("type", "range").attr("min", 0).attr("max", 1.0).attr("step", 0.01)
            .val(7).bind("change", () => {
                let sliderValue = this.sliderExecParamTimerInterval.val();
                this._timerInterval = MZ700.DEFAULT_TIMER_INTERVAL / Math.pow(10, sliderValue);
                this.updateExecutionParameter();
                cookies.setItem("speedSliderValue", this._timerInterval, Infinity);
            });


        // Sound control
        let mute = false;
        if(cookies.hasItem("mute")) {
            mute = (cookies.getItem("mute")=="true");
        }
        let volume = 10;
        if(cookies.hasItem("volume")) {
            volume = parseInt(cookies.getItem("volume"));
        }
        this.soundctrl = $("<span/>").soundctrl("create", {
            "maxVolume": 10,
            "initialVolume": volume,
            "initialMute": mute,
            "onChangeVolume": volume => {
                this.allowToPlaySound();
                if(!this.soundctrl.mute) {
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

        $(this.opt.controlPanelElement)
            .append(this.keyInAcceptionIndicator)
            .append(this.soundctrl)
            .append(this.btnStart)
            .append(this.btnReset)
            .append(this.btnStep)
            .append($("<span/>")
                    .addClass("speed-control-slider")
                    .html("Speed:")
                    .append(this.sliderExecParamTimerInterval));
    }

    //
    // Data Recorder Control
    //
    if(this.opt.dataRecorderElement) {
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
    }

    //
    // Keyboard
    //
    if(this.opt.keyboardElement) {
        let kb = $(this.opt.keyboardElement).mz700keyboard("create", {
            onStateChange: (strobe, bit, state) => {
                this.mz700comworker.setKeyState(strobe, bit, state, null);
            }
        });
        let updateKeyStates = (event, state) => {
            let code = event.keyCode;
            if(!(code in this.keystates) || this.keystates[code] != state) {
                this.keystates[code] = state;
                let matrix = kb.mz700keyboard("getMatPos", code);
                if(matrix != null) {
                    kb.mz700keyboard("setState", matrix.strobe, matrix.bit, state);
                    this.mz700comworker.setKeyState(matrix.strobe, matrix.bit, state, null);
                }
            }
        };
        window.addEventListener("keydown", event => {
            if(this.keyAcceptanceState) {
                event.stopPropagation();
                updateKeyStates(event, true);
                return false;
            }
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
            if(this.keyAcceptanceState) {
                event.stopPropagation();
                updateKeyStates(event, false);
                return false;
            }
        });
    }

    //
    // Create MZ-700 Worker
    //

    this.MMIO = MMIO.create();
    this.mz700comworker = TransWorker.create(
        this.opt.urlPrefix + "MZ-700/bundle-worker.js", MZ700, this, {
            'onExecutionParameterUpdate': param => {
                this.onExecutionParameterUpdate(param);
            },
            "start": () => {
                this.isRunning = true;
                this.clearCurrentExecLine();
                this.updateUI();
                this.updateCyclicTimer();
            },
            "stop": () => {
                this.isRunning = false;
                this.scrollToShowPC();
                this.updateUI();
                this.updateCyclicTimer();
                this.updateRegister();
            },
            "onNotifyClockFreq": clockCount => {
                $(".speed-control-slider").attr("title",
                    "Clock: " + (Math.round(100.0 * clockCount / 1000000) / 100) + " MHz");
            },
            'onBreak': () => { this.stop(); },
            'onUpdateScreen': (this.scrn == null) ? () => {} :
                updateData => {
                    Object.keys(updateData).forEach(addr => {
                        let chr = updateData[addr];
                        this.scrn.writeVram(
                                addr, chr.attr, chr.dispcode);
                    });
                },
            'onMmioRead': param => {
                this.MMIO.read(param.address, param.value);
            },
            'onMmioWrite': param => {
                this.MMIO.write(param.address, param.value);
            },
            'onPortRead': ()=>{},
            'onPortWrite': ()=>{},
            'startSound': freq => { this.sound.startSound(freq[0]); },
            'stopSound': () => { this.sound.stopSound(); },
            "onStartDataRecorder": () => {
                this.btnCmtRec.prop("disabled", true);
                this.btnCmtEject.prop("disabled", true);
                this.btnCmtStop.prop("disabled", false);
            },
            "onStopDataRecorder": async ()=>{
                let bytes = this.getCassetteTape();
                this.createCmtDownloadLink(bytes);
                this.btnCmtRec.prop("disabled", false);
                this.btnCmtEject.prop("disabled", false);
                this.btnCmtStop.prop("disabled", true);
            }
        }
    );

    this.PCG700 = require("../lib/PCG-700").create();
    this.PCG700.writeMMIO(0xE010, 0x00);
    this.PCG700.writeMMIO(0xE011, 0x00);
    this.PCG700.writeMMIO(0xE012, 0x18);
    this.mmioMapPeripheral(this.PCG700, [], [0xE010, 0xE011, 0xE012]);
    window.addEventListener("enablePCG700", this.scrn == null ? ()=>{} : () => {
        this.scrn.changeCG(this.PCG700._cg);
        this.scrn.redraw();
    });
    window.addEventListener("disablePCG700", this.scrn == null ? ()=>{} : () => {
        this.scrn.restoreCG();
        this.scrn.redraw();
    });
    window.addEventListener("updatePCG700", this.scrn == null ? ()=>{} : event => {
        this.scrn.redrawChar(event.detail.atb, event.detail.dispCode);
    });

    //
    // Register viewers
    //
    this.regview = $("<div/>").Z80RegView("init");
    $(".register-monitor")
        .append($("<div/>").css("display", "inline-block")
                .append(this.regview));
    $(".monitor")
        .bind("open",  () => { this.updateCyclicTimer(); })
        .bind("close", () => { this.updateCyclicTimer(); });

    //
    // Dumplist Address specifier
    //
    let $buttons = $("<div/>")
        .Z80AddressSpecifier("create")
        .on("queryregister", (event, regName, callback) => {
            this.mz700comworker.getRegister(reg => {
                callback(reg[regName]);
            });
        })
        .on("notifyaddress", (event, address) => {
            $dumplist.dumplist("topAddr", address);
        });
    $(".MZ-700 .memory").append($buttons);

    //
    // Memory hexa dump list
    //
    let $dumplist = $("<div/>").dumplist("init")
        .on("querymemory", (event, addr, callback) => {
            this.mz700comworker.readMemory(addr, callback);
        });
    $(".MZ-700 .memory").append($dumplist);

    //
    // Assemble list
    //
    $(".source-list").asmview("create");
    let sampleSource = $($("textarea.default.source").get(0)).val();
    $(".source-list").asmview("addTab", "mzt", "PCG-700 sample")
    .on("assemble", async (e, asmsrc) => {
        await this.setAssembleSource( asmsrc );
    }).on("setbreak", (e, addr, size, state) => {
        if(state) {
            this.mz700comworker.addBreak(addr, size, null);
        } else {
            this.mz700comworker.removeBreak(addr, size, null);
        }
    }).asmview("setSource", "mzt", sampleSource)
    .asmview("name", "mzt", "PCG-700 sample");

    await this.setAssembleSource( sampleSource );

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
    $(".source-list").tabview("add", "exec-inst",
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
    ).tabview("caption", "exec-inst", "Immediate Exec.");

    this._timerInterval = MZ700.DEFAULT_TIMER_INTERVAL;
    if(cookies.hasItem("speedSliderValue")) {
        let param = parseFloat(cookies.getItem("speedSliderValue"));
        this._timerInterval = param;
        this.updateExecutionParameter();
        this.onExecutionParameterUpdate(param);
    } else {
        this.mz700comworker.getExecutionParameter(param => {
            this._timerInterval = param;
            this.updateExecutionParameter();
            this.onExecutionParameterUpdate(param);
            cookies.setItem("speedSliderValue", this._timerInterval, Infinity);
        });
    }

};

//
// Reset Button
//
MZ700Js.prototype.btnReset_create = function() {
    return $("<button/>").attr("type", "button")
    .addClass("imaged").append($("<img/>")
            .attr("title", "Reset").attr("alt", "Reset"))
    .click(async () => { await this.reset(); })
    .hover(this.btnReset_hover.bind(this),
        this.btnReset_notHover.bind(this));
};
MZ700Js.prototype.btnReset_hover = function() {
    this.btnReset.find("img")
        .attr("src", "../image/btnReset-on.png");
};
MZ700Js.prototype.btnReset_notHover = function() {
    this.btnReset.find("img")
        .attr("src", "../image/btnReset-off.png");
};

//
// Run/Stop Button
//
MZ700Js.prototype.btnStart_create = function() {
    return $("<button/>").attr("type", "button")
        .attr("title", "[F8]")
        .addClass("imaged").append($("<img/>"))
        .click(this.btnStart_click.bind(this))
        .hover(this.btnStart_hover.bind(this),
            this.btnStart_notHover.bind(this));
};
MZ700Js.prototype.btnStart_click = async function() {
    if(this.isRunning) {
        await this.stop();
    } else {
        await this.start();
    }
};
MZ700Js.prototype.btnStart_hover = function() {
    if(this.isRunning) {
        this.btnStart_hoverOnRunning();
    } else {
        this.btnStart_hoverOnStopping();
    }
};
MZ700Js.prototype.btnStart_notHover = function() {
    if(this.isRunning) {
        this.btnStart_notHoverOnRunning();
    } else {
        this.btnStart_notHoverOnStopping();
    }
};
MZ700Js.prototype.btnStart_toRun = function() {
    this.btnStart.find("img")
        .attr("src", "../image/btnRun-off.png")
        .attr("title", "Run").attr("alt", "Run");
};
MZ700Js.prototype.btnStart_toStop = function() {
    this.btnStart.find("img")
        .attr("src", "../image/btnStop-off.png")
        .attr("title", "Stop").attr("alt", "Stop");
};
MZ700Js.prototype.btnStart_hoverOnRunning = function() {
    this.btnStart.find("img").attr("src", "../image/btnStop-on.png");
};
MZ700Js.prototype.btnStart_hoverOnStopping = function() {
    this.btnStart.find("img").attr("src", "../image/btnRun-on.png");
};
MZ700Js.prototype.btnStart_notHoverOnRunning = function() {
    this.btnStart.find("img").attr("src", "../image/btnStop-off.png");
};
MZ700Js.prototype.btnStart_notHoverOnStopping = function() {
    this.btnStart.find("img").attr("src", "../image/btnRun-off.png");
};

//
// Step-In Button
//
MZ700Js.prototype.btnStep_create = function() {
    return $("<button/>").attr("type", "button")
        .attr("title", "[F9]").addClass("imaged")
        .append($("<img/>").attr("title", "Step-In").attr("alt", "Step-In"))
        .click(async () => {
            await this.stepIn();
        }).hover(this.btnStep_hover.bind(this),
            this.btnStep_notHover.bind(this));
};
MZ700Js.prototype.btnStep_enable = function(state) {
    this.btnStep.prop('disabled', '');
    if(state) {
        this.btnStep
            .find("img")
            .attr("src", "../image/btnStepIn-on.png");
    } else {
        this.btnStep
            .find("img")
            .attr("src", "../image/btnStepIn-off.png");
    }
};
MZ700Js.prototype.btnStep_disable = function() {
    this.btnStep
        .prop('disabled', 'disabled')
        .find("img")
        .attr("src", "../image/btnStepIn-disabled.png");
};
MZ700Js.prototype.btnStep_hover = function() {
    if(!this.isRunning) {
        this.btnStep_enable(true);
    }
};
MZ700Js.prototype.btnStep_notHover = function() {
    if(!this.isRunning) {
        this.btnStep_enable();
    }
};

MZ700Js.prototype.mmioMapPeripheral = function(peripheral, mapToRead, mapToWrite) {
    this.MMIO.entry(peripheral, mapToRead, mapToWrite);
    this.mz700comworker.mmioMapToRead(mapToRead, function(){});
    this.mz700comworker.mmioMapToWrite(mapToWrite, function(){});
};

MZ700Js.prototype.reset = async function() {
    await this.stop();
    await new Promise( resolve => {
        this.mz700comworker.reset( () => {
            resolve();
        });
    });
    let bytes = await this.getCassetteTape();
    this.createCmtDownloadLink(bytes);
    await this.start(null);
};

MZ700Js.EXEC_TIMER_INTERVAL = 100;
MZ700Js.NUM_OF_EXEC_OPCODE = 20000;
MZ700Js.prototype.start = function(addr) {
    return new Promise( async (resolve, reject) => {
        try {
            if(addr == null) {
                this.mz700comworker.start(() => {
                    this.btnStart_toStop();
                    resolve();
                });
            } else {
                await this.setPC(addr);
                this.mz700comworker.start(() => {
                    this.btnStart_toStop();
                    resolve();
                });
            }
        } catch(err) {
            reject(err);
        }
    });
};
MZ700Js.prototype.stop = function() {
    return new Promise( (resolve, reject) => {
        this.mz700comworker.stop(() => {
            try {
                this.btnStart_toRun();
                resolve();
            } catch(err) {
                reject(err);
            }
        });
    });
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

MZ700Js.prototype.updateExecutionParameter = function() {
    this.mz700comworker.setExecutionParameter(this._timerInterval, ()=>{});
};
MZ700Js.prototype.onExecutionParameterUpdate = function(param) {
    this._timerInterval = param;
    let sliderValue = Math.log10(MZ700.DEFAULT_TIMER_INTERVAL / param);
    this.sliderExecParamTimerInterval.val(sliderValue);
};


/**
 * Update UI object's appearance by the running status of emulation.
 * @returns {undefined}
 */
MZ700Js.prototype.updateUI = function() {
    if(!this.isRunning) {
        $(".MZ-700").removeClass("running");
        this.btnStep_enable();
    } else {
        $(".MZ-700").addClass("running");
        this.btnStep_disable();
    }
};

MZ700Js.prototype.updateCyclicTimer = function() {
    let regviewOpen = $(".monitor").DropDownPanel("isOpen");
    if(this.isRunning && regviewOpen) {
        if(!this.reg_upd_tid) {
            this.reg_upd_tid = setInterval(()=>{
                this.updateRegister();
            }, 50);
        }
    } else {
        if(this.reg_upd_tid) {
            clearInterval(this.reg_upd_tid);
            this.reg_upd_tid = null;
            this.updateRegister();
        }
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

/**
 *
 * Download and Run a MZT file that is placed on server.
 *
 * 1. Download MZT file from server as byte array.
 * 2. Load to the memory.
 * 3. Run.
 *
 * This is ASYNC function.
 *
 * @param {string} name MZT file's body name on the server
 * @returns {undefined}
 */
MZ700Js.prototype.runServerMZT = async function (name) {
    await this.stop();
    $.getJSON("mzt/" + name + ".json", async tape_data => {
        await this.setMztData(tape_data);
    });
};

/**
 *
 * Load a MZT to the memory, and prepare to run.
 *
 * 1. Parse MZT's header area.
 * 2. Disassemble the MZT' body binary to assemble list.
 * 3. Assemble it back to the memory located by its header area.
 * 4. A program counter will be set to its execution address.
 *
 * @param {object} tape_data MZT tape data as byte array
 * @returns {undefined}
 */
MZ700Js.prototype.setMztData = async function(tape_data) {
    await this.stop();
    await this.setCassetteTape(tape_data);
    if(tape_data != null) {
        let mztape_array = MZ700.parseMZT(tape_data);
        await this.loadCassetteTape();
        this.createCmtDownloadLink(tape_data);
        await this.disassemble(mztape_array);
        await this.start(mztape_array[0].header.addr_exec);
    }
};

//
// Show the next exec line in a window
//
MZ700Js.prototype.scrollToShowPC = function() {
    this.mz700comworker.getRegister(function(reg) {
        $(".source-list").asmview("setCurrentAddr", "mzt", reg.PC);
    });
};

MZ700Js.prototype.clearCurrentExecLine = function() {
    $(".source-list").asmview("clearCurrentAddr", "mzt");
};

MZ700Js.prototype.disassemble = async function(mztape_array) {
    let name = MZ_TapeHeader.get1stFilename(mztape_array) || "(empty)";
    let result = MZ700.disassemble(mztape_array);
    if($(".source-list").length > 0) {
        $(".source-list")
            .asmview("setSource", "mzt", result.outbuf)
            .asmview("name", "mzt", name);
        await this.createAssembleList(result.asmlist);
    }
};

MZ700Js.prototype.createAssembleList = function(asm_list) {
    return new Promise((resolve, reject) => {
        this.mz700comworker.getBreakPoints( breakpoints => {
            try {
                $(".source-list").asmview(
                    "setAsmList", "mzt",
                    asm_list, breakpoints);
                resolve();
            } catch(err) {
                reject(err);
            }
        });
    });
};

MZ700Js.prototype.acceptKey = function(state) {
    this.keyAcceptanceState = state;
    if(this.keyAcceptanceState) {
        this.keyInAcceptionIndicator.addClass("on");
    } else {
        this.keyInAcceptionIndicator.removeClass("on");
    }
};

MZ700Js.prototype.createCmtDownloadLink = function(bytes) {
    if(bytes == null || bytes.length < 128) {
        this.cmtMessageArea.empty().append("(EMPTY)");
        return;
    }
    let header = new MZ_TapeHeader(bytes, 0);
    let byteArr = new Uint8Array(bytes);
    let blob = new Blob([byteArr], {'type': "application/octet-stream"});
    this.cmtMessageArea.empty().html(header.filename).append(
            $("<a/>").addClass("download-link")
                .attr("download", header.filename + ".MZT")
                .attr("type", "application/octet-stream")
                .attr("href", URL.createObjectURL(blob))
                .html("")
                .attr("title",
                    "Download " + header.filename + ".MZT" +
                    " (" + header.file_size + " bytes) " +
                    " ADDR:(" + header.addr_load.HEX(4) + " - " +
                    (header.addr_load + header.file_size - 1).HEX(4) + ") EXEC:" +
                    header.addr_exec.HEX(4))
            );
}

/**
 * Assemble and display the list.
 * @async
 * @param {string} asmsrc
 * The source to be assemble with Z80 assembler.
 * @returns {Promise<object>} as a result of assemble.
 */
MZ700Js.prototype.setAssembleSource = async function( asmsrc ) {
    let shouldBeResumed = this.isRunning;
    if(shouldBeResumed) {
        await this.stop();
    }
    let assembled = Z80_assemble.assemble([asmsrc]).obj[0];
    await this.writeAsmCode( assembled );
    await this.createAssembleList(assembled.list);
    if(shouldBeResumed) {
        await this.start();
    }
    return assembled;
};
MZ700Js.prototype.writeAsmCode = function(assembled) {
    return new Promise(resolve => {
        this.mz700comworker.writeAsmCode( assembled, execAddr => {
            resolve(execAddr);
        });
    });
};
MZ700Js.prototype.setCassetteTape = function(tape_data) {
    return new Promise( resolve => {
        this.mz700comworker.setCassetteTape(tape_data, mztape_array => {
            resolve( mztape_array );
        });
    });
};
MZ700Js.prototype.loadCassetteTape = function() {
    return new Promise( resolve => {
        this.mz700comworker.loadCassetteTape( () => { resolve(); });
    });
};
MZ700Js.prototype.getCassetteTape = function() {
    return new Promise( resolve => {
        this.mz700comworker.getCassetteTape(bytes => {
            resolve(bytes);
        });
    });
};
MZ700Js.prototype.setPC = function(addr) {
    return new Promise(resolve => {
        this.mz700comworker.setPC(addr, ()=>{
            resolve();
        });
    });
};
MZ700Js.prototype.execute = function(steps) {
    return new Promise(resolve => {
        this.mz700comworker.exec(steps, ()=>{
            resolve();
        });
    });
};

MZ700Js.prototype.allowToPlaySound = function() {
    if(!this.sound.resumed()) {
        this.sound.resume();
    }
};

module.exports = MZ700Js;
