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

},{"../Z80/assembler.js":9,"../Z80/emulator":11,"../Z80/z80-line-assembler":16,"../lib/ex_number.js":18,"../lib/flip-flop-counter":19,"../lib/ic556":20,"../lib/intel-8253":21,"./memory.js":2,"./mz-data-recorder":4,"./mz-tape":6,"./mz-tape-header":5,"./mz700-key-matrix":7,"fractional-timer":23}],2:[function(require,module,exports){
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

},{"../Z80/memory-bank.js":13,"../Z80/memory-block.js":14,"./monitor-rom.js":3}],3:[function(require,module,exports){
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

},{"../Z80/memory-block.js":14}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
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

},{"./mz-tape-header":5}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
//
// Codes for Worker context.
// Override the methods in Worker context
//
(function(g) {
    "use strict";
    require("../lib/context.js");
    if(!g.context.webWorker) {
        throw new Error("This script must run on WebWorker context.");
    }
    var TransWorker = require('transworker');
    var MZ700 = require('./emulator');
    TransWorker.create(MZ700);
}(Function("return this;")()));

},{"../lib/context.js":17,"./emulator":1,"transworker":24}],9:[function(require,module,exports){
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

},{"./bin-util.js":10,"./z80-line-assembler":16}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
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

},{"../lib/oct":22,"./bin-util.js":10,"./memory-block.js":14,"./register.js":15,"./z80-line-assembler":16}],12:[function(require,module,exports){
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

},{"./bin-util.js":10}],13:[function(require,module,exports){
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

},{"./imem":12}],14:[function(require,module,exports){
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

},{"./imem":12}],15:[function(require,module,exports){
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

},{"./bin-util.js":10}],16:[function(require,module,exports){
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

},{"../lib/oct":22}],17:[function(require,module,exports){
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

},{}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
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

},{"../lib/flip-flop-counter":19}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
"use strict";
function oct(s) {
    return parseInt(s, 8);
}
module.exports = oct;

},{}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
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

},{}]},{},[8]);
