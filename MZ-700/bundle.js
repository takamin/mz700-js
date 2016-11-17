(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var MZ700_Sound = require("../MZ-700/sound.js");
    require("../lib/jquery.ddpanel.js");
    require("../lib/jquery.soundctrl.js");
    require("../lib/jquery.Z80-mem.js");
    require("../lib/jquery.Z80-reg.js");
    require("../lib/jquery.MZ-700-vram");
    require("../lib/jquery.MZ-700-kb.js");

    var MZ700Js = function() {
        this.opt = {
            "urlPrefix": ""
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
                    this.mz700comworker.stop(function() {
                        this.isRunning = false;
                        this.setCurrentExecLine();
                        this.showStatus();
                        this.updateUI();
                        this.scrollToShowPC();
                    }.bind(this));
                }.bind(this));
            this.btnStep = $("<button/>").attr("type", "button")
                .html("Step").click(function() {
                    this.clearCurrentExecLine();
                    this.mz700comworker.exec(1, function(result){
                        this.setCurrentExecLine();
                        this.showStatus();
                        this.updateUI();
                        this.scrollToShowPC();
                    }.bind(this));
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
                .append(this.btnStep);

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
            this.btnCmtSet = $("<button/>").attr("type", "button")
                .html("SET").click(function() {
                    this.mz700comworker.dataRecorder_setCmt([],
                        function(bytes) {
                            console.log("SET callback");
                        });
                }.bind(this));
            this.cmtMessageArea = $("<span/>").addClass("cmt-message");
            dataRecorder
                .append(this.btnCmtRec)
                //.append(this.btnCmtPlay)
                //.append(this.btnCmtStop)
                .append(this.btnCmtEject)
                //.append(this.btnCmtSet)
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
                kb.DropDownPanel("create", { "caption" : "Keyboard" });
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
                };

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

            this.MMIO = require("../MZ-700/mmio").create();
            this.mz700comworker = TransWorker.create(
                this.opt.urlPrefix + "MZ-700/worker.js", MZ700, this, {
                    'running': function() { this.showStatus(); },
                    'started': function() { },
                    'break': function() { this.stop(); },

                    'updateScreen': (mz700scrn == null) ? function() {} :
                        function(updateData) { mz700scrn.write(updateData); },
                    'onMmioRead': function(param) {
                        this.MMIO.read(param.address, param.value);
                    },
                    'onMmioWrite': function(param) {
                        this.MMIO.write(param.address, param.value);
                    },
                    'startSound': function(freq) { sound.startSound(freq); },
                    'stopSound': function() { sound.stopSound(); },
                    "onStartDataRecorder": function(){
                        this.btnCmtRec.prop("disabled", true);
                        this.btnCmtEject.prop("disabled", true);
                    }.bind(this),
                    "onStopDataRecorder": function(){
                        this.btnCmtRec.prop("disabled", false);
                        this.btnCmtEject.prop("disabled", false);
                        this.mz700comworker.dataRecorder_ejectCmt(
                            function(bytes) {
                                console.log("EJECT callback");
                                if(bytes == null || bytes.length < 128) {
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
                                                header.addr_exec.HEX(4))
                                        );
                            }.bind(this));
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
            this.mz700comworker.reset(function() {
                this.txtAsmSrc.val($($("textarea.default.source").get(0)).val());
                this.assemble(function() {
                    this.showStatus();
                    this.updateUI();
                    if(callback) {
                        callback();
                    }
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };
    MZ700Js.EXEC_TIMER_INTERVAL = 100;
    MZ700Js.NUM_OF_EXEC_OPCODE = 20000;
    MZ700Js.prototype.start = function() {
        this.clearCurrentExecLine();
        this.mz700comworker.start(function() {
            this.isRunning = true;
            this.updateUI();
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

},{"../MZ-700/mmio":2,"../MZ-700/sound.js":3,"../lib/PCG-700":5,"../lib/jquery.MZ-700-kb.js":6,"../lib/jquery.MZ-700-vram":7,"../lib/jquery.Z80-mem.js":8,"../lib/jquery.Z80-reg.js":9,"../lib/jquery.ddpanel.js":10,"../lib/jquery.soundctrl.js":11,"jquery":4}],2:[function(require,module,exports){
(function() {
    "use strict";

    //
    // Memory Mapped I/O
    //
    var MMIO = function () {
        this.mmio = [ ];
        for(var addr = 0xE000; addr < 0xE800; addr++) {
            this.mmio.push({ "r":[],"w":[] });
        }
    };
    window.MMIO = MMIO;

    // Map a peripheral to adresses
    MMIO.prototype.entry = function (peripheral, inputs, outputs)
    {
        inputs.forEach(function(address) {
            if(!("readMMIO" in peripheral) ||
                    typeof(peripheral.readMMIO) != "function" )
            {
                console.error(
                        "The periferal does not have a method 'readMMIO' "
                        + "for memory mapped I/O at", address.HEX(4) + "h");
            } else {
                this.mmio[address - 0xE000].r.push(peripheral);
            }
        }, this);
        outputs.forEach(function(address) {
            if(!("writeMMIO" in peripheral) ||
                    typeof(peripheral.readMMIO) != "function" )
            {
                console.error(
                        "The periferal does not have a method 'writeMMIO' "
                        + "for memory mapped I/O at", address.HEX(4) + "h");
            } else {
                this.mmio[address - 0xE000].w.push(peripheral);
            }
        }, this);
    };

    // Read MMIO
    MMIO.prototype.read = function(address, value) {
        this.mmio[address - 0xE000].r.forEach(function(peripheral) {
            value = peripheral.readMMIO(address, value);
        });
        return read;
    };

    // Write MMIO
    MMIO.prototype.write = function(address, value) {
        this.mmio[address - 0xE000].w.forEach(function(peripheral) {
            value = peripheral.writeMMIO(address, value);
        });
    };

    module.exports = {
        "create": function() { return new MMIO(); }
    };
}());


},{}],3:[function(require,module,exports){
(function() {
    var MZ700_Sound = function() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        if(window.AudioContext) {
            this.audio = { ctx: new AudioContext(), osc: null };
        } else {
            console.warn("NO AudioContext API supported by this browser.");
            this.setGain = function(){};
            this.startSound = function(){};
            this.stopSound = function(){};
        }
    };
    MZ700_Sound.prototype.setGain = function(gain) {
        if(gain < 0) {
            gain = 0;
        }
        if(gain > 1.0) {
            gain = 1.0;
        }
        this.gain = gain;
        if(this.gainNode) {
            this.gainNode.gain.value = this.gain;
        }
    };
    MZ700_Sound.prototype.startSound = function(freq) {
        if(this.audio.osc != null) {
            if(this.audio.osc.frequency.value == freq) {
                return;
            }
            this.audio.osc.stop();
            this.audio.osc.disconnect();
        }
        this.audio.osc = this.audio.ctx.createOscillator();
        this.audio.osc.start = this.audio.osc.start || this.audio.osc.noteOn;
        this.audio.osc.frequency.value = freq;
        this.gainNode = this.audio.ctx.createGain();
        this.gainNode.gain.setValueAtTime(this.gain* 0.0, this.audio.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(this.gain * 0.7, this.audio.ctx.currentTime + 0.005);
        this.gainNode.gain.linearRampToValueAtTime(this.gain * 1.0, this.audio.ctx.currentTime + 0.010);
        this.gainNode.gain.linearRampToValueAtTime(this.gain * 0.5, this.audio.ctx.currentTime + 0.090);
        this.audio.osc.connect(this.gainNode);
        this.gainNode.connect(this.audio.ctx.destination);
        this.audio.startTime = (new Date()).getTime();
        this.audio.osc.start();
    };
    MZ700_Sound.prototype.stopSound = function() {
        if(this.audio.osc != null) {
            if((new Date()).getTime() - this.audio.startTime >= 10) {
                this.audio.osc.stop();
                this.audio.osc.disconnect();
            } else {
                window.setTimeout(
                    (function(osc) {
                        return function() {
                            osc.stop();
                            osc.disconnect();
                        };
                    }(this.audio.osc)),
                    100);
            }
            //this.audio.osc = null;
        }
    };
    module.exports = MZ700_Sound;
}());

},{}],4:[function(require,module,exports){
/*!
 * jQuery JavaScript Library v3.1.1
 * https://jquery.com/
 *
 * Includes Sizzle.js
 * https://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2016-09-22T22:30Z
 */
( function( global, factory ) {

	"use strict";

	if ( typeof module === "object" && typeof module.exports === "object" ) {

		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
} )( typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Edge <= 12 - 13+, Firefox <=18 - 45+, IE 10 - 11, Safari 5.1 - 9+, iOS 6 - 9.1
// throw exceptions when non-strict code (e.g., ASP.NET 4.5) accesses strict mode
// arguments.callee.caller (trac-13335). But as of jQuery 3.0 (2016), strict mode should be common
// enough that all such attempts are guarded in a try block.
"use strict";

var arr = [];

var document = window.document;

var getProto = Object.getPrototypeOf;

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var fnToString = hasOwn.toString;

var ObjectFunctionString = fnToString.call( Object );

var support = {};



	function DOMEval( code, doc ) {
		doc = doc || document;

		var script = doc.createElement( "script" );

		script.text = code;
		doc.head.appendChild( script ).parentNode.removeChild( script );
	}
/* global Symbol */
// Defining this global in .eslintrc.json would create a danger of using the global
// unguarded in another place, it seems safer to define global only for this module



var
	version = "3.1.1",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android <=4.0 only
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

	// Matches dashed string for camelizing
	rmsPrefix = /^-ms-/,
	rdashAlpha = /-([a-z])/g,

	// Used by jQuery.camelCase as callback to replace()
	fcamelCase = function( all, letter ) {
		return letter.toUpperCase();
	};

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {

		// Return all the elements in a clean array
		if ( num == null ) {
			return slice.call( this );
		}

		// Return just the one element from the set
		return num < 0 ? this[ num + this.length ] : this[ num ];
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction( target ) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = jQuery.isArray( copy ) ) ) ) {

					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && jQuery.isArray( src ) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject( src ) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isFunction: function( obj ) {
		return jQuery.type( obj ) === "function";
	},

	isArray: Array.isArray,

	isWindow: function( obj ) {
		return obj != null && obj === obj.window;
	},

	isNumeric: function( obj ) {

		// As of jQuery 3.0, isNumeric is limited to
		// strings and numbers (primitives or objects)
		// that can be coerced to finite numbers (gh-2662)
		var type = jQuery.type( obj );
		return ( type === "number" || type === "string" ) &&

			// parseFloat NaNs numeric-cast false positives ("")
			// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
			// subtraction forces infinities to NaN
			!isNaN( obj - parseFloat( obj ) );
	},

	isPlainObject: function( obj ) {
		var proto, Ctor;

		// Detect obvious negatives
		// Use toString instead of jQuery.type to catch host objects
		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
			return false;
		}

		proto = getProto( obj );

		// Objects with no prototype (e.g., `Object.create( null )`) are plain
		if ( !proto ) {
			return true;
		}

		// Objects with prototype are plain iff they were constructed by a global Object function
		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
	},

	isEmptyObject: function( obj ) {

		/* eslint-disable no-unused-vars */
		// See https://github.com/eslint/eslint/issues/6125
		var name;

		for ( name in obj ) {
			return false;
		}
		return true;
	},

	type: function( obj ) {
		if ( obj == null ) {
			return obj + "";
		}

		// Support: Android <=2.3 only (functionish RegExp)
		return typeof obj === "object" || typeof obj === "function" ?
			class2type[ toString.call( obj ) ] || "object" :
			typeof obj;
	},

	// Evaluates a script in a global context
	globalEval: function( code ) {
		DOMEval( code );
	},

	// Convert dashed to camelCase; used by the css and data modules
	// Support: IE <=9 - 11, Edge 12 - 13
	// Microsoft forgot to hump their vendor prefix (#9572)
	camelCase: function( string ) {
		return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android <=4.0 only
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	// Support: Android <=4.0 only, PhantomJS 1 only
	// push.apply(_, arraylike) throws on ancient WebKit
	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var length, value,
			i = 0,
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArrayLike( elems ) ) {
			length = elems.length;
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// Bind a function to a context, optionally partially applying any
	// arguments.
	proxy: function( fn, context ) {
		var tmp, args, proxy;

		if ( typeof context === "string" ) {
			tmp = fn[ context ];
			context = fn;
			fn = tmp;
		}

		// Quick check to determine if target is callable, in the spec
		// this throws a TypeError, but we will just return undefined.
		if ( !jQuery.isFunction( fn ) ) {
			return undefined;
		}

		// Simulated bind
		args = slice.call( arguments, 2 );
		proxy = function() {
			return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
		};

		// Set the guid of unique handler to the same of original handler, so it can be removed
		proxy.guid = fn.guid = fn.guid || jQuery.guid++;

		return proxy;
	},

	now: Date.now,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
} );

if ( typeof Symbol === "function" ) {
	jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
}

// Populate the class2type map
jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
function( i, name ) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
} );

function isArrayLike( obj ) {

	// Support: real iOS 8.2 only (not reproducible in simulator)
	// `in` check used to prevent JIT error (gh-2145)
	// hasOwn isn't used here due to false negatives
	// regarding Nodelist length in IE
	var length = !!obj && "length" in obj && obj.length,
		type = jQuery.type( obj );

	if ( type === "function" || jQuery.isWindow( obj ) ) {
		return false;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}
var Sizzle =
/*!
 * Sizzle CSS Selector Engine v2.3.3
 * https://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2016-08-08
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + 1 * new Date(),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf as it's faster than native
	// https://jsperf.com/thor-indexof-vs-for/5
	indexOf = function( list, elem ) {
		var i = 0,
			len = list.length;
		for ( ; i < len; i++ ) {
			if ( list[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",

	// http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + identifier + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + identifier + ")" ),
		"CLASS": new RegExp( "^\\.(" + identifier + ")" ),
		"TAG": new RegExp( "^(" + identifier + "|[*])" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,

	// CSS escapes
	// http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// CSS string/identifier serialization
	// https://drafts.csswg.org/cssom/#common-serializing-idioms
	rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,
	fcssescape = function( ch, asCodePoint ) {
		if ( asCodePoint ) {

			// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
			if ( ch === "\0" ) {
				return "\uFFFD";
			}

			// Control characters and (dependent upon position) numbers get escaped as code points
			return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
		}

		// Other potentially-special ASCII characters get backslash-escaped
		return "\\" + ch;
	},

	// Used for iframes
	// See setDocument()
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE
	unloadHandler = function() {
		setDocument();
	},

	disabledAncestor = addCombinator(
		function( elem ) {
			return elem.disabled === true && ("form" in elem || "label" in elem);
		},
		{ dir: "parentNode", next: "legend" }
	);

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var m, i, elem, nid, match, groups, newSelector,
		newContext = context && context.ownerDocument,

		// nodeType defaults to 9, since context defaults to document
		nodeType = context ? context.nodeType : 9;

	results = results || [];

	// Return early from calls with invalid selector or context
	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	// Try to shortcut find operations (as opposed to filters) in HTML documents
	if ( !seed ) {

		if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
			setDocument( context );
		}
		context = context || document;

		if ( documentIsHTML ) {

			// If the selector is sufficiently simple, try using a "get*By*" DOM method
			// (excepting DocumentFragment context, where the methods don't exist)
			if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {

				// ID selector
				if ( (m = match[1]) ) {

					// Document context
					if ( nodeType === 9 ) {
						if ( (elem = context.getElementById( m )) ) {

							// Support: IE, Opera, Webkit
							// TODO: identify versions
							// getElementById can match elements by name instead of ID
							if ( elem.id === m ) {
								results.push( elem );
								return results;
							}
						} else {
							return results;
						}

					// Element context
					} else {

						// Support: IE, Opera, Webkit
						// TODO: identify versions
						// getElementById can match elements by name instead of ID
						if ( newContext && (elem = newContext.getElementById( m )) &&
							contains( context, elem ) &&
							elem.id === m ) {

							results.push( elem );
							return results;
						}
					}

				// Type selector
				} else if ( match[2] ) {
					push.apply( results, context.getElementsByTagName( selector ) );
					return results;

				// Class selector
				} else if ( (m = match[3]) && support.getElementsByClassName &&
					context.getElementsByClassName ) {

					push.apply( results, context.getElementsByClassName( m ) );
					return results;
				}
			}

			// Take advantage of querySelectorAll
			if ( support.qsa &&
				!compilerCache[ selector + " " ] &&
				(!rbuggyQSA || !rbuggyQSA.test( selector )) ) {

				if ( nodeType !== 1 ) {
					newContext = context;
					newSelector = selector;

				// qSA looks outside Element context, which is not what we want
				// Thanks to Andrew Dupont for this workaround technique
				// Support: IE <=8
				// Exclude object elements
				} else if ( context.nodeName.toLowerCase() !== "object" ) {

					// Capture the context ID, setting it first if necessary
					if ( (nid = context.getAttribute( "id" )) ) {
						nid = nid.replace( rcssescape, fcssescape );
					} else {
						context.setAttribute( "id", (nid = expando) );
					}

					// Prefix every selector in the list
					groups = tokenize( selector );
					i = groups.length;
					while ( i-- ) {
						groups[i] = "#" + nid + " " + toSelector( groups[i] );
					}
					newSelector = groups.join( "," );

					// Expand context for sibling selectors
					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
						context;
				}

				if ( newSelector ) {
					try {
						push.apply( results,
							newContext.querySelectorAll( newSelector )
						);
						return results;
					} catch ( qsaError ) {
					} finally {
						if ( nid === expando ) {
							context.removeAttribute( "id" );
						}
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {function(string, object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created element and returns a boolean result
 */
function assert( fn ) {
	var el = document.createElement("fieldset");

	try {
		return !!fn( el );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( el.parentNode ) {
			el.parentNode.removeChild( el );
		}
		// release memory in IE
		el = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = arr.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			a.sourceIndex - b.sourceIndex;

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for :enabled/:disabled
 * @param {Boolean} disabled true for :disabled; false for :enabled
 */
function createDisabledPseudo( disabled ) {

	// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
	return function( elem ) {

		// Only certain elements can match :enabled or :disabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
		if ( "form" in elem ) {

			// Check for inherited disabledness on relevant non-disabled elements:
			// * listed form-associated elements in a disabled fieldset
			//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
			// * option elements in a disabled optgroup
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
			// All such elements have a "form" property.
			if ( elem.parentNode && elem.disabled === false ) {

				// Option elements defer to a parent optgroup if present
				if ( "label" in elem ) {
					if ( "label" in elem.parentNode ) {
						return elem.parentNode.disabled === disabled;
					} else {
						return elem.disabled === disabled;
					}
				}

				// Support: IE 6 - 11
				// Use the isDisabled shortcut property to check for disabled fieldset ancestors
				return elem.isDisabled === disabled ||

					// Where there is no isDisabled, check manually
					/* jshint -W018 */
					elem.isDisabled !== !disabled &&
						disabledAncestor( elem ) === disabled;
			}

			return elem.disabled === disabled;

		// Try to winnow out elements that can't be disabled before trusting the disabled property.
		// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
		// even exist on them, let alone have a boolean value.
		} else if ( "label" in elem ) {
			return elem.disabled === disabled;
		}

		// Remaining elements are neither :enabled nor :disabled
		return false;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare, subWindow,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// Return early if doc is invalid or already selected
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Update global variables
	document = doc;
	docElem = document.documentElement;
	documentIsHTML = !isXML( document );

	// Support: IE 9-11, Edge
	// Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
	if ( preferredDoc !== document &&
		(subWindow = document.defaultView) && subWindow.top !== subWindow ) {

		// Support: IE 11, Edge
		if ( subWindow.addEventListener ) {
			subWindow.addEventListener( "unload", unloadHandler, false );

		// Support: IE 9 - 10 only
		} else if ( subWindow.attachEvent ) {
			subWindow.attachEvent( "onunload", unloadHandler );
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties
	// (excepting IE8 booleans)
	support.attributes = assert(function( el ) {
		el.className = "i";
		return !el.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( el ) {
		el.appendChild( document.createComment("") );
		return !el.getElementsByTagName("*").length;
	});

	// Support: IE<9
	support.getElementsByClassName = rnative.test( document.getElementsByClassName );

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programmatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( el ) {
		docElem.appendChild( el ).id = expando;
		return !document.getElementsByName || !document.getElementsByName( expando ).length;
	});

	// ID filter and find
	if ( support.getById ) {
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var elem = context.getElementById( id );
				return elem ? [ elem ] : [];
			}
		};
	} else {
		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" &&
					elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};

		// Support: IE 6 - 7 only
		// getElementById is not reliable as a find shortcut
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var node, i, elems,
					elem = context.getElementById( id );

				if ( elem ) {

					// Verify the id attribute
					node = elem.getAttributeNode("id");
					if ( node && node.value === id ) {
						return [ elem ];
					}

					// Fall back on getElementsByName
					elems = context.getElementsByName( id );
					i = 0;
					while ( (elem = elems[i++]) ) {
						node = elem.getAttributeNode("id");
						if ( node && node.value === id ) {
							return [ elem ];
						}
					}
				}

				return [];
			}
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( tag );

			// DocumentFragment nodes don't have gEBTN
			} else if ( support.qsa ) {
				return context.querySelectorAll( tag );
			}
		} :

		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See https://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( document.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( el ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// https://bugs.jquery.com/ticket/12359
			docElem.appendChild( el ).innerHTML = "<a id='" + expando + "'></a>" +
				"<select id='" + expando + "-\r\\' msallowcapture=''>" +
				"<option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// https://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( el.querySelectorAll("[msallowcapture^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !el.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
			if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
				rbuggyQSA.push("~=");
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !el.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}

			// Support: Safari 8+, iOS 8+
			// https://bugs.webkit.org/show_bug.cgi?id=136851
			// In-page `selector#id sibling-combinator selector` fails
			if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
				rbuggyQSA.push(".#.+[+~]");
			}
		});

		assert(function( el ) {
			el.innerHTML = "<a href='' disabled='disabled'></a>" +
				"<select disabled='disabled'><option/></select>";

			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = document.createElement("input");
			input.setAttribute( "type", "hidden" );
			el.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( el.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( el.querySelectorAll(":enabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Support: IE9-11+
			// IE's :disabled selector does not pick up the children of disabled fieldsets
			docElem.appendChild( el ).disabled = true;
			if ( el.querySelectorAll(":disabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			el.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( el ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( el, "*" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( el, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully self-exclusive
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === document || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === document || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === document ? -1 :
				b === document ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return document;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		!compilerCache[ expr + " " ] &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch (e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.escape = function( sel ) {
	return (sel + "").replace( rcssescape, fcssescape );
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, uniqueCache, outerCache, node, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType,
						diff = false;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) {

										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {

							// Seek `elem` from a previously-cached index

							// ...in a gzip-friendly way
							node = parent;
							outerCache = node[ expando ] || (node[ expando ] = {});

							// Support: IE <9 only
							// Defend against cloned attroperties (jQuery gh-1709)
							uniqueCache = outerCache[ node.uniqueID ] ||
								(outerCache[ node.uniqueID ] = {});

							cache = uniqueCache[ type ] || [];
							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
							diff = nodeIndex && cache[ 2 ];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						} else {
							// Use previously-cached element index if available
							if ( useCache ) {
								// ...in a gzip-friendly way
								node = elem;
								outerCache = node[ expando ] || (node[ expando ] = {});

								// Support: IE <9 only
								// Defend against cloned attroperties (jQuery gh-1709)
								uniqueCache = outerCache[ node.uniqueID ] ||
									(outerCache[ node.uniqueID ] = {});

								cache = uniqueCache[ type ] || [];
								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
								diff = nodeIndex;
							}

							// xml :nth-child(...)
							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
							if ( diff === false ) {
								// Use the same loop as above to seek `elem` from the start
								while ( (node = ++nodeIndex && node && node[ dir ] ||
									(diff = nodeIndex = 0) || start.pop()) ) {

									if ( ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) &&
										++diff ) {

										// Cache the index of each encountered element
										if ( useCache ) {
											outerCache = node[ expando ] || (node[ expando ] = {});

											// Support: IE <9 only
											// Defend against cloned attroperties (jQuery gh-1709)
											uniqueCache = outerCache[ node.uniqueID ] ||
												(outerCache[ node.uniqueID ] = {});

											uniqueCache[ type ] = [ dirruns, diff ];
										}

										if ( node === elem ) {
											break;
										}
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					// Don't keep the element (issue #299)
					input[0] = null;
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": createDisabledPseudo( false ),
		"disabled": createDisabledPseudo( true ),

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		skip = combinator.next,
		key = skip || dir,
		checkNonElements = base && key === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
			return false;
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, uniqueCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});

						// Support: IE <9 only
						// Defend against cloned attroperties (jQuery gh-1709)
						uniqueCache = outerCache[ elem.uniqueID ] || (outerCache[ elem.uniqueID ] = {});

						if ( skip && skip === elem.nodeName.toLowerCase() ) {
							elem = elem[ dir ] || elem;
						} else if ( (oldCache = uniqueCache[ key ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							uniqueCache[ key ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
			return false;
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
			// Avoid hanging onto element (issue #299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context === document || context || outermost;
			}

			// Add elements passing elementMatchers directly to results
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					if ( !context && elem.ownerDocument !== document ) {
						setDocument( elem );
						xml = !documentIsHTML;
					}
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context || document, xml) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// `i` is now the count of elements visited above, and adding it to `matchedCount`
			// makes the latter nonnegative.
			matchedCount += i;

			// Apply set filters to unmatched elements
			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
			// no element matchers and no seed.
			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
			// numerically zero.
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is only one selector in the list and no seed
	// (the latter of which guarantees us context)
	if ( match.length === 1 ) {

		// Reduce context if the leading compound selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome 14-35+
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( el ) {
	// Should return 1, but returns 4 (following)
	return el.compareDocumentPosition( document.createElement("fieldset") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// https://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( el ) {
	el.innerHTML = "<a href='#'></a>";
	return el.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( el ) {
	el.innerHTML = "<input/>";
	el.firstChild.setAttribute( "value", "" );
	return el.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( el ) {
	return el.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

return Sizzle;

})( window );



jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;

// Deprecated
jQuery.expr[ ":" ] = jQuery.expr.pseudos;
jQuery.uniqueSort = jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;
jQuery.escapeSelector = Sizzle.escape;




var dir = function( elem, dir, until ) {
	var matched = [],
		truncate = until !== undefined;

	while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
		if ( elem.nodeType === 1 ) {
			if ( truncate && jQuery( elem ).is( until ) ) {
				break;
			}
			matched.push( elem );
		}
	}
	return matched;
};


var siblings = function( n, elem ) {
	var matched = [];

	for ( ; n; n = n.nextSibling ) {
		if ( n.nodeType === 1 && n !== elem ) {
			matched.push( n );
		}
	}

	return matched;
};


var rneedsContext = jQuery.expr.match.needsContext;

var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



var risSimple = /^.[^:#\[\.,]*$/;

// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( jQuery.isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			return !!qualifier.call( elem, i, elem ) !== not;
		} );
	}

	// Single element
	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		} );
	}

	// Arraylike of elements (jQuery, arguments, Array)
	if ( typeof qualifier !== "string" ) {
		return jQuery.grep( elements, function( elem ) {
			return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
		} );
	}

	// Simple selector that can be filtered directly, removing non-Elements
	if ( risSimple.test( qualifier ) ) {
		return jQuery.filter( qualifier, elements, not );
	}

	// Complex selector, compare the two sets, removing non-Elements
	qualifier = jQuery.filter( qualifier, elements );
	return jQuery.grep( elements, function( elem ) {
		return ( indexOf.call( qualifier, elem ) > -1 ) !== not && elem.nodeType === 1;
	} );
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	if ( elems.length === 1 && elem.nodeType === 1 ) {
		return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
	}

	return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
		return elem.nodeType === 1;
	} ) );
};

jQuery.fn.extend( {
	find: function( selector ) {
		var i, ret,
			len = this.length,
			self = this;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter( function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			} ) );
		}

		ret = this.pushStack( [] );

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		return len > 1 ? jQuery.uniqueSort( ret ) : ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow( this, selector || [], false ) );
	},
	not: function( selector ) {
		return this.pushStack( winnow( this, selector || [], true ) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
} );


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
	// Strict HTML recognition (#11290: must start with <)
	// Shortcut simple #id case for speed
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

	init = jQuery.fn.init = function( selector, context, root ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Method init() accepts an alternate rootjQuery
		// so migrate can support jQuery.sub (gh-2101)
		root = root || rootjQuery;

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector[ 0 ] === "<" &&
				selector[ selector.length - 1 ] === ">" &&
				selector.length >= 3 ) {

				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && ( match[ 1 ] || !context ) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[ 1 ] ) {
					context = context instanceof jQuery ? context[ 0 ] : context;

					// Option to run scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[ 1 ],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {

							// Properties of context are called as methods if possible
							if ( jQuery.isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[ 2 ] );

					if ( elem ) {

						// Inject the element directly into the jQuery object
						this[ 0 ] = elem;
						this.length = 1;
					}
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || root ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this[ 0 ] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( jQuery.isFunction( selector ) ) {
			return root.ready !== undefined ?
				root.ready( selector ) :

				// Execute immediately if ready is not present
				selector( jQuery );
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,

	// Methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.fn.extend( {
	has: function( target ) {
		var targets = jQuery( target, this ),
			l = targets.length;

		return this.filter( function() {
			var i = 0;
			for ( ; i < l; i++ ) {
				if ( jQuery.contains( this, targets[ i ] ) ) {
					return true;
				}
			}
		} );
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			targets = typeof selectors !== "string" && jQuery( selectors );

		// Positional selectors never match, since there's no _selection_ context
		if ( !rneedsContext.test( selectors ) ) {
			for ( ; i < l; i++ ) {
				for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

					// Always skip document fragments
					if ( cur.nodeType < 11 && ( targets ?
						targets.index( cur ) > -1 :

						// Don't pass non-elements to Sizzle
						cur.nodeType === 1 &&
							jQuery.find.matchesSelector( cur, selectors ) ) ) {

						matched.push( cur );
						break;
					}
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
	},

	// Determine the position of an element within the set
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
		}

		// Index in selector
		if ( typeof elem === "string" ) {
			return indexOf.call( jQuery( elem ), this[ 0 ] );
		}

		// Locate the position of the desired element
		return indexOf.call( this,

			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[ 0 ] : elem
		);
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.uniqueSort(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter( selector )
		);
	}
} );

function sibling( cur, dir ) {
	while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
	return cur;
}

jQuery.each( {
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return siblings( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return siblings( elem.firstChild );
	},
	contents: function( elem ) {
		return elem.contentDocument || jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var matched = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			matched = jQuery.filter( selector, matched );
		}

		if ( this.length > 1 ) {

			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				jQuery.uniqueSort( matched );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				matched.reverse();
			}
		}

		return this.pushStack( matched );
	};
} );
var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );



// Convert String-formatted options into Object-formatted ones
function createOptions( options ) {
	var object = {};
	jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	} );
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		createOptions( options ) :
		jQuery.extend( {}, options );

	var // Flag to know if list is currently firing
		firing,

		// Last fire value for non-forgettable lists
		memory,

		// Flag to know if list was already fired
		fired,

		// Flag to prevent firing
		locked,

		// Actual callback list
		list = [],

		// Queue of execution data for repeatable lists
		queue = [],

		// Index of currently firing callback (modified by add/remove as needed)
		firingIndex = -1,

		// Fire callbacks
		fire = function() {

			// Enforce single-firing
			locked = options.once;

			// Execute callbacks for all pending executions,
			// respecting firingIndex overrides and runtime changes
			fired = firing = true;
			for ( ; queue.length; firingIndex = -1 ) {
				memory = queue.shift();
				while ( ++firingIndex < list.length ) {

					// Run callback and check for early termination
					if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
						options.stopOnFalse ) {

						// Jump to end and forget the data so .add doesn't re-fire
						firingIndex = list.length;
						memory = false;
					}
				}
			}

			// Forget the data if we're done with it
			if ( !options.memory ) {
				memory = false;
			}

			firing = false;

			// Clean up if we're done firing for good
			if ( locked ) {

				// Keep an empty list if we have data for future add calls
				if ( memory ) {
					list = [];

				// Otherwise, this object is spent
				} else {
					list = "";
				}
			}
		},

		// Actual Callbacks object
		self = {

			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {

					// If we have memory from a past run, we should fire after adding
					if ( memory && !firing ) {
						firingIndex = list.length - 1;
						queue.push( memory );
					}

					( function add( args ) {
						jQuery.each( args, function( _, arg ) {
							if ( jQuery.isFunction( arg ) ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && jQuery.type( arg ) !== "string" ) {

								// Inspect recursively
								add( arg );
							}
						} );
					} )( arguments );

					if ( memory && !firing ) {
						fire();
					}
				}
				return this;
			},

			// Remove a callback from the list
			remove: function() {
				jQuery.each( arguments, function( _, arg ) {
					var index;
					while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
						list.splice( index, 1 );

						// Handle firing indexes
						if ( index <= firingIndex ) {
							firingIndex--;
						}
					}
				} );
				return this;
			},

			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ?
					jQuery.inArray( fn, list ) > -1 :
					list.length > 0;
			},

			// Remove all callbacks from the list
			empty: function() {
				if ( list ) {
					list = [];
				}
				return this;
			},

			// Disable .fire and .add
			// Abort any current/pending executions
			// Clear all callbacks and values
			disable: function() {
				locked = queue = [];
				list = memory = "";
				return this;
			},
			disabled: function() {
				return !list;
			},

			// Disable .fire
			// Also disable .add unless we have memory (since it would have no effect)
			// Abort any pending executions
			lock: function() {
				locked = queue = [];
				if ( !memory && !firing ) {
					list = memory = "";
				}
				return this;
			},
			locked: function() {
				return !!locked;
			},

			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( !locked ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					queue.push( args );
					if ( !firing ) {
						fire();
					}
				}
				return this;
			},

			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},

			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


