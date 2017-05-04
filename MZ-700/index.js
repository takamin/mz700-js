(function() {
    var $ = require("jquery");
    require("../lib/context.js");
    require("../lib/ex_number.js");
    var TransWorker = require('transworker');
    var FTParam = require('../lib/ft-param');
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
            var mz700scrn = (function() {
                var screen = $(".MZ-700 .screen").mz700scrn("create", {});
                if(screen.length > 0) {
                    return screen.get(0)["mz700scrn"];
                }
                return null;
            }());

            //
            // Accept MZT file to drop to the MZ-700 screen, if the File API is supported.
            //
            var cmtSlot = $(".MZ-700 .cmt-slot");
            if(cmtSlot.length > 0) {
                if (window.File && window.FileReader && window.FileList && window.Blob) {
                    var dropZone = cmtSlot.get(0);
                    dropZone.addEventListener('dragover', function(evt) {
                        evt.stopPropagation();
                        evt.preventDefault();
                        evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
                    }, false);
                    dropZone.addEventListener('drop', (function(app) { return function(evt) {
                        evt.stopPropagation();
                        evt.preventDefault();
                        var files = evt.dataTransfer.files; // FileList object.
                        if(files.length > 0) {
                            var f = files[0];
                            var reader = new FileReader();
                            reader.onload = function(e) {
                                app.setMztData(new Uint8Array(reader.result));
                            };
                            reader.readAsArrayBuffer(f);
                        }
                    };}(this)), false);
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
            this.btnStart = $("<button/>").attr("type", "button")
                .html("Run").click(function() {
                    this.start();
                }.bind(this));
            this.btnStop = $("<button/>").attr("type", "button")
                .html("Stop").click(function() {
                    this.stop();
                }.bind(this));
            this.btnStep = $("<button/>").attr("type", "button")
                .html("Step").click(function() {
                    this.stepIn();
                }.bind(this));

            //
            // Sliders for execParam
            //
            this.sliderExecParamNumOfTimer = $("<input/>")
                .attr("type", "range").attr("min", 1).attr("max", 250)
                .val(1).bind("change", function() {
                    this.execParam.numOfTimer = this.sliderExecParamNumOfTimer.val();
                    this.updateExecutionParameter();
                }.bind(this));
            this.sliderExecParamNumOfExecInst = $("<input/>")
                .attr("type", "range").attr("min", 1).attr("max", 1000)
                .val(1000).bind("change", function() {
                    this.execParam.numOfExecInst = this.sliderExecParamNumOfExecInst.val();
                    this.updateExecutionParameter();
                }.bind(this));
            this.sliderExecParamTimerInterval = $("<input/>")
                .attr("type", "range").attr("min", 1).attr("max", 1000)
                .val(7).bind("change", function() {
                    this.execParam.timerInterval = this.sliderExecParamTimerInterval.val();
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
                .append(this.btnReset)
                .append(this.btnStart)
                .append(this.btnStop)
                .append(this.btnStep)
                .append($("<br/>"))
                .append($("<span/>").html("Exec.Timer:"))
                .append($("<span/>").attr("id", "exec-param1"))
                .append(this.sliderExecParamNumOfTimer)
                .append($("<span/>").html(", "))
                .append($("<span/>").html("Instruction:"))
                .append($("<span/>").attr("id", "exec-param2"))
                .append(this.sliderExecParamNumOfExecInst)
                .append($("<span/>").html(", "))
                .append($("<span/>").html("Interval:"))
                .append($("<span/>").attr("id", "exec-param3"))
                .append(this.sliderExecParamTimerInterval);

            //
            // Data Recorder Control
            //
            var dataRecorder = $(".MZ-700 .data-recorder");
            this.btnCmtRec = $("<button/>").attr("type", "button")
                .html("RECPLAY").click(function() {
                    this.cmtMessageArea.empty();
                    this.mz700comworker.dataRecorder_pushRec(
                        function() {
                            console.log("REC callback");
                        }.bind(this));
                }.bind(this));
            this.btnCmtPlay = $("<button/>").attr("type", "button")
                .html("PLAY").click(function() {
                    this.mz700comworker.dataRecorder_pushPlay(
                        function() { console.log("PLAY callback"); });
                }.bind(this));
            this.btnCmtStop = $("<button/>").attr("type", "button")
                .html("STOP").click(function() {
                    this.mz700comworker.dataRecorder_pushStop(
                        function() { console.log("STOP callback"); });
                }.bind(this));
            this.btnCmtEject = $("<button/>").attr("type", "button")
                .html("EJECT").click(function() {
                    this.mz700comworker.dataRecorder_ejectCmt(
                        function(bytes) {
                            console.log("EJECT callback");
                            if(bytes == null || bytes.length < 128) {
                                console.log("CMT has too short length data");
                                return;
                            }
                            var header = new MZ_TapeHeader(bytes, 0);
                            var byteArr = new Uint8Array(bytes);
                            var blob = new Blob([byteArr], {'type': "application/octet-stream"});
                            this.cmtMessageArea.empty().append(
                                    $("<a/>")
                                        .attr("download", header.filename + ".MZT")
                                        .attr("type", "application/octet-stream")
                                        .attr("href", URL.createObjectURL(blob))
                                        .html("<u>↓</u> " + header.filename + ":" +
                                            header.addr_load.HEX(4) + "-" +
                                            (header.addr_load + header.file_size - 1).HEX(4) + "-" +
                                            header.addr_exec.HEX(4)
                                            )
                                    );
                        }.bind(this));
                }.bind(this));
            this.btnCmtSet = $("#mzt_info").html(
                    "DROP MZT INTO HERE TO LOAD BY MONITOR COMMAND");
            if (window.File && window.FileReader && window.FileList && window.Blob) {
                var dropZone = this.btnCmtSet.get(0);
                dropZone.addEventListener('dragover', function(evt) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
                }, false);
                dropZone.addEventListener('drop', function(evt) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    var files = evt.dataTransfer.files; // FileList object.
                    if(files.length > 0) {
                        var f = files[0];
                        var reader = new FileReader();
                        reader.onload = function(e) {
                            var tape_data = new Uint8Array(reader.result);
                            this.mz700comworker.setCassetteTape(tape_data, function(mztape_array) {
                                if(mztape_array != null) {
                                    $("#mzt_info").html(
                                            "MZT: '" + mztape_array[0].header.filename + "' (TO LOAD, USE L COMMAND)");
                                }
                            }.bind(this));
                        }.bind(this);
                        reader.readAsArrayBuffer(f);
                    }
                }.bind(this), false);
            }
            this.cmtMessageArea = $("<span/>").addClass("cmt-message");
            dataRecorder
                .append(this.btnCmtRec)
                .append(this.btnCmtPlay)
                .append(this.btnCmtStop)
                .append(this.btnCmtEject)
                .append(this.cmtMessageArea);

            //
            // Keyboard
            //
            var getKeyMatrix = function() { return {"strobe":0, "bit": 0};};
            var feedbackToKeyboard = function() {};
            var kb = $(".MZ-700 .keyboard").mz700keyboard("create", {
                onStateChange: function(strobe, bit, state) {
                    this.mz700comworker.setKeyState(strobe, bit, state, null);
                }.bind(this)
            });
            if(kb.length > 0) {
                getKeyMatrix = function(code) {
                    return kb.mz700keyboard("getMatPos", code);
                };
                feedbackToKeyboard = function(matrix, state) {
                    kb.mz700keyboard("setState", matrix.strobe, matrix.bit, state);
                };
                kb.DropDownPanel("create", {
                    "caption": "Keyboard",
                    "onOpen": this.opt.onKeyboardPanelOpen,
                    "onClose": this.opt.onKeyboardPanelClose
                });
            }

            //
            // キー入力
            //
            {

                //キーボードからの入力処理

                var keyAcceptanceState = true;
                var keystates = {};
                var updateKeyAcceptanceState = function() {
                    if(keyAcceptanceState) {
                        this.keyEventReceiver.addClass("on");
                    } else {
                        this.keyEventReceiver.removeClass("on");
                    }
                }.bind(this);
                var updateKeyStates = function (e, state) {
                    var code = e.keyCode;
                    if(!(code in keystates) || keystates[code] != state) {
                        keystates[code] = state;
                        var matrix = getKeyMatrix(code);
                        if(matrix != null) {
                            feedbackToKeyboard(matrix, state);
                            this.mz700comworker.setKeyState(matrix.strobe, matrix.bit, state, null);
                        }
                    }
                }.bind(this);

                //キーダウン
                window.onkeydown = function(e) {
                    if(keyAcceptanceState) {
                        updateKeyStates(e, true);
                        return false;
                    }
                };

                //キーアップ
                window.onkeyup = function(e) {
                    if(keyAcceptanceState) {
                        updateKeyStates(e, false);
                        return false;
                    }
                    else {
                        switch(e.keyCode) {
                        case 119://F8 - RUN
                            this.start();
                            break;
                        case 120://F9 - STOP
                            this.stop();
                            break;
                        case 121://F10 - STEP OVER
                            this.stepOver();
                            break;
                        case 122://F11 - STEP IN
                            this.stepIn();
                            break;
                        }
                    }
                }.bind(this);

                MZ700Js.prototype.acceptKey = function(state) {
                    keyAcceptanceState = state;
                    updateKeyAcceptanceState();
                };

                //画面クリック、キー入力ボタン等で、キー入力を受け付ける。
                $(".MZ-700 .key-switcher").click(function(event) {
                    keyAcceptanceState = true;
                    updateKeyAcceptanceState();
                    event.stopPropagation();
                }.bind(this));

                //ウィンドウクリックでキー入力解除
                $(window).click(function() {
                    keyAcceptanceState = false;
                    updateKeyAcceptanceState();
                });

                //初期状態でキー入力を受け付ける
                keyAcceptanceState = true;
                updateKeyAcceptanceState();
            }

            //
            // Create MZ-700 Worker
            //

            this.MMIO = MMIO.create();
            this.mz700comworker = TransWorker.create(
                this.opt.urlPrefix + "MZ-700/bundle-worker.min.js", MZ700, this, {
                    'onExecutionParameterUpdate': function(param) {
                        this.onExecutionParameterUpdate(param);
                    },
                    'onBreak': function() { this.stop(); },
                    'onUpdateScreen': (mz700scrn == null) ? function() {} :
                        function(updateData) { mz700scrn.write(updateData); },
                    'onMmioRead': function(param) {
                        this.MMIO.read(param.address, param.value);
                    },
                    'onMmioWrite': function(param) {
                        this.MMIO.write(param.address, param.value);
                    },
                    'onPortRead': function(param) { },
                    'onPortWrite': function(param) { },
                    'startSound': function(freq) { sound.startSound(freq); },
                    'stopSound': function() { sound.stopSound(); },
                    "onStartDataRecorder": function(){
                        this.btnCmtRec.prop("disabled", true);
                        this.btnCmtEject.prop("disabled", true);
                        this.btnCmtStop.prop("disabled", false);
                    }.bind(this),
                    "onStopDataRecorder": function(){
                        this.btnCmtRec.prop("disabled", false);
                        this.btnCmtEject.prop("disabled", false);
                        this.btnCmtStop.prop("disabled", true);
                    }.bind(this)
                }
            );

            this.PCG700 = require("../lib/PCG-700").create();
            this.PCG700.setScreen(mz700scrn);
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
                            this.showStatus();
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
                                this.showStatus();
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

            this.txtAsmSrc = $("<textarea type='text'/>");
            this.tabSource = $("<div/>");
            this.tabSource
                .append($("<button type='button'>Assemble</button>")
                        .click(function() {
                            this.forceAssemble = true;
                            this.assemble();
                            this.forceAssemble = false;
                        }.bind(this)))
                .append($("<br/>"))
                .append(this.txtAsmSrc).hide();
            this.autoAssemble = false;
            var setAutoAssemble = function(checked) {
                this.autoAssemble = checked;
            }.bind(this);
            $(".source-list")
                .append($("<div/>")
                        .append($("<button type='button'/>").click(function() {
                            this.forceAssemble = true;
                            this.assemble();
                            this.forceAssemble = false;
                        }.bind(this)).html("Syntax highlight"))
                        .append($("<button type='button'/>").click(function() {
                            this.showTabSource();
                        }.bind(this)).html("Plain text"))
                        .append($("<input type='checkbox'/>").click(function() {
                            setAutoAssemble($(this).prop('checked'));
                        }))
                        .append($("<span/>").html("Assemble on load MZT")))
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
                            this.mz700comworker.exec(1, function(result){
                                this.setCurrentExecLine();
                                this.showStatus();
                                this.updateUI();
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

        this.execParam = new FTParam(1, 1000, 7);
        this.mz700comworker.getExecutionParameter(function(param) {
            this.execParam.set(param);
        });
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
     *
     * PARAMETERS
     * ----------
     *
     * 1. name      MZT file's body name on the server
     *
     */
    MZ700Js.prototype.runServerMZT = function (name) {
        this.mz700comworker.stop(function() {
            this.isRunning = false;
            this.scrollToShowPC();
            this.setCurrentExecLine();
            this.showStatus();
            this.updateUI();
            $.getJSON("mzt", {"name": name}, function(tape_data) {
                this.setMztData(tape_data);
                this.setCurrentExecLine();
                this.showStatus();
                this.updateUI();
                this.start();
                this.acceptKey(true);
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
     * PARAMETERS
     * ----------
     *  1. tape_data    MZT tape data as byte array
     */
    MZ700Js.prototype.setMztData = function(tape_data) {
        this.mz700comworker.setCassetteTape(tape_data, function(mztape_array) {
            if(mztape_array != null) {
                $("#mzt_info").html("MZT: '" + mztape_array[0].header.filename + "' Loading...");
                this.mz700comworker.loadCassetteTape(function() {
                    $("#mzt_info").html("MZT: '" + mztape_array[0].header.filename + "' Loading......");
                    this.mz700comworker.disassemble(mztape_array, function(result) {
                        var outbuf = result.outbuf;
                        var dasmlines = result.dasmline;
                        this.txtAsmSrc.val(outbuf);
                        $("#mzt_info").html("MZT: '" + mztape_array[0].header.filename + "' Loaded");
                        this.assemble(function() {
                            this.mz700comworker.setPC(mztape_array[0].header.addr_exec, function() {
                                $("#mzt_info").html("MZT: '" + mztape_array[0].header.filename + "'");
                                this.setCurrentExecLine();
                                this.showStatus();
                                this.updateUI();
                            }.bind(this));
                        }.bind(this));
                    }.bind(this));
                }.bind(this));
            }
        }.bind(this));
    };

    MZ700Js.prototype.reset = function(callback) {
        this.clearCurrentExecLine();
        this.mz700comworker.stop(function() {
            this.isRunning = false;
            this.setCurrentExecLine();
            this.showStatus();
            this.updateUI();
            this.mz700comworker.reset(function() {
                this.txtAsmSrc.val($($("textarea.default.source").get(0)).val());
                this.assemble(function() {
                    this.scrollToShowPC();
                    this.setCurrentExecLine();
                    this.showStatus();
                    this.updateUI();
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
        this.clearCurrentExecLine();
        this.mz700comworker.start(function(success) {
            if(success) {
                this.isRunning = true;
                this.updateUI();
            }
        }.bind(this));
    };
    MZ700Js.prototype.stop = function() {
        this.mz700comworker.stop(function() {
            this.isRunning = false;
            this.scrollToShowPC();
            this.setCurrentExecLine();
            this.showStatus();
            this.updateUI();
        }.bind(this));
    };
    MZ700Js.prototype.stepIn = function() {
        this.clearCurrentExecLine();
        this.mz700comworker.exec(1, function(result){
            this.setCurrentExecLine();
            this.showStatus();
            this.updateUI();
            this.scrollToShowPC();
        }.bind(this));
    };
    MZ700Js.prototype.stepOver = function() {
        this.stepIn();
    };

    MZ700Js.prototype.updateExecutionParameter = function() {
        console.log("MZ700Js.updateExecutionParameter", JSON.stringify(this.execParam.get()));
        this.mz700comworker.setExecutionParameter(this.execParam.get(), function(){});
    };
    MZ700Js.prototype.onExecutionParameterUpdate = function(param) {
        console.log("MZ700Js.onExecutionParameterUpdate", JSON.stringify(param));
        this.execParam.set(param);
        this.sliderExecParamNumOfTimer.val(param.numOfTimer);
        $("#exec-param1").html(param.numOfTimer);
        this.sliderExecParamNumOfExecInst.val(param.numOfExecInst);
        $("#exec-param2").html(param.numOfExecInst);
        this.sliderExecParamTimerInterval.val(param.timerInterval);
        $("#exec-param3").html(param.timerInterval);
    };


    MZ700Js.prototype.updateUI = function() {
        this.btnReset.prop('disabled', '');
        if(!this.isRunning) {
            this.btnStop.prop('disabled', 'disabled');
            this.btnStart.prop('disabled', '');
            this.btnStep.prop('disabled', '');
        } else {
            this.btnStop.prop('disabled', '');
            this.btnStart.prop('disabled', 'disabled');
            this.btnStep.prop('disabled', 'disabled');
        }
    };

    MZ700Js.prototype.showStatus = function () {
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
        if(this.forceAssemble || this.autoAssemble) {
            MZ700Js.prototype._assemble.call(this, function() {
                this.showTabAsmList();
                if(callback) {
                    callback();
                }
            }.bind(this));
        } else {
            this.showTabSource();
            if(callback) {
                callback();
            }
        }
    };
    MZ700Js.prototype._assemble = function(callback) {
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
                this.mz700comworker.writeAsmCode(this.assembled, function(execAddr) {
                    this.mz700comworker.setPC(execAddr, function() {
                        this.setCurrentExecLine();
                        this.showStatus();
                        callback();
                    });
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };
    module.exports = MZ700Js;
}());
