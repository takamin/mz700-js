(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require("../lib/ex_number.js");
var FractionalTimer = require("fractional-timer");
var MZ_TapeHeader   = require('./mz-tape-header');
var MZ_Tape         = require('./mz-tape');
var MZ_DataRecorder = require('./mz-data-recorder');
var Intel8253       = require('../lib/intel-8253');
var FlipFlopCounter = require('../lib/flip-flop-counter');
var IC556           = require('../lib/ic556');
var MZ700KeyMatrix  = require('./mz700-key-matrix');
var MZ700_Memory    = require("./memory.js");
var Z80             = require('../Z80/emulator');
var Z80_assemble    = require("../Z80/assembler.js");
var Z80LineAssembler = require("../Z80/z80-line-assembler");
var MZ700 = function(opt) {
    "use strict";

    var THIS = this;

    // Screen update buffer
    this._screenUpdateData = {};

    // Timer id to send screen buffer
    this._vramTxTid = null;


    //MZ700 Key Matrix
    this.keymatrix = new MZ700KeyMatrix();

    // Create 8253
    this.intel8253 = new Intel8253();
    this.intel8253.counter[1].counter = 15700;
    this.intel8253.counter[1].value = 15700;
    this.intel8253.counter[1].addEventListener("timeup", function() {
        this.intel8253.counter[2].count(1);
    }.bind(this));
    this.intel8253.counter[2].counter = 43200;
    this.intel8253.counter[2].value = 43200;
    this.intel8253.counter[2].addEventListener("timeup", function() {
        if(this.INTMSK) {
            this.z80.interrupt();
        }
    }.bind(this));

    //HBLNK F/F in 15.7 kHz
    this.hblank = new FlipFlopCounter(15700);
    this.hblank.addEventListener("change", function() {
        this.intel8253.counter[1].count(1 * 4);
    }.bind(this));

    //VBLNK F/F in 50 Hz
    this.vblank = new FlipFlopCounter(50);
    this.VBLK = false;
    this.vblank.addEventListener("change", function() {
        this.VBLK = !this.VBLK;
    }.bind(this));

    // create IC 556 to create HBLNK(cursor blink) by 3 Hz?
    this.ic556 = new IC556(3);
    this.ic556_OUT = false;
    this.ic556.addEventListener("change", function() {
        this.ic556_OUT = !this.ic556_OUT;
    }.bind(this));

    this.INTMSK = false;

    this.MLDST = false;

    var motorOffDelayTid = null;
    this.dataRecorder = new MZ_DataRecorder(function(motorState){
        if(motorState) {
            if(motorOffDelayTid != null) {
                clearTimeout(motorOffDelayTid);
                motorOffDelayTid = null;
            }
            this.opt.onStartDataRecorder();
        } else {
            motorOffDelayTid = setTimeout(function() {
                motorOffDelayTid = null;
                this.opt.onStopDataRecorder();
            }.bind(this), 100);
        }
    }.bind(this));

    //
    // Default option settings to notify from WebWorker
    // to UI thread by transworker
    //
    this.opt = {
        onExecutionParameterUpdate: function(param) {
            try {
                THIS._transworker.postNotify(
                    "onExecutionParameterUpdate", param);
            } catch(ex) {
                console.error(ex);
            }
        },
        started: function() { THIS._transworker.postNotify("start"); },
        stopped: function() { THIS._transworker.postNotify("stop"); },
        onBreak: function() {
            THIS._transworker.postNotify("onBreak");
        },
        onUpdateScreen: function() {
            THIS._transworker.postNotify(
                "onUpdateScreen", THIS._screenUpdateData);
        },
        onVramUpdate: function(index, dispcode, attr){
            THIS._screenUpdateData[index] = {
                dispcode: dispcode, attr: attr
            };
            if(THIS._vramTxTid == null) {
                THIS._vramTxTid = setTimeout(function() {
                    THIS.opt.onUpdateScreen();
                    THIS._screenUpdateData = {};
                    THIS._vramTxTid = null;
                }, 100);
            }
        },
        onMmioRead: function(address, value){
            THIS._transworker.postNotify(
                    "onMmioRead", { address: address, value: value });
        },
        onMmioWrite: function(address, value){
            THIS._transworker.postNotify(
                    "onMmioWrite", { address: address, value: value });
        },
        onPortRead: function(port, value){
            THIS._transworker.postNotify(
                    "onPortRead", { port: port, value: value });
        },
        onPortWrite: function(port, value){
            THIS._transworker.postNotify(
                    "onPortWrite", { port: port, value: value });
        },
        startSound: function(freq){
            THIS._transworker.postNotify("startSound",[ freq ]);
        },
        stopSound: function(){
            THIS._transworker.postNotify("stopSound");
        },
        onStartDataRecorder: function(){
            THIS._transworker.postNotify("onStartDataRecorder");
        },
        onStopDataRecorder: function(){
            THIS._transworker.postNotify("onStopDataRecorder");
        }
    };

    //
    // Override option to receive notifications with callbacks.
    //
    opt = opt || {};
    Object.keys(this.opt).forEach(function (key) {
        if(key in opt) {
            this.opt[key] = opt[key];
        }
    }, this);

    this.tid = null;
    this.timerInterval = MZ700.DEFAULT_TIMER_INTERVAL;

    this.mmioMap = [];
    for(var address = 0xE000; address < 0xE800; address++) {
        this.mmioMap.push({ "r": false, "w": false });
    }

    this.memory = new MZ700_Memory({
        onVramUpdate: THIS.opt.onVramUpdate,
        onMappedIoRead: function(address, value) {

            //MMIO: Input from memory mapped peripherals
            if(THIS.mmioIsMappedToRead(address)) {
                THIS.opt.onMmioRead(address, value);
            }

            switch(address) {
                case 0xE001:
                    break;
                case 0xE002:
                    // [VBLK~] [556OUT] [RDATA] [MOTOR] [M-ON] [INTMSK] [WDATA] [*****]
                    //    |        |       |       |       |       |       |       |
                    //    |        |       |       |       |       |       |       +---- b0. --- (undefined)
                    //    |        |       |       |       |       |       +------------ b1. OUT CMT WRITE DATA
                    //    |        |       |       |       |       +-------------------- b2. OUT CLOCK INT MASK
                    //    |        |       |       |       +---------------------------- b3. OUT DRIVE CMT MOTOR
                    //    |        |       |       +------------------------------------ b4. IN  CMT MOTOR FEEDBACK
                    //    |        |       +-------------------------------------------- b5. IN  CMT READ DATA
                    //    |        +---------------------------------------------------- b6. IN  BLINK CURSOR
                    //    +------------------------------------------------------------- b7. IN  VERTICAL BLANK

                    value = value & 0x0f; // 入力上位4ビットをオフ

                    // PC4 - MOTOR : The motor driving state (high active)
                    if(THIS.dataRecorder.motor()) {
                        value = value | 0x10;
                    } else {
                        value = value & 0xef;
                    }

                    // PC5 - RDATA : A bit data to read
                    if(THIS.dataRecorder_readBit()) {
                        value = value | 0x20;
                    } else {
                        value = value & 0xdf;
                    }

                    // PC6 - 556_OUT : A signal to blink cursor on the screen
                    if(THIS.ic556_OUT) {
                        value = value | 0x40;
                    } else {
                        value = value & 0xbf;
                    }

                    // PC7 - VBLK : A virtical blanking signal
                    // set V-BLANK bit
                    if(THIS.VBLK) {
                        value = value | 0x80;
                    } else {
                        value = value & 0x7f;
                    }
                    break;
                case 0xE004:
                    value = THIS.intel8253.counter[0].read();
                    break;
                case 0xE005:
                    value = THIS.intel8253.counter[1].read();
                    break;
                case 0xE006:
                    value = THIS.intel8253.counter[2].read();
                    break;
                case 0xE007:
                    break;
                case 0xE008:
                    value = value & 0xfe; // MSBをオフ
                    // set H-BLANK bit
                    if(THIS.hblank.readOutput()) {
                        value = value | 0x01;
                    } else {
                        value = value & 0xfe;
                    }
                    break;
            }
            return value;
        },
        onMappedIoUpdate: function(address, value) {

            //MMIO: Output to memory mapped peripherals
            if(THIS.mmioIsMappedToWrite(address)) {
                THIS.opt.onMmioWrite(address, value);
            }

            switch(address) {
                case 0xE000:
                    this.poke(0xE001, THIS.keymatrix.getKeyData(value));
                    THIS.ic556.loadReset(value & 0x80);
                    break;
                case 0xE002:
                    //上位4ビットは読み取り専用。
                    //下位4ビットへの書き込みは、
                    //8255コントロール(E003H)のビット操作によって行う
                    break;
                case 0xE003:
                    // MSB==0の場合、PortCへのビット単位の書き込みを指示する。
                    //
                    // [ 7   6   5   4   3   2   1   0 ]
                    //  ---             ----------- ---
                    //   0   -   -   -  ビット番号  値
                    //
                    // MSB==1の場合は、モードセット
                    //
                    // [ 7   6   5   4   3   2   1   0 ]
                    //  --- ------- --- --- --- --- ---
                    //   1   ModeA   |   |   |   |   |
                    //       PortA --+   |   |   |   |
                    //       PortCH------+   |   |   +----- PortCL
                    //               ModeB --+   +--------- PortB
                    //
                    //  ModeA: 1x - モード2、01 - モード1、00 - モード0
                    //  ModeB: 1  - モード1、0  - モード0
                    //  PortA: Port A 入出力設定 0 - 出力、1 - 入力
                    //  PortB: Port B 入出力設定 0 - 出力、1 - 入力
                    //  PortCH: Port C 上位ニブル入出力設定 0 - 出力、1 - 入力
                    //  PortCL: Port C 下位ニブル入出力設定 0 - 出力、1 - 入力
                    //
                    if((value & 0x80) == 0) {
                        var bit = ((value & 0x01) != 0);
                        var bitno = (value & 0x0e) >> 1;
                        //var name = [
                        //    "SOUNDMSK(MZ-1500)",
                        //    "WDATA","INTMSK","M-ON",
                        //    "MOTOR","RDATA", "556 OUT", "VBLK"][bitno];
                        //console.log("$E003 8255 CTRL BITSET", name, bit);
                        switch(bitno) {
                            case 0://SOUNDMSK
                                break;
                            case 1://WDATA
                                THIS.dataRecorder_writeBit(bit);
                                break;
                            case 2://INTMSK
                                THIS.INTMSK = bit;//trueで割り込み許可
                                break;
                            case 3://M-ON
                                THIS.dataRecorder_motorOn(bit);
                                break;
                        }
                    }
                    break;
                case 0xE004:
                    if(THIS.intel8253.counter[0].load(value) && THIS.MLDST) {
                        THIS.opt.startSound(895000 / THIS.intel8253.counter[0].value);
                    }
                    break;
                case 0xE005: THIS.intel8253.counter[1].load(value); break;
                case 0xE006: THIS.intel8253.counter[2].load(value); break;
                case 0xE007: THIS.intel8253.setCtrlWord(value); break;
                case 0xE008:
                    if((THIS.MLDST = ((value & 0x01) != 0)) == true) {
                        THIS.opt.startSound(895000 / THIS.intel8253.counter[0].value);
                    } else {
                        THIS.opt.stopSound();
                    }
                    break;
            }

            return value;
        }
    });

    this.z80 = new Z80({
        memory: THIS.memory,
        onReadIoPort: function(port, value) {
            THIS.opt.onPortRead(port, value);
        },
        onWriteIoPort: function(port, value) {
            switch(port) {
                case 0xe0: this.memory.changeBlock0_DRAM(); break;
                case 0xe1: this.memory.changeBlock1_DRAM(); break;
                case 0xe2: this.memory.changeBlock0_MONITOR(); break;
                case 0xe3: this.memory.changeBlock1_VRAM(); break;
                case 0xe4: this.memory.changeBlock0_MONITOR();
                           this.memory.changeBlock1_VRAM();
                           break;
                case 0xe5: this.memory.disableBlock1(); break;
                case 0xe6: this.memory.enableBlock1(); break;
            }
            THIS.opt.onPortWrite(port, value);
        }
    });
};

MZ700.AVG_CYCLE = 40;
MZ700.Z80_CLOCK = 3.579545 * 1000000;// 3.58 MHz
MZ700.DEFAULT_TIMER_INTERVAL = MZ700.AVG_CYCLE * (1000 / MZ700.Z80_CLOCK)

MZ700.prototype.mmioMapToRead = function(address) {
    address.forEach(function(a) {
        this.mmioMap[a - 0xE000].r = true;
    }, this);
};

MZ700.prototype.mmioMapToWrite = function(address) {
    address.forEach(function(a) {
        this.mmioMap[a - 0xE000].w = true;
    }, this);
};

MZ700.prototype.mmioIsMappedToRead = function(address) {
    return this.mmioMap[address - 0xE000].r;
};

MZ700.prototype.mmioIsMappedToWrite = function(address) {
    return this.mmioMap[address - 0xE000].w;
};

MZ700.prototype.writeAsmCode = function(assembled) {
    for(var i = 0; i < assembled.buffer.length; i++) {
        this.memory.poke(
                assembled.min_addr + i,
                assembled.buffer[i]);
    }
    return assembled.min_addr;
};

MZ700.prototype.exec = function(execCount) {
    execCount = execCount || 1;
    try {
        for(var i = 0; i < execCount; i++) {
            this.z80.exec();
            this.clock();
        }
    } catch(ex) {
        return -1;
    }
    return 0;
};

MZ700.prototype.clock = function() {

    // HBLNK - 15.7 kHz clock
    this.hblank.count();

    // VBLNK - 50 Hz
    this.vblank.count();

    // CURSOR BLNK - 1 Hz
    this.ic556.count();

};

MZ700.prototype.setCassetteTape = function(tape_data) {
    if(tape_data.length > 0) {
        if(tape_data.length <= 128) {
            this.dataRecorder_setCmt([]);
            console.error("error buf.length <= 128");
            return null;
        }
        this.mzt_array = MZ700.parseMZT(tape_data);
        if(this.mzt_array == null || this.mzt_array.length < 1) {
            console.error("setCassetteTape fail to parse");
            return null;
        }
    }
    this.dataRecorder_setCmt(tape_data);
    return this.mzt_array;
};

/**
 * Get CMT content without ejecting.
 * @returns {Buffer|null} CMT data buffer
 */
MZ700.prototype.getCassetteTape = function() {
    var cmt = this.dataRecorder.getCmt();
    if(cmt == null) {
        return null;
    }
    return MZ_Tape.toBytes(cmt);
};

MZ700.prototype.loadCassetteTape = function() {
    for(var i = 0; i < this.mzt_array.length; i++) {
        var mzt = this.mzt_array[i];
        for(var j = 0; j < mzt.header.file_size; j++) {
            this.memory.poke(mzt.header.addr_load + j, mzt.body.buffer[j]);
        }
    }
};

MZ700.prototype.reset = function() {
    this.memory.enableBlock1();
    this.memory.enableBlock1();
    this.memory.changeBlock0_MONITOR();
    this.memory.changeBlock1_VRAM();

    // Clear VRAM
    for(var i = 0; i < 40 * 25; i++) {
        this.memory.poke(0xd000 + i, 0x00);
        this.memory.poke(0xd800 + i, 0x71);
    }
    return this.z80.reset();
};

MZ700.prototype.getRegister = function() {
    return this.z80.reg;
};

MZ700.prototype.getRegisterB = function() {
    return this.z80.regB;
};

MZ700.prototype.setPC = function(addr) {
    this.z80.reg.PC = addr;
};

MZ700.prototype.getIFF1 = function() {
    return this.z80.IFF1;
};

MZ700.prototype.getIFF2 = function() {
    return this.z80.IFF2;
};

MZ700.prototype.getIM = function() {
    return this.z80.IM;
};

MZ700.prototype.getHALT = function() {
    return this.z80.HALT;
};

MZ700.prototype.readMemory = function(addr) {
    return this.memory.peek(addr);
};

MZ700.prototype.setKeyState = function(strobe, bit, state) {
    this.keymatrix.setKeyMatrixState(strobe, bit, state);
};

MZ700.prototype.clearBreakPoints = function() {
    this.z80.clearBreakPoints();
};

MZ700.prototype.getBreakPoints = function() {
    return this.z80.getBreakPoints();
};

MZ700.prototype.removeBreak = function(addr, size) {
    this.z80.removeBreak(addr, size);
};

MZ700.prototype.addBreak = function(addr, size) {
    this.z80.setBreak(addr, size);
};

MZ700.parseMZT = function(buf) {
    var sections = [];
    var offset = 0;
    while(offset + 128 <= buf.length) {
        var header = new MZ_TapeHeader(buf, offset);
        offset += 128;

        var body_buffer = [];
        for(var i = 0; i < header.file_size; i++) {
            body_buffer.push(buf[offset + i]);
        }
        offset += header.file_size;

        sections.push({
            "header": header,
            "body": {
                "buffer": body_buffer
            }
        });
    }
    return sections;
};

//
// For TransWorker
//
MZ700.prototype.start = function() {
    if("tid" in this && this.tid != null) {
        console.warn(
                "[emulator] MZ700.start(): already started, caller is ",
                MZ700.prototype.start.caller);
        return false;
    }
    this.tid = FractionalTimer.setInterval(//TODO: Invoke Immediete `this.run()`
            function() { this.run(); }.bind(this),
            this.timerInterval);
    this.opt.started();
    return true;
};

MZ700.prototype.stop = function() {
    if(this.tid != null) {
        FractionalTimer.clearInterval(this.tid);
        this.tid = null;
        this.opt.stopped();
    }
};

MZ700.prototype.run = function() {
    try {
        this.z80.exec();
        this.clock();
    } catch(ex) {
        console.log("Error:", ex);
        console.log(ex.stack);
        this.stop();
        this.opt.onBreak();
    }
};

//
// Assemble
//
MZ700.prototype.assemble = function(text_asm) {
    return new Z80_assemble(text_asm);
};

//
// Disassemble
//
MZ700.prototype.disassemble = function(mztape_array) {
    var outbuf = "";
    var dasmlist = [];
    var asmHeaderLines = null;
    mztape_array.forEach(function(mzt) {
        var mztHeaderLines = MZ_TapeHeader.prototype.getHeadline.apply(mzt.header);
        outbuf += mztHeaderLines + "\n";
        dasmlist = Z80.dasm(
            mzt.body.buffer, 0,
            mzt.header.file_size,
            mzt.header.addr_load);
        asmHeaderLines = mztHeaderLines.split("\n").map(function(line) {
            var asmline = new Z80LineAssembler();
            asmline.setComment(line);
            return asmline;
        });
    });
    var dasmlines = Z80.dasmlines(dasmlist);
    outbuf += dasmlines.join("\n") + "\n";
    Array.prototype.splice.apply(dasmlist,
            [0,0].concat(asmHeaderLines));
    return {
        outbuf: outbuf,
        dasmlines: dasmlines,
        asmlist: dasmlist
    };
};
MZ700.disassemble = MZ700.prototype.disassemble;

MZ700.prototype.dataRecorder_setCmt = function(bytes) {
    var cmt = null;
    if(bytes.length == 0) {
        cmt = [];
    } else {
        cmt = MZ_Tape.fromBytes(bytes);
    }
    this.dataRecorder.setCmt(cmt);
    return cmt;
};

MZ700.prototype.dataRecorder_ejectCmt = function() {
    if(this.dataRecorder.isCmtSet()) {
        var cmt = this.dataRecorder.ejectCmt();
        if(cmt != null) {
            return MZ_Tape.toBytes(cmt);
        }
    }
    return [];
};

MZ700.prototype.dataRecorder_pushPlay = function() {
    this.dataRecorder.play();
};

MZ700.prototype.dataRecorder_pushRec = function() {
    if(this.dataRecorder.isCmtSet()) {
        this.dataRecorder.ejectCmt();
    }
    this.dataRecorder.setCmt([]);
    this.dataRecorder.rec();
};

MZ700.prototype.dataRecorder_pushStop = function() {
    this.dataRecorder.stop();
};

MZ700.prototype.dataRecorder_motorOn = function(state) {
    this.dataRecorder.m_on(state);
};

MZ700.prototype.dataRecorder_readBit = function() {
    return this.dataRecorder.rdata(this.z80.tick);
};

MZ700.prototype.dataRecorder_writeBit = function(state) {
    this.dataRecorder.wdata(state, this.z80.tick);
};

// VALUE            SLOW ... FAST
// ---------------- -------------
// numOfTimer:         1 ... 1000
// numOfExecInst:   1000 ...    1
// timerInterval:      7 ...    1
// ---------------- -------------
MZ700.prototype.getExecutionParameter = function() {
    return this.timerInterval;
};

MZ700.prototype.setExecutionParameter = function(param) {
    var running = (this.tid != null);
    if(running) {
        this.stop();
    }
    this.timerInterval = param;
    this.opt.onExecutionParameterUpdate(param);
    if(running) {
        this.start();
    }
};
module.exports = MZ700;

},{"../Z80/assembler.js":11,"../Z80/emulator":13,"../Z80/z80-line-assembler":18,"../lib/ex_number.js":22,"../lib/flip-flop-counter":23,"../lib/ic556":24,"../lib/intel-8253":25,"./memory.js":3,"./mz-data-recorder":6,"./mz-tape":8,"./mz-tape-header":7,"./mz700-key-matrix":9,"fractional-timer":36}],2:[function(require,module,exports){
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
    require("../lib/jquery.tabview.js");
    require("../lib/jquery.asmlist.js");
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
                                    this.setMztData(new Uint8Array(reader.result), function(mztape_array) {
                                        this.start(mztape_array[0].header.addr_exec);
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
                                this.createCmtDownloadLink(tape_data);
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
            // Assemble list
            //

            $(".source-list").tabview("create");
            $(".source-list").DropDownPanel(
                    "create", { "caption" : "Assembly source" });

            var asmView = this.addAsmListTab("PCG-700 sample");
            asmView.asmlist("text",
                    $($("textarea.default.source").get(0)).val());

            //
            //直接実行ボタン
            //
            var runImm = function(src) {
                var bin = new Z80_assemble(src);
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

    };

    MZ700Js.prototype.mmioMapPeripheral = function(peripheral, mapToRead, mapToWrite) {
        this.MMIO.entry(peripheral, mapToRead, mapToWrite);
        this.mz700comworker.mmioMapToWrite(mapToRead, function(){});
        this.mz700comworker.mmioMapToWrite(mapToWrite, function(){});
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
    MZ700Js.prototype.start = function(addr) {
        if(addr == null) {
            this.mz700comworker.start(function() {});
        } else {
            this.mz700comworker.setPC(addr, function() {
                this.mz700comworker.start(function() {
                    this.acceptKey(true);
                }.bind(this));
            }.bind(this));
        }
    };
    MZ700Js.prototype.stop = function() {
        this.mz700comworker.stop(function() {});
    };
    MZ700Js.prototype.stepIn = function() {
        this.clearCurrentExecLine();
        this.mz700comworker.exec(1, function(/*result*/){
            this.scrollToShowPC();
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
                this.setMztData(tape_data, function(mztape_array) {
                    this.start(mztape_array[0].header.addr_exec);
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
                    this.createCmtDownloadLink(tape_data);
                    callback(mztape_array);
                }.bind(this));
            }
        }.bind(this));
    };

    MZ700Js.prototype.addAsmListTab = function(tabName) {
        var asmView = this.createAssembleView();
        $(".source-list").tabview("add", tabName, asmView);
        return asmView;
    };

    MZ700Js.prototype.createAssembleView = function() {
        return $("<div/>").asmlist("create", {
            assemble: function(asmSource) {
                this.assemble(asmSource, function() {});
            }.bind(this),

            breakpoint: function(addr, size, state) {
                if(state) {
                    this.mz700comworker.addBreak(addr, size, null);
                } else {
                    this.mz700comworker.removeBreak(addr, size, null);
                }
            }.bind(this),
        });
    };

    //
    // Show the next exec line in a window
    //
    MZ700Js.prototype.scrollToShowPC = function() {
        this.mz700comworker.getRegister(function(reg) {
            $(".source-list").tabview("currentPage")
                .asmlist("setCurrentAddr", reg.PC);
        }.bind(this));
    };

    MZ700Js.prototype.clearCurrentExecLine = function() {
        $(".source-list").tabview("currentPage")
            .asmlist("clearCurrentAddr");
    }

    MZ700Js.prototype.disassemble = function(mztape_array) {
        var running = this.isRunning;
        this.mz700comworker.stop(function() {
            var result = MZ700.disassemble(mztape_array);
            $(".source-list").tabview("currentPage")
                .asmlist("text", result.outbuf, false);
            $(".source-list").tabview("caption",
                    $(".source-list").tabview("index"),
                    mztape_array[0].header.filename);
            this.createAssembleList(result.asmlist);
            if(running) {
                this.start();
                this.acceptKey(true);
            }
        }.bind(this));
    };

    MZ700Js.prototype.assemble = function(asmSource, callback) {
        this.mz700comworker.assemble(asmSource, function(assembled) {
            this.createAssembleList(assembled.list);
            this.mz700comworker.writeAsmCode(assembled, function() {
                if(callback) {
                    callback();
                }
            });
        }.bind(this));
    };

    MZ700Js.prototype.createAssembleList = function(asm_list) {
        this.mz700comworker.getBreakPoints(function(breakpoints) {
            $(".source-list").tabview("currentPage").asmlist(
                "writeList", asm_list, breakpoints);
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
        if($(".source-list").length > 0) {
            this.cmtMessageArea.append(
                $("<a/>").html("Disassemble").click(function() {
                    this.mz700comworker.getCassetteTape(function(tape_data) {
                        if(tape_data != null) {
                            var mztape_array = MZ700.parseMZT(tape_data);
                            this.disassemble(mztape_array);
                        }
                    });
                }.bind(this)));
        }
    }

    module.exports = MZ700Js;
}());

},{"../MZ-700/emulator.js":1,"../MZ-700/mmio":4,"../MZ-700/mz-tape-header":7,"../MZ-700/sound.js":10,"../Z80/assembler.js":11,"../lib/PCG-700":20,"../lib/context.js":21,"../lib/ex_number.js":22,"../lib/jquery.MZ-700-kb.js":26,"../lib/jquery.MZ-700-vram":27,"../lib/jquery.Z80-mem.js":28,"../lib/jquery.Z80-reg.js":29,"../lib/jquery.asmlist.js":30,"../lib/jquery.ddpanel.js":31,"../lib/jquery.soundctrl.js":32,"../lib/jquery.tabview.js":33,"jquery":19,"transworker":37}],3:[function(require,module,exports){
var MZ700_MonitorRom = require("./monitor-rom.js");
var MemoryBlock = require("../Z80/memory-block.js");
var MemoryBank = require('../Z80/memory-bank.js');

function MZ700_Memory(opt) {
    this.create(opt);
}
MZ700_Memory.prototype = new MemoryBank();
MZ700_Memory.prototype.create = function(opt) {

    MemoryBank.prototype.create.call(this, opt);

    var i;
    //
    // Create callbacks when the VRAMs are updated
    //

    // callback for VRAM
    var onUpdateTextVram = function(){};//text
    var onUpdateAttrVram = function(){};//attributes

    // Implement when the destination is given
    if(opt.onVramUpdate) {
        var onVramUpdate = opt.onVramUpdate;
        var cache = new Array(0x10000);
        var onUpdateTextVram_ = new Array(0x10000);
        var onUpdateAttrVram_ = new Array(0x10000);
        for(i = 0; i < 1000; i++) {
            cache[0xD000 + i] = [ i, 0, 0x71 ];
            cache[0xD800 + i] = [ i, 0, 0x71 ];
            onUpdateTextVram_[0xD000 + i] = (function(textAddr, attrAddr) {
                return function(dispcode) {
                    attrAddr[1] = dispcode;
                    onVramUpdate(textAddr[0], dispcode, textAddr[2]);
                };
            }(cache[0xD000 + i], cache[0xD800 + i]));
            onUpdateAttrVram_[0xD800 + i] = (function(textAddr, attrAddr) {
                return function(attr) {
                    textAddr[2] = attr;
                    onVramUpdate(attrAddr[0], attrAddr[1], attr);
                };
            }(cache[0xD000 + i], cache[0xD800 + i]));
        }
        onUpdateTextVram = function(addr, dispcode) {
            if(0xD000 <= addr && addr < 0xD000 + 1000) {
                onUpdateTextVram_[addr](dispcode);
            }
        };
        onUpdateAttrVram = function(addr, attr) {
            if(0xD800 <= addr && addr < 0xD800 + 1000) {
                onUpdateAttrVram_[addr](attr);
            }
        };
    }
    this.memblks = {
        IPL_AREA_ROM: new MZ700_MonitorRom(),
        IPL_AREA_RAM: new MemoryBlock({
            startAddr: 0x0000, size: 0x1000
        }),
        FREE_RAM: new MemoryBlock({
            startAddr: 0x1000, size: 0xC000
        }),
        TEXT_VRAM: new MemoryBlock({
            startAddr: 0xD000, size: 0x0800,
            onPoke: onUpdateTextVram
        }),
        ATTR_VRAM: new MemoryBlock({
            startAddr: 0xD800, size: 0x0800,
            onPoke: onUpdateAttrVram
        }),
        MMAPED_IO: new MemoryBlock({
            startAddr: 0xE000, size: 0x0800,
            onPeek: opt.onMappedIoRead || function(){},
            onPoke: opt.onMappedIoUpdate || function(){}
        }),
        EXTND_ROM: new MemoryBlock({
            startAddr: 0xE800, size: 0x10000 - 0xE800
        }),
        DRAM: new MemoryBlock({
            startAddr: 0xD800, size: 0x3000
        })
    };

    this._block1VRAM = true;
    this._disabledBlock1 = false;
    this.changeBlock0_MONITOR();
    this.setMemoryBlock("FREE_RAM", this.memblks.FREE_RAM);
    this.changeBlock1_VRAM();

    // fill attribute VRAM by 71h foreground white and background blue
    for(i = 0; i < 0x800; i++) {
        this.memblks.ATTR_VRAM.pokeByte(0xD800 + i, 0x71);
    }
}
MZ700_Memory.prototype.clear = function() {
    MemoryBank.prototype.clear.call(this);
    for(var name in this.memblks) {
        this.memblks[name].clear();
    }
}
MZ700_Memory.prototype.getTextVram = function() {
    return this.memblks.TEXT_VRAM;
}
MZ700_Memory.prototype.getAttrVram = function() {
    return this.memblks.ATTR_VRAM;
}
MZ700_Memory.prototype.changeBlock0_MONITOR = function() {
    this.setMemoryBlock("IPL_AREA", this.memblks.IPL_AREA_ROM);
}
MZ700_Memory.prototype.changeBlock0_DRAM = function() {
    this.setMemoryBlock("IPL_AREA", this.memblks.IPL_AREA_RAM);
}
MZ700_Memory.prototype.changeBlock1_DRAM = function() {
    this._block1VRAM = false;
    this._disabledBlock1 = false;
    this.setMemoryBlock("TEXT_VRAM", null);
    this.setMemoryBlock("ATTR_VRAM", null);
    this.setMemoryBlock("MMAPED_IO", null);
    this.setMemoryBlock("EXTND_ROM", null);
    this.setMemoryBlock("DRAM", this.memblks.DRAM);
}
MZ700_Memory.prototype.changeBlock1_VRAM = function() {
    this._block1VRAM = true;
    this._disabledBlock1 = false;
    this.setMemoryBlock("DRAM", null);
    this.setMemoryBlock("TEXT_VRAM", this.memblks.TEXT_VRAM);
    this.setMemoryBlock("ATTR_VRAM", this.memblks.ATTR_VRAM);
    this.setMemoryBlock("MMAPED_IO", this.memblks.MMAPED_IO);
    this.setMemoryBlock("EXTND_ROM", this.memblks.EXTND_ROM);
}
MZ700_Memory.prototype.disableBlock1 = function() {
    if(!this._disabledBlock1) {
        this._disabledBlock1 = true;
        this.setMemoryBlock("TEXT_VRAM", null);
        this.setMemoryBlock("ATTR_VRAM", null);
        this.setMemoryBlock("MMAPED_IO", null);
        this.setMemoryBlock("EXTND_ROM", null);
        this.setMemoryBlock("DRAM", null);
    }
}
MZ700_Memory.prototype.enableBlock1 = function() {
    if(this._disabledBlock1) {
        if(this._block1VRAM) {
            this.changeBlock1_VRAM();
        } else {
            this.changeBlock1_DRAM();
        }
        this._disabledBlock1 = false;
    }
}
module.exports = MZ700_Memory;

},{"../Z80/memory-bank.js":15,"../Z80/memory-block.js":16,"./monitor-rom.js":5}],4:[function(require,module,exports){
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
        return undefined;
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


},{}],5:[function(require,module,exports){
var MemoryBlock = require("../Z80/memory-block.js");
function MZ700_MonitorRom() {
    this.create();
}
MZ700_MonitorRom.prototype = new MemoryBlock();
MZ700_MonitorRom.prototype.create = function() {
    MemoryBlock.prototype.create.call(this, { startAddr: 0x0000, size: 0x1000});

    for(var i = 0; i < this.size; i++) {
        var address = this.startAddr + i;
        MemoryBlock.prototype.pokeByte.call(this, address, NEWMON7[address]);
    }
};

MZ700_MonitorRom.prototype.pokeByte = function(address/*, value*/) {
    MemoryBlock.prototype.pokeByte.call(this, address, NEWMON7[address]);
};

module.exports = MZ700_MonitorRom;

/* eslint no-unused-vars: "off" */
var NEWMON7 = [
    0xc3,0x4a,0x00,0xc3,0xe6,0x07,0xc3,0x0e,0x09,0xc3,0x18,0x09,0xc3,0x20,0x09,0xc3,
    0x7f,0x00,0xc3,0x35,0x09,0xc3,0x81,0x09,0xc3,0x99,0x09,0xc3,0xbd,0x08,0xc3,0x32,
    0x0a,0xc3,0x36,0x04,0xc3,0x75,0x04,0xc3,0xd8,0x04,0xc3,0xf8,0x04,0xc3,0x88,0x05,
    0xc3,0xc7,0x01,0xc3,0x08,0x03,0x00,0x00,0xc3,0x38,0x10,0xc3,0x58,0x03,0xc3,0xe5,
    0x02,0xc3,0xfa,0x02,0xc3,0xab,0x02,0xc3,0xbe,0x02,0x31,0xf0,0x10,0xed,0x56,0xcd,
    0xc9,0x0f,0x3e,0x16,0xd7,0x06,0x3c,0x21,0x70,0x11,0xcd,0xd8,0x0f,0x21,0x92,0x03,
    0x3e,0xc3,0x32,0x38,0x10,0x22,0x39,0x10,0x21,0x04,0x05,0x22,0x9e,0x11,0xcd,0xbe,
    0x02,0x11,0x41,0x01,0xdf,0xcd,0xc0,0x0a,0x18,0x08,0x11,0xf1,0x10,0x18,0x96,0xc3,
    0x26,0x09,0x31,0xf0,0x10,0x11,0x82,0x00,0xd5,0xcd,0x09,0x00,0x3e,0x2a,0xd7,0x11,
    0xa3,0x11,0xcd,0x03,0x00,0x1a,0xfe,0x2a,0xc2,0x54,0x0c,0x13,0x1a,0xfe,0x47,0xca,
    0x59,0x01,0xfe,0x23,0xca,0x12,0x02,0xfe,0x4d,0xca,0x0f,0x0c,0xfe,0x53,0xca,0x82,
    0x0c,0xfe,0x26,0xca,0x0e,0x0e,0xfe,0x4c,0x28,0x1f,0x00,0x00,0x00,0x00,0xfe,0x52,
    0xca,0xaa,0x01,0xfe,0x50,0xca,0x12,0x02,0xc3,0x9b,0x0a,0xcd,0xe8,0x00,0xcd,0x2d,
    0x00,0x38,0x0a,0x11,0xc4,0x01,0xcf,0xdf,0xc9,0xcd,0xe8,0x00,0xef,0xda,0x67,0x01,
    0x2a,0x06,0x11,0x7c,0xfe,0x12,0xd8,0xe9,0xcd,0x27,0x00,0x38,0x95,0xcf,0x11,0x38,
    0x01,0xdf,0x18,0x86,0x11,0x00,0xd0,0x0e,0x19,0x06,0x28,0x1a,0xcd,0xce,0x0b,0xcd,
    0x0f,0x01,0x13,0x10,0xf6,0x3e,0x0d,0xcd,0x0f,0x01,0x0d,0x20,0xec,0xc9,0xd5,0xf5,
    0xdb,0xfe,0xe6,0x0d,0xb7,0x28,0x07,0xcd,0x1e,0x00,0x28,0x77,0x18,0xf2,0xf1,0xd3,
    0xff,0x3e,0x80,0xd3,0xfe,0xdb,0xfe,0xe6,0x0d,0xfe,0x01,0x20,0xf8,0xaf,0xd3,0xfe,
    0xc9,0x46,0x4f,0x55,0x4e,0x44,0x20,0x0d,0x4c,0x4f,0x2e,0x20,0x0d,0xc3,0x49,0x01,
    0x00,0x20,0x4d,0x5a,0x90,0x37,0x30,0x30,0x0d,0xd3,0xe1,0x11,0xf0,0xff,0xd5,0x21,
    0x2e,0x07,0x01,0x05,0x00,0xed,0xb0,0xc9,0x00,0x13,0x1a,0xfe,0x4f,0x20,0x04,0x13,
    0x13,0x13,0x13,0xcd,0xc0,0x0c,0xe9,0xfe,0x02,0xc8,0xcf,0x11,0xb5,0x01,0xdf,0xc9,
    0x3e,0xff,0x32,0x9d,0x11,0xc9,0xaf,0x18,0xf9,0x21,0x00,0xf0,0x7e,0xb7,0xc0,0xe9,
    0xc5,0xd5,0xe5,0x1a,0xbe,0x20,0x0b,0x05,0x28,0x08,0xfe,0x0d,0x28,0x04,0x13,0x23,
    0x18,0xf1,0xe1,0xd1,0xc1,0xc9,0xf5,0xc3,0xad,0x0d,0x3e,0xff,0xd3,0xe0,0xc9,0x11,
    0x31,0x01,0xdf,0x11,0xf1,0x10,0xdf,0xc3,0xe3,0x0f,0xcd,0xe8,0x00,0xcd,0xe3,0x0f,
    0xef,0xc3,0xd1,0x00,0x00,0x43,0x45,0x0d,0x36,0xff,0x3a,0x70,0x11,0xb7,0x20,0x02,
    0x36,0xef,0xaf,0xc9,0x4f,0x4b,0x0d,0xc5,0xd5,0xe5,0x3e,0x02,0x32,0xa0,0x11,0x06,
    0x01,0x1a,0xfe,0x0d,0x28,0x02,0xfe,0xc8,0x28,0x2e,0xfe,0xcf,0x28,0x1e,0xfe,0xd7,
    0x28,0x22,0xfe,0x23,0x21,0x71,0x02,0x20,0x03,0x2e,0x89,0x13,0xcd,0x1c,0x02,0x38,
    0xe0,0xcd,0xc8,0x02,0x38,0x15,0xcd,0xab,0x02,0x41,0x18,0xd5,0x3e,0x03,0x32,0xa0,
    0x11,0x13,0x18,0xcd,0x3e,0x01,0x18,0xf6,0xcd,0xc8,0x02,0xf5,0xcd,0xbe,0x02,0xf1,
    0x18,0x80,0x13,0xcd,0x1f,0x04,0xd8,0xcd,0x0f,0x01,0x18,0xf6,0xc5,0x06,0x08,0x1a,
    0xbe,0x28,0x09,0x23,0x23,0x23,0x10,0xf8,0x37,0x13,0xc1,0xc9,0x23,0xd5,0x5e,0x23,
    0x56,0xeb,0x7c,0xb7,0x28,0x09,0x3a,0xa0,0x11,0x3d,0x28,0x03,0x29,0x18,0xfa,0x22,
    0xa1,0x11,0x3e,0x02,0x32,0xa0,0x11,0xd1,0x13,0x1a,0x47,0xe6,0xf0,0xfe,0x30,0x28,
    0x05,0x3a,0x9f,0x11,0x18,0x07,0x13,0x78,0xe6,0x0f,0x32,0x9f,0x11,0x4f,0x06,0x00,
    0x21,0xa1,0x02,0x09,0x4e,0x3a,0x9e,0x11,0x47,0xaf,0x81,0x10,0xfd,0xc1,0x4f,0xaf,
    0xc9,0x43,0x77,0x07,0x44,0xa7,0x06,0x45,0xed,0x05,0x46,0x98,0x05,0x47,0xfc,0x04,
    0x41,0x71,0x04,0x42,0xf5,0x03,0x52,0x00,0x00,0x43,0x0c,0x07,0x44,0x47,0x06,0x45,
    0x98,0x05,0x46,0x48,0x05,0x47,0xb4,0x04,0x41,0x31,0x04,0x42,0xbb,0x03,0x52,0x00,
    0x00,0x01,0x02,0x03,0x04,0x06,0x08,0x0c,0x10,0x18,0x20,0x2a,0xa1,0x11,0x7c,0xb7,
    0x28,0x0c,0xd5,0xeb,0x21,0x04,0xe0,0x73,0x72,0x3e,0x01,0xd1,0x18,0x06,0x3e,0x36,
    0x32,0x07,0xe0,0xaf,0x32,0x08,0xe0,0xc9,0x21,0x00,0xe0,0x36,0xf8,0x23,0x7e,0xe6,
    0x80,0x20,0x02,0x37,0xc9,0x3a,0x08,0xe0,0x0f,0x38,0xfa,0x3a,0x08,0xe0,0x0f,0x30,
    0xfa,0x10,0xf2,0xaf,0xc9,0xc5,0xe5,0x21,0x71,0x04,0xcd,0xae,0x02,0x06,0x32,0xaf,
    0xcd,0x5b,0x07,0x10,0xfa,0xe1,0xc1,0xc3,0xbe,0x02,0xf5,0xc5,0xe6,0x0f,0x47,0x3e,
    0x08,0x90,0x32,0x9e,0x11,0xc1,0xf1,0xc9,0xf3,0xc5,0xd5,0xe5,0x32,0x9b,0x11,0x3e,
    0xf0,0x32,0x9c,0x11,0x21,0xc0,0xa8,0xaf,0xed,0x52,0xe5,0x23,0xeb,0x3e,0x74,0x32,
    0x07,0xe0,0x3e,0xb0,0x32,0x07,0xe0,0x21,0x06,0xe0,0x73,0x72,0x2b,0x36,0x0a,0x36,
    0x00,0x3e,0x80,0x32,0x07,0xe0,0x23,0x4e,0x7e,0xba,0x20,0xfb,0x79,0xbb,0x20,0xf7,
    0x2b,0x00,0x00,0x00,0x36,0x12,0x36,0x7a,0x23,0xd1,0x4e,0x7e,0xba,0x20,0xfb,0x79,
    0xbb,0x20,0xf7,0xe1,0xd1,0xc1,0xfb,0xc9,0xe5,0x3e,0x80,0x32,0x07,0xe0,0x21,0x06,
    0xe0,0xf3,0x5e,0x56,0xfb,0x7b,0xb2,0xca,0x79,0x03,0xaf,0x21,0xc0,0xa8,0xed,0x52,
    0xda,0x83,0x03,0xeb,0x3a,0x9b,0x11,0xe1,0xc9,0x11,0xc0,0xa8,0x3a,0x9b,0x11,0xee,
    0x01,0xe1,0xc9,0xf3,0x21,0x06,0xe0,0x7e,0x2f,0x5f,0x7e,0x2f,0x57,0xfb,0x13,0xc3,
    0x7c,0x03,0xf5,0xc5,0xd5,0xe5,0x3a,0x9b,0x11,0xee,0x01,0x32,0x9b,0x11,0x3e,0x80,
    0x32,0x07,0xe0,0x21,0x06,0xe0,0x5e,0x56,0x21,0xc0,0xa8,0x19,0x2b,0x2b,0xeb,0x21,
    0x06,0xe0,0x73,0x72,0xe1,0xd1,0xc1,0xf1,0xfb,0xc9,0x7c,0xcd,0xc3,0x03,0x7d,0xcd,
    0xc3,0x03,0xc9,0xf5,0xe6,0xf0,0x0f,0x0f,0x0f,0x0f,0xcd,0xda,0x03,0xcd,0x12,0x00,
    0xf1,0xe6,0x0f,0xcd,0xda,0x03,0xd7,0x3e,0x20,0xc9,0xd5,0xe5,0x21,0xe9,0x03,0xe6,
    0x0f,0x5f,0x16,0x00,0x19,0x7e,0xe1,0xd1,0xc9,0x30,0x31,0x32,0x33,0x34,0x35,0x36,
    0x37,0x38,0x39,0x41,0x42,0x43,0x44,0x45,0x46,0xc5,0xe5,0x01,0x00,0x10,0x21,0xe9,
    0x03,0xbe,0x20,0x03,0x79,0x18,0x06,0x23,0x0c,0x05,0x20,0xf5,0x37,0xe1,0xc1,0xc9,
    0xd5,0xcd,0x1f,0x04,0x38,0x07,0x67,0xcd,0x1f,0x04,0x38,0x01,0x6f,0xd1,0xc9,0xc5,
    0x1a,0x13,0xc3,0xf1,0x06,0x38,0x0d,0x07,0x07,0x07,0x07,0x4f,0x1a,0x13,0xcd,0xf9,
    0x03,0x38,0x01,0xb1,0xc1,0xc9,0xf3,0xd5,0xc5,0xe5,0x16,0xd7,0x1e,0xcc,0x21,0xf0,
    0x10,0x01,0x80,0x00,0xcd,0x33,0x07,0xcd,0xb2,0x06,0xda,0x63,0x05,0x7b,0xfe,0xcc,
    0x20,0x11,0xcd,0x09,0x00,0xd5,0x11,0x6c,0x04,0xcd,0x15,0x00,0x11,0xf1,0x10,0xcd,
    0x15,0x00,0xd1,0xcd,0xb8,0x07,0xcd,0x8d,0x04,0xc3,0x63,0x05,0x57,0x52,0x49,0x54,
    0x49,0x4e,0x47,0x20,0x0d,0xf3,0xd5,0xc5,0xe5,0x16,0xd7,0x1e,0x53,0x2a,0x02,0x11,
    0xe5,0xc1,0x2a,0x04,0x11,0x78,0xb1,0xca,0xd4,0x04,0xc3,0x44,0x04,0xd5,0xc5,0xe5,
    0x3a,0x37,0x10,0x57,0x3e,0xf8,0x32,0x00,0xe0,0x7e,0xcd,0xa5,0x07,0x3a,0x01,0xe0,
    0xe6,0x08,0x20,0x03,0x37,0x18,0x2d,0x23,0x0b,0x78,0xb1,0xc2,0x99,0x04,0x2a,0x97,
    0x11,0x7c,0xcd,0xa5,0x07,0x7d,0xcd,0xa5,0x07,0xcd,0x80,0x07,0x15,0xc2,0xc4,0x04,
    0xb7,0xc3,0xd4,0x04,0x06,0x00,0xcd,0x67,0x07,0x05,0xc2,0xc6,0x04,0xe1,0xc1,0xc5,
    0xe5,0xc3,0x99,0x04,0xe1,0xc1,0xd1,0xc9,0xf3,0xd5,0xc5,0xe5,0x16,0xd2,0x1e,0xcc,
    0x01,0x80,0x00,0x21,0xf0,0x10,0xcd,0xb2,0x06,0xda,0x82,0x05,0xcd,0x5e,0x06,0xda,
    0x82,0x05,0xcd,0x10,0x05,0xc3,0x63,0x05,0xf3,0xd5,0xc5,0xe5,0x16,0xd2,0x1e,0x53,
    0x2a,0x02,0x11,0xe5,0xc1,0x2a,0x04,0x11,0x78,0xb1,0xca,0x63,0x05,0xc3,0xe6,0x04,
    0xd5,0xc5,0xe5,0x2a,0x36,0x10,0x01,0x01,0xe0,0x11,0x02,0xe0,0xcd,0x01,0x06,0x38,
    0x61,0xcd,0x55,0x06,0x1a,0xe6,0x20,0x28,0xf3,0x54,0x21,0x00,0x00,0x22,0x97,0x11,
    0xe1,0xc1,0xc5,0xe5,0xcd,0x24,0x06,0x38,0x49,0x77,0x23,0x0b,0x78,0xb1,0x20,0xf4,
    0x2a,0x97,0x11,0xcd,0x24,0x06,0x38,0x3a,0x5f,0xcd,0x24,0x06,0x38,0x34,0xbd,0x20,
    0x23,0x7b,0xbc,0x20,0x1f,0x18,0x0b,0x3e,0x01,0x32,0x37,0x10,0xc9,0x3e,0x02,0x18,
    0xf8,0x00,0xaf,0xe1,0xc1,0xd1,0xcd,0x00,0x07,0xf5,0x3a,0x9c,0x11,0xfe,0xf0,0x20,
    0x01,0xfb,0xf1,0xc9,0x15,0xca,0x7c,0x05,0x62,0xc3,0x16,0x05,0x3e,0x01,0x37,0xc3,
    0x63,0x05,0x3e,0x02,0x37,0xc3,0x63,0x05,0xf3,0xd5,0xc5,0xe5,0x2a,0x02,0x11,0xe5,
    0xc1,0x2a,0x04,0x11,0x16,0xd2,0x1e,0x53,0x78,0xb1,0xca,0x63,0x05,0xcd,0x33,0x07,
    0xcd,0xb2,0x06,0xda,0x82,0x05,0xcd,0x5e,0x06,0xda,0x82,0x05,0xcd,0xb2,0x05,0xc3,
    0x63,0x05,0xd5,0xc5,0xe5,0x2a,0x36,0x10,0x01,0x01,0xe0,0x11,0x02,0xe0,0xcd,0x01,
    0x06,0x38,0xbf,0xcd,0x55,0x06,0x1a,0xe6,0x20,0x28,0xf3,0x54,0xe1,0xc1,0xc5,0xe5,
    0xcd,0x24,0x06,0x38,0xad,0xbe,0x20,0xa4,0x23,0x0b,0x78,0xb1,0x20,0xf2,0x2a,0x99,
    0x11,0xcd,0x24,0x06,0xbc,0x20,0x95,0xcd,0x24,0x06,0xbd,0x20,0x8f,0x15,0xca,0x62,
    0x05,0x62,0xc3,0xb8,0x05,0x78,0x06,0xc0,0x80,0x30,0x02,0xd6,0x40,0x47,0xc3,0x3a,
    0x08,0x3e,0xf9,0x32,0x00,0xe0,0x00,0x0a,0xe6,0x04,0xc2,0x0f,0x06,0x37,0xc9,0x1a,
    0xe6,0x20,0xc2,0x07,0x06,0x0a,0xe6,0x08,0xc2,0x1d,0x06,0x37,0xc9,0x1a,0xe6,0x20,
    0xca,0x15,0x06,0xc9,0xc5,0xd5,0xe5,0x21,0x00,0x08,0x01,0x01,0xe0,0x11,0x02,0xe0,
    0xcd,0x01,0x06,0x38,0x1c,0xcd,0x55,0x06,0x1a,0xe6,0x20,0x28,0x0a,0xe5,0x2a,0x97,
    0x11,0x23,0x22,0x97,0x11,0xe1,0x37,0x7d,0x17,0x6f,0x25,0x20,0xe3,0xcd,0x01,0x06,
    0x7d,0xe1,0xd1,0xc1,0xc9,0x3a,0x35,0x10,0x3d,0x20,0xfd,0x20,0x00,0xc9,0xc5,0xd5,
    0xe5,0x21,0x28,0x28,0x7b,0xfe,0xcc,0x28,0x03,0x21,0x14,0x14,0x22,0x95,0x11,0x01,
    0x01,0xe0,0x11,0x02,0xe0,0x2a,0x95,0x11,0xcd,0x01,0x06,0x38,0x1e,0xcd,0x55,0x06,
    0x1a,0xe6,0x20,0x28,0xf0,0x25,0x20,0xf0,0xcd,0x01,0x06,0x38,0x0e,0xcd,0x55,0x06,
    0x1a,0xe6,0x20,0x20,0xe0,0x2d,0x20,0xf0,0xcd,0x01,0x06,0xe1,0xd1,0xc1,0xc9,0xc2,
    0xf5,0x05,0x3e,0x28,0x2a,0x71,0x11,0x95,0x47,0xcd,0xb1,0x0f,0xcd,0xd8,0x0f,0xc3,
    0xee,0x07,0xc5,0xd5,0xe5,0x0e,0x0a,0x3a,0x02,0xe0,0xe6,0x10,0x28,0x05,0xaf,0xe1,
    0xd1,0xc1,0xc9,0x3e,0x06,0x21,0x03,0xe0,0x77,0x3c,0x77,0x0d,0x20,0xe9,0xcf,0x7a,
    0xfe,0xd7,0x28,0x06,0x11,0x22,0x07,0xdf,0x18,0x08,0x11,0x29,0x07,0xdf,0x11,0x24,
    0x07,0xdf,0x3a,0x02,0xe0,0xe6,0x10,0x20,0xd5,0xcd,0x44,0x0a,0x20,0xf4,0x37,0x18,
    0xce,0xfe,0x2f,0x28,0x06,0xcd,0xf9,0x03,0xc3,0x25,0x04,0x1a,0x13,0xc3,0x34,0x04,
    0xf5,0xc5,0xd5,0x06,0x0a,0x3a,0x02,0xe0,0xe6,0x10,0x20,0x04,0xd1,0xc1,0xf1,0xc9,
    0x3e,0x06,0x32,0x03,0xe0,0x3e,0x07,0x32,0x03,0xe0,0x05,0xc2,0x05,0x07,0xd1,0xc1,
    0xf1,0xc9,0x7f,0x20,0x50,0x4c,0x41,0x59,0x0d,0x7f,0x52,0x45,0x43,0x0d,0xd3,0xe0,
    0xc3,0x00,0x00,0xc5,0xd5,0xe5,0x11,0x00,0x00,0x78,0xb1,0x20,0x0b,0xeb,0x22,0x97,
    0x11,0x22,0x99,0x11,0xe1,0xd1,0xc1,0xc9,0x7e,0xe5,0x26,0x08,0x07,0x30,0x01,0x13,
    0x25,0x20,0xf9,0xe1,0x23,0x0b,0x18,0xe1,0x3a,0x36,0x10,0x3d,0x20,0xfd,0xc9,0x3a,
    0x37,0x00,0x18,0xf4,0x00,0x00,0x00,0xf5,0x3e,0x03,0x32,0x03,0xe0,0xcd,0x5f,0x07,
    0x3e,0x02,0x32,0x03,0xe0,0xcd,0x5f,0x07,0xf1,0xc9,0x08,0xc3,0xe4,0x09,0x00,0x00,
    0xf5,0x3e,0x03,0x32,0x03,0xe0,0xcd,0x5f,0x07,0xcd,0x5f,0x07,0x3e,0x02,0x32,0x03,
    0xe0,0xcd,0x5f,0x07,0xcd,0x62,0x07,0xf1,0xc9,0x3e,0x00,0x32,0x34,0x10,0x21,0x44,
    0x2e,0x22,0x35,0x10,0xc9,0xc5,0x06,0x08,0xcd,0x80,0x07,0x07,0xdc,0x80,0x07,0xd4,
    0x67,0x07,0x05,0xc2,0xab,0x07,0xc1,0xc9,0xc5,0xd5,0x7b,0x01,0xf8,0x2a,0x11,0x28,
    0x28,0xfe,0xcc,0xca,0xcc,0x07,0x01,0xbe,0x0a,0x11,0x14,0x14,0xcd,0x67,0x07,0x0b,
    0x78,0xb1,0x20,0xf8,0xcd,0x80,0x07,0x15,0x20,0xfa,0xcd,0x67,0x07,0x1d,0x20,0xfa,
    0xcd,0x80,0x07,0xd1,0xc1,0xc9,0xf5,0xc5,0xe5,0xd5,0xaf,0x32,0x93,0x11,0xcd,0xb3,
    0x09,0x47,0x3a,0x9d,0x11,0xb7,0xcc,0x6d,0x0c,0x78,0xe6,0xf0,0xfe,0xc0,0x20,0x37,
    0x78,0xfe,0xcd,0x28,0x56,0xfe,0xc9,0x28,0x1d,0xfe,0xca,0x28,0x14,0xfe,0xcb,0xca,
    0xb3,0x08,0xfe,0xc8,0x28,0x0b,0xfe,0xc7,0x28,0x07,0x3a,0x93,0x11,0xb7,0x20,0x1c,
    0x78,0xcd,0xdc,0x0d,0x18,0xc8,0x21,0x70,0x11,0xaf,0xbe,0x20,0x01,0x3c,0x77,0xd6,
    0x06,0x2f,0x32,0x03,0xe0,0x18,0xb7,0xcd,0x44,0x0a,0x28,0x6a,0x78,0xcd,0xa6,0x0d,
    0xcd,0xb5,0x0d,0xfe,0x62,0x20,0xa7,0x21,0x93,0x11,0x7e,0x2f,0x77,0x18,0x9f,0xfe,
    0x10,0xca,0x42,0x0f,0xfe,0xd5,0xfe,0x05,0xc3,0x9f,0x06,0x2a,0x71,0x11,0x5c,0x16,
    0x00,0x21,0x73,0x11,0x19,0xeb,0x1a,0xb7,0x01,0x28,0x00,0x2a,0x71,0x11,0xc2,0x7a,
    0x08,0x13,0x1a,0xb7,0xca,0x7d,0x08,0xc3,0x7b,0x08,0x25,0x0e,0x50,0x2e,0x00,0xcd,
    0xb4,0x0f,0xd1,0xd5,0xc5,0xcd,0xa6,0x0d,0xed,0xb0,0xc1,0xe1,0xe5,0x41,0x7e,0xcd,
    0xce,0x0b,0x77,0x23,0x10,0xf8,0x36,0x0d,0x2b,0x7e,0xfe,0x20,0x28,0xf8,0xcd,0x06,
    0x00,0xd1,0xe1,0xc1,0xf1,0xc9,0x78,0xfe,0x12,0xca,0xf6,0x0d,0xfe,0x49,0xca,0x29,
    0x0e,0x18,0x9c,0xe1,0xe5,0x36,0x1b,0x23,0x36,0x0d,0x18,0xe2,0x00,0xcd,0xca,0x08,
    0xfe,0xf0,0x20,0x02,0xaf,0xc9,0xcd,0xce,0x0b,0xc9,0xc5,0xd5,0xe5,0xcd,0x50,0x0a,
    0x78,0x07,0x38,0x06,0x3e,0xf0,0xe1,0xd1,0xc1,0xc9,0x07,0xd2,0xec,0x08,0x06,0x00,
    0x21,0x08,0x00,0x09,0x11,0xc9,0x0a,0x19,0x7e,0xc3,0xd6,0x08,0x3a,0x70,0x11,0xb7,
    0xc2,0xfd,0x08,0x06,0x00,0x21,0xc9,0x0a,0x09,0x7e,0xc3,0xd6,0x08,0x79,0xe6,0xf0,
    0x0f,0x47,0x79,0xe6,0x0f,0x80,0xc6,0xa0,0x6f,0x26,0x00,0xc3,0xe4,0x08,0xaf,0x32,
    0x94,0x11,0x3e,0xcd,0xcd,0xdc,0x0d,0xc9,0x3a,0x94,0x11,0xb7,0xc8,0xc3,0x06,0x00,
    0x3e,0x20,0xcd,0x35,0x09,0xc9,0xcd,0x0c,0x00,0x3a,0x94,0x11,0xb7,0xc8,0xd6,0x0a,
    0x38,0xf4,0x20,0xfa,0xc9,0xfe,0x0d,0xca,0x0e,0x09,0xc5,0x4f,0x47,0xcd,0x96,0x01,
    0xcd,0x46,0x09,0x79,0xc1,0xc9,0x79,0xcd,0xb9,0x0b,0x4f,0xe6,0xf0,0xfe,0xf0,0xc8,
    0xfe,0xc0,0x79,0xc2,0x70,0x09,0xfe,0xc7,0xd2,0x70,0x09,0xcd,0xdc,0x0d,0xfe,0xc3,
    0xca,0x73,0x09,0xfe,0xc5,0xca,0x6b,0x09,0xfe,0xc6,0xc0,0xaf,0x32,0x94,0x11,0xc9,
    0xcd,0xb5,0x0d,0x3a,0x94,0x11,0x3c,0xfe,0x50,0x38,0x02,0xd6,0x50,0x32,0x94,0x11,
    0xc9,0xf5,0xc5,0xd5,0x06,0x05,0xcd,0x96,0x01,0x1a,0xfe,0x0d,0xca,0xdf,0x0f,0x4f,
    0xcd,0x46,0x09,0x13,0x10,0xf3,0xc3,0x84,0x09,0xf5,0xc5,0xd5,0x06,0x05,0xcd,0x96,
    0x01,0x1a,0xfe,0x0d,0xca,0xdf,0x0f,0xcd,0xb9,0x0b,0xcd,0x70,0x09,0x13,0x10,0xf1,
    0xc3,0x9c,0x09,0xc5,0xd5,0xe5,0xcd,0xb1,0x0f,0xcd,0xa6,0x0d,0x7e,0x32,0x8e,0x11,
    0x22,0x8f,0x11,0x21,0x92,0x11,0xcd,0xb8,0x01,0x32,0x00,0xe0,0x32,0x91,0x11,0x2f,
    0x32,0x00,0xe0,0x16,0x14,0xcd,0xff,0x09,0xcd,0x50,0x0a,0x78,0x07,0xda,0xe6,0x0b,
    0x15,0xc2,0xd5,0x09,0xcd,0xff,0x09,0xcd,0xca,0x08,0xfe,0xf0,0xca,0x7a,0x07,0xf5,
    0xcd,0xa6,0x0d,0x3a,0x8e,0x11,0x2a,0x8f,0x11,0x77,0xf1,0xe1,0xd1,0xc1,0xc9,0xf5,
    0xe5,0x3a,0x02,0xe0,0x07,0x07,0xda,0x25,0x0a,0x3a,0x91,0x11,0x0f,0xda,0x22,0x0a,
    0x3a,0x92,0x11,0x2a,0x8f,0x11,0xcd,0xa6,0x0d,0x77,0x3a,0x91,0x11,0xee,0x01,0x32,
    0x91,0x11,0xe1,0xf1,0xc9,0x3a,0x91,0x11,0x0f,0xd2,0x22,0x0a,0x3a,0x8e,0x11,0xc3,
    0x13,0x0a,0x3e,0xf8,0x32,0x00,0xe0,0x00,0x3a,0x01,0xe0,0x2f,0xe6,0x21,0xc2,0x44,
    0x0a,0xc6,0x01,0xc9,0x3e,0xf8,0x32,0x00,0xe0,0x00,0x3a,0x01,0xe0,0xe6,0x80,0xc9,
    0xd5,0xe5,0x06,0xfa,0x16,0x00,0x05,0x78,0x32,0x00,0xe0,0xfe,0xef,0x20,0x04,0x42,
    0xe1,0xd1,0xc9,0xfe,0xf8,0x28,0x1f,0x3a,0x01,0xe0,0x2f,0xb7,0x28,0xe8,0x5f,0xcb,
    0xfa,0x78,0xe6,0x0f,0x07,0x07,0x07,0x07,0x4f,0x3e,0x08,0x3d,0x28,0x04,0xcb,0x03,
    0x30,0xf9,0x81,0x4f,0x18,0xd0,0x3a,0x01,0xe0,0x2f,0x5f,0xe6,0x21,0x28,0x02,0xcb,
    0xf2,0x7b,0xe6,0xde,0x28,0xc0,0x18,0xd6,0xcd,0x3e,0x00,0xfe,0x56,0xca,0xcb,0x00,
    0xfe,0x43,0xc0,0x13,0x1a,0xfe,0x41,0xca,0x9e,0x07,0xfe,0x31,0xca,0x57,0x05,0xfe,
    0x32,0xca,0x5d,0x05,0xfe,0x42,0xc2,0xb8,0x0c,0x21,0x22,0x15,0x22,0x35,0x10,0xc9,
    0xcd,0x99,0x07,0xcd,0x5d,0x05,0xc3,0x76,0x01,0xcd,0x4f,0x2c,0xf0,0xc9,0x2b,0xf0,
    0xca,0xcd,0x1b,0x39,0xf0,0xc9,0x3e,0xf0,0xca,0xf0,0xf0,0xf0,0x69,0x68,0x55,0x1a,
    0x19,0xf0,0xf0,0xf0,0x4a,0x36,0x6d,0x5a,0x3d,0x18,0x17,0x16,0x15,0x14,0x13,0x12,
    0x11,0x53,0x73,0x46,0x70,0x71,0x5d,0x33,0x72,0x10,0x0f,0x0e,0x0d,0x0c,0x0b,0x0a,
    0x09,0x76,0x77,0x43,0x56,0x78,0x5e,0x1e,0x3c,0x08,0x07,0x06,0x05,0x04,0x03,0x02,
    0x01,0x5f,0x1f,0x1d,0x32,0x1c,0x44,0x41,0x5c,0x28,0x27,0x26,0x25,0x24,0x23,0x22,
    0x21,0x52,0x67,0x66,0x65,0x64,0x63,0x62,0x61,0x2e,0x2f,0x29,0x20,0x00,0x2a,0x6a,
    0x6b,0x57,0x51,0x54,0x60,0x00,0xdd,0xde,0x59,0x2d,0x49,0xc4,0xc3,0xc1,0xc2,0xc7,
    0xc8,0x45,0x40,0xc4,0xc3,0xc1,0xc2,0xc5,0xc6,0xf0,0xc7,0xf0,0xc3,0xcd,0xf0,0xf0,
    0xf0,0xf0,0xc8,0xf0,0xc4,0xcd,0xf0,0xf0,0xcb,0xc5,0x00,0xc1,0xcb,0xf0,0x3c,0x3e,
    0xdc,0xc6,0x00,0xc2,0xf0,0xf0,0x7c,0x7e,0xd8,0xcd,0xbc,0x8d,0xf0,0xc9,0x99,0xf0,
    0xca,0xf0,0xf0,0xf0,0xb8,0xb4,0xa0,0x91,0x86,0x81,0x87,0x97,0x96,0x82,0x84,0x9c,
    0x94,0xaa,0xab,0x8f,0x8c,0xad,0xb0,0x8e,0xa2,0x8a,0x83,0x90,0x88,0x92,0x9a,0x93,
    0x98,0xa1,0x89,0x95,0xa6,0xa5,0xa4,0x85,0xa3,0xac,0xae,0xaf,0x8b,0x00,0xa7,0xa8,
    0xa9,0x9b,0xbf,0xc4,0xc3,0xc1,0xc2,0xc7,0xc8,0xf0,0xc7,0xf0,0xc3,0xcd,0xf0,0xbd,
    0xbf,0xc5,0x00,0xc1,0xf0,0xf0,0xbc,0xbe,0xdb,0xc5,0xe5,0xfe,0x17,0x38,0x1c,0x21,
    0xc6,0x0c,0x01,0xe0,0x00,0xed,0xb1,0x20,0x1a,0x3e,0xdf,0x91,0x18,0x0a,0xc5,0xe5,
    0x21,0xc6,0x0c,0x4f,0x06,0x00,0x09,0x7e,0xe1,0xc1,0xc9,0xfe,0x11,0x38,0x04,0xc6,
    0xb0,0x18,0xf5,0xaf,0x18,0xf2,0x3a,0x34,0x10,0xb7,0xc2,0xd3,0x09,0x79,0x08,0xb9,
    0xca,0xe0,0x09,0x06,0x04,0xcd,0xca,0x08,0xe6,0x3f,0x57,0xcd,0xff,0x09,0xcd,0xca,
    0x08,0xe6,0x3f,0xba,0xc2,0xe7,0x09,0x0b,0x78,0xb1,0xca,0xe4,0x09,0x18,0xec,0x13,
    0xcd,0x10,0x04,0x06,0x10,0xcd,0x30,0x0c,0xcd,0xca,0x08,0xb7,0x28,0x05,0xfe,0xcb,
    0xc8,0x10,0xf2,0xcd,0xb3,0x09,0xfe,0xcd,0x28,0xe9,0xb7,0xc0,0x06,0x01,0x18,0xe5,
    0xc5,0xcd,0xba,0x03,0x06,0x08,0xc5,0xe5,0xaf,0xd7,0x7e,0xcd,0xc3,0x03,0x23,0xaf,
    0xd7,0x10,0xf7,0xd7,0xe1,0xc1,0x7e,0xcd,0xb9,0x0b,0xcd,0xb5,0x0d,0x23,0x10,0xf6,
    0xc1,0xc3,0x06,0x00,0xcd,0xc0,0x0c,0x1e,0xa8,0xcd,0x1f,0x04,0x38,0x05,0x77,0x13,
    0x23,0x18,0xf6,0x3e,0xa9,0xbb,0xd0,0xcd,0xba,0x03,0xc3,0x8e,0x00,0xc5,0xe5,0x2a,
    0x36,0x10,0x7d,0xfe,0x10,0x38,0x03,0x2e,0x50,0x24,0xcd,0xae,0x02,0x06,0x07,0xc3,
    0xef,0x02,0x13,0x1a,0xfe,0x53,0xca,0x70,0x01,0xfe,0x47,0xca,0x76,0x01,0xcd,0xc0,
    0x0c,0x22,0x04,0x11,0xe5,0x1e,0xaa,0xcd,0x10,0x04,0xd1,0xed,0x52,0x23,0x22,0x02,
    0x11,0x11,0xaf,0x11,0xcd,0xc0,0x0c,0x22,0x06,0x11,0x11,0xf1,0x10,0x21,0xb4,0x11,
    0x01,0x10,0x00,0xed,0xb0,0x3e,0x0d,0x12,0xcd,0x9f,0x01,0xe7,0xd2,0x24,0x00,0xc9,
    0xcd,0x10,0x04,0xd0,0xd1,0xc9,0x20,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
    0x4a,0x4b,0x4c,0x4d,0x4e,0x4f,0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
    0x5a,0xfb,0xcd,0xdd,0xcb,0xd1,0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,
    0x2d,0x3d,0x3b,0x2f,0x2e,0x2c,0xe5,0xf4,0xec,0xda,0xe3,0xe2,0xd7,0xd4,0xe6,0xe8,
    0xc2,0xc1,0xc4,0xc7,0xcf,0xca,0x20,0xe1,0xfe,0xc8,0xfa,0x5f,0xf8,0xf1,0xf7,0x3f,
    0xcc,0xdb,0xdc,0xe9,0xf5,0x3a,0x5e,0x3c,0x5b,0xf3,0x5d,0x40,0xc9,0x3e,0xfc,0x5c,
    0xc6,0xdf,0xd0,0xce,0xd3,0xd2,0xff,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x29,
    0x2b,0x2a,0xde,0xf6,0xeb,0xea,0xc3,0xc5,0xef,0xf0,0xe4,0xe7,0xee,0xed,0xe0,0xfd,
    0xd8,0xd5,0xf2,0xf9,0xd9,0xd6,0x20,0xa1,0x9a,0x9f,0x9c,0x92,0xaa,0x97,0x98,0xa6,
    0xaf,0xa9,0xb8,0xb3,0xb0,0xb7,0x9e,0xa0,0x9d,0xa4,0x96,0xa5,0xab,0xa3,0x9b,0xbd,
    0xa2,0xbb,0x99,0x82,0x87,0x8c,0xbc,0xa7,0xac,0x91,0x93,0x94,0x95,0xb4,0xb5,0xb6,
    0xae,0xad,0xba,0xb2,0xb9,0xa8,0xb1,0x83,0x88,0x8d,0x86,0x84,0x89,0x8e,0xbf,0x85,
    0x8a,0x8f,0xbe,0x81,0x8b,0x90,0x7f,0x11,0x12,0x13,0x14,0x15,0x16,0x60,0x61,0x62,
    0x63,0x64,0x65,0x66,0x67,0x68,0x70,0x71,0x11,0x73,0x74,0x75,0x76,0x77,0x78,0x79,
    0x7a,0x7b,0x7c,0x7d,0x7e,0x69,0xf5,0x3a,0x02,0xe0,0x07,0x30,0xfa,0x3a,0x02,0xe0,
    0x07,0x38,0xfa,0xf1,0xc9,0xf5,0xc5,0xd5,0xe5,0x47,0xcd,0xb1,0x0f,0x70,0x2a,0x71,
    0x11,0x7d,0xfe,0x27,0xc2,0x90,0x0e,0x5c,0x16,0x00,0x21,0x73,0x11,0x19,0x7e,0xb7,
    0xc2,0x90,0x0e,0x23,0x36,0x01,0x23,0x36,0x00,0xc3,0x90,0x0e,0xf5,0xc5,0xd5,0xe5,
    0x47,0xe6,0xf0,0xfe,0xc0,0x20,0x7f,0xa8,0xfe,0x0d,0xca,0x8b,0x0f,0xfe,0x0b,0x30,
    0x75,0x26,0x0e,0x6f,0x6e,0xe9,0x21,0x34,0x10,0x7e,0x2f,0x77,0xc3,0xee,0x07,0x00,
    0x32,0x74,0x84,0x90,0xae,0xbf,0xc5,0xf8,0x0b,0xe1,0xf2,0xc3,0x49,0x0f,0x11,0xa3,
    0x11,0xd5,0x21,0x1b,0x0e,0x01,0x0c,0x00,0xed,0xb0,0xc9,0x21,0x02,0xe0,0xcb,0x9e,
    0xcb,0xc6,0xcb,0x86,0xc3,0x80,0x09,0xdf,0x00,0x21,0x9d,0x11,0x18,0xcb,0x00,0xc3,
    0x7d,0x08,0xcd,0x96,0x01,0xaf,0x32,0x03,0xe0,0x01,0xc0,0x03,0x11,0x00,0xd0,0x21,
    0x28,0xd0,0xed,0xb0,0xeb,0x06,0x28,0xcd,0xd8,0x0f,0x01,0x1a,0x00,0x11,0x73,0x11,
    0x21,0x74,0x11,0xed,0xb0,0x36,0x00,0x3a,0x73,0x11,0xb7,0xc2,0x6a,0x0e,0xcd,0x96,
    0x01,0x3e,0x01,0x32,0x03,0xe0,0xc3,0xde,0x0f,0x00,0x2a,0x71,0x11,0x25,0x22,0x71,
    0x11,0xc3,0x39,0x0e,0x2a,0x71,0x11,0x7c,0xfe,0x18,0xca,0x32,0x0e,0x24,0x22,0x71,
    0x11,0xc3,0xde,0x0f,0x2a,0x71,0x11,0x7c,0xb7,0xca,0xde,0x0f,0x25,0xc3,0x7e,0x0e,
    0x2a,0x71,0x11,0x7d,0xfe,0x27,0xd2,0x9d,0x0e,0x2c,0xc3,0x7e,0x0e,0x2e,0x00,0x24,
    0x7c,0xfe,0x19,0xda,0x7e,0x0e,0x26,0x18,0x22,0x71,0x11,0xc3,0x32,0x0e,0x2a,0x71,
    0x11,0x7d,0xb7,0x28,0x04,0x2d,0xc3,0x7e,0x0e,0x2e,0x27,0x25,0xf2,0x7e,0x0e,0x21,
    0x00,0x00,0xc3,0x7e,0x0e,0xcd,0xa6,0x0d,0x0e,0x19,0x21,0x00,0xd0,0x06,0x28,0xcd,
    0xd8,0x0f,0x0d,0xc2,0xcd,0x0e,0x21,0x73,0x11,0x06,0x1b,0xcd,0xd8,0x0f,0xc3,0xbf,
    0x0e,0x21,0x70,0x11,0xaf,0xbe,0x18,0x01,0x3c,0x77,0xd6,0x06,0x2f,0x32,0x03,0xe0,
    0x18,0x8f,0x21,0x70,0x11,0xaf,0x18,0xf0,0x2a,0x71,0x11,0x7c,0xb5,0xca,0xde,0x0f,
    0x7d,0xb7,0x20,0x16,0x5c,0x16,0x00,0x21,0x73,0x11,0x19,0x7e,0xb7,0x20,0x0b,0xcd,
    0xb1,0x0f,0xcd,0xa6,0x0d,0x2b,0x36,0x00,0x18,0x94,0x2a,0x71,0x11,0x5c,0x1c,0x16,
    0x00,0x21,0x73,0x11,0x19,0x7e,0x47,0xb7,0x3e,0x28,0x28,0x02,0x3e,0x50,0x2a,0x71,
    0x11,0x95,0x4f,0x06,0x00,0xcd,0xb1,0x0f,0xe5,0xd1,0x1b,0xcd,0xa6,0x0d,0xed,0xb0,
    0x18,0xd3,0xcd,0xf4,0x00,0xc3,0xee,0x07,0x00,0x2a,0x71,0x11,0x5c,0x1c,0x16,0x00,
    0x21,0x73,0x11,0x19,0x7e,0xb7,0x0e,0x00,0x2a,0x71,0x11,0x2e,0x27,0x28,0x02,0x24,
    0x0c,0xcd,0xb4,0x0f,0x7e,0xb7,0xc2,0xde,0x0f,0xe5,0x2a,0x71,0x11,0x3e,0x27,0x95,
    0x47,0x79,0xb7,0x28,0x04,0x3e,0x28,0x80,0x47,0xd1,0xd5,0xe1,0x2b,0xcd,0xa6,0x0d,
    0x7e,0x12,0x36,0x00,0x2b,0x1b,0x10,0xf8,0xc3,0xde,0x0f,0x2a,0x71,0x11,0x5c,0x1c,
    0x16,0x00,0x21,0x73,0x11,0x19,0x7e,0xb7,0x2a,0x71,0x11,0xca,0x9d,0x0e,0x2e,0x00,
    0x7c,0xfe,0x17,0x28,0x05,0x24,0x24,0xc3,0x7e,0x0e,0x24,0x22,0x71,0x11,0xc3,0x32,
    0x0e,0x2a,0x71,0x11,0xc5,0xd5,0xe5,0xc1,0x11,0x28,0x00,0x21,0xd8,0xcf,0x19,0x05,
    0xf2,0xbe,0x0f,0x06,0x00,0x09,0xd1,0xc1,0xc9,0x21,0x03,0xe0,0x36,0x8a,0x36,0x07,
    0x36,0x05,0x3e,0x01,0x32,0x03,0xe0,0xc9,0xaf,0x77,0x23,0x10,0xfc,0xc9,0xe1,0xd1,
    0xc1,0xf1,0xc9,0x3e,0x3a,0xd7,0x2a,0x04,0x11,0xcd,0xba,0x03,0xeb,0x2a,0x02,0x11,
    0x19,0x2b,0xcd,0xf8,0x0f,0x2a,0x06,0x11,0x3e,0x2d,0xd7,0xcd,0xba,0x03,0xaf,0xc9];
var NEWMON = [
    0xc3,0x4a,0x00,0xc3,0xe6,0x07,0xc3,0x0e,0x09,0xc3,0x18,0x09,0xc3,0x20,0x09,0xc3,
    0x7f,0x00,0xc3,0x35,0x09,0xc3,0x81,0x09,0xc3,0x99,0x09,0xc3,0xbd,0x08,0xc3,0x32,
    0x0a,0xc3,0x36,0x04,0xc3,0x75,0x04,0xc3,0xd8,0x04,0xc3,0xf8,0x04,0xc3,0x88,0x05,
    0xc3,0xc7,0x01,0xc3,0x08,0x03,0x00,0x00,0xc3,0x38,0x10,0xc3,0x58,0x03,0xc3,0xe5,
    0x02,0xc3,0xfa,0x02,0xc3,0xab,0x02,0xc3,0xbe,0x02,0x31,0xf0,0x10,0xed,0x56,0xcd,
    0xc9,0x0f,0x3e,0x16,0xd7,0x06,0x3c,0x21,0x70,0x11,0xcd,0xd8,0x0f,0x21,0x92,0x03,
    0x3e,0xc3,0x32,0x38,0x10,0x22,0x39,0x10,0x21,0x04,0x05,0x22,0x9e,0x11,0xcd,0xbe,
    0x02,0x11,0x41,0x01,0xdf,0xcd,0xc0,0x0a,0x18,0x08,0x11,0xf1,0x10,0x18,0x96,0xc3,
    0x26,0x09,0x31,0xf0,0x10,0x11,0x82,0x00,0xd5,0xcd,0x09,0x00,0x3e,0x2a,0xd7,0x11,
    0xa3,0x11,0xcd,0x03,0x00,0x1a,0xfe,0x2a,0xc2,0x54,0x0c,0x13,0x1a,0xfe,0x47,0xca,
    0x59,0x01,0xfe,0x46,0xca,0x00,0xf6,0xfe,0x4d,0xca,0x0f,0x0c,0xfe,0x53,0xca,0x82,
    0x0c,0xfe,0x40,0xca,0x0e,0x0e,0xfe,0x4c,0x28,0x1f,0xfe,0x50,0x28,0x36,0xfe,0x52,
    0xca,0xaa,0x01,0xfe,0x23,0xca,0x12,0x02,0xc3,0x9b,0x0a,0xcd,0xe8,0x00,0xcd,0x2d,
    0x00,0x38,0x0a,0x11,0xc4,0x01,0xcf,0xdf,0xc9,0xcd,0xe8,0x00,0xef,0xda,0x67,0x01,
    0x2a,0x06,0x11,0x7c,0xfe,0x12,0xd8,0xe9,0xcd,0x27,0x00,0x38,0x95,0xcf,0x11,0x38,
    0x01,0xdf,0x18,0x86,0x11,0x00,0xd0,0x0e,0x19,0x06,0x28,0x1a,0xcd,0xce,0x0b,0xcd,
    0x0f,0x01,0x13,0x10,0xf6,0x3e,0x0d,0xcd,0x0f,0x01,0x0d,0x20,0xec,0xc9,0xd5,0xf5,
    0xdb,0xfe,0xe6,0x0d,0xb7,0x28,0x07,0xcd,0x1e,0x00,0x28,0x77,0x18,0xf2,0xf1,0xd3,
    0xff,0x3e,0x80,0xd3,0xfe,0xdb,0xfe,0xe6,0x0d,0xfe,0x01,0x20,0xf8,0xaf,0xd3,0xfe,
    0xc9,0x46,0x4f,0x55,0x4e,0x44,0x20,0x0d,0x4c,0x4f,0x41,0x44,0x49,0x4e,0x47,0x20,
    0x0d,0x2a,0x2a,0x20,0x4d,0x5a,0x90,0x4d,0x4f,0x4e,0x49,0x54,0x4f,0x52,0x20,0x56,
    0x45,0x52,0x34,0x2e,0x34,0x20,0x2a,0x2a,0x0d,0x13,0x1a,0xfe,0x4f,0x20,0x04,0x13,
    0x13,0x13,0x13,0xcd,0xc0,0x0c,0xe9,0xfe,0x02,0xc8,0xcf,0x11,0xb5,0x01,0xdf,0xc9,
    0x3e,0xff,0x32,0x9d,0x11,0xc9,0xaf,0x18,0xf9,0x21,0x00,0xf0,0x7e,0xb7,0xc0,0xe9,
    0xc5,0xd5,0xe5,0x1a,0xbe,0x20,0x0b,0x05,0x28,0x08,0xfe,0x0d,0x28,0x04,0x13,0x23,
    0x18,0xf1,0xe1,0xd1,0xc1,0xc9,0xf5,0xc3,0xad,0x0d,0x3e,0xff,0xd3,0xe0,0xc9,0x11,
    0x31,0x01,0xdf,0x11,0xf1,0x10,0xdf,0xc3,0xe3,0x0f,0xcd,0xe8,0x00,0xcd,0xe3,0x0f,
    0xef,0xc3,0xd1,0x00,0x00,0x43,0x48,0x45,0x43,0x4b,0x53,0x55,0x4d,0x20,0x45,0x52,
    0x52,0x4f,0x52,0x0d,0x4f,0x4b,0x0d,0xc5,0xd5,0xe5,0x3e,0x02,0x32,0xa0,0x11,0x06,
    0x01,0x1a,0xfe,0x0d,0x28,0x02,0xfe,0xc8,0x28,0x2e,0xfe,0xcf,0x28,0x1e,0xfe,0xd7,
    0x28,0x22,0xfe,0x23,0x21,0x71,0x02,0x20,0x03,0x2e,0x89,0x13,0xcd,0x1c,0x02,0x38,
    0xe0,0xcd,0xc8,0x02,0x38,0x15,0xcd,0xab,0x02,0x41,0x18,0xd5,0x3e,0x03,0x32,0xa0,
    0x11,0x13,0x18,0xcd,0x3e,0x01,0x18,0xf6,0xcd,0xc8,0x02,0xf5,0xcd,0xbe,0x02,0xf1,
    0x18,0x80,0x13,0xcd,0x1f,0x04,0xd8,0xcd,0x0f,0x01,0x18,0xf6,0xc5,0x06,0x08,0x1a,
    0xbe,0x28,0x09,0x23,0x23,0x23,0x10,0xf8,0x37,0x13,0xc1,0xc9,0x23,0xd5,0x5e,0x23,
    0x56,0xeb,0x7c,0xb7,0x28,0x09,0x3a,0xa0,0x11,0x3d,0x28,0x03,0x29,0x18,0xfa,0x22,
    0xa1,0x11,0x3e,0x02,0x32,0xa0,0x11,0xd1,0x13,0x1a,0x47,0xe6,0xf0,0xfe,0x30,0x28,
    0x05,0x3a,0x9f,0x11,0x18,0x07,0x13,0x78,0xe6,0x0f,0x32,0x9f,0x11,0x4f,0x06,0x00,
    0x21,0xa1,0x02,0x09,0x4e,0x3a,0x9e,0x11,0x47,0xaf,0x81,0x10,0xfd,0xc1,0x4f,0xaf,
    0xc9,0x43,0x77,0x07,0x44,0xa7,0x06,0x45,0xed,0x05,0x46,0x98,0x05,0x47,0xfc,0x04,
    0x41,0x71,0x04,0x42,0xf5,0x03,0x52,0x00,0x00,0x43,0x0c,0x07,0x44,0x47,0x06,0x45,
    0x98,0x05,0x46,0x48,0x05,0x47,0xb4,0x04,0x41,0x31,0x04,0x42,0xbb,0x03,0x52,0x00,
    0x00,0x01,0x02,0x03,0x04,0x06,0x08,0x0c,0x10,0x18,0x20,0x2a,0xa1,0x11,0x7c,0xb7,
    0x28,0x0c,0xd5,0xeb,0x21,0x04,0xe0,0x73,0x72,0x3e,0x01,0xd1,0x18,0x06,0x3e,0x34,
    0x32,0x07,0xe0,0xaf,0x32,0x08,0xe0,0xc9,0x21,0x00,0xe0,0x36,0xf9,0x23,0x7e,0xe6,
    0x08,0x20,0x02,0x37,0xc9,0x3a,0x08,0xe0,0x0f,0x38,0xfa,0x3a,0x08,0xe0,0x0f,0x30,
    0xfa,0x10,0xf2,0xaf,0xc9,0xc5,0xe5,0x21,0x71,0x04,0xcd,0xae,0x02,0x06,0x32,0xaf,
    0xcd,0x5b,0x07,0x10,0xfa,0xe1,0xc1,0xc3,0xbe,0x02,0xf5,0xc5,0xe6,0x0f,0x47,0x3e,
    0x08,0x90,0x32,0x9e,0x11,0xc1,0xf1,0xc9,0xf3,0xc5,0xd5,0xe5,0x32,0x9b,0x11,0x3e,
    0xf0,0x32,0x9c,0x11,0x21,0xc0,0xa8,0xaf,0xed,0x52,0xe5,0x23,0xeb,0x3e,0x74,0x32,
    0x07,0xe0,0x3e,0xb0,0x32,0x07,0xe0,0x21,0x06,0xe0,0x73,0x72,0x2b,0x36,0x0a,0x36,
    0x00,0x3e,0x80,0x32,0x07,0xe0,0x23,0x4e,0x7e,0xba,0x20,0xfb,0x79,0xbb,0x20,0xf7,
    0x2b,0x00,0x00,0x00,0x36,0x12,0x36,0x7a,0x23,0xd1,0x4e,0x7e,0xba,0x20,0xfb,0x79,
    0xbb,0x20,0xf7,0xe1,0xd1,0xc1,0xfb,0xc9,0xe5,0x3e,0x80,0x32,0x07,0xe0,0x21,0x06,
    0xe0,0xf3,0x5e,0x56,0xfb,0x7b,0xb2,0xca,0x79,0x03,0xaf,0x21,0xc0,0xa8,0xed,0x52,
    0xda,0x83,0x03,0xeb,0x3a,0x9b,0x11,0xe1,0xc9,0x11,0xc0,0xa8,0x3a,0x9b,0x11,0xee,
    0x01,0xe1,0xc9,0xf3,0x21,0x06,0xe0,0x7e,0x2f,0x5f,0x7e,0x2f,0x57,0xfb,0x13,0xc3,
    0x7c,0x03,0xf5,0xc5,0xd5,0xe5,0x3a,0x9b,0x11,0xee,0x01,0x32,0x9b,0x11,0x3e,0x80,
    0x32,0x07,0xe0,0x21,0x06,0xe0,0x5e,0x56,0x21,0xc0,0xa8,0x19,0x2b,0x2b,0xeb,0x21,
    0x06,0xe0,0x73,0x72,0xe1,0xd1,0xc1,0xf1,0xfb,0xc9,0x7c,0xcd,0xc3,0x03,0x7d,0xcd,
    0xc3,0x03,0xc9,0xf5,0xe6,0xf0,0x0f,0x0f,0x0f,0x0f,0xcd,0xda,0x03,0xcd,0x12,0x00,
    0xf1,0xe6,0x0f,0xcd,0xda,0x03,0xd7,0x3e,0x20,0xc9,0xd5,0xe5,0x21,0xe9,0x03,0xe6,
    0x0f,0x5f,0x16,0x00,0x19,0x7e,0xe1,0xd1,0xc9,0x30,0x31,0x32,0x33,0x34,0x35,0x36,
    0x37,0x38,0x39,0x41,0x42,0x43,0x44,0x45,0x46,0xc5,0xe5,0x01,0x00,0x10,0x21,0xe9,
    0x03,0xbe,0x20,0x03,0x79,0x18,0x06,0x23,0x0c,0x05,0x20,0xf5,0x37,0xe1,0xc1,0xc9,
    0xd5,0xcd,0x1f,0x04,0x38,0x07,0x67,0xcd,0x1f,0x04,0x38,0x01,0x6f,0xd1,0xc9,0xc5,
    0x1a,0x13,0xc3,0xf1,0x06,0x38,0x0d,0x07,0x07,0x07,0x07,0x4f,0x1a,0x13,0xcd,0xf9,
    0x03,0x38,0x01,0xb1,0xc1,0xc9,0xf3,0xd5,0xc5,0xe5,0x16,0xd7,0x1e,0xcc,0x21,0xf0,
    0x10,0x01,0x80,0x00,0xcd,0x33,0x07,0xcd,0xb2,0x06,0xda,0x63,0x05,0x7b,0xfe,0xcc,
    0x20,0x11,0xcd,0x09,0x00,0xd5,0x11,0x6c,0x04,0xcd,0x15,0x00,0x11,0xf1,0x10,0xcd,
    0x15,0x00,0xd1,0xcd,0xb8,0x07,0xcd,0x8d,0x04,0xc3,0x63,0x05,0x57,0x52,0x49,0x54,
    0x49,0x4e,0x47,0x20,0x0d,0xf3,0xd5,0xc5,0xe5,0x16,0xd7,0x1e,0x53,0x2a,0x02,0x11,
    0xe5,0xc1,0x2a,0x04,0x11,0x78,0xb1,0xca,0xd4,0x04,0xc3,0x44,0x04,0xd5,0xc5,0xe5,
    0x3a,0x37,0x10,0x57,0x3e,0xf9,0x32,0x00,0xe0,0x7e,0xcd,0xa5,0x07,0x3a,0x01,0xe0,
    0xe6,0x08,0x20,0x03,0x37,0x18,0x2d,0x23,0x0b,0x78,0xb1,0xc2,0x99,0x04,0x2a,0x97,
    0x11,0x7c,0xcd,0xa5,0x07,0x7d,0xcd,0xa5,0x07,0xcd,0x80,0x07,0x15,0xc2,0xc4,0x04,
    0xb7,0xc3,0xd4,0x04,0x06,0x00,0xcd,0x67,0x07,0x05,0xc2,0xc6,0x04,0xe1,0xc1,0xc5,
    0xe5,0xc3,0x99,0x04,0xe1,0xc1,0xd1,0xc9,0xf3,0xd5,0xc5,0xe5,0x16,0xd2,0x1e,0xcc,
    0x01,0x80,0x00,0x21,0xf0,0x10,0xcd,0xb2,0x06,0xda,0x82,0x05,0xcd,0x5e,0x06,0xda,
    0x82,0x05,0xcd,0x10,0x05,0xc3,0x63,0x05,0xf3,0xd5,0xc5,0xe5,0x16,0xd2,0x1e,0x53,
    0x2a,0x02,0x11,0xe5,0xc1,0x2a,0x04,0x11,0x78,0xb1,0xca,0x63,0x05,0xc3,0xe6,0x04,
    0xd5,0xc5,0xe5,0x2a,0x36,0x10,0x01,0x01,0xe0,0x11,0x02,0xe0,0xcd,0x01,0x06,0x38,
    0x61,0xcd,0x55,0x06,0x1a,0xe6,0x20,0x28,0xf3,0x54,0x21,0x00,0x00,0x22,0x97,0x11,
    0xe1,0xc1,0xc5,0xe5,0xcd,0x24,0x06,0x38,0x49,0x77,0x23,0x0b,0x78,0xb1,0x20,0xf4,
    0x2a,0x97,0x11,0xcd,0x24,0x06,0x38,0x3a,0x5f,0xcd,0x24,0x06,0x38,0x34,0xbd,0x20,
    0x23,0x7b,0xbc,0x20,0x1f,0x18,0x0b,0x3e,0x01,0x32,0x37,0x10,0xc9,0x3e,0x02,0x18,
    0xf8,0x00,0xaf,0xe1,0xc1,0xd1,0xcd,0x00,0x07,0xf5,0x3a,0x9c,0x11,0xfe,0xf0,0x20,
    0x01,0xfb,0xf1,0xc9,0x15,0xca,0x7c,0x05,0x62,0xc3,0x16,0x05,0x3e,0x01,0x37,0xc3,
    0x63,0x05,0x3e,0x02,0x37,0xc3,0x63,0x05,0xf3,0xd5,0xc5,0xe5,0x2a,0x02,0x11,0xe5,
    0xc1,0x2a,0x04,0x11,0x16,0xd2,0x1e,0x53,0x78,0xb1,0xca,0x63,0x05,0xcd,0x33,0x07,
    0xcd,0xb2,0x06,0xda,0x82,0x05,0xcd,0x5e,0x06,0xda,0x82,0x05,0xcd,0xb2,0x05,0xc3,
    0x63,0x05,0xd5,0xc5,0xe5,0x2a,0x36,0x10,0x01,0x01,0xe0,0x11,0x02,0xe0,0xcd,0x01,
    0x06,0x38,0xbf,0xcd,0x55,0x06,0x1a,0xe6,0x20,0x28,0xf3,0x54,0xe1,0xc1,0xc5,0xe5,
    0xcd,0x24,0x06,0x38,0xad,0xbe,0x20,0xa4,0x23,0x0b,0x78,0xb1,0x20,0xf2,0x2a,0x99,
    0x11,0xcd,0x24,0x06,0xbc,0x20,0x95,0xcd,0x24,0x06,0xbd,0x20,0x8f,0x15,0xca,0x62,
    0x05,0x62,0xc3,0xb8,0x05,0x78,0x06,0xc0,0x80,0x30,0x02,0xd6,0x40,0x47,0xc3,0x3a,
    0x08,0x3e,0xf9,0x32,0x00,0xe0,0x00,0x0a,0xe6,0x08,0xc2,0x0f,0x06,0x37,0xc9,0x1a,
    0xe6,0x20,0xc2,0x07,0x06,0x0a,0xe6,0x08,0xc2,0x1d,0x06,0x37,0xc9,0x1a,0xe6,0x20,
    0xca,0x15,0x06,0xc9,0xc5,0xd5,0xe5,0x21,0x00,0x08,0x01,0x01,0xe0,0x11,0x02,0xe0,
    0xcd,0x01,0x06,0x38,0x1c,0xcd,0x55,0x06,0x1a,0xe6,0x20,0x28,0x0a,0xe5,0x2a,0x97,
    0x11,0x23,0x22,0x97,0x11,0xe1,0x37,0x7d,0x17,0x6f,0x25,0x20,0xe3,0xcd,0x01,0x06,
    0x7d,0xe1,0xd1,0xc1,0xc9,0x3a,0x35,0x10,0x3d,0x20,0xfd,0x20,0x00,0xc9,0xc5,0xd5,
    0xe5,0x21,0x28,0x28,0x7b,0xfe,0xcc,0x28,0x03,0x21,0x14,0x14,0x22,0x95,0x11,0x01,
    0x01,0xe0,0x11,0x02,0xe0,0x2a,0x95,0x11,0xcd,0x01,0x06,0x38,0x1e,0xcd,0x55,0x06,
    0x1a,0xe6,0x20,0x28,0xf0,0x25,0x20,0xf0,0xcd,0x01,0x06,0x38,0x0e,0xcd,0x55,0x06,
    0x1a,0xe6,0x20,0x20,0xe0,0x2d,0x20,0xf0,0xcd,0x01,0x06,0xe1,0xd1,0xc1,0xc9,0xc2,
    0xf5,0x05,0x3e,0x28,0x2a,0x71,0x11,0x95,0x47,0xcd,0xb1,0x0f,0xcd,0xd8,0x0f,0xc3,
    0xee,0x07,0xc5,0xd5,0xe5,0x0e,0x0a,0x3a,0x02,0xe0,0xe6,0x10,0x28,0x05,0xaf,0xe1,
    0xd1,0xc1,0xc9,0x3e,0x06,0x21,0x03,0xe0,0x77,0x3c,0x77,0x0d,0x20,0xe9,0xcf,0x7a,
    0xfe,0xd7,0x28,0x06,0x11,0x22,0x07,0xdf,0x18,0x08,0x11,0x29,0x07,0xdf,0x11,0x24,
    0x07,0xdf,0x3a,0x02,0xe0,0xe6,0x10,0x20,0xd5,0xcd,0x44,0x0a,0x20,0xf4,0x37,0x18,
    0xce,0xfe,0x2f,0x28,0x06,0xcd,0xf9,0x03,0xc3,0x25,0x04,0x1a,0x13,0xc3,0x34,0x04,
    0xf5,0xc5,0xd5,0x06,0x0a,0x3a,0x02,0xe0,0xe6,0x10,0x20,0x04,0xd1,0xc1,0xf1,0xc9,
    0x3e,0x06,0x32,0x03,0xe0,0x3e,0x07,0x32,0x03,0xe0,0x05,0xc2,0x05,0x07,0xd1,0xc1,
    0xf1,0xc9,0x7f,0x20,0x50,0x4c,0x41,0x59,0x0d,0x7f,0x20,0x52,0x45,0x43,0x4f,0x52,
    0x44,0x2e,0x0d,0xc5,0xd5,0xe5,0x11,0x00,0x00,0x78,0xb1,0x20,0x0b,0xeb,0x22,0x97,
    0x11,0x22,0x99,0x11,0xe1,0xd1,0xc1,0xc9,0x7e,0xe5,0x26,0x08,0x07,0x30,0x01,0x13,
    0x25,0x20,0xf9,0xe1,0x23,0x0b,0x18,0xe1,0x3a,0x36,0x10,0x3d,0x20,0xfd,0xc9,0x3a,
    0x37,0x00,0x18,0xf4,0x00,0x00,0x00,0xf5,0x3e,0x03,0x32,0x03,0xe0,0xcd,0x5f,0x07,
    0x3e,0x02,0x32,0x03,0xe0,0xcd,0x5f,0x07,0xf1,0xc9,0x08,0xc3,0xe4,0x09,0x00,0x00,
    0xf5,0x3e,0x03,0x32,0x03,0xe0,0xcd,0x5f,0x07,0xcd,0x5f,0x07,0x3e,0x02,0x32,0x03,
    0xe0,0xcd,0x5f,0x07,0xcd,0x62,0x07,0xf1,0xc9,0x3e,0x00,0x32,0x34,0x10,0x21,0x26,
    0x19,0x22,0x35,0x10,0xc9,0xc5,0x06,0x08,0xcd,0x80,0x07,0x07,0xdc,0x80,0x07,0xd4,
    0x67,0x07,0x05,0xc2,0xab,0x07,0xc1,0xc9,0xc5,0xd5,0x7b,0x01,0xf8,0x2a,0x11,0x28,
    0x28,0xfe,0xcc,0xca,0xcc,0x07,0x01,0xbe,0x0a,0x11,0x14,0x14,0xcd,0x67,0x07,0x0b,
    0x78,0xb1,0x20,0xf8,0xcd,0x80,0x07,0x15,0x20,0xfa,0xcd,0x67,0x07,0x1d,0x20,0xfa,
    0xcd,0x80,0x07,0xd1,0xc1,0xc9,0xf5,0xc5,0xe5,0xd5,0xaf,0x32,0x93,0x11,0xcd,0xb3,
    0x09,0x47,0x3a,0x9d,0x11,0xb7,0xcc,0x6d,0x0c,0x78,0xe6,0xf0,0xfe,0xc0,0x20,0x37,
    0x78,0xfe,0xcd,0x28,0x56,0xfe,0xc9,0x28,0x1d,0xfe,0xca,0x28,0x14,0xfe,0xcb,0xca,
    0xb3,0x08,0xfe,0xc8,0x28,0x0b,0xfe,0xc7,0x28,0x07,0x3a,0x93,0x11,0xb7,0x20,0x1c,
    0x78,0xcd,0xdc,0x0d,0x18,0xc8,0x21,0x70,0x11,0xaf,0xbe,0x20,0x01,0x3c,0x77,0xd6,
    0x06,0x2f,0x32,0x03,0xe0,0x18,0xb7,0xcd,0x44,0x0a,0x28,0x6a,0x78,0xcd,0xa6,0x0d,
    0xcd,0xb5,0x0d,0xfe,0x62,0x20,0xa7,0x21,0x93,0x11,0x7e,0x2f,0x77,0x18,0x9f,0xfe,
    0xd7,0xca,0x42,0x0f,0xfe,0xd5,0xfe,0xdc,0xc3,0x9f,0x06,0x2a,0x71,0x11,0x5c,0x16,
    0x00,0x21,0x73,0x11,0x19,0xeb,0x1a,0xb7,0x01,0x28,0x00,0x2a,0x71,0x11,0xc2,0x7a,
    0x08,0x13,0x1a,0xb7,0xca,0x7d,0x08,0xc3,0x7b,0x08,0x25,0x0e,0x50,0x2e,0x00,0xcd,
    0xb4,0x0f,0xd1,0xd5,0xc5,0xcd,0xa6,0x0d,0xed,0xb0,0xc1,0xe1,0xe5,0x41,0x7e,0xcd,
    0xce,0x0b,0x77,0x23,0x10,0xf8,0x36,0x0d,0x2b,0x7e,0xfe,0x20,0x28,0xf8,0xcd,0x06,
    0x00,0xd1,0xe1,0xc1,0xf1,0xc9,0x78,0xfe,0xd1,0xca,0xf6,0x0d,0xfe,0xd3,0xca,0x29,
    0x0e,0x18,0x9c,0xe1,0xe5,0x36,0x1b,0x23,0x36,0x0d,0x18,0xe2,0x00,0xcd,0xca,0x08,
    0xfe,0xf0,0x20,0x02,0xaf,0xc9,0xcd,0xce,0x0b,0xc9,0xc5,0xd5,0xe5,0xcd,0x50,0x0a,
    0x78,0x07,0x38,0x06,0x3e,0xf0,0xe1,0xd1,0xc1,0xc9,0x07,0xd2,0xec,0x08,0x06,0x00,
    0x21,0x08,0x00,0x09,0x11,0xc9,0x0a,0x19,0x7e,0xc3,0xd6,0x08,0x3a,0x70,0x11,0xb7,
    0xc2,0xfd,0x08,0x06,0x00,0x21,0xc9,0x0a,0x09,0x7e,0xc3,0xd6,0x08,0x79,0xe6,0xf0,
    0x0f,0x47,0x79,0xe6,0x0f,0x80,0xc6,0xa0,0x6f,0x26,0x00,0xc3,0xe4,0x08,0xaf,0x32,
    0x94,0x11,0x3e,0xcd,0xcd,0xdc,0x0d,0xc9,0x3a,0x94,0x11,0xb7,0xc8,0xc3,0x06,0x00,
    0x3e,0x20,0xcd,0x35,0x09,0xc9,0xcd,0x0c,0x00,0x3a,0x94,0x11,0xb7,0xc8,0xd6,0x0a,
    0x38,0xf4,0x20,0xfa,0xc9,0xfe,0x0d,0xca,0x0e,0x09,0xc5,0x4f,0x47,0xcd,0x96,0x01,
    0xcd,0x46,0x09,0x78,0xc1,0xc9,0x79,0xcd,0xb9,0x0b,0x4f,0xe6,0xf0,0xfe,0xf0,0xc8,
    0xfe,0xc0,0x79,0xc2,0x70,0x09,0xfe,0xc7,0xd2,0x70,0x09,0xcd,0xdc,0x0d,0xfe,0xc3,
    0xca,0x73,0x09,0xfe,0xc5,0xca,0x6b,0x09,0xfe,0xc6,0xc0,0xaf,0x32,0x94,0x11,0xc9,
    0xcd,0xb5,0x0d,0x3a,0x94,0x11,0x3c,0xfe,0x50,0x38,0x02,0xd6,0x50,0x32,0x94,0x11,
    0xc9,0xf5,0xc5,0xd5,0x06,0x05,0xcd,0x96,0x01,0x1a,0xfe,0x0d,0xca,0xdf,0x0f,0x4f,
    0xcd,0x46,0x09,0x13,0x10,0xf3,0xc3,0x84,0x09,0xf5,0xc5,0xd5,0x06,0x05,0xcd,0x96,
    0x01,0x1a,0xfe,0x0d,0xca,0xdf,0x0f,0xcd,0xb9,0x0b,0xcd,0x70,0x09,0x13,0x10,0xf1,
    0xc3,0x9c,0x09,0xc5,0xd5,0xe5,0xcd,0xb1,0x0f,0xcd,0xa6,0x0d,0x7e,0x32,0x8e,0x11,
    0x22,0x8f,0x11,0x21,0x92,0x11,0x36,0xef,0xaf,0x32,0x00,0xe0,0x32,0x91,0x11,0x2f,
    0x32,0x00,0xe0,0x16,0x14,0xcd,0xff,0x09,0xcd,0x50,0x0a,0x78,0x07,0xda,0xe6,0x0b,
    0x15,0xc2,0xd5,0x09,0xcd,0xff,0x09,0xcd,0xca,0x08,0xfe,0xf0,0xca,0x7a,0x07,0xf5,
    0xcd,0xa6,0x0d,0x3a,0x8e,0x11,0x2a,0x8f,0x11,0x77,0xf1,0xe1,0xd1,0xc1,0xc9,0xf5,
    0xe5,0x3a,0x02,0xe0,0x07,0x07,0xda,0x25,0x0a,0x3a,0x91,0x11,0x0f,0xda,0x22,0x0a,
    0x3a,0x92,0x11,0x2a,0x8f,0x11,0xcd,0xa6,0x0d,0x77,0x3a,0x91,0x11,0xee,0x01,0x32,
    0x91,0x11,0xe1,0xf1,0xc9,0x3a,0x91,0x11,0x0f,0xd2,0x22,0x0a,0x3a,0x8e,0x11,0xc3,
    0x13,0x0a,0x3e,0xf8,0x32,0x00,0xe0,0x00,0x3a,0x01,0xe0,0x2f,0xe6,0x21,0xc2,0x44,
    0x0a,0xc6,0x01,0xc9,0x3e,0xf9,0x32,0x00,0xe0,0x00,0x3a,0x01,0xe0,0xe6,0x08,0xc9,
    0xd5,0xe5,0x06,0xfa,0x16,0x00,0x05,0x78,0x32,0x00,0xe0,0xfe,0xef,0x20,0x04,0x42,
    0xe1,0xd1,0xc9,0xfe,0xf8,0x28,0x1f,0x3a,0x01,0xe0,0x2f,0xb7,0x28,0xe8,0x5f,0xcb,
    0xfa,0x78,0xe6,0x0f,0x07,0x07,0x07,0x07,0x4f,0x3e,0x08,0x3d,0x28,0x04,0xcb,0x03,
    0x30,0xf9,0x81,0x4f,0x18,0xd0,0x3a,0x01,0xe0,0x2f,0x5f,0xe6,0x21,0x28,0x02,0xcb,
    0xf2,0x7b,0xe6,0xde,0x28,0xc0,0x18,0xd6,0xcd,0x3e,0x00,0xfe,0x56,0xca,0xcb,0x00,
    0xfe,0x43,0xc0,0x13,0x1a,0xfe,0x41,0xca,0x9e,0x07,0xfe,0x31,0xca,0x57,0x05,0xfe,
    0x32,0xca,0x5d,0x05,0xfe,0x42,0xc2,0xb8,0x0c,0x21,0x14,0x0d,0x22,0x35,0x10,0xc9,
    0xcd,0x99,0x07,0xcd,0x57,0x05,0xc3,0x76,0x01,0x21,0x23,0x25,0x27,0x29,0x2a,0x1d,
    0x1f,0x61,0x63,0x65,0x67,0x69,0x6a,0x5d,0x5f,0x22,0x24,0x26,0x28,0x20,0x1c,0x1e,
    0xd1,0x62,0x64,0x66,0x68,0x60,0x5c,0x5e,0xd0,0x11,0x05,0x14,0x15,0x0f,0x2b,0x31,
    0x33,0x51,0x45,0x54,0x55,0x4f,0x6b,0x71,0x73,0x17,0x12,0x19,0x09,0x10,0x30,0x32,
    0xd3,0x57,0x52,0x59,0x49,0x50,0x70,0x72,0xd2,0x01,0x04,0x07,0x0a,0x0c,0x1b,0x35,
    0x37,0x41,0x44,0x47,0x4a,0x4c,0x5b,0x75,0x77,0x13,0x06,0x08,0x0b,0x2c,0x34,0x36,
    0xd5,0x53,0x46,0x48,0x4b,0x6c,0x74,0x76,0xd4,0x1a,0x03,0x02,0x0d,0x2e,0xc9,0x39,
    0x3b,0x5a,0x43,0x42,0x4d,0x6e,0xca,0x79,0x7b,0x18,0x16,0x0e,0x2f,0x2d,0x38,0x3a,
    0xd7,0x58,0x56,0x4e,0x6f,0x6d,0x78,0x7a,0xd6,0xf0,0xc7,0xf0,0xc3,0xcd,0xf0,0x3d,
    0x3f,0xf0,0xc8,0xf0,0xc4,0xcd,0xf0,0x7d,0x7f,0xc5,0x00,0xc1,0xf0,0xf0,0x3c,0x3e,
    0xdc,0xc6,0x00,0xc2,0xcb,0xf0,0x7c,0x7e,0xd8,0xa1,0xa3,0xa5,0xa7,0xa9,0xaa,0x9d,
    0x9f,0xa2,0xa4,0xa6,0xa8,0xa0,0x9c,0x9e,0xdd,0x91,0x85,0x94,0x95,0x8f,0xab,0xb1,
    0xb3,0x97,0x92,0x99,0x89,0x90,0xb0,0xb2,0xde,0x81,0x84,0x87,0x8a,0x8c,0x9b,0xb5,
    0xb7,0x93,0x86,0x88,0x8b,0xac,0xb4,0xb6,0xd9,0x9a,0x83,0x82,0x8d,0xae,0xc9,0xb9,
    0xbb,0x98,0x96,0x8e,0xaf,0xad,0xb8,0xba,0xda,0xf0,0xc7,0xf0,0xc3,0xcd,0xf0,0xbd,
    0xbf,0xc5,0x00,0xc1,0xf0,0xf0,0xbc,0xbe,0xdb,0xc5,0xe5,0xfe,0x17,0x38,0x1c,0x21,
    0xc6,0x0c,0x01,0xe0,0x00,0xed,0xb1,0x20,0x1a,0x3e,0xdf,0x91,0x18,0x0a,0xc5,0xe5,
    0x21,0xc6,0x0c,0x4f,0x06,0x00,0x09,0x7e,0xe1,0xc1,0xc9,0xfe,0x11,0x38,0x04,0xc6,
    0xb0,0x18,0xf5,0xaf,0x18,0xf2,0x3a,0x34,0x10,0xb7,0xc2,0xd3,0x09,0x79,0x08,0xb9,
    0xca,0xe0,0x09,0x06,0x04,0xcd,0xca,0x08,0xe6,0x3f,0x57,0xcd,0xff,0x09,0xcd,0xca,
    0x08,0xe6,0x3f,0xba,0xc2,0xe7,0x09,0x0b,0x78,0xb1,0xca,0xe4,0x09,0x18,0xec,0x13,
    0xcd,0x10,0x04,0x06,0x10,0xcd,0x30,0x0c,0xcd,0xca,0x08,0xb7,0x28,0x05,0xfe,0xcb,
    0xc8,0x10,0xf2,0xcd,0xb3,0x09,0xfe,0xcd,0x28,0xe9,0xb7,0xc0,0x06,0x01,0x18,0xe5,
    0xc5,0xcd,0xba,0x03,0x06,0x08,0xc5,0xe5,0xaf,0xd7,0x7e,0xcd,0xc3,0x03,0x23,0xaf,
    0xd7,0x10,0xf7,0xd7,0xe1,0xc1,0x7e,0xcd,0xb9,0x0b,0xcd,0xb5,0x0d,0x23,0x10,0xf6,
    0xc1,0xc3,0x06,0x00,0xcd,0xc0,0x0c,0x1e,0xa8,0xcd,0x1f,0x04,0x38,0x05,0x77,0x13,
    0x23,0x18,0xf6,0x3e,0xa9,0xbb,0xd0,0xcd,0xba,0x03,0xc3,0x8e,0x00,0xc5,0xe5,0x2a,
    0x36,0x10,0x7d,0xfe,0x10,0x38,0x03,0x2e,0x50,0x24,0xcd,0xae,0x02,0x06,0x07,0xc3,
    0xef,0x02,0x13,0x1a,0xfe,0x53,0xca,0x70,0x01,0xfe,0x47,0xca,0x76,0x01,0xcd,0xc0,
    0x0c,0x22,0x04,0x11,0xe5,0x1e,0xaa,0xcd,0x10,0x04,0xd1,0xed,0x52,0x23,0x22,0x02,
    0x11,0x11,0xaf,0x11,0xcd,0xc0,0x0c,0x22,0x06,0x11,0x11,0xf1,0x10,0x21,0xb4,0x11,
    0x01,0x10,0x00,0xed,0xb0,0x3e,0x0d,0x12,0xcd,0x9f,0x01,0xe7,0xd2,0x24,0x00,0xc9,
    0xcd,0x10,0x04,0xd0,0xd1,0xc9,0x20,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
    0x4a,0x4b,0x4c,0x4d,0x4e,0x4f,0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
    0x5a,0xfb,0xcd,0xdd,0xcb,0xd1,0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,
    0x2d,0x3d,0x3b,0x2f,0x2e,0x2c,0xe5,0xf4,0xec,0xda,0xe3,0xe2,0xd7,0xd4,0xe6,0xe8,
    0xc2,0xc1,0xc4,0xc7,0xcf,0xca,0x20,0xe1,0xfe,0xc8,0xfa,0x5f,0xf8,0xf1,0xf7,0x3f,
    0xcc,0xdb,0xdc,0xe9,0xf5,0x3a,0x5e,0x3c,0x5b,0xf3,0x5d,0x40,0xc9,0x3e,0xfc,0x5c,
    0xc6,0xdf,0xd0,0xce,0xd3,0xd2,0xff,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x29,
    0x2b,0x2a,0xde,0xf6,0xeb,0xea,0xc3,0xc5,0xef,0xf0,0xe4,0xe7,0xee,0xed,0xe0,0xfd,
    0xd8,0xd5,0xf2,0xf9,0xd9,0xd6,0x20,0xa1,0x9a,0x9f,0x9c,0x92,0xaa,0x97,0x98,0xa6,
    0xaf,0xa9,0xb8,0xb3,0xb0,0xb7,0x9e,0xa0,0x9d,0xa4,0x96,0xa5,0xab,0xa3,0x9b,0xbd,
    0xa2,0xbb,0x99,0x82,0x87,0x8c,0xbc,0xa7,0xac,0x91,0x93,0x94,0x95,0xb4,0xb5,0xb6,
    0xae,0xad,0xba,0xb2,0xb9,0xa8,0xb1,0x83,0x88,0x8d,0x86,0x84,0x89,0x8e,0xbf,0x85,
    0x8a,0x8f,0xbe,0x81,0x8b,0x90,0x7f,0x11,0x12,0x13,0x14,0x15,0x16,0x60,0x61,0x62,
    0x63,0x64,0x65,0x66,0x67,0x68,0x70,0x71,0x72,0x73,0x74,0x75,0x76,0x77,0x78,0x79,
    0x7a,0x7b,0x7c,0x7d,0x7e,0x69,0xf5,0x3a,0x02,0xe0,0x07,0x30,0xfa,0x3a,0x02,0xe0,
    0x07,0x38,0xfa,0xf1,0xc9,0xf5,0xc5,0xd5,0xe5,0x47,0xcd,0xb1,0x0f,0x70,0x2a,0x71,
    0x11,0x7d,0xfe,0x27,0xc2,0x90,0x0e,0x5c,0x16,0x00,0x21,0x73,0x11,0x19,0x7e,0xb7,
    0xc2,0x90,0x0e,0x23,0x36,0x01,0x23,0x36,0x00,0xc3,0x90,0x0e,0xf5,0xc5,0xd5,0xe5,
    0x47,0xe6,0xf0,0xfe,0xc0,0x20,0x7f,0xa8,0xfe,0x0d,0xca,0x8b,0x0f,0xfe,0x0b,0x30,
    0x75,0x26,0x0e,0x6f,0x6e,0xe9,0x21,0x34,0x10,0x7e,0x2f,0x77,0xc3,0xee,0x07,0x00,
    0x32,0x74,0x84,0x90,0xae,0xbf,0xc5,0xf8,0x0b,0xe1,0xf2,0xc3,0x49,0x0f,0x21,0x00,
    0x12,0x01,0xbe,0x00,0xcd,0xd8,0x0f,0x0d,0x20,0xfa,0x11,0x21,0x0e,0xdf,0xc3,0x3e,
    0x00,0x52,0x41,0x4d,0x20,0x43,0x4c,0x52,0x0d,0x21,0x9d,0x11,0x18,0xcb,0x00,0xc3,
    0x7d,0x08,0xcd,0x96,0x01,0xaf,0x32,0x03,0xe0,0x01,0xc0,0x03,0x11,0x00,0xd0,0x21,
    0x28,0xd0,0xed,0xb0,0xeb,0x06,0x28,0xcd,0xd8,0x0f,0x01,0x1a,0x00,0x11,0x73,0x11,
    0x21,0x74,0x11,0xed,0xb0,0x36,0x00,0x3a,0x73,0x11,0xb7,0xc2,0x6a,0x0e,0xcd,0x96,
    0x01,0x3e,0x01,0x32,0x03,0xe0,0xc3,0xde,0x0f,0x00,0x2a,0x71,0x11,0x25,0x22,0x71,
    0x11,0xc3,0x39,0x0e,0x2a,0x71,0x11,0x7c,0xfe,0x18,0xca,0x32,0x0e,0x24,0x22,0x71,
    0x11,0xc3,0xde,0x0f,0x2a,0x71,0x11,0x7c,0xb7,0xca,0xde,0x0f,0x25,0xc3,0x7e,0x0e,
    0x2a,0x71,0x11,0x7d,0xfe,0x27,0xd2,0x9d,0x0e,0x2c,0xc3,0x7e,0x0e,0x2e,0x00,0x24,
    0x7c,0xfe,0x19,0xda,0x7e,0x0e,0x26,0x18,0x22,0x71,0x11,0xc3,0x32,0x0e,0x2a,0x71,
    0x11,0x7d,0xb7,0x28,0x04,0x2d,0xc3,0x7e,0x0e,0x2e,0x27,0x25,0xf2,0x7e,0x0e,0x21,
    0x00,0x00,0xc3,0x7e,0x0e,0xcd,0xa6,0x0d,0x0e,0x19,0x21,0x00,0xd0,0x06,0x28,0xcd,
    0xd8,0x0f,0x0d,0xc2,0xcd,0x0e,0x21,0x73,0x11,0x06,0x1b,0xcd,0xd8,0x0f,0xc3,0xbf,
    0x0e,0x21,0x70,0x11,0xaf,0xbe,0x18,0x01,0x3c,0x77,0xd6,0x06,0x2f,0x32,0x03,0xe0,
    0x18,0x8f,0x21,0x70,0x11,0xaf,0x18,0xf0,0x2a,0x71,0x11,0x7c,0xb5,0xca,0xde,0x0f,
    0x7d,0xb7,0x20,0x16,0x5c,0x16,0x00,0x21,0x73,0x11,0x19,0x7e,0xb7,0x20,0x0b,0xcd,
    0xb1,0x0f,0xcd,0xa6,0x0d,0x2b,0x36,0x00,0x18,0x94,0x2a,0x71,0x11,0x5c,0x1c,0x16,
    0x00,0x21,0x73,0x11,0x19,0x7e,0x47,0xb7,0x3e,0x28,0x28,0x02,0x3e,0x50,0x2a,0x71,
    0x11,0x95,0x4f,0x06,0x00,0xcd,0xb1,0x0f,0xe5,0xd1,0x1b,0xcd,0xa6,0x0d,0xed,0xb0,
    0x18,0xd3,0xcd,0xf4,0x00,0xc3,0xee,0x07,0x00,0x2a,0x71,0x11,0x5c,0x1c,0x16,0x00,
    0x21,0x73,0x11,0x19,0x7e,0xb7,0x0e,0x00,0x2a,0x71,0x11,0x2e,0x27,0x28,0x02,0x24,
    0x0c,0xcd,0xb4,0x0f,0x7e,0xb7,0xc2,0xde,0x0f,0xe5,0x2a,0x71,0x11,0x3e,0x27,0x95,
    0x47,0x79,0xb7,0x28,0x04,0x3e,0x28,0x80,0x47,0xd1,0xd5,0xe1,0x2b,0xcd,0xa6,0x0d,
    0x7e,0x12,0x36,0x00,0x2b,0x1b,0x10,0xf8,0xc3,0xde,0x0f,0x2a,0x71,0x11,0x5c,0x1c,
    0x16,0x00,0x21,0x73,0x11,0x19,0x7e,0xb7,0x2a,0x71,0x11,0xca,0x9d,0x0e,0x2e,0x00,
    0x7c,0xfe,0x17,0x28,0x05,0x24,0x24,0xc3,0x7e,0x0e,0x24,0x22,0x71,0x11,0xc3,0x32,
    0x0e,0x2a,0x71,0x11,0xc5,0xd5,0xe5,0xc1,0x11,0x28,0x00,0x21,0xd8,0xcf,0x19,0x05,
    0xf2,0xbe,0x0f,0x06,0x00,0x09,0xd1,0xc1,0xc9,0x21,0x03,0xe0,0x36,0x8a,0x36,0x07,
    0x36,0x05,0x3e,0x01,0x32,0x03,0xe0,0xc9,0xaf,0x77,0x23,0x10,0xfc,0xc9,0xe1,0xd1,
    0xc1,0xf1,0xc9,0x3e,0x3a,0xd7,0x2a,0x04,0x11,0xcd,0xba,0x03,0xeb,0x2a,0x02,0x11,
    0x19,0x2b,0xcd,0xf8,0x0f,0x2a,0x06,0x11,0x3e,0x2d,0xd7,0xcd,0xba,0x03,0xaf,0xff];

},{"../Z80/memory-block.js":16}],6:[function(require,module,exports){
var MZ_DataRecorder = function(motorCallback) {
    this._m_on = false;
    this._play = false;
    this._rec = false;
    this._motor = false;
    this._wdata = null;
    this._twdata = null;
    this._rbit = null;
    this._trdata = null;
    this._cmt = null;
    this._pos = 0;
    this._motorCallback = motorCallback;
    this._readTopBlank = 0;
};

MZ_DataRecorder.RDATA_TOP_BLANK_LEN = 1;
MZ_DataRecorder.RDATA_CYCLE_HI_LONG = 1500;
MZ_DataRecorder.RDATA_CYCLE_HI_SHORT = 700;
MZ_DataRecorder.RDATA_CYCLE_LO = 700;

MZ_DataRecorder.prototype.isCmtSet = function() {
    return (this._cmt != null);
};

/**
 * Retrieves magnetic data, if a tape is set.
 * @returns {Buffer|null} pseudo magnetic data.
 */
MZ_DataRecorder.prototype.getCmt = function() {
    return this._cmt;
};

MZ_DataRecorder.prototype.setCmt = function(cmt) {
    var m = this.motor();
    if(m) {
        this.stop();
    }
    this._cmt = cmt;
    this._pos = 0;
    this._twdata = null;
    this._rbit = null;
    this._trdata = null;
    this._readTopBlank = 0;
};

MZ_DataRecorder.prototype.play = function() {
    var m = this.motor();
    if(this._cmt != null) {
        this._play = true;
    }
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
};

MZ_DataRecorder.prototype.rec = function() {
    var m = this.motor();
    if(this._cmt != null) {
        this._play = true;
        this._rec = true;
    }
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
};

MZ_DataRecorder.prototype.stop = function() {
    var m = this.motor();
    this._play = false;
    this._rec = false;
    if(m && !this.motor()) {
        this._motorCallback(false);
    }
};

MZ_DataRecorder.prototype.ejectCmt = function() {
    this.stop();
    var cmt = this._cmt;
    this._cmt = null;
    this._pos = 0;
    this._twdata = null;
    this._rbit = null;
    this._trdata = null;
    this._readTopBlank = 0;
    return cmt;
};

MZ_DataRecorder.prototype.m_on = function(state) {
    var m = this.motor();
    if(!this._m_on && state) {
        this._motor = !this._motor;
    }
    this._m_on = state;
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
    if(m && !this.motor()) {
        this._motorCallback(false);
    }
};

MZ_DataRecorder.prototype.motor = function() {
    return this._cmt != null && this._play && this._motor;
};

MZ_DataRecorder.prototype.wdata = function(wdata, tick) {
    if(this.motor() && this._rec) {
        if(this._wdata != wdata) {
            this._wdata = wdata;
            if(wdata) {
                this._twdata = tick;
            } else {
                if(this._twdata == null) {
                    this._twdata = tick;
                }
                var bit = (tick - this._twdata > 1400);
                if(this._pos < this._cmt.length) {
                    this._cmt[this._pos] = bit;
                    this._pos++;
                } else {
                    this._cmt.push(bit);
                    this._pos = this._cmt.length;
                }
            }
        }
    }
};

MZ_DataRecorder.prototype.rdata = function(tick) {
    if(this.motor()) {
        if(this._pos < this._cmt.length) {

            // Simulate blank reagion at the top of CMT
            if(this._pos == 0) {
                if(this._readTopBlank <
                        MZ_DataRecorder.RDATA_TOP_BLANK_LEN)
                {
                    ++this._readTopBlank;
                    return false;
                }
            }

            // Stop motor at the end of tape
            if(this._pos >= this._cmt.length) {
                console.log("MZ_DataRecorder stopped at the end of CMT.");
                this.stop();
                return false;
            }

            // Retrieve next bit
            if(this._rbit == null) {
                this._rbit = this._cmt[this._pos];
                this._pos++;
                this._trdata = tick;
            }
            // reading bit 0
            //
            //     _|~~~~~~~|_______
            //     
            //     H: 700 cycle
            //     L: 700 cycle
            //
            // reading bit 1:
            //
            //     _|~~~~~~~~~~~~~~~|_______
            //     
            //     H: 1500 cycle
            //     L: 700  cycle
            //
            var ticks_high = (this._rbit ?
                    MZ_DataRecorder.RDATA_CYCLE_HI_LONG :
                    MZ_DataRecorder.RDATA_CYCLE_HI_SHORT);
            var ticks = tick - this._trdata;
            if(ticks >= ticks_high + MZ_DataRecorder.RDATA_CYCLE_LO) {
                this._rbit = null;
            }
            var signal = (ticks < ticks_high);
            return signal;
        }
    }
    return null;
};

module.exports = MZ_DataRecorder;

},{}],7:[function(require,module,exports){
var MZ_TapeHeader = function(buf, offset) {
    var arrayToString = function(arr, start, end) {
        var s = "";
        for(var i = start; i < end; i++) {

            // End by CR
            if(arr[i] == 0x0d) {
                break;
            }

            // Add char except null.
            if(arr[i] != 0) {
                s += String.fromCharCode(arr[i]);
            }

        }
        return s;
    };
    var readArrayUInt8 = function(arr, offset) {
        return (0xff & arr[offset]);
    };
    var readArrayUInt16LE = function(arr, offset) {
        return (0xff & arr[offset]) + (0xff & arr[offset + 1]) * 256;
    };
    // header 128 bytes
    //      00h     attribute
    //      01h-11h filename
    //      12h-13h file size
    //      14h-15h address to load
    //      16h-17h execution address
    //      18h-7Fh patch and zero pad
    this.attr = readArrayUInt8(buf, offset + 0);
    var filename = arrayToString(buf, offset + 0x01, offset + 0x12);
    this.filename = filename;
    this.file_size = readArrayUInt16LE(buf, offset + 0x12);
    this.addr_load = readArrayUInt16LE(buf, offset + 0x14);
    this.addr_exec = readArrayUInt16LE(buf, offset + 0x16);
    var header_buffer = [];
    for(var i = 0; i < 128; i++) {
        header_buffer.push(buf[offset + i]);
    }
    this.buffer = header_buffer;
};

MZ_TapeHeader.createNew = function() {
    var buf = new Array(128);
    for(var i = 0; i < 128; i++) {
        buf[i] = 0;
    }
    buf[0] = 1;
    return new MZ_TapeHeader(buf, 0);
};

MZ_TapeHeader.prototype.setFilename = function(filename) {

    // Limit 16 char length
    if(filename.length > 0x10) {
        filename = filename.substr(0, 0x10);
    }

    // Save to the field
    this.filename = filename;

    var i;

    // Clear buffer by null
    for(i = 0; i <= 0x10; i++) {
        this.buffer[0x01 + i] = 0;
    }

    // Add CR as end mark
    filename += "\r";

    // Copy its character codes to the buffer with CR
    for(i = 0; i < filename.length; i++) {
        this.buffer[0x01 + i] = (filename.charCodeAt(i) & 0xff);
    }
};

MZ_TapeHeader.prototype.setFilesize = function(filesize) {
    this.file_size = filesize
    this.buffer[0x12] = ((filesize >> 0) & 0xff);
    this.buffer[0x13] = ((filesize >> 8) & 0xff);
};

MZ_TapeHeader.prototype.setAddrLoad = function(addr) {
    this.addr_load = addr;
    this.buffer[0x14] = ((addr >> 0) & 0xff);
    this.buffer[0x15] = ((addr >> 8) & 0xff);
};

MZ_TapeHeader.prototype.setAddrExec = function(addr) {
    this.addr_exec = addr;
    this.buffer[0x16] = ((addr >> 0) & 0xff);
    this.buffer[0x17] = ((addr >> 8) & 0xff);
};

MZ_TapeHeader.prototype.getHeadline = function() {
    return [
        ";======================================================",
        "; attribute :   " + this.attr.HEX(2) + "H",
        "; filename  :   '" + this.filename + "'",
        "; filesize  :   " + this.file_size + " bytes",
        "; load addr :   " + this.addr_load.HEX(4) + "H",
        "; start addr:   " + this.addr_exec.HEX(4) + "H",
        ";======================================================"
        ].join("\n");
};
module.exports = MZ_TapeHeader;

},{}],8:[function(require,module,exports){
var MZ_TapeHeader = require('./mz-tape-header');
var MZ_Tape = function(tapeData) {
    this._index = 0;
    this._tapeData = tapeData;
};

MZ_Tape.prototype.isThereSignal = function(signal, n) {
    for(var i = 0; i < n; i++) {
        if(this._tapeData[this._index + i] != signal) {
            return false;
        }
    }
    this._index += n;
    return true;
};

MZ_Tape.prototype.recognizeStartingMark = function() {
    // START MARK
    if(!this.isThereSignal(false, 11000)) {
        return false;
    }
    if(!this.isThereSignal(true, 40)) {
        return false;
    }
    if(!this.isThereSignal(false, 40)) {
        return false;
    }
    if(!this.isThereSignal(true, 1)) {
        return false;
    }
    return true;
};

MZ_Tape.prototype.recognizeStarting2Mark = function() {
    // START MARK
    if(!this.isThereSignal(false, 2750)) {
        return false;
    }
    if(!this.isThereSignal(true, 20)) {
        return false;
    }
    if(!this.isThereSignal(false, 20)) {
        return false;
    }
    if(!this.isThereSignal(true, 1)) {
        return false;
    }
    return true;
};

MZ_Tape.prototype.readSignal = function() {
    if(this._index < this._tapeData.length) {
        return this._tapeData[this._index++];
    }
    return null;
};

MZ_Tape.prototype.writeSignal = function(signal) {
    this._tapeData.push(signal);
};

MZ_Tape.prototype.writeByte = function(data) {
    this.writeSignal(true);
    for(var j = 0; j < 8; j++) {
        if((data & (0x01 << (7 - j))) != 0) {
            this.writeSignal(true);
        } else {
            this.writeSignal(false);
        }
    }
};

MZ_Tape.prototype.writeBlock = function(data) {
    data.forEach(function(d) {
        this.writeByte(d);
    }, this);
    var cs = this.countOnBit(data);
    this.writeByte((cs >> 8) & 0xff);
    this.writeByte((cs >> 0) & 0xff);
    this.writeSignal(true);
};

MZ_Tape.prototype.writeDuplexBlock = function(data) {
    this.writeBlock(data);
    for(var i = 0; i < 256; i++) {
        this.writeSignal(false);
    }
    this.writeBlock(data);
};

MZ_Tape.prototype.readByte = function() {

    //fast forward to starting bit
    var startBit = null;
    do {
        startBit = this.readSignal();
        if(startBit == null) {
            return null; // End Of Stream
        }
        if(!startBit) {
            throw "NO START BIT";
        }
    } while(!startBit);

    // Read 8 bits and build 1 byte.
    // The bits are read from MSB to LSB.
    var buf = 0x00;
    for(var i = 0; i < 8; i++) {
        var bit = this.readSignal();
        if(bit == null) {
            return null;
        } else if(bit) {
            buf |= (0x01 << (7 - i));
        }
    }
    return buf;
};

MZ_Tape.prototype.readBytes = function(n) {
    var buf = [];
    for(var i = 0; i < n; i++) {
        var data = this.readByte();
        if(data == null) {
            break;
        }
        buf.push(data);
    }
    return buf;
};

MZ_Tape.prototype.countOnBit = function(blockBytes) {
    var onBitCount = 0;
    var bitno = [0,1,2,3,4,5,6,7];
    blockBytes.forEach(function(data) {
        bitno.forEach(function(n) {
            if((data & (1 << n)) != 0) {
                onBitCount++;
            }
        });
    });
    onBitCount &= 0xffff;
    return onBitCount;
};

MZ_Tape.prototype.readBlock = function(n) {

    // Read block bytes
    var blockBytes = this.readBytes(n);

    // read 2 bytes of checksum
    var checkBytes = this.readBytes(2);
    if(checkBytes.length != 2) {
        throw "NO BLOCK CHECKSUM";
    }
    var checksum = (checkBytes[0] * 256) + checkBytes[1];

    // Read block end signal(long)
    if(!this.isThereSignal(true,1)) {
        throw "NO BLOCK END BIT";
    }

    var onBitCount = this.countOnBit(blockBytes);
    if(onBitCount != checksum) {
        throw "CHECKSUM ERROR";
    }
    return blockBytes;
};

MZ_Tape.prototype.readDuplexBlocks = function(n) {
    var bytes = this.readBlock(n);
    if(bytes == null) {
        throw "FAIL TO READ BLOCK[1]";
    }

    // Block delimitor
    if(!this.isThereSignal(false, 256)) {
        throw "NO DELIMITOR: Short x 256.";
    }

    var bytes2 = this.readBlock(n);
    if(bytes2 == null) {
        throw "FAIL TO READ BLOCK[2]";
    }

    //Check each bytes
    for(var i = 0; i < bytes.length; i++) {
        if(bytes[i] != bytes2[i]) {
            throw "FAIL TO VERIFY BLOCK 1 and 2";
        }
    }
    return bytes;
};

MZ_Tape.prototype.readHeader = function() {

    // Header starting block
    if(!this.recognizeStartingMark()) {
        throw "NO STARTING MARK recognized";
    }

    // MZT header
    var mztBytes = this.readDuplexBlocks(128);
    if(mztBytes == null) {
        throw "CANNOT READ MZT HEADER";
    }

    return new MZ_TapeHeader(mztBytes, 0);
};

MZ_Tape.prototype.readDataBlock = function(n) {
    // Data starting mark
    if(!this.recognizeStarting2Mark()) {
        throw "NO STARTING MARK 2 recognized";
    }
    // Read duplexed data bytes
    return this.readDuplexBlocks(n);
};

MZ_Tape.toBytes = function(bits) {
    try {
        var reader = new MZ_Tape(bits);

        var header = reader.readHeader();
        if(header == null) {
            throw "FAIL TO READ HEADER";
        }
        var body = reader.readDataBlock(header.file_size);
        if(body == null) {
            throw "FAIL TO READ DATA";
        }

        var extra = [];
        var nonZeroRead = true;
        var extraByte;
        while(nonZeroRead) {
            extraByte = reader.readByte();
            nonZeroRead = (extraByte ? true : false);
            if(nonZeroRead) {
                console.warn(
                        "MZ_Tape.toBytes rest bytes["
                        + extraByte.length + "] =",
                        extraByte.HEX(2));
                extra.push(extraByte);
            }
        }

        //MZT + body
        return header.buffer.concat(body);
    } catch(err) {
        console.log("MZ_Tape.toBytes:Error " + err);
    }
    return [];
};

MZ_Tape.fromBytes = function(bytes) {
    if(bytes.length < 128) {
        throw "FAIL TO WRITE HEADER";
    }
    var header = new MZ_TapeHeader(bytes.slice(0,128), 0);
    var writer = new MZ_Tape([]);
    writer.writeHeader(header.buffer);
    writer.writeDataBlock(bytes.slice(128));
    return writer._tapeData;
};

MZ_Tape.prototype.outputStartingMark = function() {
    var i;

    // START MARK
    for(i = 0; i < 11000; i++) {
        this.writeSignal(false);
    }
    for(i = 0; i < 40; i++) {
        this.writeSignal(true);
    }
    for(i = 0; i < 40; i++) {
        this.writeSignal(false);
    }
    this.writeSignal(true);
};

MZ_Tape.prototype.writeHeader = function(buffer) {
    this.outputStartingMark();
    this.writeDuplexBlock(buffer);
};

MZ_Tape.prototype.writeStarting2Mark = function() {
    var i;

    // Body mark
    for(i = 0; i < 2750; i++) {
        this.writeSignal(false);
    }
    for(i = 0; i < 20; i++) {
        this.writeSignal(true);
    }
    for(i = 0; i < 20; i++) {
        this.writeSignal(false);
    }
    this.writeSignal(true);

};
MZ_Tape.prototype.writeDataBlock = function(buffer) {
    // Data starting mark
    this.writeStarting2Mark();
    this.writeDuplexBlock(buffer);
};

module.exports = MZ_Tape;

},{"./mz-tape-header":7}],9:[function(require,module,exports){
(function() {
    //
    // MZ-700 Key Matrix
    //
    function MZ700KeyMatrix() {
        this.keymap = new Array(10);
        for(var i = 0; i < this.keymap.length; i++) {
            this.keymap[i] = 0xff;
        }
    }

    MZ700KeyMatrix.prototype.getKeyData = function(strobe) {
        var keydata = 0xff;
        strobe &= 0x0f;
        if(strobe < this.keymap.length) {
            keydata = this.keymap[strobe];
        }
        return keydata;
    };

    MZ700KeyMatrix.prototype.setKeyMatrixState = function(strobe, bit, state) {
        if(state) {
            // clear bit
            this.keymap[strobe] &= ((~(1 << bit)) & 0xff);
        } else {
            // set bit
            this.keymap[strobe] |= ((1 << bit) & 0xff);
        }
    };

    MZ700KeyMatrix.KeyCodes = {
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
    var mzkey = function(strobe, bit, face, code, strcode) {
        this.strobe = strobe;
        this.bit = bit;
        this.face = face || "&nbsp;";
        this.code = code || [];
        this.strcode = strcode || face;
    }
    MZ700KeyMatrix.Keys = [
        new mzkey(0,0,"CR",     [MZ700KeyMatrix.KeyCodes.Enter]),
        new mzkey(0,1,":",      [MZ700KeyMatrix.KeyCodes.Colon]),
        new mzkey(0,2,";",      [MZ700KeyMatrix.KeyCodes.SemiColon]),
        new mzkey(0,3),
        new mzkey(0,4,"英数",   [MZ700KeyMatrix.KeyCodes.F10, MZ700KeyMatrix.KeyCodes.End], "ALNUM"),
        new mzkey(0,5,"=",      [MZ700KeyMatrix.KeyCodes.Backspace]),
        new mzkey(0,6,"GRAPH",  [MZ700KeyMatrix.KeyCodes.F12, MZ700KeyMatrix.KeyCodes.PageDown, MZ700KeyMatrix.KeyCodes.Altername], "GRAPH"),
        new mzkey(0,7,"カナ",   [MZ700KeyMatrix.KeyCodes.F11, MZ700KeyMatrix.KeyCodes.PageUp], "KANA"),
        new mzkey(1,0),
        new mzkey(1,1),
        new mzkey(1,2),
        new mzkey(1,3,")",      [MZ700KeyMatrix.KeyCodes.CloseBrackets]),
        new mzkey(1,4,"(",      [MZ700KeyMatrix.KeyCodes.OpenBrackets]),
        new mzkey(1,5,"@",      [MZ700KeyMatrix.KeyCodes.Atmark]),
        new mzkey(1,6,"Z",      [MZ700KeyMatrix.KeyCodes.Z]),
        new mzkey(1,7,"Y",      [MZ700KeyMatrix.KeyCodes.Y]),
        new mzkey(2,0,"X",      [MZ700KeyMatrix.KeyCodes.X]),
        new mzkey(2,1,"W",      [MZ700KeyMatrix.KeyCodes.W]),
        new mzkey(2,2,"V",      [MZ700KeyMatrix.KeyCodes.V]),
        new mzkey(2,3,"U",      [MZ700KeyMatrix.KeyCodes.U]),
        new mzkey(2,4,"T",      [MZ700KeyMatrix.KeyCodes.T]),
        new mzkey(2,5,"S",      [MZ700KeyMatrix.KeyCodes.S]),
        new mzkey(2,6,"R",      [MZ700KeyMatrix.KeyCodes.R]),
        new mzkey(2,7,"Q",      [MZ700KeyMatrix.KeyCodes.Q]),
        new mzkey(3,0,"P",      [MZ700KeyMatrix.KeyCodes.P]),
        new mzkey(3,1,"O",      [MZ700KeyMatrix.KeyCodes.O]),
        new mzkey(3,2,"N",      [MZ700KeyMatrix.KeyCodes.N]),
        new mzkey(3,3,"M",      [MZ700KeyMatrix.KeyCodes.M]),
        new mzkey(3,4,"L",      [MZ700KeyMatrix.KeyCodes.L]),
        new mzkey(3,5,"K",      [MZ700KeyMatrix.KeyCodes.K]),
        new mzkey(3,6,"J",      [MZ700KeyMatrix.KeyCodes.J]),
        new mzkey(3,7,"I",      [MZ700KeyMatrix.KeyCodes.I]),
        new mzkey(4,0,"H",      [MZ700KeyMatrix.KeyCodes.H]),
        new mzkey(4,1,"G",      [MZ700KeyMatrix.KeyCodes.G]),
        new mzkey(4,2,"F",      [MZ700KeyMatrix.KeyCodes.F]),
        new mzkey(4,3,"E",      [MZ700KeyMatrix.KeyCodes.E]),
        new mzkey(4,4,"D",      [MZ700KeyMatrix.KeyCodes.D]),
        new mzkey(4,5,"C",      [MZ700KeyMatrix.KeyCodes.C]),
        new mzkey(4,6,"B",      [MZ700KeyMatrix.KeyCodes.B]),
        new mzkey(4,7,"A",      [MZ700KeyMatrix.KeyCodes.A]),
        new mzkey(5,0,"8",      [MZ700KeyMatrix.KeyCodes.D8, MZ700KeyMatrix.KeyCodes.NumPad8]),
        new mzkey(5,1,"7",      [MZ700KeyMatrix.KeyCodes.D7, MZ700KeyMatrix.KeyCodes.NumPad7]),
        new mzkey(5,2,"6",      [MZ700KeyMatrix.KeyCodes.D6, MZ700KeyMatrix.KeyCodes.NumPad6]),
        new mzkey(5,3,"5",      [MZ700KeyMatrix.KeyCodes.D5, MZ700KeyMatrix.KeyCodes.NumPad5]),
        new mzkey(5,4,"4",      [MZ700KeyMatrix.KeyCodes.D4, MZ700KeyMatrix.KeyCodes.NumPad4]),
        new mzkey(5,5,"3",      [MZ700KeyMatrix.KeyCodes.D3, MZ700KeyMatrix.KeyCodes.NumPad3]),
        new mzkey(5,6,"2",      [MZ700KeyMatrix.KeyCodes.D2, MZ700KeyMatrix.KeyCodes.NumPad2]),
        new mzkey(5,7,"1",      [MZ700KeyMatrix.KeyCodes.D1, MZ700KeyMatrix.KeyCodes.NumPad1]),
        new mzkey(6,0,".",      [MZ700KeyMatrix.KeyCodes.Decimal, 110]),
        new mzkey(6,1,",",      [MZ700KeyMatrix.KeyCodes.Comma]),
        new mzkey(6,2,"9",      [MZ700KeyMatrix.KeyCodes.D9, MZ700KeyMatrix.KeyCodes.NumPad9]),
        new mzkey(6,3,"0",      [MZ700KeyMatrix.KeyCodes.D0, MZ700KeyMatrix.KeyCodes.NumPad0]),
        new mzkey(6,4,"SPC",    [MZ700KeyMatrix.KeyCodes.Space], " "),
        new mzkey(6,5,"-",      [MZ700KeyMatrix.KeyCodes.Subtract, MZ700KeyMatrix.KeyCodes.NumPadSubtract]),
        new mzkey(6,6,"+",      [MZ700KeyMatrix.KeyCodes.Caret, MZ700KeyMatrix.KeyCodes.NumPadPlus]),
        new mzkey(6,7,"*",      [MZ700KeyMatrix.KeyCodes.Yen, MZ700KeyMatrix.KeyCodes.NumPadMultiply]),
        new mzkey(7,0,"/",      [MZ700KeyMatrix.KeyCodes.Divide, MZ700KeyMatrix.KeyCodes.NumPadDivide]),
        new mzkey(7,1,"?",      [MZ700KeyMatrix.KeyCodes.Backslash]),
        new mzkey(7,2,"←",     [MZ700KeyMatrix.KeyCodes.Left], "LEFT"),
        new mzkey(7,3,"→",     [MZ700KeyMatrix.KeyCodes.Right], "RIGHT"),
        new mzkey(7,4,"↓",     [MZ700KeyMatrix.KeyCodes.Down], "DOWN"),
        new mzkey(7,5,"↑",     [MZ700KeyMatrix.KeyCodes.Up], "UP"),
        new mzkey(7,6,"DEL",    [MZ700KeyMatrix.KeyCodes.Delete]),
        new mzkey(7,7,"INS",    [MZ700KeyMatrix.KeyCodes.Insert]),
        new mzkey(8,0,"SHIFT",  [MZ700KeyMatrix.KeyCodes.Shift]),
        new mzkey(8,1,"(BS)"),
        new mzkey(8,2),
        new mzkey(8,3,"(→)",   [MZ700KeyMatrix.KeyCodes.Tab]),
        new mzkey(8,4,"(CR)"),
        new mzkey(8,5,"(SHIFT)"),
        new mzkey(8,6,"CTRL",   [MZ700KeyMatrix.KeyCodes.Control]),
        new mzkey(8,7,"BREAK",  [MZ700KeyMatrix.KeyCodes.Escape,MZ700KeyMatrix.KeyCodes.Pause]),
        new mzkey(9,0,"HOME",   [MZ700KeyMatrix.KeyCodes.Home]),
        new mzkey(9,1,"(SPC)"),
        new mzkey(9,2,"(↓)"),
        new mzkey(9,3,"F5",     [MZ700KeyMatrix.KeyCodes.F5]),
        new mzkey(9,4,"F4",     [MZ700KeyMatrix.KeyCodes.F4]),
        new mzkey(9,5,"F3",     [MZ700KeyMatrix.KeyCodes.F3]),
        new mzkey(9,6,"F2",     [MZ700KeyMatrix.KeyCodes.F2]),
        new mzkey(9,7,"F1",     [MZ700KeyMatrix.KeyCodes.F1])
    ];
    MZ700KeyMatrix.KeyNames = (function(obj) {
        Object.keys(MZ700KeyMatrix.KeyCodes).forEach(function(name) {
            var code = MZ700KeyMatrix.KeyCodes[name];
            obj[code] = name;
        });
        return obj;
    }({}));
    MZ700KeyMatrix.Code2Key = (function() {
        var code2key = new Array(256);
        MZ700KeyMatrix.Keys.forEach(function(key) {
            key.code.forEach(function(code) {
                code2key[code] = key;
            });
        });
        return code2key;
    })();
    MZ700KeyMatrix.Str2Key = (function() {
        var s2key = {};
        MZ700KeyMatrix.Keys.forEach(function(key) {
            s2key[key.strcode] = key;
        });
        return s2key;
    })();
    module.exports = MZ700KeyMatrix;
}());

},{}],10:[function(require,module,exports){
(function() {
    var MZ700_Sound = function() {

        this.attackTime = 0.010;
        this.decayTime = 0.010;
        this.sustainLebel = 0.8;
        this.releaseTime = 0.050;

        this.audio = null;
        this.totalGain = null;
        this.gain = 0;
        this.poly = 128;
        this.indexOsc = 0;
        this.oscNodes = new Array(this.poly);
        this.oscGainNodes = new Array(this.poly);

        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        if(window.AudioContext) {
            this.audio = new AudioContext();
            this.totalGainNode = this.audio.createGain();
            this.totalGainNode.gain.value = this.gain;
            this.totalGainNode.connect(this.audio.destination);
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
        if(this.totalGainNode) {
            this.totalGainNode.gain.value = this.gain;
        }
    };
    MZ700_Sound.prototype.startSound = function(freq) {
        if(this.oscGainNodes[this.indexOsc] != null) {
            this.oscGainNodes[this.indexOsc].gain.linearRampToValueAtTime(0.0, this.audio.currentTime + this.releaseTime);
            this.oscGainNodes[this.indexOsc].disconnect();
            this.oscGainNodes[this.indexOsc] = null;
            if(this.oscNodes[this.indexOsc] != null) {
                this.oscNodes[this.indexOsc].stop();
                this.oscNodes[this.indexOsc].disconnect();
                this.oscNodes[this.indexOsc] = null;
            }
        }
        this.oscNodes[this.indexOsc] = this.audio.createOscillator();
        this.oscNodes[this.indexOsc].type = "square";
        this.oscNodes[this.indexOsc].frequency.value = freq;
        this.oscNodes[this.indexOsc].start = this.oscNodes[this.indexOsc].start || this.oscNodes[this.indexOsc].noteOn;

        this.oscGainNodes[this.indexOsc] = this.audio.createGain();
        this.oscGainNodes[this.indexOsc].gain.value = 0.0;
        this.oscGainNodes[this.indexOsc].gain.setValueAtTime(0.0, this.audio.currentTime);
        this.oscGainNodes[this.indexOsc].gain.linearRampToValueAtTime(1.0, this.audio.currentTime + this.attackTime);
        this.oscGainNodes[this.indexOsc].gain.linearRampToValueAtTime(this.sustainLebel, this.audio.currentTime + this.attackTime + this.decayTime);
        this.oscGainNodes[this.indexOsc].connect(this.totalGainNode);

        this.oscNodes[this.indexOsc].connect(this.oscGainNodes[this.indexOsc]);
        this.oscNodes[this.indexOsc].start();

    };
    MZ700_Sound.prototype.stopSound = function() {
        if(this.oscGainNodes[this.indexOsc] != null) {
            this.oscGainNodes[this.indexOsc].gain.linearRampToValueAtTime(0.0, this.audio.currentTime + this.releaseTime);
        }
        this.indexOsc = (this.indexOsc + 1) % this.poly;
    };
    module.exports = MZ700_Sound;
}());

},{}],11:[function(require,module,exports){
/**
 * @fileoverview Z80 assembler class.
 */
var Z80BinUtil = require("./bin-util.js");
var Z80LineAssembler = require("./z80-line-assembler");

/**
 * Z80 Assembler
 *
 * @param {string} asm_source The source code
 * @constructor
 */
var Z80_assemble = function(asm_source) {
    var i;

    if(asm_source == undefined) {
        return;
    }

    //
    // Assemble
    //

    /**
     * Assemble result lines
     * @type {object[]}
     */
    this.list = [];
    /**
     * mapping labels to address
     * @type {object}
     */
    this.label2value = {};

    var address = 0;

    var source_lines = asm_source.split(/\r{0,1}\n/);
    for(i = 0; i < source_lines.length; i++) {
        var assembled_code = Z80LineAssembler.assemble(
                source_lines[i], address, this.label2value);
        address = assembled_code.getNextAddress();
        this.list.push(assembled_code);
    }

    //
    // Resolve address symbols
    //
    for(i = 0; i < this.list.length; i++) {
        this.list[i].resolveAddress(this.label2value);
    }

    //
    // Create machine code array
    //

    // address min-max
    var min_addr = null;
    var max_addr = null;
    this.list.forEach(function(line) {
        if(line.bytecode.length > 0) {
            if(min_addr == null || line.address < min_addr) {
                min_addr = line.address;
            }
            var lastAddr = line.getLastAddress();
            if(max_addr == null || lastAddr > max_addr) {
                max_addr = lastAddr;
            }
        }
    });

    /**
     * A starting address of this assembled codes.
     * @type {number}
     */
    this.min_addr = min_addr;

    /**
     * A binary code as assembling result.
     * @type {number[]}
     */
    this.buffer = new Array(max_addr - min_addr + 1);
    this.list.forEach(function(line) {
        if(line.bytecode.length > 0) {
            Array.prototype.splice.apply(this.buffer, [
                    line.address - min_addr,
                    line.bytecode.length
                ].concat(line.bytecode));
        }
    }, this);
};

Z80_assemble.prototype.parseAddress = function(addrToken) {
    var bytes = Z80LineAssembler.parseNumLiteralPair(addrToken);
    if(bytes == null) {
        return null;
    }
    var H = bytes[1]; if(typeof(H) == 'function') { H = H(this.label2value); }
    var L = bytes[0]; if(typeof(L) == 'function') { L = L(this.label2value); }
    var addr = Z80BinUtil.pair(H,L);
    return addr;
};

/**
 * Returns a address map list.
 *
 * @description
 * Each element of the list is an object that has two fields 'label' and 'address'.
 * The list is sorted by the address.
 *
 * @returns {object[]} array of address map entry
 */
Z80_assemble.prototype.getMap = function() {
    return Object.keys(this.label2value).map(function(label) {
        return { "label": label, "address": this.label2value[label] };
    }, this).sort(function(a,b){ return a.address - b.address; });
};

module.exports = Z80_assemble;

},{"./bin-util.js":12,"./z80-line-assembler":18}],12:[function(require,module,exports){
(function() {
    "use strict";
    module.exports = {
        pair: function(h,l) { return (0xff & h) * 256 + (0xff & l); },
        hibyte: function(nn) { return (0xff & Math.floor(nn / 256)); },
        lobyte: function(nn) { return nn % 256; },
        getSignedByte: function(e) {
            e &= 0xff;
            if(e & 0x80) {
                e = ((~e) & 0xff) + 1;
                return -e;
            }
            return e;
        }
    };
}());

},{}],13:[function(require,module,exports){
"use strict";
var oct = require("../lib/oct");
var MemoryBlock = require("./memory-block.js");
var Z80_Register = require("./register.js");
var Z80BinUtil = require("./bin-util.js");
var Z80LineAssembler = require("./z80-line-assembler");

/**
 * Z80 emulator class.
 *
 * @param {object} opt  The options to create.
 * @constructor
 */
var Z80 = function(opt) {
    opt = opt || { memory: null, };
    this.memory = opt.memory;
	this.createOpecodeTable();
    if(opt.memory == null) {
        this.memory = new MemoryBlock();
        this.memory.create();
    }
    this.IFF1 = 0;
    this.IFF2 = 0;
    this.IM = 0;
    this.HALT = 0;
    this.ioPort = new Array(256);
    for(var i = 0; i < 256; i++) { this.ioPort[i] = 0; }
	this.reg = new Z80_Register();
	this.regB = new Z80_Register();
    this.onReadIoPort = function(/*port*/) {};
    this.onReadIoPort = opt.onReadIoPort || function(/*port, value*/) {};
    this.onWriteIoPort = opt.onWriteIoPort || function(/*port, value*/) {};
    this.bpmap = new Array(0x10000);
    this.tick = 0;
};
Z80.prototype.readIoPort = function(port) {
    var value = this.ioPort[port];
    this.reg.onReadIoPort(value);
    this.onReadIoPort(port, value);
    return value;
};
Z80.prototype.writeIoPort = function(port, value) {
    this.ioPort[port] = value;
    this.onWriteIoPort(port, value);
};
Z80.prototype.reset = function() {
    this.IFF1 = 0;
    this.IFF2 = 0;
    this.IM = 0;
    this.HALT = 0;
    this.reg.clear();
    this.regB.clear();
    this.exec = Z80.prototype.exec;
    this.tick = 0;
};
Z80.prototype.interrupt = function() {
    if(this.IFF1) {
        this.pushPair(this.reg.PC);
        this.reg.PC = 0x0038;
    }
};
Z80.prototype.exec = function() {
    this.reg.R = (this.reg.R + 1) & 255;
    var instruction = this.opecodeTable[this.fetch()];
    var cycle = instruction.proc() || instruction.cycle || 4;
    this.tick += cycle;
    if(this.bpmap[this.reg.PC] != null) {
        console.log("*** BREAK AT $" + this.reg.PC.HEX(4));
        throw "break";
    }
};

Z80.prototype.clearBreakPoints = function() {
    this.bpmap = new Array(0x10000);
    for(var i = 0; i < 0x10000; i++) {
        this.bpmap[i] = null;
    }
};

Z80.prototype.getBreakPoints = function() {
    return this.bpmap;
};

Z80.prototype.removeBreak = function(address, size) {
    for(var i = 0; i < size; i++) {
        this.bpmap[address + i] = null; 
    }
};

Z80.prototype.setBreak = function(address, size) {
    for(var i = 0; i < size; i++) {
        this.bpmap[address + i] = true; 
    }
};

Z80.prototype.fetch = function() {
	var value = this.memory.peek(this.reg.PC);
	this.reg.PC++;
	if(this.reg.PC > 0xffff) {
		this.reg.PC = 0;
	}
    return value;
};

Z80.prototype.fetchPair = function() {
	var value = this.memory.peekPair(this.reg.PC);
	this.reg.PC += 2;
	if(this.reg.PC > 0xffff) {
		this.reg.PC -= 0xffff;
	}
    return value;
};

Z80.prototype.pushPair = function(nn) {
	this.memory.poke(--this.reg.SP, Z80BinUtil.hibyte(nn));
	this.memory.poke(--this.reg.SP, Z80BinUtil.lobyte(nn));
};

Z80.prototype.popPair = function() {
	var lo = this.memory.peek(this.reg.SP++);
	var hi = this.memory.peek(this.reg.SP++);
    return Z80BinUtil.pair(hi, lo);
};

Z80.prototype.incrementAt = function(addr) {
    var preval = this.memory.peek(addr);
    var result = this.reg.getINCValue(preval);
    this.memory.poke(addr, result);
};
Z80.prototype.decrementAt = function(addr) {
    var preval = this.memory.peek(addr);
    var result = this.reg.getDECValue(preval);
    this.memory.poke(addr, result);
};

/**
 * Disassemble
 *
 * fields of result element of array:
 *
 *    * addr                number
 *    * referenced_count    number
 *    * code                number[]
 *    * mnemonic            string[]
 *    * ref_addr_to         number
 *
 * @param {Buffer}  buf     machine code byte buffer
 * @param {number}  offset  start index of the buffer
 * @param {number}  size    buffer size
 * @param {number}  addr    memory address of the offset
 *
 * @returns {object[]}  assembled line data object
 */
Z80.dasm = function (buf, offset, size, addr) {
    offset = offset || 0;
    size = size || buf.length - offset;
    addr = addr || 0;
    if(addr - offset < 0) {
        console.error("Z80.dasm: parameter error : (addr - offset) - out of range");
        return;
    }
    if(size < 0 || offset + size > buf.length) {
        console.error("Z80.dasm: parameter error : size - out of range");
        return;
    }
    var dasmlist = [];
    var memory_block = new MemoryBlock();
    memory_block.create({ startAddr: addr - offset, size: size });
    memory_block.mem = buf;
    var cpu = new Z80({memory: memory_block});
    cpu.reg.PC = memory_block.startAddr;

    var orgInst = Z80LineAssembler.create(
                "ORG",  memory_block.startAddr.HEX(4) + "H");
    orgInst.setAddress(memory_block.startAddr),
    dasmlist.push(orgInst);

    while(cpu.reg.PC < memory_block.startAddr + memory_block.size) {
        var dis = cpu.disassemble(cpu.reg.PC, addr - offset + size);
        dis.setAddress(cpu.reg.PC);
        if(dis.bytecode.length > 0) {
            dis.setComment('; ' + dis.address.HEX(4) + "H " +
                    dis.bytecode.map(function(b) {
                        return b.HEX(2);
                    }).join(" "));
        }
        dasmlist.push( dis );
        cpu.reg.PC += dis.bytecode.length;
    }
    return Z80.processAddressReference(dasmlist);
};

/**
 * Disassemble one operation code of Z80.
 *
 * @param {number} addr The starting address
 * @param {number} last_addr    The last address to assemble.
 * @returns {object} A disassembled result.
 */
Z80.prototype.disassemble = function(addr, last_addr) {
    var disasm = null;
    var errmsg = "";
    var opecode = this.memory.peek(addr);
    try {
        var opecodeEntry = this.opecodeTable[opecode];
        if(opecodeEntry == null) {
            errmsg = "UNKNOWN OPECODE";
        } else if(opecodeEntry.disasm == null) {
            errmsg = "NO DISASSEMBLER";
        } else {
            var dasmEntry = opecodeEntry.disasm(this.memory, addr);
            if(dasmEntry == null) {
                errmsg = "NULL RETURNED";
            } else if(addr + dasmEntry.code.length > last_addr) {
                disasm = null;
            } else {
                disasm = Z80LineAssembler.create(
                    dasmEntry.mnemonic[0],
                    dasmEntry.mnemonic.slice(1).join(","),
                    dasmEntry.code);
                if("ref_addr_to" in dasmEntry) {
                    disasm.setRefAddrTo(dasmEntry.ref_addr_to);
                }
            }
        }
    } catch(e) {
        errmsg = "EXCEPTION THROWN";
    }
    if(disasm == null) {
        disasm = Z80LineAssembler.create(
            "DEFB", opecode.HEX(2) + "H", [opecode]);
        disasm.setComment(";*** DISASSEMBLE FAIL: " + errmsg);
    }
    return disasm;
};

/**
 * Create information of the referenced count.
 * @param {object[]} dasmlist   A result of disassembling.
 * @return {object[]} Same object to parameter.
 */
Z80.processAddressReference = function(dasmlist) {
    var addr2line = {};
    dasmlist.forEach(function(dis, lineno) {
        addr2line[dis.address] = lineno;
    });
    dasmlist.forEach(function(dis, i, arr) {
        if(dis.ref_addr_to != null && dis.ref_addr_to in addr2line) {
            var lineno = addr2line[dis.ref_addr_to];
            arr[lineno].referenced_count++;
        }
    });
    dasmlist.forEach(function(dis, i, arr) {
        if(dis.referenced_count > 0) {
            arr[i].setLabel("$" + dis.address.HEX(4) + "H");
        }
    });
    return dasmlist;
};

Z80.dasmlines = function(dasmlist) {
    return dasmlist.map(function(dis) {
        var addr;
        if(dis.referenced_count > 0) {
            addr = "$" + dis.address.HEX(4) + "H:";
        } else {
            addr = "       ";
        }
        addr += "   ";

        var mne = dis.mnemonic;
        if(mne && dis.operand) {
            while(mne.length < 8) {
                mne += " ";
            }
        }
        var line = addr + '      ' + mne + dis.operand;
        while(line.length < 40) {
            line += ' ';
        }
        if(dis.comment != "") {
            line += dis.comment;
        }

        return line;
    });
};

/*
 * -----------------------------------------------------------------------------------
 * ニーモニック		実行内容					命令コード1	命令コード2	命令コード3	命令コード4
 *										76 543 210	76 543 210	76 543 210	76 543 210
 * -----------------------------------------------------------------------------------
 * 8ビットロードグループ
 * -----------------------------------------------------------------------------------
OK * LD r,n		r<-n					00  r  110	<-  n   ->
OK * LD (BC),A	(BC)<-A					00 000 010
OK * LD A,(BC)	A<-(BC)					00 001 010
OK * LD (DE),A	(DE)<-A					00 010 010
OK * LD A,(DE)	A<-(DE)					00 011 010
OK * LD (nn),A	(nn)<-A					00 110 010	<-  n   ->	<-  n   ->
OK * LD (HL),n	(HL)<-n					00 110 110	<-  n   ->
OK * LD A,(nn)	A<-(nn)					00 111 010	<-  n   ->	<-  n   ->
OK * LD r,r'	r<-r'					01  r   r'
OK * LD r,(HL)	r<-(HL)					01  r  110
OK * LD (HL),r	(HL)<-r					01 110  r 
 
 * LD r,(IX+d)	r<-(IX+d)				11 011 101	01  r  110	<-  d   ->
 * LD (IX+d),r	(IX+d)<-r				11 011 101	01 110  r	<-  d   ->
 * LD (IX+d),n	(IX+d)<-n				11 011 101	00 110 110	<-  d   ->	<-  n   ->
 * LD A,I		A<-I					11 101 101	01 010 111
 * LD A,R		A<-R					11 101 101	01 011 111
 * LD I,A		I<-A					11 101 101	01 000 111
 * LD R,A		R<-A					11 101 101	01 001 111
 * LD (IY+d),n	(IY+d)<-n				11 111 101	00 110 110	<-  d   ->	<-  n   ->
 * LD r,(IY+d)	r<-(IY+d)				11 111 101	01  r  110	<-  d   ->
 * LD (IY+d),r	(IY+d)<-r				11 111 101	01 110  r	<-  d   ->
 * -----------------------------------------------------------------------------------
 * ニーモニック		実行内容					命令コード1	命令コード2	命令コード3	命令コード4
 *										76 543 210	76 543 210	76 543 210	76 543 210
 * -----------------------------------------------------------------------------------
 * 16ビットロードグループ
 * -----------------------------------------------------------------------------------
OK * LD (nn),HL		(nn+1)<-H,(nn)<-L		00 100 010	<-  n   ->	<-  n   ->
OK * LD HL,(nn)		H<-(nn+1),L<-(nn)		00 101 010	<-  n   ->	<-  n   ->
OK * LD dd,nn		dd<-nn					00 dd0 001	<-  n   ->	<-  n   ->
OK * PUSH qq		(SP-2)<-qqL,(SP-1)<-qqH	11 qq0 101
OK * POP qq			qqL<-(SP-2),qqH<-(SP-1)	11 qq0 001
OK * LD SP,HL		SP<-HL					11 111 001

 * LD IX,nn		IX<-nn					11 011 101	00 100 001	<-  n   ->	<-  n   ->
 * LD (nn),IX	(nn+1)<-IXH,(nn)<-IXL	11 011 101	00 100 010	<-  n   ->	<-  n   ->
 * LD IX,(nn)	IXH<-(nn+1),IXL<-(nn)	11 011 101	00 101 010	<-  n   ->	<-  n   ->
 * POP IX		IXL<-(SP-2),IXH<-(SP-1)	11 011 101	11 100 001
 * PUSH IX		(SP-2)<-IXL,(SP-1)<-IXH	11 011 101	11 100 101
 * LD SP,IX		SP<-IX					11 011 101	11 111 001
 * LD (nn),dd	(nn+1)<-ddH,(nn)<-ddL	11 101 101	01 dd0 011	<-  n   ->	<-  n   ->
 * LD dd,(nn)	ddH<-(nn+1),ddL<-(nn)	11 101 101	01 dd1 011	<-  n   ->	<-  n   ->
 * LD IY,nn		IY<-nn					11 111 101	00 100 001	<-  n   ->	<-  n   ->
 * LD (nn),IY	(nn+1)<-IYH,(nn)<-IYL	11 111 101	00 100 010	<-  n   ->	<-  n   ->
 * LD IY,(nn)	IYH<-(nn+1),IYL<-(nn)	11 111 101	00 101 010	<-  n   ->	<-  n   ->
 * POP IY		IYL<-(SP-2),IYH<-(SP-1)	11 111 101	11 100 001
 * PUSH IY		(SP-2)<-IYL,(SP-1)<-IYH	11 111 101	11 100 101
 * LD SP,IY		SP<-IY					11 111 101	11 111 001
 * 				 
 */
Z80.prototype.createOpecodeTable = function() {
	var THIS = this;
	this.opecodeTable = new Array(256);
    var opeIX = new Array(256);
    var opeIY = new Array(256);
    var opeRotate = new Array(256);
    var opeRotateIX = new Array(256);
    var opeRotateIY = new Array(256);
    var opeMisc = new Array(256);
    for(var i = 0; i < 256; i++) {
        this.opecodeTable[i] = {
            mnemonic: null,
            proc: function() { throw "ILLEGAL OPCODE"; },
            disasm: (function(i) { return function(/*mem, addr*/) {
                return {
                    code:[i],
                    mnemonic:["DEFB", i.HEX(2) + "H; *** UNKNOWN OPCODE"]
                };
            }; }(i))
        };
        opeIX[i] = { mnemonic: null,
            proc: (function(i) {
                return function() {
                    throw "ILLEGAL OPCODE DD " + i.HEX(2) + " for IX command subset";
                };
            }(i)),
            disasm: (function(i) { return function(/*mem, addr*/) {
                return {
                    code:[0xDD],
                    mnemonic:["DEFB", "DDh; *** UNKNOWN OPCODE " + i.HEX(2) + "H"]
                };
            }; }(i))
        };
        opeIY[i] = {
            mnemonic: null,
            proc: (function(i) {
                return function() {
                    throw "ILLEGAL OPCODE FD " + i.HEX(2) + " for IY command subset";
                }
            }(i)),
            disasm: (function(i) { return function(/*mem, addr*/) {
                return {
                    code:[0xFD],
                    mnemonic:["DEFB", "FDh; *** UNKNOWN OPCODE " + i.HEX(2) + "H"]
                };
            }; }(i))
        };
        opeRotate[i] = {
            mnemonic: null,
            proc: (function(i) {
                return function() {
                    throw "ILLEGAL OPCODE CB " + i.HEX(2) + " for Rotate command subset";
                };
            }(i)),
            disasm: (function(i) { return function(/*mem, addr*/) {
                return {
                    code:[0xCB],
                    mnemonic:["DEFB", "CBh; *** UNKNOWN OPCODE " + i.HEX(2) + "H"]
                };
            }; }(i))
        };
        opeRotateIX[i] = {
            mnemonic: null,
            proc: (function(i) {
                return function() {
                    throw "ILLEGAL OPCODE DD CB " + i.HEX(2) + " for Rotate IX command subset";
                }
            }(i)),
            disasm: (function(i) { return function(/*mem, addr*/) {
                return {
                    code:[0xDD, 0xCB],
                    mnemonic:["DEFW", "CBDDh; *** UNKNOWN OPCODE " + i.HEX(2) + "H"]
                };
            }; }(i))
        };
        opeRotateIY[i] = { mnemonic: null,
            proc: (function(i) {
                return function() {
                    throw "ILLEGAL OPCODE FD CB " + i.HEX(2) + " for Rotate IY command subset";
                }
            }(i)),
            disasm: (function(i) { return function(/*mem, addr*/) {
                return {
                    code:[0xFD,0xCB],
                    mnemonic:["DEFW", "CBFDh; *** UNKNOWN OPCODE " + i.HEX(2) + "H"]
                };
            }; }(i))
        };
        opeMisc[i] = {
            mnemonic: null,
            proc: (function(i) {
                return function() {
                    throw "ILLEGAL OPCODE ED " + i.HEX(2) + " for Misc command subset";
                }
            }(i)),
            disasm: (function(i) { return function(/*mem, addr*/) {
                return {
                    code:[0xED],
                    mnemonic:["DEFB", "EDh; *** UNKNOWN OPCODE " + i.HEX(2) + "H"]
                };
            }; }(i))
        };
    }

    // IX command
    this.opecodeTable[0xDD] = {
        mnemonic:function() { return opeIX; },
        proc: function () { opeIX[THIS.fetch()].proc(); },
        disasm: function(mem, addr) { return opeIX[mem.peek(addr+1)].disasm(mem, addr); }
    }

    // IY command
    this.opecodeTable[0xFD] = {
        mnemonic: function(){ return opeIY; },
        proc: function () { opeIY[THIS.fetch()].proc(); },
        disasm: function(mem, addr) { return opeIY[mem.peek(addr+1)].disasm(mem, addr); }
    }

    // Rotate
    this.opecodeTable[0xCB] = {
        mnemonic:function() { return opeRotate; },
        proc: function () { opeRotate[THIS.fetch()].proc(); },
        disasm: function(mem, addr) {
            return opeRotate[mem.peek(addr+1)].disasm(mem, addr);
        }
    }

    // Misc
    this.opecodeTable[0xED] = {
        mnemonic:function() { return opeMisc; },
        proc: function () { opeMisc[THIS.fetch()].proc(); },
        disasm: function(mem, addr) {
            return opeMisc[mem.peek(addr+1)].disasm(mem, addr);
        }
    }

	//=================================================================================
	//
	// 8bit load group
	//
	//=================================================================================
	
	//---------------------------------------------------------------------------------
	// LD r,r'		r<-r'					01  r   r'
	//---------------------------------------------------------------------------------
    var dstRegId, srcRegId;
    var dstRegName, srcRegName;
    var opecode;
	for(dstRegId in Z80_Register.REG_r_ID2NAME) {
		dstRegName = Z80_Register.REG_r_ID2NAME[dstRegId];
		for(srcRegId in Z80_Register.REG_r_ID2NAME) {
			srcRegName = Z80_Register.REG_r_ID2NAME[srcRegId];
			opecode = (0x01 << 6) | (dstRegId << 3) | srcRegId;
			this.opecodeTable[opecode] = {
					mnemonic:"LD " + dstRegName + "," + srcRegName,
					proc:
						function (opecode, dstRegName, srcRegName) {
							return function() {
                                THIS.reg[dstRegName] = THIS.reg[srcRegName];
							}
						}(opecode, dstRegName, srcRegName),
                    "cycle": 4,
                    disasm:
						function (opecode, dstRegName, srcRegName) {
                            return function(/*mem, addr*/) {
                                return {
                                    code:       [opecode],
                                    mnemonic:   ["LD", dstRegName, srcRegName] 
                                };
                            }
						}(opecode, dstRegName, srcRegName)
			}
		}
	}
	//---------------------------------------------------------------------------------
	// LD r,n		r<-n					00  r  110	<-  n   ->
	// LD r,(HL)	r<-(HL)					01  r  110
	// LD (HL),r	(HL)<-r					01 110  r 
	// LD (HL),n	(HL)<-n					00 110 110	<-  n   ->
	//---------------------------------------------------------------------------------
    var disa_0x_r_110 = function(mem, addr) {
        var opecode = mem.peek(addr);
        var code = [opecode];
        var x = ((opecode & 0x40) != 0) ? 1 : 0;
        var r1 = (opecode >> 3) & 0x07;
        var r2 = (opecode >> 0) & 0x07;
		var operand = ["???","???"];
        var n;
        
        operand[0] = ((r1 == 6)? "(HL)" : Z80_Register.REG_r_ID2NAME[r1]);

        switch(x) {
            case 0:
                n = mem.peek(addr + 1);
                code.push(n);
                operand[1] = n.HEX(2) + "H";
                break;
            case 1:
                operand[1] = ((r2 == 6)? "(HL)" : Z80_Register.REG_r_ID2NAME[r2]);
                break;
        }
        return {
            code:       code,
            mnemonic:   ["LD", operand[0], operand[1]] 
        };
    };
	//---------------------------------------------------------------------------------
	// LD r,n		r<-n					00  r  110	<-  n   ->
	//---------------------------------------------------------------------------------
    this.opecodeTable[oct("0006")] = {
        mnemonic:"LD B,n",
        proc: function() { THIS.reg.B = THIS.fetch(); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0016")] = {
        mnemonic:"LD C,n",
        proc: function() { THIS.reg.C = THIS.fetch(); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0026")] = {
        mnemonic:"LD D,n",
        proc: function() { THIS.reg.D = THIS.fetch(); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0036")] = {
        mnemonic:"LD E,n",
        proc: function() { THIS.reg.E = THIS.fetch(); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0046")] = {
        mnemonic:"LD H,n",
        proc: function() { THIS.reg.H = THIS.fetch(); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0056")] = {
        mnemonic:"LD L,n",
        proc: function() { THIS.reg.L = THIS.fetch(); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0076")] = {
        mnemonic:"LD A,n",
        proc: function() { THIS.reg.A = THIS.fetch(); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
	//---------------------------------------------------------------------------------
	// LD r,(HL)	r<-(HL)					01  r  110
	//---------------------------------------------------------------------------------
    this.opecodeTable[oct("0106")] = {
        mnemonic:"LD B,(HL)",
        proc: function() { THIS.reg.B = THIS.memory.peek(THIS.reg.getHL()); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0116")] = {
        mnemonic:"LD C,(HL)",
        proc: function() { THIS.reg.C = THIS.memory.peek(THIS.reg.getHL()); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0126")] = {
        mnemonic:"LD D,(HL)",
        proc: function() { THIS.reg.D = THIS.memory.peek(THIS.reg.getHL()); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0136")] = {
        mnemonic:"LD E,(HL)",
        proc: function() { THIS.reg.E = THIS.memory.peek(THIS.reg.getHL()); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0146")] = {
        mnemonic:"LD H,(HL)",
        proc: function() { THIS.reg.H = THIS.memory.peek(THIS.reg.getHL()); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0156")] = {
        mnemonic:"LD L,(HL)",
        proc: function() { THIS.reg.L = THIS.memory.peek(THIS.reg.getHL()); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0176")] = {
        mnemonic:"LD A,(HL)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.getHL()); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
	//---------------------------------------------------------------------------------
	// LD (HL),r	(HL)<-r					01 110  r 
	//---------------------------------------------------------------------------------
    this.opecodeTable[oct("0160")] = {
        mnemonic:"LD (HL),B",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.B); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0161")] = {
        mnemonic:"LD (HL),C",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.C); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0162")] = {
        mnemonic:"LD (HL),D",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.D); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0163")] = {
        mnemonic:"LD (HL),E",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.E); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0164")] = {
        mnemonic:"LD (HL),H",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.H); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0165")] = {
        mnemonic:"LD (HL),L",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.L); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0167")] = {
        mnemonic:"LD (HL),A",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.A); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
	//---------------------------------------------------------------------------------
	// LD (HL),n	(HL)<-n					00 110 110	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0066")] = {
        mnemonic:"LD (HL),n",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.fetch()); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
	//---------------------------------------------------------------------------------
	// LD A,(BC)	A<-(BC)					00 001 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0012")] = {
        mnemonic:"LD A,(BC)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.getBC()); },
        "cycle": 7,
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "A", "(BC)"]};}
    };
	//---------------------------------------------------------------------------------
	// LD A,(DE)	A<-(DE)					00 011 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0032")] = {
        mnemonic:"LD A,(DE)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.getDE()); },
        "cycle": 7,
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "A", "(DE)"]};}
    };
	//---------------------------------------------------------------------------------
	// LD A,(nn)	A<-(nn)					00 111 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0072")] = { mnemonic:"LD A,(nn)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.fetchPair()); },
        "cycle": 13,
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2)],
                mnemonic: ["LD", "A","(" + mem.peekPair(addr+1).HEX(4) + "H)"]};
        }
    };
	//--------------------------------------------------------------------------------
	// LD (BC),A	(BC)<-A					00 000 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0002")] = { mnemonic:"LD (BC),A",
        proc: function() { THIS.memory.poke(THIS.reg.getBC(), THIS.reg.A); },
        "cycle": 7,
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "(BC)","A"]};} };
	//---------------------------------------------------------------------------------
	// LD (DE),A	(DE)<-A					00 010 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0022")] = { mnemonic:"LD (DE),A",
        proc: function() { THIS.memory.poke(THIS.reg.getDE(), THIS.reg.A); },
        "cycle": 7,
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "(DE)","A"]};} };
	//---------------------------------------------------------------------------------
	// LD (nn),A	(nn)<-A					00 110 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0062")] = { mnemonic:"LD (nn),A",
        proc: function() { THIS.memory.poke(THIS.fetchPair(), THIS.reg.A); },
        "cycle": 13,
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2)],
                mnemonic: ["LD", "(" + mem.peekPair(addr+1).HEX(4) + "H)","A"]};
        }
    };
	
    //---------------------------------------------------------------------------------
    // LD A,I		A<-I					11 101 101	01 010 111          S,Z,H=0,P/V=IFF,N=0
    //---------------------------------------------------------------------------------
	opeMisc[oct("0127")] = {
        mnemonic:"LD A,I",
        proc: function() {
            THIS.reg.LD_A_I(THIS.IFF2);
        },
        "cycle": 9,
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic: ["LD", "A","I"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // LD A,R		A<-R					11 101 101	01 011 111          S,Z,H=0,P/V=IFF,N=0
    //---------------------------------------------------------------------------------
	opeMisc[oct("0137")] = {
        mnemonic:"LD A,R",
        proc: function() {
            THIS.reg.LD_A_R(THIS.IFF2, THIS.regB.R);
        },
        "cycle": 9,
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic: ["LD", "A","R"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // LD I,A		I<-A					11 101 101	01 000 111
    //---------------------------------------------------------------------------------
	opeMisc[oct("0107")] = {
        mnemonic:"LD I,A",
        proc: function() { THIS.reg.I = THIS.reg.A; },
        "cycle": 9,
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic: ["LD", "I","A"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // LD R,A		R<-A					11 101 101	01 001 111
    //---------------------------------------------------------------------------------
	opeMisc[oct("0117")] = {
        mnemonic:"LD R,A",
        proc: function() { THIS.reg.R = THIS.regB.R = THIS.reg.A; },
        "cycle": 9,
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic: ["LD", "R","A"]
            };
        }
    };

    //---------------------------------------------------------------------------------
    // LD r, (IX+d)
    //---------------------------------------------------------------------------------
    var disasm_LD_r_idx_d = function(mem, addr, r, idx) {
        var d = mem.peek(addr + 2);
        return {
            code: [ mem.peek(addr), mem.peek(addr+1), d ],
            mnemonic: [ "LD", r, "(" + idx + "+" + d.HEX(2) + "H)" ]
        }
    };
    var disasm_LD_idx_d_r = function(mem, addr, idx, r) {
        var d = mem.peek(addr + 2);
        return {
            code: [ mem.peek(addr), mem.peek(addr+1), d ],
            mnemonic: [ "LD", "(" + idx + "+" + d.HEX(2) + "H)", r ]
        }
    };

    opeIX[oct("0106")] = {
        mnemonic:"LD B,(IX+d)",
        proc: function() { THIS.reg.B = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "B", "IX");
        }
    };
    opeIX[oct("0116")] = {
        mnemonic:"LD C,(IX+d)",
        proc: function() { THIS.reg.C = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "C", "IX");
        }
    };
    opeIX[oct("0126")] = {
        mnemonic:"LD D,(IX+d)",
        proc: function() { THIS.reg.D = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "D", "IX");
        }
    };
    opeIX[oct("0136")] = {
        mnemonic:"LD E,(IX+d)",
        proc: function() { THIS.reg.E = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "E", "IX");
        }
    };
    opeIX[oct("0146")] = {
        mnemonic:"LD H,(IX+d)",
        proc: function() { THIS.reg.H = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "H", "IX");
        }
    };
    opeIX[oct("0156")] = {
        mnemonic:"LD L,(IX+d)",
        proc: function() { THIS.reg.L = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "L", "IX");
        }
    };
    opeIX[oct("0176")] = {
        mnemonic:"LD A,(IX+d)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "A", "IX");
        }
    };
    
    //---------------------------------------------------------------------------------
    // LD (IX+d), r
    //---------------------------------------------------------------------------------
    opeIX[oct("0160")] = {
        mnemonic:"LD (IX+d),B",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.B); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "B");
        }
    };
    opeIX[oct("0161")] = {
        mnemonic:"LD (IX+d),C",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.C); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "C");
        }
    };
    opeIX[oct("0162")] = {
        mnemonic:"LD (IX+d),D",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.D); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "D");
        }
    };
    opeIX[oct("0163")] = {
        mnemonic:"LD (IX+d),E",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.E); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "E");
        }
    };
    opeIX[oct("0164")] = {
        mnemonic:"LD (IX+d),H",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.H); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "H");
        }
    };
    opeIX[oct("0165")] = {
        mnemonic:"LD (IX+d),L",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.L); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "L");
        }
    };
    opeIX[oct("0167")] = {
        mnemonic:"LD (IX+d),A",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.A); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "A");
        }
    };

    //---------------------------------------------------------------------------------
    // LD r, (IX+d)
    //---------------------------------------------------------------------------------
    opeIY[oct("0106")] = {
        mnemonic:"LD B,(IY+d)",
        proc: function() { THIS.reg.B = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "B", "IY");
        }
    };
    opeIY[oct("0116")] = {
        mnemonic:"LD C,(IY+d)",
        proc: function() { THIS.reg.C = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "C", "IY");
        }
    };
    opeIY[oct("0126")] = {
        mnemonic:"LD D,(IY+d)",
        proc: function() { THIS.reg.D = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "D", "IY");
        }
    };
    opeIY[oct("0136")] = {
        mnemonic:"LD E,(IY+d)",
        proc: function() { THIS.reg.E = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "E", "IY");
        }
    };
    opeIY[oct("0146")] = {
        mnemonic:"LD H,(IY+d)",
        proc: function() { THIS.reg.H = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "H", "IY");
        }
    };
    opeIY[oct("0156")] = {
        mnemonic:"LD L,(IY+d)",
        proc: function() { THIS.reg.L = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "L", "IY");
        }
    };
    opeIY[oct("0176")] = {
        mnemonic:"LD A,(IY+d)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "A", "IY");
        }
    };

    //---------------------------------------------------------------------------------
    // LD (IY+d), r
    //---------------------------------------------------------------------------------
    opeIY[oct("0160")] = {
        mnemonic:"LD (IY+d),B",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.B); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "B");
        }
    };
    opeIY[oct("0161")] = {
        mnemonic:"LD (IY+d),C",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.C); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "C");
        }
    };
    opeIY[oct("0162")] = {
        mnemonic:"LD (IY+d),D",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.D); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "D");
        }
    };
    opeIY[oct("0163")] = {
        mnemonic:"LD (IY+d),E",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.E); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "E");
        }
    };
    opeIY[oct("0164")] = {
        mnemonic:"LD (IY+d),H",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.H); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "H");
        }
    };
    opeIY[oct("0165")] = {
        mnemonic:"LD (IY+d),L",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.L); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "L");
        }
    };
    opeIY[oct("0167")] = {
        mnemonic:"LD (IY+d),A",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.A); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "A");
        }
    };

	//=================================================================================
	//
	// 16bit load group
	//
	//=================================================================================
	
	//---------------------------------------------------------------------------------
	// LD dd,nn		dd<-nn					00 dd0 001	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
    var disasm_LD_dd_nn = function(mem,addr) {
        var opcode = mem.peek(addr);
        var nnL = mem.peek(addr+1);
        var nnH = mem.peek(addr+2);
        var nn = Z80BinUtil.pair(nnH,nnL);
        var dd = ((opcode >> 4) & 0x03);
        switch(dd) {
            case 0: dd = "BC"; break;
            case 1: dd = "DE"; break;
            case 2: dd = "HL"; break;
            case 3: dd = "SP"; break;
            default: throw "*** LD dd,nn; but unknown dd.";
        }
        return {
            code:[opcode,nnL,nnH],
            mnemonic: ["LD", dd, nn.HEX(4) + "H" ]};
    };
    this.opecodeTable[oct("0001")] = {
        mnemonic:"LD BC,nn",
        cycle: 10,
        proc: function() {
            THIS.reg.C = THIS.fetch();
            THIS.reg.B = THIS.fetch();
        },
        disasm: disasm_LD_dd_nn
    };
    this.opecodeTable[oct("0021")] = {
        mnemonic:"LD DE,nn",
        cycle: 10,
        proc: function() {
            THIS.reg.E = THIS.fetch();
            THIS.reg.D = THIS.fetch();
        },
        disasm: disasm_LD_dd_nn
    };
    this.opecodeTable[oct("0041")] = {
        mnemonic:"LD HL,nn",
        cycle: 10,
        proc: function() {
            THIS.reg.L = THIS.fetch();
            THIS.reg.H = THIS.fetch();
        },
        disasm: disasm_LD_dd_nn
    };
    this.opecodeTable[oct("0061")] = {
        mnemonic:"LD SP,nn",
        cycle: 10,
        proc: function() {
            THIS.reg.SP = THIS.fetchPair();
        },
        disasm: disasm_LD_dd_nn
    };
	
	//---------------------------------------------------------------------------------
	// LD HL,(nn)	H<-(nn+1),L<-(nn)		00 101 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0052")] = {
        mnemonic:"LD HL,(nn)",
        cycle:16,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.reg.L = THIS.memory.peek(nn + 0);
            THIS.reg.H = THIS.memory.peek(nn + 1);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var nnL = mem.peek(addr+1);
            var nnH = mem.peek(addr+2);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,nnL,nnH],
                mnemonic: ["LD", "HL","(" + nn.HEX(4) + "H)" ]};
        }
	};
    opeMisc[oct("0113")] = {
        mnemonic:"LD BC,(nn)",
        cycle:20,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.reg.C = THIS.memory.peek(nn + 0);
            THIS.reg.B = THIS.memory.peek(nn + 1);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var operand = mem.peek(addr+1);
            var nnL = mem.peek(addr+2);
            var nnH = mem.peek(addr+3);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,operand,nnL,nnH],
                mnemonic: ["LD", "BC","(" + nn.HEX(4) + "H)" ]};
        }
	};
    opeMisc[oct("0133")] = {
        mnemonic:"LD DE,(nn)",
        cycle:20,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.reg.E = THIS.memory.peek(nn + 0);
            THIS.reg.D = THIS.memory.peek(nn + 1);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var operand = mem.peek(addr+1);
            var nnL = mem.peek(addr+2);
            var nnH = mem.peek(addr+3);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD", "DE","(" + nn.HEX(4) + "H)" ]};
            }
	};
    opeMisc[oct("0153")] = {
        mnemonic:"LD HL,(nn)",
        cycle:20,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.reg.L = THIS.memory.peek(nn + 0);
            THIS.reg.H = THIS.memory.peek(nn + 1);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var operand = mem.peek(addr+1);
            var nnL = mem.peek(addr+2);
            var nnH = mem.peek(addr+3);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD", "HL","(" + nn.HEX(4) + "H)" ]};
            }
	};
    opeMisc[oct("0173")] = {
        mnemonic:"LD SP,(nn)",
        cycle:20,
        proc: function() {
            THIS.reg.SP = THIS.memory.peekPair(THIS.fetchPair());
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var operand = mem.peek(addr+1);
            var nnL = mem.peek(addr+2);
            var nnH = mem.peek(addr+3);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,operand,nnL,nnH],
                mnemonic: ["LD", "SP","(" + nn.HEX(4) + "H)" ]};
        }
	};

	//---------------------------------------------------------------------------------
	// LD (nn),HL	(nn+1)<-H,(nn)<-L		00 100 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0042")] = {
        mnemonic:"LD (nn), HL",
        cycle:16,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.memory.poke(nn + 0, THIS.reg.L); 
            THIS.memory.poke(nn + 1, THIS.reg.H);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var nnL = mem.peek(addr+1);
            var nnH = mem.peek(addr+2);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,nnL,nnH],
                mnemonic: ["LD", "(" + nn.HEX(4) + "H)","HL" ]};
        }
	}
    opeMisc[oct("0103")] = {
        mnemonic:"LD (nn),BC",
        cycle:20,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.memory.poke(nn + 0, THIS.reg.C);
            THIS.memory.poke(nn + 1, THIS.reg.B);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var operand = mem.peek(addr+1);
            var nnL = mem.peek(addr+2);
            var nnH = mem.peek(addr+3);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,operand,nnL,nnH],
                mnemonic: ["LD","(" + nn.HEX(4) + "H)", "BC" ]};
        }
	};
    opeMisc[oct("0123")] = {
        mnemonic:"LD (nn),DE",
        cycle:20,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.memory.poke(nn + 0, THIS.reg.E);
            THIS.memory.poke(nn + 1, THIS.reg.D);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var operand = mem.peek(addr+1);
            var nnL = mem.peek(addr+2);
            var nnH = mem.peek(addr+3);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,operand,nnL,nnH],
                mnemonic: ["LD","(" + nn.HEX(4) + "H)", "DE" ]};
        }
	};
    opeMisc[oct("0143")] = {
        mnemonic:"LD (nn),HL",
        cycle:20,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.memory.poke(nn + 0, THIS.reg.L);
            THIS.memory.poke(nn + 1, THIS.reg.H);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var operand = mem.peek(addr+1);
            var nnL = mem.peek(addr+2);
            var nnH = mem.peek(addr+3);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,operand,nnL,nnH],
                mnemonic: ["LD","(" + nn.HEX(4) + "H)", "HL" ]};
        }
	};
    opeMisc[oct("0163")] = {
        mnemonic:"LD (nn),SP",
        cycle:20,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.memory.poke(nn + 0, (THIS.reg.SP >> 0) & 0xff);
            THIS.memory.poke(nn + 1, (THIS.reg.SP >> 8) & 0xff);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var operand = mem.peek(addr+1);
            var nnL = mem.peek(addr+2);
            var nnH = mem.peek(addr+3);
            var nn = Z80BinUtil.pair(nnH,nnL);
            return {
                code:[opcode,operand,nnL,nnH],
                mnemonic: ["LD","(" + nn.HEX(4) + "H)", "SP" ]};
        }
	};
	//---------------------------------------------------------------------------------
	// LD SP,HL		SP<-HL					11 111 001
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0371")] = {
        mnemonic:"LD SP,HL",
        cycle: 6,
        proc: function() {
            THIS.reg.SP = THIS.reg.getHL();
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["LD", "SP","HL" ]
            };
        }
    };
	//---------------------------------------------------------------------------------
	// PUSH qq		(SP-2)<-qqL,(SP-1)<-qqH	11 qq0 101
	//---------------------------------------------------------------------------------
    this.opecodeTable[0xc0 + (0 << 4) + 0x05] = {
        mnemonic:"PUSH BC",
        cycle:11,
        proc: function() {
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.B);
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["PUSH", "BC" ]
            };
        }
    };
    this.opecodeTable[0xc0 + (1 << 4) + 0x05] = {
        mnemonic:"PUSH DE",
        cycle:11,
        proc: function() {
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.D);
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["PUSH", "DE" ]
            };
        }
    };
    this.opecodeTable[0xc0 + (2 << 4) + 0x05] = {
        mnemonic:"PUSH HL",
        cycle:11,
        proc: function() {
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.H);
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["PUSH", "HL" ]
            };
        }
    };
    this.opecodeTable[0xc0 + (3 << 4) + 0x05] = {
        mnemonic:"PUSH AF",
        cycle:11,
        proc: function() {
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.A);
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.F); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["PUSH", "AF" ]
            };
        }
    };
	//---------------------------------------------------------------------------------
	// POP qq		qqL<-(SP),qqH<-(SP+1)	11 qq0 001
	//---------------------------------------------------------------------------------
    this.opecodeTable[0xc0 + (0 << 4) + 0x01] = {
        mnemonic:"POP BC",
        cycle:10,
        proc: function() {
            THIS.reg.C = THIS.memory.peek(THIS.reg.SP++);
            THIS.reg.B = THIS.memory.peek(THIS.reg.SP++); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["POP", "BC" ]
            };
        }
    };
    this.opecodeTable[0xc0 + (1 << 4) + 0x01] = {
        mnemonic:"POP DE",
        cycle:10,
        proc: function() {
            THIS.reg.E = THIS.memory.peek(THIS.reg.SP++);
            THIS.reg.D = THIS.memory.peek(THIS.reg.SP++); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["POP", "DE" ]
            };
        }
    };
    this.opecodeTable[0xc0 + (2 << 4) + 0x01] = {
        mnemonic:"POP HL",
        cycle:10,
        proc: function() {
            THIS.reg.L = THIS.memory.peek(THIS.reg.SP++);
            THIS.reg.H = THIS.memory.peek(THIS.reg.SP++); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["POP", "HL" ]
            };
        }
    };
    this.opecodeTable[0xc0 + (3 << 4) + 0x01] = {
        mnemonic:"POP AF",
        cycle:10,
        proc: function() {
            THIS.reg.F = THIS.memory.peek(THIS.reg.SP++);
            THIS.reg.A = THIS.memory.peek(THIS.reg.SP++); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["POP", "AF" ]
            };
        }
    };

    opeIX[0x21] = {
        mnemonic:"LD IX,nn",
        cycle:14,
        proc: function() {
           THIS.reg.IX = THIS.fetchPair();
        },
        disasm: function(mem, addr) {
            return {
                "code" : [
                    0xDD, 0x21,
                    mem.peek(addr + 2),
                    mem.peek(addr + 3)
                ],
                "mnemonic" : [
                    "LD", "IX", mem.peekPair(addr + 2).HEX(4) + "H"
                ]
            };
        }
    };
    opeIX[0x2A] = {
        mnemonic:"LD IX,(nn)",
        cycle:20,
        proc: function() {
            THIS.reg.IX = THIS.memory.peekPair(THIS.fetchPair());
        },
        disasm: function(mem, addr) {
            return {
                "code" : [
                    0xDD, 0x2A,
                    mem.peek(addr + 2),
                    mem.peek(addr + 3)
                ],
                "mnemonic" : [
                    "LD", "IX", "(" + mem.peekPair(addr + 2).HEX(4) + "H)"
                ]
            };
        }
    };
    opeIX[0x36] = {
        mnemonic:"LD (IX+d),n",
        cycle:19,
        proc: function() {
            var d = THIS.fetch();
            var n = THIS.fetch();
            THIS.memory.poke(THIS.reg.IX + d, n);
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            var n = mem.peek(addr + 3);
            return {
                "code" : [ 0xDD, 0x36, d, n ],
                "mnemonic" : [
                    "LD", "(IX + " + d.HEX(2) + "H)", n.HEX(2) + "H"
                ]
            };
        }
    };
    opeIX[0xF9] = {
        mnemonic:"LD SP,IX",
        cycle:10,
        proc: function() {
            THIS.reg.SP = THIS.reg.IX;
        },
        disasm: function(/*mem, addr*/) {
            return {
                "code" : [ 0xDD, 0xF9 ],
                "mnemonic" : [ "LD", "SP", "IX" ]
            };
        }
    };
    opeIX[0xE5] = {
        mnemonic:"PUSH IX",
        cycle: 15,
        proc: function() {
            THIS.memory.poke(--THIS.reg.SP, Z80BinUtil.hibyte(THIS.reg.IX));
            THIS.memory.poke(--THIS.reg.SP, Z80BinUtil.lobyte(THIS.reg.IX));
        },
        disasm: function(/*mem, addr*/) {
            return {
                "code" : [ 0xDD, 0xE5 ],
                "mnemonic" : [ "PUSH", "IX" ]
            };
        }
    };
    opeIX[0xE1] = {
        mnemonic:"POP IX",
        cycle: 14,
        proc: function() {
            THIS.reg.IX = THIS.memory.peekPair(THIS.reg.SP);
            THIS.reg.SP += 2;
        },
        disasm: function(/*mem, addr*/) {
            return {
                "code" : [ 0xDD, 0xE1 ],
                "mnemonic" : [ "POP", "IX" ]
            };
        }
    };
    opeIX[0xE3] = {
        mnemonic:"EX (SP),IX",
        cycle:23,
        proc: function () {
            var tmpH = THIS.memory.peek(THIS.reg.SP + 1);
            THIS.memory.poke(THIS.reg.SP + 1, Z80BinUtil.hibyte(THIS.reg.IX));
            var tmpL = THIS.memory.peek(THIS.reg.SP);
            THIS.memory.poke(THIS.reg.SP, Z80BinUtil.lobyte(THIS.reg.IX));
            THIS.reg.IX = Z80BinUtil.pair(tmpH, tmpL);
        },
        disasm: function(/*mem, addr*/) {
            return {
                "code" : [ 0xDD, 0xE3 ],
                "mnemonic" : [ "EX", "(SP)", "IX" ]
            };
        }
    };

    opeIY[0x21] = {
        mnemonic:"LD IY,nn",
        cycle:14,
        proc: function() {
            THIS.reg.IY = THIS.fetchPair();
        },
        disasm: function(mem, addr) {
            return {
                "code" : [
                    0xFD, 0x21,
                    mem.peek(addr + 2),
                    mem.peek(addr + 3)
                ],
                "mnemonic" : [
                    "LD", "IY", mem.peekPair(addr + 2).HEX(4) + "H"
                ]
            };
        }
    };
    opeIY[0x2A] = {
        mnemonic:"LD IY,(nn)",
        cycle:20,
        proc: function() {
            THIS.reg.IY = THIS.memory.peekPair(THIS.fetchPair());
        },
        disasm: function(mem, addr) {
            return {
                "code" : [
                    0xFD, 0x2A,
                    mem.peek(addr + 2),
                    mem.peek(addr + 3)
                ],
                "mnemonic" : [
                    "LD", "IY", "(" + mem.peekPair(addr + 2).HEX(4) + "H)"
                ]
            };
        }
    };
    opeIY[0x36] = {
        mnemonic:"LD (IY+d),n",
        cycle:19,
        proc: function() {
            var d = THIS.fetch();
            var n = THIS.fetch();
            THIS.memory.poke(THIS.reg.IY + d, n);
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            var n = mem.peek(addr + 3);
            return {
                "code" : [ 0xFD, 0x36, d, n ],
                "mnemonic" : [
                    "LD", "(IY + " + d.HEX(2) + "H)", n.HEX(2) + "H"
                ]
            };
        }
    };
    opeIY[0xF9] = {
        mnemonic:"LD SP,IY",
        cycle:10,
        proc: function() {
            THIS.reg.SP = THIS.reg.IY;
        },
        disasm: function(/*mem, addr*/) {
            return { "code" : [ 0xFD, 0xF9 ], "mnemonic" : [ "LD", "SP", "IY" ] };
        }
    };
    opeIY[0xE5] = {
        mnemonic:"PUSH IY",
        cycle: 15,
        proc: function() {
            THIS.memory.poke(--THIS.reg.SP, Z80BinUtil.hibyte(THIS.reg.IY));
            THIS.memory.poke(--THIS.reg.SP, Z80BinUtil.lobyte(THIS.reg.IY));
        },
        disasm: function(/*mem, addr*/) {
            return { "code" : [ 0xFD, 0xE5 ], "mnemonic" : [ "PUSH", "IY" ] };
        }
    };
    opeIY[0xE1] = {
        mnemonic:"POP IY",
        cycle: 14,
        proc: function() {
            THIS.reg.IY = THIS.memory.peekPair(THIS.reg.SP);
            THIS.reg.SP += 2;
        },
        disasm: function(/*mem, addr*/) {
            return { "code" : [ 0xFD, 0xE1 ], "mnemonic" : [ "POP", "IY" ] };
        }
    };
    opeIY[0xE3] = {
        mnemonic:"EX (SP),IY",
        cycle:23,
        proc: function () {
            var tmpH = THIS.memory.peek(THIS.reg.SP + 1);
            THIS.memory.poke(THIS.reg.SP + 1, (THIS.reg.IY >> 8) & 0xff);
            var tmpL = THIS.memory.peek(THIS.reg.SP);
            THIS.memory.poke(THIS.reg.SP, (THIS.reg.IY >> 0) & 0xff);
            THIS.reg.IY = (tmpH << 8) + tmpL;
        },
        disasm: function(/*mem, addr*/) {
            return { "code" : [ 0xFD, 0xE3 ], "mnemonic" : [ "EX", "(SP)", "IY" ] };
        }
    };

	//=================================================================================
    //
    // エクスチェンジグループ、ブロック転送および、サーチグループ
    //
	//=================================================================================

    //---------------------------------------------------------------------------------
    // EX DE,HL
    //---------------------------------------------------------------------------------
    this.opecodeTable[0xEB] = {
        mnemonic:"EX DE,HL ",
        cycle:4,
        proc: function () {
            var tmp = THIS.reg.D;
            THIS.reg.D = THIS.reg.H;
            THIS.reg.H = tmp;
            tmp = THIS.reg.E;
            THIS.reg.E = THIS.reg.L;
            THIS.reg.L = tmp;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["EX", "DE","HL" ]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // EX AF,AF'
    //---------------------------------------------------------------------------------
    this.opecodeTable[0x08] = {
        mnemonic:"EX AF,AF'",
        cycle:4,
        proc: function () {
            var tmp = THIS.reg.A;
            THIS.reg.A = THIS.regB.A;
            THIS.regB.A = tmp;
            tmp = THIS.reg.F;
            THIS.reg.F = THIS.regB.F;
            THIS.regB.F = tmp;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["EX", "AF","AF'" ]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // EXX
    //---------------------------------------------------------------------------------
    this.opecodeTable[0xD9] = {
        mnemonic:"EXX",
        cycle:4,
        proc: function () {
            var tmp = THIS.reg.B;
            THIS.reg.B = THIS.regB.B;
            THIS.regB.B = tmp;
            tmp = THIS.reg.C;
            THIS.reg.C = THIS.regB.C;
            THIS.regB.C = tmp;

            tmp = THIS.reg.D;
            THIS.reg.D = THIS.regB.D;
            THIS.regB.D = tmp;
            tmp = THIS.reg.E;
            THIS.reg.E = THIS.regB.E;
            THIS.regB.E = tmp;

            tmp = THIS.reg.H;
            THIS.reg.H = THIS.regB.H;
            THIS.regB.H = tmp;
            tmp = THIS.reg.L;
            THIS.reg.L = THIS.regB.L;
            THIS.regB.L = tmp;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["EXX"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    //  EX (SP),HL
    //---------------------------------------------------------------------------------
    this.opecodeTable[0xE3] = {
        mnemonic:"EX (SP),HL",
        cycle:19,
        proc: function () {
            var tmp = THIS.memory.peek(THIS.reg.SP + 1);
            THIS.memory.poke(THIS.reg.SP + 1, THIS.reg.H);
            THIS.reg.H = tmp;

            tmp = THIS.memory.peek(THIS.reg.SP);
            THIS.memory.poke(THIS.reg.SP, THIS.reg.L);
            THIS.reg.L = tmp;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["EX", "(SP)","HL"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // LDI                  (DE) <- (HL)        11 101 101
    //                      DE <- DE + 1        10 100 000
    //                      HL <- HL + 1
    //                      BC <- BC - 1
    //---------------------------------------------------------------------------------
	opeMisc[oct("0240")] = {
        mnemonic:"LDI",
        cycle: 16,
        proc: function() {
            THIS.memory.poke(THIS.reg.getDE(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.reg.onLDI();
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["LDI"]};
        }
    };
    //---------------------------------------------------------------------------------
    // LDIR                 (DE) <- (HL)        11 101 101
    //                      DE <- DE + 1        10 110 000
    //                      HL <- HL + 1
    //                      BC <- BC - 1
    //                      BC=0まで繰り返す
    //---------------------------------------------------------------------------------
	opeMisc[oct("0260")] = {
        mnemonic:"LDIR",
        cycle: "BC≠0→21, BC=0→16",
        proc: function() {
            THIS.memory.poke(THIS.reg.getDE(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.reg.onLDI();
            if(THIS.reg.getBC() != 0) {
                THIS.reg.PC -= 2;
                return 21;
            }
            return 16;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["LDIR"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // LDD                  (DE) <- (HL)        11 101 101
    //                      DE <- DE - 1        10 101 000
    //                      HL <- HL - 1
    //                      BC <- BC - 1
    //---------------------------------------------------------------------------------
	opeMisc[oct("0250")] = {
        mnemonic:"LDD",
        cycle: 16,
        proc: function() {
            THIS.memory.poke(THIS.reg.getDE(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.reg.onLDD();
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["LDD"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // LDDR                 (DE) <- (HL)        11 101 101
    //                      DE <- DE - 1        10 111 000
    //                      HL <- HL - 1
    //                      BC <- BC - 1
    //                      BC=0まで繰り返す
    //---------------------------------------------------------------------------------
	opeMisc[oct("0270")] = {
        mnemonic:"LDDR",
        cycle: "BC≠0→21, BC=0→16",
        proc: function() {
            THIS.memory.poke(THIS.reg.getDE(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.reg.onLDD();
            if(THIS.reg.getBC() != 0) {
                THIS.reg.PC -= 2;
                return 21;
            }
            return 16;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["LDDR"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // CPI                  A-(HL)              11 101 101
    //                      HL <- HL + 1        10 100 001
    //                      BC <- BC - 1
    //---------------------------------------------------------------------------------
	opeMisc[oct("0241")] = {
        mnemonic:"CPI",
        cycle: 16,
        proc: function() {
            THIS.reg.CPI(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["CPI"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // CPIR                 A-(HL)              11 101 101
    //                      HL <- HL + 1        10 110 001
    //                      BC <- BC - 1
    //                      BC=0まで繰り返す
    //---------------------------------------------------------------------------------
	opeMisc[oct("0261")] = {
        mnemonic:"CPIR",
        cycle: "{BC≠0 && A≠(HL)}→21, {BC=0 || A=(HL)}→16",
        proc: function() {
            THIS.reg.CPI(THIS.memory.peek(THIS.reg.getHL()));
            if(THIS.reg.getBC() != 0 && !THIS.reg.flagZ()) {
                THIS.reg.PC -= 2;
                return 21;
            }
            return 16;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["CPIR"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // CPD                  A-(HL)              11 101 101
    //                      HL <- HL - 1        10 101 001
    //                      BC <- BC - 1
    //---------------------------------------------------------------------------------
	opeMisc[oct("0251")] = {
        mnemonic:"CPD",
        cycle: 16,
        proc: function() {
            THIS.reg.CPD(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["CPD"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // CPDR                 A-(HL)              11 101 101
    //                      HL <- HL - 1        10 111 001
    //                      BC <- BC - 1
    //                      BC=0まで繰り返す
    //---------------------------------------------------------------------------------
	opeMisc[oct("0271")] = {
        mnemonic:"CPDR",
        cycle: "{BC≠0 && A≠(HL)}→21, {BC=0 || A=(HL)}→16",
        proc: function() {
            THIS.reg.CPD(THIS.memory.peek(THIS.reg.getHL()));
            if(THIS.reg.getBC() != 0 && !THIS.reg.flagZ()) {
                THIS.reg.PC -= 2;
                return 21;
            }
            return 16;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["CPDR"]
            };
        }
    };

    //=================================================================================
    // 8ビット演算・論理グループ
    //=================================================================================

    //---------------------------------------------------------------------------------
    // ADD A,r      A <- A + r          10[000]<r>
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0200")] = {
        mnemonic:"ADD A,B",
        cycle:4,
        proc: function() { THIS.reg.addAcc(THIS.reg.B); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "A","B"]
            };
        }
    };
    this.opecodeTable[oct("0201")] = {
        mnemonic:"ADD A,C",
        cycle:4,
        proc: function() { THIS.reg.addAcc(THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "A","C"]
            };
        }
    };
    this.opecodeTable[oct("0202")] = {
        mnemonic:"ADD A,D",
        cycle:4,
        proc: function() { THIS.reg.addAcc(THIS.reg.D); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "A","D"]
            };
        }
    };
    this.opecodeTable[oct("0203")] = {
        mnemonic:"ADD A,E",
        cycle:4,
        proc: function() { THIS.reg.addAcc(THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "A","E"]
            };
        }
    };
    this.opecodeTable[oct("0204")] = {
        mnemonic:"ADD A,H",
        cycle:4,
        proc: function() { THIS.reg.addAcc(THIS.reg.H); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "A","H"]
            };
        }
    };
    this.opecodeTable[oct("0205")] = {
        mnemonic:"ADD A,L",
        cycle:4,
        proc: function() { THIS.reg.addAcc(THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "A","L"]
            };
        }
    };
    this.opecodeTable[oct("0207")] = {
        mnemonic:"ADD A,A",
        cycle:4,
        proc: function() { THIS.reg.addAcc(THIS.reg.A); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "A","A"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // ADD A,n       A <- A + n         11[000]110
    //                                  <---n---->
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0306")] = {
        mnemonic:"ADD A,n",
        cycle:7,
        proc: function() { THIS.reg.addAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return {
                code:[mem.peek(addr),n],
                    mnemonic: ["ADD", "A", n.HEX(2) + "H"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // ADD A,(HL)    A <- A + (HL)      10[000]110
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0206")] = {
        mnemonic:"ADD A,(HL)",
        cycle:7,
        proc: function() { THIS.reg.addAcc(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "A","(HL)"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // ADD A,(IX+d)  A <- A + (IX+d)    11 011 101
    //                                  10[000]110
    //                                  <---d---->
    //---------------------------------------------------------------------------------
    opeIX[oct("0206")] = {
        mnemonic:"ADD A,(IX+d)",
        cycle:19,
        proc: function() {
            THIS.reg.addAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["ADD", "A", "(IX+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // ADD A,(IY+d)  A <- A + (IY+d)    11 111 101
    //                                  10[000]110
    //                                  <---d---->
    //---------------------------------------------------------------------------------
    opeIY[oct("0206")] = {
        mnemonic:"ADD A,(IY+d)",
        cycle:19,
        proc: function() {
            THIS.reg.addAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["ADD", "A", "(IY+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // ADC A,s      A <- A + s + CY       [001]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0210")] = {
        mnemonic:"ADC A,B",
        cycle:4,
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.B); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADC", "A", "B"]
            };
        }
    };
    this.opecodeTable[oct("0211")] = {
        mnemonic:"ADC A,C",
        cycle:4,
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADC", "A", "C"]
            };
        }
    };
    this.opecodeTable[oct("0212")] = {
        mnemonic:"ADC A,D",
        cycle:4,
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.D); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADC", "A", "D"]
            };
        }
    };
    this.opecodeTable[oct("0213")] = {
        mnemonic:"ADC A,E",
        cycle:4,
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADC", "A", "E"]
            };
        }
    };
    this.opecodeTable[oct("0214")] = {
        mnemonic:"ADC A,H",
        cycle:4,
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.H); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADC", "A", "H"]
            };
        }
    };
    this.opecodeTable[oct("0215")] = {
        mnemonic:"ADC A,L",
        cycle:4,
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADC", "A", "L"]
            };
        }
    };
    this.opecodeTable[oct("0217")] = {
        mnemonic:"ADC A,A",
        cycle:4,
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.A); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADC", "A", "A"]
            };
        }
    };
    this.opecodeTable[oct("0316")] = {
        mnemonic:"ADC A,n",
        cycle:7,
        proc: function() { THIS.reg.addAccWithCarry(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return {
                code:[mem.peek(addr),n],
                    mnemonic: ["ADC", "A", n.HEX(2) + "H"]
            };
        }
    };
    this.opecodeTable[oct("0216")] = {
        mnemonic:"ADC A,(HL)",
        cycle:7,
        proc: function() { THIS.reg.addAccWithCarry(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADC", "A", "(HL)"]
            };
        }
    };
    opeIX[oct("0216")] = {
        mnemonic:"ADC A,(IX+d)",
        cycle:19,
        proc: function() {
            THIS.reg.addAccWithCarry(THIS.memory.peek(THIS.reg.IX + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["ADC", "A", "(IX+" + d.HEX(2) + "H)"]
            }
        }
    };
    opeIY[oct("0216")] = {
        mnemonic:"ADC A,(IY+d)",
        cycle:19,
        proc: function() {
            THIS.reg.addAccWithCarry(THIS.memory.peek(THIS.reg.IY + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["ADC", "A", "(IY+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // SUB s        A <- A - s            [010]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0220")] = {
        mnemonic:"SUB A,B",
        cycle:4,
        proc: function() { THIS.reg.subAcc(THIS.reg.B); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SUB", "A", "B"]
            };
        }
    };
    this.opecodeTable[oct("0221")] = {
        mnemonic:"SUB A,C",
        cycle:4,
        proc: function() { THIS.reg.subAcc(THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SUB", "A", "C"]
            };
        }
    };
    this.opecodeTable[oct("0222")] = {
        mnemonic:"SUB A,D",
        cycle:4,
        proc: function() { THIS.reg.subAcc(THIS.reg.D); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SUB", "A", "D"]
            };
        }
    };
    this.opecodeTable[oct("0223")] = {
        mnemonic:"SUB A,E",
        cycle:4,
        proc: function() { THIS.reg.subAcc(THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SUB", "A", "E"]
            };
        }
    };
    this.opecodeTable[oct("0224")] = {
        mnemonic:"SUB A,H",
        cycle:4,
        proc: function() { THIS.reg.subAcc(THIS.reg.H); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SUB", "A", "H"]
            };
        }
    };
    this.opecodeTable[oct("0225")] = {
        mnemonic:"SUB A,L",
        cycle:4,
        proc: function() { THIS.reg.subAcc(THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SUB", "A", "L"]
            };
        }
    };
    this.opecodeTable[oct("0227")] = {
        mnemonic:"SUB A,A",
        cycle:4,
        proc: function() { THIS.reg.subAcc(THIS.reg.A); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SUB", "A", "A"]
            };
        }
    };
    this.opecodeTable[oct("0326")] = {
        mnemonic:"SUB A,n",
        cycle:7,
        proc: function() { THIS.reg.subAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return {
                code:[mem.peek(addr),n],
                    mnemonic: ["SUB", "A", n.HEX(2) + "H"]
            };
        }
    };
    this.opecodeTable[oct("0226")] = {
        mnemonic:"SUB A,(HL)",
        cycle:7,
        proc: function() {
            THIS.reg.subAcc(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SUB", "A", "(HL)"]
            };
        }
    };
    opeIX[oct("0226")] = {
        mnemonic:"SUB A,(IX+d)",
        cycle:19,
        proc: function() {
            THIS.reg.subAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["SUB", "A", "(IX+" + d.HEX(2) + "H)"]
            }
        }
    };
    opeIY[oct("0226")] = {
        mnemonic:"SUB A,(IY+d)",
        cycle:19,
        proc: function() {
            THIS.reg.subAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["SUB", "A", "(IY+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // SBC A,s      A <- A - s - CY       [011]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0230")] = {
        mnemonic:"SBC A,B",
        cycle:4,
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.B); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SBC", "A", "B"]
            };
        }
    };
    this.opecodeTable[oct("0231")] = {
        mnemonic:"SBC A,C",
        cycle:4,
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SBC", "A", "C"]
            };
        }
    };
    this.opecodeTable[oct("0232")] = {
        mnemonic:"SBC A,D",
        cycle:4,
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.D); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SBC", "A", "D"]
            };
        }
    };
    this.opecodeTable[oct("0233")] = {
        mnemonic:"SBC A,E",
        cycle:4,
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SBC", "A", "E"]
            };
        }
    };
    this.opecodeTable[oct("0234")] = {
        mnemonic:"SBC A,H",
        cycle:4,
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.H); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SBC", "A", "H"]
            };
        }
    };
    this.opecodeTable[oct("0235")] = {
        mnemonic:"SBC A,L",
        cycle:4,
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SBC", "A", "L"]
            };
        }
    };
    this.opecodeTable[oct("0237")] = {
        mnemonic:"SBC A,A",
        cycle:4,
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.A); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SBC", "A", "A"]
            };
        }
    };
    this.opecodeTable[oct("0336")] = {
        mnemonic:"SBC A,n",
        cycle:7,
        proc: function() { THIS.reg.subAccWithCarry(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return {
                code:[mem.peek(addr),n],
                    mnemonic: ["SBC", "A," + n.HEX(2) + "H"]};
        }};
    this.opecodeTable[oct("0236")] = {
        mnemonic:"SBC A,(HL)",
        cycle:7,
        proc: function() {
            THIS.reg.subAccWithCarry(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SBC", "A", "(HL)"]
            };
        }
    };
    opeIX[oct("0236")] = {
        mnemonic:"SBC A,(IX+d)",
        cycle:19,
        proc: function() {
            THIS.reg.subAccWithCarry(THIS.memory.peek(THIS.reg.IX + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["SBC", "A", "(IX+" + d.HEX(2) + "H)"]
            }
        }
    };
    opeIY[oct("0236")] = {
        mnemonic:"SBC A,(IY+d)",
        cycle:19,
        proc: function() {
            THIS.reg.subAccWithCarry(THIS.memory.peek(THIS.reg.IY + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["SBC", "A", "(IY+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // AND s        A <- A & s            [100]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0240")] = {
        mnemonic:"AND B",
        cycle:4,
        proc: function() { THIS.reg.andAcc(THIS.reg.B); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["AND", "B"]
            };
        }
    };
    this.opecodeTable[oct("0241")] = {
        mnemonic:"AND C",
        cycle:4,
        proc: function() { THIS.reg.andAcc(THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["AND", "C"]
            };
        }
    };
    this.opecodeTable[oct("0242")] = {
        mnemonic:"AND D",
        cycle:4,
        proc: function() { THIS.reg.andAcc(THIS.reg.D); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["AND", "D"]
            };
        }
    };
    this.opecodeTable[oct("0243")] = {
        mnemonic:"AND E",
        cycle:4,
        proc: function() { THIS.reg.andAcc(THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["AND", "E"]
            };
        }
    };
    this.opecodeTable[oct("0244")] = {
        mnemonic:"AND H",
        cycle:4,
        proc: function() { THIS.reg.andAcc(THIS.reg.H); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["AND", "H"]
            };
        }
    };
    this.opecodeTable[oct("0245")] = {
        mnemonic:"AND L",
        cycle:4,
        proc: function() { THIS.reg.andAcc(THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["AND", "L"]
            };
        }
    };
    this.opecodeTable[oct("0247")] = {
        mnemonic:"AND A",
        cycle:4,
        proc: function() { THIS.reg.andAcc(THIS.reg.A); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["AND", "A"]
            };
        }
    };
    this.opecodeTable[oct("0346")] = {
        mnemonic:"AND n",
        cycle:7,
        proc: function() { THIS.reg.andAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return {
                code:[mem.peek(addr),n],
                    mnemonic: ["AND", n.HEX(2) + "H"]
            };
        }};
    this.opecodeTable[oct("0246")] = {
        mnemonic:"AND (HL)",
        cycle:7,
        proc: function() {
            THIS.reg.andAcc(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["AND", "(HL)"]
            };
        }
    };
    opeIX[oct("0246")] = {
        mnemonic:"AND (IX+d)",
        cycle:19,
        proc: function() {
            THIS.reg.andAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["AND", "(IX+" + d.HEX(2) + "H)"]
            }
        }
    };
    opeIY[oct("0246")] = {
        mnemonic:"AND (IY+d)",
        cycle:19,
        proc: function() {
            THIS.reg.andAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["AND", "(IY+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // OR s         A <- A | s            [110]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0260")] = {
        mnemonic:"OR B",
        cycle:4,
        proc: function() { THIS.reg.orAcc(THIS.reg.B); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["OR", "B"]
            };
        }
    };
    this.opecodeTable[oct("0261")] = {
        mnemonic:"OR C",
        cycle:4,
        proc: function() { THIS.reg.orAcc(THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["OR", "C"]
            };
        }
    };
    this.opecodeTable[oct("0262")] = {
        mnemonic:"OR D",
        cycle:4,
        proc: function() { THIS.reg.orAcc(THIS.reg.D); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["OR", "D"]
            };
        }
    };
    this.opecodeTable[oct("0263")] = {
        mnemonic:"OR E",
        cycle:4,
        proc: function() { THIS.reg.orAcc(THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["OR", "E"]
            };
        }
    };
    this.opecodeTable[oct("0264")] = {
        mnemonic:"OR H",
        cycle:4,
        proc: function() { THIS.reg.orAcc(THIS.reg.H); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["OR", "H"]
            };
        }
    };
    this.opecodeTable[oct("0265")] = {
        mnemonic:"OR L",
        cycle:4,
        proc: function() { THIS.reg.orAcc(THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["OR", "L"]
            };
        }
    };
    this.opecodeTable[oct("0267")] = {
        mnemonic:"OR A",
        cycle:4,
        proc: function() { THIS.reg.orAcc(THIS.reg.A); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["OR", "A"]
            };
        }
    };
    this.opecodeTable[oct("0366")] = {
        mnemonic:"OR n",
        cycle:7,
        proc: function() { THIS.reg.orAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return {
                code:[mem.peek(addr),n],
                    mnemonic: ["OR", n.HEX(2) + "H"]
            };
        }
    };
    this.opecodeTable[oct("0266")] = {
        mnemonic:"OR (HL)",
        cycle:7,
        proc: function() {
            THIS.reg.orAcc(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["OR", "(HL)"]
            };
        }
    };
    opeIX[oct("0266")] = {
        mnemonic:"OR (IX+d)",
        cycle:19,
        proc: function() {
            THIS.reg.orAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["OR", "(IX+" + d.HEX(2) + "H)"]
            }
        }
    };
    opeIY[oct("0266")] = {
        mnemonic:"OR (IY+d)",
        cycle:19,
        proc: function() {
            THIS.reg.orAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["OR", "(IY+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // XOR s        A <- A ~ s            [101]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0250")] = {
        mnemonic:"XOR B",
        cycle:4,
        proc: function() { THIS.reg.xorAcc(THIS.reg.B); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["XOR", "B"]
            };
        }
    };
    this.opecodeTable[oct("0251")] = {
        mnemonic:"XOR C",
        cycle:4,
        proc: function() { THIS.reg.xorAcc(THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["XOR", "C"]
            };
        }
    };
    this.opecodeTable[oct("0252")] = {
        mnemonic:"XOR D",
        cycle:4,
        proc: function() { THIS.reg.xorAcc(THIS.reg.D); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["XOR", "D"]
            };
        }
    };
    this.opecodeTable[oct("0253")] = {
        mnemonic:"XOR E",
        cycle:4,
        proc: function() { THIS.reg.xorAcc(THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["XOR", "E"]
            };
        }
    };
    this.opecodeTable[oct("0254")] = {
        mnemonic:"XOR H",
        cycle:4,
        proc: function() { THIS.reg.xorAcc(THIS.reg.H); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["XOR", "H"]
            };
        }
    };
    this.opecodeTable[oct("0255")] = {
        mnemonic:"XOR L",
        cycle:4,
        proc: function() { THIS.reg.xorAcc(THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["XOR", "L"]
            };
        }
    };
    this.opecodeTable[oct("0257")] = {
        mnemonic:"XOR A",
        cycle:4,
        proc: function() { THIS.reg.xorAcc(THIS.reg.A); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["XOR", "A"]
            };
        }
    };
    this.opecodeTable[oct("0356")] = {
        mnemonic:"XOR n",
        cycle:7,
        proc: function() { THIS.reg.xorAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return {
                code:[mem.peek(addr),n],
                    mnemonic: ["XOR", n.HEX(2) + "H"]};
        }
    };
    this.opecodeTable[oct("0256")] = {
        mnemonic:"XOR (HL)",
        cycle:7,
        proc: function() { THIS.reg.xorAcc(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["XOR", "(HL)"]
            };
        }
    };
    opeIX[oct("0256")] = {
        mnemonic:"XOR (IX+d)",
        cycle:19,
        proc: function() {
            THIS.reg.xorAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["XOR", "(IX+" + d.HEX(2) + "H)"]
            }
        }
    };
    opeIY[oct("0256")] = {
        mnemonic:"XOR (IY+d)",
        cycle:19,
        proc: function() {
            THIS.reg.xorAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["XOR", "(IY+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // CP s         A - s                 [111]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0270")] = {
        mnemonic:"CP B",
        cycle:4,
        proc: function() { THIS.reg.compareAcc(THIS.reg.B); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CP", "B"]
            };
        }
    };
    this.opecodeTable[oct("0271")] = {
        mnemonic:"CP C",
        cycle:4,
        proc: function() { THIS.reg.compareAcc(THIS.reg.C); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CP", "C"]
            };
        }
    };
    this.opecodeTable[oct("0272")] = {
        mnemonic:"CP D",
        cycle:4,
        proc: function() { THIS.reg.compareAcc(THIS.reg.D); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CP", "D"]
            };
        }
    };
    this.opecodeTable[oct("0273")] = {
        mnemonic:"CP E",
        cycle:4,
        proc: function() { THIS.reg.compareAcc(THIS.reg.E); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CP", "E"]
            };
        }
    };
    this.opecodeTable[oct("0274")] = {
        mnemonic:"CP H",
        cycle:4,
        proc: function() { THIS.reg.compareAcc(THIS.reg.H); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CP", "H"]
            };
        }
    };
    this.opecodeTable[oct("0275")] = {
        mnemonic:"CP L",
        cycle:4,
        proc: function() { THIS.reg.compareAcc(THIS.reg.L); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CP", "L"]
            };
        }
    };
    this.opecodeTable[oct("0277")] = {
        mnemonic:"CP A",
        cycle:4,
        proc: function() { THIS.reg.compareAcc(THIS.reg.A); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CP", "A"]
            };
        }
    };
    this.opecodeTable[oct("0376")] = {
        mnemonic:"CP n",
        cycle:7,
        proc: function() { THIS.reg.compareAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return {
                code:[mem.peek(addr),n],
                    mnemonic: ["CP", n.HEX(2) + "H"]
            };
        }
    };
    this.opecodeTable[oct("0276")] = {
        mnemonic:"CP (HL)",
        cycle:7,
        proc: function() {
            THIS.reg.compareAcc(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CP", "(HL)"]
            };
        }
    };
    opeIX[oct("0276")] = {
        mnemonic:"CP (IX+d)",
        cycle:19,
        proc: function() {
            THIS.reg.compareAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["CP", "(IX+" + d.HEX(2) + "H)"]
            }
        }
    };
    opeIY[oct("0276")] = {
        mnemonic:"CP (IY+d)",
        cycle:19,
        proc: function() {
            THIS.reg.compareAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch()));
        },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code: [ mem.peek(addr), mem.peek(addr+1), d ],
                mnemonic: ["CP", "(IY+" + d.HEX(2) + "H)"]
            }
        }
    };
    //---------------------------------------------------------------------------------
    // INC r        r <- r + 1          00 <r>[100]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0004")] = {
        mnemonic:"INC B",
        "cycle": 4,
        proc: function() { THIS.reg.increment("B"); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)], mnemonic: ["INC", "B"]
            };
        }
    };
    this.opecodeTable[oct("0014")] = {
        mnemonic:"INC C",
        "cycle": 4,
        proc: function() { THIS.reg.increment("C"); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "C"]
            };
        }
    };
    this.opecodeTable[oct("0024")] = {
        mnemonic:"INC D",
        "cycle": 4,
        proc: function() { THIS.reg.increment("D"); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "D"]
            };
        }
    };
    this.opecodeTable[oct("0034")] = {
        mnemonic:"INC E",
        "cycle": 4,
        proc: function() { THIS.reg.increment("E"); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "E"]
            };
        }
    };
    this.opecodeTable[oct("0044")] = {
        mnemonic:"INC H",
        "cycle": 4,
        proc: function() { THIS.reg.increment("H"); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "H"]
            };
        }
    };
    this.opecodeTable[oct("0054")] = {
        mnemonic:"INC L",
        "cycle": 4,
        proc: function() { THIS.reg.increment("L"); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "L"]
            };
        }
    };
    this.opecodeTable[oct("0074")] = {
        mnemonic:"INC A",
        "cycle": 4,
        proc: function() { THIS.reg.increment("A"); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "A"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // INC (HL)     (HL) <- (HL) + 1    00 110[100]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0064")] = {
        mnemonic:"INC (HL)",
        "cycle": 11,
        proc: function() { THIS.incrementAt(THIS.reg.getHL()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "(HL)"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // INC (IX+d)   (IX+d) <- (IX+d)+1  11 011 101
    //                                  00 110[100]
    //                                  <---d---->
    //---------------------------------------------------------------------------------
    opeIX[oct("0064")] = {
        mnemonic:"INC (IX+d)",
        "cycle": 23,
        proc: function() { THIS.incrementAt(THIS.reg.IX + THIS.fetch()); },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code:[mem.peek(addr), mem.peek(addr + 1), d],
                mnemonic: ["INC", "(IX+ " + d + ")"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // INC (IY+d)   (IY+d) <- (IY+d)+1  11 111 101
    //                                  00 110[100]
    //                                  <---d---->
    //---------------------------------------------------------------------------------
    opeIY[oct("0064")] = {
        mnemonic:"INC (IY+d)",
        "cycle": 23,
        proc: function() { THIS.incrementAt(THIS.reg.IY + THIS.fetch());},
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code:[mem.peek(addr), mem.peek(addr + 1), d],
                mnemonic: ["INC", "(IY+ " + d + ")"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // DEC m        m <- m + 1                [100]
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0005")] = {
        mnemonic:"DEC B", proc: function() { THIS.reg.decrement("B"); }, "cycle": 4,
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "B"]}; } };
    this.opecodeTable[oct("0015")] = {
        mnemonic:"DEC C", proc: function() { THIS.reg.decrement("C"); }, "cycle": 4,
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "C"]}; } };
    this.opecodeTable[oct("0025")] = {
        mnemonic:"DEC D", proc: function() { THIS.reg.decrement("D"); }, "cycle": 4,
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "D"]}; } };
    this.opecodeTable[oct("0035")] = {
        mnemonic:"DEC E", proc: function() { THIS.reg.decrement("E"); }, "cycle": 4,
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "E"]}; } };
    this.opecodeTable[oct("0045")] = {
        mnemonic:"DEC H", proc: function() { THIS.reg.decrement("H"); }, "cycle": 4,
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "H"]}; } };
    this.opecodeTable[oct("0055")] = {
        mnemonic:"DEC L", proc: function() { THIS.reg.decrement("L"); }, "cycle": 4,
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "L"]}; } };
    this.opecodeTable[oct("0075")] = {
        mnemonic:"DEC A", proc: function() { THIS.reg.decrement("A"); }, "cycle": 4,
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "A"]}; } };
    this.opecodeTable[oct("0065")] = {
        mnemonic:"DEC (HL)", proc: function() { THIS.decrementAt(THIS.reg.getHL()); }, "cycle": 11,
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "(HL)"]}; } };
    opeIX[oct("0065")] = {
        mnemonic:"DEC (IX+d)",
        "cycle": 23,
        proc: function() { THIS.decrementAt(THIS.reg.IX + THIS.fetch()); },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code:[mem.peek(addr), mem.peek(addr + 1), d],
                mnemonic: ["DEC", "(IX+ " + d + ")"]
            };
        }
    };
    opeIY[oct("0065")] = {
        mnemonic:"DEC (IY+d)",
        "cycle": 23,
        proc: function() { THIS.decrementAt(THIS.reg.IY + THIS.fetch()); },
        disasm: function(mem, addr) {
            var d = mem.peek(addr + 2);
            return {
                code:[mem.peek(addr), mem.peek(addr + 1), d],
                mnemonic: ["DEC", "(IY+ " + d + ")"]
            };
        }
    };

    //=================================================================================
    // 一般目的の演算、及びCPUコントロールグループ
    //=================================================================================
    //static void daa(void)
    //{
    // int i;
    // i=R.AF.B.h;
    // if (R.AF.B.l&C_FLAG) i|=256;
    // if (R.AF.B.l&H_FLAG) i|=512;
    // if (R.AF.B.l&N_FLAG) i|=1024;
    // R.AF.W.l=DAATable[i];
    //};
    this.opecodeTable[oct("0047")] = {
        mnemonic:"DAA",
        cycle:4,
        proc: function() { THIS.reg.DAA(); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["DAA"]
            };
        }
    };
    this.opecodeTable[oct("0057")] = {
        mnemonic:"CPL",
        cycle:4,
        proc: function() { THIS.reg.CPL(); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CPL"]
            };
        }
    };
    this.opecodeTable[oct("0077")] = {
        mnemonic:"CCF",
        cycle:4,
        proc: function() {
            if(THIS.reg.flagC()) {
                THIS.reg.clearFlagC();
            } else {
                THIS.reg.setFlagC();
            }
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["CCF"]
            };
        }
    };
    this.opecodeTable[oct("0067")] = {
        mnemonic:"SCF",
        cycle:4,
        proc: function() { THIS.reg.setFlagC(); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["SCF"]
            };
        }
    };
    this.opecodeTable[oct("0000")] = {
        mnemonic:"NOP",
        cycle: 4,
        proc: function() {},
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["NOP"]
            };
        }
    };
    this.opecodeTable[oct("0166")] = {
        mnemonic:"HALT",
        cycle: 4,
        proc: function() {
            THIS.HALT = 1;
            THIS.reg.PC -= 1;
            THIS.exec = function() {
                THIS.reg.R = (THIS.reg.R + 1) & 255;
                throw "halt";
            };
            throw "halt";
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["HALT"]
            };
        }
    };
    this.opecodeTable[oct("0363")] = {
        mnemonic:"DI",
        cycle: 4,
        proc: function() { THIS.IFF1 = THIS.IFF2 = 0; },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["DI"]
            };
        }
    };
    this.opecodeTable[oct("0373")] = {
        mnemonic:"EI",
        cycle: 4,
        proc: function() {
            if (!THIS.IFF1) {
                THIS.IFF1 = this.IFF2 = 1;
                THIS.reg.R = (THIS.reg.R + 1) & 255;
                THIS.exec();
            } else {
                THIS.IFF2 = 1;
            }
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["EI"]
            };
        }
    };
    opeMisc[oct("0104")] = {
        mnemonic:"NEG",
        cycle: 8,
        proc: function() { THIS.reg.NEG(); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["NEG"]
            };
        }
    };
    opeMisc[oct("0106")] = {
        mnemonic:"IM0",
        cycle: 8,
        proc: function() { THIS.IM = 0; },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["IM0"]
            };
        }
    };
    opeMisc[oct("0126")] = {
        mnemonic:"IM1",
        cycle: 8,
        proc: function() { THIS.IM = 1; },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["IM1"]
            };
        }
    };
    opeMisc[oct("0136")] = {
        mnemonic:"IM2",
        cycle: 8,
        proc: function() { THIS.IM = 2; },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["IM2"]
            };
        }
    };

    //=================================================================================
    // 16ビット演算グループ
    //=================================================================================

    //---------------------------------------------------------------------------------
    // ADD HL,ss    HL <- HL + ss       00 ss1 001
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0011")] = {
        mnemonic:"ADD HL,BC",
        cycle: 11,
        proc: function() { THIS.reg.ADD_HL(THIS.reg.getBC()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "HL", "BC"]
            };
        }
    };
    this.opecodeTable[oct("0031")] = {
        mnemonic:"ADD HL,DE",
        cycle: 11,
        proc: function() { THIS.reg.ADD_HL(THIS.reg.getDE()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "HL", "DE"]};
        }
    };
    this.opecodeTable[oct("0051")] = {
        mnemonic:"ADD HL,HL",
        cycle: 11,
        proc: function() { THIS.reg.ADD_HL(THIS.reg.getHL()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "HL", "HL"]
            };
        }
    };
    this.opecodeTable[oct("0071")] = {
        mnemonic:"ADD HL,SP",
        cycle: 11,
        proc: function() { THIS.reg.ADD_HL(THIS.reg.SP); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["ADD", "HL", "SP"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // ADC HL,ss    HL <- HL + ss + CY  11 101 101
    //                                  01 ss1 010
    //---------------------------------------------------------------------------------
    opeMisc[oct("0112")] = {
        mnemonic:"ADC HL,BC",
        cycle: 15,
        proc: function() { THIS.reg.ADC_HL(THIS.reg.getBC()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["ADC", "HL", "BC"]
            };
        }
    };
    opeMisc[oct("0132")] = {
        mnemonic:"ADC HL,DE",
        cycle: 15,
        proc: function() { THIS.reg.ADC_HL(THIS.reg.getDE()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["ADC", "HL", "DE"]
            };
        }
    };
    opeMisc[oct("0152")] = {
        mnemonic:"ADC HL,HL",
        cycle: 15,
        proc: function() { THIS.reg.ADC_HL(THIS.reg.getHL()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["ADC", "HL", "HL"]
            };
        }
    };
    opeMisc[oct("0172")] = {
        mnemonic:"ADC HL,SP",
        cycle: 15,
        proc: function() { THIS.reg.ADC_HL(THIS.reg.SP); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["ADC", "HL", "SP"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // SBC HL,ss    HL <- HL - ss - CY  11 101 101
    //                                  01 ss0 010
    //---------------------------------------------------------------------------------
    opeMisc[oct("0102")] = {
        mnemonic:"SBC HL,BC",
        cycle: 15,
        proc: function() { THIS.reg.SBC_HL(THIS.reg.getBC()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["SBC", "HL", "BC"]
            };
        }
    };
    opeMisc[oct("0122")] = {
        mnemonic:"SBC HL,DE",
        cycle: 15,
        proc: function() { THIS.reg.SBC_HL(THIS.reg.getDE()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["SBC", "HL", "DE"]
            };
        }
    };
    opeMisc[oct("0142")] = {
        mnemonic:"SBC HL,HL",
        cycle: 15,
        proc: function() { THIS.reg.SBC_HL(THIS.reg.getHL()); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["SBC", "HL", "HL"]
            };
        }
    };
    opeMisc[oct("0162")] = {
        mnemonic:"SBC HL,SP",
        cycle: 15,
        proc: function() { THIS.reg.SBC_HL(THIS.reg.SP); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic: ["SBC", "HL", "SP"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // ADD IX,pp    IX <- IX + pp       11 011 101
    //                                  00 pp1 001
    //---------------------------------------------------------------------------------
    opeIX[oct("0011")] = {
        mnemonic:"ADD IX,BC",
        cycle: 15,
        proc: function() { THIS.reg.ADD_IX(THIS.reg.getBC()); },
        disasm: function(/*mem, addr*/) {
            return {
                code: [ 0xDD, 0x09 ],
                mnemonic: ["ADD", "IX", "BC"]
            };
        }
    };
    opeIX[oct("0031")] = {
        mnemonic:"ADD IX,DE",
        cycle: 15,
        proc: function() { THIS.reg.ADD_IX(THIS.reg.getDE()); },
        disasm: function(/*mem, addr*/) {
            return {
                code: [ 0xDD, 0x19 ],
                mnemonic: ["ADD", "IX", "DE"]
            };
        }
    };
    opeIX[oct("0051")] = {
        mnemonic:"ADD IX,IX",
        cycle: 15,
        proc: function() { THIS.reg.ADD_IX(THIS.reg.IX); },
        disasm: function(/*mem, addr*/) {
            return {
                code: [ 0xDD, 0x29 ],
                mnemonic: ["ADD", "IX", "IX"]
            };
        }
    };
    opeIX[oct("0071")] = {
        mnemonic:"ADD IX,SP",
        cycle: 15,
        proc: function() { THIS.reg.ADD_IX(THIS.reg.SP); },
        disasm: function(/*mem, addr*/) {
            return {
                code: [ 0xDD, 0x39 ],
                mnemonic: ["ADD", "IX", "SP"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // ADD IY,pp    IY <- IY + rr       11 111 101
    //                                  00 rr1 001
    //---------------------------------------------------------------------------------
    opeIY[oct("0011")] = {
        mnemonic:"ADD IY,BC",
        cycle: 15,
        proc: function() { THIS.reg.ADD_IY(THIS.reg.getBC()); },
        disasm: function(/*mem, addr*/) {
            return {
                code: [ 0xFD, 0x09 ],
                mnemonic: ["ADD", "IY", "BC"]
            };
        }
    };
    opeIY[oct("0031")] = {
        mnemonic:"ADD IY,DE",
        cycle: 15,
        proc: function() { THIS.reg.ADD_IY(THIS.reg.getDE()); },
        disasm: function(/*mem, addr*/) {
            return {
                code: [ 0xFD, 0x19 ],
                mnemonic: ["ADD", "IY", "DE"]
            };
        }
    };
    opeIY[oct("0051")] = {
        mnemonic:"ADD IY,IY",
        cycle: 15,
        proc: function() { THIS.reg.ADD_IY(THIS.reg.IY); },
        disasm: function(/*mem, addr*/) {
            return {
                code: [ 0xFD, 0x29 ],
                mnemonic: ["ADD", "IY", "IY"]
            };
        }
    };
    opeIY[oct("0071")] = {
        mnemonic:"ADD IY,SP",
        cycle: 15,
        proc: function() { THIS.reg.ADD_IY(THIS.reg.SP); },
        disasm: function(/*mem, addr*/) {
            return {
                code: [ 0xFD, 0x39 ],
                mnemonic: ["ADD", "IY", "SP"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // INC ss       ss <- ss + 1        00 ss0 011
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0003")] = {
        mnemonic:"INC BC",
        cycle: 6,
        proc: function() {
            THIS.reg.incBC();
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "BC"]};
        }
    };
    this.opecodeTable[oct("0023")] = {
        mnemonic:"INC DE",
        cycle: 6,
        proc: function() {
            THIS.reg.incDE();
        },
        disasm: function(mem, addr) {
            return { code:[mem.peek(addr)],
                mnemonic: ["INC", "DE"]
            };
        }
    };
    this.opecodeTable[oct("0043")] = {
        mnemonic:"INC HL",
        cycle: 6,
        proc: function() {
            THIS.reg.incHL();
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "HL"]
            };
        }
    };
    this.opecodeTable[oct("0063")] = {
        mnemonic:"INC SP",
        cycle: 6,
        proc: function() { THIS.reg.SP = (THIS.reg.SP + 1) & 0xffff; },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["INC", "SP"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // INC IX       IX <- IX + 1        11 011 101
    //                                  00 100 011
    //---------------------------------------------------------------------------------
    opeIX[oct("0043")] = {//oct("0010")-oct("0011") 0x23
        mnemonic:"INC IX",
        cycle: 10,
        proc: function() {
            THIS.reg.IX = (THIS.reg.IX + 1) & 0xffff;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic: ["INC", "IX"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // INC IY       IY <- IY + 1        11 111 101
    //                                  00 100 011
    //---------------------------------------------------------------------------------
    opeIY[oct("0043")] = {
        mnemonic:"INC IY",
        cycle: 10,
        proc: function() {
            THIS.reg.IY = (THIS.reg.IY + 1) & 0xffff;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic: ["INC", "IY"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // DEC ss       ss <- ss + 1        00 ss1 011
    //---------------------------------------------------------------------------------
    this.opecodeTable[oct("0013")] = {
        mnemonic:"DEC BC",
        cycle: 6,
        proc: function() {
            THIS.reg.decBC();
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["DEC", "BC"]
            };
        }
    };
    this.opecodeTable[oct("0033")] = {
        mnemonic:"DEC DE",
        cycle: 6,
        proc: function() {
            THIS.reg.decDE();
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["DEC", "DE"]
            };
        }
    };
    this.opecodeTable[oct("0053")] = {
        mnemonic:"DEC HL",
        cycle: 6,
        proc: function() {
            THIS.reg.decHL();
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["DEC", "HL"]
            };
        }
    };
    this.opecodeTable[oct("0073")] = {
        mnemonic:"DEC SP",
        cycle: 6,
        proc: function() {
            THIS.reg.SP = (THIS.reg.SP - 1) & 0xffff;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr)],
                mnemonic: ["DEC", "SP"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // DEC IX       IX <- IX + 1        11 011 101
    //                                  00 101 011
    //---------------------------------------------------------------------------------
    opeIX[oct("0053")] = {
        mnemonic:"DEC IX",
        cycle:10,
        proc: function() {
            THIS.reg.IX = (THIS.reg.IX - 1) & 0xffff;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic: ["DEC", "IX"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // DEC IY       IY <- IY + 1        11 111 101
    //                                  00 101 011
    //---------------------------------------------------------------------------------
    opeIY[oct("0053")] = {
        mnemonic:"DEC IY",
        cycle:10,
        proc: function() {
            THIS.reg.IY = (THIS.reg.IY - 1) & 0xffff;
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic: ["DEC", "IY"]
            };
        }
    };

    //=================================================================================
    // ローテイト・シフトグループ
    //=================================================================================
    this.opecodeTable[oct("0007")] = {
        mnemonic:"RLCA",
        cycle: 4,
        proc: function() { THIS.reg.RLCA(); },
        disasm: function(/*mem,addr*/) {
            return {
                code:[oct("0007")],
                mnemonic:["RLCA"]
            };
        }
    };
    this.opecodeTable[oct("0027")] = {
        mnemonic:"RLA",
        cycle: 4,
        proc: function() { THIS.reg.RLA(); },
        disasm: function(/*mem,addr*/) {
            return {
                code:[oct("0027")],
                mnemonic:["RLA"]
            };
        }
    };
    this.opecodeTable[oct("0017")] = {
        mnemonic:"RRCA",
        cycle: 4,
        proc: function() { THIS.reg.RRCA(); },
        disasm: function(/*mem,addr*/) {
            return {
                code:[oct("0017")],
                mnemonic:["RRCA"]
            };
        }
    };
    this.opecodeTable[oct("0037")] = {
        mnemonic:"RRA",
        cycle: 4,
        proc: function() { THIS.reg.RRA(); },
        disasm: function(/*mem,addr*/) {
            return {
                code:[oct("0037")],
                mnemonic:["RRA"]
            };
        }
    };
    
    opeIX[oct("0313")] = {//1100-1011 CB
        mnemonic: function() { return opeRotateIX; },
        proc: function() {
            var d = THIS.fetch();
            var feature = THIS.fetch();
            opeRotateIX[feature].proc(d);
        },
        disasm: function(mem, addr) {
            var feature = mem.peek(addr + 3);
            return opeRotateIX[feature].disasm(mem, addr);
        }
    };
    opeIY[oct("0313")] = {
        mnemonic: function() { return opeRotateIY; },
        proc: function() {
            var d = THIS.fetch();
            var feature = THIS.fetch();
            opeRotateIY[feature].proc(d);
        },
        disasm: function(mem, addr) {
            var feature = mem.peek(addr + 3);
            return opeRotateIY[feature].disasm(mem, addr);
        }
    };

    opeRotate[oct("0000")] = {
        mnemonic:"RLC B",
        cycle: 4,
        proc: function() {
            THIS.reg.B = THIS.reg.RLC(THIS.reg.B);
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","B"]
            };
        }
    };
    opeRotate[oct("0001")] = {
        mnemonic:"RLC C",
        cycle: 4,
        proc: function() {
            THIS.reg.C = THIS.reg.RLC(THIS.reg.C);
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","C"]
            };
        }
    };
    opeRotate[oct("0002")] = {
        mnemonic:"RLC D",
        cycle: 4,
        proc: function() {
            THIS.reg.D = THIS.reg.RLC(THIS.reg.D);
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","D"]
            };
        }
    };
    opeRotate[oct("0003")] = {
        mnemonic:"RLC E",
        cycle: 4,
        proc: function() {
            THIS.reg.E = THIS.reg.RLC(THIS.reg.E);
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","E"]
            };
        }
    };
    opeRotate[oct("0004")] = {
        mnemonic:"RLC H",
        cycle: 4,
        proc: function() {
            THIS.reg.H = THIS.reg.RLC(THIS.reg.H);
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","H"]
            };
        }
    };
    opeRotate[oct("0005")] = {
        mnemonic:"RLC L",
        cycle: 4,
        proc: function() {
            THIS.reg.L = THIS.reg.RLC(THIS.reg.L);
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","L"]
            };
        }
    };
    opeRotate[oct("0007")] = {
        mnemonic:"RLC A",
        cycle: 4,
        proc: function() {
            THIS.reg.A = THIS.reg.RLC(THIS.reg.A);
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","A"]
            };
        }
    };
    opeRotate[oct("0006")] = {
        mnemonic:"RLC (HL)",
        cycle: 15,
        proc: function() {
            var adr = THIS.reg.getHL();
            THIS.memory.poke(adr, THIS.reg.RLC(THIS.memory.peek(adr)));
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","(HL)"]
            };
        }
    };
    opeRotateIX[oct("0006")] = {
        mnemonic: "RLC (IX+d)",
        cycle: 23,
        proc: function(d) {
            var adr = THIS.reg.IX + d;
            THIS.memory.poke(adr, THIS.reg.RLC(THIS.memory.peek(adr)));
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RLC","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[oct("0006")] = {
        mnemonic: "RLC (IY+d)",
        cycle: 23,
        proc: function(d) {
            var adr = THIS.reg.IY + d;
            THIS.memory.poke(adr, THIS.reg.RLC(THIS.memory.peek(adr)));
        },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RLC","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotate[oct("0020")] = {
        mnemonic:"RL B",
        cycle: 8,
        proc: function() { THIS.reg.B = THIS.reg.RL(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","B"] };}
    };
    opeRotate[oct("0021")] = {
        mnemonic:"RL C",
        cycle: 8,
        proc: function() { THIS.reg.C = THIS.reg.RL(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","C"] };}
    };
    opeRotate[oct("0022")] = {
        mnemonic:"RL D",
        cycle: 8,
        proc: function() { THIS.reg.D = THIS.reg.RL(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","D"] };}
    };
    opeRotate[oct("0023")] = {
        mnemonic:"RL E",
        cycle: 8,
        proc: function() { THIS.reg.E = THIS.reg.RL(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","E"] };}
    };
    opeRotate[oct("0024")] = {
        mnemonic:"RL H",
        cycle: 8,
        proc: function() { THIS.reg.H = THIS.reg.RL(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","H"] };}
    };
    opeRotate[oct("0025")] = {
        mnemonic:"RL L",
        cycle: 8,
        proc: function() { THIS.reg.L = THIS.reg.RL(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","L"] };}
    };
    opeRotate[oct("0026")] = {
        mnemonic:"RL (HL)",
        cycle: 15,
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.RL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","(HL)"] };}
    };
    opeRotate[oct("0027")] = {
        mnemonic:"RL A",
        cycle: 8,
        proc: function() { THIS.reg.A = THIS.reg.RL(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","A"] };}
    };
    opeRotateIX[oct("0026")] = {
        mnemonic: "RL (IX+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.RL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RL","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[oct("0026")] = {
        mnemonic: "RL (IY+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.RL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RL","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeRotate[oct("0010")] = {
        mnemonic:"RRC B",
        cycle: 4,
        proc: function() { THIS.reg.B = THIS.reg.RRC(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","B"] };}
    };
    opeRotate[oct("0011")] = {
        mnemonic:"RRC C",
        cycle: 4,
        proc: function() { THIS.reg.C = THIS.reg.RRC(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","C"] };}
    };
    opeRotate[oct("0012")] = {
        mnemonic:"RRC D",
        cycle: 4,
        proc: function() { THIS.reg.D = THIS.reg.RRC(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","D"] };}
    };
    opeRotate[oct("0013")] = {
        mnemonic:"RRC E",
        cycle: 4,
        proc: function() { THIS.reg.E = THIS.reg.RRC(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","E"] };}
    };
    opeRotate[oct("0014")] = {
        mnemonic:"RRC H",
        cycle: 4,
        proc: function() { THIS.reg.H = THIS.reg.RRC(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","H"] };}
    };
    opeRotate[oct("0015")] = {
        mnemonic:"RRC L",
        cycle: 4,
        proc: function() { THIS.reg.L = THIS.reg.RRC(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","L"] };}
    };
    opeRotate[oct("0017")] = {
        mnemonic:"RRC A",
        cycle: 4,
        proc: function() { THIS.reg.A = THIS.reg.RRC(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","A"] };}
    };
    opeRotate[oct("0016")] = {
        mnemonic:"RRC (HL)",
        cycle: 15,
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.RRC(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","(HL)"] };}
    };
    opeRotateIX[oct("0016")] = {
        mnemonic: "RRC (IX+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.RRC(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RRC","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[oct("0016")] = {
        mnemonic: "RRC (IY+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.RRC(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RRC","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    
    opeRotate[oct("0030")] = {
        mnemonic:"RR B",
        cycle: 8,
        proc: function() { THIS.reg.B = THIS.reg.RR(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","B"] };}
    };
    opeRotate[oct("0031")] = {
        mnemonic:"RR C",
        cycle: 8,
        proc: function() { THIS.reg.C = THIS.reg.RR(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","C"] };}
    };
    opeRotate[oct("0032")] = {
        mnemonic:"RR D",
        cycle: 8,
        proc: function() { THIS.reg.D = THIS.reg.RR(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","D"] };}
    };
    opeRotate[oct("0033")] = {
        mnemonic:"RR E",
        cycle: 8,
        proc: function() { THIS.reg.E = THIS.reg.RR(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","E"] };}
    };
    opeRotate[oct("0034")] = {
        mnemonic:"RR H",
        cycle: 8,
        proc: function() { THIS.reg.H = THIS.reg.RR(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","H"] };}
    };
    opeRotate[oct("0035")] = {
        mnemonic:"RR L",
        cycle: 8,
        proc: function() { THIS.reg.L = THIS.reg.RR(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","L"] };}
    };
    opeRotate[oct("0036")] = {
        mnemonic:"RR (HL)",
        cycle: 15,
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.RR(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","(HL)"] };}
    };
    opeRotate[oct("0037")] = {
        mnemonic:"RR A",
        cycle: 8,
        proc: function() { THIS.reg.A = THIS.reg.RR(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","A"] };}
    };
    opeRotateIX[oct("0036")] = {
        mnemonic: "RR (IX+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.RR(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RR","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[oct("0036")] = {
        mnemonic: "RR (IY+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.RR(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RR","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeRotate[oct("0040")] = {
        mnemonic:"SLA B",
        cycle:8,
        proc: function() { THIS.reg.B = THIS.reg.SLA(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","B"] };}
    };
    opeRotate[oct("0041")] = {
        mnemonic:"SLA C",
        cycle:8,
        proc: function() { THIS.reg.C = THIS.reg.SLA(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","C"] };}
    };
    opeRotate[oct("0042")] = {
        mnemonic:"SLA D",
        cycle:8,
        proc: function() { THIS.reg.D = THIS.reg.SLA(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","D"] };}
    };
    opeRotate[oct("0043")] = {
        mnemonic:"SLA E",
        cycle:8,
        proc: function() { THIS.reg.E = THIS.reg.SLA(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","E"] };}
    };
    opeRotate[oct("0044")] = {
        mnemonic:"SLA H",
        cycle:8,
        proc: function() { THIS.reg.H = THIS.reg.SLA(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","H"] };}
    };
    opeRotate[oct("0045")] = {
        mnemonic:"SLA L",
        cycle:8,
        proc: function() { THIS.reg.L = THIS.reg.SLA(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","L"] };}
    };
    opeRotate[oct("0047")] = {
        mnemonic:"SLA A",
        cycle:8,
        proc: function() { THIS.reg.A = THIS.reg.SLA(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","A"] };}
    };
    opeRotate[oct("0046")] = {
        mnemonic:"SLA (HL)",
        cycle:15,
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.SLA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","(HL)"] };}
    };
    opeRotateIX[oct("0046")] = {
        mnemonic: "SLA (IX+d)",
        cycle:23,
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.SLA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SLA","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[oct("0046")] = {
        mnemonic: "SLA (IY+d)",
        cycle:23,
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.SLA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SLA","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeRotate[oct("0050")] = {
        mnemonic:"SRA B",
        cycle: 8,
        proc: function() { THIS.reg.B = THIS.reg.SRA(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","B"] };}
    };
    opeRotate[oct("0051")] = {
        mnemonic:"SRA C",
        cycle: 8,
        proc: function() { THIS.reg.C = THIS.reg.SRA(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","C"] };}
    };
    opeRotate[oct("0052")] = {
        mnemonic:"SRA D",
        cycle: 8,
        proc: function() { THIS.reg.D = THIS.reg.SRA(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","D"] };}
    };
    opeRotate[oct("0053")] = {
        mnemonic:"SRA E",
        cycle: 8,
        proc: function() { THIS.reg.E = THIS.reg.SRA(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","E"] };}
    };
    opeRotate[oct("0054")] = {
        mnemonic:"SRA H",
        cycle: 8,
        proc: function() { THIS.reg.H = THIS.reg.SRA(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","H"] };}
    };
    opeRotate[oct("0055")] = {
        mnemonic:"SRA L",
        cycle: 8,
        proc: function() { THIS.reg.L = THIS.reg.SRA(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","L"] };}
    };
    opeRotate[oct("0057")] = {
        mnemonic:"SRA A",
        cycle: 8,
        proc: function() { THIS.reg.A = THIS.reg.SRA(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","A"] };}
    };
    opeRotate[oct("0056")] = {
        mnemonic:"SRA (HL)",
        cycle: 15,
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.SRA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","(HL)"] };}
    };
    opeRotateIX[oct("0056")] = {
        mnemonic: "SRA (IX+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.SRA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SRA","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[oct("0056")] = {
        mnemonic: "SRA (IY+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.SRA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SRA","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeRotate[oct("0070")] = {
        mnemonic:"SRL B",
        cycle: 8,
        proc: function() { THIS.reg.B = THIS.reg.SRL(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","B"] };}
    };
    opeRotate[oct("0071")] = {
        mnemonic:"SRL C",
        cycle: 8,
        proc: function() { THIS.reg.C = THIS.reg.SRL(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","C"] };}
    };
    opeRotate[oct("0072")] = {
        mnemonic:"SRL D",
        cycle: 8,
        proc: function() { THIS.reg.D = THIS.reg.SRL(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","D"] };}
    };
    opeRotate[oct("0073")] = {
        mnemonic:"SRL E",
        cycle: 8,
        proc: function() { THIS.reg.E = THIS.reg.SRL(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","E"] };}
    };
    opeRotate[oct("0074")] = {
        mnemonic:"SRL H",
        cycle: 8,
        proc: function() { THIS.reg.H = THIS.reg.SRL(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","H"] };}
    };
    opeRotate[oct("0075")] = {
        mnemonic:"SRL L",
        cycle: 8,
        proc: function() { THIS.reg.L = THIS.reg.SRL(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","L"] };}
    };
    opeRotate[oct("0077")] = {
        mnemonic:"SRL A",
        cycle: 8,
        proc: function() { THIS.reg.A = THIS.reg.SRL(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","A"] };}
    };
    opeRotate[oct("0076")] = {
        mnemonic:"SRL (HL)",
        cycle: 15,
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.SRL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","(HL)"] };}
    };
    opeRotateIX[oct("0076")] = {
        mnemonic: "SRL (IX+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.SRL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SRL","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[oct("0076")] = {
        mnemonic: "SRL (IY+d)",
        cycle: 23,
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.SRL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SRL","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeMisc[oct("0157")] = {
        mnemonic:"RLD",
        cycle: 18,
        proc: function() {
            var adr = THIS.reg.getHL();
            var n = THIS.memory.peek(adr);
            var AH = THIS.reg.A & 0xf0;
            var AL = THIS.reg.A & 0x0f;
            var nH = (n >> 4) & 0x0f;
            var nL = (n >> 0) & 0x0f;
            
            THIS.reg.A = AH | nH;
            n = (nL << 4) | AL;
            
            THIS.memory.poke(adr, n);
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLD"]
            };
        }
    };
    opeMisc[oct("0147")] = {
        mnemonic:"RRD",
        cycle: 18,
        proc: function() {
            var adr = THIS.reg.getHL();
            var n = THIS.memory.peek(adr);
            var AH = THIS.reg.A & 0xf0;
            var AL = THIS.reg.A & 0x0F;
            var nH = (n >> 4) & 0x0f;
            var nL = (n >> 0) & 0x0f;

            THIS.reg.A = AH | nL;
            n = (AL << 4) | nH;
            
            THIS.memory.poke(adr, n);
        },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RRD"]
            };
        }
    };

    //=================================================================================
    // ビットセット・リセット及びテストグループ
    //=================================================================================

    var reg8=["B","C","D","E","H","L","(HL)","A"];
    var regI, bit;
    for(regI = 0; regI < reg8.length; regI++) {
        for(bit = 0; bit < 8; bit++) {
            opeRotate[oct("0100")|(bit<<3)|regI] = {
                mnemonic:"BIT " + bit + "," + reg8[regI],
                cycle:(function(r){ return r != 6 ? 8:12 }(regI)),
                proc: (function(b,r) {
                    if(r != 6) {
                        return function() {
                            var value = THIS.reg[reg8[r]];
                            if( (value & (1 << b)) != 0) {
                                THIS.reg.clearFlagZ();
                            } else {
                                THIS.reg.setFlagZ();
                            }
                            THIS.reg.setFlagH();
                            THIS.reg.clearFlagN();
                        };
                    } else {
                        return function() {
                            var adr = THIS.reg.getHL();
                            var value = THIS.memory.peek(adr);
                            if( (value & (1 << b)) != 0) {
                                THIS.reg.clearFlagZ();
                            } else {
                                THIS.reg.setFlagZ();
                            }
                            THIS.reg.setFlagH();
                            THIS.reg.clearFlagN();
                        };
                    }
                })(bit,regI),
                disasm: (function(b,n) {
                    return function(mem, addr) {
                        return {
                            code:[mem.peek(addr), mem.peek(addr + 1)],
                            mnemonic: ["BIT", b, n]
                        };
                    };
                })(bit,reg8[regI])
            };
        }
    }
    var disasm_bit_b_IDX_d = function(mem, addr, b, idx) {
        var d = THIS.memory.peek(addr + 2);
        return {
            code:[
                THIS.memory.peek(addr),
                THIS.memory.peek(addr + 1),
                d,
                THIS.memory.peek(addr + 3),
            ],
            mnemonic: ["BIT", "" + b, "(" + idx + "+" + d.HEX(2) + "H)"]
        };
    };
    opeRotateIX[oct("0106")] = {
        mnemonic:"BIT 0,(IX+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 0)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 0, "IX"); }
    };
    opeRotateIX[oct("0116")] = {
        mnemonic:"BIT 1,(IX+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 1)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 1, "IX"); }
    };
    opeRotateIX[oct("0126")] = {
        mnemonic:"BIT 2,(IX+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 2)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 2, "IX"); }
    };
    opeRotateIX[oct("0136")] = {
        mnemonic:"BIT 3,(IX+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 3)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 3, "IX"); }
    };
    opeRotateIX[oct("0146")] = {
        mnemonic:"BIT 4,(IX+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 4)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 4, "IX"); }
    };
    opeRotateIX[oct("0156")] = {
        mnemonic:"BIT 5,(IX+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 5)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 5, "IX"); }
    };
    opeRotateIX[oct("0166")] = {
        mnemonic:"BIT 6,(IX+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 6)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 6, "IX"); }
    };
    opeRotateIX[oct("0176")] = {
        mnemonic:"BIT 7,(IX+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 7)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 7, "IX"); }
    };

    opeRotateIY[oct("0106")] = {
        mnemonic:"BIT 0,(IY+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 0)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 0, "IY"); }
    };
    opeRotateIY[oct("0116")] = {
        mnemonic:"BIT 1,(IY+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 1)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 1, "IY"); }
    };
    opeRotateIY[oct("0126")] = {
        mnemonic:"BIT 2,(IY+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 2)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 2, "IY"); }
    };
    opeRotateIY[oct("0136")] = {
        mnemonic:"BIT 3,(IY+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 3)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 3, "IY"); }
    };
    opeRotateIY[oct("0146")] = {
        mnemonic:"BIT 4,(IY+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 4)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 4, "IY"); }
    };
    opeRotateIY[oct("0156")] = {
        mnemonic:"BIT 5,(IY+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 5)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 5, "IY"); }
    };
    opeRotateIY[oct("0166")] = {
        mnemonic:"BIT 6,(IY+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 6)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 6, "IY"); }
    };
    opeRotateIY[oct("0176")] = {
        mnemonic:"BIT 7,(IY+d)",
        cycle:20,
        proc: function(d) {
            if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 7)) {
                THIS.reg.clearFlagZ();
            } else {
                THIS.reg.setFlagZ();
            }
            THIS.reg.setFlagH();
            THIS.reg.clearFlagN()
        },
        disasm: function(mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 7, "IY"); }
    };

    for(regI = 0; regI < reg8.length; regI++) {
        for(bit = 0; bit < 8; bit++) {
            opeRotate[oct("0300")|(bit<<3)|regI] = {
                mnemonic:"SET " + bit + "," + reg8[regI],
                cycle:(function(r){ return r != 6 ? 4:15 }(regI)),
                proc: (function(b,r) {
                    if(r != 6) {
                        return function() {
                            THIS.reg[reg8[r]] |= (1 << b);
                        };
                    } else {
                        return function() {
                            var adr = THIS.reg.getHL();
                            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << b));
                        };
                    }
                })(bit,regI),
                disasm: (function(b,n) {
                    return function(mem, addr) {
                        return {
                            code:[mem.peek(addr), mem.peek(addr + 1)],
                            mnemonic: ["SET", b, n]
                        };
                    };
                })(bit,reg8[regI])
            };
        }
    }
    var disasm_set_b_IDX_d = function(mem, addr, b, idx) {
        var d = THIS.memory.peek(addr + 2);
        return {
            code:[
                THIS.memory.peek(addr + 0),
                THIS.memory.peek(addr + 1),
                d,
                THIS.memory.peek(addr + 3),
            ],
            mnemonic: ["SET", "" + b, "(" + idx + "+" + d.HEX(2) + "H)"]
        };
    };
    opeRotateIX[oct("0306")] = {//11 000 110
        mnemonic:"SET 0,(IX+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IX+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 0));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 0, "IX"); }
    };
    opeRotateIX[oct("0316")] = {
        mnemonic:"SET 1,(IX+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 1));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 1, "IX"); }
    };
    opeRotateIX[oct("0326")] = {
        mnemonic:"SET 2,(IX+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IX+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 2));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 2, "IX"); }
    };
    opeRotateIX[oct("0336")] = {
        mnemonic:"SET 3,(IX+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IX+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 3));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 3, "IX"); }
    };
    opeRotateIX[oct("0346")] = {
        mnemonic:"SET 4,(IX+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IX+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 4));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 4, "IX"); }
    };
    opeRotateIX[oct("0356")] = {
        mnemonic:"SET 5,(IX+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IX+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 5));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 5, "IX"); }
    };
    opeRotateIX[oct("0366")] = {
        mnemonic:"SET 6,(IX+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IX+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 6));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 6, "IX"); }
    };
    opeRotateIX[oct("0376")] = {
        mnemonic:"SET 7,(IX+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IX+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 7));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 7, "IX"); }
    };

    opeRotateIY[oct("0306")] = {
        mnemonic:"SET 0,(IY+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IY+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 0));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 0, "IY"); }
    };
    opeRotateIY[oct("0316")] = {
        mnemonic:"SET 1,(IY+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IY+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 1));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 1, "IY"); }
    };
    opeRotateIY[oct("0326")] = {
        mnemonic:"SET 2,(IY+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IY+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 2));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 2, "IY"); }
    };
    opeRotateIY[oct("0336")] = {
        mnemonic:"SET 3,(IY+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IY+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 3));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 3, "IY"); }
    };
    opeRotateIY[oct("0346")] = {
        mnemonic:"SET 4,(IY+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IY+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 4));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 4, "IY"); }
    };
    opeRotateIY[oct("0356")] = {
        mnemonic:"SET 5,(IY+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IY+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 5));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 5, "IY"); }
    };
    opeRotateIY[oct("0366")] = {
        mnemonic:"SET 6,(IY+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IY+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 6));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 6, "IY"); }
    };
    opeRotateIY[oct("0376")] = {
        mnemonic:"SET 7,(IY+d)",
        cycle:23,
        proc: function(d) {
            var adr = THIS.reg.IY+d;
            THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 7));
        },
        disasm: function(mem, addr) { return disasm_set_b_IDX_d(mem, addr, 7, "IY"); }
    };

    var procRES_8bit = function(b,r) {
        var bits = ~(1 << b);
        return function() {
            THIS.reg[r] &= bits;
        };
    };
    var disaRES_8bit = function(b,r) {
        var regidx = "BCDEHL A".indexOf(r);
        var bits = b << 3;
        return function(/*mem, addr*/) {
            return {
                code:[0xCB, oct("0200") | bits | regidx ],
                mnemonic: ["RES", b, r]
            };
        };
    };
    var procRES_xHL = function(b) {
        var bits = (~(1 << b) & 0xff);
        return (function(bits) { return function() {
            var adr = THIS.reg.getHL();
            var v0 = THIS.memory.peek(adr);
            var v1 = v0 & bits;
            THIS.memory.poke(adr, v1);
        };}(bits));
    };
    var disaRES_xHL = function(b) {
        var bits = b << 3;
        return (function(bits) { return function(/*mem, addr*/) {
            return {
                code:[0xCB, oct("0200") | bits | 6 ],
                mnemonic: ["RES", b, "(HL)"]
            };
        };}(bits));
    };
    var procRES_xIDXd = function(b, IDX) {
        var bits = 0xff & ~(1 << b);
        return (function(bits) { return function(d) {
            var adr = THIS.reg[IDX] + d;
            var v0 = THIS.memory.peek(adr);
            var v1 = v0 & bits;
            THIS.memory.poke(adr, v1);
        };}(bits));
    };
    var disaRES_xIDXd = function(b, IDX) {
        var bits = b << 3;
        var opecode = {"IX" : 0xDD, "IY" : 0xFD }[IDX];
        return (function(bits, opecode) { return function(mem, addr) {
            var d = mem.peek(addr + 2);
            var feature = mem.peek(addr + 3);
            return {
                code:[opecode, 0xCB, d, feature],
                mnemonic: ["RES", b, "(" + IDX + "+" + d.HEX(2) + "H)" ]
            };
        };}(bits, opecode));
    }
    opeRotate[oct("0200")] = { mnemonic:"RES 0,B", cycle:8, proc: procRES_8bit(0,"B"), disasm: disaRES_8bit(0,"B")};
    opeRotate[oct("0210")] = { mnemonic:"RES 1,B", cycle:8, proc: procRES_8bit(1,"B"), disasm: disaRES_8bit(1,"B")};
    opeRotate[oct("0220")] = { mnemonic:"RES 2,B", cycle:8, proc: procRES_8bit(2,"B"), disasm: disaRES_8bit(2,"B")};
    opeRotate[oct("0230")] = { mnemonic:"RES 3,B", cycle:8, proc: procRES_8bit(3,"B"), disasm: disaRES_8bit(3,"B")};
    opeRotate[oct("0240")] = { mnemonic:"RES 4,B", cycle:8, proc: procRES_8bit(4,"B"), disasm: disaRES_8bit(4,"B")};
    opeRotate[oct("0250")] = { mnemonic:"RES 5,B", cycle:8, proc: procRES_8bit(5,"B"), disasm: disaRES_8bit(5,"B")};
    opeRotate[oct("0260")] = { mnemonic:"RES 6,B", cycle:8, proc: procRES_8bit(6,"B"), disasm: disaRES_8bit(6,"B")};
    opeRotate[oct("0270")] = { mnemonic:"RES 7,B", cycle:8, proc: procRES_8bit(7,"B"), disasm: disaRES_8bit(7,"B")};

    opeRotate[oct("0201")] = { mnemonic:"RES 0,C", cycle:8, proc: procRES_8bit(0,"C"), disasm: disaRES_8bit(0,"C")};
    opeRotate[oct("0211")] = { mnemonic:"RES 1,C", cycle:8, proc: procRES_8bit(1,"C"), disasm: disaRES_8bit(1,"C")};
    opeRotate[oct("0221")] = { mnemonic:"RES 2,C", cycle:8, proc: procRES_8bit(2,"C"), disasm: disaRES_8bit(2,"C")};
    opeRotate[oct("0231")] = { mnemonic:"RES 3,C", cycle:8, proc: procRES_8bit(3,"C"), disasm: disaRES_8bit(3,"C")};
    opeRotate[oct("0241")] = { mnemonic:"RES 4,C", cycle:8, proc: procRES_8bit(4,"C"), disasm: disaRES_8bit(4,"C")};
    opeRotate[oct("0251")] = { mnemonic:"RES 5,C", cycle:8, proc: procRES_8bit(5,"C"), disasm: disaRES_8bit(5,"C")};
    opeRotate[oct("0261")] = { mnemonic:"RES 6,C", cycle:8, proc: procRES_8bit(6,"C"), disasm: disaRES_8bit(6,"C")};
    opeRotate[oct("0271")] = { mnemonic:"RES 7,C", cycle:8, proc: procRES_8bit(7,"C"), disasm: disaRES_8bit(7,"C")};

    opeRotate[oct("0202")] = { mnemonic:"RES 0,D", cycle:8, proc: procRES_8bit(0,"D"), disasm: disaRES_8bit(0,"D")};
    opeRotate[oct("0212")] = { mnemonic:"RES 1,D", cycle:8, proc: procRES_8bit(1,"D"), disasm: disaRES_8bit(1,"D")};
    opeRotate[oct("0222")] = { mnemonic:"RES 2,D", cycle:8, proc: procRES_8bit(2,"D"), disasm: disaRES_8bit(2,"D")};
    opeRotate[oct("0232")] = { mnemonic:"RES 3,D", cycle:8, proc: procRES_8bit(3,"D"), disasm: disaRES_8bit(3,"D")};
    opeRotate[oct("0242")] = { mnemonic:"RES 4,D", cycle:8, proc: procRES_8bit(4,"D"), disasm: disaRES_8bit(4,"D")};
    opeRotate[oct("0252")] = { mnemonic:"RES 5,D", cycle:8, proc: procRES_8bit(5,"D"), disasm: disaRES_8bit(5,"D")};
    opeRotate[oct("0262")] = { mnemonic:"RES 6,D", cycle:8, proc: procRES_8bit(6,"D"), disasm: disaRES_8bit(6,"D")};
    opeRotate[oct("0272")] = { mnemonic:"RES 7,D", cycle:8, proc: procRES_8bit(7,"D"), disasm: disaRES_8bit(7,"D")};

    opeRotate[oct("0203")] = { mnemonic:"RES 0,E", cycle:8, proc: procRES_8bit(0,"E"), disasm: disaRES_8bit(0,"E")};
    opeRotate[oct("0213")] = { mnemonic:"RES 1,E", cycle:8, proc: procRES_8bit(1,"E"), disasm: disaRES_8bit(1,"E")};
    opeRotate[oct("0223")] = { mnemonic:"RES 2,E", cycle:8, proc: procRES_8bit(2,"E"), disasm: disaRES_8bit(2,"E")};
    opeRotate[oct("0233")] = { mnemonic:"RES 3,E", cycle:8, proc: procRES_8bit(3,"E"), disasm: disaRES_8bit(3,"E")};
    opeRotate[oct("0243")] = { mnemonic:"RES 4,E", cycle:8, proc: procRES_8bit(4,"E"), disasm: disaRES_8bit(4,"E")};
    opeRotate[oct("0253")] = { mnemonic:"RES 5,E", cycle:8, proc: procRES_8bit(5,"E"), disasm: disaRES_8bit(5,"E")};
    opeRotate[oct("0263")] = { mnemonic:"RES 6,E", cycle:8, proc: procRES_8bit(6,"E"), disasm: disaRES_8bit(6,"E")};
    opeRotate[oct("0273")] = { mnemonic:"RES 7,E", cycle:8, proc: procRES_8bit(7,"E"), disasm: disaRES_8bit(7,"E")};

    opeRotate[oct("0204")] = { mnemonic:"RES 0,H", cycle:8, proc: procRES_8bit(0,"H"), disasm: disaRES_8bit(0,"H")};
    opeRotate[oct("0214")] = { mnemonic:"RES 1,H", cycle:8, proc: procRES_8bit(1,"H"), disasm: disaRES_8bit(1,"H")};
    opeRotate[oct("0224")] = { mnemonic:"RES 2,H", cycle:8, proc: procRES_8bit(2,"H"), disasm: disaRES_8bit(2,"H")};
    opeRotate[oct("0234")] = { mnemonic:"RES 3,H", cycle:8, proc: procRES_8bit(3,"H"), disasm: disaRES_8bit(3,"H")};
    opeRotate[oct("0244")] = { mnemonic:"RES 4,H", cycle:8, proc: procRES_8bit(4,"H"), disasm: disaRES_8bit(4,"H")};
    opeRotate[oct("0254")] = { mnemonic:"RES 5,H", cycle:8, proc: procRES_8bit(5,"H"), disasm: disaRES_8bit(5,"H")};
    opeRotate[oct("0264")] = { mnemonic:"RES 6,H", cycle:8, proc: procRES_8bit(6,"H"), disasm: disaRES_8bit(6,"H")};
    opeRotate[oct("0274")] = { mnemonic:"RES 7,H", cycle:8, proc: procRES_8bit(7,"H"), disasm: disaRES_8bit(7,"H")};

    opeRotate[oct("0205")] = { mnemonic:"RES 0,L", cycle:8, proc: procRES_8bit(0,"L"), disasm: disaRES_8bit(0,"L")};
    opeRotate[oct("0215")] = { mnemonic:"RES 1,L", cycle:8, proc: procRES_8bit(1,"L"), disasm: disaRES_8bit(1,"L")};
    opeRotate[oct("0225")] = { mnemonic:"RES 2,L", cycle:8, proc: procRES_8bit(2,"L"), disasm: disaRES_8bit(2,"L")};
    opeRotate[oct("0235")] = { mnemonic:"RES 3,L", cycle:8, proc: procRES_8bit(3,"L"), disasm: disaRES_8bit(3,"L")};
    opeRotate[oct("0245")] = { mnemonic:"RES 4,L", cycle:8, proc: procRES_8bit(4,"L"), disasm: disaRES_8bit(4,"L")};
    opeRotate[oct("0255")] = { mnemonic:"RES 5,L", cycle:8, proc: procRES_8bit(5,"L"), disasm: disaRES_8bit(5,"L")};
    opeRotate[oct("0265")] = { mnemonic:"RES 6,L", cycle:8, proc: procRES_8bit(6,"L"), disasm: disaRES_8bit(6,"L")};
    opeRotate[oct("0275")] = { mnemonic:"RES 7,L", cycle:8, proc: procRES_8bit(7,"L"), disasm: disaRES_8bit(7,"L")};

    opeRotate[oct("0207")] = { mnemonic:"RES 0,A", cycle:8, proc: procRES_8bit(0,"A"), disasm: disaRES_8bit(0,"A")};
    opeRotate[oct("0217")] = { mnemonic:"RES 1,A", cycle:8, proc: procRES_8bit(1,"A"), disasm: disaRES_8bit(1,"A")};
    opeRotate[oct("0227")] = { mnemonic:"RES 2,A", cycle:8, proc: procRES_8bit(2,"A"), disasm: disaRES_8bit(2,"A")};
    opeRotate[oct("0237")] = { mnemonic:"RES 3,A", cycle:8, proc: procRES_8bit(3,"A"), disasm: disaRES_8bit(3,"A")};
    opeRotate[oct("0247")] = { mnemonic:"RES 4,A", cycle:8, proc: procRES_8bit(4,"A"), disasm: disaRES_8bit(4,"A")};
    opeRotate[oct("0257")] = { mnemonic:"RES 5,A", cycle:8, proc: procRES_8bit(5,"A"), disasm: disaRES_8bit(5,"A")};
    opeRotate[oct("0267")] = { mnemonic:"RES 6,A", cycle:8, proc: procRES_8bit(6,"A"), disasm: disaRES_8bit(6,"A")};
    opeRotate[oct("0277")] = { mnemonic:"RES 7,A", cycle:8, proc: procRES_8bit(7,"A"), disasm: disaRES_8bit(7,"A")};

    opeRotate[oct("0206")] = { mnemonic:"RES 0,(HL)", cycle:15, proc: procRES_xHL(0), disasm: disaRES_xHL(0)};
    opeRotate[oct("0216")] = { mnemonic:"RES 1,(HL)", cycle:15, proc: procRES_xHL(1), disasm: disaRES_xHL(1)};
    opeRotate[oct("0226")] = { mnemonic:"RES 2,(HL)", cycle:15, proc: procRES_xHL(2), disasm: disaRES_xHL(2)};
    opeRotate[oct("0236")] = { mnemonic:"RES 3,(HL)", cycle:15, proc: procRES_xHL(3), disasm: disaRES_xHL(3)};
    opeRotate[oct("0246")] = { mnemonic:"RES 4,(HL)", cycle:15, proc: procRES_xHL(4), disasm: disaRES_xHL(4)};
    opeRotate[oct("0256")] = { mnemonic:"RES 5,(HL)", cycle:15, proc: procRES_xHL(5), disasm: disaRES_xHL(5)};
    opeRotate[oct("0266")] = { mnemonic:"RES 6,(HL)", cycle:15, proc: procRES_xHL(6), disasm: disaRES_xHL(6)};
    opeRotate[oct("0276")] = { mnemonic:"RES 7,(HL)", cycle:15, proc: procRES_xHL(7), disasm: disaRES_xHL(7)};

    // 10 000 110
    opeRotateIX[oct("0206")] = { mnemonic:"RES 0,(IX+d)", cycle:23, proc: procRES_xIDXd(0,"IX"), disasm: disaRES_xIDXd(0,"IX")};
    opeRotateIX[oct("0216")] = { mnemonic:"RES 1,(IX+d)", cycle:23, proc: procRES_xIDXd(1,"IX"), disasm: disaRES_xIDXd(1,"IX")};
    opeRotateIX[oct("0226")] = { mnemonic:"RES 2,(IX+d)", cycle:23, proc: procRES_xIDXd(2,"IX"), disasm: disaRES_xIDXd(2,"IX")};
    opeRotateIX[oct("0236")] = { mnemonic:"RES 3,(IX+d)", cycle:23, proc: procRES_xIDXd(3,"IX"), disasm: disaRES_xIDXd(3,"IX")};
    opeRotateIX[oct("0246")] = { mnemonic:"RES 4,(IX+d)", cycle:23, proc: procRES_xIDXd(4,"IX"), disasm: disaRES_xIDXd(4,"IX")};
    opeRotateIX[oct("0256")] = { mnemonic:"RES 5,(IX+d)", cycle:23, proc: procRES_xIDXd(5,"IX"), disasm: disaRES_xIDXd(5,"IX")};
    opeRotateIX[oct("0266")] = { mnemonic:"RES 6,(IX+d)", cycle:23, proc: procRES_xIDXd(6,"IX"), disasm: disaRES_xIDXd(6,"IX")};
    opeRotateIX[oct("0276")] = { mnemonic:"RES 7,(IX+d)", cycle:23, proc: procRES_xIDXd(7,"IX"), disasm: disaRES_xIDXd(7,"IX")};

    opeRotateIY[oct("0206")] = { mnemonic:"RES 0,(IY+d)", cycle:23, proc: procRES_xIDXd(0,"IY"), disasm: disaRES_xIDXd(0,"IY")};
    opeRotateIY[oct("0216")] = { mnemonic:"RES 1,(IY+d)", cycle:23, proc: procRES_xIDXd(1,"IY"), disasm: disaRES_xIDXd(1,"IY")};
    opeRotateIY[oct("0226")] = { mnemonic:"RES 2,(IY+d)", cycle:23, proc: procRES_xIDXd(2,"IY"), disasm: disaRES_xIDXd(2,"IY")};
    opeRotateIY[oct("0236")] = { mnemonic:"RES 3,(IY+d)", cycle:23, proc: procRES_xIDXd(3,"IY"), disasm: disaRES_xIDXd(3,"IY")};
    opeRotateIY[oct("0246")] = { mnemonic:"RES 4,(IY+d)", cycle:23, proc: procRES_xIDXd(4,"IY"), disasm: disaRES_xIDXd(4,"IY")};
    opeRotateIY[oct("0256")] = { mnemonic:"RES 5,(IY+d)", cycle:23, proc: procRES_xIDXd(5,"IY"), disasm: disaRES_xIDXd(5,"IY")};
    opeRotateIY[oct("0266")] = { mnemonic:"RES 6,(IY+d)", cycle:23, proc: procRES_xIDXd(6,"IY"), disasm: disaRES_xIDXd(6,"IY")};
    opeRotateIY[oct("0276")] = { mnemonic:"RES 7,(IY+d)", cycle:23, proc: procRES_xIDXd(7,"IY"), disasm: disaRES_xIDXd(7,"IY")};

    //=================================================================================
    // ジャンプグループ
    //=================================================================================
    var disaJumpGroup = function(mem, addr) {
        var opecode = mem.peek(addr);
        var code = [opecode];
        var mnemonic = [];
        var e,n0,n1;
        var ref_addr_to = null;

        switch(opecode & oct("0300")) {
            case oct("0000"):
                mnemonic.push("JR");
                e = Z80BinUtil.getSignedByte(mem.peek(addr+1));
                ref_addr_to = addr + e + 2;
                code.push(e & 0xff);
                if(e + 2 >= 0) { e = "+" + (e + 2); } else { e = "" + (e + 2); }
                switch(opecode & oct("0070")) {
                    case oct("0030"): break;
                    case oct("0070"): mnemonic.push("C"); break;
                    case oct("0050"): mnemonic.push("Z"); break;
                    case oct("0060"): mnemonic.push("NC"); break;
                    case oct("0040"): mnemonic.push("NZ"); break;
                    default:
                        throw "UNKNOWN OPCODE";
                }
                mnemonic.push(ref_addr_to.HEX(4) + 'H;(' + e + ')' );
                break;
            case oct("0300"):
                mnemonic.push("JP");
                switch(opecode & oct("0003")) {
                    case 1: mnemonic.push("(HL)"); break;
                    case 2:
                        n0 = mem.peek(addr+1);
                        n1 = mem.peek(addr+2);
                        ref_addr_to = Z80BinUtil.pair(n1, n0);
                        code.push(n0);
                        code.push(n1);
                        switch(opecode & oct("0070")) {
                            case oct("0000"): mnemonic.push("NZ"); break;
                            case oct("0010"): mnemonic.push("Z");  break;
                            case oct("0020"): mnemonic.push("NC"); break;
                            case oct("0030"): mnemonic.push("C");  break;
                            case oct("0040"): mnemonic.push("PO"); break;
                            case oct("0050"): mnemonic.push("PE"); break;
                            case oct("0060"): mnemonic.push("P");  break;
                            case oct("0070"): mnemonic.push("M");  break;
                        }
                        mnemonic.push(n1.HEX(2) + n0.HEX(2) + 'H');
                        break;
                    case 3:
                        n0 = mem.peek(addr+1);
                        n1 = mem.peek(addr+2);
                        ref_addr_to = Z80BinUtil.pair(n1, n0);
                        code.push(n0);
                        code.push(n1);
                        mnemonic.push(n1.HEX(2) + n0.HEX(2) + 'H');
                        break;
                }
                break;
            default:
                throw "UNKNOWN OPCODE";
        }
        return { code:code, mnemonic:mnemonic, ref_addr_to: ref_addr_to };
    };
    this.opecodeTable[oct("0303")] = {
        mnemonic:"JP nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); THIS.reg.PC = nn; },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0302")] = {
        mnemonic:"JP NZ,nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagZ()) { THIS.reg.PC = nn; } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0312")] = {
        mnemonic:"JP Z,nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagZ())  { THIS.reg.PC = nn; } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0322")] = {
        mnemonic:"JP NC,nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagC()) { THIS.reg.PC = nn; } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0332")] = {
        mnemonic:"JP C,nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagC())  { THIS.reg.PC = nn; } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0342")] = {
        mnemonic:"JP PO,nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagP()) { THIS.reg.PC = nn; } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0352")] = {
        mnemonic:"JP PE,nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagP())  { THIS.reg.PC = nn; } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0362")] = {
        mnemonic:"JP P,nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagS()) { THIS.reg.PC = nn; } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0372")] = {
        mnemonic:"JP M,nn",
        "cycle": 10,
        proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagS())  { THIS.reg.PC = nn; } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0030")] = {
        mnemonic:"JR e",
        "cycle": 12,
        proc: function() { var e = THIS.fetch(); THIS.reg.jumpRel(e); },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0070")] = {
        mnemonic:"JR C,e",
        "cycle": 12,
        proc: function() { var e = THIS.fetch(); if(THIS.reg.flagC())   { THIS.reg.jumpRel(e); } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0050")] = {
        mnemonic:"JR Z,e",
        "cycle": 12,
        proc: function() { var e = THIS.fetch(); if(THIS.reg.flagZ())   { THIS.reg.jumpRel(e); } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0060")] = {
        mnemonic:"JR NC,e",
        "cycle": 12,
        proc: function() { var e = THIS.fetch(); if(!THIS.reg.flagC())  { THIS.reg.jumpRel(e); } },
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0040")] = {
        mnemonic:"JR NZ,e",
        proc: function() { var e = THIS.fetch(); if(!THIS.reg.flagZ())  { THIS.reg.jumpRel(e); } },
        "cycle": 12,
        disasm: disaJumpGroup
    };
    this.opecodeTable[oct("0351")] = {
        mnemonic:"JP (HL)",
        "cycle": 4,
        proc: function() { THIS.reg.PC = THIS.reg.getHL(); },
        disasm: disaJumpGroup
    };
    opeIX[oct("0351")] = {
        mnemonic:"JP (IX)",
        "cycle": 8,
        proc: function() { THIS.reg.PC = THIS.reg.IX; },
        disasm: function(mem,addr) {
            return {code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:['JP','(IX)'] };
        }
    };
    opeIY[oct("0351")] = {
        mnemonic:"JP (IY)",
        "cycle": 8,
        proc: function() { THIS.reg.PC = THIS.reg.IY; },
        disasm: function(mem,addr) { return {code:[mem.peek(addr), mem.peek(addr+1)],
            mnemonic:['JP','(IY)'] };
        }
    };

    //
    // Z80 Undefined Instruction
    //
    opeIX[/* DD 44 = 01-000-100 = */ oct("0104")] = {
        mnemonic:"LD B,IXH",
        proc: function() {
            THIS.reg.B = ((THIS.reg.IX >> 8) & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "LD", "B", "IXH" ]
            }
        }
    };
    opeIX[/* DD 4D = 01-001-101 = */ oct("0115")] = {
        mnemonic:"LD C,IXL",
        proc: function() {
            THIS.reg.C = (THIS.reg.IX & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "LD", "C", "IXL" ]
            }
        }
    };
    opeIX[/* DD 60 = 01-100-000 = */ oct("0140")] = {
        mnemonic:"LD IXH,B",
        proc: function() {
            THIS.reg.IX = (0xff00 & (THIS.reg.B << 8)) | (THIS.reg.IX & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "LD", "IXH", "B" ]
            }
        }
    };
    opeIX[/* DD 67 = 01-100-111 = */ oct("0147")] = {
        mnemonic:"LD IXH,A",
        proc: function() {
            THIS.reg.IX = (0xff00 & (THIS.reg.A << 8)) | (THIS.reg.IX & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "LD", "IXH", "A" ]
            }
        }
    };
    opeIX[/* DD 69 = 01-101-001 = */ oct("0151")] = {
        mnemonic:"LD IXL,C",
        proc: function() {
            THIS.reg.IX = (0xff00 & THIS.reg.IX ) | (THIS.reg.C & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "LD", "IXL", "C" ]
            }
        }
    };
    opeIX[/* DD 6F = 01-101-111 = */ oct("0157")] = {
        mnemonic:"LD IXL,A",
        proc: function() {
            THIS.reg.IX = (0xff00 & THIS.reg.IX ) | (THIS.reg.A & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "LD", "IXL", "A" ]
            }
        }
    };
    opeIX[/* DD 7D = 01-111-101 = */ oct("0175")] = {
        mnemonic:"LD A,IXL",
        proc: function() {
            THIS.reg.A = (THIS.reg.IX & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "LD", "A", "IXL" ]
            }
        }
    };
    opeIX[/* DD 84 = 10-000-100 = */ oct("0204")] = {
        mnemonic:"ADD A,IXH",
        proc: function() {
            THIS.reg.addAcc((THIS.reg.IX >> 8)& 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "ADD", "A", "IXH" ]
            }
        }
    };
    opeIX[/* DD 85 = 10-000-101 = */ oct("0205")] = {
        mnemonic:"ADD A,IXL",
        proc: function() {
            THIS.reg.addAcc(THIS.reg.IX & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "ADD", "A", "IXL" ]
            }
        }
    };
    opeIX[/* DD BD = 10-111-101 = */ oct("0275")] = {
        mnemonic:"CP IXL",
        proc: function() {
            THIS.reg.compareAcc(THIS.reg.IX & 0xff);
        },
        disasm: function(mem, addr) {
            return {
                code: [ mem.peek(addr), mem.peek(addr+1) ],
                mnemonic: [ "CP", "IXL" ]
            }
        }
    };

    this.opecodeTable[oct("0020")] = {
        mnemonic:"DJNZ",
        "cycle": 13,
        proc: function() {
            var e = THIS.fetch();
            THIS.reg.decrement("B");
            if(THIS.reg.B) {
                THIS.reg.jumpRel(e);
            }
        },
        disasm: function(mem,addr) {
            var e = Z80BinUtil.getSignedByte(mem.peek(addr+1));
            var ref_addr_to = addr + e + 2;
            return {
                code:[mem.peek(addr), mem.peek(addr + 1)],
                mnemonic:['DJNZ', ref_addr_to.HEX(4) + 'H;(' + (((e + 2 >= 0) ? "+" : "" ) + (e + 2)) + ')'],
                ref_addr_to: ref_addr_to
            };
        }
    };
    //=================================================================================
    // コールリターングループ
    //=================================================================================
    this.opecodeTable[oct("0315")] = {
        mnemonic:"CALL nn",
        cycle: 17,
        proc: function() {
            var nn = THIS.fetchPair();
            THIS.pushPair(THIS.reg.PC);
            THIS.reg.PC = nn;
        },
        disasm: function(m,a) {
            var l = m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL",""+addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };
    this.opecodeTable[oct("0304")] = {
        mnemonic:"CALL NZ,nn",
        cycle: "NZ→17,Z→10",
        proc: function() {
            var nn = THIS.fetchPair();
            if(!THIS.reg.flagZ()) {
                THIS.pushPair(THIS.reg.PC);
                THIS.reg.PC = nn;
                return 17;
            }
            return 10;
        },
        disasm: function(m,a) {
            var l=m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL","NZ",addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };
    this.opecodeTable[oct("0314")] = {
        mnemonic:"CALL Z,nn",
        cycle: "Z→17,NZ→10",
        proc: function() {
            var nn = THIS.fetchPair();
            if(THIS.reg.flagZ())  {
                THIS.pushPair(THIS.reg.PC);
                THIS.reg.PC = nn;
                return 17;
            }
            return 10;
        },
        disasm: function(m,a) {
            var l=m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL","Z",addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };
    this.opecodeTable[oct("0324")] = {
        mnemonic:"CALL NC,nn",
        cycle: "NC→17, C→10",
        proc: function() {
            var nn = THIS.fetchPair();
            if(!THIS.reg.flagC()) {
                THIS.pushPair(THIS.reg.PC);
                THIS.reg.PC = nn;
                return 17;
            }
            return 10;
        },
        disasm: function(m,a) {
            var l=m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL","NC",addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };
    this.opecodeTable[oct("0334")] = {
        mnemonic:"CALL C,nn",
        cycle: "C→17, NC→10",
        proc: function() {
            var nn = THIS.fetchPair();
            if(THIS.reg.flagC())  {
                THIS.pushPair(THIS.reg.PC);
                THIS.reg.PC = nn;
                return 17;
            }
            return 10;
        },
        disasm: function(m,a) {
            var l=m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL","C",addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };
    this.opecodeTable[oct("0344")] = {
        mnemonic:"CALL PO,nn",
        cycle: "Parity Odd→17, Even→10",
        proc: function() {
            var nn = THIS.fetchPair();
            if(!THIS.reg.flagP()) {
                THIS.pushPair(THIS.reg.PC);
                THIS.reg.PC = nn;
                return 17;
            }
            return 10;
        },
        disasm: function(m,a) {
            var l=m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL","PO",addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };
    this.opecodeTable[oct("0354")] = {
        mnemonic:"CALL PE,nn",
        cycle: "Parity Even→17, Odd→10",
        proc: function() {
            var nn = THIS.fetchPair();
            if(THIS.reg.flagP())  {
                THIS.pushPair(THIS.reg.PC);
                THIS.reg.PC = nn;
                return 17;
            }
            return 10;
        },
        disasm: function(m,a) {
            var l=m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL","PE",addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };
    this.opecodeTable[oct("0364")] = {
        mnemonic:"CALL P,nn",
        cycle: "P→17, M→10",
        proc: function() {
            var nn = THIS.fetchPair();
            if(!THIS.reg.flagS()) {
                THIS.pushPair(THIS.reg.PC);
                THIS.reg.PC = nn;
                return 17;
            }
            return 10;
        },
        disasm: function(m,a) {
            var l=m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL","P",addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };
    this.opecodeTable[oct("0374")] = {
        mnemonic:"CALL M,nn",
        cycle: "M→17, P→10",
        proc: function() {
            var nn = THIS.fetchPair();
            if(THIS.reg.flagS())  {
                THIS.pushPair(THIS.reg.PC);
                THIS.reg.PC = nn;
                return 17;
            }
            return 10;
        },
        disasm: function(m,a) {
            var l=m.peek(a+1),h=m.peek(a+2);
            var addr=Z80BinUtil.pair(h,l);
            return {
                code:[m.peek(a),l,h],
                mnemonic:["CALL","M",addr.HEX(4)+"H"],
                ref_addr_to:addr
            };
        }
    };

    this.opecodeTable[oct("0311")] = {
        mnemonic:"RET",
        "cycle": 10,
        proc: function() { THIS.reg.PC = THIS.popPair(); },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET"]
            };
        }
    };
    this.opecodeTable[oct("0300")] = {
        mnemonic:"RET NZ",
        "cycle": "NZ→11, Z→5",
        proc: function() { if(!THIS.reg.flagZ()) { THIS.reg.PC = THIS.popPair(); return 11; } return 5; },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET","NZ"]
            };
        }
    };
    this.opecodeTable[oct("0310")] = {
        mnemonic:"RET Z",
        "cycle": "Z→5, NZ→11",
        proc: function() { if(THIS.reg.flagZ())  { THIS.reg.PC = THIS.popPair(); return 11; } return 5; },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET","Z"]
            };
        }
    };
    this.opecodeTable[oct("0320")] = {
        mnemonic:"RET NC",
        "cycle": "NC→11,C→5",
        proc: function() { if(!THIS.reg.flagC()) { THIS.reg.PC = THIS.popPair(); return 11; } return 5; },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET","NC"]
            };
        }
    };
    this.opecodeTable[oct("0330")] = {
        mnemonic:"RET C",
        "cycle": "C→11,NC→5",
        proc: function() { if(THIS.reg.flagC())  { THIS.reg.PC = THIS.popPair(); return 11; } return 5; },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET","C"]
            };
        }
    };
    this.opecodeTable[oct("0340")] = {
        mnemonic:"RET PO",
        "cycle": "Parity Odd→11, Parity Even→5",
        proc: function() { if(!THIS.reg.flagP()) { THIS.reg.PC = THIS.popPair(); return 11; } return 5; },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET","PO"]
            };
        }
    };
    this.opecodeTable[oct("0350")] = {
        mnemonic:"RET PE",
        "cycle": "Parity Even→11, Parity Odd→5",
        proc: function() { if(THIS.reg.flagP())  { THIS.reg.PC = THIS.popPair(); return 11; } return 5; },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET","PE"]
            };
        }
    };
    this.opecodeTable[oct("0360")] = {
        mnemonic:"RET P",
        "cycle": "P→11, M→5",
        proc: function() { if(!THIS.reg.flagS()) { THIS.reg.PC = THIS.popPair(); return 11; } return 5; },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET","P"]
            };
        }
    };
    this.opecodeTable[oct("0370")] = {
        mnemonic:"RET M",
        "cycle": "M→11, P→5",
        proc: function() { if(THIS.reg.flagS())  { THIS.reg.PC = THIS.popPair(); return 11; } return 5; },
        disasm: function(m,a) {
            return{
                code:[m.peek(a)],
                mnemonic:["RET","M"]
            };
        }
    };

    opeMisc[oct("0115")] = {
        mnemonic:"RETI",
        "cycle": 15,
        proc: function() {
            THIS.reg.PC = THIS.popPair();
            THIS.IFF1 = THIS.IFF2;
        },
        disasm: function(m,a) {
            return{
                code:[m.peek(a),m.peek(a+1)],
                mnemonic:["RETI"]
            };
        }
    };
    opeMisc[oct("0105")] = {
        mnemonic:"RETN",
        "cycle": 14,
        proc: function() {
            THIS.reg.PC = THIS.popPair();
            THIS.IFF1 = THIS.IFF2;
        },
        disasm: function(m,a) {
            return{
                code:[m.peek(a),m.peek(a+1)],
                mnemonic:["RETN"]
            };
        }
    };

    var rstVt=[0x00,0x08,0x10,0x18,0x20,0x28,0x30,0x38];
    for(var rstI = 0; rstI < rstVt.length; rstI++) {
        this.opecodeTable[oct("0307") | (rstI << 3)] = {
            mnemonic: "RST " + rstVt[rstI].HEX(2) + "H",
            proc: (function(vec) {
                    return function() {
                        THIS.pushPair(THIS.reg.PC);
                        THIS.reg.PC = vec;
                    }
                })(rstVt[rstI]),
            "cycle": 12,
            disasm: (function(vect) {
                    return function(mem, addr) {
                        return {
                            code:[mem.peek(addr)],
                            mnemonic:["RST", vect.HEX(2) + "H"]
                        };
                    }
                })(rstVt[rstI])
        };
    }
    //=================================================================================
    // 入力・出力グループ
    //=================================================================================
    this.opecodeTable[oct("0333")] = {
        mnemonic:"IN A,(n)",
        cycle:11,
        proc: function() { THIS.reg.A = THIS.readIoPort(THIS.fetch()); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "A", "(" + mem.peek(addr+1) + ")"]
            };
        }
    };
    opeMisc[oct("0100")] = {
        mnemonic:"IN B,(C)",
        cycle:12,
        proc: function() { THIS.reg.B = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "B", "(C)"]
            };
        }
    };
    opeMisc[oct("0110")] = {
        mnemonic:"IN C,(C)",
        cycle:12,
        proc: function() { THIS.reg.C = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "C", "(C)"]
            };
        }
    };
    opeMisc[oct("0120")] = {
        mnemonic:"IN D,(C)",
        cycle:12,
        proc: function() { THIS.reg.D = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "D", "(C)"]
            };
        }
    };
    opeMisc[oct("0130")] = {
        mnemonic:"IN E,(C)",
        cycle:12,
        proc: function() { THIS.reg.E = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "E", "(C)"]
            };
        }
    };
    opeMisc[oct("0140")] = {
        mnemonic:"IN H,(C)",
        cycle:12,
        proc: function() { THIS.reg.H = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "H", "(C)"]
            };
        }
    };
    opeMisc[oct("0150")] = {
        mnemonic:"IN L,(C)",
        cycle:12,
        proc: function() { THIS.reg.L = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "L", "(C)"]
            };
        }
    };
    opeMisc[oct("0170")] = {//oct("001110000")
        mnemonic:"IN A,(C)",
        cycle:12,
        proc: function() { THIS.reg.A = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "A", "(C)"]
            };
        }
    };
    opeMisc[oct("0242")] = {
        mnemonic:"INI",
        cycle:16,
        proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.C));
            THIS.postINI();
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["INI"]
            };
        }
    };
    opeMisc[oct("0262")] = {
        mnemonic:"INIR",
        cycle:"21 x reg B",
        proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.C));
            THIS.postINI();
            if(THIS.reg.B != 0) {
                THIS.reg.PC -= 2;
            }
            return 21;
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["INIR"]
            };
        }
    };
    opeMisc[oct("0252")] = {
        mnemonic:"IND",
        cycle:16,
        proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.C));
            THIS.postIND();
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IND"]
            };
        }
    };
    opeMisc[oct("0272")] = {
        mnemonic:"INDR",
        cycle:"21 x reg B",
        proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.C));
            THIS.postIND();
            if(THIS.reg.B != 0) {
                THIS.reg.PC -= 2;
            }
            return 21;
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["INDR"]
            };
        }
    };
    this.opecodeTable[oct("0323")] = {
        mnemonic:"OUT (n),A",
        cycle:11,
        proc: function() { THIS.writeIoPort(THIS.fetch(), THIS.reg.A); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUT", "(" + mem.peek(addr+1) + ")", "A"]
            };
        }
    };
    opeMisc[oct("0101")] = {
        mnemonic:"OUT (C),B",
        cycle:12,
        proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.B); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUT", "(C)","B"]
            };
        }
    };
    opeMisc[oct("0111")] = {
        mnemonic:"OUT (C),C",
        cycle:12,
        proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.C); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUT", "(C)", "C"]
            };
        }
    };
    opeMisc[oct("0121")] = {
        mnemonic:"OUT (C),D",
        cycle:12,
        proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.D); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUT", "(C)", "D"]
            };
        }
    };
    opeMisc[oct("0131")] = {
        mnemonic:"OUT (C),E",
        cycle:12,
        proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.E); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUT", "(C)", "E"]
            };
        }
    };
    opeMisc[oct("0141")] = {
        mnemonic:"OUT (C),H",
        cycle:12,
        proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.H); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUT", "(C)", "H"]
            };
        }
    };
    opeMisc[oct("0151")] = {
        mnemonic:"OUT (C),L",
        cycle:12,
        proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.L); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUT", "(C)", "L"]
            };
        }
    };
    opeMisc[oct("0171")] = {
        mnemonic:"OUT (C),A",
        cycle:12,
        proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.A); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUT", "(C)", "A"]
            };
        }
    };
    opeMisc[oct("0243")] = {
        mnemonic:"OUTI",
        cycle:16,
        proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.writeIoPort(THIS.reg.C, THIS.memory.peek(THIS.reg.getHL()));
            THIS.postOUTI();
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUTI"]
            };
        }
    };
    opeMisc[oct("0263")] = {
        mnemonic:"OTIR",
        cycle:"21 x reg B",
        proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.writeIoPort(THIS.reg.C, THIS.memory.peek(THIS.reg.getHL()));
            THIS.postOUTI();
            if(THIS.reg.B != 0) {
                THIS.reg.PC -= 2;
            }
            return 21;
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OTIR"]
            };
        }
    };
    opeMisc[oct("0253")] = {
        mnemonic:"OUTD",
        cycle:16,
        proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.writeIoPort(THIS.reg.C, THIS.memory.peek(THIS.reg.getHL()));
            THIS.postOUTD();
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OUTD"]
            };
        }
    };
    opeMisc[oct("0273")] = {
        mnemonic:"OTDR",
        cycle:"21 x reg B",
        proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.writeIoPort(THIS.reg.C, THIS.memory.peek(THIS.reg.getHL()));
            THIS.postOUTD();
            if(THIS.reg.B != 0) {
                THIS.reg.PC -= 2;
            }
            return 21;
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["OTDR"]
            };
        }
    };
};

module.exports = Z80;

},{"../lib/oct":35,"./bin-util.js":12,"./memory-block.js":16,"./register.js":17,"./z80-line-assembler":18}],14:[function(require,module,exports){
(function() {
    var Z80BinUtil = require("./bin-util.js");

    //
    // IMem
    //
    var IMem = function() {};

    IMem.prototype.create = function(opt) {
        opt = opt || {};
        this.onPeek = opt.onPeek || function(/*address, value*/) {};
        this.onPoke = opt.onPoke || function(/*address, value*/) {};
        this.size = opt.size || 0x10000;
        this.startAddr = opt.startAddr || 0;
    };

    //
    // This peekByte is an abstruct called from `peek`.
    //
    // address: address to write value
    //
    IMem.prototype.peekByte = function(/* address, value */) {
        var msg = "Error: peekByte was not overrided and supported in class of this:"
            + JSON.stringify(this, null, "    ");
        console.error(msg);
        throw new Error(msg);
    };

    //
    // This pokeByte is an abstruct called from `poke`.
    //
    // address: address to write value
    // value: value to write
    //
    IMem.prototype.pokeByte = function(/* address, value */) {
        var msg = "Error: pokeByte was not overrided and supported in class of this:" + JSON.stringify(this, null, "    ");
        console.error(msg);
        throw new Error(msg);
    };

    IMem.prototype.clear = function() {
        for(var i = 0; i < this.size; i++) {
            this.pokeByte(0);
        }
    };

    IMem.prototype.peek = function(address) {
        var value = this.peekByte(address);
        var override = this.onPeek.call(this, address, value);
        if(override != null && override != undefined) {
            value = override;
        }
        return value;
    };

    IMem.prototype.poke = function(address, value) {
        this.pokeByte(address, value);
        this.onPoke.call(this, address, this.peekByte(address));
    };

    IMem.prototype.peekPair = function(address) {
        var H = this.peek(address + 1);
        var L = this.peek(address + 0);
        return Z80BinUtil.pair(H,L);
    };

    module.exports = IMem;
}());

},{"./bin-util.js":12}],15:[function(require,module,exports){
var IMem = require("./imem");

//
// MemoryBank
//
// TODO: change the type of field `memblk` to `Array` instead of `object`
// to improve the speed to access.
//
var MemoryBank = function(opt) {
    this.create(opt);
};
MemoryBank.prototype = new IMem();

MemoryBank.prototype.create = function(opt) {
    IMem.prototype.create.call(this, opt);
    this.mem = new Array(this.size);
    this.memblk = {};
};

MemoryBank.prototype.setMemoryBlock = function(name, memblk) {
    var size;
    var startAddr;
    var j;
    if(memblk == null) {
        if(name in this.memblk) {
            size = this.memblk[name].size;
            startAddr = this.memblk[name].startAddr;
            for(j = 0; j < size; j++) {
                this.mem[startAddr + j] = null;
            }
            delete this.memblk[name];
        }
    } else {
        this.memblk[name] = memblk;
        size = this.memblk[name].size;
        startAddr = this.memblk[name].startAddr;
        for(j = 0; j < size; j++) {
            this.mem[startAddr + j] = memblk;
        }
    }
};

MemoryBank.prototype.peekByte = function(address) {
    return (this.mem[(address - this.startAddr) & 0xffff]).peek(address) & 0xff;
};

MemoryBank.prototype.pokeByte = function(address, value) {
    (this.mem[(address - this.startAddr) & 0xffff]).poke(address, value & 0xff);
};
module.exports = MemoryBank;

},{"./imem":14}],16:[function(require,module,exports){
var IMem = require("./imem");

//
// MemoryBlock
//
var MemoryBlock = function(opt) {
    this.create(opt);
};

MemoryBlock.prototype = new IMem();

MemoryBlock.prototype.create = function(opt) {
    IMem.prototype.create.call(this, opt);
	this.mem = new Array(this.size);
};

MemoryBlock.prototype.peekByte = function(address) {
    return this.mem[(address - this.startAddr) & 0xffff] & 0xff;
};

MemoryBlock.prototype.pokeByte = function(address, value) {
    this.mem[(address - this.startAddr)  & 0xffff] = value & 0xff;
};

module.exports = MemoryBlock;

},{"./imem":14}],17:[function(require,module,exports){
(function() {
    var Z80BinUtil = require("./bin-util.js");
    var Z80_Register = function() {
        this.B = 0;
        this.C = 0;
        this.D = 0;
        this.E = 0;
        this.H = 0;
        this.L = 0;
        this.A = 0;
        this.F = 0;
        
        //16bit register
        this.PC = 0;	//プログラムカウンタ
        this.SP = 0;	//スタックポインタ
        this.IX = 0;	//インデックスレジスタX
        this.IY = 0;	//インデックスレジスタY
        
        this.R = 0;	//リフレッシュレジスタ
        this.I = 0;	//割り込みベクタ
    };
    (function() {

    /* FLAG MASK BIT CONSTANT */
    var S_FLAG = 0x80;
    var Z_FLAG = 0x40;
    var H_FLAG = 0x10;
    var V_FLAG = 0x04;
    var N_FLAG = 0x02;
    var C_FLAG = 0x01;

    //
    // I have ported these codes from https://github.com/marukun700/mz700win/tree/master/z80
    //
    var PTable = new Array(512);
    var ZSTable = new Array(512);
    var ZSPTable = new Array(512);
    var i;
    for (i = 0; i < 256; ++i) {
        var zs = 0;
        if (i == 0) {
            zs |= Z_FLAG;
        }
        if (i & 0x80) {
            zs |= S_FLAG;
        }

        var p = 0;
        if (i & 1) { ++p; }
        if (i & 2) { ++p; }
        if (i & 4) { ++p; }
        if (i & 8) { ++p; }
        if (i & 16) { ++p; }
        if (i & 32) { ++p; }
        if (i & 64) { ++p; }
        if (i & 128) { ++p; }

        PTable[i] = (p & 1) ? 0 : V_FLAG;
        ZSTable[i] = zs;
        ZSPTable[i] = zs | PTable[i];
    }
    for (i = 0; i < 256; ++i) {
        ZSTable[i + 256] = ZSTable[i] | C_FLAG;
        ZSPTable[i + 256] = ZSPTable[i] | C_FLAG;
        PTable[i + 256] = PTable[i] | C_FLAG;
    }

    Z80_Register.prototype.clear = function() {
        this.B = 0;
        this.C = 0;
        this.D = 0;
        this.E = 0;
        this.H = 0;
        this.L = 0;
        this.A = 0;
        this.F = 0;
        this.PC = 0;
        this.SP = 0;
        this.IX = 0;
        this.IY = 0;
        this.R = 0;
        this.I = 0;
    }
    Z80_Register.prototype.setFrom = function(reg) {
        this.B = reg.B;
        this.C = reg.C;
        this.D = reg.D;
        this.E = reg.E;
        this.H = reg.H;
        this.L = reg.L;
        this.A = reg.A;
        this.F = reg.F;
        this.PC = reg.PC;
        this.SP = reg.SP;
        this.IX = reg.IX;
        this.IY = reg.IY;
        this.R = reg.R;
        this.I = reg.I;
    }
    Z80_Register.prototype.setPair = function(rr, value) {
        if(rr == "SP" || rr == "PC" || rr == "IX" || rr == "IY") {
            this[rr] = value;
        } else {
            this[rr.substring(1,2)] = Z80BinUtil.lobyte(value);
            this[rr.substring(0,1)] = Z80BinUtil.hibyte(value);
        }
    }
    Z80_Register.prototype.debugDump = function() {
        console.info(
                "B:" + this.B.HEX(2) + "H " + this.B + " " +
                "C:" + this.C.HEX(2) + "H " + this.C + " / " + this.getBC());
        console.info(
                "D:" + this.D.HEX(2) + "H " + this.D + " " +
                "E:" + this.E.HEX(2) + "H " + this.E + " / " + this.getDE());
        console.info(
                "H:" + this.H.HEX(2) + "H " + this.H + " " +
                "L:" + this.L.HEX(2) + "H " + this.L + " / " + this.getHL());
        console.info("A:" + this.A.HEX(2) + "H " + this.A);
        console.info("SZ-HPN-C");
        console.info(this.F.bin(8));
        console.info("PC:" + this.PC.HEX(4) + "H " + this.PC.bin(16) + "(2) " + this.PC);
        console.info("SP:" + this.SP.HEX(4) + "H " + this.SP.bin(16) + "(2) " + this.SP);
        console.info("I:" + this.I.HEX(2) + "H " + this.I.bin(8) + "(2) " + this.I + " " +
        "R:" + this.R.HEX(2) + "H " + this.R.bin(8) + "(2) " + this.R);
    }


    /* GET 16bit register pair value */
    Z80_Register.prototype.getHL = function() { return Z80BinUtil.pair(this.H, this.L); };
    Z80_Register.prototype.getBC = function() { return Z80BinUtil.pair(this.B, this.C); };
    Z80_Register.prototype.getDE = function() { return Z80BinUtil.pair(this.D, this.E); };
    Z80_Register.prototype.getAF = function() { return Z80BinUtil.pair(this.A, this.F); };

    /* SET 16bit register pair value */
    Z80_Register.prototype.setHL = function(nn) { this.H = Z80BinUtil.hibyte(nn); this.L = Z80BinUtil.lobyte(nn); };
    Z80_Register.prototype.setBC = function(nn) { this.B = Z80BinUtil.hibyte(nn); this.C = Z80BinUtil.lobyte(nn); };
    Z80_Register.prototype.setDE = function(nn) { this.D = Z80BinUtil.hibyte(nn); this.E = Z80BinUtil.lobyte(nn); };
    Z80_Register.prototype.setAF = function(nn) { this.A = Z80BinUtil.hibyte(nn); this.F = Z80BinUtil.lobyte(nn); };

    /* TEST FLAG BIT */
    Z80_Register.prototype.testFlag	= function(mask) { return (this.F & mask) != 0 ? true : false; };
    Z80_Register.prototype.flagS = function() {return this.testFlag(S_FLAG); }
    Z80_Register.prototype.flagZ = function() {return this.testFlag(Z_FLAG); }
    Z80_Register.prototype.flagH = function() {return this.testFlag(H_FLAG); }
    Z80_Register.prototype.flagP = function() {return this.testFlag(V_FLAG); }
    Z80_Register.prototype.flagN = function() {return this.testFlag(N_FLAG); }
    Z80_Register.prototype.flagC = function() {return this.testFlag(C_FLAG); }

    /* SET FLAG BIT */
    Z80_Register.prototype.setFlag = function(mask) {this.F |= mask; }
    Z80_Register.prototype.setFlagS = function() { this.setFlag(S_FLAG); }
    Z80_Register.prototype.setFlagZ = function() { this.setFlag(Z_FLAG); }
    Z80_Register.prototype.setFlagH = function() { this.setFlag(H_FLAG); }
    Z80_Register.prototype.setFlagP = function() { this.setFlag(V_FLAG); }
    Z80_Register.prototype.setFlagN = function() { this.setFlag(N_FLAG); }
    Z80_Register.prototype.setFlagC = function() { this.setFlag(C_FLAG); }

    /* CLEAR FLAG BIT */
    Z80_Register.prototype.clearFlag = function(mask) {this.F &= ~mask; }
    Z80_Register.prototype.clearFlagS = function() { this.clearFlag(S_FLAG); }
    Z80_Register.prototype.clearFlagZ = function() { this.clearFlag(Z_FLAG); }
    Z80_Register.prototype.clearFlagH = function() { this.clearFlag(H_FLAG); }
    Z80_Register.prototype.clearFlagP = function() { this.clearFlag(V_FLAG); }
    Z80_Register.prototype.clearFlagN = function() { this.clearFlag(N_FLAG); }
    Z80_Register.prototype.clearFlagC = function() { this.clearFlag(C_FLAG); }

    Z80_Register.prototype.ADD_HL = function(n)
    {
        this.setHL(this._ADD(this.getHL(), n));
    }
    //#define M_ADCW(Reg)                                            \
    //{                                                              \
    // int q;                                                        \
    // q=R.HL.D+R.Reg.D+(R.AF.D&1);                                  \
    // R.AF.B.l=(((R.HL.D^q^R.Reg.D)&0x1000)>>8)|                    \
    //          ((q>>16)&1)|                                         \
    //          ((q&0x8000)>>8)|                                     \
    //          ((q&65535)?0:Z_FLAG)|                                \
    //          (((R.Reg.D^R.HL.D^0x8000)&(R.Reg.D^q)&0x8000)>>13);  \
    // R.HL.W.l=q;                                                   \
    //}
    Z80_Register.prototype.ADC_HL = function(n)
    {
        var HL = this.getHL();
        var q = HL + n + (this.F & C_FLAG);
        this.F = (((HL ^ q ^ n) & 0x1000) >> 8) |
            ((q >> 16) & 1) |
            ((q & 0x8000) >> 8) |
            ((q & 0xffff) ? 0 : Z_FLAG) |
            (((n ^ HL ^ 0x8000) & (n ^ q) & 0x8000) >> 13);
        this.setHL(q & 0xffff);
    };
    //#define M_SBCW(Reg)                                    \
    //{                                                      \
    // int q;                                                \
    // q=R.HL.D-R.Reg.D-(R.AF.D&1);                          \
    // R.AF.B.l=(((R.HL.D^q^R.Reg.D)&0x1000)>>8)|            \
    //          ((q>>16)&1)|                                 \
    //          ((q&0x8000)>>8)|                             \
    //          ((q&65535)?0:Z_FLAG)|                        \
    //          (((R.Reg.D^R.HL.D)&(R.Reg.D^q)&0x8000)>>13)| \
    //          N_FLAG;                                      \
    // R.HL.W.l=q;                                           \
    //}
    Z80_Register.prototype.SBC_HL = function(n)
    {
        var HL = this.getHL();
        var q = HL - n - (this.F & 1);
        this.F = (((HL ^ q ^ n) & 0x1000) >> 8) |
            ((q >> 16) & 1) |
            ((q & 0x8000) >> 8) |
            ((q & 0xffff) ? 0 : Z_FLAG) |
            (((n & HL) & (n ^ q) & 0x8000) >> 13) |
            N_FLAG;
        this.setHL(q & 0xffff);
    };
    Z80_Register.prototype.ADD_IX = function(n)
    {
        this.IX = this._ADD(this.IX, n);
    }
    Z80_Register.prototype.ADD_IY = function(n)
    {
        this.IY = this._ADD(this.IY, n);
    }
    //#define M_ADDW(Reg1,Reg2)                              \
    //{                                                      \
    // int q;                                                \
    // q=R.Reg1.D+R.Reg2.D;                                  \
    // R.AF.B.l=(R.AF.B.l&(S_FLAG|Z_FLAG|V_FLAG))|           \
    //          (((R.Reg1.D^q^R.Reg2.D)&0x1000)>>8)|         \
    //          ((q>>16)&1);                                 \
    // R.Reg1.W.l=q;                                         \
    //}
    Z80_Register.prototype._ADD = function(a, b)
    {
        var q = a + b;
        this.F = (this.F & (S_FLAG | Z_FLAG | V_FLAG)) |
            (((a ^ q ^ b) & 0x1000) >> 8) |
            ((q >> 16) & 1);
        return q & 0xffff;
    };
    Z80_Register.prototype.jumpRel = function(e) {
        this.PC += Z80BinUtil.getSignedByte(e);
    }
    //static void cpl(void) {
    //  R.AF.B.h^=0xFF;
    //  R.AF.B.l|=(H_FLAG|N_FLAG);
    //}
    Z80_Register.prototype.CPL = function() {
        this.A = (this.A ^ 0xff) & 255;
        this.F = (H_FLAG | N_FLAG);
    }
    //static void neg(void)
    //{
    // byte i;
    // i=R.AF.B.h;
    // R.AF.B.h=0;
    // M_SUB(i);
    //}
    Z80_Register.prototype.NEG = function() {
        var i = this.A;
        this.A = 0;
        this.subAcc(i);
    }
    //  #define M_ADD(Reg)
    //  {
    //      int q;
    //      q=R.AF.B.h+Reg;
    //      R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|
    //          ((R.AF.B.h^q^Reg)&H_FLAG)|
    //          (((Reg^R.AF.B.h^0x80)&(Reg^q)&0x80)>>5);
    //      R.AF.B.h=q;
    //  }
    Z80_Register.prototype.addAcc = function(n) {
        var q = this.A + n;
        this.F = ZSTable[q & 255] | ((q & 256) >> 8) |
            ((this.A ^ q ^ n) & H_FLAG) |
            (((n ^ this.A ^ 0x80) & (n ^ q) & 0x80) >> 5);
        this.A = (q & 255);
    }
    //  #define M_ADC(Reg)
    //  {
    //      int q;
    //      q = R.AF.B.h + Reg + (R.AF.B.l & 1);
    //      R.AF.B.l = ZSTable[q & 255] | ((q & 256) >> 8) |
    //            ((R.AF.B.h ^ q ^ Reg) & H_FLAG) |
    //            (((Reg ^ R.AF.B.h ^ 0x80) & (Reg ^ q) & 0x80) >> 5);
    //      R.AF.B.h = q;
    //  }
    //
    Z80_Register.prototype.addAccWithCarry = function(n) {
        var q = this.A + n + (this.F & C_FLAG);
        this.F = ZSTable[q & 255] | ((q & 256) >> 8) |
            ((this.A ^ q ^ n) & H_FLAG) |
            (((n ^ this.A ^ 0x80) & (n ^ q) & 0x80) >> 5);
        this.A = (q & 255);
    }
    //  #define M_SUB(Reg)                                      \
    //  {                                                       \
    //   int q;                                                 \
    //   q=R.AF.B.h-Reg;                                        \
    //   R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|N_FLAG|           \
    //            ((R.AF.B.h^q^Reg)&H_FLAG)|                    \
    //            (((Reg^R.AF.B.h)&(Reg^q)&0x80)>>5);           \
    //   R.AF.B.h=q;                                            \
    //  }
    //  
    Z80_Register.prototype.subAcc = function(n) {
        var q = (this.A - n) & 0x1ff;
        this.F = ZSTable[q & 255] | ((q & 256) >> 8) | N_FLAG |
            ((this.A ^ q ^ n) & H_FLAG) |
            (((n ^ this.A ^ 0x80) & (n ^ q) & 0x80) >> 5);
        this.A = (q & 255);
    }
    //  #define M_SBC(Reg)                                      \
    //  {                                                       \
    //   int q;                                                 \
    //   q=R.AF.B.h-Reg-(R.AF.B.l&1);                           \
    //   R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|N_FLAG|           \
    //            ((R.AF.B.h^q^Reg)&H_FLAG)|                    \
    //            (((Reg^R.AF.B.h)&(Reg^q)&0x80)>>5);           \
    //   R.AF.B.h=q;                                            \
    //  }
    Z80_Register.prototype.subAccWithCarry = function(n) {
        var q = (this.A - n - (this.F & C_FLAG)) & 0x1ff;
        this.F = ZSTable[q & 255] | ((q & 256) >> 8) | N_FLAG |
            ((this.A ^ q ^ n) & H_FLAG) |
            (((n ^ this.A ^ 0x80) & (n ^ q) & 0x80) >> 5);
        this.A = (q & 255);
    }
    //#define M_AND(Reg)
    //  R.AF.B.h &= Reg;
    //  R.AF.B.l = ZSPTable[R.AF.B.h] | H_FLAG
    Z80_Register.prototype.andAcc = function(n) {
        this.A &= (n & 0xff);
        this.F = ZSPTable[this.A] | H_FLAG;
    }
    //#define M_OR(Reg)
    //  R.AF.B.h |= Reg;
    //  R.AF.B.l = ZSPTable[R.AF.B.h]
    Z80_Register.prototype.orAcc = function(n) {
        this.A |= (n & 0xff);
        this.F = ZSPTable[this.A];
    }
    //#define M_XOR(Reg)
    //  R.AF.B.h ^= Reg;
    //  R.AF.B. l= ZSPTable[R.AF.B.h]
    Z80_Register.prototype.xorAcc = function(n) {
        this.A ^= (n & 0xff);
        this.F = ZSPTable[this.A];
    }
    Z80_Register.prototype.increment = function(r) {
        this[r] = this.getINCValue(this[r]);
    }
    //#define M_INC(Reg)
    // ++Reg;
    // R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[Reg]|
    //          ((Reg==0x80)?V_FLAG:0)|((Reg&0x0F)?0:H_FLAG)
    Z80_Register.prototype.getINCValue = function(n) {
        n = (n + 1) & 255;
        this.F = (this.F & C_FLAG) |
            ZSTable[n] |
            ((n == 0x80) ? V_FLAG : 0) |
            ((n & 0x0F) ? 0 : H_FLAG);
        return n;
    };
    Z80_Register.prototype.decrement = function(r) {
        this[r] = this.getDECValue(this[r]);
    }
    //#define M_DEC(Reg)
    //  R.AF.B.l=(R.AF.B.l&C_FLAG)|N_FLAG|
    //           ((Reg==0x80)?V_FLAG:0)|((Reg&0x0F)?0:H_FLAG);
    //  R.AF.B.l|=ZSTable[--Reg]
    Z80_Register.prototype.getDECValue = function(n) {
        this.F = (this.F & C_FLAG) | N_FLAG |
            ((n == 0x80) ? V_FLAG : 0) |
            ((n & 0x0F) ? 0 : H_FLAG);
        n = (n - 1) & 255;
        this.F |= ZSTable[n];
        return n;
    };
    //#define M_CP(Reg)
    //{
    // int q;
    // q=R.AF.B.h-Reg;
    // R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|N_FLAG|
    //          ((R.AF.B.h^q^Reg)&H_FLAG)|
    //          (((Reg^R.AF.B.h)&(Reg^q)&0x80)>>5);
    //}
    Z80_Register.prototype.compareAcc = function(n) {
        var q = this.A - n;
        this.F = ZSTable[q & 255] | ((q & 256) >> 8) | N_FLAG |
            ((this.A ^ q ^ n) & H_FLAG) |
            (((n ^ this.A) & (n ^ q) & 0x80) >> 5);
    }
    //static void cpi(void)
    //{
    // byte i,j;
    // i=M_RDMEM(R.HL.D);
    // j=R.AF.B.h-i;
    // ++R.HL.W.l;
    // --R.BC.W.l;
    // R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[j]|
    //          ((R.AF.B.h^i^j)&H_FLAG)|(R.BC.D? V_FLAG:0)|N_FLAG;
    //}
    Z80_Register.prototype.CPI = function(n) {
        var q = this.A - n;
        this.incHL();
        this.decBC();
        this.F = (this.F & C_FLAG) | ZSTable[q & 255] |
            ((this.A ^ n ^ q) & H_FLAG) |
            (this.getBC() ? V_FLAG : 0) | N_FLAG;
    };
    //static void cpd(void)
    //{
    // byte i,j;
    // i=M_RDMEM(R.HL.D);
    // j=R.AF.B.h-i;
    // --R.HL.W.l;
    // --R.BC.W.l;
    // R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[j]|
    //          ((R.AF.B.h^i^j)&H_FLAG)|(R.BC.D? V_FLAG:0)|N_FLAG;
    //}
    Z80_Register.prototype.CPD = function(n) {
        var q = this.A - n;
        this.decHL();
        this.decBC();
        this.F = (this.F & C_FLAG) | ZSTable[q & 255] |
            ((this.A ^ n ^ q) & H_FLAG) |
            (this.getBC() ? V_FLAG : 0) | N_FLAG;
    }
    //#define M_RLCA
    // R.AF.B.h=(R.AF.B.h<<1)|((R.AF.B.h&0x80)>>7);
    // R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&C_FLAG)
    Z80_Register.prototype.RLCA = function() {
        this.A = ((this.A << 1) | ((this.A & 0x80) >> 7)) & 255;
        this.F = (this.F & 0xEC) | (this.A & 0x01);
    }
    //#define M_RLC(Reg)
    //{
    // int q;
    // q=Reg>>7;
    // Reg=(Reg<<1)|q;
    // R.AF.B.l=ZSPTable[Reg]|q;
    //}
    Z80_Register.prototype.RLC = function(x) {
        var q = x >> 7;
        x = ((x << 1) | q) & 255;
        this.F = ZSPTable[x] | q;
        return x;
    }
    //#define M_RLA               \
    //{                           \
    // int i;                     \
    // i=R.AF.B.l&C_FLAG;         \
    // R.AF.B.l=(R.AF.B.l&0xEC)|((R.AF.B.h&0x80)>>7); \
    // R.AF.B.h=(R.AF.B.h<<1)|i;  \
    //}
    Z80_Register.prototype.RLA = function() {
        var i = this.F & C_FLAG;
        this.F = (this.F & 0xEC) | ((this.A & 0x80) >> 7);
        this.A = ((this.A << 1) | i) & 255;
    }
    //#define M_RL(Reg)            \
    //{                            \
    // int q;                      \
    // q=Reg>>7;                   \
    // Reg=(Reg<<1)|(R.AF.B.l&1);  \
    // R.AF.B.l=ZSPTable[Reg]|q;   \
    //}
    Z80_Register.prototype.RL = function(x) {
        var q = x >> 7;
        x = ((x << 1) | (this.F & 1)) & 255;
        this.F = ZSPTable[x] | q;
        return x;
    }
    //#define M_RRCA              \
    // R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&0x01); \
    // R.AF.B.h=(R.AF.B.h>>1)|(R.AF.B.h<<7)
    Z80_Register.prototype.RRCA = function() {
        this.F = (this.F & 0xEC) | (this.A & 0x01);
        this.A = (this.A >> 1) | ((this.A << 7) & 255);
    }
    //#define M_RRC(Reg)         \
    //{                          \
    // int q;                    \
    // q=Reg&1;                  \
    // Reg=(Reg>>1)|(q<<7);      \
    // R.AF.B.l=ZSPTable[Reg]|q; \
    //}
    Z80_Register.prototype.RRC = function(x) {
        var q = x & 1;
        x = (x >> 1) | ((q << 7) & 255);
        this.F = ZSPTable[x] | q;
        return x;
    }
    //#define M_RRA               \
    //{                           \
    // int i;                     \
    // i=R.AF.B.l&C_FLAG;         \
    // R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&0x01); \
    // R.AF.B.h=(R.AF.B.h>>1)|(i<<7);            \
    //}
    Z80_Register.prototype.RRA = function() {
        var i = this.F & C_FLAG;
        this.F = (this.F & 0xEC) | (this.A & 0x01);
        this.A = (this.A >> 1) | (i << 7);
    }
    //#define M_RR(Reg)            \
    //{                            \
    // int q;                      \
    // q=Reg&1;                    \
    // Reg=(Reg>>1)|(R.AF.B.l<<7); \
    // R.AF.B.l=ZSPTable[Reg]|q;   \
    //}
    Z80_Register.prototype.RR = function(x) {
        var q = x & 1;
        x = (x >> 1) | ((this.F << 7) & 255);
        this.F = ZSPTable[x] | q;
        return x;
    }
    //#define M_SLA(Reg)           \
    //{                            \
    // int q;                      \
    // q=Reg>>7;                   \
    // Reg<<=1;                    \
    // R.AF.B.l=ZSPTable[Reg]|q;   \
    //}
    Z80_Register.prototype.SLA = function(x) {
        var q = x >> 7;
        x = (x << 1) & 255;
        this.F = ZSPTable[x] | q;
        return x;
    }
    //#define M_SRA(Reg)           \
    //{                            \
    // int q;                      \
    // q=Reg&1;                    \
    // Reg=(Reg>>1)|(Reg&0x80);    \
    // R.AF.B.l=ZSPTable[Reg]|q;   \
    //}
    Z80_Register.prototype.SRA = function(x) {
        var q = x & 1;
        x = (x >> 1) | (x & 0x80);
        this.F = ZSPTable[x] | q;
        return x;
    }
    //#define M_SRL(Reg)           \
    //{                            \
    // int q;                      \
    // q=Reg&1;                    \
    // Reg>>=1;                    \
    // R.AF.B.l=ZSPTable[Reg]|q;   \
    //}
    Z80_Register.prototype.SRL = function(x) {
        var q = x & 1;
        x >>= 1;
        this.F = ZSPTable[x] | q;
        return x;
    }
    //#define DoIn(lo,hi)     Z80_In( (word) ((lo)|((word) ((hi)<<8) )))
    //#define M_IN(Reg)           \
    //        Reg=DoIn(R.BC.B.l,R.BC.B.h); \
    //        R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSPTable[Reg]
    Z80_Register.prototype.onReadIoPort = function(Reg) {
        this.F = (this.F & C_FLAG) | ZSPTable[Reg];
    };
    //static void ind(void)
    //{
    // --R.BC.B.h;
    // M_WRMEM(R.HL.D,DoIn(R.BC.B.l,R.BC.B.h));
    // --R.HL.W.l;
    // R.AF.B.l=(R.BC.B.h)? N_FLAG:(N_FLAG|Z_FLAG);
    //}
    Z80_Register.prototype.postIND = function() {
        this.decHL();
        this.F = (this.B) ? N_FLAG : (N_FLAG | Z_FLAG);
    };
    //static void ini(void)
    //{
    // --R.BC.B.h;
    // M_WRMEM(R.HL.D,DoIn(R.BC.B.l,R.BC.B.h));
    // ++R.HL.W.l;
    // R.AF.B.l=(R.BC.B.h)? N_FLAG:(N_FLAG|Z_FLAG);
    //}
    Z80_Register.prototype.postINI = function() {
        this.incHL();
        this.F = (this.B) ? N_FLAG : (N_FLAG | Z_FLAG);
    };
    //static void outd(void)
    //{
    // --R.BC.B.h;
    // DoOut (R.BC.B.l,R.BC.B.h,(word)M_RDMEM(R.HL.D));
    // --R.HL.W.l;
    // R.AF.B.l=(R.BC.B.h)? N_FLAG:(Z_FLAG|N_FLAG);
    //}
    Z80_Register.prototype.postOUTD = function() {
        this.decHL();
        this.F = (this.B) ? N_FLAG : (N_FLAG | Z_FLAG);
    };
    //static void outi(void)
    //{
    // --R.BC.B.h;
    // DoOut (R.BC.B.l,R.BC.B.h,(word)M_RDMEM(R.HL.D));
    // ++R.HL.W.l;
    // R.AF.B.l=(R.BC.B.h)? N_FLAG:(Z_FLAG|N_FLAG);
    //}
    Z80_Register.prototype.postOUTI = function() {
        this.incHL();
        this.F = (this.B) ? N_FLAG : (N_FLAG | Z_FLAG);
    };
    //static void ld_a_i(void)
    //{
    // R.AF.B.h=R.I;
    // R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[R.I]|(R.IFF2<<2);
    //}
    Z80_Register.prototype.LD_A_I = function(iff2) {
        this.A = this.I;
        this.F = (this.F & C_FLAG) | ZSTable[this.I] | (iff2 << 2)
    };
    //static void ld_a_r(void)
    //{
    // R.AF.B.h=(R.R&127)|(R.R2&128);
    // R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[R.AF.B.h]|(R.IFF2<<2);
    //}
    Z80_Register.prototype.LD_A_R = function(iff2,r2) {
        this.A = (this.R & 127) | (r2 & 128);
        this.F = (this.F & C_FLAG) | ZSTable[this.A] | (iff2 << 2)
    };
    Z80_Register.prototype.incBC = function() {
        this.setBC((this.getBC() + 1) & 0xffff);
    }
    Z80_Register.prototype.decBC = function() {
        this.setBC((this.getBC() - 1) & 0xffff);
    }
    Z80_Register.prototype.incHL = function() {
        this.setHL((this.getHL() + 1) & 0xffff);
    }
    Z80_Register.prototype.decHL = function() {
        this.setHL((this.getHL() - 1) & 0xffff);
    }
    Z80_Register.prototype.incDE = function() {
        this.setDE((this.getDE() + 1) & 0xffff);
    }
    Z80_Register.prototype.decDE = function() {
        this.setDE((this.getDE() - 1) & 0xffff);
    }
    //static void ldd(void)
    //{
    // M_WRMEM(R.DE.D,M_RDMEM(R.HL.D));
    // --R.DE.W.l;
    // --R.HL.W.l;
    // --R.BC.W.l;
    // R.AF.B.l=(R.AF.B.l&0xE9)|(R.BC.D? V_FLAG:0);
    //}
    Z80_Register.prototype.onLDD = function() {
        this.decDE();
        this.decHL();
        this.decBC();
        this.F = (this.F & 0xE9) | (this.getBC() ? V_FLAG : 0);
    };
    //static void ldi(void)
    //{
    // M_WRMEM(R.DE.D,M_RDMEM(R.HL.D));
    // ++R.DE.W.l;
    // ++R.HL.W.l;
    // --R.BC.W.l;
    // R.AF.B.l=(R.AF.B.l&0xE9)|(R.BC.D? V_FLAG:0);
    //}
    Z80_Register.prototype.onLDI = function() {
        this.incDE();
        this.incHL();
        this.decBC();
        this.F = (this.F & 0xE9) | (this.getBC() ? V_FLAG : 0);
    };

    /* -------------------
     * r,r'		レジスタ
     * -------------------
     * 000		B
     * 001		C
     * 010		D
     * 011		E
     * 100		H
     * 101		L
     * 111		A
     */
    Z80_Register.REG_r_ID2NAME = {0:"B",1:"C",2:"D",3:"E",4:"H",5:"L",7:"A"};
    /* -------------------
     * dd,ss	ペアレジスタ
     * -------------------
     * 00		BC
     * 01		DE
     * 10		HL
     * 11		SP
     */
    /* -------------------
     * qq		ペアレジスタ
     * -------------------
     * 00		BC
     * 01		DE
     * 10		HL
     * 11		AF
     */

    /* -------------------
     * pp		ペアレジスタ
     * -------------------
     * 00		BC
     * 01		DE
     * 10		IX
     * 11		SP
     */

    /* -------------------
     * rr		ペアレジスタ
     * -------------------
     * 00		BC
     * 01		DE
     * 10		IY
     * 11		SP
     */

    /* -------------------
     * b		ビットセット
     * -------------------
     * 000		0
     * 001		1
     * 010		2
     * 011		3
     * 100		4
     * 101		5
     * 110		6
     * 111		7
     */
    /* ---------------------------
     * cc		コンディション
     * ---------------------------
     * 000		NZ	Non Zero
     * 001		Z	Zero
     * 010		NC	Non Carry
     * 011		C	Carry
     * 100		PO	Parity Odd
     * 101		PE	Parity Even
     * 110		P	sign Positive
     * 111		N	sign Negative
     */
    Z80_Register.CONDITION_INDEX = { NZ:0, Z:1, NC:2, C:3, PO:4, PE:5, P:6, N:7 };

    /* -------------------
     * t		p
     * -------------------
     * 000		00H
     * 001		08H
     * 010		10H
     * 011		18H
     * 100		20H
     * 101		28H
     * 110		30H
     * 111		38H
     */
    Z80_Register.prototype.DAA = function() {
        var i = this.A;
        if(this.F & C_FLAG) { i |= 0x100; }
        if(this.F & H_FLAG) { i |= 0x200; }
        if(this.F & N_FLAG) { i |= 0x400; }
        var AF = DAATable[i] & 0xffff;
        this.A = (AF >> 8) & 0xff;
        this.F = (AF >> 0) & 0xff;
    };
    var DAATable = [
        68, 256, 512, 772, 1024, 1284, 1540, 1792, 2056, 2316, 4112, 4372, 4628, 4880, 5140, 5392,
        4096, 4356, 4612, 4864, 5124, 5376, 5632, 5892, 6156, 6408, 8240, 8500, 8756, 9008, 9268, 9520,
        8224, 8484, 8740, 8992, 9252, 9504, 9760, 10020, 10284, 10536, 12340, 12592, 12848, 13108, 13360, 13620,
        12324, 12576, 12832, 13092, 13344, 13604, 13860, 14112, 14376, 14636, 16400, 16660, 16916, 17168, 17428, 17680,
        16384, 16644, 16900, 17152, 17412, 17664, 17920, 18180, 18444, 18696, 20500, 20752, 21008, 21268, 21520, 21780,
        20484, 20736, 20992, 21252, 21504, 21764, 22020, 22272, 22536, 22796, 24628, 24880, 25136, 25396, 25648, 25908,
        24612, 24864, 25120, 25380, 25632, 25892, 26148, 26400, 26664, 26924, 28720, 28980, 29236, 29488, 29748, 30000,
        28704, 28964, 29220, 29472, 29732, 29984, 30240, 30500, 30764, 31016, -32624, -32364, -32108, -31856, -31596, -31344,
        -32640, -32380, -32124, -31872, -31612, -31360, -31104, -30844, -30580, -30328, -28524, -28272, -28016, -27756, -27504, -27244,
        -28540, -28288, -28032, -27772, -27520, -27260, -27004, -26752, -26488, -26228, 85, 273, 529, 789, 1041, 1301,
        69, 257, 513, 773, 1025, 1285, 1541, 1793, 2057, 2317, 4113, 4373, 4629, 4881, 5141, 5393,
        4097, 4357, 4613, 4865, 5125, 5377, 5633, 5893, 6157, 6409, 8241, 8501, 8757, 9009, 9269, 9521,
        8225, 8485, 8741, 8993, 9253, 9505, 9761, 10021, 10285, 10537, 12341, 12593, 12849, 13109, 13361, 13621,
        12325, 12577, 12833, 13093, 13345, 13605, 13861, 14113, 14377, 14637, 16401, 16661, 16917, 17169, 17429, 17681,
        16385, 16645, 16901, 17153, 17413, 17665, 17921, 18181, 18445, 18697, 20501, 20753, 21009, 21269, 21521, 21781,
        20485, 20737, 20993, 21253, 21505, 21765, 22021, 22273, 22537, 22797, 24629, 24881, 25137, 25397, 25649, 25909,
        24613, 24865, 25121, 25381, 25633, 25893, 26149, 26401, 26665, 26925, 28721, 28981, 29237, 29489, 29749, 30001,
        28705, 28965, 29221, 29473, 29733, 29985, 30241, 30501, 30765, 31017, -32623, -32363, -32107, -31855, -31595, -31343,
        -32639, -32379, -32123, -31871, -31611, -31359, -31103, -30843, -30579, -30327, -28523, -28271, -28015, -27755, -27503, -27243,
        -28539, -28287, -28031, -27771, -27519, -27259, -27003, -26751, -26487, -26227, -24395, -24143, -23887, -23627, -23375, -23115,
        -24411, -24159, -23903, -23643, -23391, -23131, -22875, -22623, -22359, -22099, -20303, -20043, -19787, -19535, -19275, -19023,
        -20319, -20059, -19803, -19551, -19291, -19039, -18783, -18523, -18259, -18007, -16235, -15983, -15727, -15467, -15215, -14955,
        -16251, -15999, -15743, -15483, -15231, -14971, -14715, -14463, -14199, -13939, -12143, -11883, -11627, -11375, -11115, -10863,
        -12159, -11899, -11643, -11391, -11131, -10879, -10623, -10363, -10099, -9847, -8015, -7755, -7499, -7247, -6987, -6735,
        -8031, -7771, -7515, -7263, -7003, -6751, -6495, -6235, -5971, -5719, -3915, -3663, -3407, -3147, -2895, -2635,
        -3931, -3679, -3423, -3163, -2911, -2651, -2395, -2143, -1879, -1619, 85, 273, 529, 789, 1041, 1301,
        69, 257, 513, 773, 1025, 1285, 1541, 1793, 2057, 2317, 4113, 4373, 4629, 4881, 5141, 5393,
        4097, 4357, 4613, 4865, 5125, 5377, 5633, 5893, 6157, 6409, 8241, 8501, 8757, 9009, 9269, 9521,
        8225, 8485, 8741, 8993, 9253, 9505, 9761, 10021, 10285, 10537, 12341, 12593, 12849, 13109, 13361, 13621,
        12325, 12577, 12833, 13093, 13345, 13605, 13861, 14113, 14377, 14637, 16401, 16661, 16917, 17169, 17429, 17681,
        16385, 16645, 16901, 17153, 17413, 17665, 17921, 18181, 18445, 18697, 20501, 20753, 21009, 21269, 21521, 21781,
        20485, 20737, 20993, 21253, 21505, 21765, 22021, 22273, 22537, 22797, 24629, 24881, 25137, 25397, 25649, 25909,
        1540, 1792, 2056, 2316, 2572, 2824, 3084, 3336, 3592, 3852, 4112, 4372, 4628, 4880, 5140, 5392,
        5632, 5892, 6156, 6408, 6664, 6924, 7176, 7436, 7692, 7944, 8240, 8500, 8756, 9008, 9268, 9520,
        9760, 10020, 10284, 10536, 10792, 11052, 11304, 11564, 11820, 12072, 12340, 12592, 12848, 13108, 13360, 13620,
        13860, 14112, 14376, 14636, 14892, 15144, 15404, 15656, 15912, 16172, 16400, 16660, 16916, 17168, 17428, 17680,
        17920, 18180, 18444, 18696, 18952, 19212, 19464, 19724, 19980, 20232, 20500, 20752, 21008, 21268, 21520, 21780,
        22020, 22272, 22536, 22796, 23052, 23304, 23564, 23816, 24072, 24332, 24628, 24880, 25136, 25396, 25648, 25908,
        26148, 26400, 26664, 26924, 27180, 27432, 27692, 27944, 28200, 28460, 28720, 28980, 29236, 29488, 29748, 30000,
        30240, 30500, 30764, 31016, 31272, 31532, 31784, 32044, 32300, 32552, -32624, -32364, -32108, -31856, -31596, -31344,
        -31104, -30844, -30580, -30328, -30072, -29812, -29560, -29300, -29044, -28792, -28524, -28272, -28016, -27756, -27504, -27244,
        -27004, -26752, -26488, -26228, -25972, -25720, -25460, -25208, -24952, -24692, 85, 273, 529, 789, 1041, 1301,
        1541, 1793, 2057, 2317, 2573, 2825, 3085, 3337, 3593, 3853, 4113, 4373, 4629, 4881, 5141, 5393,
        5633, 5893, 6157, 6409, 6665, 6925, 7177, 7437, 7693, 7945, 8241, 8501, 8757, 9009, 9269, 9521,
        9761, 10021, 10285, 10537, 10793, 11053, 11305, 11565, 11821, 12073, 12341, 12593, 12849, 13109, 13361, 13621,
        13861, 14113, 14377, 14637, 14893, 15145, 15405, 15657, 15913, 16173, 16401, 16661, 16917, 17169, 17429, 17681,
        17921, 18181, 18445, 18697, 18953, 19213, 19465, 19725, 19981, 20233, 20501, 20753, 21009, 21269, 21521, 21781,
        22021, 22273, 22537, 22797, 23053, 23305, 23565, 23817, 24073, 24333, 24629, 24881, 25137, 25397, 25649, 25909,
        26149, 26401, 26665, 26925, 27181, 27433, 27693, 27945, 28201, 28461, 28721, 28981, 29237, 29489, 29749, 30001,
        30241, 30501, 30765, 31017, 31273, 31533, 31785, 32045, 32301, 32553, -32623, -32363, -32107, -31855, -31595, -31343,
        -31103, -30843, -30579, -30327, -30071, -29811, -29559, -29299, -29043, -28791, -28523, -28271, -28015, -27755, -27503, -27243,
        -27003, -26751, -26487, -26227, -25971, -25719, -25459, -25207, -24951, -24691, -24395, -24143, -23887, -23627, -23375, -23115,
        -22875, -22623, -22359, -22099, -21843, -21591, -21331, -21079, -20823, -20563, -20303, -20043, -19787, -19535, -19275, -19023,
        -18783, -18523, -18259, -18007, -17751, -17491, -17239, -16979, -16723, -16471, -16235, -15983, -15727, -15467, -15215, -14955,
        -14715, -14463, -14199, -13939, -13683, -13431, -13171, -12919, -12663, -12403, -12143, -11883, -11627, -11375, -11115, -10863,
        -10623, -10363, -10099, -9847, -9591, -9331, -9079, -8819, -8563, -8311, -8015, -7755, -7499, -7247, -6987, -6735,
        -6495, -6235, -5971, -5719, -5463, -5203, -4951, -4691, -4435, -4183, -3915, -3663, -3407, -3147, -2895, -2635,
        -2395, -2143, -1879, -1619, -1363, -1111, -851, -599, -343, -83, 85, 273, 529, 789, 1041, 1301,
        1541, 1793, 2057, 2317, 2573, 2825, 3085, 3337, 3593, 3853, 4113, 4373, 4629, 4881, 5141, 5393,
        5633, 5893, 6157, 6409, 6665, 6925, 7177, 7437, 7693, 7945, 8241, 8501, 8757, 9009, 9269, 9521,
        9761, 10021, 10285, 10537, 10793, 11053, 11305, 11565, 11821, 12073, 12341, 12593, 12849, 13109, 13361, 13621,
        13861, 14113, 14377, 14637, 14893, 15145, 15405, 15657, 15913, 16173, 16401, 16661, 16917, 17169, 17429, 17681,
        17921, 18181, 18445, 18697, 18953, 19213, 19465, 19725, 19981, 20233, 20501, 20753, 21009, 21269, 21521, 21781,
        22021, 22273, 22537, 22797, 23053, 23305, 23565, 23817, 24073, 24333, 24629, 24881, 25137, 25397, 25649, 25909,
        70, 258, 514, 774, 1026, 1286, 1542, 1794, 2058, 2318, 1026, 1286, 1542, 1794, 2058, 2318,
        4098, 4358, 4614, 4866, 5126, 5378, 5634, 5894, 6158, 6410, 5126, 5378, 5634, 5894, 6158, 6410,
        8226, 8486, 8742, 8994, 9254, 9506, 9762, 10022, 10286, 10538, 9254, 9506, 9762, 10022, 10286, 10538,
        12326, 12578, 12834, 13094, 13346, 13606, 13862, 14114, 14378, 14638, 13346, 13606, 13862, 14114, 14378, 14638,
        16386, 16646, 16902, 17154, 17414, 17666, 17922, 18182, 18446, 18698, 17414, 17666, 17922, 18182, 18446, 18698,
        20486, 20738, 20994, 21254, 21506, 21766, 22022, 22274, 22538, 22798, 21506, 21766, 22022, 22274, 22538, 22798,
        24614, 24866, 25122, 25382, 25634, 25894, 26150, 26402, 26666, 26926, 25634, 25894, 26150, 26402, 26666, 26926,
        28706, 28966, 29222, 29474, 29734, 29986, 30242, 30502, 30766, 31018, 29734, 29986, 30242, 30502, 30766, 31018,
        -32638, -32378, -32122, -31870, -31610, -31358, -31102, -30842, -30578, -30326, -31610, -31358, -31102, -30842, -30578, -30326,
        -28538, -28286, -28030, -27770, -27518, -27258, -27002, -26750, -26486, -26226, 13347, 13607, 13863, 14115, 14379, 14639,
        16387, 16647, 16903, 17155, 17415, 17667, 17923, 18183, 18447, 18699, 17415, 17667, 17923, 18183, 18447, 18699,
        20487, 20739, 20995, 21255, 21507, 21767, 22023, 22275, 22539, 22799, 21507, 21767, 22023, 22275, 22539, 22799,
        24615, 24867, 25123, 25383, 25635, 25895, 26151, 26403, 26667, 26927, 25635, 25895, 26151, 26403, 26667, 26927,
        28707, 28967, 29223, 29475, 29735, 29987, 30243, 30503, 30767, 31019, 29735, 29987, 30243, 30503, 30767, 31019,
        -32637, -32377, -32121, -31869, -31609, -31357, -31101, -30841, -30577, -30325, -31609, -31357, -31101, -30841, -30577, -30325,
        -28537, -28285, -28029, -27769, -27517, -27257, -27001, -26749, -26485, -26225, -27517, -27257, -27001, -26749, -26485, -26225,
        -24409, -24157, -23901, -23641, -23389, -23129, -22873, -22621, -22357, -22097, -23389, -23129, -22873, -22621, -22357, -22097,
        -20317, -20057, -19801, -19549, -19289, -19037, -18781, -18521, -18257, -18005, -19289, -19037, -18781, -18521, -18257, -18005,
        -16249, -15997, -15741, -15481, -15229, -14969, -14713, -14461, -14197, -13937, -15229, -14969, -14713, -14461, -14197, -13937,
        -12157, -11897, -11641, -11389, -11129, -10877, -10621, -10361, -10097, -9845, -11129, -10877, -10621, -10361, -10097, -9845,
        -8029, -7769, -7513, -7261, -7001, -6749, -6493, -6233, -5969, -5717, -7001, -6749, -6493, -6233, -5969, -5717,
        -3929, -3677, -3421, -3161, -2909, -2649, -2393, -2141, -1877, -1617, -2909, -2649, -2393, -2141, -1877, -1617,
        71, 259, 515, 775, 1027, 1287, 1543, 1795, 2059, 2319, 1027, 1287, 1543, 1795, 2059, 2319,
        4099, 4359, 4615, 4867, 5127, 5379, 5635, 5895, 6159, 6411, 5127, 5379, 5635, 5895, 6159, 6411,
        8227, 8487, 8743, 8995, 9255, 9507, 9763, 10023, 10287, 10539, 9255, 9507, 9763, 10023, 10287, 10539,
        12327, 12579, 12835, 13095, 13347, 13607, 13863, 14115, 14379, 14639, 13347, 13607, 13863, 14115, 14379, 14639,
        16387, 16647, 16903, 17155, 17415, 17667, 17923, 18183, 18447, 18699, 17415, 17667, 17923, 18183, 18447, 18699,
        20487, 20739, 20995, 21255, 21507, 21767, 22023, 22275, 22539, 22799, 21507, 21767, 22023, 22275, 22539, 22799,
        24615, 24867, 25123, 25383, 25635, 25895, 26151, 26403, 26667, 26927, 25635, 25895, 26151, 26403, 26667, 26927,
        28707, 28967, 29223, 29475, 29735, 29987, 30243, 30503, 30767, 31019, 29735, 29987, 30243, 30503, 30767, 31019,
        -32637, -32377, -32121, -31869, -31609, -31357, -31101, -30841, -30577, -30325, -31609, -31357, -31101, -30841, -30577, -30325,
        -28537, -28285, -28029, -27769, -27517, -27257, -27001, -26749, -26485, -26225, -27517, -27257, -27001, -26749, -26485, -26225,
        -1346, -1094, -834, -582, -326, -66, 70, 258, 514, 774, 1026, 1286, 1542, 1794, 2058, 2318,
        2590, 2842, 3102, 3354, 3610, 3870, 4098, 4358, 4614, 4866, 5126, 5378, 5634, 5894, 6158, 6410,
        6682, 6942, 7194, 7454, 7710, 7962, 8226, 8486, 8742, 8994, 9254, 9506, 9762, 10022, 10286, 10538,
        10810, 11070, 11322, 11582, 11838, 12090, 12326, 12578, 12834, 13094, 13346, 13606, 13862, 14114, 14378, 14638,
        14910, 15162, 15422, 15674, 15930, 16190, 16386, 16646, 16902, 17154, 17414, 17666, 17922, 18182, 18446, 18698,
        18970, 19230, 19482, 19742, 19998, 20250, 20486, 20738, 20994, 21254, 21506, 21766, 22022, 22274, 22538, 22798,
        23070, 23322, 23582, 23834, 24090, 24350, 24614, 24866, 25122, 25382, 25634, 25894, 26150, 26402, 26666, 26926,
        27198, 27450, 27710, 27962, 28218, 28478, 28706, 28966, 29222, 29474, 29734, 29986, 30242, 30502, 30766, 31018,
        31290, 31550, 31802, 32062, 32318, 32570, -32638, -32378, -32122, -31870, -31610, -31358, -31102, -30842, -30578, -30326,
        -30054, -29794, -29542, -29282, -29026, -28774, -28538, -28286, -28030, -27770, 13347, 13607, 13863, 14115, 14379, 14639,
        14911, 15163, 15423, 15675, 15931, 16191, 16387, 16647, 16903, 17155, 17415, 17667, 17923, 18183, 18447, 18699,
        18971, 19231, 19483, 19743, 19999, 20251, 20487, 20739, 20995, 21255, 21507, 21767, 22023, 22275, 22539, 22799,
        23071, 23323, 23583, 23835, 24091, 24351, 24615, 24867, 25123, 25383, 25635, 25895, 26151, 26403, 26667, 26927,
        27199, 27451, 27711, 27963, 28219, 28479, 28707, 28967, 29223, 29475, 29735, 29987, 30243, 30503, 30767, 31019,
        31291, 31551, 31803, 32063, 32319, 32571, -32637, -32377, -32121, -31869, -31609, -31357, -31101, -30841, -30577, -30325,
        -30053, -29793, -29541, -29281, -29025, -28773, -28537, -28285, -28029, -27769, -27517, -27257, -27001, -26749, -26485, -26225,
        -25953, -25701, -25441, -25189, -24933, -24673, -24409, -24157, -23901, -23641, -23389, -23129, -22873, -22621, -22357, -22097,
        -21825, -21573, -21313, -21061, -20805, -20545, -20317, -20057, -19801, -19549, -19289, -19037, -18781, -18521, -18257, -18005,
        -17733, -17473, -17221, -16961, -16705, -16453, -16249, -15997, -15741, -15481, -15229, -14969, -14713, -14461, -14197, -13937,
        -13665, -13413, -13153, -12901, -12645, -12385, -12157, -11897, -11641, -11389, -11129, -10877, -10621, -10361, -10097, -9845,
        -9573, -9313, -9061, -8801, -8545, -8293, -8029, -7769, -7513, -7261, -7001, -6749, -6493, -6233, -5969, -5717,
        -5445, -5185, -4933, -4673, -4417, -4165, -3929, -3677, -3421, -3161, -2909, -2649, -2393, -2141, -1877, -1617,
        -1345, -1093, -833, -581, -325, -65, 71, 259, 515, 775, 1027, 1287, 1543, 1795, 2059, 2319,
        2591, 2843, 3103, 3355, 3611, 3871, 4099, 4359, 4615, 4867, 5127, 5379, 5635, 5895, 6159, 6411,
        6683, 6943, 7195, 7455, 7711, 7963, 8227, 8487, 8743, 8995, 9255, 9507, 9763, 10023, 10287, 10539,
        10811, 11071, 11323, 11583, 11839, 12091, 12327, 12579, 12835, 13095, 13347, 13607, 13863, 14115, 14379, 14639,
        14911, 15163, 15423, 15675, 15931, 16191, 16387, 16647, 16903, 17155, 17415, 17667, 17923, 18183, 18447, 18699,
        18971, 19231, 19483, 19743, 19999, 20251, 20487, 20739, 20995, 21255, 21507, 21767, 22023, 22275, 22539, 22799,
        23071, 23323, 23583, 23835, 24091, 24351, 24615, 24867, 25123, 25383, 25635, 25895, 26151, 26403, 26667, 26927,
        27199, 27451, 27711, 27963, 28219, 28479, 28707, 28967, 29223, 29475, 29735, 29987, 30243, 30503, 30767, 31019,
        31291, 31551, 31803, 32063, 32319, 32571, -32637, -32377, -32121, -31869, -31609, -31357, -31101, -30841, -30577, -30325,
        -30053, -29793, -29541, -29281, -29025, -28773, -28537, -28285, -28029, -27769, -27517, -27257, -27001, -26749, -26485, -26225
    ];
    }());

    module.exports = Z80_Register;
}());

},{"./bin-util.js":12}],18:[function(require,module,exports){
"use strict";
var oct = require("../lib/oct");

/**
 * Z80 assembled line class.
 * Assemble one line source code.
 *
 * @param {string} source   One line Z80 source code.
 * @param {number} address  Starting address of the source.
 * @param {object} dictionary   The map label to address.
 * @constructor
 */
var Z80LineAssembler = function() {

    /**
     * Code starting address
     * @type {number}
     */
    this.address = null;

    /**
     * Z80 machine codes
     * @type {number[]}
     */
    this.bytecode = [];

    /**
     * Attached label
     * @type {string}
     */
    this.label = null;

    /**
     * Z80 mnemonic
     * @type {string}
     */
    this.mnemonic = null;

    /**
     * operand for mnemonic
     * @type {string}
     */
    this.operand = null;

    /**
     * Comment for this line
     * @type {string}
     */
    this.comment = "";

    /**
     * The address that may be jumped or called to
     * @type {number|null}
     */
    this.ref_addr_to =  null;

    /**
     * Referenced count of this address as a distination of the instructions JP, JR, or CALL.
     * @type {number}
     */
    this.referenced_count = 0;

}

/**
 * Set address.
 * @param {number} address starting address of this code
 * @returns {undefined}
 */
Z80LineAssembler.prototype.setAddress = function(address) {
    this.address = address;
};

/**
 * Set referencing address.
 * @param {number|null} ref_addr_to starting address of this code
 * @returns {undefined}
 */
Z80LineAssembler.prototype.setRefAddrTo = function(ref_addr_to) {
    this.ref_addr_to = ref_addr_to;
};

/**
 * Set label for address.
 * @param {string|null} label   A label to be set or remove by null
 * @returns {undefined}
 */
Z80LineAssembler.prototype.setLabel = function(label) {
    this.label = label;
};

/**
 * Set comment
 * @param {string} comment comment string.
 * @returns {undefined}
 */
Z80LineAssembler.prototype.setComment = function(comment) {
    this.address = this.address || 0;
    this.comment = comment;
};

/**
 * Create Z80 assembler instruction code line.
 *
 * @param {string}          mnemonic    Mnemonic.
 * @param {string|null}     operand     Operand for mnemonic.
 * @param {number[]|null}   machineCode Machine codes.
 *
 * @returns {Z80LineAssembler} assembled line object
 */
Z80LineAssembler.create = function(mnemonic, operand, machineCode) {
    var asmline = new Z80LineAssembler();
    asmline.mnemonic = mnemonic;
    asmline.operand = operand || "";
    asmline.bytecode = machineCode || [];
    return asmline;
};

Z80LineAssembler.assemble = function(source, address, dictionary) {
    var asmline = new Z80LineAssembler();
    asmline.address = address;

    var tokens = Z80LineAssembler.tokenize(source);

    var found_label = -1;
    var found_comment = -1;
    for(var j = 0; j < tokens.length; j++) {
        switch(tokens[j]) {
            case ':':
                if(found_label < 0 && found_comment < 0) {
                    found_label = j;
                }
                break;
            case ';':
                if(found_comment < 0) {
                    found_comment = j;
                }
                break;
        }
    }
    if(found_label >= 0) {
        asmline.label = tokens.slice(0, found_label).join('');
        tokens.splice(0, found_label + 1);
        found_comment -= (found_label + 1);
    }
    if(found_comment >= 0) {
        asmline.comment = tokens.slice(found_comment).join('');
        tokens.splice(found_comment);
    }
    if(tokens.length > 0) {
        asmline.mnemonic = tokens[0];
        asmline.operand = tokens.slice(1).join('');
    }
    if(tokens.length > 0) {
        try {
            asmline.bytecode = asmline.assembleMnemonic(tokens, dictionary);
        } catch(e) {
            asmline.comment += "*** ASSEMBLE ERROR - " + e;
        }
    }
    return asmline;
};

/**
 * Next starting address of this line.
 * @returns {number} Address.
 */
Z80LineAssembler.prototype.getNextAddress = function()
{
    return this.address + this.bytecode.length;
};

/**
 * Last address of the binary codes.
 * @returns {number} Address.
 */
Z80LineAssembler.prototype.getLastAddress = function() {
    return this.address + this.bytecode.length - 1;
};

/**
 * Resolve the address if it was referenced by a label.
 * @param {object} dictionary   A label to address map.
 * @returns {undefined}
 */
Z80LineAssembler.prototype.resolveAddress = function(dictionary)
{
    for(var j = 0; j < this.bytecode.length; j++) {
        if(typeof(this.bytecode[j]) == 'function') {
            this.bytecode[j] = this.bytecode[j](dictionary);
        }
    }
};

Z80LineAssembler.tokenize = function(line) {
    var LEX_IDLE=0;
    var LEX_NUMBER=2;
    var LEX_IDENT=3;
    var LEX_CHAR=4;
    var currstat = LEX_IDLE;
    var L = line.length;
    var i = 0;
    var toks = [];
    var tok = '';
    line = line.toUpperCase();
    while(i < L) {
        var ch = line.charAt(i);
        switch(currstat) {
            case LEX_IDLE:
                if(/\s/.test(ch)) {
                    i++;
                } else {
                    if(ch == '-' || ch =='+') {
                        tok += ch;
                        i++;
                        currstat = LEX_NUMBER;
                    } else if(/[0-9]/.test(ch)) {
                        currstat = LEX_NUMBER;
                    }
                    else if(/[A-Z_\?\.\*#!\$]/.test(ch)) {
                        tok += ch;
                        i++;
                        currstat = LEX_IDENT;
                    }
                    else if(ch == "'") {
                        tok += ch;
                        i++;
                        currstat = LEX_CHAR;
                    }
                    else if( ch == '(' || ch == ')' || ch == ',' || ch == '+' || ch == ':') {
                        toks.push(ch);
                        i++;
                    }
                    else if( ch == ';') {
                        toks.push(ch);
                        i++;
                        var comment = line.substr(i);
                        toks.push(comment);
                        i += comment.length;
                        tok = '';
                    }
                    else {
                        throw 'unrecognized char ' + ch + ' at column ' + i;
                    }
                }
                break;
            case LEX_NUMBER:
                if(/[0-9A-F]/.test(ch)) {
                    tok += ch;
                    i++;
                } else if(ch == 'H') {
                    tok += ch;
                    i++;
                    toks.push(tok);
                    tok = '';
                    currstat = LEX_IDLE;
                } else {
                    toks.push(tok);
                    tok = '';
                    currstat = LEX_IDLE;
                }
                break;
            case LEX_IDENT:
                if(/[A-Z_0-9\?\.\*#!\$']/.test(ch)) {
                    tok += ch;
                    i++;
                } else {
                    toks.push(tok);
                    tok = '';
                    currstat = LEX_IDLE;
                }
                break;
            case LEX_CHAR:
                if(ch == "\\") {
                    ++i;
                    if(i < L) {
                        ch = line.charAt(i);
                        tok += ch;
                        i++;
                    }
                } else if(ch != "'") {
                    tok += ch;
                    i++;
                } else {
                    tok += ch;
                    i++;
                    toks.push(tok);
                    tok = '';
                    currstat = LEX_IDLE;
                }
                break;
            default:
                throw 'unrecognized status ';
        } 
    }
    if(tok != '') {
        toks.push(tok);
    }
    return toks;
};

Z80LineAssembler.prototype.assembleMnemonic = function(toks, dictionary) {
    var label = this.label;
    //
    // Pseudo Instruction
    //
    if(match_token(toks,['ORG', null])) {
        this.address = Z80LineAssembler._parseNumLiteral(toks[1]);
        return [];
    }
    if(match_token(toks,['ENT'])) {
        dictionary[label] = this.address;
        return [];
    }
    if(match_token(toks,['EQU', null])) {
        if(label == null || label == "") {
            throw "empty label for EQU";
        }
        dictionary[label] = Z80LineAssembler._parseNumLiteral(toks[1]);
        return [];
    }
    if(match_token(toks,['DEFB', null])) {
        return [Z80LineAssembler.parseNumLiteral(toks[1])];
    }
    if(match_token(toks,['DEFW', null])) {
        return Z80LineAssembler.parseNumLiteralPair(toks[1]);
    }
    if(match_token(toks,['DEFS', null])) {
        var n = Z80LineAssembler._parseNumLiteral(toks[1]);
        if(n < 0) {
            throw "negative DEFS number " + toks[1];
        }
        var zeros = [];
        for(var i = 0; i < n; i++) {
            zeros.push(0);
        }
        return zeros;
    }
	//=================================================================================
	//
	// 8bit load group
	//
	//=================================================================================
    if(match_token(toks,['LD', 'A', ',', 'I'])) { return [oct("0355"), oct("0127")]; }
    if(match_token(toks,['LD', 'A', ',', 'R'])) { return [oct("0355"), oct("0137")]; }
    if(match_token(toks,['LD', 'I', ',', 'A'])) { return [oct("0355"), oct("0107")]; }
    if(match_token(toks,['LD', 'R', ',', 'A'])) { return [oct("0355"), oct("0117")]; }
	//=================================================================================
    // Undefined instruction
	//=================================================================================
    if(match_token(toks,['LD', 'B', ',', 'IXH'])) {
        return [0xdd, 0x44];
    }
    if(match_token(toks,['LD', 'C', ',', 'IXL'])) {
        return [0xdd, 0x4d];
    }
    if(match_token(toks,['LD', 'A', ',', 'IXL'])) {
        return [0xdd, 0x7d];
    }
    if(match_token(toks,['ADD', 'A', ',', 'IXH'])) {
        return [0xdd, 0x84];
    }
    if(match_token(toks,['ADD', 'A', ',', 'IXL'])) {
        return [0xdd, 0x85];
    }
    if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', /^[BCDEHLA]$/])) {
        var dst_r = get8bitRegId(toks[1]);
        var src_r = get8bitRegId(toks[3]);
        return [oct("0100") | (dst_r << 3) | (src_r) << 0];
    }
    if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', null])) {
        return (function() {
            var r = get8bitRegId(toks[1]);
            var n = Z80LineAssembler.parseNumLiteral(toks[3]);
            return [oct("0006") | (r << 3), n];
        }());
    }
    if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(','HL',')'])) {
        return (function() {
            var r = get8bitRegId(toks[1]);
            return [oct("0106") | (r << 3)];
        }());
    }
    if(match_token(toks,['LD', '(','HL',')', ',', /^[BCDEHLA]$/])) {
        return (function() {
            var r = get8bitRegId(toks[5]);
            return [oct("0160") | r];
        }());
    }
    if(match_token(toks,['LD', '(','HL',')', ',', null])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteral(toks[5]);
            return [oct("0066"), n];
        }());
    }
    if(match_token(toks,['LD', 'A', ',', '(', /^(BC|DE)$/, ')'])) {
        return (function() {
            var dd = get16bitRegId_dd(toks[4]);
            return [oct("0012") | (dd << 4)];
        }());
    }
    if(match_token(toks,['LD', 'A', ',', '(', null, ')'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
            return [oct("0072"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', '(', /^(BC|DE)$/, ')', ',', 'A'])) {
        return (function() {
            var dd = get16bitRegId_dd(toks[2]);
            return [oct("0002") | (dd << 4)];
        }());
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'A'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
            return [oct("0062"), n[0], n[1]];
        }());
    }
	//=================================================================================
	//
	// 16bit load group
	//
	//=================================================================================
    if(match_token(toks,['LD', 'SP', ',', 'HL'])) { return [oct("0371")]; }
    if(match_token(toks,['LD', 'SP', ',', 'IX'])) { return [0xDD, 0xF9]; }
    if(match_token(toks,['LD', 'SP', ',', 'IY'])) { return [0xfd, 0xF9]; }
    if(match_token(toks,['LD', /^(BC|DE|HL|SP)$/, ',', null])) {
        return (function() {
            var dd = get16bitRegId_dd(toks[1]);
            var n = Z80LineAssembler.parseNumLiteralPair(toks[3]);
            return [oct("0001") | (dd << 4), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', 'HL', ',', '(', null, ')'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
            return [oct("0052"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', 'BC', ',', '(', null, ')'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
            return [oct("0355"), oct("0113"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', 'DE', ',', '(', null, ')'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
            return [oct("0355"), oct("0133"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', 'SP', ',', '(', null, ')'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
            return [oct("0355"), oct("0173"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'HL'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
            return [oct("0042"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'BC'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
            return [oct("0355"), oct("0103"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'DE'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
            return [oct("0355"), oct("0123"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'SP'])) {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
            return [oct("0355"), oct("0163"), n[0], n[1]];
        }());
    }
    if(match_token(toks,['PUSH', /^(BC|DE|HL|AF)$/])) {
        return (function() {
            var qq = get16bitRegId_qq(toks[1]);
            return [oct("0305") | (qq << 4)];
        }());
    }
    if(match_token(toks,['POP', /^(BC|DE|HL|AF)$/])) {
        return (function() {
            var qq = get16bitRegId_qq(toks[1]);
            return [oct("0301") | (qq << 4)];
        }());
    }
	//=================================================================================
    // Undefined instruction
	//=================================================================================
    if(match_token(toks,['LD', 'IXH', ',', 'B'])) {
        return [0xdd, 0x60];
    }
    if(match_token(toks,['LD', 'IXL', ',', 'C'])) {
        return [0xdd, 0x69];
    }
    if(match_token(toks,['LD', 'IXH', ',', 'A'])) {
        return [0xdd, 0x67];
    }
    if(match_token(toks,['LD', 'IXL', ',', 'A'])) {
        return [0xdd, 0x6f];
    }
    if(match_token(toks,['CP', 'IXL'])) {
        return [0xdd, 0xbd];
    }
	//=================================================================================
    //
    // エクスチェンジグループ、ブロック転送および、サーチグループ
    //
	//=================================================================================
    if(match_token(toks,['EX', 'DE', ',', 'HL'])) { return [0xEB]; }
    if(match_token(toks,['EX', 'AF', ',', "AF'"])) { return [0x08]; }
    if(match_token(toks,['EXX'])) { return [0xD9]; }
    if(match_token(toks,['EX', '(', 'SP', ')', ',', 'HL'])) { return [0xE3]; }
    if(match_token(toks,['LDI']))   { return [oct("0355"),oct("0240")]; }
    if(match_token(toks,['LDIR']))  { return [oct("0355"),oct("0260")]; }
    if(match_token(toks,['LDD']))   { return [oct("0355"),oct("0250")]; }
    if(match_token(toks,['LDDR']))  { return [oct("0355"),oct("0270")]; }
    if(match_token(toks,['CPI']))   { return [oct("0355"),oct("0241")]; }
    if(match_token(toks,['CPIR']))  { return [oct("0355"),oct("0261")]; }
    if(match_token(toks,['CPD']))   { return [oct("0355"),oct("0251")]; }
    if(match_token(toks,['CPDR']))  { return [oct("0355"),oct("0271")]; }
    
    //=================================================================================
    // 一般目的の演算、及びCPUコントロールグループ
    //=================================================================================
    if(match_token(toks,['DAA']))   { return [oct("0047")]; }
    if(match_token(toks,['CPL']))   { return [oct("0057")]; }
    if(match_token(toks,['NEG']))   { return [oct("0355"),oct("0104")]; }
    if(match_token(toks,['CCF']))   { return [oct("0077")]; }
    if(match_token(toks,['SCF']))   { return [oct("0067")]; }
    if(match_token(toks,['NOP']))   { return [oct("0000")]; }
    if(match_token(toks,['HALT']))  { return [oct("0166")]; }
    if(match_token(toks,['DI']))    { return [oct("0363")]; }
    if(match_token(toks,['EI']))    { return [oct("0373")]; }
    if(match_token(toks,['IM0']))   { return [oct("0355"),oct("0106")]; }
    if(match_token(toks,['IM1']))   { return [oct("0355"),oct("0126")]; }
    if(match_token(toks,['IM2']))   { return [oct("0355"),oct("0136")]; }
    if(match_token(toks,['IM','0']))   { return [oct("0355"),oct("0106")]; }
    if(match_token(toks,['IM','1']))   { return [oct("0355"),oct("0126")]; }
    if(match_token(toks,['IM','2']))   { return [oct("0355"),oct("0136")]; }

    //=================================================================================
    // 16ビット演算グループ
    //=================================================================================
    if(match_token(toks,[/^(ADD|ADC|SBC)$/, 'HL', ',', /^(BC|DE|HL|SP)$/]))   {
        var ss = 0;
        switch(toks[3]) {
            case 'BC': ss = 0; break;
            case 'DE': ss = 1; break;
            case 'HL': ss = 2; break;
            case 'SP': ss = 3; break;
        }
        switch(toks[0]) {
            case 'ADD': return [oct("0011") | (ss << 4)];
            case 'ADC': return [oct("0355"), oct("0112") | (ss << 4)];
            case 'SBC': return [oct("0355"), oct("0102") | (ss << 4)];
        }
        return [];
    }
    if(match_token(toks,['ADD', 'IX', ',', /^(BC|DE|IX|SP)$/]))   {
        switch(toks[3]) {
            case 'BC': return [oct("0335"), oct("0011")];
            case 'DE': return [oct("0335"), oct("0031")];
            case 'IX': return [oct("0335"), oct("0051")];
            case 'SP': return [oct("0335"), oct("0071")];
        }
        return [];
    }
    if(match_token(toks,['ADD', 'IY', ',', /^(BC|DE|IY|SP)$/]))   {
        switch(toks[3]) {
            case 'BC': return [oct("0375"), oct("0011")];
            case 'DE': return [oct("0375"), oct("0031")];
            case 'IY': return [oct("0375"), oct("0051")];
            case 'SP': return [oct("0375"), oct("0071")];
        }
        return [];
    }
    if(match_token(toks,[/^(INC|DEC)$/, /^(BC|DE|HL|SP|IX|IY)$/]))   {
        switch(toks[0]) {
            case 'INC':
                switch(toks[1]) {
                    case 'BC': return [oct("0003")];
                    case 'DE': return [oct("0023")];
                    case 'HL': return [oct("0043")];
                    case 'SP': return [oct("0063")];
                    case 'IX': return [oct("0335"),oct("0043")];
                    case 'IY': return [oct("0375"),oct("0043")];
                }
                break;
            case 'DEC':
                switch(toks[1]) {
                    case 'BC': return [oct("0013")];
                    case 'DE': return [oct("0033")];
                    case 'HL': return [oct("0053")];
                    case 'SP': return [oct("0073")];
                    case 'IX': return [oct("0335"),oct("0053")];
                    case 'IY': return [oct("0375"),oct("0053")];
                }
                break;
        }
        return [];
    }

    //=================================================================================
    // ローテイト・シフトグループ
    //=================================================================================
    if(match_token(toks,['RLCA']))  { return [oct("0007")]; }
    if(match_token(toks,['RLA']))   { return [oct("0027")]; }
    if(match_token(toks,['RRCA']))  { return [oct("0017")]; }
    if(match_token(toks,['RRA']))   { return [oct("0037")]; }

    if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,/^[BCDEHLA]$/])) {
        switch(toks[0]) {
            case 'RLC': return [oct("0313"), oct("0000") | get8bitRegId(toks[1])];
            case 'RL':  return [oct("0313"), oct("0020") | get8bitRegId(toks[1])];
            case 'RRC': return [oct("0313"), oct("0010") | get8bitRegId(toks[1])];
            case 'RR':  return [oct("0313"), oct("0030") | get8bitRegId(toks[1])];
            case 'SLA': return [oct("0313"), oct("0040") | get8bitRegId(toks[1])];
            case 'SRA': return [oct("0313"), oct("0050") | get8bitRegId(toks[1])];
            case 'SRL': return [oct("0313"), oct("0070") | get8bitRegId(toks[1])];
        }
        return [];
    }
    if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(','HL',')']))  {
        switch(toks[0]) {
            case 'RLC': return [oct("0313"), oct("0006")];
            case 'RL':  return [oct("0313"), oct("0026")];
            case 'RRC': return [oct("0313"), oct("0016")];
            case 'RR':  return [oct("0313"), oct("0036")];
            case 'SLA': return [oct("0313"), oct("0046")];
            case 'SRA': return [oct("0313"), oct("0056")];
            case 'SRL': return [oct("0313"), oct("0076")];
        }
        return [];
    }
    if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(',/^(IX|IY)$/,'+',null, ')'])
    || match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(',/^(IX|IY)$/,/^\+.*/, ')']))  {
        return (function() {
            var index_d = ((toks[3] == '+') ? 4 : 3);
            var prefix = 0;
            switch(toks[2]) {
                case 'IX': prefix = oct("0335"); break;
                case 'IY': prefix = oct("0375"); break;
            }
            var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
            switch(toks[0]) {
                case 'RLC': return [prefix, oct("0313"), d, oct("0006")];
                case 'RL':  return [prefix, oct("0313"), d, oct("0026")];
                case 'RRC': return [prefix, oct("0313"), d, oct("0016")];
                case 'RR':  return [prefix, oct("0313"), d, oct("0036")];
                case 'SLA': return [prefix, oct("0313"), d, oct("0046")];
                case 'SRA': return [prefix, oct("0313"), d, oct("0056")];
                case 'SRL': return [prefix, oct("0313"), d, oct("0076")];
            }
            return [];
        }());
    }
    if(match_token(toks,['RLD']))  { return [oct("0355"), oct("0157")]; }
    if(match_token(toks,['RRD']))  { return [oct("0355"), oct("0147")]; }

    //=================================================================================
    // ビットセット・リセット及びテストグループ
    //=================================================================================

    if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', /^[BCDEHLA]$/])) {
        switch(toks[0]) {
            case 'BIT': return [oct("0313"), oct("0100") | (toks[1] << 3) | get8bitRegId(toks[3])];
            case 'SET': return [oct("0313"), oct("0300") | (toks[1] << 3) | get8bitRegId(toks[3])];
            case 'RES': return [oct("0313"), oct("0200") | (toks[1] << 3) | get8bitRegId(toks[3])];
        }
        return [];
    }
    if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(','HL',')']))  {
        switch(toks[0]) {
            case 'BIT': return [oct("0313"), oct("0106") | (toks[1] << 3)];
            case 'SET': return [oct("0313"), oct("0306") | (toks[1] << 3)];
            case 'RES': return [oct("0313"), oct("0206") | (toks[1] << 3)];
        }
        return [];
    }
    if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(',/^(IX|IY)$/,'+',null,')'])
    || match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(',/^(IX|IY)$/,/^\+.*$/,')'])) {
        return (function() {
            var index_d = ((toks[5] == '+') ? 6 : 5);
            var prefix = 0;
            switch(toks[4]) {
                case 'IX': prefix = oct("0335"); break;
                case 'IY': prefix = oct("0375"); break;
            }
            var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
            switch(toks[0]) {
                case 'BIT': return [prefix, oct("0313"), d, oct("0106") | (toks[1] << 3)];
                case 'SET': return [prefix, oct("0313"), d, oct("0306") | (toks[1] << 3)];
                case 'RES': return [prefix, oct("0313"), d, oct("0206") | (toks[1] << 3)];
            }
            return [];
        }());
    }

    //=================================================================================
    // ジャンプグループ
    //=================================================================================

    if(match_token(toks,['JP', null]))  {
        return (function() {
            var nn = Z80LineAssembler.parseNumLiteralPair(toks[1]);
            return [oct("0303"), nn[0], nn[1]];
        }());
    }
    if(match_token(toks,['JP', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',',  null]))  {
        return (function() {
            var nn = Z80LineAssembler.parseNumLiteralPair(toks[3]);
            switch(toks[1]) {
                case 'NZ':  return [oct("0302"), nn[0], nn[1]];
                case 'Z':   return [oct("0312"), nn[0], nn[1]];
                case 'NC':  return [oct("0322"), nn[0], nn[1]];
                case 'C':   return [oct("0332"), nn[0], nn[1]];
                case 'PO':  return [oct("0342"), nn[0], nn[1]];
                case 'PE':  return [oct("0352"), nn[0], nn[1]];
                case 'P':   return [oct("0362"), nn[0], nn[1]];
                case 'M':   return [oct("0372"), nn[0], nn[1]];
            }
            return [];
        }());
    }
    if(match_token(toks,['JR', null]))  {
        return (function() {
            var e = Z80LineAssembler.parseRelAddr(toks[1], this.address + 2);
            return [oct("0030"), e];
        }.bind(this)());
    }
    if(match_token(toks,['JR', /^(NZ|Z|NC|C)$/, ',',  null]))  {
        return (function() {
            var e = Z80LineAssembler.parseRelAddr(toks[3], this.address + 2);
            switch(toks[1]) {
                case 'NZ':  return [oct("0040"), e];
                case 'Z':   return [oct("0050"), e];
                case 'NC':  return [oct("0060"), e];
                case 'C':   return [oct("0070"), e];
            }
            return [];
        }.bind(this)());
    }
    if(match_token(toks,['JP', '(', /^(HL|IX|IY)$/, ')']))  {
        switch(toks[2]) {
            case 'HL':  return [oct("0351")];
            case 'IX':  return [oct("0335"), oct("0351")];
            case 'IY':  return [oct("0375"), oct("0351")];
        }
        return [];
    }
    if(match_token(toks,['DJNZ', null]))  {
        return (function() {
            var e = Z80LineAssembler.parseRelAddr(toks[1], this.address + 2);
            return [oct("0020"), e];
        }.bind(this)());
    }

    //=================================================================================
    // コールリターングループ
    //=================================================================================

    if(match_token(toks,['CALL', null]))  {
        return (function() {
            var nn = Z80LineAssembler.parseNumLiteralPair(toks[1]);
            return [oct("0315"), nn[0], nn[1]];
        }());
    }
    if(match_token(toks,['CALL', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',',  null]))  {
        return (function() {
            var nn = Z80LineAssembler.parseNumLiteralPair(toks[3]);
            switch(toks[1]) {
                case 'NZ':  return [oct("0304"), nn[0], nn[1]];
                case 'Z':   return [oct("0314"), nn[0], nn[1]];
                case 'NC':  return [oct("0324"), nn[0], nn[1]];
                case 'C':   return [oct("0334"), nn[0], nn[1]];
                case 'PO':  return [oct("0344"), nn[0], nn[1]];
                case 'PE':  return [oct("0354"), nn[0], nn[1]];
                case 'P':   return [oct("0364"), nn[0], nn[1]];
                case 'M':   return [oct("0374"), nn[0], nn[1]];
            }
            return [];
        }());
    }
    if(match_token(toks,['RET']))  { return [oct("0311")]; }
    if(match_token(toks,['RET', /^(NZ|Z|NC|C|PO|PE|P|M)$/]))  {
        switch(toks[1]) {
            case 'NZ':  return [oct("0300")];
            case 'Z':   return [oct("0310")];
            case 'NC':  return [oct("0320")];
            case 'C':   return [oct("0330")];
            case 'PO':  return [oct("0340")];
            case 'PE':  return [oct("0350")];
            case 'P':   return [oct("0360")];
            case 'M':   return [oct("0370")];
        }
        return [];
    }
    if(match_token(toks,['RETI']))  { return [oct("0355"), oct("0115")]; }
    if(match_token(toks,['RETN']))  { return [oct("0355"), oct("0105")]; }
    if(match_token(toks,['RST', /^(00H|08H|10H|18H|20H|28H|30H|38H)$/]))  {
        switch(toks[1]) {
            case '00H':  return [oct("0307")];
            case '08H':  return [oct("0317")];
            case '10H':  return [oct("0327")];
            case '18H':  return [oct("0337")];
            case '20H':  return [oct("0347")];
            case '28H':  return [oct("0357")];
            case '30H':  return [oct("0367")];
            case '38H':  return [oct("0377")];
        }
        return [];
    }

    //=================================================================================
    // 入力・出力グループ
    //=================================================================================
    if(match_token(toks,['IN', /^[BCDEHLA]$/, ',', '(','C',')']))  {
        return (function() {
            var r = get8bitRegId(toks[1]);
            return [oct("0355"), oct("0100") | (r << 3)];
        }());
    }
    if(match_token(toks,['IN', 'A', ',', '(', null, ')']))  {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteral(toks[4]);
            return [oct("0333"), n];
        }());
    }
    if(match_token(toks,['OUT', '(','C',')', ',', /^[BCDEHLA]$/]))  {
        return (function() {
            var r = get8bitRegId(toks[5]);
            return [oct("0355"), oct("0101") | (r << 3)];
        }());
    }
    if(match_token(toks,['OUT', '(', null, ')', ',', 'A']))  {
        return (function() {
            var n = Z80LineAssembler.parseNumLiteral(toks[2]);
            return [oct("0323"), n];
        }());
    }
    if(match_token(toks,['INI']))   { return [oct("0355"), oct("0242")]; }
    if(match_token(toks,['INIR']))  { return [oct("0355"), oct("0262")]; }
    if(match_token(toks,['IND']))   { return [oct("0355"), oct("0252")]; }
    if(match_token(toks,['INDR']))  { return [oct("0355"), oct("0272")]; }
    if(match_token(toks,['OUTI']))  { return [oct("0355"), oct("0243")]; }
    if(match_token(toks,['OTIR']))  { return [oct("0355"), oct("0263")]; }
    if(match_token(toks,['OUTD']))  { return [oct("0355"), oct("0253")]; }
    if(match_token(toks,['OTDR']))  { return [oct("0355"), oct("0273")]; }

	//=================================================================================
	//
    // IX/IY
    //
	//=================================================================================
    if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, '+', null, ')'])
    || match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, null, ')'])) {
        return (function() {
            var index_d = ((toks[5] == '+') ? 6 : 5);
            var r = get8bitRegId(toks[1]);
            var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
            var subope = getSubopeIXIY(toks[4]);
            return [subope, oct("0106") | (r << 3), d];
        }());
    }
    if(match_token(toks,['LD', '(', /^(IX|IY)$/, '+', null, ')', ',', /^[BCDEHLA]$/])
    || match_token(toks,['LD', '(', /^(IX|IY)$/, /^\+.*$/, ')', ',', /^[BCDEHLA]$/])) {
        return (function() {
            var index_d = ((toks[3] == '+') ? 4 : 3);
            var index_r = ((toks[3] == '+') ? 7 : 6);
            var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
            var r = get8bitRegId(toks[index_r]);
            var subope = getSubopeIXIY(toks[2]);
            return [subope, oct("0160") | r, d];
        }());
    }
    if(match_token(toks,['LD', '(', /^(IX|IY)$/, '+', null, ')', ',', null])
    || match_token(toks,['LD', '(', /^(IX|IY)$/, /^\+.*$/, ')', ',', null])) {
        return (function() {
            var index_d = ((toks[3] == '+') ? 4 : 3);
            var index_n = ((toks[3] == '+') ? 7 : 6);
            var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
            var n = Z80LineAssembler.parseNumLiteral(toks[index_n]);
            var subope = getSubopeIXIY(toks[2]);
            return [subope, 0x36, d, n];
        }());
    }
    if(match_token(toks,['LD', /^(IX|IY)$/, ',', null])) {
        return (function() {
            var nn = Z80LineAssembler.parseNumLiteralPair(toks[3]);
            var subope = getSubopeIXIY(toks[1]);
            return [subope, 0x21, nn[0], nn[1]];
        }());
    }
    if(match_token(toks,['LD', /^(IX|IY)$/, ',', '(', null, ')'])) {
        return (function() {
            var nn = Z80LineAssembler.parseNumLiteralPair(toks[4]);
            var subope = getSubopeIXIY(toks[1]);
            return [subope, 0x2A, nn[0], nn[1]];
        }());
    }
    if(match_token(toks,['PUSH', /^(IX|IY)$/])) {
        return (function() {
            var subope = getSubopeIXIY(toks[1]);
            return [subope, 0xE5];
        }());
    }
    if(match_token(toks,['POP', /^(IX|IY)$/])) {
        return (function() {
            var subope = getSubopeIXIY(toks[1]);
            return [subope, 0xE1];
        }());
    }
    if(match_token(toks,['EX', '(','SP',')', ',', /^(IX|IY)$/])) {
        return (function() {
            var subope = getSubopeIXIY(toks[5]);
            return [subope, 0xE3];
        }());
    }

    //=================================================================================
    // 8ビット演算
    //=================================================================================
    if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', /^[BCDEHLA]$/])) {
        return (function() {
            var subseq = getArithmeticSubOpecode(toks[0]);
            var r = get8bitRegId(toks[3]);
            return [oct("0200") | (subseq << 3) | r];
        }());
    }
    if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', null])) {
        return (function() {
            var subseq = getArithmeticSubOpecode(toks[0]);
            var n = Z80LineAssembler.parseNumLiteral(toks[3]);
            return [oct("0306") | (subseq << 3), n];
        }());
    }
    if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', 'HL', ')'])) {
        return (function() {
            var subseq = getArithmeticSubOpecode(toks[0]);
            return [oct("0206") | (subseq << 3)];
        }());
    }
    if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, '+', null,  ')'])
    || match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, /^\+.*/,  ')'])) {
        return (function() {
            var index_d = ((toks[5] == '+') ? 6 : 5);
            var subseq = getArithmeticSubOpecode(toks[0]);
            var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
            var subope = getSubopeIXIY(toks[4]);
            return [subope, oct("0206") | (subseq << 3), d];
        }());
    }
    if(match_token(toks,[/^(AND|OR|XOR|CP)$/, /^[BCDEHLA]$/])) {
        return (function() {
            var subseq = getArithmeticSubOpecode(toks[0]);
            var r = get8bitRegId(toks[1]);
            return [oct("0200") | (subseq << 3) | r];
        }());
    }
    if(match_token(toks,[/^(AND|OR|XOR|CP)$/, null])) {
        return (function() {
            var subseq = getArithmeticSubOpecode(toks[0]);
            var n = Z80LineAssembler.parseNumLiteral(toks[1]);
            return [oct("0306") | (subseq << 3), n];
        }());
    }
    if(match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', 'HL', ')'])) {
        return (function() {
            var subseq = getArithmeticSubOpecode(toks[0]);
            return [oct("0206") | (subseq << 3)];
        }());
    }
    if(match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, '+', null,  ')'])
    || match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, /^\+.*$/,  ')'])) {
        return (function() {
            var index_d = ((toks[3] == '+') ? 4 : 3);
            var subseq = getArithmeticSubOpecode(toks[0]);
            var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
            var subope = getSubopeIXIY(toks[2]);
            return [subope, oct("0206") | (subseq << 3), d];
        }());
    }
    if(match_token(toks,[/^(INC|DEC)$/, /^[BCDEHLA]$/])) {
        return (function() {
            var r = get8bitRegId(toks[1]);
            switch(toks[0]) {
                case 'INC': return [oct("0004") | (r << 3)];
                case 'DEC': return [oct("0005") | (r << 3)];
            }
        }());
    }
    if(match_token(toks,[/^(INC|DEC)$/, '(', 'HL', ')'])) {
        switch(toks[0]) {
            case 'INC': return [oct("0064")];
            case 'DEC': return [oct("0065")];
        }
    }
    if(match_token(toks,[/^(INC|DEC)$/, '(', /^(IX|IY)$/, '+', null,  ')'])
    || match_token(toks,[/^(INC|DEC)$/, '(', /^(IX|IY)$/, /^\+.*$/,  ')'])) {
        return (function() {
            var subope = getSubopeIXIY(toks[2]);
            var index_d = ((toks[3] == '+') ? 4 : 3);
            var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
            switch(toks[0]) {
                case 'INC': return [subope, oct("0064"), d];
                case 'DEC': return [subope, oct("0065"), d];
            }
        }());
    }
    console.warn("**** ERROR: CANNOT ASSEMBLE:" + toks.join(" / "));
    return [];
};

function getSubopeIXIY(tok) {
    var subope = 0;
    switch(tok) {
        case 'IX': subope = oct("0335"); break;
        case 'IY': subope = oct("0375"); break;
    }
    return subope;
}

function getArithmeticSubOpecode(opecode) {
    var subseq = 0;
    switch(opecode) {
        case 'ADD': subseq = 0; break;
        case 'ADC': subseq = 1; break;
        case 'SUB': subseq = 2; break;
        case 'SBC': subseq = 3; break;
        case 'AND': subseq = 4; break;
        case 'OR': subseq = 6; break;
        case 'XOR': subseq = 5; break;
        case 'CP': subseq = 7; break;
    }
    return subseq;
}

function get16bitRegId_dd(name) {
    var r = null;
    switch(name) {
        case 'BC': r = 0; break;
        case 'DE': r = 1; break;
        case 'HL': r = 2; break;
        case 'SP': r = 3; break;
        default: break;
    }
    return r;
}

function get16bitRegId_qq(name) {
    var r = null;
    switch(name) {
        case 'BC': r = 0; break;
        case 'DE': r = 1; break;
        case 'HL': r = 2; break;
        case 'AF': r = 3; break;
        default: break;
    }
    return r;
}

function get8bitRegId(name) {
    var r = null;
    switch(name) {
        case 'B': r = 0; break;
        case 'C': r = 1; break;
        case 'D': r = 2; break;
        case 'E': r = 3; break;
        case 'H': r = 4; break;
        case 'L': r = 5; break;
        case 'A': r = 7; break;
        default: break;
    }
    return r;
}

function match_token(toks, pattern) {
    if(toks.length != pattern.length) {
        return false;
    }
    for (var i = 0; i < toks.length; i++) {
        if(pattern[i] != null) {
            if(typeof(pattern[i]) == 'string') {
                if(toks[i] != pattern[i]) {
                    return false;
                }
            } else if(typeof(pattern[i]) == 'object') {
                if(pattern[i].constructor.name == 'RegExp') {
                    if(!pattern[i].test(toks[i])) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}

Z80LineAssembler.parseNumLiteral = function(tok) {
    var n = Z80LineAssembler._parseNumLiteral(tok);
    if(typeof(n) == 'number') {
        if(n < -128 || 256 <= n) {
            throw 'operand ' + tok + ' out of range';
        }
        return n & 0xff;
    }
    return function(dictionary) {
        return Z80LineAssembler.dereferLowByte(tok, dictionary);
    };
};

Z80LineAssembler.parseNumLiteralPair = function(tok) {
    var n = Z80LineAssembler._parseNumLiteral(tok);
    if(typeof(n) == 'number') {
        if(n < -32768 || 65535 < n) {
            throw 'operand ' + tok + ' out of range';
        }
        return [n & 0xff, (n >> 8) & 0xff];
    }
    return [
        function(dictionary){ return Z80LineAssembler.dereferLowByte(tok, dictionary); },
        function(dictionary){ return Z80LineAssembler.dereferHighByte(tok, dictionary); }
    ];
};

Z80LineAssembler.parseRelAddr = function(tok, fromAddr) {
    var n = Z80LineAssembler._parseNumLiteral(tok);
    if(typeof(n) == 'number') {
        var c0 = tok.charAt(0);
        if(c0 != '+' && c0 != '-') {
            n = n - fromAddr + 2;
        }
        n -= 2;
        if(n < -128 || 256 <= n) {
            throw 'operand ' + tok + ' out of range';
        }
        return n & 0xff;
    }
    return function(dictionary) {
        return (Z80LineAssembler.derefer(tok, dictionary) - fromAddr) & 0xff;
    };
};

Z80LineAssembler.dereferLowByte = function(label, dictionary) {
    return Z80LineAssembler.derefer(label, dictionary) & 0xff;
};

Z80LineAssembler.dereferHighByte = function(label, dictionary) {
    return (Z80LineAssembler.derefer(label, dictionary) >> 8) & 0xff;
};

Z80LineAssembler.derefer = function(label, dictionary) {
    if(label in dictionary) {
        return dictionary[label];
    }
    return 0;
};

Z80LineAssembler._parseNumLiteral = function(tok) {
    if(/^[\+\-]?[0-9]+$/.test(tok) || /^[\+\-]?[0-9A-F]+H$/i.test(tok)) {
        var matches;
        var n = 0;
        var s = (/^\-/.test(tok) ? -1:1);
        if(/[hH]$/.test(tok)) {
            matches = tok.match(/^[\+\-]?([0-9a-fA-F]+)[hH]$/);
            n = parseInt(matches[1], 16);
        } else if(/^[\+\-]?0/.test(tok)) {
            matches = tok.match(/^[\+\-]?([0-7]+)$/);
            n = parseInt(matches[1], 8);
        } else {
            matches = tok.match(/^[\+\-]?([0-9]+)$/);
            n = parseInt(matches[1], 10);
        }
        return s * n;
    }
    return tok;
};

module.exports = Z80LineAssembler;

},{"../lib/oct":35}],19:[function(require,module,exports){
/*!
 * jQuery JavaScript Library v3.2.1
 * https://jquery.com/
 *
 * Includes Sizzle.js
 * https://sizzlejs.com/
 *
 * Copyright JS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2017-03-20T18:59Z
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
	version = "3.2.1",

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
					( copyIsArray = Array.isArray( copy ) ) ) ) {

					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && Array.isArray( src ) ? src : [];

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



function nodeName( elem, name ) {

  return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();

};
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
        if ( nodeName( elem, "iframe" ) ) {
            return elem.contentDocument;
        }

        // Support: IE 9 - 11 only, iOS 7 only, Android Browser <=4.3 only
        // Treat the template element as a regular one in browsers that
        // don't support it.
        if ( nodeName( elem, "template" ) ) {
            elem = elem.content || elem;
        }

        return jQuery.merge( [], elem.childNodes );
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
			locked = locked || options.once;

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

function adoptValue( value, resolve, reject, noValue ) {
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

			// Control `resolve` arguments by letting Array#slice cast boolean `noValue` to integer:
			// * false: [ value ].slice( 0 ) => resolve( value )
			// * true: [ value ].slice( 1 ) => resolve()
			resolve.apply( undefined, [ value ].slice( noValue ) );
		}

	// For Promises/A+, convert exceptions into rejections
	// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
	// Deferred#then to conditionally suppress rejection.
	} catch ( value ) {

		// Support: Android 4.0 only
		// Strict mode functions invoked without .call/.apply get global-object context
		reject.apply( undefined, [ value ] );
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
			adoptValue( singleValue, master.done( updateFunc( i ) ).resolve, master.reject,
				!remaining );

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
			if ( Array.isArray( key ) ) {

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
				if ( !queue || Array.isArray( data ) ) {
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

	if ( tag === undefined || tag && nodeName( context, tag ) ) {
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
				if ( this.type === "checkbox" && this.click && nodeName( this, "input" ) ) {
					this.click();
					return false;
				}
			},

			// For cross-browser consistency, don't fire native .click() on links
			_default: function( event ) {
				return nodeName( event.target, "a" );
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

// Prefer a tbody over its parent table for containing new rows
function manipulationTarget( elem, content ) {
	if ( nodeName( elem, "table" ) &&
		nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

		return jQuery( ">tbody", elem )[ 0 ] || elem;
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

		// Support: Firefox 51+
		// Retrieving style before computed somehow
		// fixes an issue with getting wrong values
		// on detached elements
		style = elem.style;

	computed = computed || getStyles( elem );

	// getPropertyValue is needed for:
	//   .css('filter') (IE 9 only, #12537)
	//   .css('--customProperty) (#3144)
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
	rcustomProp = /^--/,
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

// Return a property mapped along what jQuery.cssProps suggests or to
// a vendor prefixed property.
function finalPropName( name ) {
	var ret = jQuery.cssProps[ name ];
	if ( !ret ) {
		ret = jQuery.cssProps[ name ] = vendorPropName( name ) || name;
	}
	return ret;
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

	// Start with computed style
	var valueIsBorderBox,
		styles = getStyles( elem ),
		val = curCSS( elem, name, styles ),
		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

	// Computed unit is not pixels. Stop here and return.
	if ( rnumnonpx.test( val ) ) {
		return val;
	}

	// Check for style in case a browser which returns unreliable values
	// for getComputedStyle silently falls back to the reliable elem.style
	valueIsBorderBox = isBorderBox &&
		( support.boxSizingReliable() || val === elem.style[ name ] );

	// Fall back to offsetWidth/Height when value is "auto"
	// This happens for inline elements with no explicit setting (gh-3571)
	if ( val === "auto" ) {
		val = elem[ "offset" + name[ 0 ].toUpperCase() + name.slice( 1 ) ];
	}

	// Normalize "", auto, and prepare for extra
	val = parseFloat( val ) || 0;

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
			isCustomProp = rcustomProp.test( name ),
			style = elem.style;

		// Make sure that we're working with the right name. We don't
		// want to query the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

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

				if ( isCustomProp ) {
					style.setProperty( name, value );
				} else {
					style[ name ] = value;
				}
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
			origName = jQuery.camelCase( name ),
			isCustomProp = rcustomProp.test( name );

		// Make sure that we're working with the right name. We don't
		// want to modify the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

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

			if ( Array.isArray( name ) ) {
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
	fxNow, inProgress,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rrun = /queueHooks$/;

function schedule() {
	if ( inProgress ) {
		if ( document.hidden === false && window.requestAnimationFrame ) {
			window.requestAnimationFrame( schedule );
		} else {
			window.setTimeout( schedule, jQuery.fx.interval );
		}

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
		if ( Array.isArray( value ) ) {
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

			// If there's more to do, yield
			if ( percent < 1 && length ) {
				return remaining;
			}

			// If this was an empty animation, synthesize a final progress notification
			if ( !length ) {
				deferred.notifyWith( elem, [ animation, 1, 0 ] );
			}

			// Resolve the animation and report its conclusion
			deferred.resolveWith( elem, [ animation ] );
			return false;
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

	// Attach callbacks from options
	animation
		.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		} )
	);

	return animation;
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

	// Go to the end state if fx are off
	if ( jQuery.fx.off ) {
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

		// Run the timer and safely remove it when done (allowing for external removal)
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
	jQuery.fx.start();
};

jQuery.fx.interval = 13;
jQuery.fx.start = function() {
	if ( inProgress ) {
		return;
	}

	inProgress = true;
	schedule();
};

jQuery.fx.stop = function() {
	inProgress = null;
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
					nodeName( elem, "input" ) ) {
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

			} else if ( Array.isArray( val ) ) {
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
								!nodeName( option.parentNode, "optgroup" ) ) ) {

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
			if ( Array.isArray( value ) ) {
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

	if ( Array.isArray( obj ) ) {

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
	if ( Array.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

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

			if ( Array.isArray( val ) ) {
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

		var doc, docElem, rect, win,
			elem = this[ 0 ];

		if ( !elem ) {
			return;
		}

		// Return zeros for disconnected and hidden (display: none) elements (gh-2310)
		// Support: IE <=11 only
		// Running getBoundingClientRect on a
		// disconnected node in IE throws an error
		if ( !elem.getClientRects().length ) {
			return { top: 0, left: 0 };
		}

		rect = elem.getBoundingClientRect();

		doc = elem.ownerDocument;
		docElem = doc.documentElement;
		win = doc.defaultView;

		return {
			top: rect.top + win.pageYOffset - docElem.clientTop,
			left: rect.left + win.pageXOffset - docElem.clientLeft
		};
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
			if ( !nodeName( offsetParent[ 0 ], "html" ) ) {
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

			// Coalesce documents and windows
			var win;
			if ( jQuery.isWindow( elem ) ) {
				win = elem;
			} else if ( elem.nodeType === 9 ) {
				win = elem.defaultView;
			}

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

jQuery.holdReady = function( hold ) {
	if ( hold ) {
		jQuery.readyWait++;
	} else {
		jQuery.ready( true );
	}
};
jQuery.isArray = Array.isArray;
jQuery.parseJSON = JSON.parse;
jQuery.nodeName = nodeName;




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

},{}],20:[function(require,module,exports){
(function (global){
/* global mz700scrn */
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
        this.screen = null;
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
        if("mz700scrn" in global)
        return mz700scrn.CGROMDATA[code][row];
    };

    PCG700.prototype.readMMIO = function(/* addr, value */) {}

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
        if(this.screen == null) {
            return;
        }
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
        if(this.ssw == 0 && this.screen != null) {
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],21:[function(require,module,exports){
(function(global) {
    var context = null;
    if("context" in global) {
        context = global["context"];
    } else {
        context = {
            webMain : false,
            webWorker: false,
            nodeJs: false,
            ie11: false,
            requirable: false
        };
        try {
            if(require) {
                context.requirable = true;
            }
        } catch(ex) { /* empty */ }
    }
    var globalContextName = global.constructor.name;
    if(!globalContextName) {
        context.ie11 = true;
        if(global == "[object Window]") {
            context.webMain = true;
        } else if(global == "[object WorkerGlobalScope]") {
            context.webWorker = true;
        }
    } else {
        if("window" in global) {
            context.webMain = true;
        } else if(
            (globalContextName == "DedicatedWorkerGlobalScope")
         || (globalContextName == "WorkerGlobalScope"))
        {
            context.webWorker = true;
        } else {
            context.nodeJs = true;
        }
    }
    //console.log(JSON.stringify(context, null, "    "));
    if(context.nodeJs) {
        module.exports = context;
    } else {
        if(context.webWorker) {
            global.module = { exports: null };
            global.require = function(/*module*/) {
                //console.log("Stub require(" + module + ") called from WebWorder context");
            };
        }
    }
    context.exportModule = function(name, obj) {
        if(!context.requirable) {
            if(name in global && obj !== global[name]) {
                console.log(
                    "context.exports: " + name +
                    " is already exported.");
                console.log(
                    "predecessor: " +
                    JSON.stringify(global[name]));
                console.log(
                    "override with: " +
                    JSON.stringify(obj));
            }
            global[name] = obj;
        }
        return obj;
    };
    global.getModule = function (name) {
        if(!("context" in global) || context.nodeJs || context.requirable) {
            return false;
        }
        if(!(name in global) || !global[name]) {
            throw new Error(["module ", name, "not found"].join(" "));
        }
        return global[name];
    }
    global.context = context;
}(Function("return this;")()));

},{}],22:[function(require,module,exports){
(function() {
/**
 * 桁数指定の四捨五入。
 * Math.roundの代わり。
 * @param {number} n 四捨五入する桁を指定する。0なら結果は整数。10の位を四捨五入するなら2。
 * 小数部での四捨五入は負の値を指定する。結果の小数点以下を2桁にしたいなら-2。
 * @returns {number} 四捨五入された結果
 */
Number.prototype.round = function(n) {
	if(n == undefined) { n = 0; }
	var pow = Math.pow(10, -n);
	return Math.round(this * pow) / pow;
}
Number.prototype.bin = function(columns) {
	var s = "";
	var n = this;
	while(n > 0) {
		var mod = n % 2;
		var h = "";
		if(mod) {
			h = "1";
		} else {
			h = "0";
		}
		s = h + s;
		n = Math.floor(n / 2);
	}
	if(columns) {
		s = (new Array(columns+1).join("0")) + s;
		s = s.substring(s.length - columns);
	}
	return s;
}
Number.prototype.hex = function(columns) {
    var s = this.toString(16);
    if(s.length > columns) {
        return s;
    }
    return ((new Array(columns)).join("0") + s).slice(-columns);
};

Number.prototype.HEX = function(columns) {
    var s = this.toString(16).toUpperCase();
    if(s.length > columns) {
        return s;
    }
    return ((new Array(columns)).join("0") + s).slice(-columns);
};
Number.prototype.BIN = function(columns) {
    var s = this.toString(2).toUpperCase();
    if(s.length > columns) {
        return s;
    }
    return ((new Array(columns)).join("0") + s).slice(-columns);
};

//  function number_format (number, decimals, dec_point, thousands_sep) {
//      // http://kevin.vanzonneveld.net
//      // +   original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
//      // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
//      // +     bugfix by: Michael White (http://getsprink.com)
//      // +     bugfix by: Benjamin Lupton
//      // +     bugfix by: Allan Jensen (http://www.winternet.no)
//      // +    revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
//      // +     bugfix by: Howard Yeend
//      // +    revised by: Luke Smith (http://lucassmith.name)
//      // +     bugfix by: Diogo Resende
//      // +     bugfix by: Rival
//      // +      input by: Kheang Hok Chin (http://www.distantia.ca/)
//      // +   improved by: davook
//      // +   improved by: Brett Zamir (http://brett-zamir.me)
//      // +      input by: Jay Klehr
//      // +   improved by: Brett Zamir (http://brett-zamir.me)
//      // +      input by: Amir Habibi (http://www.residence-mixte.com/)
//      // +     bugfix by: Brett Zamir (http://brett-zamir.me)
//      // +   improved by: Theriault
//      // +      input by: Amirouche
//      // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
//      // *     example 1: number_format(1234.56);
//      // *     returns 1: '1,235'
//      // *     example 2: number_format(1234.56, 2, ',', ' ');
//      // *     returns 2: '1 234,56'
//      // *     example 3: number_format(1234.5678, 2, '.', '');
//      // *     returns 3: '1234.57'
//      // *     example 4: number_format(67, 2, ',', '.');
//      // *     returns 4: '67,00'
//      // *     example 5: number_format(1000);
//      // *     returns 5: '1,000'
//      // *     example 6: number_format(67.311, 2);
//      // *     returns 6: '67.31'
//      // *     example 7: number_format(1000.55, 1);
//      // *     returns 7: '1,000.6'
//      // *     example 8: number_format(67000, 5, ',', '.');
//      // *     returns 8: '67.000,00000'
//      // *     example 9: number_format(0.9, 0);
//      // *     returns 9: '1'
//      // *    example 10: number_format('1.20', 2);
//      // *    returns 10: '1.20'
//      // *    example 11: number_format('1.20', 4);
//      // *    returns 11: '1.2000'
//      // *    example 12: number_format('1.2000', 3);
//      // *    returns 12: '1.200'
//      // *    example 13: number_format('1 000,50', 2, '.', ' ');
//      // *    returns 13: '100 050.00'
//      // Strip all characters but numerical ones.
//      number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
//      var n = !isFinite(+number) ? 0 : +number,
//          prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
//          sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
//          dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
//          s = '',
//          toFixedFix = function (n, prec) {
//              var k = Math.pow(10, prec);
//              return '' + Math.round(n * k) / k;
//          };
//      // Fix for IE parseFloat(0.55).toFixed(0) = 0;
//      s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
//      if (s[0].length > 3) {
//          s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
//      }
//      if ((s[1] || '').length < prec) {
//          s[1] = s[1] || '';
//          s[1] += new Array(prec - s[1].length + 1).join('0');
//      }
//      return s.join(dec);
//  }
}());

},{}],23:[function(require,module,exports){
(function() {
    "use strict";
    //
    // FlipFlopCounter
    //
    function FlipFlopCounter(freq) {
        this.initialize();
        this.setFrequency(freq);
        this._handlers = {
            change: []
        };
    }

    FlipFlopCounter.SPEED_FACTOR = 1.5;
    FlipFlopCounter.CPU_CLOCK = 4.0 * 1000 * 1000;
    FlipFlopCounter.MNEMONIC_AVE_CYCLE = 6;
    FlipFlopCounter.prototype.initialize = function() {
        this._out = false;
        this._counter = 0;
    };

    FlipFlopCounter.prototype.setFrequency = function(freq) {
        this._counter_max =
            FlipFlopCounter.CPU_CLOCK /
            FlipFlopCounter.MNEMONIC_AVE_CYCLE /
            freq;
    };

    FlipFlopCounter.prototype.readOutput = function() {
        return this._out;
    };

    FlipFlopCounter.prototype.count = function() {
        this._counter += FlipFlopCounter.SPEED_FACTOR;
        if(this._counter >= this._counter_max / 2) {
            this._out = !this._out;
            this._counter = 0;
            this.fireEvent("change");
            return true;
        }
        return false;
    };

    FlipFlopCounter.prototype.addEventListener = function(evt, handler) {
        this._handlers[evt].push(handler);
    };

    FlipFlopCounter.prototype.fireEvent = function(evt) {
        this._handlers[evt].forEach(function(handler) {
            handler();
        });
    };
    module.exports = FlipFlopCounter;
}());

},{}],24:[function(require,module,exports){
(function(){
    "use strict";
    var FlipFlopCounter = require('../lib/flip-flop-counter');
    //
    // IC BJ 556
    //
    function IC556(freq) {
        this._reset = false;
        this.initialize();
        this.setFrequency(freq);
    }

    IC556.prototype = new FlipFlopCounter();

    IC556.prototype.count = function() {
        if(this._reset) {
            return FlipFlopCounter.prototype.count.call(this);
        }
        return false;
    };

    IC556.prototype.loadReset = function(value) {
        if(!value) {
            if(this._reset) {
                this._reset = false;
                this.initialize();
            }
        } else {
            if(!this._reset) {
                this._reset = true;
            }
        }
    };

    module.exports = IC556;
}());

},{"../lib/flip-flop-counter":23}],25:[function(require,module,exports){
(function() {
    "use strict";
    //
    // Intel 8253 Programmable Interval Timer
    //
    function Intel8253() {
        this.counter = [
            new Intel8253Counter("#0"),
            new Intel8253Counter("#1"),
            new Intel8253Counter("#2") ];
    }

    Intel8253.prototype.setCtrlWord = function(ctrlword) {
        var index = (ctrlword & 0xc0) >> 6;
        this.counter[index].setCtrlWord(ctrlword & 0x3f);
    };

    //
    //   8253 MODE CTRL WORD
    //
    //       $E007 Memory Mapped I/O
    //
    //       ---------------------------------
    //       b7  b6  b5  b4  b3  b2  b1  b0
    //       [ SC ]  [ RL ]  [  MODE  ]  [BCD]
    //       ---------------------------------
    //
    //       SC:     0: Select counter 0
    //               1: Select counter 1
    //               2: Select counter 2
    //               3: Illegal
    //
    //       RL:     0: Counter latching operation
    //               1: Read/load LSB only
    //               2: Read/load MSB only
    //               3: Read/load LSB first, then MSB
    //
    //       MODE:   0: Mode 0   Interrupt on terminal count
    //               1: Mode 1   Programmable one shot
    //               2: Mode 2   Rate Generator
    //               3: Mode 3   Square wave rate Generator
    //               4: Mode 4   Software triggered strobe
    //               5: Mode 5   Hardware triggered strobe
    //               6: Mode 2
    //               7: Mode 3
    //
    //       BCD:    0: Binary counter
    //               1: BCD counter
    //
    function Intel8253Counter(name) {
        this._name = name;
        this.RL = 3;
        this.MODE = 3;
        this.BCD = 0;
        this.value = 0xffff;
        this.counter = 0xffff;
        this._written = true;
        this._read = true;
        this.out = true;
        this.gate = false;
        this._handlers = {
            timeup: []
        };
    }

    Intel8253Counter.prototype.setCtrlWord = function(ctrlword) {
        this.RL = (ctrlword & 0x30) >> 4;
        this.MODE = (ctrlword & 0x0e) >> 1;
        this.BCD = ((ctrlword & 0x01) != 0);
        this.value = 0;
        this.counter = 0;
        this._written = true;
        this._read = true;
        this.out = false;
        this.gate = false;
    };

    Intel8253Counter.prototype.load = function(value) {
        this.counter = 0;
        var set_comp = false;
        switch(this.RL) {
            case 0: //Counter latching operation
                break;
            case 1: //Read/load LSB only
                this.value = (value & 0x00ff);
                this.counter = this.value;
                this.out = false;
                set_comp = true;
                break;
            case 2: //Read/load MSB only
                this.value = (value & 0x00ff) << 8;
                this.counter = this.value;
                set_comp = true;
                break;
            case 3: //Read/load LSB first, then MSB
                if(this._written) {
                    this._written = false;
                    this.value = (this.value & 0xff00) | (value & 0x00ff);
                    this.counter = this.value;
                    set_comp = false;
                } else {
                    this._written = true;
                    this.value = (this.value & 0x00ff) | ((value & 0x00ff) << 8);
                    this.counter = this.value;
                    this.out = false;
                    set_comp = true;
                }
                break;
        }
        if(set_comp) {
            switch(this.MODE) {
                case 0:
                    this.out = false;
                    break;
                case 1:
                    break;
                case 2: case 6:
                    this.out = true;
                    break;
                case 3: case 7:
                    this.out = true;
                    break;
                case 4:
                    break;
                case 5:
                    break;
            }
        }
        return set_comp;
    };

    Intel8253Counter.prototype.read = function() {
        switch(this.RL) {
            case 0: //Counter latching operation
                break;
            case 1: //Read/load LSB only
                return (this.counter & 0x00ff);
            case 2: //Read/load MSB only
                return ((this.counter >> 8) & 0x00ff);
            case 3: //Read/load LSB first, then MSB
                if(this._read) {
                    this._read = false;
                    return (this.counter & 0x00ff);
                } else {
                    this._read = true;
                    return ((this.counter >> 8) & 0x00ff);
                }
        }
        return null;
    };

    // TODO: 未使用？
    Intel8253Counter.prototype.setGate = function(gate) {
        this.gate = gate;
    };

    Intel8253Counter.prototype.count = function(count) {
        var prevOut = this.out;
        switch(this.MODE) {
            case 0:
                if(this.counter > 0) {
                    this.counter -= count;
                    if(this.counter <= 0) {
                        this.counter = 0;
                        if(!this.out) {
                            this.out = true;
                        }
                    }
                } else {
                    this.counter = this.value;
                }
                break;
            case 1:
                break;
            case 2: case 6:
                this.counter -= count;
                if(this.out && this.counter <= 0) {
                    this.out = false;
                    this.counter = this.value;
                } else if(!this.out) {
                    this.out = true;
                }
                break;
            case 3: case 7:
                this.counter -= count;
                if(this.counter >= this.value / 2) {
                    this.out = true;
                } else if(this.counter > 0) {
                    this.out = false;
                } else {
                    this.out = true;
                    this.counter = this.value;
                }
                break;
            case 4:
                break;
            case 5:
                break;
        }
        if(!prevOut && this.out) {
            this.fireEvent("timeup");
        }
    };
    Intel8253Counter.prototype.addEventListener = function(evt, handler) {
        this._handlers[evt].push(handler);
    };
    Intel8253Counter.prototype.fireEvent = function(evt) {
        this._handlers[evt].forEach(function(handler) {
            handler();
        });
    };
    module.exports = Intel8253;
}());

},{}],26:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var MZ700KeyMatrix = require("../MZ-700/mz700-key-matrix.js");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("mz700keyboard");
    var mz700keyboard = function(element) {
        this.element = element;
        $(this.element).addClass("mz700keymatrix")
    };
    window.mz700keyboard = mz700keyboard;
    var KeyCodes = MZ700KeyMatrix.KeyCodes;
    var KeyNames = MZ700KeyMatrix.KeyNames;
    mz700keyboard.prototype.create = function(opt) {
        var $container = $("<div/>").addClass("keyboard-base-panel");
        $(this.element).append($container);

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
        MZ700KeyMatrix.Keys.forEach(function(key) {
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
        //return mz700keyboard.code2key[code];
        return MZ700KeyMatrix.Code2Key[code];
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

},{"../MZ-700/mz700-key-matrix.js":9,"../lib/jquery_plugin_class":34,"jquery":19}],27:[function(require,module,exports){
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
    "use strict";

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
            width: '100%',
            alt: null, title: "MZ-700 FULL JAVASCRIPT EMULATOR"
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
        if(this.opt.alt != null) {
            canvas.setAttribute("alt", this.opt.alt);
        }
        if(this.opt.title != null) {
            canvas.setAttribute("title", this.opt.title);
        }

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

        createFontTable(this);
    };

    // Create the font table
    function createFontTable(scrn) {
        scrn.fonts = {};
        for(var atb = 0; atb < 2; atb++) {
            for(var dispCode = 0; dispCode < 256; dispCode++) {
                createFont(scrn, atb, dispCode);
            }
        }
    }

    // Create a font of all color combinations
    //
    // atb      : Attribute Bit     0 or 1
    // dispCode : Display Code      0x00 to 0xff
    //
    function createFont(scrn, atb, dispCode) {
        //Loop for background-color
        for(var bg = 0; bg < 8; bg++) {
            //Loop for fore-ground-color
            for(var fg = 0; fg < 8; fg++) {
                //the value of ATTRIBUTE VRAM
                var attr = (atb << 7)|(fg << 4) | bg;
                //Font table's key
                var code = attr << 8 | dispCode;
                //Drawing (initially creating) routine
                scrn.fonts[code] = getInitDrawFunction(
                            scrn, atb, fg, bg, attr, dispCode, code);
            }
        }
    }

    /**
     * Redraw specified characters on the screen.
     * @param {number} atb attribute bit to select CG page.
     * @param {number} dispCode The display code to redraw.
     * @returns {undefined}
     */
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

    // Change CG to default CGROM
    mz700scrn.prototype.useCGROM = function() {
        this.useCG(mz700scrn.CGROMDATA);
    };

    // Change Character Generator
    mz700scrn.prototype.useCG = function(cgData) {
        this.opt.CG = cgData;
        createFontTable(this);
        this.redraw();
    };

    /**
     * Clear the screen
     * @returns {undefined}
     */
    mz700scrn.prototype.clear = function () {
        var limit = this.opt.rows * this.opt.cols;
        var chars = str2chars(' ');
        for(var relAddr = 0; relAddr < limit; relAddr++) {
            this.putChars(chars, relAddr, 0);
        }
    };

    /**
     * Put string
     * @param {string} s strings to put
     * @param {number} x horizontal starting position
     * @param {number} y vertical starting position
     * @returns {undefined}
     */
    mz700scrn.prototype.puts = function (s, x, y) {
        var chars = str2chars(s);
        return this.putChars(chars, x, y);
    };

    /**
     * Convert the inner text of the HTML element to MZ-700 VRAM
     * @param {HTMLElement} element the element to convert
     * @return {undefined}
     */
    mz700scrn.convert = function(element) {
        var charSize = parseInt($(element).attr("charSize")) || 8;
        var padding = parseInt($(element).attr("padding")) || 0;
        var fg = (7 & parseInt($(element).attr("color") || "7"));
        var bg = (7 & parseInt($(element).attr("bgColor") || "1"));
        var text = element.innerText;
        var chars = str2chars(text);
        $(element).empty().mz700scrn("create", {
            cols: chars.length + padding * 2,
            rows: 1 + padding * 2,
            width: charSize * chars.length + "px",
            color: fg, backgroundColor: bg,
            alt: text, title: text
        }).mz700scrn("clear").mz700scrn("putChars", chars, padding, padding);
        $(element).find("canvas").css("display", "inherit");
    };

    /*
     * Convert the innerText of all the elements "span.mz700scrn"
     */
    $(function() {
        $("span.mz700scrn").each(function() {
            $(this).hide();
        });
        setTimeout(function() {
            $("span.mz700scrn").each(function() {
                mz700scrn.convert(this);
                $(this).show();
            });
        }, 1);
    });

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
    function getInitDrawFunction(scrn, atb, fg, bg, attr, dispCode, code) {
        return function(ctxScrn, x, y) {

            //Create canvas object for the font
            var cvs = document.createElement("CANVAS");
            cvs.setAttribute("width", mz700scrn.charSize.dotWidth + "px");
            cvs.setAttribute("height",mz700scrn.charSize.dotHeight + "px");

            //Save its context
            var ctxFont = cvs.getContext("2d");

            //Draw the bit patterns
            var rowData = scrn.opt.CG[atb * 256 + dispCode];
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
            scrn.fonts[code] = (function(ctxFont) {
                return function(ctxScrn, x,y) {
                    ctxScrn.putImageData(
                            ctxFont.getImageData(0, 0,
                                mz700scrn.charSize.dotWidth,
                                mz700scrn.charSize.dotHeight), x, y);
                };
            }(ctxFont));

            //Draw this character
            scrn.fonts[code](ctxScrn, x, y);

        }
    }

    var TableDispCode2Char = [
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

    /*
     * Create a dictionary to retrieve the display code of MZ-700
     * by one normal character or string of entity reference.
     */
    var MapChar2DispCode = (function(map) {
        TableDispCode2Char.forEach(function(table, attr) {
            table.forEach(function(line, upper) {
                line.forEach(function(c, lower) {
                    if(!(c in map)) {
                        map[c] = {
                            "attr": attr,
                            "dispcode" : upper << 4 | lower
                        };
                    }
                });
            });
        });
        return map;
    }({}));

    function char2dispcode(c) {
        var charData = MapChar2DispCode[c];
        if(!charData) {
            charData = {attr:0, dispcode : 0xef };
        }
        return charData;
    }

    function str2chars(s) {
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
    }

    mz700scrn.prototype.putChars = function(chars, x, y) {
        var limit = this.opt.rows * this.opt.cols;
        var dispData = {};
        var n = 0;
        var relAddr = y * this.opt.cols + x;
        var colorSpec = this.opt.color << 4 | this.opt.backgroundColor;
        chars.forEach(function(c) {
            if(relAddr < limit) {
                var data = char2dispcode(c);
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

}());

},{"../lib/jquery_plugin_class":34,"jquery":19}],28:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    var Z80_assemble = require("../Z80/assembler.js");
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
            $col = $("<span/>")
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
            $row = $("<div/>")
                .addClass("row").addClass("r" + row)
                .css('height', this.opt.rowHeight)
                .css('line-height', this.opt.rowHeight);
            $container.append($row);

            $col = $("<span/>")
                .addClass("cell").addClass("header")
                .css('display','inline-block')
                .css('width', this.opt.headerWidth)
                .css('text-align', "center");

            $row.append($col);
            this.addrCols.push($col);
            for(col = 0; col < 16; col++) {
                if(this.readMemory == null) {
                    $col = $("<span/>")
                        .addClass("cell").addClass("c" + col)
                        .css('display','inline-block')
                        .css('width', this.opt.colWidth)
                        .css('text-align', "center");
                    this.dataCells.push($col);
                    $row.append($col);
                } else {
                    this.readMemory(addr, (function(THIS, row, col) {
                        return function() {
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

    dumplist.prototype.redraw = function() {
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

},{"../Z80/assembler.js":11,"../lib/jquery_plugin_class":34,"jquery":19}],29:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("Z80RegView");
    var Z80RegView = function(element) {
        this.element = element;
    };
    window.Z80RegView = Z80RegView;
    Z80RegView.prototype.init = function() {
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

},{"../lib/jquery_plugin_class":34,"jquery":19}],30:[function(require,module,exports){
(function() {
    "use strict";
    var $ = require("jquery");
    require("./jquery.tabview.js");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("asmlist");

    /**
     * asmlist jquery plug-in.
     * @constructor
     * @param {Element} element The DOM element
     */
    var asmlist = function(element) {
        this._root = $(element);
        this._asmList = this._root.find(".assemble_list");
        this._opts = ("opts" in element ? element.opts : {
            assemble: function() { },
            breakpoint: function(/*addr, size, state*/) { }
        });
    };

    // Export to Window
    window.asmlist = asmlist;

    /**
     * Create plug-in object.
     * @param {object} opts The options for this instance.
     * @returns {undefined}
     */
    asmlist.prototype.create = function(opts) {
        if(!this._root.hasClass("asmlist")) {
            Object.keys(this._opts).forEach(function(key) {
                if(key in opts) {
                    this._opts[key] = opts[key];
                }
            }, this);
            this._asmList = $("<div/>").addClass("assemble_list");
            this._root.addClass("asmlist").tabview("create")
                .tabview("add", "Assemble List",
                    $("<div/>").addClass("tabAsmList")
                        .append($("<div/>").addClass("y-scroll-pane")
                        .append(this._asmList))
                        .append("<span>* Click a line, and set break point</span>"),
                    function() {
                        if(this._asmList.children().length == 0) {
                            this._opts.assemble(this.text());
                        }
                    }.bind(this))
                .tabview("add", "Source List",
                    $("<div/>").addClass("tabSource")
                        .append($("<textarea type='text'/>")
                            .bind("change", function() {
                                this._asmList.empty();
                            }.bind(this))));
        }
    };

    /**
     * Set assembly source text to textarea.
     *
     * @param {string} text (optional) The assembly source.
     * @param {boolean} assemble (optional) Assemble the source or not.
     * @returns {undefined|string} Returns text if the text parameter is not specified.
     */
    asmlist.prototype.text = function(text, assemble) {
        if(text == null) {
            return this._root.find("textarea").val();
        }
        this._root.find("textarea").val(text);
        if(assemble == null || assemble) {
            this._asmList.empty();
            this._opts.assemble(text);
        }
    };

    /**
     * Get assemmbled list jquery object containing all rows.
     * @returns {jQueryObject} Assembled list
     */
    asmlist.prototype.list = function() {
        return this._asmList;
    };

    /**
     * Write assembled list
     * @param {object[]} asm_list An array of assembled row object.
     * @param {object} breakpoints The breakpoint object mapping breakpoint status by address.
     * @returns {undefined}
     */
    asmlist.prototype.writeList = function(asm_list, breakpoints) {
        this._asmList.empty();
        asm_list.forEach(function(asm_line, index) {
            var addr = asm_line.address;
            var size = asm_line.bytecode.length;
            var $row = this.createAsmRow(asm_line, index + 1);
            $row.addClass("pc" + addr.HEX(4));

            if(size > 0) {
                $row.click(function() {
                    var row = $(".pc" + addr.HEX(4));
                    if(row.hasClass('breakPoint')) {
                        row.removeClass('breakPoint');
                        this._opts.breakpoint(addr, size, false);
                    } else {
                        row.addClass('breakPoint');
                        this._opts.breakpoint(addr, size, true);
                    }
                }.bind(this));
            }

            // Set breakpoint class
            if(breakpoints[addr] && asm_line.bytecode.length > 0) {
                $row.addClass('breakPoint');
            }

            this._asmList.append($row);
        }, this);
    };

    /**
     * Create assembled row
     * @param {jqueryObject} $row The row.
     * @param {object} asm_line An Assembled line object.
     * @param {number} rownum A row number.
     * @returns {undefined}
     */
    asmlist.prototype.createAsmRow = function(asm_line, rownum) {

        var $row = $("<div/>").addClass('row');
        var addr = asm_line.address;

        // attributes column
        $row.append($('<span class="colRowAttr"></span>'));

        // line number
        $row.append($('<span class="colLineNumber">' + rownum + '</span>'));

        // address
        $row.append($('<span class="colAddress" style="">' + addr.HEX(4) + '</span>'));

        // code
        $row.append($('<span class="colMachineCode">' + asm_line.bytecode.map(
                    function(c){return c.HEX(2);}).join("") + '</span>'));

        // label
        if(asm_line.label != null) {
            $row.append($('<span class="colLabel"/>')
                    .html(asm_line.label+':'));
        }

        // mnemonic
        if(asm_line.mnemonic != null) {
            if(asm_line.label == null) {
                $row.append($('<span class="colLabel"> </span>'));
            }
            $row.append($('<span class="colMnemonic"/>').html(asm_line.mnemonic));
            $row.append($('<span class="colOperand"/>').html(asm_line.operand));
        }
        // comment
        $row.append($('<span class="colComment"/>')
                    .html((asm_line.comment == null ? ' ' : asm_line.comment)));

        return $row;
    };

    /**
     * Set current program counter address and
     * show that line to the center of list with a style.
     * @param {number} addr The address to show center.
     * @returns {undefined}
     */
    asmlist.prototype.setCurrentAddr = function(addr) {
        var $target = this._asmList.children('.pc' + addr.HEX(4));
        if($target.length <= 0) {
            return;
        }
        var $base = this._asmList;
        var $scrl_wnd = $base.parent();
        var wnd_height = parseInt($scrl_wnd.css("height"));
        var wnd_scrl = $scrl_wnd.scrollTop();
        var scrl_to = $target.offset().top - $base.offset().top;
        if(scrl_to < wnd_scrl + 0.1 * wnd_height
                  || wnd_scrl + 0.9 * wnd_height < scrl_to)
        {
            $scrl_wnd.animate({
                scrollTop : scrl_to - 0.2 * wnd_height
            }, 'fast');
        }
        $target.addClass("current");
    };

    /**
     * Clear the current program counter line style.
     * @returns {undefined}
     */
    asmlist.prototype.clearCurrentAddr = function() {
        this._asmList.find(".current").removeClass("current");
    };

    module.exports = asmlist;
}());

},{"../lib/jquery_plugin_class":34,"./jquery.tabview.js":33,"jquery":19}],31:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    var plugin_name = "DropDownPanel";
    jquery_plugin_class(plugin_name);
    var DropDownPanel = function(e) {
        this.opt = {
            "caption" : null,
            "onOpen" : function() {},
            "onClose" : function() {}
        };
        if($(e).hasClass(plugin_name)) {
            this.root = $(e);
            this.heading = this.root.find(".heading");
            this.content = this.root.find(".content");
        } else {
            this.root = $("<div/>").insertBefore($(e));
            if(!$(e).hasClass("close") && !$(e).hasClass("open")) {
                this.root.addClass("close");
            } else if($(e).hasClass("close")) {
                this.root.addClass("close");
            } else if($(e).hasClass("open")) {
                this.root.addClass("open");
            }
            this.heading = $("<div/>").addClass("heading");
            this.content = $("<div/>").addClass("content");
            this.root
                .append(this.heading)
                .append(this.content);
            $(e).appendTo(this.content);
        }
        this.root.addClass(plugin_name);
    };
    window.DropDownPanel = DropDownPanel;

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
            this._close();
        } else {
            this._open();
        }
        if(this.opt.caption) {
            this.heading.html(this.opt.caption);
        }
        var caption = $("<span/>").addClass("caption").html(this.heading.html());
        this.heading.empty().append(caption)
            .append($("<span/>").addClass("button").html("▼")
                .click(function() {
                    if(this.root.hasClass("close")) {
                        this._open();
                    } else {
                        this._close();
                    }
                }.bind(this)));
    };
    DropDownPanel.prototype.open = function() {
        if(!this.root.hasClass("open")) {
            this._open();
        }
    };
    DropDownPanel.prototype.close = function() {
        if(!this.root.hasClass("close")) {
            this._close();
        }
    };
    DropDownPanel.prototype._open = function() {
        this.root.addClass("open");
        this.root.removeClass("close");
        this.opt.onOpen.call(this);
        this.root.find(".content").show(100);
    };
    DropDownPanel.prototype._close = function() {
        this.root.removeClass("open");
        this.root.addClass("close");
        this.opt.onClose.call(this);
        this.root.find(".content").hide(100);
    };
}());

},{"../lib/jquery_plugin_class":34,"jquery":19}],32:[function(require,module,exports){
(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("soundctrl");
    var soundctrl = function(element) {
        this.element = element;
        $(this.element).addClass("soundctrl");
        this.opt = {
            "onChangeVolume": function(/*volume*/) {},
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

},{"../lib/jquery_plugin_class":34,"jquery":19}],33:[function(require,module,exports){
(function() {
    "use strict";
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("tabview");

    /**
     * jquery plug-in tabview.
     * @constructor
     * @param {Element} element DOM element to be a tab control.
     */
    var tabview = function(element) {
        this._root = $(element);
        this._tabs = this._root.children(".tabs");
        this._container = this._root.find("tabPageContainer");
        this._currentPage = null;
        this._root._data = {};
        this._root._lastTabId = 0;
    };

    // Export to Window
    window.tabview = tabview;

    /**
     * create tabview's DOM.
     * @returns {undefined}
     */
    tabview.prototype.create = function() {
        if(this._container.length === 0) {
            this._tabs = $("<div/>").addClass("tabs");
            this._container = $("<div/>").addClass("tabPageContainer clearfix");
            this._root.addClass("tabview");
            this._root.append(this._tabs).append(this._container);
        }
    };

    /**
     * Add tab page.
     * @param {string} caption A caption for the tab.
     * @param {jQueryElement} page A tab-page content.
     * @param {Function} callback A callback to be invoked before the tab-page is shown.
     * @returns {undefined}
     */
    tabview.prototype.add = function(caption, page, callback) {
        this._root._lastTabId++;
        var tabId = this._root._lastTabId;
        var tab = $("<button type='button'/>").click(function() {
            this._tabs.children("button.tab").removeClass("selected");
            tab.addClass("selected");
            this._container.children().hide();
            if(callback) {
                callback();
            }
            page.show();
        }.bind(this)).html(caption);
        tab.addClass("tab").addClass("tabId" + tabId);
        page.addClass("tabId" + tabId);

        this._tabs.append(tab);
        this._container.append(page);
        if(this._currentPage == null) {
            this.show(0);
        } else {
            page.hide();
        }
    };

    /**
     * Show specified tab page.
     * @param {number|string} index the page index number or jquery selector for the page.
     * @returns {undefined}
     */
    tabview.prototype.show = function(index) {
        var tabPage = null;
        if(typeof(index) == "number") {
            tabPage = $(this._container.children()[index]);
        } else if(typeof(index) == "string") {
            tabPage = this._container.children(index);
        }
        this._tabs.children("button.tab").removeClass("selected");
        if(tabPage != null) {
            if(tabPage.length >= 1) {
                this._container.children().hide();
                this._currentPage = tabPage.get(0);
                tabPage.show();

                for(var i = 0; i < this._currentPage.classList.length; i++) {
                    var className = this._currentPage.classList[i];
                    if(className.match(/^tabId[0-9]+$/)) {
                        this._tabs.children("button." + className).addClass("selected");
                        break;
                    }
                }
            }
        }
    };

    /**
     * Set or get the current page index.
     * @param {undefined|number} index The page index to show.
     * @return {number|undefined} Current page index.
     */
    tabview.prototype.index = function(index) {
        if(index == null) {
            index = -1;
            var currentPage = this._currentPage;
            if(currentPage != null) {
                var i = 0;
                this._container.children().each(function() {
                    if(this === currentPage) {
                        index = i;
                        return false;
                    }
                    i++;
                });
            }
            return index;
        } else {
            this.show(index);
        }
    };

    /**
     * Get the current page.
     * @return {number|undefined} Current page index.
     */
    tabview.prototype.currentPage = function() {
        return $(this._currentPage);
    };

    /**
     * Set or get the user data.
     * @param {string} name data name
     * @param {any|null} value user data
     * @returns {undefined|any} if the value is null, returns the user data.
     *      Otherwise undefined.
     */
    tabview.prototype.data = function(name, value) {
        if(value == null) {
            return this._root._data[name];
        } else {
            this._root._data[name] = value;
        }
    };

    /**
     * Set caption to the tab page.
     * @param {string} index The selector of jquery to a select tab page.
     * @param {string} caption (optional) New caption for the tab page.
     * @returns {undefined|string} Returns the caption if the captio parameter is not specified.
     */
    tabview.prototype.caption = function(index, caption) {
        if(caption == null) {
            return this._tabs.children(index).html();
        }
        this._tabs.children(index).html(caption);
    };

    module.exports = tabview;
}());

},{"../lib/jquery_plugin_class":34,"jquery":19}],34:[function(require,module,exports){
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

},{"jquery":19}],35:[function(require,module,exports){
"use strict";
function oct(s) {
    return parseInt(s, 8);
}
module.exports = oct;

},{}],36:[function(require,module,exports){
(function() {
    "use strict";
    function FractionalTimer() {
        this._numOfTimer = 1;
        this._delay = 1;
        this._iteration = 1;
        this._func = null;
        this._timerIds = null;

        this._calcFreq = null;
        this._tickStart = (new Date()).getTime();
        this._count = 0;
        this._tickEnd = (new Date()).getTime();
    }
    FractionalTimer.prototype.setNumOfTimer = function(value) {
        this.updateTimer(function() {
            this._numOfTimer = value;
        });
    };
    FractionalTimer.prototype.setTimerInterval = function(value) {
        this.updateTimer(function() { this._delay = value; } );
    };
    FractionalTimer.prototype.setProcCount = function(value) {
        this.updateTimer(function() { this._iteration = value; } );
    };
    FractionalTimer.prototype.setProc = function(func) {
        this.updateTimer(function() { this._func = func; } );
    };
    FractionalTimer.prototype.isRunning = function() {
        return this._timerIds != null;
    };
    FractionalTimer.prototype.start = function() {
        if(this.isRunning()) {
            return;
        }
        this._timerIds = [];
        this._tickStart = (new Date()).getTime();
        this._count = 0;
        this._tickEnd = (new Date()).getTime();
        for(var i = 0; i < this._numOfTimer; i++) {
            this._timerIds.push(setInterval(function(){
                if(this._timerIds == null) {
                    return;
                }
                for(var ii = 0; ii < this._iteration; ii++) {
                    if(this._timerIds != null) {
                        this._count++;
                        this._func();
                    }
                }
            }.bind(this), this._delay));
        }
    };
    FractionalTimer.prototype.stop = function() {
        if(!this.isRunning()) {
            return;
        }
        this._tickEnd = (new Date()).getTime();
        this._timerIds.forEach(function(tid) { clearInterval(tid); } );
        this._timerIds = null;
    };
    FractionalTimer.prototype.getElapse = function() {
        return this._tickEnd - this._tickStart;
    };
    FractionalTimer.prototype.getCalculatedFreq = function() {
        return this._calcFreq;
    };
    FractionalTimer.prototype.getActualFreq = function() {
        var elapse = this.getElapse();
        if(elapse == 0) {
            return null;
        }
        return this._count / (elapse / 1000);
    };
    FractionalTimer.prototype.getStat = function () {
        var calcFreq = this.getCalculatedFreq();
        var elapse = this.getElapse();
        var actualFreq = this.getActualFreq();
        return {
            parameter: {
                numOfTimer: this._numOfTimer,
                interval: this._delay,
                iteration: this._iteration,
                calcFreq: calcFreq
            },
            result: {
                elapse: elapse,
                actualFreq: actualFreq,
                actParCalc: actualFreq / calcFreq
            }
        };
    };
    FractionalTimer.prototype.updateTimer = function(modifier) {
        var timer_was_running = this.isRunning();
        if(timer_was_running) {
            this.stop();
        }
        modifier.call(this);
        if(this._delay != 0) {
            this._calcFreq = this._iteration * (1000 / this._delay) * this._numOfTimer;
        } else {
            this._calcFreq = null;
        }
        if(timer_was_running) {
            this.start();
        }
    };
    FractionalTimer.setInterval = function(proc, interval, numOfTimer, iteration) {
        numOfTimer = numOfTimer || 0;
        iteration = iteration || 0;
        if(numOfTimer == 0 && iteration == 0) {
            var freq = 1.0 / interval;
            while((interval * ++numOfTimer) < 20) {
                ;
            }
            interval = Math.round(interval * numOfTimer);

            while((numOfTimer / ++iteration) > 500) {
                ;
            }
            numOfTimer = Math.round(numOfTimer / iteration);
        }
        var ftid = new FractionalTimer();
        ftid.setProc(proc);
        ftid.setNumOfTimer(numOfTimer);
        ftid.setTimerInterval(interval);
        ftid.setProcCount(iteration);
        ftid.start();
        return ftid;
    };
    FractionalTimer.clearInterval = function(ftid) {
        ftid.stop();
    };
    try {
        module.exports = {
            setInterval: FractionalTimer.setInterval,
            clearInterval: FractionalTimer.clearInterval
        };
    } catch(err) {
        // For the Web browser, Export the class to global object
        (function(g) {
            g.FractionalTimer = FractionalTimer;
        }(Function("return this;")()));
    }
}());

},{}],37:[function(require,module,exports){
//
// TransWorker - Yields the interfaces for the main thread to
// communicate with a class instance running in WebWorker by
// peeping the prototypes.
// 
//
// Copyright (c) 2017 Koji Takami(vzg03566@gmail.com)
// Released under the MIT license
// http://opensource.org/licenses/mit-license.php
//

//
// DESCRIPTION
//
// This class implementation is different for either main
// or sub thread.
//
// The main thread version of this class is loaded from
// html script tag, and it performs as a wrapper for the
// client-class object running in sub thread.
//
// To instantiate in the main thread, this class can be
// used directly.
//
// The constructor receives an url for a Web Worker script
// and a client-class constructor.
//
// In the script, a class derived from this class of a
// sub-thread version must be declared.
//
// It creates the Web Worker object and declare wrapper
// functions dynamically by reading the client-class
// declarations.
//
// The wrapper function translates the method invocation
// with all its parameters to a JSON object, and posts
// to the Web Worker instance created by this class
// instance of sub-thread version.
//
// The return value of the client-class method will be
// returned as a parameter of the callback function that
// is included in parameter of wrapper invocation.
//
(function(globalContext) {
    "use strict";
    var globalContextName = globalContext.constructor.name;
    if(!globalContextName) {
        // Browser is NOT webkit, perhaps IE11
        if(globalContext == "[object Window]") {
            globalContextName = "Window";
        } else if(globalContext == "[object WorkerGlobalScope]") {
            globalContextName = "DedicatedWorkerGlobalScope";
        }
    }
    function TransWorker(){};
    TransWorker.context = globalContextName;
    if(TransWorker.context == 'Window') {
        //
        // Create for UI-thread
        //
        // param:
        //      urlDerivedWorker
        //          url to Worker process.
        //          It must be a sub-class of
        //          worker-side TransWorker.
        //      clientCtor
        //          client-class constructor
        //      thisObject
        //          this object for callback function
        //      notifyHandlers
        //          notify handlers hash:
        //              key: name of notify,
        //              value: function object
        //
        TransWorker.create = function(
                urlDerivedWorker, clientCtor,
                thisObject, notifyHandlers)
        {
            var transworker = new TransWorker();
            transworker.create(
                urlDerivedWorker, clientCtor,
                thisObject, notifyHandlers);
            return transworker;
        };
        TransWorker.prototype.create = function(
                urlDerivedWorker, clientCtor,
                thisObject, notifyHandlers)
        {
            // Load dedicated worker
            this.worker = new Worker(urlDerivedWorker);

            // Create prototype entries same to the client
            this.createWrappers(Object.keys(clientCtor.prototype));

            // Receive message from worker thread
            this.callbacks = {};
            this.queryId = 0;
            this.onNotify = {};
            this.worker.onmessage = (function(wkr) {
                return function(e) {
                    switch(e.data.type) {
                    case 'response':
                        try {
                            wkr.callbacks[e.data.queryId].apply(
                                    thisObject, e.data.param);
                        } catch(ex) {
                            console.warn("*** exception: ", ex,
                                "in method", e.data.method, "params:",
                                JSON.stringify(e.data.param));
                        }
                        delete wkr.callbacks[e.data.queryId];
                        break;
                    case 'notify':
                        try {
                            wkr.onNotify[e.data.name](
                                    e.data.param);
                        } catch(ex) {
                            console.warn("*** exception: ", ex,
                                "in notify", e.data.name, "params:",
                                JSON.stringify(e.data.param));
                        }
                        break;
                    }
                };
            }(this));

            // Entry the handlers to receive notifies
            notifyHandlers = notifyHandlers || {};
            Object.keys(notifyHandlers).forEach(function (key) {
                this.onNotify[key] = function() {
                    notifyHandlers[key].apply(
                            thisObject, arguments);
                };
            }, this);

        };

        // Create wrapper methods to send message to the worker
        TransWorker.prototype.createWrappers = function(
                method_names)
        {
            method_names.forEach(function(m) {
                TransWorker.prototype[m] = this.wrapper(m);
            }, this);
        };

        // Create client method wrapper
        TransWorker.prototype.wrapper = function(
                method)
        {
            return function() {
                var callback = function(){};
                var param = [];
                if(arguments.length > 0) {
                    callback = Array.prototype.slice.call(
                            arguments, -1)[0] || function(){};
                    param = Array.prototype.slice.call(
                            arguments, 0, arguments.length - 1);
                }
                var queryId = this.queryId++;
                this.callbacks[queryId] = callback;
                this.worker.postMessage({
                    method: method,
                    param: param,
                    queryId: queryId });
            };
        };
    } else if( TransWorker.context == 'DedicatedWorkerGlobalScope'
            || TransWorker.context == 'WorkerGlobalScope')
    {
        TransWorker.create = function(client) {
            var transworker = new TransWorker();
            if(typeof(client) == 'function') {
                client = new client();
            }
            transworker.create(client);
            return transworker;
        };
        //
        // Create Worker side TransWorker instance.
        // (designed to be invoked from sub-class constructor)
        //
        // parameter:
        //      client  client-class instance
        //
        TransWorker.prototype.create = function(client) {
            this.worker = globalContext;
            this.client = client;

            // Make the client to be able to use this module
            this.client._transworker = this;

            (function(wkr) {

                // Override subclas methods by this context
                Object.keys(wkr.constructor.prototype)
                .forEach(function(m) {
                    wkr.client[m] = function() {
                        wkr.constructor.prototype[m].apply(
                            wkr, arguments);
                    };
                });

                // On receive a message, invoke the client
                // method and post back its value.
                wkr.worker.onmessage = function(e) {
                    try {
                        //return the value to UI-thread
                        wkr.worker.postMessage({
                            type:'response',
                            queryId: e.data.queryId,
                            method: e.data.method,
                            param: [
                                wkr.client[e.data.method]
                                .apply(
                                    wkr.client,
                                    e.data.param)
                            ]
                        });
                    } catch(ex) {
                        console.warn("*** exception: ", ex,
                            "in method", e.data.method, "params:",
                            JSON.stringify(e.data.param));
                    }
                };
            }(this));
        };

        // Notify to the UI-thread version TransWorker instance
        // from derived class instance.
        TransWorker.prototype.postNotify = function(
                name, param)
        {
            this.worker.postMessage({
                type:'notify',
                name: name,
                param: param
            });
        };
    }
    try {
        module.exports = TransWorker;
    } catch(err) {
        globalContext.TransWorker = TransWorker;
    }
}(Function("return this;")()));

},{}]},{},[2]);