function Identity( v ) {
	return v;
}
function Thrower( ex ) {
	throw ex;
}

function adoptValue( value, resolve, reject ) {
	var method;

	try {

		// Check for promise aspect first to privilege synchronous behavior
		if ( value && jQuery.isFunction( ( method = value.promise ) ) ) {
			method.call( value ).done( resolve ).fail( reject );

		// Other thenables
		} else if ( value && jQuery.isFunction( ( method = value.then ) ) ) {
			method.call( value, resolve, reject );

		// Other non-thenables
		} else {

			// Support: Android 4.0 only
			// Strict mode functions invoked without .call/.apply get global-object context
			resolve.call( undefined, value );
		}

	// For Promises/A+, convert exceptions into rejections
	// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
	// Deferred#then to conditionally suppress rejection.
	} catch ( value ) {

		// Support: Android 4.0 only
		// Strict mode functions invoked without .call/.apply get global-object context
		reject.call( undefined, value );
	}
}

jQuery.extend( {

	Deferred: function( func ) {
		var tuples = [

				// action, add listener, callbacks,
				// ... .then handlers, argument index, [final state]
				[ "notify", "progress", jQuery.Callbacks( "memory" ),
					jQuery.Callbacks( "memory" ), 2 ],
				[ "resolve", "done", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 0, "resolved" ],
				[ "reject", "fail", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 1, "rejected" ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				"catch": function( fn ) {
					return promise.then( null, fn );
				},

				// Keep pipe for back-compat
				pipe: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;

					return jQuery.Deferred( function( newDefer ) {
						jQuery.each( tuples, function( i, tuple ) {

							// Map tuples (progress, done, fail) to arguments (done, fail, progress)
							var fn = jQuery.isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

							// deferred.progress(function() { bind to newDefer or newDefer.notify })
							// deferred.done(function() { bind to newDefer or newDefer.resolve })
							// deferred.fail(function() { bind to newDefer or newDefer.reject })
							deferred[ tuple[ 1 ] ]( function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && jQuery.isFunction( returned.promise ) ) {
									returned.promise()
										.progress( newDefer.notify )
										.done( newDefer.resolve )
										.fail( newDefer.reject );
								} else {
									newDefer[ tuple[ 0 ] + "With" ](
										this,
										fn ? [ returned ] : arguments
									);
								}
							} );
						} );
						fns = null;
					} ).promise();
				},
				then: function( onFulfilled, onRejected, onProgress ) {
					var maxDepth = 0;
					function resolve( depth, deferred, handler, special ) {
						return function() {
							var that = this,
								args = arguments,
								mightThrow = function() {
									var returned, then;

									// Support: Promises/A+ section 2.3.3.3.3
									// https://promisesaplus.com/#point-59
									// Ignore double-resolution attempts
									if ( depth < maxDepth ) {
										return;
									}

									returned = handler.apply( that, args );

									// Support: Promises/A+ section 2.3.1
									// https://promisesaplus.com/#point-48
									if ( returned === deferred.promise() ) {
										throw new TypeError( "Thenable self-resolution" );
									}

									// Support: Promises/A+ sections 2.3.3.1, 3.5
									// https://promisesaplus.com/#point-54
									// https://promisesaplus.com/#point-75
									// Retrieve `then` only once
									then = returned &&

										// Support: Promises/A+ section 2.3.4
										// https://promisesaplus.com/#point-64
										// Only check objects and functions for thenability
										( typeof returned === "object" ||
											typeof returned === "function" ) &&
										returned.then;

									// Handle a returned thenable
									if ( jQuery.isFunction( then ) ) {

										// Special processors (notify) just wait for resolution
										if ( special ) {
											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special )
											);

										// Normal processors (resolve) also hook into progress
										} else {

											// ...and disregard older resolution values
											maxDepth++;

											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special ),
												resolve( maxDepth, deferred, Identity,
													deferred.notifyWith )
											);
										}

									// Handle all other returned values
									} else {

										// Only substitute handlers pass on context
										// and multiple values (non-spec behavior)
										if ( handler !== Identity ) {
											that = undefined;
											args = [ returned ];
										}

										// Process the value(s)
										// Default process is resolve
										( special || deferred.resolveWith )( that, args );
									}
								},

								// Only normal processors (resolve) catch and reject exceptions
								process = special ?
									mightThrow :
									function() {
										try {
											mightThrow();
										} catch ( e ) {

											if ( jQuery.Deferred.exceptionHook ) {
												jQuery.Deferred.exceptionHook( e,
													process.stackTrace );
											}

											// Support: Promises/A+ section 2.3.3.3.4.1
											// https://promisesaplus.com/#point-61
											// Ignore post-resolution exceptions
											if ( depth + 1 >= maxDepth ) {

												// Only substitute handlers pass on context
												// and multiple values (non-spec behavior)
												if ( handler !== Thrower ) {
													that = undefined;
													args = [ e ];
												}

												deferred.rejectWith( that, args );
											}
										}
									};

							// Support: Promises/A+ section 2.3.3.3.1
							// https://promisesaplus.com/#point-57
							// Re-resolve promises immediately to dodge false rejection from
							// subsequent errors
							if ( depth ) {
								process();
							} else {

								// Call an optional hook to record the stack, in case of exception
								// since it's otherwise lost when execution goes async
								if ( jQuery.Deferred.getStackHook ) {
									process.stackTrace = jQuery.Deferred.getStackHook();
								}
								window.setTimeout( process );
							}
						};
					}

					return jQuery.Deferred( function( newDefer ) {

						// progress_handlers.add( ... )
						tuples[ 0 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								jQuery.isFunction( onProgress ) ?
									onProgress :
									Identity,
								newDefer.notifyWith
							)
						);

						// fulfilled_handlers.add( ... )
						tuples[ 1 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								jQuery.isFunction( onFulfilled ) ?
									onFulfilled :
									Identity
							)
						);

						// rejected_handlers.add( ... )
						tuples[ 2 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								jQuery.isFunction( onRejected ) ?
									onRejected :
									Thrower
							)
						);
					} ).promise();
				},

				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 5 ];

			// promise.progress = list.add
			// promise.done = list.add
			// promise.fail = list.add
			promise[ tuple[ 1 ] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(
					function() {

						// state = "resolved" (i.e., fulfilled)
						// state = "rejected"
						state = stateString;
					},

					// rejected_callbacks.disable
					// fulfilled_callbacks.disable
					tuples[ 3 - i ][ 2 ].disable,

					// progress_callbacks.lock
					tuples[ 0 ][ 2 ].lock
				);
			}

			// progress_handlers.fire
			// fulfilled_handlers.fire
			// rejected_handlers.fire
			list.add( tuple[ 3 ].fire );

			// deferred.notify = function() { deferred.notifyWith(...) }
			// deferred.resolve = function() { deferred.resolveWith(...) }
			// deferred.reject = function() { deferred.rejectWith(...) }
			deferred[ tuple[ 0 ] ] = function() {
				deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
				return this;
			};

			// deferred.notifyWith = list.fireWith
			// deferred.resolveWith = list.fireWith
			// deferred.rejectWith = list.fireWith
			deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
		} );

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( singleValue ) {
		var

			// count of uncompleted subordinates
			remaining = arguments.length,

			// count of unprocessed arguments
			i = remaining,

			// subordinate fulfillment data
			resolveContexts = Array( i ),
			resolveValues = slice.call( arguments ),

			// the master Deferred
			master = jQuery.Deferred(),

			// subordinate callback factory
			updateFunc = function( i ) {
				return function( value ) {
					resolveContexts[ i ] = this;
					resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( !( --remaining ) ) {
						master.resolveWith( resolveContexts, resolveValues );
					}
				};
			};

		// Single- and empty arguments are adopted like Promise.resolve
		if ( remaining <= 1 ) {
			adoptValue( singleValue, master.done( updateFunc( i ) ).resolve, master.reject );

			// Use .then() to unwrap secondary thenables (cf. gh-3000)
			if ( master.state() === "pending" ||
				jQuery.isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

				return master.then();
			}
		}

		// Multiple arguments are aggregated like Promise.all array elements
		while ( i-- ) {
			adoptValue( resolveValues[ i ], updateFunc( i ), master.reject );
		}

		return master.promise();
	}
} );


// These usually indicate a programmer mistake during development,
// warn about them ASAP rather than swallowing them by default.
var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

jQuery.Deferred.exceptionHook = function( error, stack ) {

	// Support: IE 8 - 9 only
	// Console exists when dev tools are open, which can happen at any time
	if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
		window.console.warn( "jQuery.Deferred exception: " + error.message, error.stack, stack );
	}
};




jQuery.readyException = function( error ) {
	window.setTimeout( function() {
		throw error;
	} );
};




// The deferred used on DOM ready
var readyList = jQuery.Deferred();

jQuery.fn.ready = function( fn ) {

	readyList
		.then( fn )

		// Wrap jQuery.readyException in a function so that the lookup
		// happens at the time of error handling instead of callback
		// registration.
		.catch( function( error ) {
			jQuery.readyException( error );
		} );

	return this;
};

jQuery.extend( {

	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Hold (or release) the ready event
	holdReady: function( hold ) {
		if ( hold ) {
			jQuery.readyWait++;
		} else {
			jQuery.ready( true );
		}
	},

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );
	}
} );

jQuery.ready.then = readyList.then;

// The ready event handler and self cleanup method
function completed() {
	document.removeEventListener( "DOMContentLoaded", completed );
	window.removeEventListener( "load", completed );
	jQuery.ready();
}

// Catch cases where $(document).ready() is called
// after the browser event has already occurred.
// Support: IE <=9 - 10 only
// Older IE sometimes signals "interactive" too soon
if ( document.readyState === "complete" ||
	( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

	// Handle it asynchronously to allow scripts the opportunity to delay ready
	window.setTimeout( jQuery.ready );

} else {

	// Use the handy event callback
	document.addEventListener( "DOMContentLoaded", completed );

	// A fallback to window.onload, that will always work
	window.addEventListener( "load", completed );
}




// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		len = elems.length,
		bulk = key == null;

	// Sets many values
	if ( jQuery.type( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			access( elems, fn, i, key[ i ], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !jQuery.isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {

			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < len; i++ ) {
				fn(
					elems[ i ], key, raw ?
					value :
					value.call( elems[ i ], i, fn( elems[ i ], key ) )
				);
			}
		}
	}

	if ( chainable ) {
		return elems;
	}

	// Gets
	if ( bulk ) {
		return fn.call( elems );
	}

	return len ? fn( elems[ 0 ], key ) : emptyGet;
};
var acceptData = function( owner ) {

	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};




function Data() {
	this.expando = jQuery.expando + Data.uid++;
}

Data.uid = 1;

Data.prototype = {

	cache: function( owner ) {

		// Check if the owner object already has a cache
		var value = owner[ this.expando ];

		// If not, create one
		if ( !value ) {
			value = {};

			// We can accept data for non-element nodes in modern browsers,
			// but we should not, see #8335.
			// Always return an empty object.
			if ( acceptData( owner ) ) {

				// If it is a node unlikely to be stringify-ed or looped over
				// use plain assignment
				if ( owner.nodeType ) {
					owner[ this.expando ] = value;

				// Otherwise secure it in a non-enumerable property
				// configurable must be true to allow the property to be
				// deleted when data is removed
				} else {
					Object.defineProperty( owner, this.expando, {
						value: value,
						configurable: true
					} );
				}
			}
		}

		return value;
	},
	set: function( owner, data, value ) {
		var prop,
			cache = this.cache( owner );

		// Handle: [ owner, key, value ] args
		// Always use camelCase key (gh-2257)
		if ( typeof data === "string" ) {
			cache[ jQuery.camelCase( data ) ] = value;

		// Handle: [ owner, { properties } ] args
		} else {

			// Copy the properties one-by-one to the cache object
			for ( prop in data ) {
				cache[ jQuery.camelCase( prop ) ] = data[ prop ];
			}
		}
		return cache;
	},
	get: function( owner, key ) {
		return key === undefined ?
			this.cache( owner ) :

			// Always use camelCase key (gh-2257)
			owner[ this.expando ] && owner[ this.expando ][ jQuery.camelCase( key ) ];
	},
	access: function( owner, key, value ) {

		// In cases where either:
		//
		//   1. No key was specified
		//   2. A string key was specified, but no value provided
		//
		// Take the "read" path and allow the get method to determine
		// which value to return, respectively either:
		//
		//   1. The entire cache object
		//   2. The data stored at the key
		//
		if ( key === undefined ||
				( ( key && typeof key === "string" ) && value === undefined ) ) {

			return this.get( owner, key );
		}

		// When the key is not a string, or both a key and value
		// are specified, set or extend (existing objects) with either:
		//
		//   1. An object of properties
		//   2. A key and value
		//
		this.set( owner, key, value );

		// Since the "set" path can have two possible entry points
		// return the expected data based on which path was taken[*]
		return value !== undefined ? value : key;
	},
	remove: function( owner, key ) {
		var i,
			cache = owner[ this.expando ];

		if ( cache === undefined ) {
			return;
		}

		if ( key !== undefined ) {

			// Support array or space separated string of keys
			if ( jQuery.isArray( key ) ) {

				// If key is an array of keys...
				// We always set camelCase keys, so remove that.
				key = key.map( jQuery.camelCase );
			} else {
				key = jQuery.camelCase( key );

				// If a key with the spaces exists, use it.
				// Otherwise, create an array by matching non-whitespace
				key = key in cache ?
					[ key ] :
					( key.match( rnothtmlwhite ) || [] );
			}

			i = key.length;

			while ( i-- ) {
				delete cache[ key[ i ] ];
			}
		}

		// Remove the expando if there's no more data
		if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

			// Support: Chrome <=35 - 45
			// Webkit & Blink performance suffers when deleting properties
			// from DOM nodes, so set to undefined instead
			// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
			if ( owner.nodeType ) {
				owner[ this.expando ] = undefined;
			} else {
				delete owner[ this.expando ];
			}
		}
	},
	hasData: function( owner ) {
		var cache = owner[ this.expando ];
		return cache !== undefined && !jQuery.isEmptyObject( cache );
	}
};
var dataPriv = new Data();

var dataUser = new Data();



//	Implementation Summary
//
//	1. Enforce API surface and semantic compatibility with 1.9.x branch
//	2. Improve the module's maintainability by reducing the storage
//		paths to a single mechanism.
//	3. Use the same single mechanism to support "private" and "user" data.
//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
//	5. Avoid exposing implementation details on user objects (eg. expando properties)
//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /[A-Z]/g;

function getData( data ) {
	if ( data === "true" ) {
		return true;
	}

	if ( data === "false" ) {
		return false;
	}

	if ( data === "null" ) {
		return null;
	}

	// Only convert to a number if it doesn't change the string
	if ( data === +data + "" ) {
		return +data;
	}

	if ( rbrace.test( data ) ) {
		return JSON.parse( data );
	}

	return data;
}

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = getData( data );
			} catch ( e ) {}

			// Make sure we set the data so it isn't changed later
			dataUser.set( elem, key, data );
		} else {
			data = undefined;
		}
	}
	return data;
}

jQuery.extend( {
	hasData: function( elem ) {
		return dataUser.hasData( elem ) || dataPriv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return dataUser.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		dataUser.remove( elem, name );
	},

	// TODO: Now that all calls to _data and _removeData have been replaced
	// with direct calls to dataPriv methods, these can be deprecated.
	_data: function( elem, name, data ) {
		return dataPriv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		dataPriv.remove( elem, name );
	}
} );

jQuery.fn.extend( {
	data: function( key, value ) {
		var i, name, data,
			elem = this[ 0 ],
			attrs = elem && elem.attributes;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = dataUser.get( elem );

				if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE 11 only
						// The attrs elements can be null (#14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = jQuery.camelCase( name.slice( 5 ) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					dataPriv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each( function() {
				dataUser.set( this, key );
			} );
		}

		return access( this, function( value ) {
			var data;

			// The calling jQuery object (element matches) is not empty
			// (and therefore has an element appears at this[ 0 ]) and the
			// `value` parameter was not undefined. An empty jQuery object
			// will result in `undefined` for elem = this[ 0 ] which will
			// throw an exception if an attempt to read a data cache is made.
			if ( elem && value === undefined ) {

				// Attempt to get data from the cache
				// The key will always be camelCased in Data
				data = dataUser.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return;
			}

			// Set the data...
			this.each( function() {

				// We always store the camelCased key
				dataUser.set( this, key, value );
			} );
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each( function() {
			dataUser.remove( this, key );
		} );
	}
} );


