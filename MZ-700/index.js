function MZ700Js() {
    this.opt = {
        "urlPrefix": ""
    };
    this.tid = null;
    this.listRows = {};
}
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
    // Communicte with MZ-700 Worker Thread
    //
    if(window.Worker) {
        //
        // MZ-700 Screen
        //
        var onVramUpdateAll = function() {};
        var onVramUpdate = function() {}; 
        var screen = $(".MZ-700 .screen").mz700scrn("create", {});
        if(screen.length > 0) {
            (function(mz700scrn) { // This is the class object in the plugin.
                onVramUpdateAll = function(textinfo) {
                    Object.keys(textinfo).forEach(function(index) {
                        var data = textinfo[index];
                        mz700scrn.refreshChar(index, data.dispcode, data.attr);
                    });
                };
                onVramUpdate = function(textinfo) {
                    mz700scrn.refreshChar(textinfo.index, textinfo.dispcode, textinfo.attr);
                };
            }(screen.get(0)["mz700scrn"]));
        }

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
        this.keyEventReceiver = $("<button/>")
            .attr("type", "button")
            .html("キー入力");
        this.btnReset = $("<button/>").attr("type", "button")
            .html("リセット").click(function() {
                this.reset();
            }.bind(this));
        this.btnStart = $("<button/>").attr("type", "button")
            .html("実行").click(function() {
                this.start();
            }.bind(this));
        this.btnStop = $("<button/>").attr("type", "button")
            .html("停止").click(function() {
                this.mz700comworker.stop(function() {
                    this.tid = null;
                    this.setCurrentExecLine();
                    this.showStatus();
                    this.updateUI();
                    this.scrollToShowPC();
                }.bind(this));
            }.bind(this));
        this.btnStep = $("<button/>").attr("type", "button")
            .html("ステップ実行").click(function() {
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
                "caption" : "スクリーンキーボード(MZ-700キーマトリクス)"
            });
        }

        //
        // キー入力
        //
        if(this.keyEventReceiver.length > 0) {

            //キーボードからの入力処理
            //
            //キー入力ボタンにフォーカスがあるときに、キー入力を仮想マシンへ転送し、
            //ブラウザには処理させない。

            var rcvr = this.keyEventReceiver.get(0); //キー入力ボタン
            var keyInStateMessage = $(".MZ-700 .key-state-message");
            if(keyInStateMessage.length > 0) {
                var stat = keyInStateMessage.get(0);

                //キー入力ボタンがフォーカスを得たときの処理
                rcvr.onfocus = function(e) {
                    stat.innerHTML = "キー入力受付中 ― 解除は画面以外をクリック";
                };

                //キー入力ボタンが、フォーカスを失ったときの処理
                rcvr.onblur = function(e) {
                    stat.innerHTML = "キーボードからキー入力するには画面をクリック";
                };
            }

            //キー入力を受け付けるかどうかの判定
            //キー入力ボタンがフォーカスを持っているなら受け付ける
            var isKeyAcceptable = function() {
                return document.activeElement.id == rcvr.id;
            };

            var keystates = {};
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
            rcvr.onkeydown = function(e) {
                if(isKeyAcceptable()) {
                    updateKeyStates(e, true);
                    return false;
                }
            };

            //キーアップ
            rcvr.onkeyup = function(e) {
                if(isKeyAcceptable()) {
                    updateKeyStates(e, false);
                    return false;
                }
            };

            //画面クリックで、キー入力ボタンへフォーカスを設定し、
            //キー入力を受け付けるようにする。
            $(".MZ-700 .key-switcher").click(function() {
                rcvr.focus();
            });

            //初期状態でキー入力を受け付ける
            rcvr.focus();
        }

        //
        // Create MZ-700 Worker
        //
        this.mz700comworker = TransWorker.create(
            this.opt.urlPrefix + "MZ-700/worker.js", MZ700, this, {
                'running': function() { this.showStatus(); },
                'started': function() { },
                'break': function() { this.stop(); },

                'onVramUpdateAll':onVramUpdateAll,
                'onVramUpdate':onVramUpdate,
                'startSound': function(freq) { sound.startSound(freq); },
                'stopSound': function() { sound.stopSound(); }
            }
        );

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
                    .append($("<button type='button'>表示更新</button>")
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
                    .append($("<span>自動更新</span>")))
            .DropDownPanel("create", { "caption" : "レジスタ" });

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
            .DropDownPanel("create", { "caption" : "メモリ" });
        //
        // ソースリストを表示する
        //
        this.asmList = $("<div/>").addClass("assemble_list");
        this.tabAsmList = $("<div/>");
        this.tabAsmList.append(
                $("<div/>")
                    .addClass("y-scroll-pane")
                    .append(this.asmList))
            .append("<span>※ 行クリックでブレイクポイントを設定可能。</span>");

        this.txtAsmSrc = $("<textarea type='text'/>");
        this.tabSource = $("<div/>");
        this.tabSource
            .append($("<button type='button'>アセンブル</button>")
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
                    }.bind(this)).html("シンタックス・ハイライト"))
                    .append($("<button type='button'/>").click(function() {
                        this.showTabSource();
                    }.bind(this)).html("プレーンテキスト"))
                    .append($("<input type='checkbox'/>").click(function() {
                        setAutoAssemble($(this).prop('checked'));
                    }))
                    .append($("<span/>").html("MZT読込み時に自動アセンブル")))
            .append($("<div/>").addClass("tabPageContainer clearfix")
                .append(this.tabAsmList)
                .append(this.tabSource))
            .DropDownPanel("create", { "caption" : "アセンブルソース" });

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
            .append($("<label/>").html("アドレス"))
            .append($("<input/>")
                    .attr("type", "text").attr("value", "CF00h")
                    .addClass("address"))
            .append($("<label/>").html("ニーモニック"))
            .append($("<input/>")
                    .attr("type", "text").attr("value", "NOP")
                    .addClass("mnemonic"))
            .append($("<button/>").attr("type", "button").html("実行")
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
            .append($("<span/>").html(
                "上記アドレスにニーモニックをアセンブルして実行します。" +
                "メモリの内容とプログラムカウンタ(PC)は退避され、命令実行後に復元されます。" +
                "PC以外のレジスタは復元されません。" +
                "また、PCを変更する命令(JP,JR,CALL,RET,...)ではPCは復元されません。"))
            .DropDownPanel("create", { "caption" : "命令直接実行" });
    }
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
    this.keyEventReceiver.get(0).focus();
    this.mz700comworker.stop(function() {
        this.tid = null;
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
        this.tid = 1;
        this.updateUI();
    }.bind(this));
};
MZ700Js.prototype.stop = function() {
    this.mz700comworker.stop(function() {
        this.tid = null;
        this.scrollToShowPC();
        this.setCurrentExecLine();
        this.showStatus();
        this.updateUI();
    }.bind(this));
};
MZ700Js.prototype.updateUI = function() {
    this.btnReset.prop('disabled', '');
    if(this.tid == null) {
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
