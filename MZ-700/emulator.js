/* global getModule */
require("../lib/ex_number.js");
var FractionalTimer = getModule("FractionalTimer")  || require("fractional-timer");
var MZ_TapeHeader   = getModule("MZ_TapeHeader")    || require('./mz-tape-header');
var MZ_Tape         = getModule("MZ_Tape")          || require('./mz-tape');
var MZ_DataRecorder = getModule("MZ_DataRecorder")  || require('./mz-data-recorder');
var Intel8253       = getModule("Intel8253")        || require('../lib/intel-8253');
var FlipFlopCounter = getModule("FlipFlopCounter")  || require('../lib/flip-flop-counter');
var IC556           = getModule("IC556")            || require('../lib/ic556');
var MZ700KeyMatrix  = getModule("MZ700KeyMatrix")   || require('./mz700-key-matrix');
var MZ700_Memory    = getModule("MZ700_Memory")     || require("./memory.js");
var Z80             = getModule("Z80")              || require('../Z80/emulator');
var Z80_assemble    = getModule("Z80_assemble")     || require("../Z80/assembler.js");
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
    return true;
};

MZ700.prototype.stop = function() {
    if(this.tid != null) {
        FractionalTimer.clearInterval(this.tid);
        this.tid = null;
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
    mztape_array.forEach(function(mzt) {
        outbuf += MZ_TapeHeader.prototype.getHeadline.apply(mzt.header) + "\n";
        dasmlist = Z80.dasm(
            mzt.body.buffer, 0,
            mzt.header.file_size,
            mzt.header.addr_load);
    });
    var dasmlines = Z80.dasmlines(dasmlist);
    outbuf += dasmlines.join("\n") + "\n";
    return {"outbuf": outbuf, "dasmlines": dasmlines};
};

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
            var data = MZ_Tape.toBytes(cmt);
            if(data == null) {
                console.log("MZ700.dataRecorder_ejectCmt returns null.");
            } else {
                console.log("MZ700.dataRecorder_ejectCmt returns " +
                    data.length + " bytes data");
            }
            return data;
        }
        else {
            console.log(
                    "MZ700.dataRecorder_ejectCmt returns " +
                    "0 bytes data, because NO CMT was set");
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