jQuery.extend( {
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = dataPriv.get( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || jQuery.isArray( data ) ) {
					queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// Clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// Not public - generate a queueHooks object, or return the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
			empty: jQuery.Callbacks( "once memory" ).add( function() {
				dataPriv.remove( elem, [ type + "queue", key ] );
			} )
		} );
	}
} );

jQuery.fn.extend( {
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[ 0 ], type );
		}

		return data === undefined ?
			this :
			this.each( function() {
				var queue = jQuery.queue( this, type, data );

				// Ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			} );
	},
	dequeue: function( type ) {
		return this.each( function() {
			jQuery.dequeue( this, type );
		} );
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},

	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
} );
var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var isHiddenWithinTree = function( elem, el ) {

		// isHiddenWithinTree might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;

		// Inline style trumps all
		return elem.style.display === "none" ||
			elem.style.display === "" &&

			// Otherwise, check computed style
			// Support: Firefox <=43 - 45
			// Disconnected elements can have computed display: none, so first confirm that elem is
			// in the document.
			jQuery.contains( elem.ownerDocument, elem ) &&

			jQuery.css( elem, "display" ) === "none";
	};

var swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};




function adjustCSS( elem, prop, valueParts, tween ) {
	var adjusted,
		scale = 1,
		maxIterations = 20,
		currentValue = tween ?
			function() {
				return tween.cur();
			} :
			function() {
				return jQuery.css( elem, prop, "" );
			},
		initial = currentValue(),
		unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

		// Starting value computation is required for potential unit mismatches
		initialInUnit = ( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
			rcssNum.exec( jQuery.css( elem, prop ) );

	if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

		// Trust units reported by jQuery.css
		unit = unit || initialInUnit[ 3 ];

		// Make sure we update the tween properties later on
		valueParts = valueParts || [];

		// Iteratively approximate from a nonzero starting point
		initialInUnit = +initial || 1;

		do {

			// If previous iteration zeroed out, double until we get *something*.
			// Use string for doubling so we don't accidentally see scale as unchanged below
			scale = scale || ".5";

			// Adjust and apply
			initialInUnit = initialInUnit / scale;
			jQuery.style( elem, prop, initialInUnit + unit );

		// Update scale, tolerating zero or NaN from tween.cur()
		// Break the loop if scale is unchanged or perfect, or if we've just had enough.
		} while (
			scale !== ( scale = currentValue() / initial ) && scale !== 1 && --maxIterations
		);
	}

	if ( valueParts ) {
		initialInUnit = +initialInUnit || +initial || 0;

		// Apply relative offset (+=/-=) if specified
		adjusted = valueParts[ 1 ] ?
			initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
			+valueParts[ 2 ];
		if ( tween ) {
			tween.unit = unit;
			tween.start = initialInUnit;
			tween.end = adjusted;
		}
	}
	return adjusted;
}


var defaultDisplayMap = {};

function getDefaultDisplay( elem ) {
	var temp,
		doc = elem.ownerDocument,
		nodeName = elem.nodeName,
		display = defaultDisplayMap[ nodeName ];

	if ( display ) {
		return display;
	}

	temp = doc.body.appendChild( doc.createElement( nodeName ) );
	display = jQuery.css( temp, "display" );

	temp.parentNode.removeChild( temp );

	if ( display === "none" ) {
		display = "block";
	}
	defaultDisplayMap[ nodeName ] = display;

	return display;
}

function showHide( elements, show ) {
	var display, elem,
		values = [],
		index = 0,
		length = elements.length;

	// Determine new display value for elements that need to change
	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		display = elem.style.display;
		if ( show ) {

			// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
			// check is required in this first loop unless we have a nonempty display value (either
			// inline or about-to-be-restored)
			if ( display === "none" ) {
				values[ index ] = dataPriv.get( elem, "display" ) || null;
				if ( !values[ index ] ) {
					elem.style.display = "";
				}
			}
			if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
				values[ index ] = getDefaultDisplay( elem );
			}
		} else {
			if ( display !== "none" ) {
				values[ index ] = "none";

				// Remember what we're overwriting
				dataPriv.set( elem, "display", display );
			}
		}
	}

	// Set the display of the elements in a second loop to avoid constant reflow
	for ( index = 0; index < length; index++ ) {
		if ( values[ index ] != null ) {
			elements[ index ].style.display = values[ index ];
		}
	}

	return elements;
}

jQuery.fn.extend( {
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each( function() {
			if ( isHiddenWithinTree( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		} );
	}
} );
var rcheckableType = ( /^(?:checkbox|radio)$/i );

var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]+)/i );

var rscriptType = ( /^$|\/(?:java|ecma)script/i );



// We have to close these tags to support XHTML (#13200)
var wrapMap = {

	// Support: IE <=9 only
	option: [ 1, "<select multiple='multiple'>", "</select>" ],

	// XHTML parsers do not magically insert elements in the
	// same way that tag soup parsers do. So we cannot shorten
	// this by omitting <tbody> or other required elements.
	thead: [ 1, "<table>", "</table>" ],
	col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
	tr: [ 2, "<table><tbody>", "</tbody></table>" ],
	td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

	_default: [ 0, "", "" ]
};

// Support: IE <=9 only
wrapMap.optgroup = wrapMap.option;

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;


function getAll( context, tag ) {

	// Support: IE <=9 - 11 only
	// Use typeof to avoid zero-argument method invocation on host objects (#15151)
	var ret;

	if ( typeof context.getElementsByTagName !== "undefined" ) {
		ret = context.getElementsByTagName( tag || "*" );

	} else if ( typeof context.querySelectorAll !== "undefined" ) {
		ret = context.querySelectorAll( tag || "*" );

	} else {
		ret = [];
	}

	if ( tag === undefined || tag && jQuery.nodeName( context, tag ) ) {
		return jQuery.merge( [ context ], ret );
	}

	return ret;
}


// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		dataPriv.set(
			elems[ i ],
			"globalEval",
			!refElements || dataPriv.get( refElements[ i ], "globalEval" )
		);
	}
}


var rhtml = /<|&#?\w+;/;

function buildFragment( elems, context, scripts, selection, ignored ) {
	var elem, tmp, tag, wrap, contains, j,
		fragment = context.createDocumentFragment(),
		nodes = [],
		i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		elem = elems[ i ];

		if ( elem || elem === 0 ) {

			// Add nodes directly
			if ( jQuery.type( elem ) === "object" ) {

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

			// Convert non-html into a text node
			} else if ( !rhtml.test( elem ) ) {
				nodes.push( context.createTextNode( elem ) );

			// Convert html into DOM nodes
			} else {
				tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

				// Deserialize a standard representation
				tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
				wrap = wrapMap[ tag ] || wrapMap._default;
				tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

				// Descend through wrappers to the right content
				j = wrap[ 0 ];
				while ( j-- ) {
					tmp = tmp.lastChild;
				}

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, tmp.childNodes );

				// Remember the top-level container
				tmp = fragment.firstChild;

				// Ensure the created nodes are orphaned (#12392)
				tmp.textContent = "";
			}
		}
	}

	// Remove wrapper from fragment
	fragment.textContent = "";

	i = 0;
	while ( ( elem = nodes[ i++ ] ) ) {

		// Skip elements already in the context collection (trac-4087)
		if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
			if ( ignored ) {
				ignored.push( elem );
			}
			continue;
		}

		contains = jQuery.contains( elem.ownerDocument, elem );

		// Append to fragment
		tmp = getAll( fragment.appendChild( elem ), "script" );

		// Preserve script evaluation history
		if ( contains ) {
			setGlobalEval( tmp );
		}

		// Capture executables
		if ( scripts ) {
			j = 0;
			while ( ( elem = tmp[ j++ ] ) ) {
				if ( rscriptType.test( elem.type || "" ) ) {
					scripts.push( elem );
				}
			}
		}
	}

	return fragment;
}


( function() {
	var fragment = document.createDocumentFragment(),
		div = fragment.appendChild( document.createElement( "div" ) ),
		input = document.createElement( "input" );

	// Support: Android 4.0 - 4.3 only
	// Check state lost if the name is set (#11217)
	// Support: Windows Web Apps (WWA)
	// `name` and `type` must use .setAttribute for WWA (#14901)
	input.setAttribute( "type", "radio" );
	input.setAttribute( "checked", "checked" );
	input.setAttribute( "name", "t" );

	div.appendChild( input );

	// Support: Android <=4.1 only
	// Older WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Support: IE <=11 only
	// Make sure textarea (and checkbox) defaultValue is properly cloned
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;
} )();
var documentElement = document.documentElement;



var
	rkeyEvent = /^key/,
	rmouseEvent = /^(?:mouse|pointer|contextmenu|drag|drop)|click/,
	rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

// Support: IE <=9 only
// See #13393 for more info
function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

function on( elem, types, selector, data, fn, one ) {
	var origFn, type;

	// Types can be a map of types/handlers
	if ( typeof types === "object" ) {

		// ( types-Object, selector, data )
		if ( typeof selector !== "string" ) {

			// ( types-Object, data )
			data = data || selector;
			selector = undefined;
		}
		for ( type in types ) {
			on( elem, type, selector, data, types[ type ], one );
		}
		return elem;
	}

	if ( data == null && fn == null ) {

		// ( types, fn )
		fn = selector;
		data = selector = undefined;
	} else if ( fn == null ) {
		if ( typeof selector === "string" ) {

			// ( types, selector, fn )
			fn = data;
			data = undefined;
		} else {

			// ( types, data, fn )
			fn = data;
			data = selector;
			selector = undefined;
		}
	}
	if ( fn === false ) {
		fn = returnFalse;
	} else if ( !fn ) {
		return elem;
	}

	if ( one === 1 ) {
		origFn = fn;
		fn = function( event ) {

			// Can use an empty set, since event contains the info
			jQuery().off( event );
			return origFn.apply( this, arguments );
		};

		// Use same guid so caller can remove using origFn
		fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
	}
	return elem.each( function() {
		jQuery.event.add( this, types, fn, data, selector );
	} );
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {

		var handleObjIn, eventHandle, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.get( elem );

		// Don't attach events to noData or text/comment nodes (but allow plain objects)
		if ( !elemData ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Ensure that invalid selectors throw exceptions at attach time
		// Evaluate against documentElement in case elem is a non-element node (e.g., document)
		if ( selector ) {
			jQuery.find.matchesSelector( documentElement, selector );
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !( events = elemData.events ) ) {
			events = elemData.events = {};
		}
		if ( !( eventHandle = elemData.handle ) ) {
			eventHandle = elemData.handle = function( e ) {

				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
			};
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend( {
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join( "." )
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !( handlers = events[ type ] ) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener if the special events handler returns false
				if ( !special.setup ||
					special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {

		var j, origCount, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

		if ( !elemData || !( events = elemData.events ) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[ 2 ] &&
				new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector ||
						selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown ||
					special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove data and the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			dataPriv.remove( elem, "handle events" );
		}
	},

	dispatch: function( nativeEvent ) {

		// Make a writable jQuery.Event from the native event object
		var event = jQuery.event.fix( nativeEvent );

		var i, j, ret, matched, handleObj, handlerQueue,
			args = new Array( arguments.length ),
			handlers = ( dataPriv.get( this, "events" ) || {} )[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[ 0 ] = event;

		for ( i = 1; i < arguments.length; i++ ) {
			args[ i ] = arguments[ i ];
		}

		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( ( handleObj = matched.handlers[ j++ ] ) &&
				!event.isImmediatePropagationStopped() ) {

				// Triggered event must either 1) have no namespace, or 2) have namespace(s)
				// a subset or equal to those in the bound event (both can have no namespace).
				if ( !event.rnamespace || event.rnamespace.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
						handleObj.handler ).apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( ( event.result = ret ) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var i, handleObj, sel, matchedHandlers, matchedSelectors,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Find delegate handlers
		if ( delegateCount &&

			// Support: IE <=9
			// Black-hole SVG <use> instance trees (trac-13180)
			cur.nodeType &&

			// Support: Firefox <=42
			// Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
			// https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
			// Support: IE 11 only
			// ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
			!( event.type === "click" && event.button >= 1 ) ) {

			for ( ; cur !== this; cur = cur.parentNode || this ) {

				// Don't check non-elements (#13208)
				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
				if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
					matchedHandlers = [];
					matchedSelectors = {};
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (#13203)
						sel = handleObj.selector + " ";

						if ( matchedSelectors[ sel ] === undefined ) {
							matchedSelectors[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) > -1 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matchedSelectors[ sel ] ) {
							matchedHandlers.push( handleObj );
						}
					}
					if ( matchedHandlers.length ) {
						handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		cur = this;
		if ( delegateCount < handlers.length ) {
			handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
		}

		return handlerQueue;
	},

	addProp: function( name, hook ) {
		Object.defineProperty( jQuery.Event.prototype, name, {
			enumerable: true,
			configurable: true,

			get: jQuery.isFunction( hook ) ?
				function() {
					if ( this.originalEvent ) {
							return hook( this.originalEvent );
					}
				} :
				function() {
					if ( this.originalEvent ) {
							return this.originalEvent[ name ];
					}
				},

			set: function( value ) {
				Object.defineProperty( this, name, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: value
				} );
			}
		} );
	},

	fix: function( originalEvent ) {
		return originalEvent[ jQuery.expando ] ?
			originalEvent :
			new jQuery.Event( originalEvent );
	},

	special: {
		load: {

			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		focus: {

			// Fire native event if possible so blur/focus sequence is correct
			trigger: function() {
				if ( this !== safeActiveElement() && this.focus ) {
					this.focus();
					return false;
				}
			},
			delegateType: "focusin"
		},
		blur: {
			trigger: function() {
				if ( this === safeActiveElement() && this.blur ) {
					this.blur();
					return false;
				}
			},
			delegateType: "focusout"
		},
		click: {

			// For checkbox, fire native event so checked state will be right
			trigger: function() {
				if ( this.type === "checkbox" && this.click && jQuery.nodeName( this, "input" ) ) {
					this.click();
					return false;
				}
			},

			// For cross-browser consistency, don't fire native .click() on links
			_default: function( event ) {
				return jQuery.nodeName( event.target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	}
};

jQuery.removeEvent = function( elem, type, handle ) {

	// This "if" is needed for plain objects
	if ( elem.removeEventListener ) {
		elem.removeEventListener( type, handle );
	}
};

jQuery.Event = function( src, props ) {

	// Allow instantiation without the 'new' keyword
	if ( !( this instanceof jQuery.Event ) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&

				// Support: Android <=2.3 only
				src.returnValue === false ?
			returnTrue :
			returnFalse;

		// Create target properties
		// Support: Safari <=6 - 7 only
		// Target should not be a text node (#504, #13143)
		this.target = ( src.target && src.target.nodeType === 3 ) ?
			src.target.parentNode :
			src.target;

		this.currentTarget = src.currentTarget;
		this.relatedTarget = src.relatedTarget;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || jQuery.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	constructor: jQuery.Event,
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,
	isSimulated: false,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;

		if ( e && !this.isSimulated ) {
			e.preventDefault();
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopPropagation();
		}
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Includes all common event props including KeyEvent and MouseEvent specific props
jQuery.each( {
	altKey: true,
	bubbles: true,
	cancelable: true,
	changedTouches: true,
	ctrlKey: true,
	detail: true,
	eventPhase: true,
	metaKey: true,
	pageX: true,
	pageY: true,
	shiftKey: true,
	view: true,
	"char": true,
	charCode: true,
	key: true,
	keyCode: true,
	button: true,
	buttons: true,
	clientX: true,
	clientY: true,
	offsetX: true,
	offsetY: true,
	pointerId: true,
	pointerType: true,
	screenX: true,
	screenY: true,
	targetTouches: true,
	toElement: true,
	touches: true,

	which: function( event ) {
		var button = event.button;

		// Add which for key events
		if ( event.which == null && rkeyEvent.test( event.type ) ) {
			return event.charCode != null ? event.charCode : event.keyCode;
		}

		// Add which for click: 1 === left; 2 === middle; 3 === right
		if ( !event.which && button !== undefined && rmouseEvent.test( event.type ) ) {
			if ( button & 1 ) {
				return 1;
			}

			if ( button & 2 ) {
				return 3;
			}

			if ( button & 4 ) {
				return 2;
			}

			return 0;
		}

		return event.which;
	}
}, jQuery.event.addProp );

// Create mouseenter/leave events using mouseover/out and event-time checks
// so that event delegation works in jQuery.
// Do the same for pointerenter/pointerleave and pointerover/pointerout
//
// Support: Safari 7 only
// Safari sends mouseenter too often; see:
// https://bugs.chromium.org/p/chromium/issues/detail?id=470258
// for the description of the bug (it existed in older Chrome versions as well).
jQuery.each( {
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mouseenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
} );

jQuery.fn.extend( {

	on: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn );
	},
	one: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {

			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ?
					handleObj.origType + "." + handleObj.namespace :
					handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {

			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {

			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each( function() {
			jQuery.event.remove( this, types, fn, selector );
		} );
	}
} );


var

	/* eslint-disable max-len */

	// See https://github.com/eslint/eslint/issues/3229
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,

	/* eslint-enable */

	// Support: IE <=10 - 11, Edge 12 - 13
	// In IE/Edge using regex groups here causes severe slowdowns.
	// See https://connect.microsoft.com/IE/feedback/details/1736512/
	rnoInnerhtml = /<script|<style|<link/i,

	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rscriptTypeMasked = /^true\/(.*)/,
	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;

function manipulationTarget( elem, content ) {
	if ( jQuery.nodeName( elem, "table" ) &&
		jQuery.nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

		return elem.getElementsByTagName( "tbody" )[ 0 ] || elem;
	}

	return elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	var match = rscriptTypeMasked.exec( elem.type );

	if ( match ) {
		elem.type = match[ 1 ];
	} else {
		elem.removeAttribute( "type" );
	}

	return elem;
}

function cloneCopyEvent( src, dest ) {
	var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;

	if ( dest.nodeType !== 1 ) {
		return;
	}

	// 1. Copy private data: events, handlers, etc.
	if ( dataPriv.hasData( src ) ) {
		pdataOld = dataPriv.access( src );
		pdataCur = dataPriv.set( dest, pdataOld );
		events = pdataOld.events;

		if ( events ) {
			delete pdataCur.handle;
			pdataCur.events = {};

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}
	}

	// 2. Copy user data
	if ( dataUser.hasData( src ) ) {
		udataOld = dataUser.access( src );
		udataCur = jQuery.extend( {}, udataOld );

		dataUser.set( dest, udataCur );
	}
}

// Fix IE bugs, see support tests
function fixInput( src, dest ) {
	var nodeName = dest.nodeName.toLowerCase();

	// Fails to persist the checked state of a cloned checkbox or radio button.
	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		dest.checked = src.checked;

	// Fails to return the selected option to the default selected state when cloning options
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

function domManip( collection, args, callback, ignored ) {

	// Flatten any nested arrays
	args = concat.apply( [], args );

	var fragment, first, scripts, hasScripts, node, doc,
		i = 0,
		l = collection.length,
		iNoClone = l - 1,
		value = args[ 0 ],
		isFunction = jQuery.isFunction( value );

	// We can't cloneNode fragments that contain checked, in WebKit
	if ( isFunction ||
			( l > 1 && typeof value === "string" &&
				!support.checkClone && rchecked.test( value ) ) ) {
		return collection.each( function( index ) {
			var self = collection.eq( index );
			if ( isFunction ) {
				args[ 0 ] = value.call( this, index, self.html() );
			}
			domManip( self, args, callback, ignored );
		} );
	}

	if ( l ) {
		fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
		first = fragment.firstChild;

		if ( fragment.childNodes.length === 1 ) {
			fragment = first;
		}

		// Require either new content or an interest in ignored elements to invoke the callback
		if ( first || ignored ) {
			scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
			hasScripts = scripts.length;

			// Use the original fragment for the last item
			// instead of the first because it can end up
			// being emptied incorrectly in certain situations (#8070).
			for ( ; i < l; i++ ) {
				node = fragment;

				if ( i !== iNoClone ) {
					node = jQuery.clone( node, true, true );

					// Keep references to cloned scripts for later restoration
					if ( hasScripts ) {

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( scripts, getAll( node, "script" ) );
					}
				}

				callback.call( collection[ i ], node, i );
			}

			if ( hasScripts ) {
				doc = scripts[ scripts.length - 1 ].ownerDocument;

				// Reenable scripts
				jQuery.map( scripts, restoreScript );

				// Evaluate executable scripts on first document insertion
				for ( i = 0; i < hasScripts; i++ ) {
					node = scripts[ i ];
					if ( rscriptType.test( node.type || "" ) &&
						!dataPriv.access( node, "globalEval" ) &&
						jQuery.contains( doc, node ) ) {

						if ( node.src ) {

							// Optional AJAX dependency, but won't run scripts if not present
							if ( jQuery._evalUrl ) {
								jQuery._evalUrl( node.src );
							}
						} else {
							DOMEval( node.textContent.replace( rcleanScript, "" ), doc );
						}
					}
				}
			}
		}
	}

	return collection;
}

function remove( elem, selector, keepData ) {
	var node,
		nodes = selector ? jQuery.filter( selector, elem ) : elem,
		i = 0;

	for ( ; ( node = nodes[ i ] ) != null; i++ ) {
		if ( !keepData && node.nodeType === 1 ) {
			jQuery.cleanData( getAll( node ) );
		}

		if ( node.parentNode ) {
			if ( keepData && jQuery.contains( node.ownerDocument, node ) ) {
				setGlobalEval( getAll( node, "script" ) );
			}
			node.parentNode.removeChild( node );
		}
	}

	return elem;
}

jQuery.extend( {
	htmlPrefilter: function( html ) {
		return html.replace( rxhtmlTag, "<$1></$2>" );
	},

	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var i, l, srcElements, destElements,
			clone = elem.cloneNode( true ),
			inPage = jQuery.contains( elem.ownerDocument, elem );

		// Fix IE cloning issues
		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
				!jQuery.isXMLDoc( elem ) ) {

			// We eschew Sizzle here for performance reasons: https://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			for ( i = 0, l = srcElements.length; i < l; i++ ) {
				fixInput( srcElements[ i ], destElements[ i ] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0, l = srcElements.length; i < l; i++ ) {
					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		// Return the cloned set
		return clone;
	},

	cleanData: function( elems ) {
		var data, elem, type,
			special = jQuery.event.special,
			i = 0;

		for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
			if ( acceptData( elem ) ) {
				if ( ( data = elem[ dataPriv.expando ] ) ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataPriv.expando ] = undefined;
				}
				if ( elem[ dataUser.expando ] ) {

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataUser.expando ] = undefined;
				}
			}
		}
	}
} );

jQuery.fn.extend( {
	detach: function( selector ) {
		return remove( this, selector, true );
	},

	remove: function( selector ) {
		return remove( this, selector );
	},

	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().each( function() {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						this.textContent = value;
					}
				} );
		}, null, value, arguments.length );
	},

	append: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		} );
	},

	prepend: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		} );
	},

	before: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		} );
	},

	after: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		} );
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; ( elem = this[ i ] ) != null; i++ ) {
			if ( elem.nodeType === 1 ) {

				// Prevent memory leaks
				jQuery.cleanData( getAll( elem, false ) );

				// Remove any remaining nodes
				elem.textContent = "";
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map( function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		} );
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined && elem.nodeType === 1 ) {
				return elem.innerHTML;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

				value = jQuery.htmlPrefilter( value );

				try {
					for ( ; i < l; i++ ) {
						elem = this[ i ] || {};

						// Remove element nodes and prevent memory leaks
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch ( e ) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var ignored = [];

		// Make the changes, replacing each non-ignored context element with the new content
		return domManip( this, arguments, function( elem ) {
			var parent = this.parentNode;

			if ( jQuery.inArray( this, ignored ) < 0 ) {
				jQuery.cleanData( getAll( this ) );
				if ( parent ) {
					parent.replaceChild( elem, this );
				}
			}

		// Force callback invocation
		}, ignored );
	}
} );

jQuery.each( {
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1,
			i = 0;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone( true );
			jQuery( insert[ i ] )[ original ]( elems );

			// Support: Android <=4.0 only, PhantomJS 1 only
			// .get() because push.apply(_, arraylike) throws on ancient WebKit
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
} );
var rmargin = ( /^margin/ );

var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

var getStyles = function( elem ) {

		// Support: IE <=11 only, Firefox <=30 (#15098, #14150)
		// IE throws on elements created in popups
		// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
		var view = elem.ownerDocument.defaultView;

		if ( !view || !view.opener ) {
			view = window;
		}

		return view.getComputedStyle( elem );
	};



( function() {

	// Executing both pixelPosition & boxSizingReliable tests require only one layout
	// so they're executed at the same time to save the second computation.
	function computeStyleTests() {

		// This is a singleton, we need to execute it only once
		if ( !div ) {
			return;
		}

		div.style.cssText =
			"box-sizing:border-box;" +
			"position:relative;display:block;" +
			"margin:auto;border:1px;padding:1px;" +
			"top:1%;width:50%";
		div.innerHTML = "";
		documentElement.appendChild( container );

		var divStyle = window.getComputedStyle( div );
		pixelPositionVal = divStyle.top !== "1%";

		// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
		reliableMarginLeftVal = divStyle.marginLeft === "2px";
		boxSizingReliableVal = divStyle.width === "4px";

		// Support: Android 4.0 - 4.3 only
		// Some styles come back with percentage values, even though they shouldn't
		div.style.marginRight = "50%";
		pixelMarginRightVal = divStyle.marginRight === "4px";

		documentElement.removeChild( container );

		// Nullify the div so it wouldn't be stored in the memory and
		// it will also be a sign that checks already performed
		div = null;
	}

	var pixelPositionVal, boxSizingReliableVal, pixelMarginRightVal, reliableMarginLeftVal,
		container = document.createElement( "div" ),
		div = document.createElement( "div" );

	// Finish early in limited (non-browser) environments
	if ( !div.style ) {
		return;
	}

	// Support: IE <=9 - 11 only
	// Style of cloned element affects source element cloned (#8908)
	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	container.style.cssText = "border:0;width:8px;height:0;top:0;left:-9999px;" +
		"padding:0;margin-top:1px;position:absolute";
	container.appendChild( div );

	jQuery.extend( support, {
		pixelPosition: function() {
			computeStyleTests();
			return pixelPositionVal;
		},
		boxSizingReliable: function() {
			computeStyleTests();
			return boxSizingReliableVal;
		},
		pixelMarginRight: function() {
			computeStyleTests();
			return pixelMarginRightVal;
		},
		reliableMarginLeft: function() {
			computeStyleTests();
			return reliableMarginLeftVal;
		}
	} );
} )();


function curCSS( elem, name, computed ) {
	var width, minWidth, maxWidth, ret,
		style = elem.style;

	computed = computed || getStyles( elem );

	// Support: IE <=9 only
	// getPropertyValue is only needed for .css('filter') (#12537)
	if ( computed ) {
		ret = computed.getPropertyValue( name ) || computed[ name ];

		if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
			ret = jQuery.style( elem, name );
		}

		// A tribute to the "awesome hack by Dean Edwards"
		// Android Browser returns percentage for some values,
		// but width seems to be reliably pixels.
		// This is against the CSSOM draft spec:
		// https://drafts.csswg.org/cssom/#resolved-values
		if ( !support.pixelMarginRight() && rnumnonpx.test( ret ) && rmargin.test( name ) ) {

			// Remember the original values
			width = style.width;
			minWidth = style.minWidth;
			maxWidth = style.maxWidth;

			// Put in the new values to get a computed value out
			style.minWidth = style.maxWidth = style.width = ret;
			ret = computed.width;

			// Revert the changed values
			style.width = width;
			style.minWidth = minWidth;
			style.maxWidth = maxWidth;
		}
	}

	return ret !== undefined ?

		// Support: IE <=9 - 11 only
		// IE returns zIndex value as an integer.
		ret + "" :
		ret;
}


