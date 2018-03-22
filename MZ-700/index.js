/* global Uint8Array */
(function() {
    var $ = require("jquery");
    require("../lib/context.js");
    require("../lib/ex_number.js");
    var TransWorker = require('transworker');
    var Z80_assemble = require("../Z80/assembler.js");
    var MZ_TapeHeader = require('../MZ-700/mz-tape-header');
    var MZ700 = require("../MZ-700/emulator.js");
    var MZ700_Sound = require("../MZ-700/sound.js");
    var MMIO = require("../MZ-700/mmio");
    var mz700cg = require("../lib/mz700cg.js");
    require("../lib/jquery.asmview.js");
    require("../lib/jquery.soundctrl.js");
    require("../lib/jquery.Z80-mem.js");
    require("../lib/jquery.Z80-reg.js");
    require("../lib/jquery.mz700scrn");
    require("../lib/jquery.MZ-700-kb.js");

    var cookies = require("../lib/cookies");

    /*
     * Convert the innerText of all the elements "span.mz700scrn"
     */
    $(function() {
        $("span.mz700scrn").each(function() {
            $(this).hide();
        });
        setTimeout(function() {
            $("span.mz700scrn").each(function() {
                window.mz700scrn.convert(this);
                $(this).show();
            });
        }, 1);
    });

    var MZ700Js = function() {
        this.opt = {
            "urlPrefix": "",
        };
        this.isRunning = false;
        this.mz700scrn = null;
        this.keyAcceptanceState = true;
        this.keystates = {};
    };
    MZ700Js.create = function(opt) {
        var obj = new MZ700Js();
        obj.create(opt);
        return obj;
    };
    MZ700Js.prototype.create = function(opt) {
        Object.keys(this.opt).forEach(function(key) {
            if(key in opt) {
                this.opt[key] = opt[key];
            }
        }, this);

        this._cgrom = new mz700cg();

        //
        // Communicate with MZ-700 Worker Thread
        //
        if(window.Worker) {
            //
            // MZ-700 Screen
            //
            this.mz700scrn = null;
            var screen = $(".MZ-700 .screen").mz700scrn("create", {
                CG: this._cgrom
            });
            if(screen.length > 0) {
                this.mz700scrn = screen.get(0)["mz700scrn"];
            }

            //
            // Accept MZT file to drop to the MZ-700 screen, if the File API is supported.
            //
            var cmtSlot = $(".MZ-700 .cmt-slot");
            if(cmtSlot.length > 0) {
                if (window.File && window.FileReader && window.FileList && window.Blob) {
                    var dropZone1 = cmtSlot.get(0);
                    dropZone1.addEventListener('dragover', function(evt) {
                        evt.stopPropagation();
                        evt.preventDefault();
                        evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
                    }, false);
                    dropZone1.addEventListener('drop', evt => {
                        evt.stopPropagation();
                        evt.preventDefault();
                        var files = evt.dataTransfer.files; // FileList object.
                        if(files.length > 0) {
                            this.mz700comworker.stop(() => {
                                var f = files[0];
                                var reader = new FileReader();
                                reader.onload = () => {
                                    this.setMztData(new Uint8Array(reader.result), mztape_array => {
                                        this.start(mztape_array[0].header.addr_exec);
                                    });
                                };
                                reader.readAsArrayBuffer(f);
                            });
                        }
                    }, false);
                }
            }

            // MZ-700 Control buttons
            this.keyEventReceiver = $("<span/>")
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
                    var sliderValue = this.sliderExecParamTimerInterval.val();
                    this._timerInterval = MZ700.DEFAULT_TIMER_INTERVAL / Math.pow(10, sliderValue);
                    this.updateExecutionParameter();
                    cookies.setItem("speedSliderValue", this._timerInterval, Infinity);
                });


            // Monoral buzzer sound
            var sound = new MZ700_Sound();

            var mute = false;
            if(cookies.hasItem("mute")) {
                mute = (cookies.getItem("mute")=="true");
            }
            var volume = 10;
            if(cookies.hasItem("volume")) {
                volume = parseInt(cookies.getItem("volume"));
            }
            $(".MZ-700 .ctrl-panel")
                .append(this.keyEventReceiver)
                .append(
                    // Sound control
                    $("<span/>")
                    .soundctrl("create", {
                        "maxVolume": 10,
                        "initialVolume": volume,
                        "initialMute": mute,
                        "onChangeVolume": function(volume) {
                            if(!this.mute) {
                                cookies.setItem("volume", volume, Infinity);
                            }
                            sound.setGain(volume / 10);
                        },
                        "onChangeMute": function(mute) {
                            cookies.setItem("mute", mute, Infinity);
                        },
                        "urlIconOn": this.opt.urlPrefix + "image/icon-sound-on.svg",
                        "urlIconOff": this.opt.urlPrefix + "image/icon-sound-off.svg",
                        "colOn": 'blue', "colOff":"silver"
                    })
                )
                .append(this.btnStart)
                .append(this.btnReset)
                .append(this.btnStep)
                .append($("<span/>")
                        .addClass("speed-control-slider")
                        .html("Speed:")
                        .append(this.sliderExecParamTimerInterval));

            //
            // Data Recorder Control
            //
            var dataRecorder = $(".MZ-700 .data-recorder");
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
                var dropZone2 = dataRecorder.get(0);
                dropZone2.addEventListener('dragover', evt => {
                    evt.stopPropagation();
                    evt.preventDefault();
                    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
                }, false);
                dropZone2.addEventListener('drop', evt => {
                    evt.stopPropagation();
                    evt.preventDefault();
                    var files = evt.dataTransfer.files; // FileList object.
                    if(files.length > 0) {
                        var f = files[0];
                        var reader = new FileReader();
                        reader.onload = () => {
                            var tape_data = new Uint8Array(reader.result);
                            this.mz700comworker.setCassetteTape(tape_data, () => {
                                this.createCmtDownloadLink(tape_data);
                            });
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

            //
            // Keyboard
            //
            this.kb = $(".MZ-700 .keyboard")
            .mz700keyboard("create", {
                onStateChange: (strobe, bit, state) => {
                    this.mz700comworker.setKeyState(strobe, bit, state, null);
                }
            });

            //
            // キー入力
            //
            window.onkeydown = MZ700Js.prototype.onkeydown.bind(this);
            window.onkeyup = MZ700Js.prototype.onkeyup.bind(this);

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
                    },
                    "stop": () => {
                        this.isRunning = false;
                        this.scrollToShowPC();
                        this.updateUI();
                    },
                    "onNotifyClockFreq": clockCount => {
                        $(".speed-control-slider").attr("title",
                            "Clock: " + (Math.round(100.0 * clockCount / 1000000) / 100) + " MHz");
                    },
                    'onBreak': () => { this.stop(); },
                    'onUpdateScreen': (this.mz700scrn == null) ? () => {} :
                        updateData => {
                            Object.keys(updateData).forEach(addr => {
                                var chr = updateData[addr];
                                this.mz700scrn.writeVram(
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
                    'startSound': freq => { sound.startSound(freq[0]); },
                    'stopSound': () => { sound.stopSound(); },
                    "onStartDataRecorder": () => {
                        this.btnCmtRec.prop("disabled", true);
                        this.btnCmtEject.prop("disabled", true);
                        this.btnCmtStop.prop("disabled", false);
                    },
                    "onStopDataRecorder": ()=>{
                        this.mz700comworker.getCassetteTape(bytes=> {
                            this.createCmtDownloadLink(bytes);
                        });
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
            window.addEventListener("enablePCG700", ()=>{
                this.mz700scrn.changeCG(this.PCG700._cg);
                this.mz700scrn.redraw();
            });
            window.addEventListener("disablePCG700", ()=>{
                this.mz700scrn.restoreCG();
                this.mz700scrn.redraw();
            });
            window.addEventListener("updatePCG700", e=>{
                this.mz700scrn.redrawChar(e.detail.atb, e.detail.dispCode);
            });

            //
            // Register viewers
            //
            this.regview = $("<div/>").Z80RegView("init");
            var setRegisterUpdateInterval = duration => {
                if(duration <= 0) {
                    if(this.reg_upd_tid) {
                        clearInterval(this.reg_upd_tid);
                        this.reg_upd_tid = null;
                    }
                } else {
                    if(!this.reg_upd_tid) {
                        this.reg_upd_tid = setInterval(()=>{
                            this.updateRegister();
                        }, duration);
                    }
                }
            };
            $(".register-monitor")
                .append($("<div/>").css("display", "inline-block")
                        .append(this.regview))
                .append($("<div/>").css("display", "inline-block")
                        .css("text-align", "center")
                        .append($("<button type='button'>Update</button>")
                            .click(() => {
                                this.updateRegister();
                            })
                        )
                        .append($("<br/>"))
                        .append($("<input type='checkbox'/>").change(function() {
                            if($(this).prop("checked")) {
                                setRegisterUpdateInterval(50);
                                $(this).parent().find("button").prop("disabled", true);
                            } else {
                                setRegisterUpdateInterval(0);
                                $(this).parent().find("button").prop("disabled", false);
                            }
                        }))
                        .append($("<span>Auto Update</span>")));

            //
            // Memory hexa dump list
            //
            $(".MZ-700 .memory").append($("<div/>").dumplist("init", {
                readMemory: null,
                rows:16, fontFamily: 'inherit', fontSize: '12pt',
                rowHeight:'24px', colWidth:'30px', headerWidth: '60px',
                getReg : (regName, callback) => {
                    this.mz700comworker.getRegister(reg => {
                        callback(reg[regName]);
                    });
                }
            }).dumplist("setReadMemoryHandler", (addr, callback) => {
                this.mz700comworker.readMemory(addr, callback);
            }));

            //
            // Assemble list
            //

            $(".source-list").asmview("create");
            var sampleSource = $($("textarea.default.source").get(0)).val();
            $(".source-list").asmview("addTab", {
                index: "mzt", caption:"PCG-700 sample"
            }, sampleSource, {
                onAssemble: asmsrc => {
                    this.mz700comworker.assemble( asmsrc, assembled => {
                        this.mz700comworker.writeAsmCode( assembled, () => {
                            this.createAssembleList(assembled.list);
                        });
                    });
                },
                onSetBreakPoint: (addr, size, state) => {
                    if(state) {
                        this.mz700comworker.addBreak(addr, size, null);
                    } else {
                        this.mz700comworker.removeBreak(addr, size, null);
                    }
                },
            });

            //
            //直接実行ボタン
            //
            var runImm = src => {
                var bin = new Z80_assemble(src);
                this.mz700comworker.getRegister(reg => {
                    var savedPC = reg.PC;
                    this.mz700comworker.writeAsmCode(bin, execAddr => {
                        this.mz700comworker.setPC(execAddr, () => {
                            this.mz700comworker.exec(1, () => {
                                this.mz700comworker.setPC(savedPC, ()=>{});
                            });
                        });
                    });
                });
            };
            $(".imm-exec")
                .append($("<label/>").html("Address"))
                .append($("<input/>")
                        .attr("type", "text").attr("value", "CF00h")
                        .addClass("address"))
                .append($("<label/>").html("mnemonic"))
                .append($("<input/>")
                        .attr("type", "text").attr("value", "NOP")
                        .addClass("mnemonic"))
                .append($("<button/>").attr("type", "button").html("Execute")
                        .click(function() {
                            var par = $(this).parent();
                            var addrToken = par.find("input.address").val();
                            var asm = new Z80_assemble();
                            var addr = asm.parseAddress(addrToken);
                            if(addr != null) {
                                var src = 'ORG ' + addr.HEX(4) + "H\r\n";
                                src += par.find("input.mnemonic").val() + "\r\n";
                                runImm(src);
                            }
                        }))
                .append($("<br/>"));
        }

        this._timerInterval = MZ700.DEFAULT_TIMER_INTERVAL;
        if(cookies.hasItem("speedSliderValue")) {
            var param = parseFloat(cookies.getItem("speedSliderValue"));
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
        .click(() => { this.reset(); })
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
    MZ700Js.prototype.btnStart_click = function() {
        if(this.isRunning) {
            this.stop(() => {
                this.btnStart_toRun();
            });
        } else {
            this.start(null, () => {
                this.btnStart_toStop();
            });
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
            .click(this.stepIn.bind(this))
            .hover(this.btnStep_hover.bind(this),
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
        this.mz700comworker.mmioMapToWrite(mapToRead, function(){});
        this.mz700comworker.mmioMapToWrite(mapToWrite, function(){});
    };

    MZ700Js.prototype.reset = function(callback) {
        this.mz700comworker.stop( () => {
            this.mz700comworker.reset( () => {
                this.mz700comworker.getCassetteTape(bytes => {
                    this.createCmtDownloadLink(bytes);
                    this.start(null, callback);
                });
            });
        });
    };

    MZ700Js.EXEC_TIMER_INTERVAL = 100;
    MZ700Js.NUM_OF_EXEC_OPCODE = 20000;
    MZ700Js.prototype.start = function(addr, callback) {
        if(addr == null) {
            this.mz700comworker.start(callback || (()=>{}));
        } else {
            this.mz700comworker.setPC(addr, ()=>{
                this.mz700comworker.start(callback || (()=>{}));
            });
        }
    };
    MZ700Js.prototype.stop = function(callback) {
        this.mz700comworker.stop(callback || (()=>{}));
    };
    MZ700Js.prototype.stepIn = function() {
        this.clearCurrentExecLine();
        this.mz700comworker.exec(1, ()=>{
            this.scrollToShowPC();
        });
    };
    MZ700Js.prototype.stepOver = function() {
        this.stepIn();
    };

    MZ700Js.prototype.updateExecutionParameter = function() {
        this.mz700comworker.setExecutionParameter(this._timerInterval, ()=>{});
    };
    MZ700Js.prototype.onExecutionParameterUpdate = function(param) {
        this._timerInterval = param;
        var sliderValue = Math.log10(MZ700.DEFAULT_TIMER_INTERVAL / param);
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
    MZ700Js.prototype.runServerMZT = function (name) {
        this.mz700comworker.stop(() => {
            $.getJSON("mzt/" + name + ".json", (tape_data) => {
                this.setMztData(tape_data, (mztape_array) => {
                    this.start(mztape_array[0].header.addr_exec);
                });
            });
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
     * @param {function|null} callback A function invoked after loading the tape
     * @returns {undefined}
     */
    MZ700Js.prototype.setMztData = function(tape_data, callback) {
        callback = callback || (()=>{});
        this.mz700comworker.setCassetteTape(tape_data, mztape_array => {
            if(mztape_array != null) {
                this.cmtMessageArea.html("MZT: '" + mztape_array[0].header.filename + "' Loading...");
                this.mz700comworker.loadCassetteTape( () => {
                    this.cmtMessageArea.html("MZT: '" + mztape_array[0].header.filename + "' Loaded");
                    this.createCmtDownloadLink(tape_data);
                    callback(mztape_array);
                });
            }
        });
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

    MZ700Js.prototype.disassemble = function(mztape_array) {
        var running = this.isRunning;
        var name = MZ_TapeHeader.get1stFilename(mztape_array) || "(empty)";
        this.mz700comworker.stop(() => {
            var result = MZ700.disassemble(mztape_array);
            if($(".source-list").length > 0) {
                $(".source-list").asmview(
                    "setSource", "mzt", result.outbuf, name, false);
                this.createAssembleList(result.asmlist);
            }
            if(running) {
                this.start();
            }
        });
    };

    MZ700Js.prototype.createAssembleList = function(asm_list) {
        this.mz700comworker.getBreakPoints( breakpoints => {
            $(".source-list").asmview("setAsmList", "mzt", asm_list, breakpoints);
        });
    };

    MZ700Js.prototype.acceptKey = function(state) {
        this.keyAcceptanceState = state;
        if(this.keyAcceptanceState) {
            this.keyEventReceiver.addClass("on");
        } else {
            this.keyEventReceiver.removeClass("on");
        }
    };

    MZ700Js.prototype.onkeydown = function(e) {
        if(this.keyAcceptanceState) {
            this.updateKeyStates(e, true);
            return false;
        }
    };

    MZ700Js.prototype.onkeyup = function(e) {
        switch(e.keyCode) {
        case 119://F8 - RUN/STOP
            if(this.isRunning) {
                this.stop();
            } else {
                this.start();
            }
            return;
        case 120://F9 - STEP OVER
            this.stepOver();
            return;
        }
        if(this.keyAcceptanceState) {
            this.updateKeyStates(e, false);
            return false;
        }
    };

    //キーボードからの入力処理
    MZ700Js.prototype.updateKeyStates = function (e, state) {
        var code = e.keyCode;
        if(!(code in this.keystates) || this.keystates[code] != state) {
            this.keystates[code] = state;
            var matrix = this.kb.mz700keyboard("getMatPos", code);
            if(matrix != null) {
                this.kb.mz700keyboard("setState", matrix.strobe, matrix.bit, state);
                this.mz700comworker.setKeyState(matrix.strobe, matrix.bit, state, null);
            }
        }
    };
    MZ700Js.prototype.createCmtDownloadLink = function(bytes) {
        if(bytes == null || bytes.length < 128) {
            this.cmtMessageArea.empty().append("(EMPTY)");
            return;
        }
        var header = new MZ_TapeHeader(bytes, 0);
        var byteArr = new Uint8Array(bytes);
        var blob = new Blob([byteArr], {'type': "application/octet-stream"});
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
        this.cmtMessageArea.append(
            $("<a/>").html("Disassemble").click(() => {
                this.mz700comworker.getCassetteTape(tape_data => {
                    if(tape_data != null) {
                        var mztape_array = MZ700.parseMZT(tape_data);
                        this.disassemble(mztape_array);
                    }
                });
            }));
    }

    module.exports = MZ700Js;
}());
