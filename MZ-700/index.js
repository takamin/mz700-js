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
    require("../lib/jquery.ddpanel.js");
    require("../lib/jquery.soundctrl.js");
    require("../lib/jquery.Z80-mem.js");
    require("../lib/jquery.Z80-reg.js");
    require("../lib/jquery.MZ-700-vram");
    require("../lib/jquery.MZ-700-kb.js");

    var MZ700Js = function() {
        this.opt = {
            "urlPrefix": "",
            "onKeyboardPanelOpen": function() {},
            "onKeyboardPanelClose": function() {}
        };
        this.isRunning = false;
        this.listRows = {};
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

        //
        // Communicate with MZ-700 Worker Thread
        //
        if(window.Worker) {
            //
            // MZ-700 Screen
            //
            this.mz700scrn = null;
            var screen = $(".MZ-700 .screen").mz700scrn("create", {});
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
                    dropZone1.addEventListener('drop', function(evt) {
                        evt.stopPropagation();
                        evt.preventDefault();
                        var files = evt.dataTransfer.files; // FileList object.
                        if(files.length > 0) {
                            this.mz700comworker.stop(function() {
                                var f = files[0];
                                var reader = new FileReader();
                                reader.onload = function(/*e*/) {
                                    this.setMztData(new Uint8Array(reader.result), function() {
                                        this.start();
                                        this.acceptKey(true);
                                    }.bind(this));
                                }.bind(this);
                                reader.readAsArrayBuffer(f);
                            }.bind(this));
                        }
                    }.bind(this), false);
                }
            }

            // MZ-700 Control buttons
            this.keyEventReceiver = $("<span/>")
                .addClass("key-switcher")
                .html("Key-In");
            this.btnReset = $("<button/>").attr("type", "button")
                .html("Reset").click(function() {
                    this.reset();
                }.bind(this));
            this.btnStart = $("<button/>")
                .attr("id", "btnStart")
                .attr("type", "button")
                .attr("title", "[F8]")
                .html("Run").click(function() {
                    if(this.isRunning) {
                        this.stop();
                    } else {
                        this.start();
                    }
                }.bind(this))
                .hover(
                        function() {
                            if(this.isRunning) {
                                this.btnStart.html("Stop");
                            }
                        }.bind(this),
                        function() {
                            this.btnStart.html("Run");
                        }.bind(this)
                );
            this.btnStep = $("<button/>").attr("type", "button")
                .attr("title", "[F9]")
                .html("Step").click(function() {
                    this.stepIn();
                }.bind(this));

            //
            // Slider for timerInterval
            //
            this.sliderExecParamTimerInterval = $("<input/>")
                .attr("type", "range").attr("min", 0).attr("max", 1.0).attr("step", 0.01)
                .val(7).bind("change", function() {
                    var sliderValue = this.sliderExecParamTimerInterval.val();
                    this._timerInterval = MZ700.DEFAULT_TIMER_INTERVAL / Math.pow(10, sliderValue);
                    this.updateExecutionParameter();
                }.bind(this));


            // Monoral buzzer sound
            var sound = new MZ700_Sound();

            $(".MZ-700 .ctrl-panel")
                .append(this.keyEventReceiver)
                .append(
                    // Sound control
                    $("<span/>")
                    .soundctrl("create", {
                        "maxVolume": 10,
                        "initialVolume": 10,
                        "initialMute": false,
                        "onChangeVolume": function(volume) {
                            sound.setGain(volume / 10);
                        }.bind(this),
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
                .html("<span style='color:red'>●</span> RECPLAY").click(function() {
                    this.cmtMessageArea.empty().html("Recording ...");
                    this.mz700comworker.dataRecorder_pushRec( function() { });
                }.bind(this));
            this.btnCmtPlay = $("<button/>").attr("type", "button")
                .html("<span style='display:inline-block;transform:rotate(-90deg);'>▼</span> PLAY").click(function() {
                    this.mz700comworker.dataRecorder_pushPlay( function() { });
                }.bind(this));
            this.btnCmtStop = $("<button/>").attr("type", "button")
                .html("<span>■</span> STOP").click(function() {
                    this.mz700comworker.dataRecorder_pushStop( function() { });
                }.bind(this));
            this.btnCmtEject = $("<button/>").attr("type", "button")
                .html("<span>▲</span>EJECT").click(function() {
                    this.mz700comworker.dataRecorder_ejectCmt(
                        function(bytes) {
                            this.createCmtDownloadLink(bytes);
                        }.bind(this));
                }.bind(this));
            if (window.File && window.FileReader && window.FileList && window.Blob) {
                var dropZone2 = dataRecorder.get(0);
                dropZone2.addEventListener('dragover', function(evt) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
                }, false);
                dropZone2.addEventListener('drop', function(evt) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    var files = evt.dataTransfer.files; // FileList object.
                    if(files.length > 0) {
                        var f = files[0];
                        var reader = new FileReader();
                        reader.onload = function(/*e*/) {
                            var tape_data = new Uint8Array(reader.result);
                            this.mz700comworker.setCassetteTape(tape_data, function() {
                                this.mz700comworker.getCassetteTape(function(bytes) {
                                    this.createCmtDownloadLink(bytes);
                                }.bind(this));
                            }.bind(this));
                        }.bind(this);
                        reader.readAsArrayBuffer(f);
                    }
                }.bind(this), false);
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
                onStateChange: function(strobe, bit, state) {
                    this.mz700comworker.setKeyState(strobe, bit, state, null);
                }.bind(this)
            })
            .DropDownPanel("create", {
                "caption": "Keyboard",
                "onOpen": this.opt.onKeyboardPanelOpen,
                "onClose": this.opt.onKeyboardPanelClose
            });

            //
            // キー入力
            //
            window.onkeydown = MZ700Js.prototype.onkeydown.bind(this);
            window.onkeyup = MZ700Js.prototype.onkeyup.bind(this);

            //画面クリック、キー入力ボタン等で、キー入力を受け付ける。
            $(".MZ-700 .key-switcher").click(function(event) {
                this.acceptKey(true);
                event.stopPropagation();
            }.bind(this));

            //ウィンドウクリックでキー入力解除
            $(window).click(function() {
                this.acceptKey(false);
            }.bind(this));

            //初期状態でキー入力を受け付ける
            this.acceptKey(true);

            //
            // Create MZ-700 Worker
            //

            this.MMIO = MMIO.create();
            this.mz700comworker = TransWorker.create(
                this.opt.urlPrefix + "MZ-700/bundle-worker.js", MZ700, this, {
                    'onExecutionParameterUpdate': function(param) {
                        this.onExecutionParameterUpdate(param);
                    },
                    "start": function() {
                        this.isRunning = true;
                        this.clearCurrentExecLine();
                        this.updateUI();
                    },
                    "stop": function() {
                        this.isRunning = false;
                        this.scrollToShowPC();
                        this.setCurrentExecLine();
                        this.updateUI();
                    },
                    'onBreak': function() { this.stop(); },
                    'onUpdateScreen': (this.mz700scrn == null) ? function() {} :
                        function(updateData) { this.mz700scrn.write(updateData); }.bind(this),
                    'onMmioRead': function(param) {
                        this.MMIO.read(param.address, param.value);
                    },
                    'onMmioWrite': function(param) {
                        this.MMIO.write(param.address, param.value);
                    },
                    'onPortRead': function(/*param*/) { },
                    'onPortWrite': function(/*param*/) { },
                    'startSound': function(freq) { sound.startSound(freq); },
                    'stopSound': function() { sound.stopSound(); },
                    "onStartDataRecorder": function(){
                        this.btnCmtRec.prop("disabled", true);
                        this.btnCmtEject.prop("disabled", true);
                        this.btnCmtStop.prop("disabled", false);
                    }.bind(this),
                    "onStopDataRecorder": function(){
                        this.mz700comworker.getCassetteTape(function(bytes) {
                            this.createCmtDownloadLink(bytes);
                        }.bind(this));
                        this.btnCmtRec.prop("disabled", false);
                        this.btnCmtEject.prop("disabled", false);
                        this.btnCmtStop.prop("disabled", true);
                    }.bind(this)
                }
            );

            this.PCG700 = require("../lib/PCG-700").create();
            this.PCG700.setScreen(this.mz700scrn);
            this.PCG700.writeMMIO(0xE010, 0x00);
            this.PCG700.writeMMIO(0xE011, 0x00);
            this.PCG700.writeMMIO(0xE012, 0x18);
            this.mmioMapPeripheral(this.PCG700, [], [0xE010, 0xE011, 0xE012]);

            //
            // Register viewers
            //
            this.regview = $("<div/>").Z80RegView("init");
            var setRegisterUpdateInterval = function(duration) {
                if(duration <= 0) {
                    if(this.reg_upd_tid) {
                        clearInterval(this.reg_upd_tid);
                        this.reg_upd_tid = null;
                    }
                } else {
                    if(!this.reg_upd_tid) {
                        this.reg_upd_tid = setInterval(function() {
                            this.updateRegister();
                        }.bind(this), duration);
                    }
                }
            }.bind(this);
            $(".register-monitor")
                .append($("<div/>").css("display", "inline-block")
                        .append(this.regview))
                .append($("<div/>").css("display", "inline-block")
                        .css("text-align", "center")
                        .append($("<button type='button'>Update</button>")
                            .click(function() {
                                this.updateRegister();
                            }.bind(this))
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
                        .append($("<span>Auto Update</span>")))
                .DropDownPanel("create", { "caption" : "Register" });

            //
            // Memory hexa dump list
            //
            $(".MZ-700 .memory")
                .append($("<div/>").dumplist("init",
                    {
                        readMemory: null,
                        rows:16, fontFamily: 'inherit', fontSize: '12pt',
                        rowHeight:'24px', colWidth:'30px', headerWidth: '60px',
                        getReg : function(regName, callback) {
                            this.mz700comworker.getRegister(function(reg) {
                                callback(reg[regName]);
                            });
                        }.bind(this)
                    }).dumplist("setReadMemoryHandler",
                        function(addr, callback) {
                            this.readMemory(addr, callback);
                        }.bind(this.mz700comworker)))
                .DropDownPanel("create", { "caption" : "Memory" });
            //
            // ソースリストを表示する
            //
            this.asmList = $("<div/>").addClass("assemble_list");
            this.tabAsmList = $("<div/>");
            this.tabAsmList.append(
                    $("<div/>")
                        .addClass("y-scroll-pane")
                        .append(this.asmList))
                .append("<span>* Click a line, and set break point</span>");

            this.txtAsmSrc = $("<textarea type='text'/>")
                .val($($("textarea.default.source").get(0)).val())
                .bind("change", function() {
                    //Clear assemble list
                    this.listRows = {};
                }.bind(this));
            this.tabSource = $("<div/>").append(this.txtAsmSrc);
            $(".source-list")
                .append($("<div/>")
                        .append($("<button type='button'/>").click(function() {
                            if(Object.keys(this.listRows).length !== 0) {
                                this.showTabAsmList();
                            } else {
                                this.assemble(function() {
                                    this.showTabAsmList();
                                }.bind(this));
                            }
                        }.bind(this)).html("Syntax highlight"))
                        .append($("<button type='button'/>").click(function() {
                            this.showTabSource();
                        }.bind(this)).html("Plain text")))
                .append($("<div/>").addClass("tabPageContainer clearfix")
                    .append(this.tabAsmList)
                    .append(this.tabSource))
                .DropDownPanel("create", { "caption" : "Assembly source" });

            //
            //直接実行ボタン
            //
            var runImm = function(src) {
                var bin = new Z80_assemble(src);
                this.clearCurrentExecLine();
                this.mz700comworker.getRegister(function(reg) {
                    var savedPC = reg.PC;
                    this.mz700comworker.writeAsmCode(bin, function(execAddr) {
                        this.mz700comworker.setPC(execAddr, function() {
                            this.mz700comworker.exec(1, function(/*result*/){
                                this.mz700comworker.setPC(savedPC, function() {});
                            }.bind(this));
                        }.bind(this));
                    }.bind(this));
                }.bind(this));
            }.bind(this);
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
                .append($("<br/>"))
                .DropDownPanel("create", { "caption" : "Execute Z80 Instruction" });
        }

        this._timerInterval = MZ700.DEFAULT_TIMER_INTERVAL;
        this.mz700comworker.getExecutionParameter(function(param) {
            this._timerInterval = param;
            this.updateExecutionParameter();
            this.onExecutionParameterUpdate(param);
        }.bind(this));

        this.assemble(function() {
            this.showTabAsmList();
        }.bind(this));
    };
    MZ700Js.prototype.mmioMapPeripheral = function(peripheral, mapToRead, mapToWrite) {
        this.MMIO.entry(peripheral, mapToRead, mapToWrite);
        this.mz700comworker.mmioMapToWrite(mapToRead, function(){});
        this.mz700comworker.mmioMapToWrite(mapToWrite, function(){});
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
        this.mz700comworker.stop(function() {
            $.getJSON("mzt", {"name": name}, function(tape_data) {
                this.setMztData(tape_data, function() {
                    this.start();
                    this.acceptKey(true);
                }.bind(this));
            }.bind(this));
        }.bind(this));
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
        callback = callback || function(){};
        this.mz700comworker.setCassetteTape(tape_data, function(mztape_array) {
            if(mztape_array != null) {
                this.cmtMessageArea.html("MZT: '" + mztape_array[0].header.filename + "' Loading...");
                this.mz700comworker.loadCassetteTape(function() {
                    this.cmtMessageArea.html("MZT: '" + mztape_array[0].header.filename + "' Loaded");
                    this.mz700comworker.getCassetteTape(function(bytes) {
                        this.createCmtDownloadLink(bytes);
                        this.mz700comworker.disassemble(mztape_array, function(result) {
                            this.txtAsmSrc.val(result.outbuf);
                            this.showTabSource();
                            this.asmList.empty();
                            this.listRows = {};
                            this.mz700comworker.setPC(mztape_array[0].header.addr_exec, function() {
                                callback();
                            }.bind(this));
                        }.bind(this));
                    }.bind(this));
                }.bind(this));
            }
        }.bind(this));
    };

    MZ700Js.prototype.reset = function(callback) {
        this.mz700comworker.stop(function() {
            this.mz700comworker.reset(function() {
                this.mz700comworker.getCassetteTape(function(bytes) {
                    this.createCmtDownloadLink(bytes);
                    if(callback) {
                        callback();
                    }
                    this.start();
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };
    MZ700Js.EXEC_TIMER_INTERVAL = 100;
    MZ700Js.NUM_OF_EXEC_OPCODE = 20000;
    MZ700Js.prototype.start = function() {
        this.mz700comworker.start(function() {});
    };
    MZ700Js.prototype.stop = function() {
        this.mz700comworker.stop(function() {});
    };
    MZ700Js.prototype.stepIn = function() {
        this.clearCurrentExecLine();
        this.mz700comworker.exec(1, function(/*result*/){
            this.scrollToShowPC();
            this.setCurrentExecLine();
        }.bind(this));
    };
    MZ700Js.prototype.stepOver = function() {
        this.stepIn();
    };

    MZ700Js.prototype.updateExecutionParameter = function() {
        this.mz700comworker.setExecutionParameter(this._timerInterval, function(){});
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
        this.btnReset.prop('disabled', '');
        if(!this.isRunning) {
            $(".MZ-700").removeClass("running");
            this.btnStep.prop('disabled', '');
        } else {
            $(".MZ-700").addClass("running");
            this.btnStep.prop('disabled', 'disabled');
        }
    };

    MZ700Js.prototype.updateRegister = function () {
        (function(app) {
            app.mz700comworker.getRegister(function(reg) {
                app.regview.Z80RegView("update", reg);
            });
            app.mz700comworker.getRegisterB(function(regB) {
                app.regview.Z80RegView("update_", regB);
            });
            app.mz700comworker.getIFF1(function(iff) {
                app.regview.Z80RegView("IFF1", iff);
            });
            app.mz700comworker.getIFF2(function(iff) {
                app.regview.Z80RegView("IFF2", iff);
            });
            app.mz700comworker.getIM(function(im) {
                app.regview.Z80RegView("IM", im);
            });
            app.mz700comworker.getHALT(function(halt) {
                app.regview.Z80RegView("HALT", halt);
            });
        }(this));
    };


    //
    // Show the next exec line in a window
    //
    MZ700Js.prototype.scrollToShowPC = function() {
        this.mz700comworker.getRegister(function(reg) {
            var $target = $('.row.pc' + reg.PC.HEX(4));
            if($target.length <= 0) {
                return;
            }
            var $base = this.asmList;
            var $scrl_wnd = $base.parent();
            var wnd_height = parseInt($scrl_wnd.css("height"));
            var wnd_scrl = $scrl_wnd.scrollTop();
            var scrl_to = $target.offset().top - $base.offset().top;
            if(scrl_to < wnd_scrl + 0.1 * wnd_height || wnd_scrl + 0.9 * wnd_height < scrl_to) {
                $scrl_wnd.animate({ scrollTop : scrl_to - 0.2 * wnd_height }, 'fast');
            }
        });
    };
    MZ700Js.prototype.setCurrentExecLine = function() {
        this.mz700comworker.getRegister(function(reg) {
            var addr = reg.PC;
            var rows = this.listRows;
            if(addr in rows) {
                rows[addr].forEach(function(row) { row.addClass("current"); });
            }
        }.bind(this));
    }
    MZ700Js.prototype.clearCurrentExecLine = function() {
        this.mz700comworker.getRegister(function(reg) {
            var addr = reg.PC;
            var rows = this.listRows;
            if(addr in rows) {
                rows[addr].forEach(function(row) { row.removeClass("current"); });
            }
        }.bind(this));
    }
    MZ700Js.prototype.showTabSource = function () {
        this.tabSource.show();
        this.tabAsmList.hide();
    };
    MZ700Js.prototype.showTabAsmList = function () {
        this.tabSource.hide();
        this.tabAsmList.show();
    };
    MZ700Js.prototype.assemble = function(callback) {
        this.mz700comworker.getBreakPoints(function(breakpoints) {
            this.mz700comworker.assemble(this.txtAsmSrc.val(), function(assembled) {
                this.assembled = assembled;
                var asm_list = this.assembled.list;
                this.asmList.empty();
                this.listRows = {};
                var line_number = 0;
                asm_list.forEach(function(asm_line) {
                    line_number++;
                    var $row = $("<div/>")
                        .addClass('row')
                        .addClass("pc" + asm_line.address.HEX(4))
                        .click((function(app, address, size){
                            return function() {
                                if(size > 0) {
                                    var row = $(".pc" + address.HEX(4));
                                    if(row.hasClass('breakPoint')) {
                                        row.removeClass('breakPoint');
                                        app.mz700comworker.removeBreak(address, size, null);
                                    } else {
                                        row.addClass('breakPoint');
                                        app.mz700comworker.addBreak(address, size, null);
                                    }
                                }
                            };
                        })(this, asm_line.address, asm_line.bytecode.length));

                    // Set breakpoint class
                    if(breakpoints[asm_line.address] && asm_line.bytecode.length > 0) {
                        $row.addClass('breakPoint');
                    }

                    this.asmList.append($row);

                    // attributes column
                    $row.append($('<span class="colRowAttr" '
                                + 'style="display:inline-block; width:20px; text-align:center;"></span>'));

                    // line number
                    $row.append($('<span class="colLineNumber" '
                                + 'style="display:inline-block; width:40px; padding-right:6px; text-align:right;">'
                                + line_number + '</span>'));

                    // address
                    $row.append($('<span class="colAddress" '
                                + 'style="display:inline-block; width:40px;">'
                                + asm_line.address.HEX(4) + '</span>'));

                    // code
                    var codeHex = '';
                    asm_line.bytecode.forEach(function(code) {
                        codeHex += code.HEX(2);
                    });
                    $row.append($('<span class="colMachineCode" '
                                + 'style="display:inline-block; width:80px;">'
                                + codeHex + '</span>'));

                    // label
                    if(asm_line.label != null) {
                        $row.append($('<span class="colLabel" '
                                    + 'style="display:inline-block; width:70px;"/>')
                                    .html((asm_line.label==null ? '' : (asm_line.label+':'))));
                    }

                    // mnemonic
                    if(asm_line.mnemonic != null) {
                        if(asm_line.label == null) {
                            $row.append($('<span style="display:inline-block; width:70px;"></span>'));
                        }
                        $row.append($('<span class="colMnemonic" '
                                    + 'style="display:inline-block; width:50px;"/>')
                                    .html(asm_line.mnemonic));
                        $row.append($('<span class="colOperand" '
                                    + 'style="display:inline-block; width:100px;"/>')
                                    .html(asm_line.operand));
                    }
                    // comment
                        $row.append($('<span class="colComment" '
                                    + 'style="display:inline-block; white-space:pre;"/>')
                                    .html((asm_line.comment==null ? '' : asm_line.comment)));

                    //
                    // Push the row to hashed array by its address
                    //
                    if(asm_line.address in this.listRows) {
                        this.listRows[asm_line.address].push($row);
                    } else {
                        this.listRows[asm_line.address] = [$row];
                    }
                }, this);
                this.mz700comworker.writeAsmCode(this.assembled, function() {
                    callback();
                });
            }.bind(this));
        }.bind(this));
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
    }

    module.exports = MZ700Js;
}());