function addGetHookIf( conditionFn, hookFn ) {

	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			if ( conditionFn() ) {

				// Hook not needed (or it's not possible to use it due
				// to missing dependency), remove it.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.
			return ( this.get = hookFn ).apply( this, arguments );
		}
	};
}


var

	// Swappable if display is none or starts with table
	// except "table", "table-cell", or "table-caption"
	// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	},

	cssPrefixes = [ "Webkit", "Moz", "ms" ],
	emptyStyle = document.createElement( "div" ).style;

// Return a css property mapped to a potentially vendor prefixed property
function vendorPropName( name ) {

	// Shortcut for names that are not vendor prefixed
	if ( name in emptyStyle ) {
		return name;
	}

	// Check for vendor prefixed names
	var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in emptyStyle ) {
			return name;
		}
	}
}

function setPositiveNumber( elem, value, subtract ) {

	// Any relative (+/-) values have already been
	// normalized at this point
	var matches = rcssNum.exec( value );
	return matches ?

		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
		value;
}

function augmentWidthOrHeight( elem, name, extra, isBorderBox, styles ) {
	var i,
		val = 0;

	// If we already have the right measurement, avoid augmentation
	if ( extra === ( isBorderBox ? "border" : "content" ) ) {
		i = 4;

	// Otherwise initialize for horizontal or vertical properties
	} else {
		i = name === "width" ? 1 : 0;
	}

	for ( ; i < 4; i += 2 ) {

		// Both box models exclude margin, so add it if we want it
		if ( extra === "margin" ) {
			val += jQuery.css( elem, extra + cssExpand[ i ], true, styles );
		}

		if ( isBorderBox ) {

			// border-box includes padding, so remove it if we want content
			if ( extra === "content" ) {
				val -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// At this point, extra isn't border nor margin, so remove border
			if ( extra !== "margin" ) {
				val -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		} else {

			// At this point, extra isn't content, so add padding
			val += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// At this point, extra isn't content nor padding, so add border
			if ( extra !== "padding" ) {
				val += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	return val;
}

function getWidthOrHeight( elem, name, extra ) {

	// Start with offset property, which is equivalent to the border-box value
	var val,
		valueIsBorderBox = true,
		styles = getStyles( elem ),
		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

	// Support: IE <=11 only
	// Running getBoundingClientRect on a disconnected node
	// in IE throws an error.
	if ( elem.getClientRects().length ) {
		val = elem.getBoundingClientRect()[ name ];
	}

	// Some non-html elements return undefined for offsetWidth, so check for null/undefined
	// svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
	// MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
	if ( val <= 0 || val == null ) {

		// Fall back to computed then uncomputed css if necessary
		val = curCSS( elem, name, styles );
		if ( val < 0 || val == null ) {
			val = elem.style[ name ];
		}

		// Computed unit is not pixels. Stop here and return.
		if ( rnumnonpx.test( val ) ) {
			return val;
		}

		// Check for style in case a browser which returns unreliable values
		// for getComputedStyle silently falls back to the reliable elem.style
		valueIsBorderBox = isBorderBox &&
			( support.boxSizingReliable() || val === elem.style[ name ] );

		// Normalize "", auto, and prepare for extra
		val = parseFloat( val ) || 0;
	}

	// Use the active box-sizing model to add/subtract irrelevant styles
	return ( val +
		augmentWidthOrHeight(
			elem,
			name,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles
		)
	) + "px";
}

jQuery.extend( {

	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {

					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		"animationIterationCount": true,
		"columnCount": true,
		"fillOpacity": true,
		"flexGrow": true,
		"flexShrink": true,
		"fontWeight": true,
		"lineHeight": true,
		"opacity": true,
		"order": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {
		"float": "cssFloat"
	},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {

		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = jQuery.camelCase( name ),
			style = elem.style;

		name = jQuery.cssProps[ origName ] ||
			( jQuery.cssProps[ origName ] = vendorPropName( origName ) || origName );

		// Gets hook for the prefixed version, then unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// Convert "+=" or "-=" to relative numbers (#7345)
			if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
				value = adjustCSS( elem, name, ret );

				// Fixes bug #9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set (#7116)
			if ( value == null || value !== value ) {
				return;
			}

			// If a number was passed in, add the unit (except for certain CSS properties)
			if ( type === "number" ) {
				value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
			}

			// background-* props affect original clone's values
			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !( "set" in hooks ) ||
				( value = hooks.set( elem, value, extra ) ) !== undefined ) {

				style[ name ] = value;
			}

		} else {

			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks &&
				( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var val, num, hooks,
			origName = jQuery.camelCase( name );

		// Make sure that we're working with the right name
		name = jQuery.cssProps[ origName ] ||
			( jQuery.cssProps[ origName ] = vendorPropName( origName ) || origName );

		// Try prefixed name followed by the unprefixed name
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		// Convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Make numeric if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || isFinite( num ) ? num || 0 : val;
		}
		return val;
	}
} );

jQuery.each( [ "height", "width" ], function( i, name ) {
	jQuery.cssHooks[ name ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {

				// Certain elements can have dimension info if we invisibly show them
				// but it must have a current display style that would benefit
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

					// Support: Safari 8+
					// Table columns in Safari have non-zero offsetWidth & zero
					// getBoundingClientRect().width unless display is changed.
					// Support: IE <=11 only
					// Running getBoundingClientRect on a disconnected node
					// in IE throws an error.
					( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
						swap( elem, cssShow, function() {
							return getWidthOrHeight( elem, name, extra );
						} ) :
						getWidthOrHeight( elem, name, extra );
			}
		},

		set: function( elem, value, extra ) {
			var matches,
				styles = extra && getStyles( elem ),
				subtract = extra && augmentWidthOrHeight(
					elem,
					name,
					extra,
					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
					styles
				);

			// Convert to pixels if value adjustment is needed
			if ( subtract && ( matches = rcssNum.exec( value ) ) &&
				( matches[ 3 ] || "px" ) !== "px" ) {

				elem.style[ name ] = value;
				value = jQuery.css( elem, name );
			}

			return setPositiveNumber( elem, value, subtract );
		}
	};
} );

jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
	function( elem, computed ) {
		if ( computed ) {
			return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
				elem.getBoundingClientRect().left -
					swap( elem, { marginLeft: 0 }, function() {
						return elem.getBoundingClientRect().left;
					} )
				) + "px";
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each( {
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// Assumes a single number if not a string
				parts = typeof value === "string" ? value.split( " " ) : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( !rmargin.test( prefix ) ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
} );

jQuery.fn.extend( {
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( jQuery.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	}
} );


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || jQuery.easing._default;
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			// Use a property on the element directly when it is not a DOM element,
			// or when there is no matching style property that exists.
			if ( tween.elem.nodeType !== 1 ||
				tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
				return tween.elem[ tween.prop ];
			}

			// Passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails.
			// Simple values such as "10px" are parsed to Float;
			// complex values such as "rotate(1rad)" are returned as-is.
			result = jQuery.css( tween.elem, tween.prop, "" );

			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {

			// Use step hook for back compat.
			// Use cssHook if its there.
			// Use .style if available and use plain properties where available.
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.nodeType === 1 &&
				( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null ||
					jQuery.cssHooks[ tween.prop ] ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE <=9 only
// Panic based approach to setting things on disconnected nodes
Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	},
	_default: "swing"
};

jQuery.fx = Tween.prototype.init;

// Back compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, timerId,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rrun = /queueHooks$/;

function raf() {
	if ( timerId ) {
		window.requestAnimationFrame( raf );
		jQuery.fx.tick();
	}
}

// Animations created synchronously will run synchronously
function createFxNow() {
	window.setTimeout( function() {
		fxNow = undefined;
	} );
	return ( fxNow = jQuery.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		i = 0,
		attrs = { height: type };

	// If we include width, step value is 1 to do all cssExpand values,
	// otherwise step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

			// We're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
		isBox = "width" in props || "height" in props,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHiddenWithinTree( elem ),
		dataShow = dataPriv.get( elem, "fxshow" );

	// Queue-skipping animations hijack the fx hooks
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always( function() {

			// Ensure the complete handler is called before this completes
			anim.always( function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			} );
		} );
	}

	// Detect show/hide animations
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.test( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// Pretend to be hidden if this is a "show" and
				// there is still data from a stopped show/hide
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;

				// Ignore all other no-op show/hide data
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
		}
	}

	// Bail out if this is a no-op like .hide().hide()
	propTween = !jQuery.isEmptyObject( props );
	if ( !propTween && jQuery.isEmptyObject( orig ) ) {
		return;
	}

	// Restrict "overflow" and "display" styles during box animations
	if ( isBox && elem.nodeType === 1 ) {

		// Support: IE <=9 - 11, Edge 12 - 13
		// Record all 3 overflow attributes because IE does not infer the shorthand
		// from identically-valued overflowX and overflowY
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Identify a display type, preferring old show/hide data over the CSS cascade
		restoreDisplay = dataShow && dataShow.display;
		if ( restoreDisplay == null ) {
			restoreDisplay = dataPriv.get( elem, "display" );
		}
		display = jQuery.css( elem, "display" );
		if ( display === "none" ) {
			if ( restoreDisplay ) {
				display = restoreDisplay;
			} else {

				// Get nonempty value(s) by temporarily forcing visibility
				showHide( [ elem ], true );
				restoreDisplay = elem.style.display || restoreDisplay;
				display = jQuery.css( elem, "display" );
				showHide( [ elem ] );
			}
		}

		// Animate inline elements as inline-block
		if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
			if ( jQuery.css( elem, "float" ) === "none" ) {

				// Restore the original display value at the end of pure show/hide animations
				if ( !propTween ) {
					anim.done( function() {
						style.display = restoreDisplay;
					} );
					if ( restoreDisplay == null ) {
						display = style.display;
						restoreDisplay = display === "none" ? "" : display;
					}
				}
				style.display = "inline-block";
			}
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		anim.always( function() {
			style.overflow = opts.overflow[ 0 ];
			style.overflowX = opts.overflow[ 1 ];
			style.overflowY = opts.overflow[ 2 ];
		} );
	}

	// Implement show/hide animations
	propTween = false;
	for ( prop in orig ) {

		// General show/hide setup for this element animation
		if ( !propTween ) {
			if ( dataShow ) {
				if ( "hidden" in dataShow ) {
					hidden = dataShow.hidden;
				}
			} else {
				dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
			}

			// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
			if ( toggle ) {
				dataShow.hidden = !hidden;
			}

			// Show elements before animating them
			if ( hidden ) {
				showHide( [ elem ], true );
			}

			/* eslint-disable no-loop-func */

			anim.done( function() {

			/* eslint-enable no-loop-func */

				// The final step of a "hide" animation is actually hiding the element
				if ( !hidden ) {
					showHide( [ elem ] );
				}
				dataPriv.remove( elem, "fxshow" );
				for ( prop in orig ) {
					jQuery.style( elem, prop, orig[ prop ] );
				}
			} );
		}

		// Per-property setup
		propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
		if ( !( prop in dataShow ) ) {
			dataShow[ prop ] = propTween.start;
			if ( hidden ) {
				propTween.end = propTween.start;
				propTween.start = 0;
			}
		}
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = jQuery.camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( jQuery.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// Not quite $.extend, this won't overwrite existing keys.
			// Reusing 'index' because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = Animation.prefilters.length,
		deferred = jQuery.Deferred().always( function() {

			// Don't match elem in the :animated selector
			delete tick.elem;
		} ),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

				// Support: Android 2.3 only
				// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (#12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ] );

			if ( percent < 1 && length ) {
				return remaining;
			} else {
				deferred.resolveWith( elem, [ animation ] );
				return false;
			}
		},
		animation = deferred.promise( {
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, {
				specialEasing: {},
				easing: jQuery.easing._default
			}, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
						animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,

					// If we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// Resolve when we played the last frame; otherwise, reject
				if ( gotoEnd ) {
					deferred.notifyWith( elem, [ animation, 1, 0 ] );
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		} ),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length; index++ ) {
		result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			if ( jQuery.isFunction( result.stop ) ) {
				jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
					jQuery.proxy( result.stop, result );
			}
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( jQuery.isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		} )
	);

	// attach callbacks from options
	return animation.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );
}

jQuery.Animation = jQuery.extend( Animation, {

	tweeners: {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value );
			adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
			return tween;
		} ]
	},

	tweener: function( props, callback ) {
		if ( jQuery.isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.match( rnothtmlwhite );
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length; index++ ) {
			prop = props[ index ];
			Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
			Animation.tweeners[ prop ].unshift( callback );
		}
	},

	prefilters: [ defaultPrefilter ],

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			Animation.prefilters.unshift( callback );
		} else {
			Animation.prefilters.push( callback );
		}
	}
} );

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			jQuery.isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !jQuery.isFunction( easing ) && easing
	};

	// Go to the end state if fx are off or if document is hidden
	if ( jQuery.fx.off || document.hidden ) {
		opt.duration = 0;

	} else {
		if ( typeof opt.duration !== "number" ) {
			if ( opt.duration in jQuery.fx.speeds ) {
				opt.duration = jQuery.fx.speeds[ opt.duration ];

			} else {
				opt.duration = jQuery.fx.speeds._default;
			}
		}
	}

	// Normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( jQuery.isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend( {
	fadeTo: function( speed, to, easing, callback ) {

		// Show any hidden elements after setting opacity to 0
		return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

			// Animate to the value specified
			.end().animate( { opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {

				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || dataPriv.get( this, "finish" ) ) {
					anim.stop( true );
				}
			};
			doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue && type !== false ) {
			this.queue( type || "fx", [] );
		}

		return this.each( function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = dataPriv.get( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this &&
					( type == null || timers[ index ].queue === type ) ) {

					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// Start the next in the queue if the last step wasn't forced.
			// Timers currently will call their complete callbacks, which
			// will dequeue but only if they were gotoEnd.
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		} );
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each( function() {
			var index,
				data = dataPriv.get( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// Enable finishing flag on private data
			data.finish = true;

			// Empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// Look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// Look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// Turn off finishing flag
			delete data.finish;
		} );
	}
} );

jQuery.each( [ "toggle", "show", "hide" ], function( i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
} );

// Generate shortcuts for custom animations
jQuery.each( {
	slideDown: genFx( "show" ),
	slideUp: genFx( "hide" ),
	slideToggle: genFx( "toggle" ),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
} );

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		i = 0,
		timers = jQuery.timers;

	fxNow = jQuery.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];

		// Checks the timer has not already been removed
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	if ( timer() ) {
		jQuery.fx.start();
	} else {
		jQuery.timers.pop();
	}
};

jQuery.fx.interval = 13;
jQuery.fx.start = function() {
	if ( !timerId ) {
		timerId = window.requestAnimationFrame ?
			window.requestAnimationFrame( raf ) :
			window.setInterval( jQuery.fx.tick, jQuery.fx.interval );
	}
};

jQuery.fx.stop = function() {
	if ( window.cancelAnimationFrame ) {
		window.cancelAnimationFrame( timerId );
	} else {
		window.clearInterval( timerId );
	}

	timerId = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,

	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
// https://web.archive.org/web/20100324014747/http://blindsignals.com/index.php/2009/07/jquery-delay/
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = window.setTimeout( next, time );
		hooks.stop = function() {
			window.clearTimeout( timeout );
		};
	} );
};


( function() {
	var input = document.createElement( "input" ),
		select = document.createElement( "select" ),
		opt = select.appendChild( document.createElement( "option" ) );

	input.type = "checkbox";

	// Support: Android <=4.3 only
	// Default value for a checkbox should be "on"
	support.checkOn = input.value !== "";

	// Support: IE <=11 only
	// Must access selectedIndex to make default options select
	support.optSelected = opt.selected;

	// Support: IE <=11 only
	// An input loses its value after becoming a radio
	input = document.createElement( "input" );
	input.value = "t";
	input.type = "radio";
	support.radioValue = input.value === "t";
} )();


var boolHook,
	attrHandle = jQuery.expr.attrHandle;

jQuery.fn.extend( {
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each( function() {
			jQuery.removeAttr( this, name );
		} );
	}
} );

jQuery.extend( {
	attr: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set attributes on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === "undefined" ) {
			return jQuery.prop( elem, name, value );
		}

		// Attribute hooks are determined by the lowercase version
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
		}

		if ( value !== undefined ) {
			if ( value === null ) {
				jQuery.removeAttr( elem, name );
				return;
			}

			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			elem.setAttribute( name, value + "" );
			return value;
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		ret = jQuery.find.attr( elem, name );

		// Non-existent attributes return null, we normalize to undefined
		return ret == null ? undefined : ret;
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" &&
					jQuery.nodeName( elem, "input" ) ) {
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	},

	removeAttr: function( elem, value ) {
		var name,
			i = 0,

			// Attribute names can contain non-HTML whitespace characters
			// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
			attrNames = value && value.match( rnothtmlwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( ( name = attrNames[ i++ ] ) ) {
				elem.removeAttribute( name );
			}
		}
	}
} );

// Hooks for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {

			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			elem.setAttribute( name, name );
		}
		return name;
	}
};

jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {
	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = function( elem, name, isXML ) {
		var ret, handle,
			lowercaseName = name.toLowerCase();

		if ( !isXML ) {

			// Avoid an infinite loop by temporarily removing this function from the getter
			handle = attrHandle[ lowercaseName ];
			attrHandle[ lowercaseName ] = ret;
			ret = getter( elem, name, isXML ) != null ?
				lowercaseName :
				null;
			attrHandle[ lowercaseName ] = handle;
		}
		return ret;
	};
} );




var rfocusable = /^(?:input|select|textarea|button)$/i,
	rclickable = /^(?:a|area)$/i;

jQuery.fn.extend( {
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		return this.each( function() {
			delete this[ jQuery.propFix[ name ] || name ];
		} );
	}
} );

jQuery.extend( {
	prop: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set properties on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			return ( elem[ name ] = value );
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		return elem[ name ];
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {

				// Support: IE <=9 - 11 only
				// elem.tabIndex doesn't always return the
				// correct value when it hasn't been explicitly set
				// https://web.archive.org/web/20141116233347/http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
				// Use proper attribute retrieval(#12072)
				var tabindex = jQuery.find.attr( elem, "tabindex" );

				if ( tabindex ) {
					return parseInt( tabindex, 10 );
				}

				if (
					rfocusable.test( elem.nodeName ) ||
					rclickable.test( elem.nodeName ) &&
					elem.href
				) {
					return 0;
				}

				return -1;
			}
		}
	},

	propFix: {
		"for": "htmlFor",
		"class": "className"
	}
} );

// Support: IE <=11 only
// Accessing the selectedIndex property
// forces the browser to respect setting selected
// on the option
// The getter ensures a default option is selected
// when in an optgroup
// eslint rule "no-unused-expressions" is disabled for this code
// since it considers such accessions noop
if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent && parent.parentNode ) {
				parent.parentNode.selectedIndex;
			}
			return null;
		},
		set: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent ) {
				parent.selectedIndex;

				if ( parent.parentNode ) {
					parent.parentNode.selectedIndex;
				}
			}
		}
	};
}

jQuery.each( [
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
} );




	// Strip and collapse whitespace according to HTML spec
	// https://html.spec.whatwg.org/multipage/infrastructure.html#strip-and-collapse-whitespace
	function stripAndCollapse( value ) {
		var tokens = value.match( rnothtmlwhite ) || [];
		return tokens.join( " " );
	}


function getClass( elem ) {
	return elem.getAttribute && elem.getAttribute( "class" ) || "";
}

jQuery.fn.extend( {
	addClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( jQuery.isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		if ( typeof value === "string" && value ) {
			classes = value.match( rnothtmlwhite ) || [];

			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );
				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {
						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
							cur += clazz + " ";
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( jQuery.isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		if ( !arguments.length ) {
			return this.attr( "class", "" );
		}

		if ( typeof value === "string" && value ) {
			classes = value.match( rnothtmlwhite ) || [];

			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );

				// This expression is here for better compressibility (see addClass)
				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {

						// Remove *all* instances
						while ( cur.indexOf( " " + clazz + " " ) > -1 ) {
							cur = cur.replace( " " + clazz + " ", " " );
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value;

		if ( typeof stateVal === "boolean" && type === "string" ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		if ( jQuery.isFunction( value ) ) {
			return this.each( function( i ) {
				jQuery( this ).toggleClass(
					value.call( this, i, getClass( this ), stateVal ),
					stateVal
				);
			} );
		}

		return this.each( function() {
			var className, i, self, classNames;

			if ( type === "string" ) {

				// Toggle individual class names
				i = 0;
				self = jQuery( this );
				classNames = value.match( rnothtmlwhite ) || [];

				while ( ( className = classNames[ i++ ] ) ) {

					// Check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( value === undefined || type === "boolean" ) {
				className = getClass( this );
				if ( className ) {

					// Store className if set
					dataPriv.set( this, "__className__", className );
				}

				// If the element has a class name or if we're passed `false`,
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				if ( this.setAttribute ) {
					this.setAttribute( "class",
						className || value === false ?
						"" :
						dataPriv.get( this, "__className__" ) || ""
					);
				}
			}
		} );
	},

	hasClass: function( selector ) {
		var className, elem,
			i = 0;

		className = " " + selector + " ";
		while ( ( elem = this[ i++ ] ) ) {
			if ( elem.nodeType === 1 &&
				( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
					return true;
			}
		}

		return false;
	}
} );




var rreturn = /\r/g;

jQuery.fn.extend( {
	val: function( value ) {
		var hooks, ret, isFunction,
			elem = this[ 0 ];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] ||
					jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks &&
					"get" in hooks &&
					( ret = hooks.get( elem, "value" ) ) !== undefined
				) {
					return ret;
				}

				ret = elem.value;

				// Handle most common string cases
				if ( typeof ret === "string" ) {
					return ret.replace( rreturn, "" );
				}

				// Handle cases where value is null/undef or number
				return ret == null ? "" : ret;
			}

			return;
		}

		isFunction = jQuery.isFunction( value );

		return this.each( function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( isFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";

			} else if ( typeof val === "number" ) {
				val += "";

			} else if ( jQuery.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				} );
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		} );
	}
} );

jQuery.extend( {
	valHooks: {
		option: {
			get: function( elem ) {

				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :

					// Support: IE <=10 - 11 only
					// option.text throws exceptions (#14686, #14858)
					// Strip and collapse whitespace
					// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
					stripAndCollapse( jQuery.text( elem ) );
			}
		},
		select: {
			get: function( elem ) {
				var value, option, i,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one",
					values = one ? null : [],
					max = one ? index + 1 : options.length;

				if ( index < 0 ) {
					i = max;

				} else {
					i = one ? index : 0;
				}

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// Support: IE <=9 only
					// IE8-9 doesn't update selected after form reset (#2551)
					if ( ( option.selected || i === index ) &&

							// Don't return options that are disabled or in a disabled optgroup
							!option.disabled &&
							( !option.parentNode.disabled ||
								!jQuery.nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];

					/* eslint-disable no-cond-assign */

					if ( option.selected =
						jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
					) {
						optionSet = true;
					}

					/* eslint-enable no-cond-assign */
				}

				// Force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	}
} );

// Radios and checkboxes getter/setter
jQuery.each( [ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( jQuery.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			return elem.getAttribute( "value" ) === null ? "on" : elem.value;
		};
	}
} );




// Return jQuery for attributes-only inclusion


var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/;

jQuery.extend( jQuery.event, {

	trigger: function( event, data, elem, onlyHandlers ) {

		var i, cur, tmp, bubbleType, ontype, handle, special,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

		cur = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf( "." ) > -1 ) {

			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split( "." );
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf( ":" ) < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join( "." );
		event.rnamespace = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (#9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
		if ( !onlyHandlers && !special.noBubble && !jQuery.isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === ( elem.ownerDocument || document ) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {

			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( dataPriv.get( cur, "events" ) || {} )[ event.type ] &&
				dataPriv.get( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( ( !special._default ||
				special._default.apply( eventPath.pop(), data ) === false ) &&
				acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name as the event.
				// Don't do default actions on window, that's where global variables be (#6170)
				if ( ontype && jQuery.isFunction( elem[ type ] ) && !jQuery.isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;
					elem[ type ]();
					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	// Piggyback on a donor event to simulate a different one
	// Used only for `focus(in | out)` events
	simulate: function( type, elem, event ) {
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true
			}
		);

		jQuery.event.trigger( e, null, elem );
	}

} );

jQuery.fn.extend( {

	trigger: function( type, data ) {
		return this.each( function() {
			jQuery.event.trigger( type, data, this );
		} );
	},
	triggerHandler: function( type, data ) {
		var elem = this[ 0 ];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
} );


jQuery.each( ( "blur focus focusin focusout resize scroll click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup contextmenu" ).split( " " ),
	function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		return arguments.length > 0 ?
			this.on( name, null, data, fn ) :
			this.trigger( name );
	};
} );

jQuery.fn.extend( {
	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	}
} );




support.focusin = "onfocusin" in window;


// Support: Firefox <=44
// Firefox doesn't have focus(in | out) events
// Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
//
// Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
// focus(in | out) events fire after focus & blur events,
// which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
// Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
if ( !support.focusin ) {
	jQuery.each( { focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler on the document while someone wants focusin/focusout
		var handler = function( event ) {
			jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ) );
		};

		jQuery.event.special[ fix ] = {
			setup: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix );

				if ( !attaches ) {
					doc.addEventListener( orig, handler, true );
				}
				dataPriv.access( doc, fix, ( attaches || 0 ) + 1 );
			},
			teardown: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix ) - 1;

				if ( !attaches ) {
					doc.removeEventListener( orig, handler, true );
					dataPriv.remove( doc, fix );

				} else {
					dataPriv.access( doc, fix, attaches );
				}
			}
		};
	} );
}
var location = window.location;

var nonce = jQuery.now();

var rquery = ( /\?/ );



// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml;
	if ( !data || typeof data !== "string" ) {
		return null;
	}

	// Support: IE 9 - 11 only
	// IE throws on parseFromString with invalid input.
	try {
		xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
	} catch ( e ) {
		xml = undefined;
	}

	if ( !xml || xml.getElementsByTagName( "parsererror" ).length ) {
		jQuery.error( "Invalid XML: " + data );
	}
	return xml;
};


var
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( jQuery.isArray( obj ) ) {

		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {

				// Treat each array item as a scalar.
				add( prefix, v );

			} else {

				// Item is non-scalar (array or object), encode its numeric index.
				buildParams(
					prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
					v,
					traditional,
					add
				);
			}
		} );

	} else if ( !traditional && jQuery.type( obj ) === "object" ) {

		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {

		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, valueOrFunction ) {

			// If value is a function, invoke it and use its return value
			var value = jQuery.isFunction( valueOrFunction ) ?
				valueOrFunction() :
				valueOrFunction;

			s[ s.length ] = encodeURIComponent( key ) + "=" +
				encodeURIComponent( value == null ? "" : value );
		};

	// If an array was passed in, assume that it is an array of form elements.
	if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		} );

	} else {

		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" );
};

jQuery.fn.extend( {
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map( function() {

			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		} )
		.filter( function() {
			var type = this.type;

			// Use .is( ":disabled" ) so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		} )
		.map( function( i, elem ) {
			var val = jQuery( this ).val();

			if ( val == null ) {
				return null;
			}

			if ( jQuery.isArray( val ) ) {
				return jQuery.map( val, function( val ) {
					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				} );
			}

			return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		} ).get();
	}
} );


var
	r20 = /%20/g,
	rhash = /#.*$/,
	rantiCache = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
	allTypes = "*/".concat( "*" ),

	// Anchor tag for parsing the document origin
	originAnchor = document.createElement( "a" );
	originAnchor.href = location.href;

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];

		if ( jQuery.isFunction( func ) ) {

			// For each dataType in the dataTypeExpression
			while ( ( dataType = dataTypes[ i++ ] ) ) {

				// Prepend if requested
				if ( dataType[ 0 ] === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

				// Otherwise append
				} else {
					( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" &&
				!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		} );
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
	var key, deep,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var ct, type, finalDataType, firstDataType,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {

		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}

		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},

		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

			// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {

								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s.throws ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return {
								state: "parsererror",
								error: conv ? e : "No conversion from " + prev + " to " + current
							};
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend( {

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: location.href,
		type: "GET",
		isLocal: rlocalProtocol.test( location.protocol ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",

		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /\bxml\b/,
			html: /\bhtml/,
			json: /\bjson\b/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": JSON.parse,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var transport,

			// URL without anti-cache param
			cacheURL,

			// Response headers
			responseHeadersString,
			responseHeaders,

			// timeout handle
			timeoutTimer,

			// Url cleanup var
			urlAnchor,

			// Request state (becomes false upon send and true upon completion)
			completed,

			// To know if global events are to be dispatched
			fireGlobals,

			// Loop variable
			i,

			// uncached part of the url
			uncached,

			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),

			// Callbacks context
			callbackContext = s.context || s,

			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context &&
				( callbackContext.nodeType || callbackContext.jquery ) ?
					jQuery( callbackContext ) :
					jQuery.event,

			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks( "once memory" ),

			// Status-dependent callbacks
			statusCode = s.statusCode || {},

			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},

			// Default abort message
			strAbort = "canceled",

			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( completed ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
								responseHeaders[ match[ 1 ].toLowerCase() ] = match[ 2 ];
							}
						}
						match = responseHeaders[ key.toLowerCase() ];
					}
					return match == null ? null : match;
				},

				// Raw string
				getAllResponseHeaders: function() {
					return completed ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					if ( completed == null ) {
						name = requestHeadersNames[ name.toLowerCase() ] =
							requestHeadersNames[ name.toLowerCase() ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( completed == null ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( completed ) {

							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						} else {

							// Lazy-add the new callbacks in a way that preserves old ones
							for ( code in map ) {
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR );

		// Add protocol if not provided (prefilters might expect it)
		// Handle falsy url in the settings object (#10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || location.href ) + "" )
			.replace( rprotocol, location.protocol + "//" );

		// Alias method option to type as per ticket #12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];

		// A cross-domain request is in order when the origin doesn't match the current origin.
		if ( s.crossDomain == null ) {
			urlAnchor = document.createElement( "a" );

			// Support: IE <=8 - 11, Edge 12 - 13
			// IE throws exception on accessing the href property if url is malformed,
			// e.g. http://example.com:80x/
			try {
				urlAnchor.href = s.url;

				// Support: IE <=8 - 11 only
				// Anchor's host property isn't correctly set when s.url is relative
				urlAnchor.href = urlAnchor.href;
				s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
					urlAnchor.protocol + "//" + urlAnchor.host;
			} catch ( e ) {

				// If there is an error parsing the URL, assume it is crossDomain,
				// it can be rejected by the transport if it is invalid
				s.crossDomain = true;
			}
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( completed ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (#15118)
		fireGlobals = jQuery.event && s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger( "ajaxStart" );
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		// Remove hash to simplify url manipulation
		cacheURL = s.url.replace( rhash, "" );

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// Remember the hash so we can put it back
			uncached = s.url.slice( cacheURL.length );

			// If data is available, append data to url
			if ( s.data ) {
				cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

				// #9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add or update anti-cache param if needed
			if ( s.cache === false ) {
				cacheURL = cacheURL.replace( rantiCache, "$1" );
				uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce++ ) + uncached;
			}

			// Put hash and anti-cache on the URL that will be requested (gh-1732)
			s.url = cacheURL + uncached;

		// Change '%20' to '+' if this is encoded form body content (gh-2658)
		} else if ( s.data && s.processData &&
			( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
			s.data = s.data.replace( r20, "+" );
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
				s.accepts[ s.dataTypes[ 0 ] ] +
					( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend &&
			( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

			// Abort if not done already and return
			return jqXHR.abort();
		}

		// Aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		completeDeferred.add( s.complete );
		jqXHR.done( s.success );
		jqXHR.fail( s.error );

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}

			// If request was aborted inside ajaxSend, stop there
			if ( completed ) {
				return jqXHR;
			}

			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = window.setTimeout( function() {
					jqXHR.abort( "timeout" );
				}, s.timeout );
			}

			try {
				completed = false;
				transport.send( requestHeaders, done );
			} catch ( e ) {

				// Rethrow post-completion exceptions
				if ( completed ) {
					throw e;
				}

				// Propagate others as results
				done( -1, e );
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Ignore repeat invocations
			if ( completed ) {
				return;
			}

			completed = true;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				window.clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader( "Last-Modified" );
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader( "etag" );
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {

				// Extract error from statusText and normalize for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger( "ajaxStop" );
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
} );

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {

		// Shift arguments if data argument was omitted
		if ( jQuery.isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		// The url can be an options object (which then must have .url)
		return jQuery.ajax( jQuery.extend( {
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		}, jQuery.isPlainObject( url ) && url ) );
	};
} );


jQuery._evalUrl = function( url ) {
	return jQuery.ajax( {
		url: url,

		// Make this explicit, since user can override this through ajaxSetup (#11264)
		type: "GET",
		dataType: "script",
		cache: true,
		async: false,
		global: false,
		"throws": true
	} );
};


jQuery.fn.extend( {
	wrapAll: function( html ) {
		var wrap;

		if ( this[ 0 ] ) {
			if ( jQuery.isFunction( html ) ) {
				html = html.call( this[ 0 ] );
			}

			// The elements to wrap the target around
			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

			if ( this[ 0 ].parentNode ) {
				wrap.insertBefore( this[ 0 ] );
			}

			wrap.map( function() {
				var elem = this;

				while ( elem.firstElementChild ) {
					elem = elem.firstElementChild;
				}

				return elem;
			} ).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each( function( i ) {
				jQuery( this ).wrapInner( html.call( this, i ) );
			} );
		}

		return this.each( function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		} );
	},

	wrap: function( html ) {
		var isFunction = jQuery.isFunction( html );

		return this.each( function( i ) {
			jQuery( this ).wrapAll( isFunction ? html.call( this, i ) : html );
		} );
	},

	unwrap: function( selector ) {
		this.parent( selector ).not( "body" ).each( function() {
			jQuery( this ).replaceWith( this.childNodes );
		} );
		return this;
	}
} );


jQuery.expr.pseudos.hidden = function( elem ) {
	return !jQuery.expr.pseudos.visible( elem );
};
jQuery.expr.pseudos.visible = function( elem ) {
	return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
};




jQuery.ajaxSettings.xhr = function() {
	try {
		return new window.XMLHttpRequest();
	} catch ( e ) {}
};

var xhrSuccessStatus = {

		// File protocol always yields status code 0, assume 200
		0: 200,

		// Support: IE <=9 only
		// #1450: sometimes IE returns 1223 when it should be 204
		1223: 204
	},
	xhrSupported = jQuery.ajaxSettings.xhr();

support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
support.ajax = xhrSupported = !!xhrSupported;

jQuery.ajaxTransport( function( options ) {
	var callback, errorCallback;

	// Cross domain only allowed if supported through XMLHttpRequest
	if ( support.cors || xhrSupported && !options.crossDomain ) {
		return {
			send: function( headers, complete ) {
				var i,
					xhr = options.xhr();

				xhr.open(
					options.type,
					options.url,
					options.async,
					options.username,
					options.password
				);

				// Apply custom fields if provided
				if ( options.xhrFields ) {
					for ( i in options.xhrFields ) {
						xhr[ i ] = options.xhrFields[ i ];
					}
				}

				// Override mime type if needed
				if ( options.mimeType && xhr.overrideMimeType ) {
					xhr.overrideMimeType( options.mimeType );
				}

				// X-Requested-With header
				// For cross-domain requests, seeing as conditions for a preflight are
				// akin to a jigsaw puzzle, we simply never set it to be sure.
				// (it can always be set on a per-request basis or even using ajaxSetup)
				// For same-domain requests, won't change header if already provided.
				if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
					headers[ "X-Requested-With" ] = "XMLHttpRequest";
				}

				// Set headers
				for ( i in headers ) {
					xhr.setRequestHeader( i, headers[ i ] );
				}

				// Callback
				callback = function( type ) {
					return function() {
						if ( callback ) {
							callback = errorCallback = xhr.onload =
								xhr.onerror = xhr.onabort = xhr.onreadystatechange = null;

							if ( type === "abort" ) {
								xhr.abort();
							} else if ( type === "error" ) {

								// Support: IE <=9 only
								// On a manual native abort, IE9 throws
								// errors on any property access that is not readyState
								if ( typeof xhr.status !== "number" ) {
									complete( 0, "error" );
								} else {
									complete(

										// File: protocol always yields status 0; see #8605, #14207
										xhr.status,
										xhr.statusText
									);
								}
							} else {
								complete(
									xhrSuccessStatus[ xhr.status ] || xhr.status,
									xhr.statusText,

									// Support: IE <=9 only
									// IE9 has no XHR2 but throws on binary (trac-11426)
									// For XHR2 non-text, let the caller handle it (gh-2498)
									( xhr.responseType || "text" ) !== "text"  ||
									typeof xhr.responseText !== "string" ?
										{ binary: xhr.response } :
										{ text: xhr.responseText },
									xhr.getAllResponseHeaders()
								);
							}
						}
					};
				};

				// Listen to events
				xhr.onload = callback();
				errorCallback = xhr.onerror = callback( "error" );

				// Support: IE 9 only
				// Use onreadystatechange to replace onabort
				// to handle uncaught aborts
				if ( xhr.onabort !== undefined ) {
					xhr.onabort = errorCallback;
				} else {
					xhr.onreadystatechange = function() {

						// Check readyState before timeout as it changes
						if ( xhr.readyState === 4 ) {

							// Allow onerror to be called first,
							// but that will not handle a native abort
							// Also, save errorCallback to a variable
							// as xhr.onerror cannot be accessed
							window.setTimeout( function() {
								if ( callback ) {
									errorCallback();
								}
							} );
						}
					};
				}

				// Create the abort callback
				callback = callback( "abort" );

				try {

					// Do send the request (this may raise an exception)
					xhr.send( options.hasContent && options.data || null );
				} catch ( e ) {

					// #14683: Only rethrow if this hasn't been notified as an error yet
					if ( callback ) {
						throw e;
					}
				}
			},

			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




// Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
jQuery.ajaxPrefilter( function( s ) {
	if ( s.crossDomain ) {
		s.contents.script = false;
	}
} );

// Install script dataType
jQuery.ajaxSetup( {
	accepts: {
		script: "text/javascript, application/javascript, " +
			"application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /\b(?:java|ecma)script\b/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
} );

// Handle cache's special case and crossDomain
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
	}
} );

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function( s ) {

	// This transport only deals with cross domain requests
	if ( s.crossDomain ) {
		var script, callback;
		return {
			send: function( _, complete ) {
				script = jQuery( "<script>" ).prop( {
					charset: s.scriptCharset,
					src: s.url
				} ).on(
					"load error",
					callback = function( evt ) {
						script.remove();
						callback = null;
						if ( evt ) {
							complete( evt.type === "error" ? 404 : 200, evt.type );
						}
					}
				);

				// Use native DOM manipulation to avoid our domManip AJAX trickery
				document.head.appendChild( script[ 0 ] );
			},
			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup( {
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
		this[ callback ] = true;
		return callback;
	}
} );

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" &&
				( s.contentType || "" )
					.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
				rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = jQuery.isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters[ "script json" ] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// Force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always( function() {

			// If previous value didn't exist - remove it
			if ( overwritten === undefined ) {
				jQuery( window ).removeProp( callbackName );

			// Otherwise restore preexisting value
			} else {
				window[ callbackName ] = overwritten;
			}

			// Save back as free
			if ( s[ callbackName ] ) {

				// Make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// Save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && jQuery.isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		} );

		// Delegate to script
		return "script";
	}
} );




// Support: Safari 8 only
// In Safari 8 documents created via document.implementation.createHTMLDocument
// collapse sibling forms: the second one becomes a child of the first one.
// Because of that, this security measure has to be disabled in Safari 8.
// https://bugs.webkit.org/show_bug.cgi?id=137337
support.createHTMLDocument = ( function() {
	var body = document.implementation.createHTMLDocument( "" ).body;
	body.innerHTML = "<form></form><form></form>";
	return body.childNodes.length === 2;
} )();


// Argument "data" should be string of html
// context (optional): If specified, the fragment will be created in this context,
// defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( typeof data !== "string" ) {
		return [];
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}

	var base, parsed, scripts;

	if ( !context ) {

		// Stop scripts or inline event handlers from being executed immediately
		// by using document.implementation
		if ( support.createHTMLDocument ) {
			context = document.implementation.createHTMLDocument( "" );

			// Set the base href for the created document
			// so any parsed elements with URLs
			// are based on the document's URL (gh-2965)
			base = context.createElement( "base" );
			base.href = document.location.href;
			context.head.appendChild( base );
		} else {
			context = document;
		}
	}

	parsed = rsingleTag.exec( data );
	scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[ 1 ] ) ];
	}

	parsed = buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	var selector, type, response,
		self = this,
		off = url.indexOf( " " );

	if ( off > -1 ) {
		selector = stripAndCollapse( url.slice( off ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( jQuery.isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax( {
			url: url,

			// If "type" variable is undefined, then "GET" method will be used.
			// Make value of this field explicit since
			// user can override it through ajaxSetup method
			type: type || "GET",
			dataType: "html",
			data: params
		} ).done( function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		// If the request succeeds, this function gets "data", "status", "jqXHR"
		// but they are ignored because response was set above.
		// If it fails, this function gets "jqXHR", "status", "error"
		} ).always( callback && function( jqXHR, status ) {
			self.each( function() {
				callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
			} );
		} );
	}

	return this;
};




// Attach a bunch of functions for handling common AJAX events
jQuery.each( [
	"ajaxStart",
	"ajaxStop",
	"ajaxComplete",
	"ajaxError",
	"ajaxSuccess",
	"ajaxSend"
], function( i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
} );




jQuery.expr.pseudos.animated = function( elem ) {
	return jQuery.grep( jQuery.timers, function( fn ) {
		return elem === fn.elem;
	} ).length;
};




/**
 * Gets a window from an element
 */
function getWindow( elem ) {
	return jQuery.isWindow( elem ) ? elem : elem.nodeType === 9 && elem.defaultView;
}

jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// Set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

		// Need to be able to calculate position if either
		// top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;

		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( jQuery.isFunction( options ) ) {

			// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
			options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );

		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend( {
	offset: function( options ) {

		// Preserve chaining for setter
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each( function( i ) {
					jQuery.offset.setOffset( this, options, i );
				} );
		}

		var docElem, win, rect, doc,
			elem = this[ 0 ];

		if ( !elem ) {
			return;
		}

		// Support: IE <=11 only
		// Running getBoundingClientRect on a
		// disconnected node in IE throws an error
		if ( !elem.getClientRects().length ) {
			return { top: 0, left: 0 };
		}

		rect = elem.getBoundingClientRect();

		// Make sure element is not hidden (display: none)
		if ( rect.width || rect.height ) {
			doc = elem.ownerDocument;
			win = getWindow( doc );
			docElem = doc.documentElement;

			return {
				top: rect.top + win.pageYOffset - docElem.clientTop,
				left: rect.left + win.pageXOffset - docElem.clientLeft
			};
		}

		// Return zeros for disconnected and hidden elements (gh-2310)
		return rect;
	},

	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

		// Fixed elements are offset from window (parentOffset = {top:0, left: 0},
		// because it is its only offset parent
		if ( jQuery.css( elem, "position" ) === "fixed" ) {

			// Assume getBoundingClientRect is there when computed position is fixed
			offset = elem.getBoundingClientRect();

		} else {

			// Get *real* offsetParent
			offsetParent = this.offsetParent();

			// Get correct offsets
			offset = this.offset();
			if ( !jQuery.nodeName( offsetParent[ 0 ], "html" ) ) {
				parentOffset = offsetParent.offset();
			}

			// Add offsetParent borders
			parentOffset = {
				top: parentOffset.top + jQuery.css( offsetParent[ 0 ], "borderTopWidth", true ),
				left: parentOffset.left + jQuery.css( offsetParent[ 0 ], "borderLeftWidth", true )
			};
		}

		// Subtract parent offsets and element margins
		return {
			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
		};
	},

	// This method will return documentElement in the following cases:
	// 1) For the element inside the iframe without offsetParent, this method will return
	//    documentElement of the parent window
	// 2) For the hidden or detached element
	// 3) For body or html element, i.e. in case of the html node - it will return itself
	//
	// but those exceptions were never presented as a real life use-cases
	// and might be considered as more preferable results.
	//
	// This logic, however, is not guaranteed and can change at any point in the future
	offsetParent: function() {
		return this.map( function() {
			var offsetParent = this.offsetParent;

			while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
				offsetParent = offsetParent.offsetParent;
			}

			return offsetParent || documentElement;
		} );
	}
} );

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = "pageYOffset" === prop;

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {
			var win = getWindow( elem );

			if ( val === undefined ) {
				return win ? win[ prop ] : elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : win.pageXOffset,
					top ? val : win.pageYOffset
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length );
	};
} );

// Support: Safari <=7 - 9.1, Chrome <=37 - 49
// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
// getComputedStyle returns percent when specified for top/left/bottom/right;
// rather than make the css module depend on the offset module, just check for it here
jQuery.each( [ "top", "left" ], function( i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );

				// If curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
} );


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name },
		function( defaultExtra, funcName ) {

		// Margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( jQuery.isWindow( elem ) ) {

					// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
					return funcName.indexOf( "outer" ) === 0 ?
						elem[ "inner" + name ] :
						elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
					// whichever is greatest
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?

					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable );
		};
	} );
} );


jQuery.fn.extend( {

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {

		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ?
			this.off( selector, "**" ) :
			this.off( types, selector || "**", fn );
	}
} );

jQuery.parseJSON = JSON.parse;




// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "jquery", [], function() {
		return jQuery;
	} );
}




var

	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in AMD
// (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (#13566)
if ( !noGlobal ) {
	window.jQuery = window.$ = jQuery;
}





return jQuery;
} );

},{}],5:[function(require,module,exports){
(function() {
    "use strict";

    //
    // http://www.maroon.dti.ne.jp/youkan/mz700/mziomap.html
    //
    // ADDR  R/W Explanation
    // E010h W   The pattern data to be writen to PCG-RAM
    // E011h W   The lower 8-bit address of PCG-RAM
    // E012h W   D0-D2 ADDR
    //           D3    SSW  0:use PCG
    //                      1:NOT use PCG
    //           D4    WE   Write data when the bit change 0 to 1 to 0.
    //           D5    COPY 0:Write data at E010h
    //                      1:Write data from CGROM
    //
    // http://www.sharpmz.org/mz-700/pcg700_01.htm Installation
    // http://www.sharpmz.org/mz-700/pcg700_02.htm Overview
    // http://www.sharpmz.org/mz-700/pcg700_03.htm Operation
    // http://www.sharpmz.org/mz-700/pcg700_04.htm PCG-AID
    // http://www.sharpmz.org/mz-700/pcg700_05.htm Programming
    // http://www.sharpmz.org/mz-700/pcg700_06.htm Games
    //

    var PCG700 = function() {
        this.addr = 0x000;
        this.pattern = 0x00;
        this.we = 0;
        this.ssw = 1;
        this.copy = 0;

        //Copy original CGROM
        this.CGRAM = [];
        for(var code = 0; code < 512; code++) {
            this.CGRAM.push([0,0,0,0,0,0,0,0]);
            for(var row = 0; row < 8; row++) {
                this.CGRAM[code][row] = this.getCGROMDATA(code, row);
            }
        }
    };
    PCG700.COPY = 0x20;
    PCG700.WE = 0x10;
    PCG700.SSW = 0x08;
    PCG700.ADDR = 0x07;

    PCG700.prototype.setScreen = function(screen) {
        this.screen = screen;
        this.applySSW();
    };

    PCG700.prototype.getCGROMDATA = function(code, row) {
        return mz700scrn.CGROMDATA[code][row];
    };

    PCG700.prototype.readMMIO = function(addr, value) {}

    PCG700.prototype.writeMMIO = function(addr, value) {
        //console.info("PCG700.writeMMIO(" + addr.HEX(4) + "h, " + value.HEX(4) + "h)");
        switch(addr) {
            case 0xE010:
                this.pattern = value & 0xff;
                break;
            case 0xE011:
                this.addr = ((this.addr & 0x700) | ((value & 0xff) << 0));
                break;
            case 0xE012:
                this.addr = ((this.addr & 0x0FF) | ((value & PCG700.ADDR) << 8));
                this.copy = ((value & PCG700.COPY) == 0) ? 0 : 1;

                // Write data on negative edge of WE.
                {
                    var we = this.we;
                    this.we = ((value & PCG700.WE) == 0) ? 0 : 1;
                    if(we && !this.we) {
                        this.write();
                    }
                }
                // Software switch
                {
                    var ssw = this.ssw;
                    this.ssw = ((value & PCG700.SSW) == 0) ? 0 : 1;
                    if(ssw != this.ssw) {
                        this.applySSW();
                    }
                }
                break;
            default:
                //console.warn("PCG700.onPoke unrecognized address ",  addr);
                break;
        }
    };

    PCG700.prototype.applySSW = function() {
        if(this.ssw == 0) {
            //console.info("PCG700.applySSW use PCG-700");
            this.screen.useCG(this.CGRAM);
        } else {
            //console.info("PCG700.applySSW use builtin CGROM");
            this.screen.useCGROM();
        }
    };

    PCG700.prototype.write = function() {
        var atb = (this.addr >> 10) & 0x01;
        var dispCode = 0x80 + ((this.addr >> 3) & 0x7f);
        var cpos = atb * 256 + dispCode;
        var row = (this.addr >> 0) & 0x07;
        var pattern = ((this.copy == 0) ?
                this.pattern :
                this.getCGROMDATA(cpos, row));

        //console.log("PCG700 dispCode "
        //        + dispCode.HEX(2) + "h[" + row + "] = "
        //        + pattern.HEX(2) + "h - "
        //        + pattern.BIN(8) + "b");

        this.CGRAM[cpos][row] = pattern;
        if(this.ssw == 0) {
            this.screen.useCG(this.CGRAM);
            this.screen.redrawChar(atb, dispCode);
        }
    };

    module.exports = {
        "create" : function() {
            return new PCG700();
        }
    }
}());

},{}],6:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("mz700keyboard");
    var mz700keyboard = function(element) {
        this.element = element;
        $(this.element).addClass("mz700keymatrix")
    };
    window.mz700keyboard = mz700keyboard;
    var KeyCodes = {
        "Escape"    : 27,
        "F1"  : 112, "F2"  : 113, "F3"  : 114, "F4"  : 115, "F5"  : 116,
        "F6"  : 117, "F7"  : 118, "F8"  : 119, "F9"  : 120, "F10" : 121,
        "F11" : 122, "F12" : 123,

        "Numlock" : 44,
        "ScrollLock" : 145,
        "Pause" : 19,

        "D0" : 48, "D1" : 49, "D2" : 50, "D3" : 51, "D4" : 52,
        "D5" : 53, "D6" : 54, "D7" : 55, "D8" : 56, "D9" : 57,

        "A" : 65, "B" : 66, "C" : 67, "D" : 68, "E" : 69, "F" : 70, "G" : 71,
        "H" : 72, "I" : 73, "J" : 74, "K" : 75, "L" : 76, "M" : 77, "N" : 78,
        "O" : 79, "P" : 80, "Q" : 81, "R" : 82, "S" : 83, "T" : 84, "U" : 85,
        "V" : 86, "W" : 87, "X" : 88, "Y" : 89, "Z" : 90,

        "Subtract"  : 109,
        "Caret"     : 107,
        "Atmark"    : 192,
        "Yen"       : 106,
        "Colon"     : 186,
        "SemiColon" : 187,
        "Comma"     : 188,
        "Decimal"   : 190,
        "Divide"    : 111,
        "Backslash" : 226,
        "OpenBrackets"  : 219,
        "CloseBrackets" : 221,

        "Shift"     : 16,
        "Control"   : 17,
        "Alternate" : 18,
        "Enter"     : 13,
        "Tab"       : 9,
        "Space"     : 32,
        "Backspace" : 8,

        "Insert"    : 45,
        "Delete"    : 46,
        "Home"      : 36,
        "End"       : 35,
        "PageUp"    : 33,
        "PageDown"  : 34,

        "Left"  : 37,
        "Up"    : 38,
        "Right" : 39,
        "Down"  : 40,

        "NumPad0" : 96,
        "NumPad1" : 97,
        "NumPad2" : 98,
        "NumPad3" : 99,
        "NumPad4" : 100,
        "NumPad5" : 101,
        "NumPad6" : 102,
        "NumPad7" : 103,
        "NumPad8" : 104,
        "NumPad9" : 105,

        "NumPadDivide"      : 191,
        "NumPadMultiply"    : 220,
        "NumPadSubtract"    : 189,
        "NumPadPlus"        : 222,
        "NumPadDecimal"     : 110,

        "Hankaku"   : 243,
        "Zenkaku"   : 244
    };
    var KeyNames = (function(obj) {
        Object.keys(KeyCodes).forEach(function(name) {
            var code = KeyCodes[name];
            obj[code] = name;
        });
        return obj;
    }({}));
    function mzkey(strobe, bit, face, code) {
        this.strobe = strobe;
        this.bit = bit;
        this.face = face || "&nbsp;";
        this.code = code || [];
    }
    mz700keyboard.keys = [
        new mzkey(0,0,"CR",     [KeyCodes.Enter]),
        new mzkey(0,1,":",      [KeyCodes.Colon]),
        new mzkey(0,2,";",      [KeyCodes.SemiColon]),
        new mzkey(0,3),
        new mzkey(0,4,"英数",   [KeyCodes.F10, KeyCodes.End]),
        new mzkey(0,5,"=",      [KeyCodes.Backspace]),
        new mzkey(0,6,"GRAPH",  [KeyCodes.F12, KeyCodes.PageDown, KeyCodes.Altername]),
        new mzkey(0,7,"カナ",   [KeyCodes.F11, KeyCodes.PageUp]),
        new mzkey(1,0),
        new mzkey(1,1),
        new mzkey(1,2),
        new mzkey(1,3,")",      [KeyCodes.CloseBrackets]),
        new mzkey(1,4,"(",      [KeyCodes.OpenBrackets]),
        new mzkey(1,5,"@",      [KeyCodes.Atmark]),
        new mzkey(1,6,"Z",      [KeyCodes.Z]),
        new mzkey(1,7,"Y",      [KeyCodes.Y]),
        new mzkey(2,0,"X",      [KeyCodes.X]),
        new mzkey(2,1,"W",      [KeyCodes.W]),
        new mzkey(2,2,"V",      [KeyCodes.V]),
        new mzkey(2,3,"U",      [KeyCodes.U]),
        new mzkey(2,4,"T",      [KeyCodes.T]),
        new mzkey(2,5,"S",      [KeyCodes.S]),
        new mzkey(2,6,"R",      [KeyCodes.R]),
        new mzkey(2,7,"Q",      [KeyCodes.Q]),
        new mzkey(3,0,"P",      [KeyCodes.P]),
        new mzkey(3,1,"O",      [KeyCodes.O]),
        new mzkey(3,2,"N",      [KeyCodes.N]),
        new mzkey(3,3,"M",      [KeyCodes.M]),
        new mzkey(3,4,"L",      [KeyCodes.L]),
        new mzkey(3,5,"K",      [KeyCodes.K]),
        new mzkey(3,6,"J",      [KeyCodes.J]),
        new mzkey(3,7,"I",      [KeyCodes.I]),
        new mzkey(4,0,"H",      [KeyCodes.H]),
        new mzkey(4,1,"G",      [KeyCodes.G]),
        new mzkey(4,2,"F",      [KeyCodes.F]),
        new mzkey(4,3,"E",      [KeyCodes.E]),
        new mzkey(4,4,"D",      [KeyCodes.D]),
        new mzkey(4,5,"C",      [KeyCodes.C]),
        new mzkey(4,6,"B",      [KeyCodes.B]),
        new mzkey(4,7,"A",      [KeyCodes.A]),
        new mzkey(5,0,"8",      [KeyCodes.D8, KeyCodes.NumPad8]),
        new mzkey(5,1,"7",      [KeyCodes.D7, KeyCodes.NumPad7]),
        new mzkey(5,2,"6",      [KeyCodes.D6, KeyCodes.NumPad6]),
        new mzkey(5,3,"5",      [KeyCodes.D5, KeyCodes.NumPad5]),
        new mzkey(5,4,"4",      [KeyCodes.D4, KeyCodes.NumPad4]),
        new mzkey(5,5,"3",      [KeyCodes.D3, KeyCodes.NumPad3]),
        new mzkey(5,6,"2",      [KeyCodes.D2, KeyCodes.NumPad2]),
        new mzkey(5,7,"1",      [KeyCodes.D1, KeyCodes.NumPad1]),
        new mzkey(6,0,".",      [KeyCodes.Decimal, 110]),
        new mzkey(6,1,",",      [KeyCodes.Comma]),
        new mzkey(6,2,"9",      [KeyCodes.D9, KeyCodes.NumPad9]),
        new mzkey(6,3,"0",      [KeyCodes.D0, KeyCodes.NumPad0]),
        new mzkey(6,4,"SPC",    [KeyCodes.Space]),
        new mzkey(6,5,"-",      [KeyCodes.Subtract, KeyCodes.NumPadSubtract]),
        new mzkey(6,6,"+",      [KeyCodes.Caret, KeyCodes.NumPadPlus]),
        new mzkey(6,7,"*",      [KeyCodes.Yen, KeyCodes.NumPadMultiply]),
        new mzkey(7,0,"/",      [KeyCodes.Divide, KeyCodes.NumPadDivide]),
        new mzkey(7,1,"?",      [KeyCodes.Backslash]),
        new mzkey(7,2,"←",     [KeyCodes.Left]),
        new mzkey(7,3,"→",     [KeyCodes.Right]),
        new mzkey(7,4,"↓",     [KeyCodes.Down]),
        new mzkey(7,5,"↑",     [KeyCodes.Up]),
        new mzkey(7,6,"DEL",    [KeyCodes.Delete]),
        new mzkey(7,7,"INS",    [KeyCodes.Insert]),
        new mzkey(8,0,"SHIFT",  [KeyCodes.Shift]),
        new mzkey(8,1,"(BS)"),
        new mzkey(8,2),
        new mzkey(8,3,"(→)",   [KeyCodes.Tab]),
        new mzkey(8,4,"(CR)"),
        new mzkey(8,5,"(SHIFT)"),
        new mzkey(8,6,"CTRL",   [KeyCodes.Control]),
        new mzkey(8,7,"BREAK",  [KeyCodes.Escape,KeyCodes.Pause]),
        new mzkey(9,0,"HOME",   [KeyCodes.Home]),
        new mzkey(9,1,"(SPC)"),
        new mzkey(9,2,"(↓)"),
        new mzkey(9,3,"F5",     [KeyCodes.F5]),
        new mzkey(9,4,"F4",     [KeyCodes.F4]),
        new mzkey(9,5,"F3",     [KeyCodes.F3]),
        new mzkey(9,6,"F2",     [KeyCodes.F2]),
        new mzkey(9,7,"F1",     [KeyCodes.F1])
    ];

    mz700keyboard.code2key = null;
    (function() {
        var code2key = new Array(256);
        mz700keyboard.keys.forEach(function(key) {
            key.code.forEach(function(code) {
                code2key[code] = key;
            });
        });
        mz700keyboard.code2key = code2key;
    })();
    mz700keyboard.prototype.create = function(opt) {
        var $container = $(this.element);
        $container
            .append($("<div/>").addClass("FKEYS")
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Escape]))
                .append($("<span/>").addClass("nk-1-1"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F1]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F2]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F3]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F4]))
                .append($("<span/>").addClass("nk-1-2"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F5]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F6]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F7]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F8]))
                .append($("<span/>").addClass("nk-1-3"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F9]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F10]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F11]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F12])))
            .append($("<div/>")
                .append($("<span/>").addClass("keyContainer-Kanji"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D1]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D2]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D3]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D4]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D5]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D6]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D7]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D8]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D9]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D0]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Subtract]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Caret]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Yen]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Backspace]))
                .append($("<span/>").addClass("nk-2"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Insert]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Home]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.PageUp])))
            .append($("<div/>")
                .append($("<span/>").addClass("keyContainer-Tab"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Q]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.W]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.E]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.R]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.T]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Y]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.U]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.I]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.O]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.P]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Atmark]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.OpenBrackets]))
                .append($("<span/>").addClass("nk-3"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Enter]))
                .append($("<span/>").addClass("nk-2"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Delete]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.End]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.PageDown])))
            .append($("<div/>")
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Control]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.A]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.S]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.G]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.H]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.J]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.K]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.L]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.SemiColon]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Colon]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.CloseBrackets]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Enter])))
            .append($("<div/>")
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Shift]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Z]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.X]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.C]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.V]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.B]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.N]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.M]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Comma]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Decimal]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Divide]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Backslash]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Shift]))
                .append($("<span/>").addClass("nk-5-1"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Up])))
            .append($("<div/>")
                .append($("<span/>").addClass("nk-6-1"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Space]))
                .append($("<span/>").addClass("nk-6-2"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Left]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Down]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Right])));

        mz700keyboard.keys.forEach(function(key) {
            var strobe = key.strobe;
            var bit = key.bit;
            key.code.forEach(function(code) {
                var $key = $("<span/>").addClass("button")
                    .addClass("matrix-" + strobe + "-" + bit)
                    .html(key.face)
                    .mousedown(function(s,b, obj) { return function() {
                        opt.onStateChange(s, b, true);
                        obj.setState(s, b, true);
                    }}(strobe, bit, this))
                    .mouseup(function(s,b, obj) { return function() {
                        opt.onStateChange(s, b, false);
                        obj.setState(s, b, false);
                    }}(strobe, bit, this));
                $(".keyContainer-" + KeyNames[code]).append($key);
            }, this);
        }, this);
        $(".keyContainer-F6").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        $(".keyContainer-F7").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        $(".keyContainer-F8").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        $(".keyContainer-F9").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        $(".keyContainer-Kanji").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
    };
    mz700keyboard.prototype.getMatPos =  function(code) {
        //console.log("keyCode:", code);
        return mz700keyboard.code2key[code];
    }
    mz700keyboard.prototype.setState = function(strobe, bit, state) {
        var $key = $(this.element).find(".matrix-" + strobe + "-" + bit);
        if(state) {
            $key.addClass("push");
        } else {
            $key.removeClass("push");
        }
    };
}());

},{"../lib/jquery_plugin_class":12,"jquery":4}],7:[function(require,module,exports){
/*
 * jquery.mz700scrn.js - MZ-700 Screen
 *
 * The MZ-700 is an 8-bit personal computer released by Sharp in Nov 15 1982,
 * belong in the company's MZ series.
 *
 * Copyright (c) 2016 Koji Takami
 * Released under the MIT license
 */

/*
The MIT License (MIT)

Copyright (c) 2016 Koji Takami

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("mz700scrn");
    var mz700scrn = function(container) {

        //A Container container
        this._container = container;

        //A canvas context to draw
        this._ctx = null;
    };
    window.mz700scrn = mz700scrn;

    mz700scrn.colors = {
        "black":0,
        "blue":1,
        "red":2,
        "magenta":3,
        "green":4,
        "cyan":5,
        "yellow":6,
        "white":7,
    };

    //
    // default screen size by character
    //
    mz700scrn.size = {"cols":40, "rows":25};

    //
    // Dot size of a character
    //
    mz700scrn.charSize = {"dotWidth":8, "dotHeight":8};

    //
    // Create screen
    //
    mz700scrn.prototype.create = function(opt) {

        this.opt = {
            cols: mz700scrn.size.cols,
            rows: mz700scrn.size.rows,
            CG: mz700scrn.CGROMDATA,
            color : mz700scrn.colors.white,
            backgroundColor : mz700scrn.colors.blue,
            width: '100%'
        };
        opt = opt || {};
        Object.keys(this.opt).forEach(function(key) {
            if(key in opt) {
                this.opt[key] = opt[key];
            }
        }, this);

        // Create text/attr vram
        this.vramText = [];
        this.vramAttr = [];
        for(var i = 0; i < this.opt.cols * this.opt.rows; i++) {
            this.vramText.push(0x00);
            this.vramAttr.push(0x71);
        }

        //Create canvas object
        var canvas = document.createElement("CANVAS");
        canvas.setAttribute("width", mz700scrn.charSize.dotWidth * this.opt.cols + "px");
        canvas.setAttribute("height", mz700scrn.charSize.dotHeight * this.opt.rows + "px");
        canvas.setAttribute("style", "width:100%;height:auto");
        $(canvas).css("width", this.opt.width);

        //Append to the container
        this._container.appendChild(canvas);

        //Save canvas context
        this._ctx = canvas.getContext('2d');

        //
        // A translation table to convert an address index on the VRAM
        // to the X-Y pixel position where a character shown.
        //
        this.idxloc = (function(idxloc, cols, rows) {
            for(var y = 0; y < rows; y++) {
                for(var x = 0; x < cols; x++) {
                    idxloc.push({
                        x: mz700scrn.charSize.dotWidth * x,
                        y: mz700scrn.charSize.dotHeight * y
                    });
                }
            }
            return idxloc;
        }([], this.opt.cols, this.opt.rows));

        this.createFontTable();
    };

    mz700scrn.prototype.write = function(relAddrToChars) {
        Object.keys(relAddrToChars).forEach(function(relAddr) {
            var charData = relAddrToChars[relAddr];
            var loc = this.idxloc[relAddr];
            var code = charData.attr << 8 | charData.dispcode;
            this.fonts[code](this._ctx, loc.x, loc.y);
            this.vramText[relAddr] = charData.dispcode;
            this.vramAttr[relAddr] = charData.attr;
        }, this);
    };

    // Change Character Generator
    mz700scrn.prototype.useCG = function(cgData) {
        this.opt.CG = cgData;
        this.createFontTable();
        this.redraw();
    };

    mz700scrn.prototype.redrawChar = function(atb, dispCode) {
        var abit = atb << 7;
        var chars = {};
        for(var i = 0; i < this.opt.cols * this.opt.rows; i++) {
            if(this.vramText[i] == dispCode && (this.vramAttr[i] & 0x80) == abit) {
                chars[i] = { dispcode: dispCode, attr: this.vramAttr[i] };
            }
        }
        this.write(chars);
    };

    // Change CG to default CGROM
    mz700scrn.prototype.useCGROM = function() {
        this.useCG(mz700scrn.CGROMDATA);
    };

    // Create the font table
    mz700scrn.prototype.createFontTable = function() {
        this.fonts = {};
        for(var atb = 0; atb < 2; atb++) {
            for(var dispCode = 0; dispCode < 256; dispCode++) {
                this.createFont(atb, dispCode);
            }
        }
    };

    // Create a font of all color combinations
    //
    // atb      : Attribute Bit     0 or 1
    // dispCode : Display Code      0x00 to 0xff
    //
    mz700scrn.prototype.createFont = function(atb, dispCode) {
        //Loop for background-color
        for(var bg = 0; bg < 8; bg++) {
            //Loop for fore-ground-color
            for(var fg = 0; fg < 8; fg++) {
                //the value of ATTRIBUTE VRAM
                var attr = (atb << 7)|(fg << 4) | bg;
                //Font table's key
                var code = attr << 8 | dispCode;
                //Drawing (initially creating) routine
                this.fonts[code] = this.getInitDrawFunction(
                            atb, fg, bg, attr, dispCode, code);
            }
        }
    };

    // Redraw VRAM
    mz700scrn.prototype.redraw = function() {
        var dispData = {};
        for(var i = 0; i < this.opt.cols * this.opt.rows; i++) {
            dispData[i] = {
                dispcode: this.vramText[i],
                attr: this.vramAttr[i],
            };
        }
        this.write(dispData);
    };

    mz700scrn.TableDispCode2Char = [
        [
            [" ","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O"],
            ["P","Q","R","S","T","U","V","W","X","Y","Z","┼","└","┘","├","┴"],
            ["0","1","2","3","4","5","6","7","8","9","-","=",";","/",".",","],
            ["","","","","","","","","","","","","","","",""],

            ["→","SPADE","","","DIA","←","CLUB","●","○","?","●反転","","","","","",":"],
            ["↑","<","[","HEART","]","@","",">","","BACKSLASH","HATCH","","","","",""],
            ["π","!", '"', "#", "$", "%", "AMP", "'", "(", ")","+","*","","","",""],
            ["","","","","","","","","","","","","","","",""],
            
            ["↓", "チ","コ","ソ","シ","イ","ハ","キ","ク","ニ","マ","ノ","リ","モ","ミ","ラ"],
            ["セ","タ","ス","ト","カ","ナ","ヒ","テ","サ","ン","ツ","ロ","ケ","「","ァ","ャ"],
            ["ワ","ヌ","フ","ア","ウ","エ","オ","ヤ","ユ","ヨ","ホ","ヘ","レ","メ","ル","ネ"],
            ["ム","」","ィ","ュ","ヲ","、","ゥ","ョ","゜","・","ェ","ッ","゛","。","ォ","ー"],
            
            ["PUSHDOWN","~DOWN","~UP","~RIGHT","~LEFT","~HOME","~CLEAR","UFO","CARRIGHT","CARUP","HUMAN","LHUMAN","RHUMAN","DHUMAN","FILLEDFACE","FACE"],
            ["日","月","火","水","木","金","土","生","年","時","分","秒","円","￥","￡","蛇"],
            [" ","","","","","","","","","","","","","","",""],
            [" ","","","","","","","","","","","","","","",""]
        ],
        [
            [" ","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o"],
            ["p","q","r","s","t","u","v","w","x","y","z","", "", "", "", "", ],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],

            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            
            ["",  "ち","こ","そ","し","い","は","き","く","に","ま","の","り","も","み","ら"],
            ["せ","た","す","と","か","な","ひ","て","さ","ん","つ","ろ","け","",  "ぁ","ゃ"],
            ["わ","ぬ","ふ","あ","う","え","お","や","ゆ","よ","ほ","へ","れ","め","る","ね"],
            ["む","",  "ぃ","ゅ","を","",  "ぅ","ょ","",  "",  "ぇ","っ","",  "",  "ぉ",""],
            
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
            ["","","","","","","","","","","","","","","",""],
        ]
    ];

    mz700scrn.MapChar2DispCode = (function(map) {
        mz700scrn.TableDispCode2Char.forEach(function(table, attr) {
            table.forEach(function(line, upper) {
                line.forEach(function(c, lower) {
                    if(!(c in map)) {
                        map[c] = {"attr": attr, "dispcode" : upper << 4 | lower };
                    }
                });
            });
        });
        return map;
    }({}));

    mz700scrn.char2dispcode = function (c) {
        var charData = mz700scrn.MapChar2DispCode[c];
        if(!charData) {
            charData = {attr:0, dispcode : 0xef };
        }
        return charData;
    };

    mz700scrn.str2chars = function (s) {
        var chars = s.split('');
        var entityRef = false;
        var entities = [];
        var entity = "";
        chars.forEach(function(c) {
            if(!entityRef) {
                if(c == '&') {
                    entity = '';
                    entityRef = true;
                } else {
                    entities.push(c);
                }
            } else {
                if(c == ';') {
                    entities.push(entity.toUpperCase());
                    entityRef = false;
                    entity = '';
                } else {
                    entity += c;
                }
            }
        });
        return entities;
    };

    mz700scrn.prototype.putChars = function (chars, x, y) {
        var limit = this.opt.rows * this.opt.cols;
        var dispData = {};
        var n = 0;
        var relAddr = y * this.opt.cols + x;
        var colorSpec = this.opt.color << 4 | this.opt.backgroundColor;
        chars.forEach(function(c) {
            if(relAddr < limit) {
                var data = mz700scrn.char2dispcode(c);
                dispData[relAddr] = {
                    attr: (data.attr << 7) | colorSpec,
                    dispcode: data.dispcode
                };
                relAddr++;
                n++;
            }
        });
        this.write(dispData);
        return n;
    };

    mz700scrn.prototype.clear = function () {
        var limit = this.opt.rows * this.opt.cols;
        var chars = mz700scrn.str2chars(' ');
        for(var relAddr = 0; relAddr < limit; relAddr++) {
            this.putChars(chars, relAddr, 0);
        }
    };

    mz700scrn.prototype.puts = function (s, x, y) {
        var chars = mz700scrn.str2chars(s);
        return this.putChars(chars, x, y);
    };

    mz700scrn.convert = function(element) {
        var charSize = parseInt($(element).attr("charSize")) || 8;
        var padding = parseInt($(element).attr("padding")) || 0;
        var text = element.innerText;
        var chars = mz700scrn.str2chars(text);
        $(element).empty().mz700scrn("create", {
            cols: chars.length + padding * 2,
            rows: 1 + padding * 2,
            width: charSize * chars.length + "px"
        }).mz700scrn("clear").mz700scrn("puts", text, padding, padding);
        $(element).find("canvas").css("display", "inherit");
    };

    //
    // Font bit pattern data for standard MZ-700
    //
    //  An array of array that 512 characters are defined.
    //
    //  [0x000 .. 0x0ff]: Uppercase alphabets, numbers, Japanese Kata-kana
    //  [0x100 .. 0x1ff]: Lower case alphabets, number, Japanese Hira-gana
    //
    //  These represent a bit pattern in 8 bytes by one character.
    //
    // ----
    //
    // This is own data converted from the file 'mz700fon.txt' in
    // a MZ700WIN distribution downloaded from
    // http://www.retropc.net/mz-memories/mz700/
    //
    mz700scrn.CGROMDATA = [
        [0,0,0,0,0,0,0,0],
        [24,36,66,126,66,66,66,0],
        [124,34,34,60,34,34,124,0],
        [28,34,64,64,64,34,28,0],
        [120,36,34,34,34,36,120,0],
        [126,64,64,120,64,64,126,0],
        [126,64,64,120,64,64,64,0],
        [28,34,64,78,66,34,28,0],
        [66,66,66,126,66,66,66,0],
        [28,8,8,8,8,8,28,0],
        [14,4,4,4,4,68,56,0],
        [66,68,72,112,72,68,66,0],
        [64,64,64,64,64,64,126,0],
        [66,102,90,90,66,66,66,0],
        [66,98,82,74,70,66,66,0],
        [24,36,66,66,66,36,24,0],
        [124,66,66,124,64,64,64,0],
        [24,36,66,66,74,36,26,0],
        [124,66,66,124,72,68,66,0],
        [60,66,64,60,2,66,60,0],
        [62,8,8,8,8,8,8,0],
        [66,66,66,66,66,66,60,0],
        [66,66,66,36,36,24,24,0],
        [66,66,66,90,90,102,66,0],
        [66,66,36,24,36,66,66,0],
        [34,34,34,28,8,8,8,0],
        [126,2,4,24,32,64,126,0],
        [8,8,8,8,255,8,8,8],
        [8,8,8,8,15,0,0,0],
        [8,8,8,8,248,0,0,0],
        [8,8,8,8,15,8,8,8],
        [8,8,8,8,255,0,0,0],
        [60,66,70,90,98,66,60,0],
        [8,24,40,8,8,8,62,0],
        [60,66,2,12,48,64,126,0],
        [60,66,2,60,2,66,60,0],
        [4,12,20,36,126,4,4,0],
        [126,64,120,4,2,68,56,0],
        [28,32,64,124,66,66,60,0],
        [126,66,4,8,16,16,16,0],
        [60,66,66,60,66,66,60,0],
        [60,66,66,62,2,4,56,0],
        [0,0,0,126,0,0,0,0],
        [0,0,126,0,126,0,0,0],
        [0,0,8,0,0,8,8,16],
        [0,2,4,8,16,32,64,0],
        [0,0,0,0,0,24,24,0],
        [0,0,0,0,0,8,8,16],
        [0,255,0,0,0,0,0,0],
        [64,64,64,64,64,64,64,64],
        [128,128,128,128,128,128,128,255],
        [1,1,1,1,1,1,1,255],
        [0,0,0,255,0,0,0,0],
        [16,16,16,16,16,16,16,16],
        [255,255,0,0,0,0,0,0],
        [192,192,192,192,192,192,192,192],
        [0,0,0,0,0,255,0,0],
        [4,4,4,4,4,4,4,4],
        [0,0,0,0,255,255,255,255],
        [15,15,15,15,15,15,15,15],
        [0,0,0,0,0,0,0,255],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,255,255],
        [3,3,3,3,3,3,3,3],
        [0,0,8,4,254,4,8,0],
        [8,28,62,127,127,28,62,0],
        [255,127,63,31,15,7,3,1],
        [255,255,255,255,255,255,255,255],
        [8,28,62,127,62,28,8,0],
        [0,0,16,32,127,32,16,0],
        [8,28,42,127,42,8,8,0],
        [0,60,126,126,126,126,60,0],
        [0,60,66,66,66,66,60,0],
        [60,66,2,12,16,0,16,0],
        [255,195,129,129,129,129,195,255],
        [0,0,0,0,3,4,8,8],
        [0,0,0,0,192,32,16,16],
        [128,192,224,240,248,252,254,255],
        [1,3,7,15,31,63,127,255],
        [0,0,8,0,0,8,0,0],
        [0,8,28,42,8,8,8,0],
        [14,24,48,96,48,24,14,0],
        [60,32,32,32,32,32,60,0],
        [54,127,127,127,62,28,8,0],
        [60,4,4,4,4,4,60,0],
        [28,34,74,86,76,32,30,0],
        [255,254,252,248,240,224,192,128],
        [112,24,12,6,12,24,112,0],
        [160,80,160,80,160,80,160,80],
        [0,64,32,16,8,4,2,0],
        [170,85,170,85,170,85,170,85],
        [240,240,240,240,15,15,15,15],
        [0,0,0,0,15,8,8,8],
        [0,0,0,0,248,8,8,8],
        [8,8,8,8,248,8,8,8],
        [0,0,0,0,255,8,8,8],
        [0,0,1,62,84,20,20,0],
        [8,8,8,8,0,0,8,0],
        [36,36,36,0,0,0,0,0],
        [36,36,126,36,126,36,36,0],
        [8,30,40,28,10,60,8,0],
        [0,98,100,8,16,38,70,0],
        [48,72,72,48,74,68,58,0],
        [4,8,16,0,0,0,0,0],
        [4,8,16,16,16,8,4,0],
        [32,16,8,8,8,16,32,0],
        [0,8,8,62,8,8,0,0],
        [8,42,28,62,28,42,8,0],
        [15,15,15,15,240,240,240,240],
        [129,66,36,24,24,36,66,129],
        [16,16,32,192,0,0,0,0],
        [8,8,4,3,0,0,0,0],
        [255,0,0,0,0,0,0,0],
        [128,128,128,128,128,128,128,128],
        [255,128,128,128,128,128,128,128],
        [255,1,1,1,1,1,1,1],
        [0,0,255,0,0,0,0,0],
        [32,32,32,32,32,32,32,32],
        [1,2,4,8,16,32,64,128],
        [128,64,32,16,8,4,2,1],
        [0,0,0,0,255,0,0,0],
        [8,8,8,8,8,8,8,8],
        [255,255,255,255,0,0,0,0],
        [240,240,240,240,240,240,240,240],
        [0,0,0,0,0,0,255,0],
        [2,2,2,2,2,2,2,2],
        [0,0,0,0,0,255,255,255],
        [7,7,7,7,7,7,7,7],
        [0,8,8,8,42,28,8,0],
        [4,56,8,62,8,8,16,0],
        [0,62,2,2,2,2,62,0],
        [0,34,34,18,2,4,24,0],
        [0,48,2,50,2,4,56,0],
        [2,4,8,24,40,8,8,0],
        [0,8,4,34,34,34,34,0],
        [8,62,8,62,8,8,8,0],
        [0,30,18,34,2,4,24,0],
        [0,28,0,0,0,0,62,0],
        [0,62,2,2,20,8,4,0],
        [4,4,4,4,4,8,16,0],
        [36,36,36,36,4,8,16,0],
        [0,62,16,62,16,16,14,0],
        [0,28,0,28,0,60,2,0],
        [28,0,62,2,2,4,8,0],
        [16,62,18,20,16,16,14,0],
        [0,30,18,42,6,4,24,0],
        [0,62,2,4,8,20,34,0],
        [16,16,16,24,20,16,16,0],
        [16,62,18,18,18,18,36,0],
        [8,8,62,8,8,16,32,0],
        [32,32,62,32,32,32,30,0],
        [28,0,62,8,8,8,16,0],
        [20,62,20,20,4,8,16,0],
        [0,48,0,2,2,4,56,0],
        [0,42,42,42,2,4,8,0],
        [0,62,34,34,34,34,62,0],
        [16,30,36,4,4,4,8,0],
        [30,16,16,16,0,0,0,0],
        [0,0,62,2,12,8,16,0],
        [0,0,16,62,18,20,16,0],
        [0,62,34,34,2,4,8,0],
        [0,62,2,20,8,20,32,0],
        [0,62,2,2,2,4,24,0],
        [62,2,10,12,8,8,16,0],
        [8,62,34,34,2,4,8,0],
        [0,62,8,8,8,8,62,0],
        [4,62,4,12,20,36,4,0],
        [16,16,62,18,20,16,16,0],
        [0,28,4,4,4,4,62,0],
        [0,62,2,62,2,2,62,0],
        [8,62,8,8,42,42,8,0],
        [0,16,40,4,2,2,0,0],
        [0,32,32,34,36,40,48,0],
        [0,2,2,20,8,20,32,0],
        [0,8,40,40,42,42,44,0],
        [8,62,4,8,28,42,8,0],
        [0,8,16,32,34,62,2,0],
        [0,0,0,8,8,8,120,0],
        [0,0,4,8,24,40,8,0],
        [0,0,0,28,4,4,62,0],
        [0,62,2,62,2,4,8,0],
        [0,0,0,0,64,32,16,0],
        [0,0,8,62,34,2,12,0],
        [0,0,60,4,60,4,60,0],
        [112,80,112,0,0,0,0,0],
        [0,0,0,0,0,0,32,0],
        [0,0,0,62,8,8,62,0],
        [0,0,0,42,42,2,12,0],
        [16,72,32,0,0,0,0,0],
        [0,0,0,0,112,80,112,0],
        [0,0,4,62,12,20,36,0],
        [0,0,0,28,0,0,0,0],
        [28,28,62,28,8,0,62,0],
        [255,247,247,247,213,227,247,255],
        [255,247,227,213,247,247,247,255],
        [255,255,247,251,129,251,247,255],
        [255,255,239,223,129,223,239,255],
        [187,187,187,131,187,187,187,255],
        [227,221,191,191,191,221,227,255],
        [24,36,126,255,90,36,0,0],
        [224,71,66,126,66,71,224,0],
        [34,62,42,8,8,73,127,65],
        [28,28,8,62,8,8,20,34],
        [0,17,210,252,210,17,0,0],
        [0,136,75,63,75,136,0,0],
        [34,20,8,8,62,8,28,28],
        [60,126,255,219,255,231,126,60],
        [60,66,129,165,129,153,66,60],
        [62,34,34,62,34,34,62,0],
        [62,34,62,34,62,34,66,0],
        [8,42,42,8,20,34,65,0],
        [8,9,58,12,28,42,73,0],
        [8,8,62,8,28,42,73,0],
        [8,20,62,73,62,28,127,0],
        [0,8,8,62,8,8,127,0],
        [8,72,126,72,62,8,127,0],
        [32,62,72,60,40,126,8,0],
        [4,126,84,127,82,127,10,0],
        [8,20,34,127,18,18,36,0],
        [56,18,127,23,59,82,20,0],
        [127,73,73,127,65,65,65,0],
        [34,20,62,8,62,8,8,0],
        [12,18,16,56,16,16,62,0],
        [0,192,200,84,84,85,34,0],
        [0,0,0,0,0,2,255,2],
        [2,2,2,2,2,2,7,2],
        [2,2,2,2,2,2,255,2],
        [0,0,32,80,136,5,2,0],
        [0,14,17,34,196,4,2,1],
        [0,255,0,129,66,66,129,0],
        [0,112,136,68,35,32,64,128],
        [0,196,164,148,143,148,164,196],
        [0,35,37,41,241,41,37,35],
        [136,144,160,192,192,168,152,184],
        [168,176,184,192,192,160,144,136],
        [128,64,32,16,31,32,64,128],
        [0,0,36,36,231,36,36,0],
        [8,8,62,0,0,62,8,8],
        [8,16,32,16,8,4,2,4],
        [85,170,85,170,85,170,85,170],
        [0,0,0,0,0,0,0,0],
        [0,112,112,112,0,0,0,0],
        [0,7,7,7,0,0,0,0],
        [0,119,119,119,0,0,0,0],
        [0,0,0,0,0,112,112,112],
        [0,112,112,112,0,112,112,112],
        [0,7,7,7,0,112,112,112],
        [0,119,119,119,0,112,112,112],
        [0,0,0,0,0,7,7,7],
        [0,112,112,112,0,7,7,7],
        [0,7,7,7,0,7,7,7],
        [0,119,119,119,0,7,7,7],
        [0,0,0,0,0,119,119,119],
        [0,112,112,112,0,119,119,119],
        [0,7,7,7,0,119,119,119],
        [0,119,119,119,0,119,119,119],
        [0,0,0,0,0,0,0,0],
        [0,0,56,4,60,68,58,0],
        [64,64,92,98,66,98,92,0],
        [0,0,60,66,64,66,60,0],
        [2,2,58,70,66,70,58,0],
        [0,0,60,66,126,64,60,0],
        [12,18,16,124,16,16,16,0],
        [0,0,58,70,70,58,2,60],
        [64,64,92,98,66,66,66,0],
        [8,0,24,8,8,8,28,0],
        [4,0,12,4,4,4,68,56],
        [64,64,68,72,80,104,68,0],
        [24,8,8,8,8,8,28,0],
        [0,0,118,73,73,73,73,0],
        [0,0,92,98,66,66,66,0],
        [0,0,60,66,66,66,60,0],
        [0,0,92,98,98,92,64,64],
        [0,0,58,70,70,58,2,2],
        [0,0,92,98,64,64,64,0],
        [0,0,62,64,60,2,124,0],
        [16,16,124,16,16,18,12,0],
        [0,0,66,66,66,66,60,0],
        [0,0,66,66,66,36,24,0],
        [0,0,65,73,73,73,54,0],
        [0,0,68,40,16,40,68,0],
        [0,0,66,66,70,58,2,60],
        [0,0,126,4,24,32,126,0],
        [8,8,8,8,255,8,8,8],
        [8,8,8,8,15,0,0,0],
        [8,8,8,8,248,0,0,0],
        [8,8,8,8,15,8,8,8],
        [8,8,8,8,255,0,0,0],
        [60,66,70,90,98,66,60,0],
        [8,24,40,8,8,8,62,0],
        [60,66,2,12,48,64,126,0],
        [60,66,2,60,2,66,60,0],
        [4,12,20,36,126,4,4,0],
        [126,64,120,4,2,68,56,0],
        [28,32,64,124,66,66,60,0],
        [126,66,4,8,16,16,16,0],
        [60,66,66,60,66,66,60,0],
        [60,66,66,62,2,4,56,0],
        [0,0,0,126,0,0,0,0],
        [0,0,126,0,126,0,0,0],
        [0,0,8,0,0,8,8,16],
        [0,2,4,8,16,32,64,0],
        [0,0,0,0,0,24,24,0],
        [0,0,0,0,0,8,8,16],
        [0,255,0,0,0,0,0,0],
        [64,64,64,64,64,64,64,64],
        [128,128,128,128,128,128,128,255],
        [1,1,1,1,1,1,1,255],
        [0,0,0,255,0,0,0,0],
        [16,16,16,16,16,16,16,16],
        [255,255,0,0,0,0,0,0],
        [192,192,192,192,192,192,192,192],
        [0,0,0,0,0,255,0,0],
        [4,4,4,4,4,4,4,4],
        [0,0,0,0,255,255,255,255],
        [15,15,15,15,15,15,15,15],
        [0,0,0,0,0,0,0,255],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,255,255],
        [3,3,3,3,3,3,3,3],
        [0,0,8,4,254,4,8,0],
        [8,28,62,127,127,28,62,0],
        [255,127,63,31,15,7,3,1],
        [255,255,255,255,255,255,255,255],
        [8,28,62,127,62,28,8,0],
        [0,0,16,32,127,32,16,0],
        [8,28,42,127,42,8,8,0],
        [0,60,126,126,126,126,60,0],
        [0,60,66,66,66,66,60,0],
        [60,66,2,12,16,0,16,0],
        [255,195,129,129,129,129,195,255],
        [0,0,0,0,3,4,8,8],
        [0,0,0,0,192,32,16,16],
        [128,192,224,240,248,252,254,255],
        [1,3,7,15,31,63,127,255],
        [0,0,8,0,0,8,0,0],
        [0,8,28,42,8,8,8,0],
        [14,24,48,96,48,24,14,0],
        [60,32,32,32,32,32,60,0],
        [54,127,127,127,62,28,8,0],
        [60,4,4,4,4,4,60,0],
        [28,34,74,86,76,32,30,0],
        [255,254,252,248,240,224,192,128],
        [112,24,12,6,12,24,112,0],
        [160,80,160,80,160,80,160,80],
        [0,64,32,16,8,4,2,0],
        [170,85,170,85,170,85,170,85],
        [240,240,240,240,15,15,15,15],
        [0,0,0,0,15,8,8,8],
        [0,0,0,0,248,8,8,8],
        [8,8,8,8,248,8,8,8],
        [0,0,0,0,255,8,8,8],
        [0,0,1,62,84,20,20,0],
        [8,8,8,8,0,0,8,0],
        [36,36,36,0,0,0,0,0],
        [36,36,126,36,126,36,36,0],
        [8,30,40,28,10,60,8,0],
        [0,98,100,8,16,38,70,0],
        [48,72,72,48,74,68,58,0],
        [4,8,16,0,0,0,0,0],
        [4,8,16,16,16,8,4,0],
        [32,16,8,8,8,16,32,0],
        [0,8,8,62,8,8,0,0],
        [8,42,28,62,28,42,8,0],
        [15,15,15,15,240,240,240,240],
        [129,66,36,24,24,36,66,129],
        [16,16,32,192,0,0,0,0],
        [8,8,4,3,0,0,0,0],
        [255,0,0,0,0,0,0,0],
        [128,128,128,128,128,128,128,128],
        [255,128,128,128,128,128,128,128],
        [255,1,1,1,1,1,1,1],
        [0,0,255,0,0,0,0,0],
        [32,32,32,32,32,32,32,32],
        [4,8,17,34,68,136,16,32],
        [32,16,136,68,34,17,8,4],
        [0,0,0,0,255,0,0,0],
        [8,8,8,8,8,8,8,8],
        [255,255,255,255,0,0,0,0],
        [240,240,240,240,240,240,240,240],
        [0,0,0,0,0,0,255,0],
        [2,2,2,2,2,2,2,2],
        [0,0,0,0,0,255,255,255],
        [7,7,7,7,7,7,7,7],
        [0,8,8,8,42,28,8,0],
        [16,254,32,124,2,2,252,0],
        [0,252,2,0,0,128,126,0],
        [60,8,16,126,8,16,12,0],
        [64,64,64,64,68,68,56,0],
        [132,130,130,130,130,144,96,0],
        [132,158,132,132,156,166,92,0],
        [16,126,8,126,4,2,96,24],
        [12,24,48,96,48,24,12,0],
        [158,128,128,128,128,144,222,0],
        [16,126,16,126,16,112,156,114],
        [56,84,146,146,146,146,100,0],
        [68,68,68,100,4,8,16,0],
        [32,248,32,248,34,34,28,0],
        [112,16,20,126,148,148,100,0],
        [96,0,156,162,194,130,28,0],
        [68,68,254,68,88,64,62,0],
        [32,252,64,94,128,160,190,0],
        [8,254,8,56,72,56,8,16],
        [32,34,44,48,64,128,126,0],
        [34,249,37,36,36,36,72,0],
        [32,250,65,68,156,166,28,0],
        [224,38,69,132,132,136,112,0],
        [254,4,8,16,16,8,4,0],
        [32,254,16,8,68,32,24,0],
        [16,32,32,112,72,136,134,0],
        [128,124,2,2,2,4,24,0],
        [124,8,16,44,66,2,36,24],
        [132,190,132,132,132,132,72,0],
        [30,16,16,16,0,0,0,0],
        [0,32,112,32,120,148,104,0],
        [0,0,88,228,40,32,16,0],
        [32,228,42,50,98,162,36,0],
        [4,68,124,74,178,151,102,0],
        [56,0,16,74,74,138,48,0],
        [32,252,32,124,170,146,100,0],
        [24,0,60,66,2,4,8,0],
        [16,0,124,8,16,40,70,0],
        [32,253,33,124,162,162,100,0],
        [72,76,50,226,36,16,16,8],
        [8,156,170,202,202,140,24,0],
        [8,14,8,8,120,142,120,0],
        [158,132,158,132,156,166,220,0],
        [0,32,80,136,4,2,2,0],
        [32,230,44,52,100,164,34,0],
        [4,68,124,74,178,146,100,0],
        [124,8,16,60,66,26,36,24],
        [32,228,42,50,102,171,38,0],
        [32,253,33,96,160,98,62,0],
        [0,0,0,0,8,8,8,120],
        [0,0,72,68,68,68,32,0],
        [0,0,16,184,212,152,48,0],
        [16,254,32,116,184,72,126,0],
        [0,0,0,0,0,64,32,16],
        [0,32,0,120,4,4,8,0],
        [0,0,32,56,32,120,96,0],
        [112,80,112,0,0,0,0,0],
        [0,0,0,0,0,0,32,0],
        [0,32,0,120,16,48,76,0],
        [0,0,0,248,4,4,24,0],
        [32,144,64,0,0,0,0,0],
        [0,0,0,0,0,112,80,112],
        [0,32,116,32,120,164,104,0],
        [0,0,0,28,0,0,0,0],
        [28,28,62,28,8,0,62,0],
        [255,247,247,247,213,227,247,255],
        [255,247,227,213,247,247,247,255],
        [255,255,247,251,129,251,247,255],
        [255,255,239,223,129,223,239,255],
        [187,187,187,131,187,187,187,255],
        [227,221,191,191,191,221,227,255],
        [24,36,126,255,90,36,0,0],
        [224,71,66,126,66,71,224,0],
        [34,62,42,8,8,73,127,65],
        [28,28,8,62,8,8,20,34],
        [0,17,210,252,210,17,0,0],
        [0,136,75,63,75,136,0,0],
        [34,20,8,8,62,8,28,28],
        [60,126,255,219,255,231,126,60],
        [60,66,129,165,129,153,66,60],
        [62,34,34,62,34,34,62,0],
        [62,34,62,34,62,34,66,0],
        [8,42,42,8,20,34,65,0],
        [8,9,58,12,28,42,73,0],
        [8,8,62,8,28,42,73,0],
        [8,20,62,73,62,28,127,0],
        [0,8,8,62,8,8,127,0],
        [8,72,126,72,62,8,127,0],
        [32,62,72,60,40,126,8,0],
        [4,126,84,127,82,127,10,0],
        [8,20,34,127,18,18,36,0],
        [56,18,127,23,59,82,20,0],
        [127,73,73,127,65,65,65,0],
        [34,20,62,8,62,8,8,0],
        [12,18,16,56,16,16,62,0],
        [0,192,200,84,84,85,34,0],
        [0,0,0,0,0,2,255,2],
        [2,2,2,2,2,2,7,2],
        [2,2,2,2,2,2,255,2],
        [0,0,32,80,136,5,2,0],
        [0,14,17,34,196,4,2,1],
        [0,255,0,129,66,66,129,0],
        [0,112,136,68,35,32,64,128],
        [0,196,164,148,143,148,164,196],
        [0,35,37,41,241,41,37,35],
        [136,144,160,192,192,168,152,184],
        [168,176,184,192,192,160,144,136],
        [128,64,32,16,31,32,64,128],
        [0,0,36,36,231,36,36,0],
        [8,8,62,0,0,62,8,8],
        [8,16,32,16,8,4,2,4],
        [85,170,85,170,85,170,85,170],
        [0,0,0,0,0,0,0,0],
        [0,112,112,112,0,0,0,0],
        [0,7,7,7,0,0,0,0],
        [0,119,119,119,0,0,0,0],
        [0,0,0,0,0,112,112,112],
        [0,112,112,112,0,112,112,112],
        [0,7,7,7,0,112,112,112],
        [0,119,119,119,0,112,112,112],
        [0,0,0,0,0,7,7,7],
        [0,112,112,112,0,7,7,7],
        [0,7,7,7,0,7,7,7],
        [0,119,119,119,0,7,7,7],
        [0,0,0,0,0,119,119,119],
        [0,112,112,112,0,119,119,119],
        [0,7,7,7,0,119,119,119],
        [0,119,119,119,0,119,119,119]
    ];

    //
    // Color table
    // [Black, Blue, Red, Magenta, Green, Cyan, Yellow, White]
    //
    mz700scrn.Colors = [
        "rgb(0,0,0)",
        "rgb(0,0,255)",
        "rgb(255,0,0)",
        "rgb(255,0,255)",
        "rgb(0,255,0)",
        "rgb(0,255,255)",
        "rgb(255,255,0)",
        "rgb(255,255,255)",
    ];

    //
    // Initial character creation and drawing routine.
    //
    mz700scrn.prototype.getInitDrawFunction = function(atb, fg, bg, attr, dispCode, code) {
        return function(ctxScrn, x, y) {

            //Create canvas object for the font
            var cvs = document.createElement("CANVAS");
            cvs.setAttribute("width", mz700scrn.charSize.dotWidth + "px");
            cvs.setAttribute("height",mz700scrn.charSize.dotHeight + "px");

            //Save its context
            var ctxFont = cvs.getContext("2d");

            //Draw the bit patterns
            var rowData = this.opt.CG[atb * 256 + dispCode];
            for(var row = 0; row < 8; row++) {
                var rowBits = rowData[row];
                for(var col = 0; col < 8; col++) {
                    if((rowBits & (0x80 >> col)) != 0) {
                        ctxFont.fillStyle = mz700scrn.Colors[fg];
                    } else {
                        ctxFont.fillStyle = mz700scrn.Colors[bg];
                    }
                    ctxFont.fillRect(col, row, 1, 1);
                }
            }

            //Replace this function to drawing only one in the font table.
            this.fonts[code] = (function(ctxFont) {
                return function(ctxScrn, x,y) {
                    ctxScrn.putImageData(
                            ctxFont.getImageData(0, 0,
                                mz700scrn.charSize.dotWidth,
                                mz700scrn.charSize.dotHeight), x, y);
                };
            }(ctxFont));

            //Draw this character
            this.fonts[code](ctxScrn, x, y);

        }.bind(this);
    };

}());

},{"../lib/jquery_plugin_class":12,"jquery":4}],8:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("dumplist");
    var dumplist = function(element) {
        this.element = element;
        this.opt = {
            "readMemory" : null,
            "rows" : 16,
            "_topAddr" : 0,
            "fontFamily" : 'monospace',
            "fontSize" : '4pt',
            "rowHeight" : '14px',
            "colWidth" : '16px',
            "headerWidth" : '30px',
            "getRegValue" : function() {}
        }
    };
    window.dumplist = dumplist;
    dumplist.prototype.init = function(opt) {
        if(opt) {
            Object.keys(this.opt).forEach(function(key) {
                if(key in opt) { this.opt[key] = opt[key]; }
            }, this);
        }
        var $root = $("<div/>");
        $root.insertBefore($(this.element));
        $(this.element).appendTo($root);

        var $container = $(this.element);
        $container.empty()
            .css('font-family', this.opt.fontFamily)
            .css('font-size', this.opt.fontSize)
            .css("border-bottom","solid 1px gray");
        var $buttons = $("<div/>");
        $container.append($buttons);
        var $row = $("<div/>").addClass("row").addClass("header")
            .css('height', this.opt.rowHeight)
            .css('line-height', this.opt.rowHeight)
            .css("border-bottom","solid 1px gray");
        $container.append($row);

        var $col = $("<span/>")
            .addClass("cell").addClass("header")
            .css('display','inline-block')
            .css('width', this.opt.headerWidth)
            .css('text-align', "center")
            .html("ADDR");
        $row.append($col);
        
        for(var col = 0; col < 16; col++) {
            var $col = $("<span/>")
                .addClass("cell").addClass("c" + col)
                .css('display','inline-block')
                .css('width', this.opt.colWidth)
                .css('text-align', "center");
            $col.html('+' + col.HEX(1));
            $row.append($col);
        }

        this._topAddr = this.opt._topAddr;
        var addr = this._topAddr;
        this.addrCols = [];
        this.dataCells = [];
        for(var row = 0; row < this.opt.rows; row++) {
            var $row = $("<div/>")
                .addClass("row").addClass("r" + row)
                .css('height', this.opt.rowHeight)
                .css('line-height', this.opt.rowHeight);
            $container.append($row);

            var $col = $("<span/>")
                .addClass("cell").addClass("header")
                .css('display','inline-block')
                .css('width', this.opt.headerWidth)
                .css('text-align', "center");

            $row.append($col);
            this.addrCols.push($col);
            for(var col = 0; col < 16; col++) {
                if(this.readMemory == null) {
                    var data = '**';
                    var $col = $("<span/>")
                        .addClass("cell").addClass("c" + col)
                        .css('display','inline-block')
                        .css('width', this.opt.colWidth)
                        .css('text-align', "center");
                    this.dataCells.push($col);
                    $row.append($col);
                } else {
                    this.readMemory(addr, (function(THIS, row, col) {
                        return function(data) {
                            var $col = $("<span/>")
                                .addClass("cell")
                                .addClass("c" + col)
                                .css('display','inline-block')
                                .css('width', THIS.opt.colWidth)
                                .css('text-align', "center");
                            THIS.dataCells.push($col);
                            row.append($col);
                        };
                    }(this, $row, col)));
                }
                addr++;
            }
        }

        //
        // 16ビットレジスタが指すアドレスを表示するボタン
        //
        [
            {"H":"B","L": "C"},
            {"H":"D","L": "E"},
            {"H":"H","L": "L"},
            "PC", "SP", "IX", "IY"
        ].forEach(function(regs) {
            var pair = ((typeof(regs) == "string") ? false : true);
            var name16 = (pair ? regs.H + regs.L : regs);
            var getRegValue = (pair ?
                function(regs, callback) {
                    opt.getReg(regs.H, function(value_h) {
                        opt.getReg(regs.L, function(value_l) {
                            callback(value_h * 256 + value_l);
                        });
                    });
                } :
                function(regs, callback) {
                    opt.getReg(regs, callback);
                });
            $buttons
                .append($("<button/>")
                    .attr("id", "btnShowMem" + name16)
                    .attr("type", "button").css("width", "50px").html(name16)
                    .click(function() {
                        getRegValue(regs, function(value) {
                            $("#txtShowMemAddr").val(value.HEX(4) + "H");
                            this.topAddr(value);
                        }.bind(this));
                    }.bind(this)));
        }, this);

        //
        // 指定アドレスを表示するテキストボックスとボタン
        //
        $buttons
            .append($("<input/>")
                    .attr("id", "txtShowMemAddr").attr("type", "text")
                    .attr("value", "0000h").css("width", "80px")
                    .attr("title",
                        "16進数(最後にhまたはH)の他、プログラム中のラベルも使えます。"
                        + "10進数、8進数(0から始まる数字)もOK"))
            .append($("<button/>")
                .attr("id", "btnShowMemAddr")
                .attr("type", "button").css("width", "80px").html("表示更新")
                .click(function() {
                    var addrToken = $("#txtShowMemAddr").val();
                    var asm = new Z80_assemble();
                    var addr = asm.parseAddress(addrToken);
                    if(addr != null) {
                        this.topAddr(addr);
                    }
                }.bind(this)));
        
        this.redraw();
    };

    dumplist.prototype.setReadMemoryHandler = function(handler) {
        this.readMemory = handler;
        this.redraw();
    }
    dumplist.prototype.topAddr = function(topAddr) {
        if(topAddr != null) {
            this._topAddr = topAddr;
            this.redraw();
        }
        return this._topAddr;
    };

    dumplist.prototype.redraw = function(opt) {
        var addr = this._topAddr;
        var cellIndex = 0;
        for(var row = 0; row < this.opt.rows; row++) {
            this.addrCols[row].html(addr.HEX(4));
            for(var col = 0; col < 16; col++) {
                if(this.readMemory == null) {
                    this.dataCells[cellIndex].html('**');
                } else {
                    this.readMemory(addr,
                            (function(THIS, index) {
                                return function(value) {
                                    THIS.dataCells[index].html(value.HEX(2));
                                };
                            }(this, cellIndex)));
                }
                addr++;
                cellIndex++;
            }
        }
    };
    dumplist.prototype.updateAt = function(address, value) {
        var cellIndex = address - this._topAddr;
        if(0 <= cellIndex && cellIndex < this.opt.rows * 16) {
            this.dataCells[cellIndex].html(value.HEX(2));
        }
    };
}());

},{"../lib/jquery_plugin_class":12,"jquery":4}],9:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("Z80RegView");
    var Z80RegView = function(element) {
        this.element = element;
    };
    window.Z80RegView = Z80RegView;
    Z80RegView.prototype.init = function(opt) {
        var createRegValue = function(initHtml) {
            return $("<div/>")
                .addClass("reg-value")
                .html(initHtml);
        }
        this.$B = createRegValue("--");
        this.$C = createRegValue("--");
        this.$D = createRegValue("--");
        this.$E = createRegValue("--");
        this.$H = createRegValue("--");
        this.$L = createRegValue("--");
        this.$A = createRegValue("--");

        this.$FS = createRegValue("-");
        this.$FZ = createRegValue("-");
        this.$F5 = createRegValue("-");
        this.$FH = createRegValue("-");
        this.$F1 = createRegValue("-");
        this.$FP = createRegValue("-");
        this.$FN = createRegValue("-");
        this.$FC = createRegValue("-");

        this.$PC = createRegValue("----");
        this.$SP = createRegValue("----");
        this.$IX = createRegValue("----");
        this.$IY = createRegValue("----");

        this.$IFF1 = createRegValue("-");
        this.$IFF2 = createRegValue("-");
        this.$HALT = createRegValue("-");
        this.$IM = createRegValue("-");
        this.$I = createRegValue("--");
        this.$R = createRegValue("--");
        
        this.$B_ = createRegValue("--");
        this.$C_ = createRegValue("--");
        this.$D_ = createRegValue("--");
        this.$E_ = createRegValue("--");
        this.$H_ = createRegValue("--");
        this.$L_ = createRegValue("--");
        this.$A_ = createRegValue("--");
        
        this.$FS_ = createRegValue("-");
        this.$FZ_ = createRegValue("-");
        this.$F5_ = createRegValue("-");
        this.$FH_ = createRegValue("-");
        this.$F1_ = createRegValue("-");
        this.$FP_ = createRegValue("-");
        this.$FN_ = createRegValue("-");
        this.$FC_ = createRegValue("-");

        this.$R_ = createRegValue("-");

        $(this.element).empty()
            .addClass("Z80RegView")
            .append($("<div/>").addClass("row")
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("B"))
                    .append(this.$B))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("C"))
                    .append(this.$C))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("D"))
                    .append(this.$D))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("E"))
                    .append(this.$E))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("H"))
                    .append(this.$H))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("L"))
                    .append(this.$L))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("A"))
                    .append(this.$A))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("S"))
                    .append(this.$FS))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("Z"))
                    .append(this.$FZ))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("-"))
                    .append(this.$F5))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("H"))
                    .append(this.$FH))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("-"))
                    .append(this.$F1))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("P/V"))
                    .append(this.$FP))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("N"))
                    .append(this.$FN))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("C"))
                    .append(this.$FC))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("PC"))
                    .append(this.$PC))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("SP"))
                    .append(this.$SP))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IX"))
                    .append(this.$IX))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IY"))
                    .append(this.$IY))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("I"))
                    .append(this.$I)))
            .append($("<div/>").addClass("row")
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("B'"))
                    .append(this.$B_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("C'"))
                    .append(this.$C_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("D'"))
                    .append(this.$D_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("E'"))
                    .append(this.$E_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("H'"))
                    .append(this.$H_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("L'"))
                    .append(this.$L_))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("A'"))
                    .append(this.$A_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("S'"))
                    .append(this.$FS_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("Z'"))
                    .append(this.$FZ_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("-"))
                    .append(this.$F5_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("H'"))
                    .append(this.$FH_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("-"))
                    .append(this.$F1_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("P/V'"))
                    .append(this.$FP_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("N'"))
                    .append(this.$FN_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("C'"))
                    .append(this.$FC_))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IFF1"))
                    .append(this.$IFF1))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IFF2"))
                    .append(this.$IFF2))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("HALT"))
                    .append(this.$HALT))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IM"))
                    .append(this.$IM))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("R"))
                    .append(this.$R)));

        this.elemB = this.$B.get(0);
        this.elemC = this.$C.get(0);
        this.elemD = this.$D.get(0);
        this.elemE = this.$E.get(0);
        this.elemH = this.$H.get(0);
        this.elemL = this.$L.get(0);
        this.elemA = this.$A.get(0);

        this.elemFS = this.$FS.get(0);
        this.elemFZ = this.$FZ.get(0);
        this.elemF5 = this.$F5.get(0);
        this.elemFH = this.$FH.get(0);
        this.elemF1 = this.$F1.get(0);
        this.elemFP = this.$FP.get(0);
        this.elemFN = this.$FN.get(0);
        this.elemFC = this.$FC.get(0);
        this.elemPC = this.$PC.get(0);
        this.elemSP = this.$SP.get(0);
        this.elemIX = this.$IX.get(0);
        this.elemIY = this.$IY.get(0);

        this.elemIFF1 = this.$IFF1.get(0);
        this.elemIFF2 = this.$IFF2.get(0);
        this.elemHALT = this.$HALT.get(0);
        this.elemIM = this.$IM.get(0);
        this.elemI = this.$I.get(0);
        this.elemR = this.$R.get(0);

        this.elemB_ = this.$B_.get(0);
        this.elemC_ = this.$C_.get(0);
        this.elemD_ = this.$D_.get(0);
        this.elemE_ = this.$E_.get(0);
        this.elemH_ = this.$H_.get(0);
        this.elemL_ = this.$L_.get(0);
        this.elemA_ = this.$A_.get(0);

        this.elemFS_ = this.$FS_.get(0);
        this.elemFZ_ = this.$FZ_.get(0);
        this.elemF5_ = this.$F5_.get(0);
        this.elemFH_ = this.$FH_.get(0);
        this.elemF1_ = this.$F1_.get(0);
        this.elemFP_ = this.$FP_.get(0);
        this.elemFN_ = this.$FN_.get(0);
        this.elemFC_ = this.$FC_.get(0);

        this.elemR_ = this.$R_.get(0);
    };
    Z80RegView.prototype.update = function(reg) {
        this.elemB.innerHTML = reg.B.HEX(2);
        this.elemC.innerHTML = reg.C.HEX(2);
        this.elemD.innerHTML = reg.D.HEX(2);
        this.elemE.innerHTML = reg.E.HEX(2);
        this.elemH.innerHTML = reg.H.HEX(2);
        this.elemL.innerHTML = reg.L.HEX(2);
        this.elemA.innerHTML = reg.A.HEX(2);

        this.elemFS.innerHTML = (reg.F & 0x80) ? 1:0;
        this.elemFZ.innerHTML = (reg.F & 0x40) ? 1:0;
        this.elemF5.innerHTML = (reg.F & 0x20) ? 1:0;
        this.elemFH.innerHTML = (reg.F & 0x10) ? 1:0;
        this.elemF1.innerHTML = (reg.F & 0x08) ? 1:0;
        this.elemFP.innerHTML = (reg.F & 0x04) ? 1:0;
        this.elemFN.innerHTML = (reg.F & 0x02) ? 1:0;
        this.elemFC.innerHTML = (reg.F & 0x01) ? 1:0;

        this.elemPC.innerHTML = reg.PC.HEX(4);
        this.elemSP.innerHTML = reg.SP.HEX(4);
        this.elemIX.innerHTML = reg.IX.HEX(4);
        this.elemIY.innerHTML = reg.IY.HEX(4);
        this.elemI.innerHTML = reg.I.HEX(2);
        this.elemR.innerHTML = reg.R.HEX(2);
    };
    Z80RegView.prototype.update_ = function(reg_) {
        this.elemB_.innerHTML = reg_.B.HEX(2);
        this.elemC_.innerHTML = reg_.C.HEX(2);
        this.elemD_.innerHTML = reg_.D.HEX(2);
        this.elemE_.innerHTML = reg_.E.HEX(2);
        this.elemH_.innerHTML = reg_.H.HEX(2);
        this.elemL_.innerHTML = reg_.L.HEX(2);
        this.elemA_.innerHTML = reg_.A.HEX(2);

        this.elemFS_.innerHTML = (reg_.F & 0x80) ? 1:0;
        this.elemFZ_.innerHTML = (reg_.F & 0x40) ? 1:0;
        this.elemF5_.innerHTML = (reg_.F & 0x20) ? 1:0;
        this.elemFH_.innerHTML = (reg_.F & 0x10) ? 1:0;
        this.elemF1_.innerHTML = (reg_.F & 0x08) ? 1:0;
        this.elemFP_.innerHTML = (reg_.F & 0x04) ? 1:0;
        this.elemFN_.innerHTML = (reg_.F & 0x02) ? 1:0;
        this.elemFC_.innerHTML = (reg_.F & 0x01) ? 1:0;
        this.elemR_.innerHTML = reg_.R.HEX(2);
    };
    Z80RegView.prototype.IFF1 = function(iff1) {
        this.elemIFF1.innerHTML = iff1;
    };
    Z80RegView.prototype.IFF2 = function(iff2) {
        this.elemIFF2.innerHTML = iff2;
    };
    Z80RegView.prototype.IM = function(im) {
        this.elemIM.innerHTML = im;
    };
    Z80RegView.prototype.HALT = function(halt) {
        this.elemHALT.innerHTML = halt;
    };
}());

},{"../lib/jquery_plugin_class":12,"jquery":4}],10:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    var plugin_name = "DropDownPanel";
    jquery_plugin_class(plugin_name);
    window.DropDownPanel = function(e) {
        this.opt = {
            "caption" : null,
        }
        if($(e).hasClass(plugin_name)) {
            this.root = $(e);
            this.heading = this.root.find(".heading");
            this.content = this.root.find(".content");
        } else {
            this.root = $("<div/>").insertBefore($(e));
            this.heading = $("<div/>").addClass("heading");
            this.content = $("<div/>").addClass("content");
            this.root
                .append(this.heading)
                .append(this.content);
            $(e).appendTo(this.content);
        }
        this.root.addClass(plugin_name);
    };
    DropDownPanel.prototype.create = function(opt) {
        if(opt) {
            Object.keys(this.opt).forEach(function(key) {
                if(key in opt) { this.opt[key] = opt[key]; }
            }, this);
        }
        if(!this.root.hasClass("close") && !this.root.hasClass("open")) {
            this.root.addClass("close");
        }
        if(this.root.hasClass("close")) {
            this.content.hide();
        } else {
            this.content.show();
        }
        if(this.opt.caption) {
            this.heading.html(this.opt.caption);
        }
        var caption = $("<span/>").addClass("caption").html(this.heading.html());
        this.heading.empty().append(caption)
            .append($("<span/>").addClass("button").html("▼")
                .click(function() {
                    if(this.root.hasClass("close")) {
                        this.root.addClass("open");
                        this.root.removeClass("close");
                        this.root.find(".content").show(100);
                    } else {
                        this.root.removeClass("open");
                        this.root.addClass("close");
                        this.root.find(".content").hide(100);
                    }
                }.bind(this)));
    };
    DropDownPanel.prototype.open = function(opt) {
        if(!this.root.hasClass("open")) {
            this.root.addClass("open");
            this.root.removeClass("close");
            this.root.find(".content").show(100);
        }
    };
    DropDownPanel.prototype.close = function(opt) {
        if(!this.root.hasClass("close")) {
            this.root.removeClass("open");
            this.root.addClass("close");
            this.root.find(".content").hide(100);
        }
    };
}());

},{"../lib/jquery_plugin_class":12,"jquery":4}],11:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("soundctrl");
    var soundctrl = function(element) {
        this.element = element;
        $(this.element).addClass("soundctrl");
        this.opt = {
            "onChangeVolume": function(volume) {},
            "urlIconOn": 'images/icon-sound-on.svg',
            "urlIconOff": 'images/icon-sound-off.svg',
            "colOn": 'red',
            "colOff": 'silver',
            "colMute": 'gray',
            "maxVolume": 10,
            "initialVolume": 10,
            "initialMute": false
        };
        this.mute = false;
        this.volume = 10;
    };
    window.soundctrl = soundctrl;
    soundctrl.prototype.create = function(opt) {
        Object.keys(this.opt).forEach(function(key) {
            if(key in opt) {
                this.opt[key] = opt[key];
            }
        }, this);
        this.iconOn = $("<img/>")
            .attr('src', this.opt.urlIconOn)
            .attr("width", "100%")
            .attr("height", "100%");
        this.iconOff = $("<img/>")
            .attr('src', this.opt.urlIconOff)
            .attr("width", "100%")
            .attr("height", "100%");
        if(this.opt.initialMute) {
            this.iconOn.css("display","none");
            this.mute = true;
        } else {
            this.iconOff.css("display","none");
            this.mute = false;
        }
        this.gauges = [];
        var volumeGauge = $("<span/>").addClass("gauge")
                .css("display","inline-block")
                .css("padding-right", this.opt.stepMargin);
        for(var i = 0; i < this.opt.maxVolume; i++) {
            var gauge = $("<span/>").addClass("step")
                .css("display","inline-block")
                .click((function(volume) { return function() {
                    this.gaugeOnClick(volume);
                };}(i + 1)).bind(this))
                .css("overflow", "hidden")
                .html(" ");
            this.gauges.push(gauge);
            volumeGauge.append(gauge);
        }
        $(this.element)
            .append($("<button type='button'/>")
                    .addClass("muteButton")
                    .css("padding", "0")
                    .append(this.iconOn)
                    .append(this.iconOff)
                    .click(function() { this.muteOnClick(); }.bind(this)))
            .append(volumeGauge);
        this.setVolume(this.opt.initialVolume);
    };
    soundctrl.prototype.muteOnClick = function() {
        this.setMute(!this.mute);
    };
    soundctrl.prototype.gaugeOnClick = function(volume) {
        this.setVolume(volume);
    };
    soundctrl.prototype.setMute = function(mute) {
        this.mute = mute;
        this.redrawMuteButton();
        this.redrawGauge();
        if(this.mute) {
            this.opt.onChangeVolume(0);
        } else {
            this.opt.onChangeVolume(this.volume);
        }
    };
    soundctrl.prototype.setVolume = function(volume) {
        if(volume <= 0) {
            this.setMute(true);
            return;
        }
        if(volume >= this.opt.maxVolume) {
            volume = this.opt.maxVolume;
        }
        if(this.mute) {
            this.mute = false;
            this.redrawMuteButton();
        }
        this.volume = volume;
        this.redrawGauge();
        this.opt.onChangeVolume(this.volume);
    };
    soundctrl.prototype.redrawMuteButton = function() {
        if(this.mute) {
            this.iconOn.css("display","none");
            this.iconOff.css("display","block");
        } else {
            this.iconOn.css("display","block");
            this.iconOff.css("display","none");
        }
    };
    soundctrl.prototype.redrawGauge = function() {
        for(var i = 0; i < this.opt.maxVolume; i++) {
            var c = this.opt.colMute;
            if(i >= this.volume) {
                c = this.opt.colOff;
            } else if(!this.mute) {
                c = this.opt.colOn;
            }
            this.gauges[i].css('background-color', c);
        }
    };
}());

},{"../lib/jquery_plugin_class":12,"jquery":4}],12:[function(require,module,exports){
(function() {
    "use strict";
    var jQuery = require("jquery");
    try {
        var jquery_plugin_class = function(class_name) {
            jQuery.fn[class_name] = function(method_name) {
                var args = Array.prototype.slice.call(arguments, 1);
                var invoke = function(element) {
                    var ctor = window[class_name];
                    if(element[class_name] == null) {
                        element[class_name] = new ctor(element);
                    }
                    return ctor.prototype[method_name].apply(
                            element[class_name], args);
                };
                if(this.length == 1) {
                    var ret = invoke(this[0], class_name, method_name, args);
                    if(ret == undefined) {
                        ret = this;
                    }
                    return ret;
                }
                return jQuery(this).each(function() {
                    invoke(this, class_name, method_name, args);
                });
            };
        };
        module.exports = jquery_plugin_class;
    } catch (ex) {
        console.error("exception: " + ex.name + ex.message + " at " + ex.fileName + "(" + ex.lineNumber + ")");
    }
}());

},{"jquery":4}]},{},[1]);
