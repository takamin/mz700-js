(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
var MZ700_NewMonitor = require("./mz700-new-monitor.js");
var MemoryBlock = require("../Z80/memory-block.js");
const MemoryBlockCbw = require("../Z80/memory-block-cbw.js");
const MemoryBlockCbrw = require("../Z80/memory-block-cbrw.js");
var MemoryBank = require('../Z80/memory-bank.js');

function MZ700_Memory() { }
MZ700_Memory.prototype = new MemoryBank();
MZ700_Memory.prototype.create = function(opt) {

    MemoryBank.prototype.create.call(this, opt);

    const monitorRom = new MZ700_NewMonitor();
    monitorRom.create();

    //
    // Create callbacks when the VRAMs are updated
    //
    const onVramUpdate = opt.onVramUpdate || (()=>{});
    const cacheText = Array(1000).fill(0x00);
    const cacheAttr = Array(1000).fill(0x71);

    this.memblks = {
        IPL_AREA_ROM: monitorRom,
        IPL_AREA_RAM: new MemoryBlock({
            startAddr: 0x0000, size: 0x1000
        }),
        FREE_RAM: new MemoryBlock({
            startAddr: 0x1000, size: 0xC000
        }),
        TEXT_VRAM: new MemoryBlockCbw({
            startAddr: 0xD000, size: 0x0800,
            onPoke: (addr, dispcode) => {
                if(0xD000 <= addr && addr < 0xD000 + 1000) {
                    const i = addr - 0xD000;
                    cacheText[i] = dispcode;
                    onVramUpdate(i, dispcode, cacheAttr[i]);
                }
            },
        }),
        ATTR_VRAM: new MemoryBlockCbw({
            startAddr: 0xD800, size: 0x0800,
            onPoke: (addr, attr) => {
                if(0xD800 <= addr && addr < 0xD800 + 1000) {
                    const i = addr - 0xD800;
                    cacheAttr[i] = attr;
                    onVramUpdate(i, cacheText[i], attr);
                }
            },
        }),
        MMAPED_IO: new MemoryBlockCbrw({
            startAddr: 0xE000, size: 0x0800,
            onPeek: opt.onMappedIoRead || function(){},
            onPoke: opt.onMappedIoUpdate || function(){}
        }),
        EXTND_ROM: new MemoryBlock({
            startAddr: 0xE800, size: 0x10000 - 0xE800
        }),
        DRAM: new MemoryBlock({
            startAddr: 0xD000, size: 0x3000
        })
    };

    this._block1VRAM = true;
    this._disabledBlock1 = false;
    this.changeBlock0_MONITOR();
    this.setMemoryBlock("FREE_RAM", this.memblks.FREE_RAM);
    this.changeBlock1_VRAM();

    // fill attribute VRAM by 71h foreground white and background blue
    for(let i = 0; i < 0x800; i++) {
        this.memblks.ATTR_VRAM.pokeByte(0xD800 + i, 0x71);
    }
}

MZ700_Memory.prototype.setMonitorRom = function(bin) {
    this.memblks.IPL_AREA_ROM.setBinary(bin);
};

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

},{"../Z80/memory-bank.js":10,"../Z80/memory-block-cbrw.js":11,"../Z80/memory-block-cbw.js":12,"../Z80/memory-block.js":13,"./mz700-new-monitor.js":3}],3:[function(require,module,exports){
"use strict"
var MemoryBlock = require("../Z80/memory-block.js");
function MZ700_NewMonitor() { }
MZ700_NewMonitor.prototype = new MemoryBlock();
MZ700_NewMonitor.prototype.create = function() {
    MemoryBlock.prototype.create.call(this, { startAddr: 0x0000, size: 0x1000});
};

MZ700_NewMonitor.prototype.setBinary = function(bin) {
    for(let i = 0; i < this.size; i++) {
        const address = this.startAddr + i;
        MemoryBlock.prototype.pokeByte.call(this,
            address, bin[address]);
    }
};

MZ700_NewMonitor.prototype.pokeByte = function(/*address, value*/) {
    /* IGNORE ALL WRITING */
};

module.exports = MZ700_NewMonitor;

},{"../Z80/memory-block.js":13}],4:[function(require,module,exports){
//
// Codes for Worker context.
// Override the methods in Worker context
//
"use strict";
const TransWorker = require('transworker');
const MZ700 = require('./mz700.js');
const MZ700CanvasRenderer = require('../lib/mz700-canvas-renderer.js');
const PCG700 = require("../lib/PCG-700.js");
const MZ700CG = require("../lib/mz700-cg.js");

//Create MZ700 and TransWorker.
const transworker = new TransWorker();
const mz700 = new MZ700();
const mz700CanvasRenderer = new MZ700CanvasRenderer();

mz700.create({
    started: () => transworker.postNotify("start"),
    stopped: () => transworker.postNotify("stop"),
    onBreak: () => transworker.postNotify("onBreak"),
    onVramUpdate: (index, dispcode, attr) => {
        mz700CanvasRenderer.writeVram(index, attr, dispcode);
    },
    startSound: freq => transworker.postNotify("startSound", [ freq ]),
    stopSound: () => transworker.postNotify("stopSound"),
    onStartDataRecorder: () => transworker.postNotify("onStartDataRecorder"),
    onStopDataRecorder: () => transworker.postNotify("onStopDataRecorder"),
});
const pcg700 = new PCG700(mz700CanvasRenderer);
mz700.mmio.onWrite(0xE010, value => pcg700.setPattern(value & 0xff));
mz700.mmio.onWrite(0xE011, value => pcg700.setAddrLo(value & 0xff));
mz700.mmio.onWrite(0xE012, value => {
    pcg700.setAddrHi(value & PCG700.ADDR);
    pcg700.setCopy(value & PCG700.COPY);
    pcg700.setWE(value & PCG700.WE);
    pcg700.setSSW(value & PCG700.SSW);
});

transworker.create(mz700);

//Receive offscreen canvas from the UI-thread
//and create a renderer and MMIO for PCG-700.
transworker.listenTransferableObject("offscreenCanvas", offscreenCanvas => {
    mz700CanvasRenderer.create({
        canvas: offscreenCanvas,
        CG: new MZ700CG(MZ700CG.ROM, 8, 8),
    });
    mz700CanvasRenderer.setupRendering();
});

},{"../lib/PCG-700.js":15,"../lib/mz700-canvas-renderer.js":24,"../lib/mz700-cg.js":25,"./mz700.js":5,"transworker":39}],5:[function(require,module,exports){
"use strict";
const FractionalTimer = require("fractional-timer");
const MZ_TapeHeader   = require('../lib/mz-tape-header');
const MZ_Tape         = require('../lib/mz-tape');
const MZ_DataRecorder = require('../lib/mz-data-recorder');
const Intel8253       = require('../lib/intel-8253');
const FlipFlopCounter = require('../lib/flip-flop-counter');
const IC556           = require('../lib/ic556');
const MZMMIO          = require("../lib/mz-mmio.js");
const MZ700KeyMatrix  = require('./mz700-key-matrix');
const MZ700_Memory    = require("./mz700-memory.js");
const Z80             = require('../Z80/Z80.js');
const Z80LineAssembler = require("../Z80/Z80-line-assembler");

function MZ700() { }

MZ700.prototype.create = function(opt) {

    // Screen update buffer
    this._screenUpdateData = new Array(1000);

    // Timer id to send screen buffer
    this._vramTxTid = null;


    //MZ700 Key Matrix
    this.keymatrix = new MZ700KeyMatrix();

    // Create 8253
    this.intel8253 = new Intel8253();
    this.intel8253.counter(1).initCount(15700, () => {
        this.intel8253.counter(2).count(1);
    });
    this.intel8253.counter(2).initCount(43200, () => {
        if(this.INTMSK) {
            this.z80.interrupt();
        }
    });

    //HBLNK F/F in 15.7 kHz
    this.hblank = new FlipFlopCounter(MZ700.Z80_CLOCK / 15700);
    this.hblank.addEventListener("change", () => {
        this.intel8253.counter(1).count(1);
    });

    //VBLNK F/F in 50 Hz
    this.vblank = new FlipFlopCounter(MZ700.Z80_CLOCK / 50);
    this.VBLK = false;
    this.vblank.addEventListener("change", () => {
        this.VBLK = !this.VBLK;
    });

    // create IC 556 to create HBLNK(cursor blink) by 3 Hz?
    this.ic556 = new IC556(MZ700.Z80_CLOCK / 3);
    this.ic556_OUT = false;
    this.ic556.addEventListener("change", () => {
        this.ic556_OUT = !this.ic556_OUT;
    });

    this.INTMSK = false;

    this.MLDST = false;

    let motorOffDelayTid = null;
    this.dataRecorder = new MZ_DataRecorder(motorState => {
        if(motorState) {
            if(motorOffDelayTid != null) {
                clearTimeout(motorOffDelayTid);
                motorOffDelayTid = null;
            }
            this.opt.onStartDataRecorder();
        } else {
            motorOffDelayTid = setTimeout(() => {
                motorOffDelayTid = null;
                this.opt.onStopDataRecorder();
            }, 100);
        }
    });

    //
    // Default option settings to notify from WebWorker
    // to UI thread by transworker
    //
    this.opt = {
        started: () => {},
        stopped: () => {},
        onBreak : () => {},
        onVramUpdate: (/*index, dispcode, attr*/) => {},
        onUpdateScrn: (/*buffer*/) => {},
        onMmioRead: (/*address, value*/) => { },
        onMmioWrite: (/*address, value*/) => { },
        startSound: (/*freq*/) => { },
        stopSound: () => {},
        onStartDataRecorder: () => {},
        onStopDataRecorder: () => {}
    };

    //
    // Override option to receive notifications with callbacks.
    //
    opt = opt || {};
    Object.keys(opt).forEach(key => {
        if(!(key in this.opt)) {
            console.warn(`Unknown option key ${key} is specified.`);
        }
    });
    Object.keys(this.opt).forEach(key => {
        if(key in opt) {
            this.opt[key] = opt[key];
        }
    });

    this.tid = null;
    this.clockFactor = 1.0;
    this.tidMeasClock = null;
    this.t_cycle_0 = 0;
    this.actualClockFreq = 0.0;
    this._cycleToWait = 0;

    this.mmio = new MZMMIO();
    for(let address = 0xE000; address < 0xE800; address++) {
        this.mmio.onRead(address,
            value=>this.opt.onMmioRead(address, value));
        this.mmio.onWrite(address,
            value=>this.opt.onMmioWrite(address, value));
    }

    //MMIO $E000
    this.mmio.onWrite(0xE000, value => {
        this.memory.poke(0xE001, this.keymatrix.getKeyData(value));
        this.ic556.loadReset(value & 0x80);
    });

    //MMIO $E001
    // No Device

    //MMIO $E002
    this.mmio.onRead(0xE002, value => {
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
        if(this.dataRecorder.motor()) {
            value = value | 0x10;
        } else {
            value = value & 0xef;
        }
        // PC5 - RDATA : A bit data to read
        if(this.dataRecorder_readBit()) {
            value = value | 0x20;
        } else {
            value = value & 0xdf;
        }
        // PC6 - 556_OUT : A signal to blink cursor on the screen
        if(this.ic556_OUT) {
            value = value | 0x40;
        } else {
            value = value & 0xbf;
        }
        // PC7 - VBLK : A virtical blanking signal
        // set V-BLANK bit
        if(this.VBLK) {
            value = value | 0x80;
        } else {
            value = value & 0x7f;
        }
        return value;
    });

    //MMIO $E003
    this.mmio.onWrite(0xE003, value => {
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
            const bit = ((value & 0x01) != 0);
            const bitno = (value & 0x0e) >> 1;
            //const name = [
            //    "SOUNDMSK(MZ-1500)",
            //    "WDATA","INTMSK","M-ON",
            //    "MOTOR","RDATA", "556 OUT", "VBLK"][bitno];
            //console.log("$E003 8255 CTRL BITSET", name, bit);
            switch(bitno) {
                case 0://SOUNDMSK
                    break;
                case 1://WDATA
                    this.dataRecorder_writeBit(bit);
                    break;
                case 2://INTMSK
                    this.INTMSK = bit;//trueで割り込み許可
                    break;
                case 3://M-ON
                    this.dataRecorder_motorOn(bit);
                    break;
            }
        }
    });

    //MMIO $E004
    this.mmio.onRead(0xE004, () => this.intel8253.counter(0).read());
    this.mmio.onWrite(0xE004, value => {
        if(this.intel8253.counter(0).load(value) && this.MLDST) {
            this.opt.startSound(895000 / this.intel8253.counter(0).value);
        }
    });

    //MMIO $E005
    this.mmio.onRead(0xE005, () => this.intel8253.counter(1).read());
    this.mmio.onWrite(0xE005, value => this.intel8253.counter(1).load(value));

    //MMIO $E006
    this.mmio.onRead(0xE006, () => this.intel8253.counter(2).read());
    this.mmio.onWrite(0xE006, value => this.intel8253.counter(2).load(value));

    //MMIO $E007
    this.mmio.onWrite(0xE007, value => this.intel8253.setCtrlWord(value));

    //MMIO $E008
    this.mmio.onRead(0xE008, value => {
        value = value & 0xfe; // MSBをオフ
        // set H-BLANK bit
        if(this.hblank.readOutput()) {
            value = value | 0x01;
        } else {
            value = value & 0xfe;
        }
        return value;
    });
    this.mmio.onWrite(0xE008, value => {
        if((this.MLDST = ((value & 0x01) != 0)) == true) {
            this.opt.startSound(895000 / this.intel8253.counter(0).value);
        } else {
            this.opt.stopSound();
        }
    });

    this.memory = new MZ700_Memory();
    this.memory.create({
        onVramUpdate: (index, dispcode, attr) => {
            this.opt.onVramUpdate(index, dispcode, attr);
        },
        onMappedIoRead: (address, value) => {
            //MMIO: Input from memory mapped peripherals
            const readValue = this.mmio.read(address, value);
            if(readValue == null || readValue == undefined) {
                return value;
            }
            return readValue;
        },
        onMappedIoUpdate: (address, value) => {
            //MMIO: Output to memory mapped peripherals
            this.mmio.write(address, value);
            return value;
        }
    });

    this.z80 = new Z80({ memory: this.memory });
    this.z80.onWriteIoPort(0xe0, () => this.memory.changeBlock0_DRAM());
    this.z80.onWriteIoPort(0xe1, () => this.memory.changeBlock1_DRAM());
    this.z80.onWriteIoPort(0xe2, () => this.memory.changeBlock0_MONITOR());
    this.z80.onWriteIoPort(0xe3, () => this.memory.changeBlock1_VRAM());
    this.z80.onWriteIoPort(0xe4, () => {
        this.memory.changeBlock0_MONITOR();
        this.memory.changeBlock1_VRAM();
    });
    this.z80.onWriteIoPort(0xe5, () => this.memory.disableBlock1());
    this.z80.onWriteIoPort(0xe6, () => this.memory.enableBlock1());
};

MZ700.Z80_CLOCK = 3.579545 * 1000000;// 3.58 MHz
MZ700.DEFAULT_TIMER_INTERVAL = 1.0 / MZ700.Z80_CLOCK;

MZ700.prototype.setMonitorRom = function(bin) {
    this.memory.setMonitorRom(bin);
};

MZ700.prototype.writeAsmCode = function(assembled) {
    for(let i = 0; i < assembled.buffer.length; i++) {
        this.memory.poke(
                assembled.minAddr + i,
                assembled.buffer[i]);
    }
    return assembled.minAddr;
};

MZ700.prototype.exec = function(execCount) {
    execCount = execCount || 1;
    try {
        for(let i = 0; i < execCount; i++) {
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
        this.mzt_array = MZ_Tape.parseMZT(tape_data);
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
    const cmt = this.dataRecorder.getCmt();
    if(cmt == null) {
        return null;
    }
    return MZ_Tape.toBytes(cmt);
};

MZ700.prototype.loadCassetteTape = function() {
    for(let i = 0; i < this.mzt_array.length; i++) {
        const mzt = this.mzt_array[i];
        for(let j = 0; j < mzt.header.fileSize; j++) {
            this.memory.poke(mzt.header.addrLoad + j, mzt.body.buffer[j]);
        }
    }
};

MZ700.prototype.reset = function() {
    this.memory.enableBlock1();
    this.memory.enableBlock1();
    this.memory.changeBlock0_MONITOR();
    this.memory.changeBlock1_VRAM();

    // Clear VRAM
    for(let i = 0; i < 40 * 25; i++) {
        this.memory.poke(0xd000 + i, 0x00);
        this.memory.poke(0xd800 + i, 0x71);
    }
    this.z80.reset();
};

MZ700.prototype.getRegister = function() {
    const reg = this.z80.reg.cloneRaw();
    reg._ = this.z80.regB.cloneRaw();
    reg.IFF1 = this.z80.IFF1;
    reg.IFF2 = this.z80.IFF2;
    reg.IM = this.z80.IM;
    reg.HALT = this.z80.HALT;
    return reg;
};

MZ700.prototype.setPC = function(addr) {
    this.z80.reg.PC = addr;
};

/**
 * Read memory.
 * @param {number} addrStart start address
 * @param {number} addrEnd (optional) end address
 * @returns {number|Array<number>} A value in the start addr or memory block
 */
MZ700.prototype.readMemory = function(addrStart, addrEnd) {
    if(addrEnd) {
        return Array(addrEnd - addrStart).fill()
            .map( () => this.memory.peek(addrStart++) );
    }
    return this.memory.peek(addrStart);
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

//
// For TransWorker
//
MZ700.prototype.start = function() {
    if("tid" in this && this.tid != null) {
        console.warn("MZ700.start(): already started");
        return false;
    }
    this.startEmulation();
    this.opt.started();

    return true;
};

MZ700.prototype.stop = function() {
    const running = (this.tid != null);
    this.stopEmulation();
    if(running) {
        this.opt.stopped();
    }
};

MZ700.prototype.step = function() {
    if("tid" in this && this.tid != null) {
        this.stop();
        return;
    }
    this.exec(1);
    this.opt.started();
    this.opt.stopped();
};

MZ700.prototype.run = function() {
    try {
        if(this._cycleToWait > 0) {
            this._cycleToWait--;
        } else {
            const cycle0 = this.z80.consumedTCycle;
            this.z80.exec();
            this._cycleToWait = this.z80.consumedTCycle - cycle0;
        }
        this.clock();
    } catch(ex) {
        console.log("Error:", ex);
        console.log(ex.stack);
        this.stop();
        this.opt.onBreak();
    }
};

//
// Disassemble
//
MZ700.disassemble = function(mztape_array) {
    let dasmlist = [];
    mztape_array.forEach( mzt => {
        console.assert(
            mzt.header.constructor === MZ_TapeHeader,
            "No MZT-header");
        let mzthead = mzt.header.getHeadline().split("\n");
        Array.prototype.push.apply(dasmlist, mzthead.map(line => {
            const asmline = new Z80LineAssembler();
            asmline.setComment(line);
            return asmline;
        }));
        Array.prototype.push.apply(dasmlist, Z80.dasm(
            mzt.body.buffer, 0,
            mzt.header.fileSize,
            mzt.header.addrLoad));
    });

    let dasmlines = Z80.dasmlines(dasmlist);
    return {
        outbuf: dasmlines.join("\n") + "\n",
        dasmlines: dasmlines,
        asmlist: dasmlist
    };
};

MZ700.prototype.dataRecorder_setCmt = function(bytes) {
    if(bytes.length == 0) {
        this.dataRecorder.setCmt([]);
        return [];
    }
    const cmt = MZ_Tape.fromBytes(bytes);
    this.dataRecorder.setCmt(cmt);
    return cmt;
};

MZ700.prototype.dataRecorder_ejectCmt = function() {
    if(this.dataRecorder.isCmtSet()) {
        const cmt = this.dataRecorder.ejectCmt();
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
    return this.dataRecorder.rdata(this.z80.consumedTCycle);
};

MZ700.prototype.dataRecorder_writeBit = function(state) {
    this.dataRecorder.wdata(state, this.z80.consumedTCycle);
};

MZ700.prototype.getClockFactor = function() {
    return this.clockFactor;
};

MZ700.prototype.setClockFactor = function(clockFactor) {
    const running = (this.tid != null);
    if(running) {
        this.stopEmulation();
    }
    this.clockFactor = clockFactor;
    if(running) {
        this.startEmulation();
    }
};

MZ700.prototype.getActualClockFreq = function() {
    return this.actualClockFreq;
};

MZ700.prototype.startEmulation = function() {
    const execCount = Math.round(200 * this.clockFactor);
    this.tid = FractionalTimer.setInterval(
        this.run.bind(this), MZ700.DEFAULT_TIMER_INTERVAL, 80, execCount);
    const mint = 1000;
    this.tidMeasClock = setInterval(() => {
        this.actualClockFreq = (this.z80.consumedTCycle - this.t_cycle_0) / (mint / 1000);
        this.t_cycle_0 = this.z80.consumedTCycle;
    }, mint);
};
MZ700.prototype.stopEmulation = function() {
    if(this.tid != null) {
        FractionalTimer.clearInterval(this.tid);
        this.tid = null;
    }
    if(this.tidMeasClock != null) {
        clearInterval(this.tidMeasClock);
        this.tidMeasClock = null;
        this.actualClockFreq = 0.0;
    }
};
module.exports = MZ700;

},{"../Z80/Z80-line-assembler":6,"../Z80/Z80.js":7,"../lib/flip-flop-counter":17,"../lib/ic556":18,"../lib/intel-8253":19,"../lib/mz-data-recorder":20,"../lib/mz-mmio.js":21,"../lib/mz-tape":23,"../lib/mz-tape-header":22,"./mz700-key-matrix":1,"./mz700-memory.js":2,"fractional-timer":36}],6:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const number_util_1 = __importDefault(require("../lib/number-util"));
const oct_1 = __importDefault(require("../lib/oct"));
const mz700_charcode_1 = __importDefault(require("../lib/mz700-charcode"));
const parse_addr_1 = __importDefault(require("../lib/parse-addr"));
class Z80LineAssembler {
    constructor() {
        this.address = null;
        this.bytecode = [];
        this.label = null;
        this.mnemonic = null;
        this.operand = null;
        this.comment = "";
        this.refAddrTo = null;
        this.refCount = 0;
    }
    setAddress(address) {
        this.address = address;
    }
    ;
    setRefAddrTo(refAddrTo) {
        this.refAddrTo = refAddrTo;
    }
    ;
    setLabel(label) {
        this.label = label;
    }
    ;
    setComment(comment) {
        this.address = this.address || 0;
        this.comment = comment;
    }
    ;
    getNextAddress() {
        return this.address + this.bytecode.length;
    }
    ;
    getLastAddress() {
        return this.address + this.bytecode.length - 1;
    }
    ;
    static joinOperand(srcOperand) {
        const dstOperand = [];
        let delimiterPushed = true;
        srcOperand.forEach(element => {
            if (element === ",") {
                dstOperand.push(element);
                delimiterPushed = true;
            }
            else {
                if (!delimiterPushed) {
                    dstOperand.push(" ");
                }
                dstOperand.push(element);
                delimiterPushed = false;
            }
        });
        return dstOperand.join("");
    }
    static getBytecodesFromOperandOfDEFB(operand, dictionary) {
        const code = [];
        operand.forEach(element => {
            if (element !== ",") {
                if (element.match(/^[0-9]/) || element.match(/^[1-9A-F][0-9A-F]*H$/i)) {
                    code.push(parse_addr_1.default.parseNumLiteral(element));
                }
                else {
                    let strcode = null;
                    switch (element.charAt(0)) {
                        case "'":
                        case "\"":
                            strcode = Z80LineAssembler.convertToAsciiCode(element.substring(1, element.length - 1), true);
                            break;
                        case "`":
                            strcode = Z80LineAssembler.convertToAsciiCode(element.substring(1, element.length - 1), false);
                            break;
                        default:
                            if (element in dictionary) {
                                const deref = dictionary[element];
                                if (deref >= 256) {
                                    throw new Error(["The character code exceeds the maximum",
                                        "value of 8 bit with the label", element,
                                        "(", "0x" + number_util_1.default.HEX(deref, 4), ")"].join(" "));
                                }
                                strcode = [deref];
                            }
                            else {
                                throw new Error([
                                    "Fatal: Unrecognized operand for DEFB.", element
                                ].join(" "));
                            }
                    }
                    Array.prototype.push.apply(code, strcode);
                }
            }
        });
        return code;
    }
    ;
    static convertToAsciiCode(str, ascii) {
        const asciicodes = [];
        for (let i = 0; i < str.length;) {
            let c = str.charAt(i++);
            if (c === "\\") {
                c = str.charAt(i++);
                switch (c) {
                    case "0":
                    case "1":
                    case "2":
                    case "3":
                    case "4":
                    case "5":
                    case "6":
                    case "7":
                        {
                            const octstr = c + str.substr(i, 2);
                            if (octstr.length < 3) {
                                throw new Error([
                                    "Unexpected termination at a octal",
                                    "character code sequence",
                                    "at column", (i - 1), "in", str
                                ].join(" "));
                            }
                            else if (!octstr.match(/^[0-7]+$/)) {
                                throw new Error([
                                    "No octal character exists at column",
                                    (i - 1), "in", str
                                ].join(" "));
                            }
                            else {
                                const code = oct_1.default(octstr);
                                if (code >= 256) {
                                    throw new Error([
                                        "The character code exceeds the maximum",
                                        "value of 8 bit at", i, "in", str
                                    ].join(" "));
                                }
                                i += 2;
                                asciicodes.push(code);
                            }
                        }
                        break;
                    case "x":
                        {
                            const hexstr = str.substr(i).replace(/^([0-9a-fA-F]*).*$/, "$1");
                            if (hexstr.length === 0) {
                                throw new Error([
                                    "Unexpected termination at a hex",
                                    "character code sequence",
                                    "at column", (i - 1), "in", str
                                ].join(" "));
                            }
                            const code = parseInt(hexstr, 16);
                            if (code >= 256) {
                                throw new Error([
                                    "The character code exeed 8 bit",
                                    "length at", i, "in", str
                                ].join(" "));
                            }
                            i += hexstr.length;
                            asciicodes.push(code);
                        }
                        break;
                    default:
                        if (ascii) {
                            switch (c) {
                                case "r":
                                    asciicodes.push("\r".charCodeAt(0));
                                    break;
                                default:
                                    asciicodes.push(c.charCodeAt(0));
                                    break;
                            }
                        }
                        else {
                            asciicodes.push(mz700_charcode_1.default.ascii2dispcode[c.charCodeAt(0)]);
                        }
                        break;
                }
            }
            else {
                if (ascii) {
                    asciicodes.push(c.charCodeAt(0));
                }
                else {
                    asciicodes.push(mz700_charcode_1.default.ascii2dispcode[c.charCodeAt(0)]);
                }
            }
        }
        return asciicodes;
    }
    ;
    static parseIndexDisplacer(toks, indexOfSign) {
        const indexD = indexOfSign + (toks[indexOfSign].match(/^[+-]$/) ? 1 : 0);
        const d = parse_addr_1.default.parseNumLiteral(toks[indexD]);
        if (indexD === indexOfSign + 1 && toks[indexOfSign] === '-') {
            return number_util_1.default.to8bitUnsigned(-d);
        }
        return d;
    }
    ;
    static create(mnemonic, operand, machineCode) {
        const asmline = new Z80LineAssembler();
        asmline.mnemonic = mnemonic;
        asmline.operand = operand || "";
        asmline.bytecode = machineCode || [];
        return asmline;
    }
    ;
    static assemble(source, address, dictionary) {
        const asmline = new Z80LineAssembler();
        asmline.address = address;
        const tokens = Z80LineAssembler.tokenize(source);
        let foundLabel = -1;
        let foundComment = -1;
        for (let j = 0; j < tokens.length; j++) {
            switch (tokens[j]) {
                case ':':
                    if (foundLabel < 0 && foundComment < 0) {
                        foundLabel = j;
                    }
                    break;
                case ';':
                    if (foundComment < 0) {
                        foundComment = j;
                    }
                    break;
            }
        }
        if (foundLabel >= 0) {
            asmline.label = tokens.slice(0, foundLabel).join('');
            tokens.splice(0, foundLabel + 1);
            foundComment -= (foundLabel + 1);
        }
        if (foundComment >= 0) {
            asmline.comment = tokens.slice(foundComment).join('');
            tokens.splice(foundComment);
        }
        if (tokens.length > 0) {
            asmline.mnemonic = tokens[0];
            asmline.operand = Z80LineAssembler.joinOperand(tokens.slice(1));
        }
        if (tokens.length > 0) {
            try {
                asmline.bytecode = asmline.assembleMnemonic(tokens, dictionary);
            }
            catch (e) {
                asmline.comment += "*** ASSEMBLE ERROR - " + e;
                console.error(`!!! Error !!! ${e.message}`);
                console.error(`tokens: ${tokens.join(' ')}`);
                console.error(e.stack);
            }
        }
        return asmline;
    }
    ;
    static tokenize(line) {
        const LEX_IDLE = 0;
        const LEX_NUMBER = 2;
        const LEX_IDENT = 3;
        const LEX_CHAR = 4;
        let currstat = LEX_IDLE;
        const L = line.length;
        let i = 0;
        const toks = [];
        let tok = '';
        while (i < L) {
            let ch = line.charAt(i);
            switch (currstat) {
                case LEX_IDLE:
                    if (/\s/.test(ch)) {
                        i++;
                    }
                    else {
                        if (ch === '-' || ch === '+') {
                            tok += ch;
                            i++;
                            currstat = LEX_NUMBER;
                        }
                        else if (/[0-9]/.test(ch)) {
                            currstat = LEX_NUMBER;
                        }
                        else if (/[A-Z_?.*#!$]/i.test(ch)) {
                            tok += ch;
                            i++;
                            currstat = LEX_IDENT;
                        }
                        else if (ch === "'" || ch === "\"" || ch === "`") {
                            tok += ch;
                            i++;
                            currstat = LEX_CHAR;
                        }
                        else if (ch === '(' || ch === ')' || ch === ',' || ch === '+' || ch === ':') {
                            toks.push(ch);
                            i++;
                        }
                        else if (ch === ';') {
                            toks.push(ch);
                            i++;
                            const comment = line.substr(i);
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
                    if (/[0-9A-F]/i.test(ch)) {
                        tok += ch;
                        i++;
                    }
                    else if (/H/i.test(ch)) {
                        tok += ch;
                        i++;
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    else {
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    break;
                case LEX_IDENT:
                    if (/[A-Z_0-9?.*#!$']/i.test(ch)) {
                        tok += ch;
                        i++;
                    }
                    else {
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    break;
                case LEX_CHAR:
                    if (ch === "\\") {
                        ++i;
                        if (i < L) {
                            ch = line.charAt(i);
                            tok += "\\" + ch;
                            i++;
                        }
                    }
                    else if (ch !== tok.charAt(0)) {
                        tok += ch;
                        i++;
                    }
                    else {
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
        if (tok !== '') {
            toks.push(tok.toUpperCase());
        }
        return toks;
    }
    ;
    resolveAddress(dictionary) {
        for (let j = 0; j < this.bytecode.length; j++) {
            if (typeof (this.bytecode[j]) === 'function') {
                this.bytecode[j] = this.bytecode[j](dictionary);
            }
        }
    }
    ;
    assembleMnemonic(toks, dictionary) {
        const label = this.label;
        if (match_token(toks, ['ORG', null])) {
            this.address = parse_addr_1.default._parseNumLiteral(toks[1]);
            return [];
        }
        if (match_token(toks, ['ENT'])) {
            dictionary[label] = this.address;
            return [];
        }
        if (match_token(toks, ['EQU', null])) {
            if (label === null || label === "") {
                throw "empty label for EQU";
            }
            dictionary[label] = parse_addr_1.default._parseNumLiteral(toks[1]);
            return [];
        }
        if (match_token(toks, ['DEFB', null], true)) {
            return Z80LineAssembler.getBytecodesFromOperandOfDEFB(toks.slice(1), dictionary);
        }
        if (match_token(toks, ['DEFW', null])) {
            return parse_addr_1.default.parseNumLiteralPair(toks[1]);
        }
        if (match_token(toks, ['DEFS', null])) {
            const n = parse_addr_1.default._parseNumLiteral(toks[1]);
            if (n < 0) {
                throw "negative DEFS number " + toks[1];
            }
            return Array(n).fill(0);
        }
        if (match_token(toks, ['LD', 'A', ',', 'I'])) {
            return [oct_1.default("0355"), oct_1.default("0127")];
        }
        if (match_token(toks, ['LD', 'A', ',', 'R'])) {
            return [oct_1.default("0355"), oct_1.default("0137")];
        }
        if (match_token(toks, ['LD', 'I', ',', 'A'])) {
            return [oct_1.default("0355"), oct_1.default("0107")];
        }
        if (match_token(toks, ['LD', 'R', ',', 'A'])) {
            return [oct_1.default("0355"), oct_1.default("0117")];
        }
        if (match_token(toks, ['LD', 'B', ',', 'IXH'])) {
            return [0xdd, 0x44];
        }
        if (match_token(toks, ['LD', 'C', ',', 'IXL'])) {
            return [0xdd, 0x4d];
        }
        if (match_token(toks, ['LD', 'A', ',', 'IXL'])) {
            return [0xdd, 0x7d];
        }
        if (match_token(toks, ['ADD', 'A', ',', 'IXH'])) {
            return [0xdd, 0x84];
        }
        if (match_token(toks, ['ADD', 'A', ',', 'IXL'])) {
            return [0xdd, 0x85];
        }
        if (match_token(toks, ['LD', /^[BCDEHLA]$/, ',', /^[BCDEHLA]$/])) {
            const dstR = get8bitRegId(toks[1]);
            const srcR = get8bitRegId(toks[3]);
            return [oct_1.default("0100") | (dstR << 3) | (srcR) << 0];
        }
        if (match_token(toks, ['LD', /^[BCDEHLA]$/, ',', null])) {
            return (() => {
                const r = get8bitRegId(toks[1]);
                const n = parse_addr_1.default.parseNumLiteral(toks[3]);
                return [oct_1.default("0006") | (r << 3), n];
            })();
        }
        if (match_token(toks, ['LD', /^[BCDEHLA]$/, ',', '(', 'HL', ')'])) {
            return (() => {
                const r = get8bitRegId(toks[1]);
                return [oct_1.default("0106") | (r << 3)];
            })();
        }
        if (match_token(toks, ['LD', '(', 'HL', ')', ',', /^[BCDEHLA]$/])) {
            return (() => {
                const r = get8bitRegId(toks[5]);
                return [oct_1.default("0160") | r];
            })();
        }
        if (match_token(toks, ['LD', '(', 'HL', ')', ',', null])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteral(toks[5]);
                return [oct_1.default("0066"), n];
            })();
        }
        if (match_token(toks, ['LD', 'A', ',', '(', /^(BC|DE)$/, ')'])) {
            return (() => {
                const dd = get16bitRegId_dd(toks[4]);
                return [oct_1.default("0012") | (dd << 4)];
            })();
        }
        if (match_token(toks, ['LD', 'A', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0072"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', /^(BC|DE)$/, ')', ',', 'A'])) {
            return (() => {
                const dd = get16bitRegId_dd(toks[2]);
                return [oct_1.default("0002") | (dd << 4)];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'A'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0062"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'SP', ',', 'HL'])) {
            return [oct_1.default("0371")];
        }
        if (match_token(toks, ['LD', 'SP', ',', 'IX'])) {
            return [0xDD, 0xF9];
        }
        if (match_token(toks, ['LD', 'SP', ',', 'IY'])) {
            return [0xfd, 0xF9];
        }
        if (match_token(toks, ['LD', /^(BC|DE|HL|SP)$/, ',', null])) {
            return (() => {
                const dd = get16bitRegId_dd(toks[1]);
                const n = parse_addr_1.default.parseNumLiteralPair(toks[3]);
                return [oct_1.default("0001") | (dd << 4), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'HL', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0052"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'BC', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0355"), oct_1.default("0113"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'DE', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0355"), oct_1.default("0133"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'SP', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0355"), oct_1.default("0173"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'HL'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0042"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'BC'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0355"), oct_1.default("0103"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'DE'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0355"), oct_1.default("0123"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'SP'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0355"), oct_1.default("0163"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['PUSH', /^(BC|DE|HL|AF)$/])) {
            return (() => {
                const qq = get16bitRegId_qq(toks[1]);
                return [oct_1.default("0305") | (qq << 4)];
            })();
        }
        if (match_token(toks, ['POP', /^(BC|DE|HL|AF)$/])) {
            return (() => {
                const qq = get16bitRegId_qq(toks[1]);
                return [oct_1.default("0301") | (qq << 4)];
            })();
        }
        if (match_token(toks, ['LD', 'IXH', ',', 'B'])) {
            return [0xdd, 0x60];
        }
        if (match_token(toks, ['LD', 'IXL', ',', 'C'])) {
            return [0xdd, 0x69];
        }
        if (match_token(toks, ['LD', 'IXH', ',', 'A'])) {
            return [0xdd, 0x67];
        }
        if (match_token(toks, ['LD', 'IXL', ',', 'A'])) {
            return [0xdd, 0x6f];
        }
        if (match_token(toks, ['CP', 'IXL'])) {
            return [0xdd, 0xbd];
        }
        if (match_token(toks, ['EX', 'DE', ',', 'HL'])) {
            return [0xEB];
        }
        if (match_token(toks, ['EX', 'AF', ',', "AF'"])) {
            return [0x08];
        }
        if (match_token(toks, ['EXX'])) {
            return [0xD9];
        }
        if (match_token(toks, ['EX', '(', 'SP', ')', ',', 'HL'])) {
            return [0xE3];
        }
        if (match_token(toks, ['LDI'])) {
            return [oct_1.default("0355"), oct_1.default("0240")];
        }
        if (match_token(toks, ['LDIR'])) {
            return [oct_1.default("0355"), oct_1.default("0260")];
        }
        if (match_token(toks, ['LDD'])) {
            return [oct_1.default("0355"), oct_1.default("0250")];
        }
        if (match_token(toks, ['LDDR'])) {
            return [oct_1.default("0355"), oct_1.default("0270")];
        }
        if (match_token(toks, ['CPI'])) {
            return [oct_1.default("0355"), oct_1.default("0241")];
        }
        if (match_token(toks, ['CPIR'])) {
            return [oct_1.default("0355"), oct_1.default("0261")];
        }
        if (match_token(toks, ['CPD'])) {
            return [oct_1.default("0355"), oct_1.default("0251")];
        }
        if (match_token(toks, ['CPDR'])) {
            return [oct_1.default("0355"), oct_1.default("0271")];
        }
        if (match_token(toks, ['DAA'])) {
            return [oct_1.default("0047")];
        }
        if (match_token(toks, ['CPL'])) {
            return [oct_1.default("0057")];
        }
        if (match_token(toks, ['NEG'])) {
            return [oct_1.default("0355"), oct_1.default("0104")];
        }
        if (match_token(toks, ['CCF'])) {
            return [oct_1.default("0077")];
        }
        if (match_token(toks, ['SCF'])) {
            return [oct_1.default("0067")];
        }
        if (match_token(toks, ['NOP'])) {
            return [oct_1.default("0000")];
        }
        if (match_token(toks, ['HALT'])) {
            return [oct_1.default("0166")];
        }
        if (match_token(toks, ['DI'])) {
            return [oct_1.default("0363")];
        }
        if (match_token(toks, ['EI'])) {
            return [oct_1.default("0373")];
        }
        if (match_token(toks, ['IM0'])) {
            return [oct_1.default("0355"), oct_1.default("0106")];
        }
        if (match_token(toks, ['IM1'])) {
            return [oct_1.default("0355"), oct_1.default("0126")];
        }
        if (match_token(toks, ['IM2'])) {
            return [oct_1.default("0355"), oct_1.default("0136")];
        }
        if (match_token(toks, ['IM', '0'])) {
            return [oct_1.default("0355"), oct_1.default("0106")];
        }
        if (match_token(toks, ['IM', '1'])) {
            return [oct_1.default("0355"), oct_1.default("0126")];
        }
        if (match_token(toks, ['IM', '2'])) {
            return [oct_1.default("0355"), oct_1.default("0136")];
        }
        if (match_token(toks, [/^(ADD|ADC|SBC)$/, 'HL', ',', /^(BC|DE|HL|SP)$/])) {
            let ss = 0;
            switch (toks[3]) {
                case 'BC':
                    ss = 0;
                    break;
                case 'DE':
                    ss = 1;
                    break;
                case 'HL':
                    ss = 2;
                    break;
                case 'SP':
                    ss = 3;
                    break;
            }
            switch (toks[0]) {
                case 'ADD': return [oct_1.default("0011") | (ss << 4)];
                case 'ADC': return [oct_1.default("0355"), oct_1.default("0112") | (ss << 4)];
                case 'SBC': return [oct_1.default("0355"), oct_1.default("0102") | (ss << 4)];
            }
            return [];
        }
        if (match_token(toks, ['ADD', 'IX', ',', /^(BC|DE|IX|SP)$/])) {
            switch (toks[3]) {
                case 'BC': return [oct_1.default("0335"), oct_1.default("0011")];
                case 'DE': return [oct_1.default("0335"), oct_1.default("0031")];
                case 'IX': return [oct_1.default("0335"), oct_1.default("0051")];
                case 'SP': return [oct_1.default("0335"), oct_1.default("0071")];
            }
            return [];
        }
        if (match_token(toks, ['ADD', 'IY', ',', /^(BC|DE|IY|SP)$/])) {
            switch (toks[3]) {
                case 'BC': return [oct_1.default("0375"), oct_1.default("0011")];
                case 'DE': return [oct_1.default("0375"), oct_1.default("0031")];
                case 'IY': return [oct_1.default("0375"), oct_1.default("0051")];
                case 'SP': return [oct_1.default("0375"), oct_1.default("0071")];
            }
            return [];
        }
        if (match_token(toks, [/^(INC|DEC)$/, /^(BC|DE|HL|SP|IX|IY)$/])) {
            switch (toks[0]) {
                case 'INC':
                    switch (toks[1]) {
                        case 'BC': return [oct_1.default("0003")];
                        case 'DE': return [oct_1.default("0023")];
                        case 'HL': return [oct_1.default("0043")];
                        case 'SP': return [oct_1.default("0063")];
                        case 'IX': return [oct_1.default("0335"), oct_1.default("0043")];
                        case 'IY': return [oct_1.default("0375"), oct_1.default("0043")];
                    }
                    break;
                case 'DEC':
                    switch (toks[1]) {
                        case 'BC': return [oct_1.default("0013")];
                        case 'DE': return [oct_1.default("0033")];
                        case 'HL': return [oct_1.default("0053")];
                        case 'SP': return [oct_1.default("0073")];
                        case 'IX': return [oct_1.default("0335"), oct_1.default("0053")];
                        case 'IY': return [oct_1.default("0375"), oct_1.default("0053")];
                    }
                    break;
            }
            return [];
        }
        if (match_token(toks, ['RLCA'])) {
            return [oct_1.default("0007")];
        }
        if (match_token(toks, ['RLA'])) {
            return [oct_1.default("0027")];
        }
        if (match_token(toks, ['RRCA'])) {
            return [oct_1.default("0017")];
        }
        if (match_token(toks, ['RRA'])) {
            return [oct_1.default("0037")];
        }
        if (match_token(toks, [/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/, /^[BCDEHLA]$/])) {
            switch (toks[0]) {
                case 'RLC': return [oct_1.default("0313"), oct_1.default("0000") | get8bitRegId(toks[1])];
                case 'RL': return [oct_1.default("0313"), oct_1.default("0020") | get8bitRegId(toks[1])];
                case 'RRC': return [oct_1.default("0313"), oct_1.default("0010") | get8bitRegId(toks[1])];
                case 'RR': return [oct_1.default("0313"), oct_1.default("0030") | get8bitRegId(toks[1])];
                case 'SLA': return [oct_1.default("0313"), oct_1.default("0040") | get8bitRegId(toks[1])];
                case 'SRA': return [oct_1.default("0313"), oct_1.default("0050") | get8bitRegId(toks[1])];
                case 'SRL': return [oct_1.default("0313"), oct_1.default("0070") | get8bitRegId(toks[1])];
            }
            return [];
        }
        if (match_token(toks, [/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/, '(', 'HL', ')'])) {
            switch (toks[0]) {
                case 'RLC': return [oct_1.default("0313"), oct_1.default("0006")];
                case 'RL': return [oct_1.default("0313"), oct_1.default("0026")];
                case 'RRC': return [oct_1.default("0313"), oct_1.default("0016")];
                case 'RR': return [oct_1.default("0313"), oct_1.default("0036")];
                case 'SLA': return [oct_1.default("0313"), oct_1.default("0046")];
                case 'SRA': return [oct_1.default("0313"), oct_1.default("0056")];
                case 'SRL': return [oct_1.default("0313"), oct_1.default("0076")];
            }
            return [];
        }
        if (match_token(toks, [/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/, '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/, '(', /^(IX|IY)$/, /^[+-].*/, ')'])) {
            const prefix = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            switch (toks[0]) {
                case 'RLC': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0006")];
                case 'RL': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0026")];
                case 'RRC': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0016")];
                case 'RR': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0036")];
                case 'SLA': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0046")];
                case 'SRA': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0056")];
                case 'SRL': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0076")];
            }
            return [];
        }
        if (match_token(toks, ['RLD'])) {
            return [oct_1.default("0355"), oct_1.default("0157")];
        }
        if (match_token(toks, ['RRD'])) {
            return [oct_1.default("0355"), oct_1.default("0147")];
        }
        if (match_token(toks, [/^(BIT|SET|RES)$/, /^[0-7]$/, ',', /^[BCDEHLA]$/])) {
            switch (toks[0]) {
                case 'BIT': return [oct_1.default("0313"), oct_1.default("0100") | (toks[1] << 3) | get8bitRegId(toks[3])];
                case 'SET': return [oct_1.default("0313"), oct_1.default("0300") | (toks[1] << 3) | get8bitRegId(toks[3])];
                case 'RES': return [oct_1.default("0313"), oct_1.default("0200") | (toks[1] << 3) | get8bitRegId(toks[3])];
            }
            return [];
        }
        if (match_token(toks, [/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(', 'HL', ')'])) {
            switch (toks[0]) {
                case 'BIT': return [oct_1.default("0313"), oct_1.default("0106") | (toks[1] << 3)];
                case 'SET': return [oct_1.default("0313"), oct_1.default("0306") | (toks[1] << 3)];
                case 'RES': return [oct_1.default("0313"), oct_1.default("0206") | (toks[1] << 3)];
            }
            return [];
        }
        if (match_token(toks, [/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(', /^(IX|IY)$/, /^[+-].*$/, ')'])) {
            const prefix = getSubopeIXIY(toks[4]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 5);
            switch (toks[0]) {
                case 'BIT': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0106") | (toks[1] << 3)];
                case 'SET': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0306") | (toks[1] << 3)];
                case 'RES': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0206") | (toks[1] << 3)];
            }
            return [];
        }
        if (match_token(toks, ['JP', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[1]);
                return [oct_1.default("0303"), nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['JP', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[3]);
                switch (toks[1]) {
                    case 'NZ': return [oct_1.default("0302"), nn[0], nn[1]];
                    case 'Z': return [oct_1.default("0312"), nn[0], nn[1]];
                    case 'NC': return [oct_1.default("0322"), nn[0], nn[1]];
                    case 'C': return [oct_1.default("0332"), nn[0], nn[1]];
                    case 'PO': return [oct_1.default("0342"), nn[0], nn[1]];
                    case 'PE': return [oct_1.default("0352"), nn[0], nn[1]];
                    case 'P': return [oct_1.default("0362"), nn[0], nn[1]];
                    case 'M': return [oct_1.default("0372"), nn[0], nn[1]];
                }
                return [];
            })();
        }
        if (match_token(toks, ['JR', null])) {
            return (() => {
                const e = parse_addr_1.default.parseRelAddr(toks[1], this.address + 2);
                return [oct_1.default("0030"), e];
            })();
        }
        if (match_token(toks, ['JR', /^(NZ|Z|NC|C)$/, ',', null])) {
            return (() => {
                const e = parse_addr_1.default.parseRelAddr(toks[3], this.address + 2);
                switch (toks[1]) {
                    case 'NZ': return [oct_1.default("0040"), e];
                    case 'Z': return [oct_1.default("0050"), e];
                    case 'NC': return [oct_1.default("0060"), e];
                    case 'C': return [oct_1.default("0070"), e];
                }
                return [];
            })();
        }
        if (match_token(toks, ['JP', '(', /^(HL|IX|IY)$/, ')'])) {
            switch (toks[2]) {
                case 'HL': return [oct_1.default("0351")];
                case 'IX': return [oct_1.default("0335"), oct_1.default("0351")];
                case 'IY': return [oct_1.default("0375"), oct_1.default("0351")];
            }
            return [];
        }
        if (match_token(toks, ['DJNZ', null])) {
            return (() => {
                const e = parse_addr_1.default.parseRelAddr(toks[1], this.address + 2);
                return [oct_1.default("0020"), e];
            })();
        }
        if (match_token(toks, ['CALL', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[1]);
                return [oct_1.default("0315"), nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['CALL', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[3]);
                switch (toks[1]) {
                    case 'NZ': return [oct_1.default("0304"), nn[0], nn[1]];
                    case 'Z': return [oct_1.default("0314"), nn[0], nn[1]];
                    case 'NC': return [oct_1.default("0324"), nn[0], nn[1]];
                    case 'C': return [oct_1.default("0334"), nn[0], nn[1]];
                    case 'PO': return [oct_1.default("0344"), nn[0], nn[1]];
                    case 'PE': return [oct_1.default("0354"), nn[0], nn[1]];
                    case 'P': return [oct_1.default("0364"), nn[0], nn[1]];
                    case 'M': return [oct_1.default("0374"), nn[0], nn[1]];
                }
                return [];
            })();
        }
        if (match_token(toks, ['RET'])) {
            return [oct_1.default("0311")];
        }
        if (match_token(toks, ['RET', /^(NZ|Z|NC|C|PO|PE|P|M)$/])) {
            switch (toks[1]) {
                case 'NZ': return [oct_1.default("0300")];
                case 'Z': return [oct_1.default("0310")];
                case 'NC': return [oct_1.default("0320")];
                case 'C': return [oct_1.default("0330")];
                case 'PO': return [oct_1.default("0340")];
                case 'PE': return [oct_1.default("0350")];
                case 'P': return [oct_1.default("0360")];
                case 'M': return [oct_1.default("0370")];
            }
            return [];
        }
        if (match_token(toks, ['RETI'])) {
            return [oct_1.default("0355"), oct_1.default("0115")];
        }
        if (match_token(toks, ['RETN'])) {
            return [oct_1.default("0355"), oct_1.default("0105")];
        }
        if (match_token(toks, ['RST', /^(00H|08H|10H|18H|20H|28H|30H|38H)$/])) {
            switch (toks[1]) {
                case '00H': return [oct_1.default("0307")];
                case '08H': return [oct_1.default("0317")];
                case '10H': return [oct_1.default("0327")];
                case '18H': return [oct_1.default("0337")];
                case '20H': return [oct_1.default("0347")];
                case '28H': return [oct_1.default("0357")];
                case '30H': return [oct_1.default("0367")];
                case '38H': return [oct_1.default("0377")];
            }
            return [];
        }
        if (match_token(toks, ['IN', /^[BCDEHLA]$/, ',', '(', 'C', ')'])) {
            return (() => {
                const r = get8bitRegId(toks[1]);
                return [oct_1.default("0355"), oct_1.default("0100") | (r << 3)];
            })();
        }
        if (match_token(toks, ['IN', 'A', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteral(toks[4]);
                return [oct_1.default("0333"), n];
            })();
        }
        if (match_token(toks, ['OUT', '(', 'C', ')', ',', /^[BCDEHLA]$/])) {
            return (() => {
                const r = get8bitRegId(toks[5]);
                return [oct_1.default("0355"), oct_1.default("0101") | (r << 3)];
            })();
        }
        if (match_token(toks, ['OUT', '(', null, ')', ',', 'A'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteral(toks[2]);
                return [oct_1.default("0323"), n];
            })();
        }
        if (match_token(toks, ['INI'])) {
            return [oct_1.default("0355"), oct_1.default("0242")];
        }
        if (match_token(toks, ['INIR'])) {
            return [oct_1.default("0355"), oct_1.default("0262")];
        }
        if (match_token(toks, ['IND'])) {
            return [oct_1.default("0355"), oct_1.default("0252")];
        }
        if (match_token(toks, ['INDR'])) {
            return [oct_1.default("0355"), oct_1.default("0272")];
        }
        if (match_token(toks, ['OUTI'])) {
            return [oct_1.default("0355"), oct_1.default("0243")];
        }
        if (match_token(toks, ['OTIR'])) {
            return [oct_1.default("0355"), oct_1.default("0263")];
        }
        if (match_token(toks, ['OUTD'])) {
            return [oct_1.default("0355"), oct_1.default("0253")];
        }
        if (match_token(toks, ['OTDR'])) {
            return [oct_1.default("0355"), oct_1.default("0273")];
        }
        if (match_token(toks, ['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, ['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, null, ')'])) {
            const r = get8bitRegId(toks[1]);
            const subope = getSubopeIXIY(toks[4]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 5);
            return [subope, oct_1.default("0106") | (r << 3), d8u];
        }
        if (match_token(toks, ['LD', '(', /^(IX|IY)$/, /^[+-]$/, null, ')', ',', /^[BCDEHLA]$/])
            || match_token(toks, ['LD', '(', /^(IX|IY)$/, /^[+-].*$/, ')', ',', /^[BCDEHLA]$/])) {
            const subope = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            const indexR = ((toks[3] === '+' || toks[3] === '-') ? 7 : 6);
            const r = get8bitRegId(toks[indexR]);
            return [subope, oct_1.default("0160") | r, d8u];
        }
        if (match_token(toks, ['LD', '(', /^(IX|IY)$/, /^[+-]$/, null, ')', ',', null])
            || match_token(toks, ['LD', '(', /^(IX|IY)$/, /^[+-].*$/, ')', ',', null])) {
            const subope = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            const indexN = ((toks[3] === '+' || toks[3] === '-') ? 7 : 6);
            const n = parse_addr_1.default.parseNumLiteral(toks[indexN]);
            return [subope, 0x36, d8u, n];
        }
        if (match_token(toks, ['LD', /^(IX|IY)$/, ',', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[3]);
                const subope = getSubopeIXIY(toks[1]);
                return [subope, 0x21, nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', /^(IX|IY)$/])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                const subope = getSubopeIXIY(toks[5]);
                return [subope, 0x22, nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['LD', /^(IX|IY)$/, ',', '(', null, ')'])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                const subope = getSubopeIXIY(toks[1]);
                return [subope, 0x2A, nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['PUSH', /^(IX|IY)$/])) {
            return (() => {
                const subope = getSubopeIXIY(toks[1]);
                return [subope, 0xE5];
            })();
        }
        if (match_token(toks, ['POP', /^(IX|IY)$/])) {
            return (() => {
                const subope = getSubopeIXIY(toks[1]);
                return [subope, 0xE1];
            })();
        }
        if (match_token(toks, ['EX', '(', 'SP', ')', ',', /^(IX|IY)$/])) {
            return (() => {
                const subope = getSubopeIXIY(toks[5]);
                return [subope, 0xE3];
            })();
        }
        if (match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', /^[BCDEHLA]$/])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                const r = get8bitRegId(toks[3]);
                return [oct_1.default("0200") | (subseq << 3) | r];
            })();
        }
        if (match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', null])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                const n = parse_addr_1.default.parseNumLiteral(toks[3]);
                return [oct_1.default("0306") | (subseq << 3), n];
            })();
        }
        if (match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', 'HL', ')'])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                return [oct_1.default("0206") | (subseq << 3)];
            })();
        }
        if (match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, /^[+-].*/, ')'])) {
            const subseq = getArithmeticSubOpecode(toks[0]);
            const subope = getSubopeIXIY(toks[4]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 5);
            return [subope, oct_1.default("0206") | (subseq << 3), d8u];
        }
        if (match_token(toks, [/^(AND|OR|XOR|CP)$/, /^[BCDEHLA]$/])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                const r = get8bitRegId(toks[1]);
                return [oct_1.default("0200") | (subseq << 3) | r];
            })();
        }
        if (match_token(toks, [/^(AND|OR|XOR|CP)$/, null])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                const n = parse_addr_1.default.parseNumLiteral(toks[1]);
                return [oct_1.default("0306") | (subseq << 3), n];
            })();
        }
        if (match_token(toks, [/^(AND|OR|XOR|CP)$/, '(', 'HL', ')'])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                return [oct_1.default("0206") | (subseq << 3)];
            })();
        }
        if (match_token(toks, [/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, /^[+-].*$/, ')'])) {
            const subseq = getArithmeticSubOpecode(toks[0]);
            const subope = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            return [subope, oct_1.default("0206") | (subseq << 3), d8u];
        }
        if (match_token(toks, [/^(INC|DEC)$/, /^[BCDEHLA]$/])) {
            return (() => {
                const r = get8bitRegId(toks[1]);
                switch (toks[0]) {
                    case 'INC': return [oct_1.default("0004") | (r << 3)];
                    case 'DEC': return [oct_1.default("0005") | (r << 3)];
                }
            })();
        }
        if (match_token(toks, [/^(INC|DEC)$/, '(', 'HL', ')'])) {
            switch (toks[0]) {
                case 'INC': return [oct_1.default("0064")];
                case 'DEC': return [oct_1.default("0065")];
            }
        }
        if (match_token(toks, [/^(INC|DEC)$/, '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(INC|DEC)$/, '(', /^(IX|IY)$/, /^[+-].*$/, ')'])) {
            const subope = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            switch (toks[0]) {
                case 'INC': return [subope, oct_1.default("0064"), d8u];
                case 'DEC': return [subope, oct_1.default("0065"), d8u];
            }
        }
        console.warn("**** ERROR: CANNOT ASSEMBLE:" + toks.join(" / "));
        return [];
    }
    ;
}
exports.default = Z80LineAssembler;
function getSubopeIXIY(tok) {
    let subope = 0;
    switch (tok) {
        case 'IX':
            subope = oct_1.default("0335");
            break;
        case 'IY':
            subope = oct_1.default("0375");
            break;
    }
    return subope;
}
function getArithmeticSubOpecode(opecode) {
    let subseq = 0;
    switch (opecode) {
        case 'ADD':
            subseq = 0;
            break;
        case 'ADC':
            subseq = 1;
            break;
        case 'SUB':
            subseq = 2;
            break;
        case 'SBC':
            subseq = 3;
            break;
        case 'AND':
            subseq = 4;
            break;
        case 'OR':
            subseq = 6;
            break;
        case 'XOR':
            subseq = 5;
            break;
        case 'CP':
            subseq = 7;
            break;
    }
    return subseq;
}
function get16bitRegId_dd(name) {
    let r = null;
    switch (name) {
        case 'BC':
            r = 0;
            break;
        case 'DE':
            r = 1;
            break;
        case 'HL':
            r = 2;
            break;
        case 'SP':
            r = 3;
            break;
        default: break;
    }
    return r;
}
function get16bitRegId_qq(name) {
    let r = null;
    switch (name) {
        case 'BC':
            r = 0;
            break;
        case 'DE':
            r = 1;
            break;
        case 'HL':
            r = 2;
            break;
        case 'AF':
            r = 3;
            break;
        default: break;
    }
    return r;
}
function get8bitRegId(name) {
    let r = null;
    switch (name) {
        case 'B':
            r = 0;
            break;
        case 'C':
            r = 1;
            break;
        case 'D':
            r = 2;
            break;
        case 'E':
            r = 3;
            break;
        case 'H':
            r = 4;
            break;
        case 'L':
            r = 5;
            break;
        case 'A':
            r = 7;
            break;
        default: break;
    }
    return r;
}
function match_token(toks, pattern, lastNullOfPatternMatchAll) {
    lastNullOfPatternMatchAll = lastNullOfPatternMatchAll || false;
    if (!lastNullOfPatternMatchAll) {
        if (toks.length !== pattern.length) {
            return false;
        }
    }
    else {
        if (toks.length < pattern.length) {
            return false;
        }
    }
    for (let i = 0; i < toks.length; i++) {
        if (pattern[i] != null) {
            if (typeof (pattern[i]) === 'string') {
                if (toks[i] !== pattern[i]) {
                    return false;
                }
            }
            else if (typeof (pattern[i]) === 'object') {
                if (pattern[i].constructor.name === 'RegExp') {
                    if (!pattern[i].test(toks[i])) {
                        return false;
                    }
                }
            }
        }
        else if (lastNullOfPatternMatchAll) {
            if (i === pattern.length - 1) {
                break;
            }
        }
    }
    return true;
}
module.exports = Z80LineAssembler;

},{"../lib/mz700-charcode":26,"../lib/number-util":27,"../lib/oct":28,"../lib/parse-addr":29}],7:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const oct_1 = __importDefault(require("../lib/oct"));
const memory_block_1 = __importDefault(require("./memory-block"));
const register_1 = __importDefault(require("./register"));
const bin_util_1 = __importDefault(require("./bin-util"));
const Z80_line_assembler_1 = __importDefault(require("./Z80-line-assembler"));
const number_util_1 = __importDefault(require("../lib/number-util"));
class Z80 {
    constructor(opt) {
        this.IFF1 = 0;
        this.IFF2 = 0;
        this.IM = 0;
        this.HALT = 0;
        this.consumedTCycle = 0;
        this.exec = Z80.exec;
        opt = opt || { memory: null, };
        this.memory = opt.memory;
        if (opt.memory == null) {
            this.memory = new memory_block_1.default();
            this.memory.create();
        }
        this.ioPort = (new Array(256)).fill(0);
        this.reg = new register_1.default();
        this.regB = new register_1.default();
        this.bpmap = new Array(0x10000);
        this.consumedTCycle = 0;
        this.createOpecodeTable();
        this._onReadIoPort = (new Array(256)).fill(() => { });
        this._onWriteIoPort = (new Array(256)).fill(() => { });
    }
    readIoPort(port) {
        const value = this.ioPort[port];
        this.reg.onReadIoPort(value);
        this._onReadIoPort[port](value);
        return value;
    }
    writeIoPort(port, value) {
        this.ioPort[port] = value;
        this._onWriteIoPort[port](value);
    }
    reset() {
        this.IFF1 = 0;
        this.IFF2 = 0;
        this.IM = 0;
        this.HALT = 0;
        this.reg.clear();
        this.regB.clear();
        this.exec = Z80.exec;
        this.consumedTCycle = 0;
    }
    interrupt() {
        if (this.IFF1) {
            this.pushPair(this.reg.PC);
            this.reg.PC = 0x0038;
        }
    }
    clearBreakPoints() {
        this.bpmap = new Array(0x10000);
        for (let i = 0; i < 0x10000; i++) {
            this.bpmap[i] = null;
        }
    }
    getBreakPoints() {
        return this.bpmap;
    }
    removeBreak(address, size) {
        for (let i = 0; i < size; i++) {
            this.bpmap[address + i] = null;
        }
    }
    setBreak(address, size) {
        for (let i = 0; i < size; i++) {
            this.bpmap[address + i] = true;
        }
    }
    fetch() {
        const PC = this.reg.PC;
        this.reg.PC = (PC + 1) & 0xffff;
        return this.memory.peek(PC);
    }
    fetchSigned() {
        return number_util_1.default.to8bitSigned(this.fetch());
    }
    fetchPair() {
        const PC = this.reg.PC;
        this.reg.PC = (PC + 2) & 0xffff;
        return this.memory.peekPair(PC);
    }
    pushPair(nn) {
        this.memory.poke(--this.reg.SP, bin_util_1.default.hibyte(nn));
        this.memory.poke(--this.reg.SP, bin_util_1.default.lobyte(nn));
    }
    popPair() {
        const lo = this.memory.peek(this.reg.SP++);
        const hi = this.memory.peek(this.reg.SP++);
        return bin_util_1.default.pair(hi, lo);
    }
    incrementAt(addr) {
        this.memory.poke(addr, this.reg.getINCValue(this.memory.peek(addr)));
    }
    decrementAt(addr) {
        this.memory.poke(addr, this.reg.getDECValue(this.memory.peek(addr)));
    }
    disassemble(addr, lastAddr) {
        let disasm = null;
        let errmsg = "";
        const opecode = this.memory.peek(addr);
        try {
            const opecodeEntry = this.opecodeTable[opecode];
            if (opecodeEntry == null) {
                errmsg = "UNKNOWN OPECODE";
            }
            else if (opecodeEntry.disasm == null) {
                errmsg = "NO DISASSEMBLER";
            }
            else {
                const dasmEntry = opecodeEntry.disasm(this.memory, addr);
                if (dasmEntry == null) {
                    errmsg = "NULL RETURNED";
                }
                else if (addr + dasmEntry.code.length > lastAddr) {
                    disasm = null;
                }
                else {
                    disasm = Z80_line_assembler_1.default.create(dasmEntry.mnemonic[0], dasmEntry.mnemonic.slice(1).join(","), dasmEntry.code);
                    if ("refAddrTo" in dasmEntry) {
                        disasm.setRefAddrTo(dasmEntry.refAddrTo);
                    }
                }
            }
        }
        catch (e) {
            errmsg = "EXCEPTION THROWN";
        }
        if (disasm == null) {
            disasm = Z80_line_assembler_1.default.create("DEFB", number_util_1.default.HEX(opecode, 2) + "H", [opecode]);
            disasm.setComment(";*** DISASSEMBLE FAIL: " + errmsg);
        }
        return disasm;
    }
    createOpecodeTable() {
        this.opecodeTable = new Array(256);
        const opeIX = new Array(256);
        const opeIY = new Array(256);
        const opeRotate = new Array(256);
        const opeRotateIX = new Array(256);
        const opeRotateIY = new Array(256);
        const opeMisc = new Array(256);
        const fetch = Z80.prototype.fetch.bind(this);
        const fetchSigned = Z80.prototype.fetchSigned.bind(this);
        const fetchPair = Z80.prototype.fetchPair.bind(this);
        const peek = this.memory.peek.bind(this.memory);
        const peekPair = this.memory.peekPair.bind(this.memory);
        const poke = this.memory.poke.bind(this.memory);
        const pushPair = Z80.prototype.pushPair.bind(this);
        const popPair = Z80.prototype.popPair.bind(this);
        for (let ii = 0; ii < 256; ii++) {
            this.opecodeTable[ii] = {
                mnemonic: null,
                proc: () => { throw "ILLEGAL OPCODE"; },
                disasm: ((i) => (() => ({
                    code: [i],
                    mnemonic: ["DEFB", number_util_1.default.HEX(i, 2) + "H; *** UNKNOWN OPCODE"]
                })))(ii)
            };
            opeIX[ii] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE DD " + number_util_1.default.HEX(i, 2) + " for IX command subset";
                }))(ii),
                disasm: ((i) => (() => ({
                    code: [0xDD],
                    mnemonic: ["DEFB", "DDh; *** UNKNOWN OPCODE " + number_util_1.default.HEX(i, 2) + "H"]
                })))(ii)
            };
            opeIY[ii] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE FD " + number_util_1.default.HEX(i, 2) + " for IY command subset";
                }))(ii),
                disasm: ((i) => (() => ({
                    code: [0xFD],
                    mnemonic: ["DEFB", "FDh; *** UNKNOWN OPCODE " + number_util_1.default.HEX(i, 2) + "H"]
                })))(ii)
            };
            opeRotate[ii] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE CB " + number_util_1.default.HEX(i, 2) + " for Rotate command subset";
                }))(ii),
                disasm: ((i) => (() => ({
                    code: [0xCB],
                    mnemonic: ["DEFB", "CBh; *** UNKNOWN OPCODE " + number_util_1.default.HEX(i, 2) + "H"]
                })))(ii)
            };
            opeRotateIX[ii] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE DD CB " + number_util_1.default.HEX(i, 2) + " for Rotate IX command subset";
                }))(ii),
                disasm: ((i) => (() => ({
                    code: [0xDD, 0xCB],
                    mnemonic: ["DEFW", "CBDDh; *** UNKNOWN OPCODE " + number_util_1.default.HEX(i, 2) + "H"]
                })))(ii)
            };
            opeRotateIY[ii] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE FD CB " + number_util_1.default.HEX(i, 2) + " for Rotate IY command subset";
                }))(ii),
                disasm: ((i) => (() => ({
                    code: [0xFD, 0xCB],
                    mnemonic: ["DEFW", "CBFDh; *** UNKNOWN OPCODE " + number_util_1.default.HEX(i, 2) + "H"]
                })))(ii)
            };
            opeMisc[ii] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE ED " + number_util_1.default.HEX(i, 2) + " for Misc command subset";
                }))(ii),
                disasm: ((i) => (() => ({
                    code: [0xED],
                    mnemonic: ["DEFB", "EDh; *** UNKNOWN OPCODE " + number_util_1.default.HEX(i, 2) + "H"]
                })))(ii)
            };
        }
        this.opecodeTable[0xDD] = {
            mnemonic: () => opeIX,
            proc: () => { opeIX[fetch()].proc(); },
            disasm: (mem, addr) => opeIX[mem.peek(addr + 1)].disasm(mem, addr),
        };
        this.opecodeTable[0xFD] = {
            mnemonic: () => opeIY,
            proc: () => { opeIY[fetch()].proc(); },
            disasm: (mem, addr) => opeIY[mem.peek(addr + 1)].disasm(mem, addr),
        };
        this.opecodeTable[0xCB] = {
            mnemonic: () => opeRotate,
            proc: () => { opeRotate[fetch()].proc(); },
            disasm: (mem, addr) => opeRotate[mem.peek(addr + 1)].disasm(mem, addr),
        };
        this.opecodeTable[0xED] = {
            mnemonic: () => opeMisc,
            proc: () => { opeMisc[fetch()].proc(); },
            disasm: (mem, addr) => opeMisc[mem.peek(addr + 1)].disasm(mem, addr),
        };
        const reg = this.reg;
        const getB = this.reg.getB.bind(this.reg);
        const getC = this.reg.getC.bind(this.reg);
        const getD = this.reg.getD.bind(this.reg);
        const getE = this.reg.getE.bind(this.reg);
        const getH = this.reg.getH.bind(this.reg);
        const getL = this.reg.getL.bind(this.reg);
        const getA = this.reg.getA.bind(this.reg);
        const setB = this.reg.setB.bind(this.reg);
        const setC = this.reg.setC.bind(this.reg);
        const setD = this.reg.setD.bind(this.reg);
        const setE = this.reg.setE.bind(this.reg);
        const setH = this.reg.setH.bind(this.reg);
        const setL = this.reg.setL.bind(this.reg);
        const setA = this.reg.setA.bind(this.reg);
        const getHL = this.reg.getHL.bind(this.reg);
        const getBC = this.reg.getBC.bind(this.reg);
        const getDE = this.reg.getDE.bind(this.reg);
        const procsLdRr = {
            "LD B,B": () => { setB(getB()); },
            "LD B,C": () => { setB(getC()); },
            "LD B,D": () => { setB(getD()); },
            "LD B,E": () => { setB(getE()); },
            "LD B,H": () => { setB(getH()); },
            "LD B,L": () => { setB(getL()); },
            "LD B,A": () => { setB(getA()); },
            "LD C,B": () => { setC(getB()); },
            "LD C,C": () => { setC(getC()); },
            "LD C,D": () => { setC(getD()); },
            "LD C,E": () => { setC(getE()); },
            "LD C,H": () => { setC(getH()); },
            "LD C,L": () => { setC(getL()); },
            "LD C,A": () => { setC(getA()); },
            "LD D,B": () => { setD(getB()); },
            "LD D,C": () => { setD(getC()); },
            "LD D,D": () => { setD(getD()); },
            "LD D,E": () => { setD(getE()); },
            "LD D,H": () => { setD(getH()); },
            "LD D,L": () => { setD(getL()); },
            "LD D,A": () => { setD(getA()); },
            "LD E,B": () => { setE(getB()); },
            "LD E,C": () => { setE(getC()); },
            "LD E,D": () => { setE(getD()); },
            "LD E,E": () => { setE(getE()); },
            "LD E,H": () => { setE(getH()); },
            "LD E,L": () => { setE(getL()); },
            "LD E,A": () => { setE(getA()); },
            "LD H,B": () => { setH(getB()); },
            "LD H,C": () => { setH(getC()); },
            "LD H,D": () => { setH(getD()); },
            "LD H,E": () => { setH(getE()); },
            "LD H,H": () => { setH(getH()); },
            "LD H,L": () => { setH(getL()); },
            "LD H,A": () => { setH(getA()); },
            "LD L,B": () => { setL(getB()); },
            "LD L,C": () => { setL(getC()); },
            "LD L,D": () => { setL(getD()); },
            "LD L,E": () => { setL(getE()); },
            "LD L,H": () => { setL(getH()); },
            "LD L,L": () => { setL(getL()); },
            "LD L,A": () => { setL(getA()); },
            "LD A,B": () => { setA(getB()); },
            "LD A,C": () => { setA(getC()); },
            "LD A,D": () => { setA(getD()); },
            "LD A,E": () => { setA(getE()); },
            "LD A,H": () => { setA(getH()); },
            "LD A,L": () => { setA(getL()); },
            "LD A,A": () => { setA(getA()); },
        };
        for (const dstRegId of Object.keys(register_1.default.REG_R_ID2NAME)) {
            const nDstRegId = parseInt(dstRegId, 10);
            const dstRegName = register_1.default.REG_R_ID2NAME[nDstRegId];
            for (const srcRegId of Object.keys(register_1.default.REG_R_ID2NAME)) {
                const srcRegName = register_1.default.REG_R_ID2NAME[srcRegId];
                const opecode = (0x01 << 6) | (nDstRegId << 3) | parseInt(srcRegId, 10);
                this.opecodeTable[opecode] = {
                    mnemonic: "LD " + dstRegName + "," + srcRegName,
                    proc: procsLdRr[`LD ${dstRegName},${srcRegName}`],
                    "cycle": 4,
                    disasm: ((oc, dst, src) => (() => ({
                        code: [oc],
                        mnemonic: ["LD", dst, src],
                    })))(opecode, dstRegName, srcRegName)
                };
            }
        }
        const disasmLdReg8N = (mem, addr) => {
            const opecode = mem.peek(addr);
            const code = [opecode];
            const x = ((opecode & 0x40) !== 0) ? 1 : 0;
            const r1 = (opecode >> 3) & 0x07;
            const r2 = (opecode >> 0) & 0x07;
            const operand = ["???", "???"];
            let n;
            operand[0] = ((r1 === 6) ? "(HL)" : register_1.default.REG_R_ID2NAME[r1]);
            switch (x) {
                case 0:
                    n = mem.peek(addr + 1);
                    code.push(n);
                    operand[1] = number_util_1.default.HEX(n, 2) + "H";
                    break;
                case 1:
                    operand[1] = ((r2 === 6) ? "(HL)" : register_1.default.REG_R_ID2NAME[r2]);
                    break;
            }
            return { code, mnemonic: ["LD", operand[0], operand[1]] };
        };
        this.opecodeTable[oct_1.default("0006")] = {
            mnemonic: "LD B,n",
            proc: () => { setB(fetch()); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0016")] = {
            mnemonic: "LD C,n",
            proc: () => { setC(fetch()); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0026")] = {
            mnemonic: "LD D,n",
            proc: () => { setD(fetch()); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0036")] = {
            mnemonic: "LD E,n",
            proc: () => { setE(fetch()); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0046")] = {
            mnemonic: "LD H,n",
            proc: () => { setH(fetch()); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0056")] = {
            mnemonic: "LD L,n",
            proc: () => { setL(fetch()); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0076")] = {
            mnemonic: "LD A,n",
            proc: () => { setA(fetch()); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0106")] = {
            mnemonic: "LD B,(HL)",
            proc: () => { setB(peek(getHL())); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0116")] = {
            mnemonic: "LD C,(HL)",
            proc: () => { setC(peek(getHL())); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0126")] = {
            mnemonic: "LD D,(HL)",
            proc: () => { setD(peek(getHL())); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0136")] = {
            mnemonic: "LD E,(HL)",
            proc: () => { setE(peek(getHL())); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0146")] = {
            mnemonic: "LD H,(HL)",
            proc: () => { setH(peek(getHL())); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0156")] = {
            mnemonic: "LD L,(HL)",
            proc: () => { setL(peek(getHL())); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0176")] = {
            mnemonic: "LD A,(HL)",
            proc: () => { setA(peek(getHL())); },
            "cycle": 7,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0160")] = {
            mnemonic: "LD (HL),B",
            proc: () => { poke(getHL(), getB()); },
            "cycle": 10,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0161")] = {
            mnemonic: "LD (HL),C",
            proc: () => { poke(getHL(), getC()); },
            "cycle": 10,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0162")] = {
            mnemonic: "LD (HL),D",
            proc: () => { poke(getHL(), getD()); },
            "cycle": 10,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0163")] = {
            mnemonic: "LD (HL),E",
            proc: () => { poke(getHL(), getE()); },
            "cycle": 10,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0164")] = {
            mnemonic: "LD (HL),H",
            proc: () => { poke(getHL(), getH()); },
            "cycle": 10,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0165")] = {
            mnemonic: "LD (HL),L",
            proc: () => { poke(getHL(), getL()); },
            "cycle": 10,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0167")] = {
            mnemonic: "LD (HL),A",
            proc: () => { poke(getHL(), getA()); },
            "cycle": 10,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0066")] = {
            mnemonic: "LD (HL),n",
            proc: () => { poke(getHL(), fetch()); },
            "cycle": 10,
            disasm: disasmLdReg8N,
        };
        this.opecodeTable[oct_1.default("0012")] = {
            mnemonic: "LD A,(BC)",
            proc: () => { setA(peek(getBC())); },
            "cycle": 7,
            disasm: (mem, addr) => ({ code: [mem.peek(addr)], mnemonic: ["LD", "A", "(BC)"] }),
        };
        this.opecodeTable[oct_1.default("0032")] = {
            mnemonic: "LD A,(DE)",
            proc: () => { setA(peek(getDE())); },
            "cycle": 7,
            disasm: (mem, addr) => ({ code: [mem.peek(addr)], mnemonic: ["LD", "A", "(DE)"] }),
        };
        this.opecodeTable[oct_1.default("0072")] = {
            mnemonic: "LD A,(nn)",
            proc: () => { setA(peek(fetchPair())); },
            "cycle": 13,
            disasm: (mem, addr) => ({
                code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2)],
                mnemonic: ["LD", "A", "(" + number_util_1.default.HEX(mem.peekPair(addr + 1), 4) + "H)"]
            }),
        };
        this.opecodeTable[oct_1.default("0002")] = {
            mnemonic: "LD (BC),A",
            proc: () => { poke(getBC(), getA()); },
            "cycle": 7,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["LD", "(BC)", "A"] }; }
        };
        this.opecodeTable[oct_1.default("0022")] = {
            mnemonic: "LD (DE),A",
            proc: () => { poke(getDE(), getA()); },
            "cycle": 7,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["LD", "(DE)", "A"] }; }
        };
        this.opecodeTable[oct_1.default("0062")] = {
            mnemonic: "LD (nn),A",
            proc: () => { poke(fetchPair(), getA()); },
            "cycle": 13,
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2)],
                    mnemonic: ["LD", "(" + number_util_1.default.HEX(mem.peekPair(addr + 1), 4) + "H)", "A"]
                };
            }
        };
        opeMisc[oct_1.default("0127")] = {
            mnemonic: "LD A,I",
            proc: () => {
                reg.LD_A_I(this.IFF2);
            },
            "cycle": 9,
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "A", "I"]
                };
            }
        };
        opeMisc[oct_1.default("0137")] = {
            mnemonic: "LD A,R",
            proc: () => {
                reg.LD_A_R(this.IFF2, this.regB.R);
            },
            "cycle": 9,
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "A", "R"]
                };
            }
        };
        opeMisc[oct_1.default("0107")] = {
            mnemonic: "LD I,A",
            proc: () => { reg.I = getA(); },
            "cycle": 9,
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "I", "A"]
                };
            }
        };
        opeMisc[oct_1.default("0117")] = {
            mnemonic: "LD R,A",
            proc: () => { reg.R = this.regB.R = getA(); },
            "cycle": 9,
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "R", "A"]
                };
            }
        };
        const disasmLdRIdxD = (mem, addr, r, idx) => {
            const d = mem.peek(addr + 2);
            return {
                code: [mem.peek(addr), mem.peek(addr + 1), d],
                mnemonic: ["LD", r, "(" + idx + "+" + number_util_1.default.HEX(d, 2) + "H)"]
            };
        };
        const disasmLdRIdxDR = (mem, addr, idx, r) => {
            const d = mem.peek(addr + 2);
            const d8s = number_util_1.default.to8bitSigned(d);
            const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
            return {
                code: [mem.peek(addr), mem.peek(addr + 1), d],
                mnemonic: ["LD", `(${idx}${displacement})`, r]
            };
        };
        opeIX[oct_1.default("0106")] = {
            mnemonic: "LD B,(IX+d)",
            proc: () => { setB(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "B", "IX");
            }
        };
        opeIX[oct_1.default("0116")] = {
            mnemonic: "LD C,(IX+d)",
            proc: () => { setC(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "C", "IX");
            }
        };
        opeIX[oct_1.default("0126")] = {
            mnemonic: "LD D,(IX+d)",
            proc: () => { setD(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "D", "IX");
            }
        };
        opeIX[oct_1.default("0136")] = {
            mnemonic: "LD E,(IX+d)",
            proc: () => { setE(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "E", "IX");
            }
        };
        opeIX[oct_1.default("0146")] = {
            mnemonic: "LD H,(IX+d)",
            proc: () => { setH(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "H", "IX");
            }
        };
        opeIX[oct_1.default("0156")] = {
            mnemonic: "LD L,(IX+d)",
            proc: () => { setL(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "L", "IX");
            }
        };
        opeIX[oct_1.default("0176")] = {
            mnemonic: "LD A,(IX+d)",
            proc: () => { setA(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "A", "IX");
            }
        };
        opeIX[oct_1.default("0160")] = {
            mnemonic: "LD (IX+d),B",
            proc: () => { poke(reg.IX + fetchSigned(), getB()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IX", "B");
            }
        };
        opeIX[oct_1.default("0161")] = {
            mnemonic: "LD (IX+d),C",
            proc: () => { poke(reg.IX + fetchSigned(), getC()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IX", "C");
            }
        };
        opeIX[oct_1.default("0162")] = {
            mnemonic: "LD (IX+d),D",
            proc: () => { poke(reg.IX + fetchSigned(), getD()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IX", "D");
            }
        };
        opeIX[oct_1.default("0163")] = {
            mnemonic: "LD (IX+d),E",
            proc: () => { poke(reg.IX + fetchSigned(), getE()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IX", "E");
            }
        };
        opeIX[oct_1.default("0164")] = {
            mnemonic: "LD (IX+d),H",
            proc: () => { poke(reg.IX + fetchSigned(), getH()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IX", "H");
            }
        };
        opeIX[oct_1.default("0165")] = {
            mnemonic: "LD (IX+d),L",
            proc: () => { poke(reg.IX + fetchSigned(), getL()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IX", "L");
            }
        };
        opeIX[oct_1.default("0167")] = {
            mnemonic: "LD (IX+d),A",
            proc: () => { poke(reg.IX + fetchSigned(), getA()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IX", "A");
            }
        };
        opeIY[oct_1.default("0106")] = {
            mnemonic: "LD B,(IY+d)",
            proc: () => { setB(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "B", "IY");
            }
        };
        opeIY[oct_1.default("0116")] = {
            mnemonic: "LD C,(IY+d)",
            proc: () => { setC(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "C", "IY");
            }
        };
        opeIY[oct_1.default("0126")] = {
            mnemonic: "LD D,(IY+d)",
            proc: () => { setD(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "D", "IY");
            }
        };
        opeIY[oct_1.default("0136")] = {
            mnemonic: "LD E,(IY+d)",
            proc: () => { setE(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "E", "IY");
            }
        };
        opeIY[oct_1.default("0146")] = {
            mnemonic: "LD H,(IY+d)",
            proc: () => { setH(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "H", "IY");
            }
        };
        opeIY[oct_1.default("0156")] = {
            mnemonic: "LD L,(IY+d)",
            proc: () => { setL(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "L", "IY");
            }
        };
        opeIY[oct_1.default("0176")] = {
            mnemonic: "LD A,(IY+d)",
            proc: () => { setA(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxD(mem, addr, "A", "IY");
            }
        };
        opeIY[oct_1.default("0160")] = {
            mnemonic: "LD (IY+d),B",
            proc: () => { poke(reg.IY + fetchSigned(), getB()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IY", "B");
            }
        };
        opeIY[oct_1.default("0161")] = {
            mnemonic: "LD (IY+d),C",
            proc: () => { poke(reg.IY + fetchSigned(), getC()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IY", "C");
            }
        };
        opeIY[oct_1.default("0162")] = {
            mnemonic: "LD (IY+d),D",
            proc: () => { poke(reg.IY + fetchSigned(), getD()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IY", "D");
            }
        };
        opeIY[oct_1.default("0163")] = {
            mnemonic: "LD (IY+d),E",
            proc: () => { poke(reg.IY + fetchSigned(), getE()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IY", "E");
            }
        };
        opeIY[oct_1.default("0164")] = {
            mnemonic: "LD (IY+d),H",
            proc: () => { poke(reg.IY + fetchSigned(), getH()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IY", "H");
            }
        };
        opeIY[oct_1.default("0165")] = {
            mnemonic: "LD (IY+d),L",
            proc: () => { poke(reg.IY + fetchSigned(), getL()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IY", "L");
            }
        };
        opeIY[oct_1.default("0167")] = {
            mnemonic: "LD (IY+d),A",
            proc: () => { poke(reg.IY + fetchSigned(), getA()); },
            "cycle": 19,
            disasm: (mem, addr) => {
                return disasmLdRIdxDR(mem, addr, "IY", "A");
            }
        };
        const disasmLdDdNn = (mem, addr) => {
            const opcode = mem.peek(addr);
            const nnL = mem.peek(addr + 1);
            const nnH = mem.peek(addr + 2);
            const nn = bin_util_1.default.pair(nnH, nnL);
            const ddIndex = ((opcode >> 4) & 0x03);
            const reg16bitName = ["BC", "DE", "HL", "SP"];
            if (ddIndex >= reg16bitName.length) {
                throw "*** LD dd,nn; but unknown dd.";
            }
            const dd = reg16bitName[ddIndex];
            return {
                code: [opcode, nnL, nnH],
                mnemonic: ["LD", dd, number_util_1.default.HEX(nn, 4) + "H"]
            };
        };
        this.opecodeTable[oct_1.default("0001")] = {
            mnemonic: "LD BC,nn",
            cycle: 10,
            proc: () => {
                setC(fetch());
                setB(fetch());
            },
            disasm: disasmLdDdNn
        };
        this.opecodeTable[oct_1.default("0021")] = {
            mnemonic: "LD DE,nn",
            cycle: 10,
            proc: () => {
                setE(fetch());
                setD(fetch());
            },
            disasm: disasmLdDdNn
        };
        this.opecodeTable[oct_1.default("0041")] = {
            mnemonic: "LD HL,nn",
            cycle: 10,
            proc: () => {
                setL(fetch());
                setH(fetch());
            },
            disasm: disasmLdDdNn
        };
        this.opecodeTable[oct_1.default("0061")] = {
            mnemonic: "LD SP,nn",
            cycle: 10,
            proc: () => {
                reg.SP = fetchPair();
            },
            disasm: disasmLdDdNn
        };
        this.opecodeTable[oct_1.default("0052")] = {
            mnemonic: "LD HL,(nn)",
            cycle: 16,
            proc: () => {
                const nn = fetchPair();
                setL(peek(nn + 0));
                setH(peek(nn + 1));
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const nnL = mem.peek(addr + 1);
                const nnH = mem.peek(addr + 2);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, nnL, nnH],
                    mnemonic: ["LD", "HL", "(" + number_util_1.default.HEX(nn, 4) + "H)"]
                };
            }
        };
        opeMisc[oct_1.default("0113")] = {
            mnemonic: "LD BC,(nn)",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                setC(peek(nn + 0));
                setB(peek(nn + 1));
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const operand = mem.peek(addr + 1);
                const nnL = mem.peek(addr + 2);
                const nnH = mem.peek(addr + 3);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "BC", "(" + number_util_1.default.HEX(nn, 4) + "H)"]
                };
            }
        };
        opeMisc[oct_1.default("0133")] = {
            mnemonic: "LD DE,(nn)",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                setE(peek(nn + 0));
                setD(peek(nn + 1));
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const operand = mem.peek(addr + 1);
                const nnL = mem.peek(addr + 2);
                const nnH = mem.peek(addr + 3);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "DE", "(" + number_util_1.default.HEX(nn, 4) + "H)"]
                };
            }
        };
        opeMisc[oct_1.default("0153")] = {
            mnemonic: "LD HL,(nn)",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                setL(peek(nn + 0));
                setH(peek(nn + 1));
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const operand = mem.peek(addr + 1);
                const nnL = mem.peek(addr + 2);
                const nnH = mem.peek(addr + 3);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "HL", "(" + number_util_1.default.HEX(nn, 4) + "H)"]
                };
            }
        };
        opeMisc[oct_1.default("0173")] = {
            mnemonic: "LD SP,(nn)",
            cycle: 20,
            proc: () => {
                reg.SP = peekPair(fetchPair());
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const operand = mem.peek(addr + 1);
                const nnL = mem.peek(addr + 2);
                const nnH = mem.peek(addr + 3);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "SP", "(" + number_util_1.default.HEX(nn, 4) + "H)"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0042")] = {
            mnemonic: "LD (nn), HL",
            cycle: 16,
            proc: () => {
                const nn = fetchPair();
                poke(nn + 0, getL());
                poke(nn + 1, getH());
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const nnL = mem.peek(addr + 1);
                const nnH = mem.peek(addr + 2);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, nnL, nnH],
                    mnemonic: ["LD", "(" + number_util_1.default.HEX(nn, 4) + "H)", "HL"]
                };
            }
        };
        opeMisc[oct_1.default("0103")] = {
            mnemonic: "LD (nn),BC",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                poke(nn + 0, getC());
                poke(nn + 1, getB());
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const operand = mem.peek(addr + 1);
                const nnL = mem.peek(addr + 2);
                const nnH = mem.peek(addr + 3);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "(" + number_util_1.default.HEX(nn, 4) + "H)", "BC"]
                };
            }
        };
        opeMisc[oct_1.default("0123")] = {
            mnemonic: "LD (nn),DE",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                poke(nn + 0, getE());
                poke(nn + 1, getD());
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const operand = mem.peek(addr + 1);
                const nnL = mem.peek(addr + 2);
                const nnH = mem.peek(addr + 3);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "(" + number_util_1.default.HEX(nn, 4) + "H)", "DE"]
                };
            }
        };
        opeMisc[oct_1.default("0143")] = {
            mnemonic: "LD (nn),HL",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                poke(nn + 0, getL());
                poke(nn + 1, getH());
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const operand = mem.peek(addr + 1);
                const nnL = mem.peek(addr + 2);
                const nnH = mem.peek(addr + 3);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "(" + number_util_1.default.HEX(nn, 4) + "H)", "HL"]
                };
            }
        };
        opeMisc[oct_1.default("0163")] = {
            mnemonic: "LD (nn),SP",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                poke(nn + 0, (reg.SP >> 0) & 0xff);
                poke(nn + 1, (reg.SP >> 8) & 0xff);
            },
            disasm: (mem, addr) => {
                const opcode = mem.peek(addr);
                const operand = mem.peek(addr + 1);
                const nnL = mem.peek(addr + 2);
                const nnH = mem.peek(addr + 3);
                const nn = bin_util_1.default.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "(" + number_util_1.default.HEX(nn, 4) + "H)", "SP"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0371")] = {
            mnemonic: "LD SP,HL",
            cycle: 6,
            proc: () => {
                reg.SP = getHL();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["LD", "SP", "HL"]
                };
            }
        };
        this.opecodeTable[0xc0 + (0 << 4) + 0x05] = {
            mnemonic: "PUSH BC",
            cycle: 11,
            proc: () => {
                poke(--reg.SP, getB());
                poke(--reg.SP, getC());
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["PUSH", "BC"]
                };
            }
        };
        this.opecodeTable[0xc0 + (1 << 4) + 0x05] = {
            mnemonic: "PUSH DE",
            cycle: 11,
            proc: () => {
                poke(--reg.SP, getD());
                poke(--reg.SP, getE());
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["PUSH", "DE"]
                };
            }
        };
        this.opecodeTable[0xc0 + (2 << 4) + 0x05] = {
            mnemonic: "PUSH HL",
            cycle: 11,
            proc: () => {
                poke(--reg.SP, getH());
                poke(--reg.SP, getL());
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["PUSH", "HL"]
                };
            }
        };
        this.opecodeTable[0xc0 + (3 << 4) + 0x05] = {
            mnemonic: "PUSH AF",
            cycle: 11,
            proc: () => {
                poke(--reg.SP, getA());
                poke(--reg.SP, reg.getF());
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["PUSH", "AF"]
                };
            }
        };
        this.opecodeTable[0xc0 + (0 << 4) + 0x01] = {
            mnemonic: "POP BC",
            cycle: 10,
            proc: () => {
                setC(peek(reg.SP++));
                setB(peek(reg.SP++));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["POP", "BC"]
                };
            }
        };
        this.opecodeTable[0xc0 + (1 << 4) + 0x01] = {
            mnemonic: "POP DE",
            cycle: 10,
            proc: () => {
                setE(peek(reg.SP++));
                setD(peek(reg.SP++));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["POP", "DE"]
                };
            }
        };
        this.opecodeTable[0xc0 + (2 << 4) + 0x01] = {
            mnemonic: "POP HL",
            cycle: 10,
            proc: () => {
                setL(peek(reg.SP++));
                setH(peek(reg.SP++));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["POP", "HL"]
                };
            }
        };
        this.opecodeTable[0xc0 + (3 << 4) + 0x01] = {
            mnemonic: "POP AF",
            cycle: 10,
            proc: () => {
                reg.setF(peek(reg.SP++));
                setA(peek(reg.SP++));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["POP", "AF"]
                };
            }
        };
        opeIX[0x21] = {
            mnemonic: "LD IX,nn",
            cycle: 14,
            proc: () => {
                reg.IX = fetchPair();
            },
            disasm: (mem, addr) => {
                return {
                    "code": [
                        0xDD, 0x21,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3)
                    ],
                    "mnemonic": [
                        "LD", "IX", number_util_1.default.HEX(mem.peekPair(addr + 2), 4) + "H"
                    ]
                };
            }
        };
        opeIX[0x22] = {
            mnemonic: "LD (nn),IX",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                const IXL = reg.IX & 0xFF;
                const IXH = (reg.IX >> 8) & 0xFF;
                poke(nn, IXL);
                poke(nn + 1, IXH);
            },
            disasm: (mem, addr) => {
                return {
                    "code": [
                        0xDD, 0x22,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3),
                    ],
                    "mnemonic": [
                        "LD", "(" + number_util_1.default.HEX(mem.peekPair(addr + 2), 4) + "H)", "IX"
                    ]
                };
            }
        };
        opeIX[0x2A] = {
            mnemonic: "LD IX,(nn)",
            cycle: 20,
            proc: () => {
                reg.IX = peekPair(fetchPair());
            },
            disasm: (mem, addr) => {
                return {
                    "code": [
                        0xDD, 0x2A,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3)
                    ],
                    "mnemonic": [
                        "LD", "IX", "(" + number_util_1.default.HEX(mem.peekPair(addr + 2), 4) + "H)"
                    ]
                };
            }
        };
        opeIX[0x36] = {
            mnemonic: "LD (IX+d),n",
            cycle: 19,
            proc: () => {
                const d = fetchSigned();
                const n = fetch();
                poke(reg.IX + d, n);
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                const n = mem.peek(addr + 3);
                return {
                    "code": [0xDD, 0x36, d, n],
                    "mnemonic": [
                        "LD", `(IX${displacement})`, number_util_1.default.HEX(n, 2) + "H"
                    ]
                };
            }
        };
        opeIX[0xF9] = {
            mnemonic: "LD SP,IX",
            cycle: 10,
            proc: () => {
                reg.SP = reg.IX;
            },
            disasm: () => {
                return {
                    "code": [0xDD, 0xF9],
                    "mnemonic": ["LD", "SP", "IX"]
                };
            }
        };
        opeIX[0xE5] = {
            mnemonic: "PUSH IX",
            cycle: 15,
            proc: () => {
                poke(--reg.SP, bin_util_1.default.hibyte(reg.IX));
                poke(--reg.SP, bin_util_1.default.lobyte(reg.IX));
            },
            disasm: () => {
                return {
                    "code": [0xDD, 0xE5],
                    "mnemonic": ["PUSH", "IX"]
                };
            }
        };
        opeIX[0xE1] = {
            mnemonic: "POP IX",
            cycle: 14,
            proc: () => {
                reg.IX = peekPair(reg.SP);
                reg.SP += 2;
            },
            disasm: () => {
                return {
                    "code": [0xDD, 0xE1],
                    "mnemonic": ["POP", "IX"]
                };
            }
        };
        opeIX[0xE3] = {
            mnemonic: "EX (SP),IX",
            cycle: 23,
            proc: () => {
                const tmpH = peek(reg.SP + 1);
                poke(reg.SP + 1, bin_util_1.default.hibyte(reg.IX));
                const tmpL = peek(reg.SP);
                poke(reg.SP, bin_util_1.default.lobyte(reg.IX));
                reg.IX = bin_util_1.default.pair(tmpH, tmpL);
            },
            disasm: () => {
                return {
                    "code": [0xDD, 0xE3],
                    "mnemonic": ["EX", "(SP)", "IX"]
                };
            }
        };
        opeIY[0x21] = {
            mnemonic: "LD IY,nn",
            cycle: 14,
            proc: () => {
                reg.IY = fetchPair();
            },
            disasm: (mem, addr) => {
                return {
                    "code": [
                        0xFD, 0x21,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3)
                    ],
                    "mnemonic": [
                        "LD", "IY", number_util_1.default.HEX(mem.peekPair(addr + 2), 4) + "H"
                    ]
                };
            }
        };
        opeIY[0x22] = {
            mnemonic: "LD (nn),IY",
            cycle: 20,
            proc: () => {
                const nn = fetchPair();
                const IYL = reg.IY & 0xFF;
                const IYH = (reg.IY >> 8) & 0xFF;
                poke(nn, IYL);
                poke(nn + 1, IYH);
            },
            disasm: (mem, addr) => {
                return {
                    "code": [
                        0xFD, 0x22,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3),
                    ],
                    "mnemonic": [
                        "LD", "(" + number_util_1.default.HEX(mem.peekPair(addr + 2), 4) + "H)", "IY"
                    ]
                };
            }
        };
        opeIY[0x2A] = {
            mnemonic: "LD IY,(nn)",
            cycle: 20,
            proc: () => {
                reg.IY = peekPair(fetchPair());
            },
            disasm: (mem, addr) => {
                return {
                    "code": [
                        0xFD, 0x2A,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3)
                    ],
                    "mnemonic": [
                        "LD", "IY", "(" + number_util_1.default.HEX(mem.peekPair(addr + 2), 4) + "H)"
                    ]
                };
            }
        };
        opeIY[0x36] = {
            mnemonic: "LD (IY+d),n",
            cycle: 19,
            proc: () => {
                const d = fetchSigned();
                const n = fetch();
                poke(reg.IY + d, n);
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                const n = mem.peek(addr + 3);
                return {
                    "code": [0xFD, 0x36, d, n],
                    "mnemonic": [
                        "LD", `(IY${displacement})`, number_util_1.default.HEX(n, 2) + "H"
                    ]
                };
            }
        };
        opeIY[0xF9] = {
            mnemonic: "LD SP,IY",
            cycle: 10,
            proc: () => {
                reg.SP = reg.IY;
            },
            disasm: () => {
                return { "code": [0xFD, 0xF9], "mnemonic": ["LD", "SP", "IY"] };
            }
        };
        opeIY[0xE5] = {
            mnemonic: "PUSH IY",
            cycle: 15,
            proc: () => {
                poke(--reg.SP, bin_util_1.default.hibyte(reg.IY));
                poke(--reg.SP, bin_util_1.default.lobyte(reg.IY));
            },
            disasm: () => {
                return { "code": [0xFD, 0xE5], "mnemonic": ["PUSH", "IY"] };
            }
        };
        opeIY[0xE1] = {
            mnemonic: "POP IY",
            cycle: 14,
            proc: () => {
                reg.IY = peekPair(reg.SP);
                reg.SP += 2;
            },
            disasm: () => {
                return { "code": [0xFD, 0xE1], "mnemonic": ["POP", "IY"] };
            }
        };
        opeIY[0xE3] = {
            mnemonic: "EX (SP),IY",
            cycle: 23,
            proc: () => {
                const tmpH = peek(reg.SP + 1);
                poke(reg.SP + 1, (reg.IY >> 8) & 0xff);
                const tmpL = peek(reg.SP);
                poke(reg.SP, (reg.IY >> 0) & 0xff);
                reg.IY = (tmpH << 8) + tmpL;
            },
            disasm: () => {
                return { "code": [0xFD, 0xE3], "mnemonic": ["EX", "(SP)", "IY"] };
            }
        };
        this.opecodeTable[0xEB] = {
            mnemonic: "EX DE,HL ",
            cycle: 4,
            proc: () => {
                let tmp = getD();
                setD(getH());
                setH(tmp);
                tmp = getE();
                setE(getL());
                setL(tmp);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EX", "DE", "HL"]
                };
            }
        };
        this.opecodeTable[0x08] = {
            mnemonic: "EX AF,AF'",
            cycle: 4,
            proc: () => {
                let tmp = getA();
                setA(this.regB.getA());
                this.regB.setA(tmp);
                tmp = reg.getF();
                reg.setF(this.regB.getF());
                this.regB.setF(tmp);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EX", "AF", "AF'"]
                };
            }
        };
        this.opecodeTable[0xD9] = {
            mnemonic: "EXX",
            cycle: 4,
            proc: () => {
                let tmp = getB();
                setB(this.regB.getB());
                this.regB.setB(tmp);
                tmp = getC();
                setC(this.regB.getC());
                this.regB.setC(tmp);
                tmp = getD();
                setD(this.regB.getD());
                this.regB.setD(tmp);
                tmp = getE();
                setE(this.regB.getE());
                this.regB.setE(tmp);
                tmp = getH();
                setH(this.regB.getH());
                this.regB.setH(tmp);
                tmp = getL();
                setL(this.regB.getL());
                this.regB.setL(tmp);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EXX"]
                };
            }
        };
        this.opecodeTable[0xE3] = {
            mnemonic: "EX (SP),HL",
            cycle: 19,
            proc: () => {
                let tmp = peek(reg.SP + 1);
                poke(reg.SP + 1, getH());
                setH(tmp);
                tmp = peek(reg.SP);
                poke(reg.SP, getL());
                setL(tmp);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EX", "(SP)", "HL"]
                };
            }
        };
        opeMisc[oct_1.default("0240")] = {
            mnemonic: "LDI",
            cycle: 16,
            proc: () => {
                poke(getDE(), peek(getHL()));
                reg.onLDI();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LDI"]
                };
            }
        };
        opeMisc[oct_1.default("0260")] = {
            mnemonic: "LDIR",
            cycle: "BC≠0→21, BC=0→16",
            proc: () => {
                poke(getDE(), peek(getHL()));
                reg.onLDI();
                if (getBC() !== 0) {
                    reg.PC -= 2;
                    return 21;
                }
                return 16;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LDIR"]
                };
            }
        };
        opeMisc[oct_1.default("0250")] = {
            mnemonic: "LDD",
            cycle: 16,
            proc: () => {
                poke(getDE(), peek(getHL()));
                reg.onLDD();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LDD"]
                };
            }
        };
        opeMisc[oct_1.default("0270")] = {
            mnemonic: "LDDR",
            cycle: "BC≠0→21, BC=0→16",
            proc: () => {
                poke(getDE(), peek(getHL()));
                reg.onLDD();
                if (getBC() !== 0) {
                    reg.PC -= 2;
                    return 21;
                }
                return 16;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LDDR"]
                };
            }
        };
        opeMisc[oct_1.default("0241")] = {
            mnemonic: "CPI",
            cycle: 16,
            proc: () => {
                reg.CPI(peek(getHL()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["CPI"]
                };
            }
        };
        opeMisc[oct_1.default("0261")] = {
            mnemonic: "CPIR",
            cycle: "{BC≠0 && A≠(HL)}→21, {BC=0 || A=(HL)}→16",
            proc: () => {
                reg.CPI(peek(getHL()));
                if (getBC() !== 0 && !reg.flagZ()) {
                    reg.PC -= 2;
                    return 21;
                }
                return 16;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["CPIR"]
                };
            }
        };
        opeMisc[oct_1.default("0251")] = {
            mnemonic: "CPD",
            cycle: 16,
            proc: () => {
                reg.CPD(peek(getHL()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["CPD"]
                };
            }
        };
        opeMisc[oct_1.default("0271")] = {
            mnemonic: "CPDR",
            cycle: "{BC≠0 && A≠(HL)}→21, {BC=0 || A=(HL)}→16",
            proc: () => {
                reg.CPD(peek(getHL()));
                if (getBC() !== 0 && !reg.flagZ()) {
                    reg.PC -= 2;
                    return 21;
                }
                return 16;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["CPDR"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0200")] = {
            mnemonic: "ADD A,B",
            cycle: 4,
            proc: () => { reg.addAcc(getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0201")] = {
            mnemonic: "ADD A,C",
            cycle: 4,
            proc: () => { reg.addAcc(getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0202")] = {
            mnemonic: "ADD A,D",
            cycle: 4,
            proc: () => { reg.addAcc(getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0203")] = {
            mnemonic: "ADD A,E",
            cycle: 4,
            proc: () => { reg.addAcc(getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0204")] = {
            mnemonic: "ADD A,H",
            cycle: 4,
            proc: () => { reg.addAcc(getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0205")] = {
            mnemonic: "ADD A,L",
            cycle: 4,
            proc: () => { reg.addAcc(getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0207")] = {
            mnemonic: "ADD A,A",
            cycle: 4,
            proc: () => { reg.addAcc(getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0306")] = {
            mnemonic: "ADD A,n",
            cycle: 7,
            proc: () => { reg.addAcc(fetch()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["ADD", "A", number_util_1.default.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0206")] = {
            mnemonic: "ADD A,(HL)",
            cycle: 7,
            proc: () => { reg.addAcc(peek(getHL())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0206")] = {
            mnemonic: "ADD A,(IX+d)",
            cycle: 19,
            proc: () => {
                reg.addAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["ADD", "A", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0206")] = {
            mnemonic: "ADD A,(IY+d)",
            cycle: 19,
            proc: () => {
                reg.addAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["ADD", "A", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0210")] = {
            mnemonic: "ADC A,B",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0211")] = {
            mnemonic: "ADC A,C",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0212")] = {
            mnemonic: "ADC A,D",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0213")] = {
            mnemonic: "ADC A,E",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0214")] = {
            mnemonic: "ADC A,H",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0215")] = {
            mnemonic: "ADC A,L",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0217")] = {
            mnemonic: "ADC A,A",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0316")] = {
            mnemonic: "ADC A,n",
            cycle: 7,
            proc: () => { reg.addAccWithCarry(fetch()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["ADC", "A", number_util_1.default.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0216")] = {
            mnemonic: "ADC A,(HL)",
            cycle: 7,
            proc: () => { reg.addAccWithCarry(peek(getHL())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0216")] = {
            mnemonic: "ADC A,(IX+d)",
            cycle: 19,
            proc: () => {
                reg.addAccWithCarry(peek(reg.IX + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["ADC", "A", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0216")] = {
            mnemonic: "ADC A,(IY+d)",
            cycle: 19,
            proc: () => {
                reg.addAccWithCarry(peek(reg.IY + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["ADC", "A", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0220")] = {
            mnemonic: "SUB A,B",
            cycle: 4,
            proc: () => { reg.subAcc(getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0221")] = {
            mnemonic: "SUB A,C",
            cycle: 4,
            proc: () => { reg.subAcc(getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0222")] = {
            mnemonic: "SUB A,D",
            cycle: 4,
            proc: () => { reg.subAcc(getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0223")] = {
            mnemonic: "SUB A,E",
            cycle: 4,
            proc: () => { reg.subAcc(getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0224")] = {
            mnemonic: "SUB A,H",
            cycle: 4,
            proc: () => { reg.subAcc(getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0225")] = {
            mnemonic: "SUB A,L",
            cycle: 4,
            proc: () => { reg.subAcc(getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0227")] = {
            mnemonic: "SUB A,A",
            cycle: 4,
            proc: () => { reg.subAcc(getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0326")] = {
            mnemonic: "SUB A,n",
            cycle: 7,
            proc: () => { reg.subAcc(fetch()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["SUB", "A", number_util_1.default.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0226")] = {
            mnemonic: "SUB A,(HL)",
            cycle: 7,
            proc: () => {
                reg.subAcc(peek(getHL()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0226")] = {
            mnemonic: "SUB A,(IX+d)",
            cycle: 19,
            proc: () => {
                reg.subAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["SUB", "A", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0226")] = {
            mnemonic: "SUB A,(IY+d)",
            cycle: 19,
            proc: () => {
                reg.subAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["SUB", "A", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0230")] = {
            mnemonic: "SBC A,B",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0231")] = {
            mnemonic: "SBC A,C",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0232")] = {
            mnemonic: "SBC A,D",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0233")] = {
            mnemonic: "SBC A,E",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0234")] = {
            mnemonic: "SBC A,H",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0235")] = {
            mnemonic: "SBC A,L",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0237")] = {
            mnemonic: "SBC A,A",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0336")] = {
            mnemonic: "SBC A,n",
            cycle: 7,
            proc: () => { reg.subAccWithCarry(fetch()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["SBC", "A," + number_util_1.default.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0236")] = {
            mnemonic: "SBC A,(HL)",
            cycle: 7,
            proc: () => {
                reg.subAccWithCarry(peek(getHL()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0236")] = {
            mnemonic: "SBC A,(IX+d)",
            cycle: 19,
            proc: () => {
                reg.subAccWithCarry(peek(reg.IX + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["SBC", "A", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0236")] = {
            mnemonic: "SBC A,(IY+d)",
            cycle: 19,
            proc: () => {
                reg.subAccWithCarry(peek(reg.IY + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["SBC", "A", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0240")] = {
            mnemonic: "AND B",
            cycle: 4,
            proc: () => { reg.andAcc(getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0241")] = {
            mnemonic: "AND C",
            cycle: 4,
            proc: () => { reg.andAcc(getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0242")] = {
            mnemonic: "AND D",
            cycle: 4,
            proc: () => { reg.andAcc(getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0243")] = {
            mnemonic: "AND E",
            cycle: 4,
            proc: () => { reg.andAcc(getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0244")] = {
            mnemonic: "AND H",
            cycle: 4,
            proc: () => { reg.andAcc(getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0245")] = {
            mnemonic: "AND L",
            cycle: 4,
            proc: () => { reg.andAcc(getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0247")] = {
            mnemonic: "AND A",
            cycle: 4,
            proc: () => { reg.andAcc(getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0346")] = {
            mnemonic: "AND n",
            cycle: 7,
            proc: () => { reg.andAcc(fetch()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["AND", number_util_1.default.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0246")] = {
            mnemonic: "AND (HL)",
            cycle: 7,
            proc: () => {
                reg.andAcc(peek(getHL()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0246")] = {
            mnemonic: "AND (IX+d)",
            cycle: 19,
            proc: () => {
                reg.andAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["AND", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0246")] = {
            mnemonic: "AND (IY+d)",
            cycle: 19,
            proc: () => {
                reg.andAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["AND", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0260")] = {
            mnemonic: "OR B",
            cycle: 4,
            proc: () => { reg.orAcc(getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0261")] = {
            mnemonic: "OR C",
            cycle: 4,
            proc: () => { reg.orAcc(getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0262")] = {
            mnemonic: "OR D",
            cycle: 4,
            proc: () => { reg.orAcc(getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0263")] = {
            mnemonic: "OR E",
            cycle: 4,
            proc: () => { reg.orAcc(getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0264")] = {
            mnemonic: "OR H",
            cycle: 4,
            proc: () => { reg.orAcc(getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0265")] = {
            mnemonic: "OR L",
            cycle: 4,
            proc: () => { reg.orAcc(getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0267")] = {
            mnemonic: "OR A",
            cycle: 4,
            proc: () => { reg.orAcc(getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0366")] = {
            mnemonic: "OR n",
            cycle: 7,
            proc: () => { reg.orAcc(fetch()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["OR", number_util_1.default.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0266")] = {
            mnemonic: "OR (HL)",
            cycle: 7,
            proc: () => {
                reg.orAcc(peek(getHL()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0266")] = {
            mnemonic: "OR (IX+d)",
            cycle: 19,
            proc: () => {
                reg.orAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["OR", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0266")] = {
            mnemonic: "OR (IY+d)",
            cycle: 19,
            proc: () => {
                reg.orAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["OR", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0250")] = {
            mnemonic: "XOR B",
            cycle: 4,
            proc: () => { reg.xorAcc(getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0251")] = {
            mnemonic: "XOR C",
            cycle: 4,
            proc: () => { reg.xorAcc(getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0252")] = {
            mnemonic: "XOR D",
            cycle: 4,
            proc: () => { reg.xorAcc(getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0253")] = {
            mnemonic: "XOR E",
            cycle: 4,
            proc: () => { reg.xorAcc(getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0254")] = {
            mnemonic: "XOR H",
            cycle: 4,
            proc: () => { reg.xorAcc(getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0255")] = {
            mnemonic: "XOR L",
            cycle: 4,
            proc: () => { reg.xorAcc(getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0257")] = {
            mnemonic: "XOR A",
            cycle: 4,
            proc: () => { reg.xorAcc(getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0356")] = {
            mnemonic: "XOR n",
            cycle: 7,
            proc: () => { reg.xorAcc(fetch()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["XOR", number_util_1.default.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0256")] = {
            mnemonic: "XOR (HL)",
            cycle: 7,
            proc: () => { reg.xorAcc(peek(getHL())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0256")] = {
            mnemonic: "XOR (IX+d)",
            cycle: 19,
            proc: () => {
                reg.xorAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["XOR", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0256")] = {
            mnemonic: "XOR (IY+d)",
            cycle: 19,
            proc: () => {
                reg.xorAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["XOR", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0270")] = {
            mnemonic: "CP B",
            cycle: 4,
            proc: () => { reg.compareAcc(getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0271")] = {
            mnemonic: "CP C",
            cycle: 4,
            proc: () => { reg.compareAcc(getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0272")] = {
            mnemonic: "CP D",
            cycle: 4,
            proc: () => { reg.compareAcc(getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0273")] = {
            mnemonic: "CP E",
            cycle: 4,
            proc: () => { reg.compareAcc(getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0274")] = {
            mnemonic: "CP H",
            cycle: 4,
            proc: () => { reg.compareAcc(getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0275")] = {
            mnemonic: "CP L",
            cycle: 4,
            proc: () => { reg.compareAcc(getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0277")] = {
            mnemonic: "CP A",
            cycle: 4,
            proc: () => { reg.compareAcc(getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0376")] = {
            mnemonic: "CP n",
            cycle: 7,
            proc: () => { reg.compareAcc(fetch()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["CP", number_util_1.default.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0276")] = {
            mnemonic: "CP (HL)",
            cycle: 7,
            proc: () => {
                reg.compareAcc(peek(getHL()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0276")] = {
            mnemonic: "CP (IX+d)",
            cycle: 19,
            proc: () => {
                reg.compareAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["CP", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0276")] = {
            mnemonic: "CP (IY+d)",
            cycle: 19,
            proc: () => {
                reg.compareAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["CP", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0004")] = {
            mnemonic: "INC B",
            "cycle": 4,
            proc: () => { reg.increment("B"); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)], mnemonic: ["INC", "B"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0014")] = {
            mnemonic: "INC C",
            "cycle": 4,
            proc: () => { reg.increment("C"); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0024")] = {
            mnemonic: "INC D",
            "cycle": 4,
            proc: () => { reg.increment("D"); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "D"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0034")] = {
            mnemonic: "INC E",
            "cycle": 4,
            proc: () => { reg.increment("E"); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "E"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0044")] = {
            mnemonic: "INC H",
            "cycle": 4,
            proc: () => { reg.increment("H"); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "H"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0054")] = {
            mnemonic: "INC L",
            "cycle": 4,
            proc: () => { reg.increment("L"); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "L"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0074")] = {
            mnemonic: "INC A",
            "cycle": 4,
            proc: () => { reg.increment("A"); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "A"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0064")] = {
            mnemonic: "INC (HL)",
            "cycle": 11,
            proc: () => { this.incrementAt(getHL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "(HL)"]
                };
            }
        };
        opeIX[oct_1.default("0064")] = {
            mnemonic: "INC (IX+d)",
            "cycle": 23,
            proc: () => { this.incrementAt(reg.IX + fetchSigned()); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["INC", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0064")] = {
            mnemonic: "INC (IY+d)",
            "cycle": 23,
            proc: () => { this.incrementAt(reg.IY + fetchSigned()); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["INC", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0005")] = {
            mnemonic: "DEC B", proc: () => { reg.decrement("B"); }, "cycle": 4,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["DEC", "B"] }; }
        };
        this.opecodeTable[oct_1.default("0015")] = {
            mnemonic: "DEC C", proc: () => { reg.decrement("C"); }, "cycle": 4,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["DEC", "C"] }; }
        };
        this.opecodeTable[oct_1.default("0025")] = {
            mnemonic: "DEC D", proc: () => { reg.decrement("D"); }, "cycle": 4,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["DEC", "D"] }; }
        };
        this.opecodeTable[oct_1.default("0035")] = {
            mnemonic: "DEC E", proc: () => { reg.decrement("E"); }, "cycle": 4,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["DEC", "E"] }; }
        };
        this.opecodeTable[oct_1.default("0045")] = {
            mnemonic: "DEC H", proc: () => { reg.decrement("H"); }, "cycle": 4,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["DEC", "H"] }; }
        };
        this.opecodeTable[oct_1.default("0055")] = {
            mnemonic: "DEC L", proc: () => { reg.decrement("L"); }, "cycle": 4,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["DEC", "L"] }; }
        };
        this.opecodeTable[oct_1.default("0075")] = {
            mnemonic: "DEC A", proc: () => { reg.decrement("A"); }, "cycle": 4,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["DEC", "A"] }; }
        };
        this.opecodeTable[oct_1.default("0065")] = {
            mnemonic: "DEC (HL)", proc: () => { this.decrementAt(getHL()); }, "cycle": 11,
            disasm: (mem, addr) => { return { code: [mem.peek(addr)], mnemonic: ["DEC", "(HL)"] }; }
        };
        opeIX[oct_1.default("0065")] = {
            mnemonic: "DEC (IX+d)",
            "cycle": 23,
            proc: () => { this.decrementAt(reg.IX + fetchSigned()); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["DEC", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct_1.default("0065")] = {
            mnemonic: "DEC (IY+d)",
            "cycle": 23,
            proc: () => { this.decrementAt(reg.IY + fetchSigned()); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["DEC", `(IY${displacement})`]
                };
            }
        };
        this.opecodeTable[oct_1.default("0047")] = {
            mnemonic: "DAA",
            cycle: 4,
            proc: () => { reg.DAA(); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DAA"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0057")] = {
            mnemonic: "CPL",
            cycle: 4,
            proc: () => { reg.CPL(); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CPL"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0077")] = {
            mnemonic: "CCF",
            cycle: 4,
            proc: () => {
                if (reg.flagC()) {
                    reg.clearFlagC();
                }
                else {
                    reg.setFlagC();
                }
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CCF"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0067")] = {
            mnemonic: "SCF",
            cycle: 4,
            proc: () => { reg.setFlagC(); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SCF"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0000")] = {
            mnemonic: "NOP",
            cycle: 4,
            proc: () => { },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["NOP"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0166")] = {
            mnemonic: "HALT",
            cycle: 4,
            proc: () => {
                this.HALT = 1;
                reg.PC -= 1;
                this.exec = () => {
                    reg.R = (reg.R + 1) & 255;
                    throw "halt";
                };
                throw "halt";
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["HALT"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0363")] = {
            mnemonic: "DI",
            cycle: 4,
            proc: () => { this.IFF1 = this.IFF2 = 0; },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DI"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0373")] = {
            mnemonic: "EI",
            cycle: 4,
            proc: () => {
                if (!this.IFF1) {
                    this.IFF1 = this.IFF2 = 1;
                    reg.R = (reg.R + 1) & 255;
                    this.exec();
                }
                else {
                    this.IFF2 = 1;
                }
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EI"]
                };
            }
        };
        opeMisc[oct_1.default("0104")] = {
            mnemonic: "NEG",
            cycle: 8,
            proc: () => { reg.NEG(); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["NEG"]
                };
            }
        };
        opeMisc[oct_1.default("0106")] = {
            mnemonic: "IM0",
            cycle: 8,
            proc: () => { this.IM = 0; },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IM0"]
                };
            }
        };
        opeMisc[oct_1.default("0126")] = {
            mnemonic: "IM1",
            cycle: 8,
            proc: () => { this.IM = 1; },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IM1"]
                };
            }
        };
        opeMisc[oct_1.default("0136")] = {
            mnemonic: "IM2",
            cycle: 8,
            proc: () => { this.IM = 2; },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IM2"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0011")] = {
            mnemonic: "ADD HL,BC",
            cycle: 11,
            proc: () => { reg.ADD_HL(getBC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "HL", "BC"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0031")] = {
            mnemonic: "ADD HL,DE",
            cycle: 11,
            proc: () => { reg.ADD_HL(getDE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "HL", "DE"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0051")] = {
            mnemonic: "ADD HL,HL",
            cycle: 11,
            proc: () => { reg.ADD_HL(getHL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "HL", "HL"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0071")] = {
            mnemonic: "ADD HL,SP",
            cycle: 11,
            proc: () => { reg.ADD_HL(reg.SP); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "HL", "SP"]
                };
            }
        };
        opeMisc[oct_1.default("0112")] = {
            mnemonic: "ADC HL,BC",
            cycle: 15,
            proc: () => { reg.ADC_HL(getBC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADC", "HL", "BC"]
                };
            }
        };
        opeMisc[oct_1.default("0132")] = {
            mnemonic: "ADC HL,DE",
            cycle: 15,
            proc: () => { reg.ADC_HL(getDE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADC", "HL", "DE"]
                };
            }
        };
        opeMisc[oct_1.default("0152")] = {
            mnemonic: "ADC HL,HL",
            cycle: 15,
            proc: () => { reg.ADC_HL(getHL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADC", "HL", "HL"]
                };
            }
        };
        opeMisc[oct_1.default("0172")] = {
            mnemonic: "ADC HL,SP",
            cycle: 15,
            proc: () => { reg.ADC_HL(reg.SP); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADC", "HL", "SP"]
                };
            }
        };
        opeMisc[oct_1.default("0102")] = {
            mnemonic: "SBC HL,BC",
            cycle: 15,
            proc: () => { reg.SBC_HL(getBC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["SBC", "HL", "BC"]
                };
            }
        };
        opeMisc[oct_1.default("0122")] = {
            mnemonic: "SBC HL,DE",
            cycle: 15,
            proc: () => { reg.SBC_HL(getDE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["SBC", "HL", "DE"]
                };
            }
        };
        opeMisc[oct_1.default("0142")] = {
            mnemonic: "SBC HL,HL",
            cycle: 15,
            proc: () => { reg.SBC_HL(getHL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["SBC", "HL", "HL"]
                };
            }
        };
        opeMisc[oct_1.default("0162")] = {
            mnemonic: "SBC HL,SP",
            cycle: 15,
            proc: () => { reg.SBC_HL(reg.SP); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["SBC", "HL", "SP"]
                };
            }
        };
        opeIX[oct_1.default("0011")] = {
            mnemonic: "ADD IX,BC",
            cycle: 15,
            proc: () => { reg.ADD_IX(getBC()); },
            disasm: () => {
                return {
                    code: [0xDD, 0x09],
                    mnemonic: ["ADD", "IX", "BC"]
                };
            }
        };
        opeIX[oct_1.default("0031")] = {
            mnemonic: "ADD IX,DE",
            cycle: 15,
            proc: () => { reg.ADD_IX(getDE()); },
            disasm: () => {
                return {
                    code: [0xDD, 0x19],
                    mnemonic: ["ADD", "IX", "DE"]
                };
            }
        };
        opeIX[oct_1.default("0051")] = {
            mnemonic: "ADD IX,IX",
            cycle: 15,
            proc: () => { reg.ADD_IX(reg.IX); },
            disasm: () => {
                return {
                    code: [0xDD, 0x29],
                    mnemonic: ["ADD", "IX", "IX"]
                };
            }
        };
        opeIX[oct_1.default("0071")] = {
            mnemonic: "ADD IX,SP",
            cycle: 15,
            proc: () => { reg.ADD_IX(reg.SP); },
            disasm: () => {
                return {
                    code: [0xDD, 0x39],
                    mnemonic: ["ADD", "IX", "SP"]
                };
            }
        };
        opeIY[oct_1.default("0011")] = {
            mnemonic: "ADD IY,BC",
            cycle: 15,
            proc: () => { reg.ADD_IY(getBC()); },
            disasm: () => {
                return {
                    code: [0xFD, 0x09],
                    mnemonic: ["ADD", "IY", "BC"]
                };
            }
        };
        opeIY[oct_1.default("0031")] = {
            mnemonic: "ADD IY,DE",
            cycle: 15,
            proc: () => { reg.ADD_IY(getDE()); },
            disasm: () => {
                return {
                    code: [0xFD, 0x19],
                    mnemonic: ["ADD", "IY", "DE"]
                };
            }
        };
        opeIY[oct_1.default("0051")] = {
            mnemonic: "ADD IY,IY",
            cycle: 15,
            proc: () => { reg.ADD_IY(reg.IY); },
            disasm: () => {
                return {
                    code: [0xFD, 0x29],
                    mnemonic: ["ADD", "IY", "IY"]
                };
            }
        };
        opeIY[oct_1.default("0071")] = {
            mnemonic: "ADD IY,SP",
            cycle: 15,
            proc: () => { reg.ADD_IY(reg.SP); },
            disasm: () => {
                return {
                    code: [0xFD, 0x39],
                    mnemonic: ["ADD", "IY", "SP"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0003")] = {
            mnemonic: "INC BC",
            cycle: 6,
            proc: () => {
                reg.incBC();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "BC"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0023")] = {
            mnemonic: "INC DE",
            cycle: 6,
            proc: () => {
                reg.incDE();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "DE"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0043")] = {
            mnemonic: "INC HL",
            cycle: 6,
            proc: () => {
                reg.incHL();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "HL"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0063")] = {
            mnemonic: "INC SP",
            cycle: 6,
            proc: () => { reg.SP = (reg.SP + 1) & 0xffff; },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "SP"]
                };
            }
        };
        opeIX[oct_1.default("0043")] = {
            mnemonic: "INC IX",
            cycle: 10,
            proc: () => {
                reg.IX = (reg.IX + 1) & 0xffff;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INC", "IX"]
                };
            }
        };
        opeIY[oct_1.default("0043")] = {
            mnemonic: "INC IY",
            cycle: 10,
            proc: () => {
                reg.IY = (reg.IY + 1) & 0xffff;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INC", "IY"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0013")] = {
            mnemonic: "DEC BC",
            cycle: 6,
            proc: () => {
                reg.decBC();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DEC", "BC"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0033")] = {
            mnemonic: "DEC DE",
            cycle: 6,
            proc: () => {
                reg.decDE();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DEC", "DE"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0053")] = {
            mnemonic: "DEC HL",
            cycle: 6,
            proc: () => {
                reg.decHL();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DEC", "HL"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0073")] = {
            mnemonic: "DEC SP",
            cycle: 6,
            proc: () => {
                reg.SP = (reg.SP - 1) & 0xffff;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DEC", "SP"]
                };
            }
        };
        opeIX[oct_1.default("0053")] = {
            mnemonic: "DEC IX",
            cycle: 10,
            proc: () => {
                reg.IX = (reg.IX - 1) & 0xffff;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["DEC", "IX"]
                };
            }
        };
        opeIY[oct_1.default("0053")] = {
            mnemonic: "DEC IY",
            cycle: 10,
            proc: () => {
                reg.IY = (reg.IY - 1) & 0xffff;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["DEC", "IY"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0007")] = {
            mnemonic: "RLCA",
            cycle: 4,
            proc: () => { reg.RLCA(); },
            disasm: () => {
                return {
                    code: [oct_1.default("0007")],
                    mnemonic: ["RLCA"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0027")] = {
            mnemonic: "RLA",
            cycle: 4,
            proc: () => { reg.RLA(); },
            disasm: () => {
                return {
                    code: [oct_1.default("0027")],
                    mnemonic: ["RLA"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0017")] = {
            mnemonic: "RRCA",
            cycle: 4,
            proc: () => { reg.RRCA(); },
            disasm: () => {
                return {
                    code: [oct_1.default("0017")],
                    mnemonic: ["RRCA"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0037")] = {
            mnemonic: "RRA",
            cycle: 4,
            proc: () => { reg.RRA(); },
            disasm: () => {
                return {
                    code: [oct_1.default("0037")],
                    mnemonic: ["RRA"]
                };
            }
        };
        opeIX[oct_1.default("0313")] = {
            mnemonic: () => { return opeRotateIX; },
            proc: () => {
                const d = fetchSigned();
                const feature = fetch();
                opeRotateIX[feature].proc(d);
            },
            disasm: (mem, addr) => {
                const feature = mem.peek(addr + 3);
                return opeRotateIX[feature].disasm(mem, addr);
            }
        };
        opeIY[oct_1.default("0313")] = {
            mnemonic: () => { return opeRotateIY; },
            proc: () => {
                const d = fetchSigned();
                const feature = fetch();
                opeRotateIY[feature].proc(d);
            },
            disasm: (mem, addr) => {
                const feature = mem.peek(addr + 3);
                return opeRotateIY[feature].disasm(mem, addr);
            }
        };
        opeRotate[oct_1.default("0000")] = {
            mnemonic: "RLC B",
            cycle: 4,
            proc: () => {
                setB(reg.RLC(getB()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "B"]
                };
            }
        };
        opeRotate[oct_1.default("0001")] = {
            mnemonic: "RLC C",
            cycle: 4,
            proc: () => {
                setC(reg.RLC(getC()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "C"]
                };
            }
        };
        opeRotate[oct_1.default("0002")] = {
            mnemonic: "RLC D",
            cycle: 4,
            proc: () => {
                setD(reg.RLC(getD()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "D"]
                };
            }
        };
        opeRotate[oct_1.default("0003")] = {
            mnemonic: "RLC E",
            cycle: 4,
            proc: () => {
                setE(reg.RLC(getE()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "E"]
                };
            }
        };
        opeRotate[oct_1.default("0004")] = {
            mnemonic: "RLC H",
            cycle: 4,
            proc: () => {
                setH(reg.RLC(getH()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "H"]
                };
            }
        };
        opeRotate[oct_1.default("0005")] = {
            mnemonic: "RLC L",
            cycle: 4,
            proc: () => {
                setL(reg.RLC(getL()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "L"]
                };
            }
        };
        opeRotate[oct_1.default("0007")] = {
            mnemonic: "RLC A",
            cycle: 4,
            proc: () => {
                setA(reg.RLC(getA()));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "A"]
                };
            }
        };
        opeRotate[oct_1.default("0006")] = {
            mnemonic: "RLC (HL)",
            cycle: 15,
            proc: () => {
                const adr = getHL();
                poke(adr, reg.RLC(peek(adr)));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "(HL)"]
                };
            }
        };
        opeRotateIX[oct_1.default("0006")] = {
            mnemonic: "RLC (IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, reg.RLC(peek(adr)));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RLC", `(IX${displacement})`]
                };
            }
        };
        opeRotateIY[oct_1.default("0006")] = {
            mnemonic: "RLC (IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, reg.RLC(peek(adr)));
            },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RLC", `(IY${displacement})`]
                };
            }
        };
        opeRotate[oct_1.default("0020")] = {
            mnemonic: "RL B",
            cycle: 8,
            proc: () => { setB(reg.RL(getB())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "B"] }; }
        };
        opeRotate[oct_1.default("0021")] = {
            mnemonic: "RL C",
            cycle: 8,
            proc: () => { setC(reg.RL(getC())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "C"] }; }
        };
        opeRotate[oct_1.default("0022")] = {
            mnemonic: "RL D",
            cycle: 8,
            proc: () => { setD(reg.RL(getD())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "D"] }; }
        };
        opeRotate[oct_1.default("0023")] = {
            mnemonic: "RL E",
            cycle: 8,
            proc: () => { setE(reg.RL(getE())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "E"] }; }
        };
        opeRotate[oct_1.default("0024")] = {
            mnemonic: "RL H",
            cycle: 8,
            proc: () => { setH(reg.RL(getH())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "H"] }; }
        };
        opeRotate[oct_1.default("0025")] = {
            mnemonic: "RL L",
            cycle: 8,
            proc: () => { setL(reg.RL(getL())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "L"] }; }
        };
        opeRotate[oct_1.default("0026")] = {
            mnemonic: "RL (HL)",
            cycle: 15,
            proc: () => { const adr = getHL(); poke(adr, reg.RL(peek(adr))); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "(HL)"] }; }
        };
        opeRotate[oct_1.default("0027")] = {
            mnemonic: "RL A",
            cycle: 8,
            proc: () => { setA(reg.RL(getA())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "A"] }; }
        };
        opeRotateIX[oct_1.default("0026")] = {
            mnemonic: "RL (IX+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IX + d; poke(adr, reg.RL(peek(adr))); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RL", `(IX${displacement})`]
                };
            }
        };
        opeRotateIY[oct_1.default("0026")] = {
            mnemonic: "RL (IY+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IY + d; poke(adr, reg.RL(peek(adr))); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RL", `(IY${displacement})`]
                };
            }
        };
        opeRotate[oct_1.default("0010")] = {
            mnemonic: "RRC B",
            cycle: 4,
            proc: () => { setB(reg.RRC(getB())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "B"] }; }
        };
        opeRotate[oct_1.default("0011")] = {
            mnemonic: "RRC C",
            cycle: 4,
            proc: () => { setC(reg.RRC(getC())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "C"] }; }
        };
        opeRotate[oct_1.default("0012")] = {
            mnemonic: "RRC D",
            cycle: 4,
            proc: () => { setD(reg.RRC(getD())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "D"] }; }
        };
        opeRotate[oct_1.default("0013")] = {
            mnemonic: "RRC E",
            cycle: 4,
            proc: () => { setE(reg.RRC(getE())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "E"] }; }
        };
        opeRotate[oct_1.default("0014")] = {
            mnemonic: "RRC H",
            cycle: 4,
            proc: () => { setH(reg.RRC(getH())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "H"] }; }
        };
        opeRotate[oct_1.default("0015")] = {
            mnemonic: "RRC L",
            cycle: 4,
            proc: () => { setL(reg.RRC(getL())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "L"] }; }
        };
        opeRotate[oct_1.default("0017")] = {
            mnemonic: "RRC A",
            cycle: 4,
            proc: () => { setA(reg.RRC(getA())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "A"] }; }
        };
        opeRotate[oct_1.default("0016")] = {
            mnemonic: "RRC (HL)",
            cycle: 15,
            proc: () => { const adr = getHL(); poke(adr, reg.RRC(peek(adr))); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "(HL)"] }; }
        };
        opeRotateIX[oct_1.default("0016")] = {
            mnemonic: "RRC (IX+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IX + d; poke(adr, reg.RRC(peek(adr))); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RRC", `(IX${displacement})`]
                };
            }
        };
        opeRotateIY[oct_1.default("0016")] = {
            mnemonic: "RRC (IY+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IY + d; poke(adr, reg.RRC(peek(adr))); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RRC", `(IY${displacement})`]
                };
            }
        };
        opeRotate[oct_1.default("0030")] = {
            mnemonic: "RR B",
            cycle: 8,
            proc: () => { setB(reg.RR(getB())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "B"] }; }
        };
        opeRotate[oct_1.default("0031")] = {
            mnemonic: "RR C",
            cycle: 8,
            proc: () => { setC(reg.RR(getC())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "C"] }; }
        };
        opeRotate[oct_1.default("0032")] = {
            mnemonic: "RR D",
            cycle: 8,
            proc: () => { setD(reg.RR(getD())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "D"] }; }
        };
        opeRotate[oct_1.default("0033")] = {
            mnemonic: "RR E",
            cycle: 8,
            proc: () => { setE(reg.RR(getE())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "E"] }; }
        };
        opeRotate[oct_1.default("0034")] = {
            mnemonic: "RR H",
            cycle: 8,
            proc: () => { setH(reg.RR(getH())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "H"] }; }
        };
        opeRotate[oct_1.default("0035")] = {
            mnemonic: "RR L",
            cycle: 8,
            proc: () => { setL(reg.RR(getL())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "L"] }; }
        };
        opeRotate[oct_1.default("0036")] = {
            mnemonic: "RR (HL)",
            cycle: 15,
            proc: () => { const adr = getHL(); poke(adr, reg.RR(peek(adr))); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "(HL)"] }; }
        };
        opeRotate[oct_1.default("0037")] = {
            mnemonic: "RR A",
            cycle: 8,
            proc: () => { setA(reg.RR(getA())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "A"] }; }
        };
        opeRotateIX[oct_1.default("0036")] = {
            mnemonic: "RR (IX+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IX + d; poke(adr, reg.RR(peek(adr))); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["RR", "(IX+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotateIY[oct_1.default("0036")] = {
            mnemonic: "RR (IY+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IY + d; poke(adr, reg.RR(peek(adr))); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["RR", "(IY+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotate[oct_1.default("0040")] = {
            mnemonic: "SLA B",
            cycle: 8,
            proc: () => { setB(reg.SLA(getB())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "B"] }; }
        };
        opeRotate[oct_1.default("0041")] = {
            mnemonic: "SLA C",
            cycle: 8,
            proc: () => { setC(reg.SLA(getC())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "C"] }; }
        };
        opeRotate[oct_1.default("0042")] = {
            mnemonic: "SLA D",
            cycle: 8,
            proc: () => { setD(reg.SLA(getD())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "D"] }; }
        };
        opeRotate[oct_1.default("0043")] = {
            mnemonic: "SLA E",
            cycle: 8,
            proc: () => { setE(reg.SLA(getE())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "E"] }; }
        };
        opeRotate[oct_1.default("0044")] = {
            mnemonic: "SLA H",
            cycle: 8,
            proc: () => { setH(reg.SLA(getH())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "H"] }; }
        };
        opeRotate[oct_1.default("0045")] = {
            mnemonic: "SLA L",
            cycle: 8,
            proc: () => { setL(reg.SLA(getL())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "L"] }; }
        };
        opeRotate[oct_1.default("0047")] = {
            mnemonic: "SLA A",
            cycle: 8,
            proc: () => { setA(reg.SLA(getA())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "A"] }; }
        };
        opeRotate[oct_1.default("0046")] = {
            mnemonic: "SLA (HL)",
            cycle: 15,
            proc: () => { const adr = getHL(); poke(adr, reg.SLA(peek(adr))); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "(HL)"] }; }
        };
        opeRotateIX[oct_1.default("0046")] = {
            mnemonic: "SLA (IX+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IX + d; poke(adr, reg.SLA(peek(adr))); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["SLA", "(IX+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotateIY[oct_1.default("0046")] = {
            mnemonic: "SLA (IY+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IY + d; poke(adr, reg.SLA(peek(adr))); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["SLA", "(IY+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotate[oct_1.default("0050")] = {
            mnemonic: "SRA B",
            cycle: 8,
            proc: () => { setB(reg.SRA(getB())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "B"] }; }
        };
        opeRotate[oct_1.default("0051")] = {
            mnemonic: "SRA C",
            cycle: 8,
            proc: () => { setC(reg.SRA(getC())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "C"] }; }
        };
        opeRotate[oct_1.default("0052")] = {
            mnemonic: "SRA D",
            cycle: 8,
            proc: () => { setD(reg.SRA(getD())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "D"] }; }
        };
        opeRotate[oct_1.default("0053")] = {
            mnemonic: "SRA E",
            cycle: 8,
            proc: () => { setE(reg.SRA(getE())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "E"] }; }
        };
        opeRotate[oct_1.default("0054")] = {
            mnemonic: "SRA H",
            cycle: 8,
            proc: () => { setH(reg.SRA(getH())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "H"] }; }
        };
        opeRotate[oct_1.default("0055")] = {
            mnemonic: "SRA L",
            cycle: 8,
            proc: () => { setL(reg.SRA(getL())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "L"] }; }
        };
        opeRotate[oct_1.default("0057")] = {
            mnemonic: "SRA A",
            cycle: 8,
            proc: () => { setA(reg.SRA(getA())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "A"] }; }
        };
        opeRotate[oct_1.default("0056")] = {
            mnemonic: "SRA (HL)",
            cycle: 15,
            proc: () => { const adr = getHL(); poke(adr, reg.SRA(peek(adr))); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "(HL)"] }; }
        };
        opeRotateIX[oct_1.default("0056")] = {
            mnemonic: "SRA (IX+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IX + d; poke(adr, reg.SRA(peek(adr))); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["SRA", "(IX+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotateIY[oct_1.default("0056")] = {
            mnemonic: "SRA (IY+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IY + d; poke(adr, reg.SRA(peek(adr))); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["SRA", "(IY+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotate[oct_1.default("0070")] = {
            mnemonic: "SRL B",
            cycle: 8,
            proc: () => { setB(reg.SRL(getB())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "B"] }; }
        };
        opeRotate[oct_1.default("0071")] = {
            mnemonic: "SRL C",
            cycle: 8,
            proc: () => { setC(reg.SRL(getC())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "C"] }; }
        };
        opeRotate[oct_1.default("0072")] = {
            mnemonic: "SRL D",
            cycle: 8,
            proc: () => { setD(reg.SRL(getD())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "D"] }; }
        };
        opeRotate[oct_1.default("0073")] = {
            mnemonic: "SRL E",
            cycle: 8,
            proc: () => { setE(reg.SRL(getE())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "E"] }; }
        };
        opeRotate[oct_1.default("0074")] = {
            mnemonic: "SRL H",
            cycle: 8,
            proc: () => { setH(reg.SRL(getH())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "H"] }; }
        };
        opeRotate[oct_1.default("0075")] = {
            mnemonic: "SRL L",
            cycle: 8,
            proc: () => { setL(reg.SRL(getL())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "L"] }; }
        };
        opeRotate[oct_1.default("0077")] = {
            mnemonic: "SRL A",
            cycle: 8,
            proc: () => { setA(reg.SRL(getA())); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "A"] }; }
        };
        opeRotate[oct_1.default("0076")] = {
            mnemonic: "SRL (HL)",
            cycle: 15,
            proc: () => { const adr = getHL(); poke(adr, reg.SRL(peek(adr))); },
            disasm: (mem, addr) => { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "(HL)"] }; }
        };
        opeRotateIX[oct_1.default("0076")] = {
            mnemonic: "SRL (IX+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IX + d; poke(adr, reg.SRL(peek(adr))); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["SRL", `(IX${displacement})`]
                };
            }
        };
        opeRotateIY[oct_1.default("0076")] = {
            mnemonic: "SRL (IY+d)",
            cycle: 23,
            proc: (d) => { const adr = reg.IY + d; poke(adr, reg.SRL(peek(adr))); },
            disasm: (mem, addr) => {
                const d = mem.peek(addr + 2);
                const d8s = number_util_1.default.to8bitSigned(d);
                const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["SRL", `(IY${displacement})`]
                };
            }
        };
        opeMisc[oct_1.default("0157")] = {
            mnemonic: "RLD",
            cycle: 18,
            proc: () => {
                const adr = getHL();
                let n = peek(adr);
                const AH = getA() & 0xf0;
                const AL = getA() & 0x0f;
                const nH = (n >> 4) & 0x0f;
                const nL = (n >> 0) & 0x0f;
                setA(AH | nH);
                n = (nL << 4) | AL;
                poke(adr, n);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLD"]
                };
            }
        };
        opeMisc[oct_1.default("0147")] = {
            mnemonic: "RRD",
            cycle: 18,
            proc: () => {
                const adr = getHL();
                let n = peek(adr);
                const AH = getA() & 0xf0;
                const AL = getA() & 0x0F;
                const nH = (n >> 4) & 0x0f;
                const nL = (n >> 0) & 0x0f;
                setA(AH | nL);
                n = (AL << 4) | nH;
                poke(adr, n);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RRD"]
                };
            }
        };
        const reg8 = ["B", "C", "D", "E", "H", "L", "(HL)", "A"];
        for (let regI = 0; regI < reg8.length; regI++) {
            for (let bit = 0; bit < 8; bit++) {
                opeRotate[oct_1.default("0100") | (bit << 3) | regI] = {
                    mnemonic: "BIT " + bit + "," + reg8[regI],
                    cycle: (r => (r !== 6 ? 8 : 12))(regI),
                    proc: ((b, r) => {
                        if (r !== 6) {
                            return () => {
                                const value = reg["get" + reg8[r]]();
                                if ((value & (1 << b)) !== 0) {
                                    reg.clearFlagZ();
                                }
                                else {
                                    reg.setFlagZ();
                                }
                                reg.setFlagH();
                                reg.clearFlagN();
                            };
                        }
                        else {
                            return () => {
                                const adr = getHL();
                                const value = peek(adr);
                                if ((value & (1 << b)) !== 0) {
                                    reg.clearFlagZ();
                                }
                                else {
                                    reg.setFlagZ();
                                }
                                reg.setFlagH();
                                reg.clearFlagN();
                            };
                        }
                    })(bit, regI),
                    disasm: ((b, n) => {
                        return (mem, addr) => {
                            return {
                                code: [mem.peek(addr), mem.peek(addr + 1)],
                                mnemonic: ["BIT", b, n]
                            };
                        };
                    })(bit, reg8[regI])
                };
            }
        }
        const disasmBitBIdxD = (mem, addr, b, idx) => {
            const d = mem.peek(addr + 2);
            const d8s = number_util_1.default.to8bitSigned(d);
            const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
            return {
                code: [
                    peek(addr),
                    peek(addr + 1),
                    d,
                    peek(addr + 3),
                ],
                mnemonic: ["BIT", "" + b, `(${idx}${displacement})`],
            };
        };
        opeRotateIX[oct_1.default("0106")] = {
            mnemonic: "BIT 0,(IX+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IX + d) & (1 << 0)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 0, "IX"); }
        };
        opeRotateIX[oct_1.default("0116")] = {
            mnemonic: "BIT 1,(IX+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IX + d) & (1 << 1)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 1, "IX"); }
        };
        opeRotateIX[oct_1.default("0126")] = {
            mnemonic: "BIT 2,(IX+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IX + d) & (1 << 2)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 2, "IX"); }
        };
        opeRotateIX[oct_1.default("0136")] = {
            mnemonic: "BIT 3,(IX+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IX + d) & (1 << 3)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 3, "IX"); }
        };
        opeRotateIX[oct_1.default("0146")] = {
            mnemonic: "BIT 4,(IX+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IX + d) & (1 << 4)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 4, "IX"); }
        };
        opeRotateIX[oct_1.default("0156")] = {
            mnemonic: "BIT 5,(IX+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IX + d) & (1 << 5)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 5, "IX"); }
        };
        opeRotateIX[oct_1.default("0166")] = {
            mnemonic: "BIT 6,(IX+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IX + d) & (1 << 6)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 6, "IX"); }
        };
        opeRotateIX[oct_1.default("0176")] = {
            mnemonic: "BIT 7,(IX+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IX + d) & (1 << 7)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 7, "IX"); }
        };
        opeRotateIY[oct_1.default("0106")] = {
            mnemonic: "BIT 0,(IY+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IY + d) & (1 << 0)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 0, "IY"); }
        };
        opeRotateIY[oct_1.default("0116")] = {
            mnemonic: "BIT 1,(IY+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IY + d) & (1 << 1)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 1, "IY"); }
        };
        opeRotateIY[oct_1.default("0126")] = {
            mnemonic: "BIT 2,(IY+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IY + d) & (1 << 2)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 2, "IY"); }
        };
        opeRotateIY[oct_1.default("0136")] = {
            mnemonic: "BIT 3,(IY+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IY + d) & (1 << 3)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 3, "IY"); }
        };
        opeRotateIY[oct_1.default("0146")] = {
            mnemonic: "BIT 4,(IY+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IY + d) & (1 << 4)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 4, "IY"); }
        };
        opeRotateIY[oct_1.default("0156")] = {
            mnemonic: "BIT 5,(IY+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IY + d) & (1 << 5)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 5, "IY"); }
        };
        opeRotateIY[oct_1.default("0166")] = {
            mnemonic: "BIT 6,(IY+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IY + d) & (1 << 6)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 6, "IY"); }
        };
        opeRotateIY[oct_1.default("0176")] = {
            mnemonic: "BIT 7,(IY+d)",
            cycle: 20,
            proc: (d) => {
                if (peek(reg.IY + d) & (1 << 7)) {
                    reg.clearFlagZ();
                }
                else {
                    reg.setFlagZ();
                }
                reg.setFlagH();
                reg.clearFlagN();
            },
            disasm: (mem, addr) => { return disasmBitBIdxD(mem, addr, 7, "IY"); }
        };
        for (let regI = 0; regI < reg8.length; regI++) {
            for (let bit = 0; bit < 8; bit++) {
                opeRotate[oct_1.default("0300") | (bit << 3) | regI] = {
                    mnemonic: "SET " + bit + "," + reg8[regI],
                    cycle: ((r) => { return r !== 6 ? 4 : 15; })(regI),
                    proc: ((b, r) => {
                        if (r !== 6) {
                            return () => {
                                reg["set" + reg8[r]](reg["get" + reg8[r]]() | (1 << b));
                            };
                        }
                        else {
                            return () => {
                                const adr = getHL();
                                poke(adr, peek(adr) | (1 << b));
                            };
                        }
                    })(bit, regI),
                    disasm: ((b, n) => {
                        return (mem, addr) => {
                            return {
                                code: [mem.peek(addr), mem.peek(addr + 1)],
                                mnemonic: ["SET", b, n]
                            };
                        };
                    })(bit, reg8[regI])
                };
            }
        }
        const disasmSetBIdxD = (mem, addr, b, idx) => {
            const d = mem.peek(addr + 2);
            const d8s = number_util_1.default.to8bitSigned(d);
            const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
            return {
                code: [
                    peek(addr + 0),
                    peek(addr + 1),
                    d,
                    peek(addr + 3),
                ],
                mnemonic: ["SET", "" + b, `(${idx}${displacement})`],
            };
        };
        opeRotateIX[oct_1.default("0306")] = {
            mnemonic: "SET 0,(IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 0));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 0, "IX"); }
        };
        opeRotateIX[oct_1.default("0316")] = {
            mnemonic: "SET 1,(IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 1));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 1, "IX"); }
        };
        opeRotateIX[oct_1.default("0326")] = {
            mnemonic: "SET 2,(IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 2));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 2, "IX"); }
        };
        opeRotateIX[oct_1.default("0336")] = {
            mnemonic: "SET 3,(IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 3));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 3, "IX"); }
        };
        opeRotateIX[oct_1.default("0346")] = {
            mnemonic: "SET 4,(IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 4));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 4, "IX"); }
        };
        opeRotateIX[oct_1.default("0356")] = {
            mnemonic: "SET 5,(IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 5));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 5, "IX"); }
        };
        opeRotateIX[oct_1.default("0366")] = {
            mnemonic: "SET 6,(IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 6));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 6, "IX"); }
        };
        opeRotateIX[oct_1.default("0376")] = {
            mnemonic: "SET 7,(IX+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 7));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 7, "IX"); }
        };
        opeRotateIY[oct_1.default("0306")] = {
            mnemonic: "SET 0,(IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 0));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 0, "IY"); }
        };
        opeRotateIY[oct_1.default("0316")] = {
            mnemonic: "SET 1,(IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 1));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 1, "IY"); }
        };
        opeRotateIY[oct_1.default("0326")] = {
            mnemonic: "SET 2,(IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 2));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 2, "IY"); }
        };
        opeRotateIY[oct_1.default("0336")] = {
            mnemonic: "SET 3,(IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 3));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 3, "IY"); }
        };
        opeRotateIY[oct_1.default("0346")] = {
            mnemonic: "SET 4,(IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 4));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 4, "IY"); }
        };
        opeRotateIY[oct_1.default("0356")] = {
            mnemonic: "SET 5,(IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 5));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 5, "IY"); }
        };
        opeRotateIY[oct_1.default("0366")] = {
            mnemonic: "SET 6,(IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 6));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 6, "IY"); }
        };
        opeRotateIY[oct_1.default("0376")] = {
            mnemonic: "SET 7,(IY+d)",
            cycle: 23,
            proc: (d) => {
                const adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 7));
            },
            disasm: (mem, addr) => { return disasmSetBIdxD(mem, addr, 7, "IY"); }
        };
        const procRes8bit = (b, r) => {
            const bits = ~(1 << b);
            return () => {
                reg["set" + r](reg["get" + r]() & bits);
            };
        };
        const disaRes8bit = (b, r) => {
            const regidx = "BCDEHL A".indexOf(r);
            const bits = b << 3;
            return () => {
                return {
                    code: [0xCB, oct_1.default("0200") | bits | regidx],
                    mnemonic: ["RES", b, r]
                };
            };
        };
        const procResXHl = (b) => {
            const bits = (~(1 << b) & 0xff);
            return ((mask) => {
                return () => {
                    const adr = getHL();
                    const v0 = peek(adr);
                    const v1 = v0 & mask;
                    poke(adr, v1);
                };
            })(bits);
        };
        const disaResXHl = (b) => {
            const bits = b << 3;
            return ((mask) => {
                return () => {
                    return {
                        code: [0xCB, oct_1.default("0200") | mask | 6],
                        mnemonic: ["RES", b, "(HL)"]
                    };
                };
            })(bits);
        };
        const procResXIdxD = (b, IDX) => {
            const bits = 0xff & ~(1 << b);
            return ((mask) => {
                return (d) => {
                    const adr = reg[IDX] + d;
                    const v0 = peek(adr);
                    const v1 = v0 & mask;
                    poke(adr, v1);
                };
            })(bits);
        };
        const disaResXIdsD = (b, IDX) => {
            const opecode = { "IX": 0xDD, "IY": 0xFD }[IDX];
            return ((inst) => {
                return (mem, addr) => {
                    const d = mem.peek(addr + 2);
                    const d8s = number_util_1.default.to8bitSigned(d);
                    const displacement = `${d8s >= 0 ? "+" : ""}${d8s}`;
                    const feature = mem.peek(addr + 3);
                    return {
                        code: [inst, 0xCB, d, feature],
                        mnemonic: ["RES", b, `(${IDX}${displacement})`],
                    };
                };
            })(opecode);
        };
        opeRotate[oct_1.default("0200")] = { mnemonic: "RES 0,B", cycle: 8, proc: procRes8bit(0, "B"), disasm: disaRes8bit(0, "B") };
        opeRotate[oct_1.default("0210")] = { mnemonic: "RES 1,B", cycle: 8, proc: procRes8bit(1, "B"), disasm: disaRes8bit(1, "B") };
        opeRotate[oct_1.default("0220")] = { mnemonic: "RES 2,B", cycle: 8, proc: procRes8bit(2, "B"), disasm: disaRes8bit(2, "B") };
        opeRotate[oct_1.default("0230")] = { mnemonic: "RES 3,B", cycle: 8, proc: procRes8bit(3, "B"), disasm: disaRes8bit(3, "B") };
        opeRotate[oct_1.default("0240")] = { mnemonic: "RES 4,B", cycle: 8, proc: procRes8bit(4, "B"), disasm: disaRes8bit(4, "B") };
        opeRotate[oct_1.default("0250")] = { mnemonic: "RES 5,B", cycle: 8, proc: procRes8bit(5, "B"), disasm: disaRes8bit(5, "B") };
        opeRotate[oct_1.default("0260")] = { mnemonic: "RES 6,B", cycle: 8, proc: procRes8bit(6, "B"), disasm: disaRes8bit(6, "B") };
        opeRotate[oct_1.default("0270")] = { mnemonic: "RES 7,B", cycle: 8, proc: procRes8bit(7, "B"), disasm: disaRes8bit(7, "B") };
        opeRotate[oct_1.default("0201")] = { mnemonic: "RES 0,C", cycle: 8, proc: procRes8bit(0, "C"), disasm: disaRes8bit(0, "C") };
        opeRotate[oct_1.default("0211")] = { mnemonic: "RES 1,C", cycle: 8, proc: procRes8bit(1, "C"), disasm: disaRes8bit(1, "C") };
        opeRotate[oct_1.default("0221")] = { mnemonic: "RES 2,C", cycle: 8, proc: procRes8bit(2, "C"), disasm: disaRes8bit(2, "C") };
        opeRotate[oct_1.default("0231")] = { mnemonic: "RES 3,C", cycle: 8, proc: procRes8bit(3, "C"), disasm: disaRes8bit(3, "C") };
        opeRotate[oct_1.default("0241")] = { mnemonic: "RES 4,C", cycle: 8, proc: procRes8bit(4, "C"), disasm: disaRes8bit(4, "C") };
        opeRotate[oct_1.default("0251")] = { mnemonic: "RES 5,C", cycle: 8, proc: procRes8bit(5, "C"), disasm: disaRes8bit(5, "C") };
        opeRotate[oct_1.default("0261")] = { mnemonic: "RES 6,C", cycle: 8, proc: procRes8bit(6, "C"), disasm: disaRes8bit(6, "C") };
        opeRotate[oct_1.default("0271")] = { mnemonic: "RES 7,C", cycle: 8, proc: procRes8bit(7, "C"), disasm: disaRes8bit(7, "C") };
        opeRotate[oct_1.default("0202")] = { mnemonic: "RES 0,D", cycle: 8, proc: procRes8bit(0, "D"), disasm: disaRes8bit(0, "D") };
        opeRotate[oct_1.default("0212")] = { mnemonic: "RES 1,D", cycle: 8, proc: procRes8bit(1, "D"), disasm: disaRes8bit(1, "D") };
        opeRotate[oct_1.default("0222")] = { mnemonic: "RES 2,D", cycle: 8, proc: procRes8bit(2, "D"), disasm: disaRes8bit(2, "D") };
        opeRotate[oct_1.default("0232")] = { mnemonic: "RES 3,D", cycle: 8, proc: procRes8bit(3, "D"), disasm: disaRes8bit(3, "D") };
        opeRotate[oct_1.default("0242")] = { mnemonic: "RES 4,D", cycle: 8, proc: procRes8bit(4, "D"), disasm: disaRes8bit(4, "D") };
        opeRotate[oct_1.default("0252")] = { mnemonic: "RES 5,D", cycle: 8, proc: procRes8bit(5, "D"), disasm: disaRes8bit(5, "D") };
        opeRotate[oct_1.default("0262")] = { mnemonic: "RES 6,D", cycle: 8, proc: procRes8bit(6, "D"), disasm: disaRes8bit(6, "D") };
        opeRotate[oct_1.default("0272")] = { mnemonic: "RES 7,D", cycle: 8, proc: procRes8bit(7, "D"), disasm: disaRes8bit(7, "D") };
        opeRotate[oct_1.default("0203")] = { mnemonic: "RES 0,E", cycle: 8, proc: procRes8bit(0, "E"), disasm: disaRes8bit(0, "E") };
        opeRotate[oct_1.default("0213")] = { mnemonic: "RES 1,E", cycle: 8, proc: procRes8bit(1, "E"), disasm: disaRes8bit(1, "E") };
        opeRotate[oct_1.default("0223")] = { mnemonic: "RES 2,E", cycle: 8, proc: procRes8bit(2, "E"), disasm: disaRes8bit(2, "E") };
        opeRotate[oct_1.default("0233")] = { mnemonic: "RES 3,E", cycle: 8, proc: procRes8bit(3, "E"), disasm: disaRes8bit(3, "E") };
        opeRotate[oct_1.default("0243")] = { mnemonic: "RES 4,E", cycle: 8, proc: procRes8bit(4, "E"), disasm: disaRes8bit(4, "E") };
        opeRotate[oct_1.default("0253")] = { mnemonic: "RES 5,E", cycle: 8, proc: procRes8bit(5, "E"), disasm: disaRes8bit(5, "E") };
        opeRotate[oct_1.default("0263")] = { mnemonic: "RES 6,E", cycle: 8, proc: procRes8bit(6, "E"), disasm: disaRes8bit(6, "E") };
        opeRotate[oct_1.default("0273")] = { mnemonic: "RES 7,E", cycle: 8, proc: procRes8bit(7, "E"), disasm: disaRes8bit(7, "E") };
        opeRotate[oct_1.default("0204")] = { mnemonic: "RES 0,H", cycle: 8, proc: procRes8bit(0, "H"), disasm: disaRes8bit(0, "H") };
        opeRotate[oct_1.default("0214")] = { mnemonic: "RES 1,H", cycle: 8, proc: procRes8bit(1, "H"), disasm: disaRes8bit(1, "H") };
        opeRotate[oct_1.default("0224")] = { mnemonic: "RES 2,H", cycle: 8, proc: procRes8bit(2, "H"), disasm: disaRes8bit(2, "H") };
        opeRotate[oct_1.default("0234")] = { mnemonic: "RES 3,H", cycle: 8, proc: procRes8bit(3, "H"), disasm: disaRes8bit(3, "H") };
        opeRotate[oct_1.default("0244")] = { mnemonic: "RES 4,H", cycle: 8, proc: procRes8bit(4, "H"), disasm: disaRes8bit(4, "H") };
        opeRotate[oct_1.default("0254")] = { mnemonic: "RES 5,H", cycle: 8, proc: procRes8bit(5, "H"), disasm: disaRes8bit(5, "H") };
        opeRotate[oct_1.default("0264")] = { mnemonic: "RES 6,H", cycle: 8, proc: procRes8bit(6, "H"), disasm: disaRes8bit(6, "H") };
        opeRotate[oct_1.default("0274")] = { mnemonic: "RES 7,H", cycle: 8, proc: procRes8bit(7, "H"), disasm: disaRes8bit(7, "H") };
        opeRotate[oct_1.default("0205")] = { mnemonic: "RES 0,L", cycle: 8, proc: procRes8bit(0, "L"), disasm: disaRes8bit(0, "L") };
        opeRotate[oct_1.default("0215")] = { mnemonic: "RES 1,L", cycle: 8, proc: procRes8bit(1, "L"), disasm: disaRes8bit(1, "L") };
        opeRotate[oct_1.default("0225")] = { mnemonic: "RES 2,L", cycle: 8, proc: procRes8bit(2, "L"), disasm: disaRes8bit(2, "L") };
        opeRotate[oct_1.default("0235")] = { mnemonic: "RES 3,L", cycle: 8, proc: procRes8bit(3, "L"), disasm: disaRes8bit(3, "L") };
        opeRotate[oct_1.default("0245")] = { mnemonic: "RES 4,L", cycle: 8, proc: procRes8bit(4, "L"), disasm: disaRes8bit(4, "L") };
        opeRotate[oct_1.default("0255")] = { mnemonic: "RES 5,L", cycle: 8, proc: procRes8bit(5, "L"), disasm: disaRes8bit(5, "L") };
        opeRotate[oct_1.default("0265")] = { mnemonic: "RES 6,L", cycle: 8, proc: procRes8bit(6, "L"), disasm: disaRes8bit(6, "L") };
        opeRotate[oct_1.default("0275")] = { mnemonic: "RES 7,L", cycle: 8, proc: procRes8bit(7, "L"), disasm: disaRes8bit(7, "L") };
        opeRotate[oct_1.default("0207")] = { mnemonic: "RES 0,A", cycle: 8, proc: procRes8bit(0, "A"), disasm: disaRes8bit(0, "A") };
        opeRotate[oct_1.default("0217")] = { mnemonic: "RES 1,A", cycle: 8, proc: procRes8bit(1, "A"), disasm: disaRes8bit(1, "A") };
        opeRotate[oct_1.default("0227")] = { mnemonic: "RES 2,A", cycle: 8, proc: procRes8bit(2, "A"), disasm: disaRes8bit(2, "A") };
        opeRotate[oct_1.default("0237")] = { mnemonic: "RES 3,A", cycle: 8, proc: procRes8bit(3, "A"), disasm: disaRes8bit(3, "A") };
        opeRotate[oct_1.default("0247")] = { mnemonic: "RES 4,A", cycle: 8, proc: procRes8bit(4, "A"), disasm: disaRes8bit(4, "A") };
        opeRotate[oct_1.default("0257")] = { mnemonic: "RES 5,A", cycle: 8, proc: procRes8bit(5, "A"), disasm: disaRes8bit(5, "A") };
        opeRotate[oct_1.default("0267")] = { mnemonic: "RES 6,A", cycle: 8, proc: procRes8bit(6, "A"), disasm: disaRes8bit(6, "A") };
        opeRotate[oct_1.default("0277")] = { mnemonic: "RES 7,A", cycle: 8, proc: procRes8bit(7, "A"), disasm: disaRes8bit(7, "A") };
        opeRotate[oct_1.default("0206")] = { mnemonic: "RES 0,(HL)", cycle: 15, proc: procResXHl(0), disasm: disaResXHl(0) };
        opeRotate[oct_1.default("0216")] = { mnemonic: "RES 1,(HL)", cycle: 15, proc: procResXHl(1), disasm: disaResXHl(1) };
        opeRotate[oct_1.default("0226")] = { mnemonic: "RES 2,(HL)", cycle: 15, proc: procResXHl(2), disasm: disaResXHl(2) };
        opeRotate[oct_1.default("0236")] = { mnemonic: "RES 3,(HL)", cycle: 15, proc: procResXHl(3), disasm: disaResXHl(3) };
        opeRotate[oct_1.default("0246")] = { mnemonic: "RES 4,(HL)", cycle: 15, proc: procResXHl(4), disasm: disaResXHl(4) };
        opeRotate[oct_1.default("0256")] = { mnemonic: "RES 5,(HL)", cycle: 15, proc: procResXHl(5), disasm: disaResXHl(5) };
        opeRotate[oct_1.default("0266")] = { mnemonic: "RES 6,(HL)", cycle: 15, proc: procResXHl(6), disasm: disaResXHl(6) };
        opeRotate[oct_1.default("0276")] = { mnemonic: "RES 7,(HL)", cycle: 15, proc: procResXHl(7), disasm: disaResXHl(7) };
        opeRotateIX[oct_1.default("0206")] = { mnemonic: "RES 0,(IX+d)", cycle: 23, proc: procResXIdxD(0, "IX"), disasm: disaResXIdsD(0, "IX") };
        opeRotateIX[oct_1.default("0216")] = { mnemonic: "RES 1,(IX+d)", cycle: 23, proc: procResXIdxD(1, "IX"), disasm: disaResXIdsD(1, "IX") };
        opeRotateIX[oct_1.default("0226")] = { mnemonic: "RES 2,(IX+d)", cycle: 23, proc: procResXIdxD(2, "IX"), disasm: disaResXIdsD(2, "IX") };
        opeRotateIX[oct_1.default("0236")] = { mnemonic: "RES 3,(IX+d)", cycle: 23, proc: procResXIdxD(3, "IX"), disasm: disaResXIdsD(3, "IX") };
        opeRotateIX[oct_1.default("0246")] = { mnemonic: "RES 4,(IX+d)", cycle: 23, proc: procResXIdxD(4, "IX"), disasm: disaResXIdsD(4, "IX") };
        opeRotateIX[oct_1.default("0256")] = { mnemonic: "RES 5,(IX+d)", cycle: 23, proc: procResXIdxD(5, "IX"), disasm: disaResXIdsD(5, "IX") };
        opeRotateIX[oct_1.default("0266")] = { mnemonic: "RES 6,(IX+d)", cycle: 23, proc: procResXIdxD(6, "IX"), disasm: disaResXIdsD(6, "IX") };
        opeRotateIX[oct_1.default("0276")] = { mnemonic: "RES 7,(IX+d)", cycle: 23, proc: procResXIdxD(7, "IX"), disasm: disaResXIdsD(7, "IX") };
        opeRotateIY[oct_1.default("0206")] = { mnemonic: "RES 0,(IY+d)", cycle: 23, proc: procResXIdxD(0, "IY"), disasm: disaResXIdsD(0, "IY") };
        opeRotateIY[oct_1.default("0216")] = { mnemonic: "RES 1,(IY+d)", cycle: 23, proc: procResXIdxD(1, "IY"), disasm: disaResXIdsD(1, "IY") };
        opeRotateIY[oct_1.default("0226")] = { mnemonic: "RES 2,(IY+d)", cycle: 23, proc: procResXIdxD(2, "IY"), disasm: disaResXIdsD(2, "IY") };
        opeRotateIY[oct_1.default("0236")] = { mnemonic: "RES 3,(IY+d)", cycle: 23, proc: procResXIdxD(3, "IY"), disasm: disaResXIdsD(3, "IY") };
        opeRotateIY[oct_1.default("0246")] = { mnemonic: "RES 4,(IY+d)", cycle: 23, proc: procResXIdxD(4, "IY"), disasm: disaResXIdsD(4, "IY") };
        opeRotateIY[oct_1.default("0256")] = { mnemonic: "RES 5,(IY+d)", cycle: 23, proc: procResXIdxD(5, "IY"), disasm: disaResXIdsD(5, "IY") };
        opeRotateIY[oct_1.default("0266")] = { mnemonic: "RES 6,(IY+d)", cycle: 23, proc: procResXIdxD(6, "IY"), disasm: disaResXIdsD(6, "IY") };
        opeRotateIY[oct_1.default("0276")] = { mnemonic: "RES 7,(IY+d)", cycle: 23, proc: procResXIdxD(7, "IY"), disasm: disaResXIdsD(7, "IY") };
        const disaJumpGroup = (mem, addr) => {
            const opecode = mem.peek(addr);
            const code = [opecode];
            const mnemonic = [];
            let e;
            let n0;
            let n1;
            let refAddrTo = null;
            switch (opecode & oct_1.default("0300")) {
                case oct_1.default("0000"):
                    mnemonic.push("JR");
                    e = bin_util_1.default.getSignedByte(mem.peek(addr + 1));
                    refAddrTo = addr + e + 2;
                    code.push(e & 0xff);
                    if (e + 2 >= 0) {
                        e = "+" + (e + 2);
                    }
                    else {
                        e = "" + (e + 2);
                    }
                    switch (opecode & oct_1.default("0070")) {
                        case oct_1.default("0030"): break;
                        case oct_1.default("0070"):
                            mnemonic.push("C");
                            break;
                        case oct_1.default("0050"):
                            mnemonic.push("Z");
                            break;
                        case oct_1.default("0060"):
                            mnemonic.push("NC");
                            break;
                        case oct_1.default("0040"):
                            mnemonic.push("NZ");
                            break;
                        default:
                            throw "UNKNOWN OPCODE";
                    }
                    mnemonic.push(number_util_1.default.HEX(refAddrTo, 4) + 'H;(' + e + ')');
                    break;
                case oct_1.default("0300"):
                    mnemonic.push("JP");
                    switch (opecode & oct_1.default("0003")) {
                        case 1:
                            mnemonic.push("(HL)");
                            break;
                        case 2:
                            n0 = mem.peek(addr + 1);
                            n1 = mem.peek(addr + 2);
                            refAddrTo = bin_util_1.default.pair(n1, n0);
                            code.push(n0);
                            code.push(n1);
                            switch (opecode & oct_1.default("0070")) {
                                case oct_1.default("0000"):
                                    mnemonic.push("NZ");
                                    break;
                                case oct_1.default("0010"):
                                    mnemonic.push("Z");
                                    break;
                                case oct_1.default("0020"):
                                    mnemonic.push("NC");
                                    break;
                                case oct_1.default("0030"):
                                    mnemonic.push("C");
                                    break;
                                case oct_1.default("0040"):
                                    mnemonic.push("PO");
                                    break;
                                case oct_1.default("0050"):
                                    mnemonic.push("PE");
                                    break;
                                case oct_1.default("0060"):
                                    mnemonic.push("P");
                                    break;
                                case oct_1.default("0070"):
                                    mnemonic.push("M");
                                    break;
                            }
                            mnemonic.push(number_util_1.default.HEX(n1, 2) + number_util_1.default.HEX(n0, 2) + 'H');
                            break;
                        case 3:
                            n0 = mem.peek(addr + 1);
                            n1 = mem.peek(addr + 2);
                            refAddrTo = bin_util_1.default.pair(n1, n0);
                            code.push(n0);
                            code.push(n1);
                            mnemonic.push(number_util_1.default.HEX(n1, 2) + number_util_1.default.HEX(n0, 2) + 'H');
                            break;
                    }
                    break;
                default:
                    throw "UNKNOWN OPCODE";
            }
            return { code, mnemonic, refAddrTo };
        };
        this.opecodeTable[oct_1.default("0303")] = {
            mnemonic: "JP nn",
            "cycle": 10,
            proc: () => { const nn = fetchPair(); reg.PC = nn; },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0302")] = {
            mnemonic: "JP NZ,nn",
            "cycle": 10,
            proc: () => {
                const nn = fetchPair();
                if (!reg.flagZ()) {
                    reg.PC = nn;
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0312")] = {
            mnemonic: "JP Z,nn",
            "cycle": 10,
            proc: () => {
                const nn = fetchPair();
                if (reg.flagZ()) {
                    reg.PC = nn;
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0322")] = {
            mnemonic: "JP NC,nn",
            "cycle": 10,
            proc: () => {
                const nn = fetchPair();
                if (!reg.flagC()) {
                    reg.PC = nn;
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0332")] = {
            mnemonic: "JP C,nn",
            "cycle": 10,
            proc: () => {
                const nn = fetchPair();
                if (reg.flagC()) {
                    reg.PC = nn;
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0342")] = {
            mnemonic: "JP PO,nn",
            "cycle": 10,
            proc: () => {
                const nn = fetchPair();
                if (!reg.flagP()) {
                    reg.PC = nn;
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0352")] = {
            mnemonic: "JP PE,nn",
            "cycle": 10,
            proc: () => {
                const nn = fetchPair();
                if (reg.flagP()) {
                    reg.PC = nn;
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0362")] = {
            mnemonic: "JP P,nn",
            "cycle": 10,
            proc: () => {
                const nn = fetchPair();
                if (!reg.flagS()) {
                    reg.PC = nn;
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0372")] = {
            mnemonic: "JP M,nn",
            "cycle": 10,
            proc: () => {
                const nn = fetchPair();
                if (reg.flagS()) {
                    reg.PC = nn;
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0030")] = {
            mnemonic: "JR e",
            "cycle": 12,
            proc: () => { const e = fetch(); reg.jumpRel(e); },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0070")] = {
            mnemonic: "JR C,e",
            "cycle": 12,
            proc: () => {
                const e = fetch();
                if (reg.flagC()) {
                    reg.jumpRel(e);
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0050")] = {
            mnemonic: "JR Z,e",
            "cycle": 12,
            proc: () => {
                const e = fetch();
                if (reg.flagZ()) {
                    reg.jumpRel(e);
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0060")] = {
            mnemonic: "JR NC,e",
            "cycle": 12,
            proc: () => {
                const e = fetch();
                if (!reg.flagC()) {
                    reg.jumpRel(e);
                }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0040")] = {
            mnemonic: "JR NZ,e",
            proc: () => {
                const e = fetch();
                if (!reg.flagZ()) {
                    reg.jumpRel(e);
                }
            },
            "cycle": 12,
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct_1.default("0351")] = {
            mnemonic: "JP (HL)",
            "cycle": 4,
            proc: () => { reg.PC = getHL(); },
            disasm: disaJumpGroup
        };
        opeIX[oct_1.default("0351")] = {
            mnemonic: "JP (IX)",
            "cycle": 8,
            proc: () => { reg.PC = reg.IX; },
            disasm: (mem, addr) => {
                return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ['JP', '(IX)'] };
            }
        };
        opeIY[oct_1.default("0351")] = {
            mnemonic: "JP (IY)",
            "cycle": 8,
            proc: () => { reg.PC = reg.IY; },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ['JP', '(IY)']
                };
            }
        };
        opeIX[oct_1.default("0104")] = {
            mnemonic: "LD B,IXH",
            proc: () => {
                setB(((reg.IX >> 8) & 0xff));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "B", "IXH"]
                };
            }
        };
        opeIX[oct_1.default("0115")] = {
            mnemonic: "LD C,IXL",
            proc: () => {
                setC((reg.IX & 0xff));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "C", "IXL"]
                };
            }
        };
        opeIX[oct_1.default("0140")] = {
            mnemonic: "LD IXH,B",
            proc: () => {
                reg.IX = (0xff00 & (getB() << 8)) | (reg.IX & 0xff);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "IXH", "B"]
                };
            }
        };
        opeIX[oct_1.default("0147")] = {
            mnemonic: "LD IXH,A",
            proc: () => {
                reg.IX = (0xff00 & (getA() << 8)) | (reg.IX & 0xff);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "IXH", "A"]
                };
            }
        };
        opeIX[oct_1.default("0151")] = {
            mnemonic: "LD IXL,C",
            proc: () => {
                reg.IX = (0xff00 & reg.IX) | (getC() & 0xff);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "IXL", "C"]
                };
            }
        };
        opeIX[oct_1.default("0157")] = {
            mnemonic: "LD IXL,A",
            proc: () => {
                reg.IX = (0xff00 & reg.IX) | (getA() & 0xff);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "IXL", "A"]
                };
            }
        };
        opeIX[oct_1.default("0175")] = {
            mnemonic: "LD A,IXL",
            proc: () => {
                setA((reg.IX & 0xff));
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "A", "IXL"]
                };
            }
        };
        opeIX[oct_1.default("0204")] = {
            mnemonic: "ADD A,IXH",
            proc: () => {
                reg.addAcc((reg.IX >> 8) & 0xff);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADD", "A", "IXH"]
                };
            }
        };
        opeIX[oct_1.default("0205")] = {
            mnemonic: "ADD A,IXL",
            proc: () => {
                reg.addAcc(reg.IX & 0xff);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADD", "A", "IXL"]
                };
            }
        };
        opeIX[oct_1.default("0275")] = {
            mnemonic: "CP IXL",
            proc: () => {
                reg.compareAcc(reg.IX & 0xff);
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["CP", "IXL"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0020")] = {
            mnemonic: "DJNZ",
            "cycle": 13,
            proc: () => {
                const e = fetch();
                reg.decrement("B");
                if (getB()) {
                    reg.jumpRel(e);
                }
            },
            disasm: (mem, addr) => {
                const e = bin_util_1.default.getSignedByte(mem.peek(addr + 1));
                const refAddrTo = addr + e + 2;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ['DJNZ', number_util_1.default.HEX(refAddrTo, 4) + 'H;(' + (((e + 2 >= 0) ? "+" : "") + (e + 2)) + ')'],
                    refAddrTo,
                };
            }
        };
        this.opecodeTable[oct_1.default("0315")] = {
            mnemonic: "CALL nn",
            cycle: 17,
            proc: () => {
                const nn = fetchPair();
                pushPair(reg.PC);
                reg.PC = nn;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "" + number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0304")] = {
            mnemonic: "CALL NZ,nn",
            cycle: "NZ→17,Z→10",
            proc: () => {
                const nn = fetchPair();
                if (!reg.flagZ()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "NZ", number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0314")] = {
            mnemonic: "CALL Z,nn",
            cycle: "Z→17,NZ→10",
            proc: () => {
                const nn = fetchPair();
                if (reg.flagZ()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "Z", number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0324")] = {
            mnemonic: "CALL NC,nn",
            cycle: "NC→17, C→10",
            proc: () => {
                const nn = fetchPair();
                if (!reg.flagC()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "NC", number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0334")] = {
            mnemonic: "CALL C,nn",
            cycle: "C→17, NC→10",
            proc: () => {
                const nn = fetchPair();
                if (reg.flagC()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "C", number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0344")] = {
            mnemonic: "CALL PO,nn",
            cycle: "Parity Odd→17, Even→10",
            proc: () => {
                const nn = fetchPair();
                if (!reg.flagP()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "PO", number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0354")] = {
            mnemonic: "CALL PE,nn",
            cycle: "Parity Even→17, Odd→10",
            proc: () => {
                const nn = fetchPair();
                if (reg.flagP()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "PE", number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0364")] = {
            mnemonic: "CALL P,nn",
            cycle: "P→17, M→10",
            proc: () => {
                const nn = fetchPair();
                if (!reg.flagS()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "P", number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0374")] = {
            mnemonic: "CALL M,nn",
            cycle: "M→17, P→10",
            proc: () => {
                const nn = fetchPair();
                if (reg.flagS()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: (m, a) => {
                const l = m.peek(a + 1);
                const h = m.peek(a + 2);
                const addr = bin_util_1.default.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "M", number_util_1.default.HEX(addr, 4) + "H"],
                    refAddrTo: addr
                };
            }
        };
        this.opecodeTable[oct_1.default("0311")] = {
            mnemonic: "RET",
            "cycle": 10,
            proc: () => { reg.PC = popPair(); },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0300")] = {
            mnemonic: "RET NZ",
            "cycle": "NZ→11, Z→5",
            proc: () => {
                if (!reg.flagZ()) {
                    reg.PC = popPair();
                    return 11;
                }
                return 5;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "NZ"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0310")] = {
            mnemonic: "RET Z",
            "cycle": "Z→5, NZ→11",
            proc: () => {
                if (reg.flagZ()) {
                    reg.PC = popPair();
                    return 11;
                }
                return 5;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "Z"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0320")] = {
            mnemonic: "RET NC",
            "cycle": "NC→11,C→5",
            proc: () => {
                if (!reg.flagC()) {
                    reg.PC = popPair();
                    return 11;
                }
                return 5;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "NC"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0330")] = {
            mnemonic: "RET C",
            "cycle": "C→11,NC→5",
            proc: () => {
                if (reg.flagC()) {
                    reg.PC = popPair();
                    return 11;
                }
                return 5;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "C"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0340")] = {
            mnemonic: "RET PO",
            "cycle": "Parity Odd→11, Parity Even→5",
            proc: () => {
                if (!reg.flagP()) {
                    reg.PC = popPair();
                    return 11;
                }
                return 5;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "PO"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0350")] = {
            mnemonic: "RET PE",
            "cycle": "Parity Even→11, Parity Odd→5",
            proc: () => {
                if (reg.flagP()) {
                    reg.PC = popPair();
                    return 11;
                }
                return 5;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "PE"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0360")] = {
            mnemonic: "RET P",
            "cycle": "P→11, M→5",
            proc: () => {
                if (!reg.flagS()) {
                    reg.PC = popPair();
                    return 11;
                }
                return 5;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "P"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0370")] = {
            mnemonic: "RET M",
            "cycle": "M→11, P→5",
            proc: () => {
                if (reg.flagS()) {
                    reg.PC = popPair();
                    return 11;
                }
                return 5;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "M"]
                };
            }
        };
        opeMisc[oct_1.default("0115")] = {
            mnemonic: "RETI",
            "cycle": 15,
            proc: () => {
                reg.PC = popPair();
                this.IFF1 = this.IFF2;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a), m.peek(a + 1)],
                    mnemonic: ["RETI"]
                };
            }
        };
        opeMisc[oct_1.default("0105")] = {
            mnemonic: "RETN",
            "cycle": 14,
            proc: () => {
                reg.PC = popPair();
                this.IFF1 = this.IFF2;
            },
            disasm: (m, a) => {
                return {
                    code: [m.peek(a), m.peek(a + 1)],
                    mnemonic: ["RETN"]
                };
            }
        };
        const rstVt = [0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38];
        for (let rstI = 0; rstI < rstVt.length; rstI++) {
            this.opecodeTable[oct_1.default("0307") | (rstI << 3)] = {
                mnemonic: "RST " + number_util_1.default.HEX(rstVt[rstI], 2) + "H",
                proc: ((vec) => {
                    return () => {
                        pushPair(reg.PC);
                        reg.PC = vec;
                    };
                })(rstVt[rstI]),
                "cycle": 12,
                disasm: ((vect) => {
                    return (mem, addr) => {
                        return {
                            code: [mem.peek(addr)],
                            mnemonic: ["RST", number_util_1.default.HEX(vect, 2) + "H"]
                        };
                    };
                })(rstVt[rstI])
            };
        }
        this.opecodeTable[oct_1.default("0333")] = {
            mnemonic: "IN A,(n)",
            cycle: 11,
            proc: () => { setA(this.readIoPort(fetch())); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [0xdb, n],
                    mnemonic: ["IN", "A", `(${number_util_1.default.HEX(n, 2)}H)`],
                };
            }
        };
        opeMisc[oct_1.default("0100")] = {
            mnemonic: "IN B,(C)",
            cycle: 12,
            proc: () => { setB(this.readIoPort(getC())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "B", "(C)"]
                };
            }
        };
        opeMisc[oct_1.default("0110")] = {
            mnemonic: "IN C,(C)",
            cycle: 12,
            proc: () => { setC(this.readIoPort(getC())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "C", "(C)"]
                };
            }
        };
        opeMisc[oct_1.default("0120")] = {
            mnemonic: "IN D,(C)",
            cycle: 12,
            proc: () => { setD(this.readIoPort(getC())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "D", "(C)"]
                };
            }
        };
        opeMisc[oct_1.default("0130")] = {
            mnemonic: "IN E,(C)",
            cycle: 12,
            proc: () => { setE(this.readIoPort(getC())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "E", "(C)"]
                };
            }
        };
        opeMisc[oct_1.default("0140")] = {
            mnemonic: "IN H,(C)",
            cycle: 12,
            proc: () => { setH(this.readIoPort(getC())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "H", "(C)"]
                };
            }
        };
        opeMisc[oct_1.default("0150")] = {
            mnemonic: "IN L,(C)",
            cycle: 12,
            proc: () => { setL(this.readIoPort(getC())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "L", "(C)"]
                };
            }
        };
        opeMisc[oct_1.default("0170")] = {
            mnemonic: "IN A,(C)",
            cycle: 12,
            proc: () => { setA(this.readIoPort(getC())); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "A", "(C)"]
                };
            }
        };
        opeMisc[oct_1.default("0242")] = {
            mnemonic: "INI",
            cycle: 16,
            proc: () => {
                setB((getB() - 1) & 0xff);
                poke(getHL(), this.readIoPort(getC()));
                reg.postINI();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INI"]
                };
            }
        };
        opeMisc[oct_1.default("0262")] = {
            mnemonic: "INIR",
            cycle: "21 x reg B",
            proc: () => {
                setB((getB() - 1) & 0xff);
                poke(getHL(), this.readIoPort(getC()));
                reg.postINI();
                if (getB() !== 0) {
                    reg.PC -= 2;
                }
                return 21;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INIR"]
                };
            }
        };
        opeMisc[oct_1.default("0252")] = {
            mnemonic: "IND",
            cycle: 16,
            proc: () => {
                setB((getB() - 1) & 0xff);
                poke(getHL(), this.readIoPort(getC()));
                reg.postIND();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IND"]
                };
            }
        };
        opeMisc[oct_1.default("0272")] = {
            mnemonic: "INDR",
            cycle: "21 x reg B",
            proc: () => {
                setB((getB() - 1) & 0xff);
                poke(getHL(), this.readIoPort(getC()));
                reg.postIND();
                if (getB() !== 0) {
                    reg.PC -= 2;
                }
                return 21;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INDR"]
                };
            }
        };
        this.opecodeTable[oct_1.default("0323")] = {
            mnemonic: "OUT (n),A",
            cycle: 11,
            proc: () => { this.writeIoPort(fetch(), getA()); },
            disasm: (mem, addr) => {
                const n = mem.peek(addr + 1);
                return {
                    code: [0xd3, n],
                    mnemonic: ["OUT", `(${number_util_1.default.HEX(n, 2)}H)`, "A"],
                };
            }
        };
        opeMisc[oct_1.default("0101")] = {
            mnemonic: "OUT (C),B",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getB()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "B"]
                };
            }
        };
        opeMisc[oct_1.default("0111")] = {
            mnemonic: "OUT (C),C",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getC()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "C"]
                };
            }
        };
        opeMisc[oct_1.default("0121")] = {
            mnemonic: "OUT (C),D",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getD()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "D"]
                };
            }
        };
        opeMisc[oct_1.default("0131")] = {
            mnemonic: "OUT (C),E",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getE()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "E"]
                };
            }
        };
        opeMisc[oct_1.default("0141")] = {
            mnemonic: "OUT (C),H",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getH()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "H"]
                };
            }
        };
        opeMisc[oct_1.default("0151")] = {
            mnemonic: "OUT (C),L",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getL()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "L"]
                };
            }
        };
        opeMisc[oct_1.default("0171")] = {
            mnemonic: "OUT (C),A",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getA()); },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "A"]
                };
            }
        };
        opeMisc[oct_1.default("0243")] = {
            mnemonic: "OUTI",
            cycle: 16,
            proc: () => {
                setB((getB() - 1) & 0xff);
                this.writeIoPort(getC(), peek(getHL()));
                reg.postOUTI();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUTI"]
                };
            }
        };
        opeMisc[oct_1.default("0263")] = {
            mnemonic: "OTIR",
            cycle: "21 x reg B",
            proc: () => {
                setB((getB() - 1) & 0xff);
                this.writeIoPort(getC(), peek(getHL()));
                reg.postOUTI();
                if (getB() !== 0) {
                    reg.PC -= 2;
                }
                return 21;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OTIR"]
                };
            }
        };
        opeMisc[oct_1.default("0253")] = {
            mnemonic: "OUTD",
            cycle: 16,
            proc: () => {
                setB((getB() - 1) & 0xff);
                this.writeIoPort(getC(), peek(getHL()));
                reg.postOUTD();
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUTD"]
                };
            }
        };
        opeMisc[oct_1.default("0273")] = {
            mnemonic: "OTDR",
            cycle: "21 x reg B",
            proc: () => {
                setB((getB() - 1) & 0xff);
                this.writeIoPort(getC(), peek(getHL()));
                reg.postOUTD();
                if (getB() !== 0) {
                    reg.PC -= 2;
                }
                return 21;
            },
            disasm: (mem, addr) => {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OTDR"]
                };
            }
        };
    }
    onReadIoPort(port, handler) {
        this._onReadIoPort[port] = handler;
    }
    onWriteIoPort(port, handler) {
        this._onWriteIoPort[port] = handler;
    }
    static dasm(buf, offset, size, addr) {
        offset = offset || 0;
        size = size || buf.length - offset;
        addr = addr || 0;
        if (addr - offset < 0) {
            console.error("Z80.dasm: parameter error : (addr - offset) - out of range");
            return;
        }
        if (size < 0 || offset + size > buf.length) {
            console.error("Z80.dasm: parameter error : size - out of range");
            return;
        }
        const dasmlist = [];
        const memoryBlock = new memory_block_1.default();
        memoryBlock.create({ startAddr: addr - offset, size });
        memoryBlock.mem = buf;
        const cpu = new Z80({ memory: memoryBlock });
        cpu.reg.PC = memoryBlock.startAddr;
        const orgInst = Z80_line_assembler_1.default.create("ORG", number_util_1.default.HEX(memoryBlock.startAddr, 4) + "H");
        orgInst.setAddress(memoryBlock.startAddr),
            dasmlist.push(orgInst);
        while (cpu.reg.PC < memoryBlock.startAddr + memoryBlock.size) {
            const dis = cpu.disassemble(cpu.reg.PC, addr - offset + size);
            dis.setAddress(cpu.reg.PC);
            if (dis.bytecode.length > 0) {
                dis.setComment('; ' + number_util_1.default.HEX(dis.address, 4) + "H " +
                    dis.bytecode.map((b) => {
                        return number_util_1.default.HEX(b, 2);
                    }).join(" "));
            }
            dasmlist.push(dis);
            cpu.reg.PC += dis.bytecode.length;
        }
        return Z80.processAddressReference(dasmlist);
    }
    static processAddressReference(dasmlist) {
        const addr2line = {};
        dasmlist.forEach((dis, lineno) => {
            addr2line[dis.address] = lineno;
        });
        dasmlist.forEach((dis, i, arr) => {
            if (dis.refAddrTo != null && dis.refAddrTo in addr2line) {
                const lineno = addr2line[dis.refAddrTo];
                arr[lineno].refCount++;
            }
        });
        dasmlist.forEach((dis, i, arr) => {
            if (dis.refCount > 0) {
                arr[i].setLabel("$" + number_util_1.default.HEX(dis.address, 4) + "H");
            }
        });
        return dasmlist;
    }
    static dasmlines(dasmlist) {
        return dasmlist.map((dis) => {
            let addr;
            if (dis.refCount > 0) {
                addr = "L" + number_util_1.default.HEX(dis.address, 4) + "H:";
            }
            else {
                addr = "       ";
            }
            addr += "   ";
            let mne = dis.mnemonic || "";
            const operand = dis.operand || "";
            if (mne && operand) {
                while (mne.length < 8) {
                    mne += " ";
                }
            }
            let line = addr + '      ' + mne + operand;
            if (mne || operand) {
                while (line.length < 40) {
                    line += ' ';
                }
            }
            if (dis.comment !== "") {
                if (dis.refCount === 0 && !mne && !operand) {
                    line = dis.comment;
                }
                else {
                    line += dis.comment;
                }
            }
            return line.replace(/\s*$/, "");
        });
    }
}
exports.default = Z80;
Z80.exec = function () {
    this.reg.R = (this.reg.R + 1) & 255;
    const instruction = this.opecodeTable[this.fetch()];
    const cycle = instruction.proc() || instruction.cycle || 4;
    this.consumedTCycle += cycle;
    if (this.bpmap[this.reg.PC] != null) {
        console.log("*** BREAK AT $" + number_util_1.default.HEX(this.reg.PC, 4));
        throw "break";
    }
};
module.exports = Z80;

},{"../lib/number-util":27,"../lib/oct":28,"./Z80-line-assembler":6,"./bin-util":8,"./memory-block":13,"./register":14}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Z80BinUtil {
    static pair(h, l) {
        return ((0xff & h) << 8) + (0xff & l);
    }
    static hibyte(nn) {
        return (nn >> 8) & 0xff;
    }
    static lobyte(nn) {
        return nn & 0xff;
    }
    static getSignedByte(e) {
        e = e & 0xff;
        if (e & 0x80) {
            e = ((~e) & 0xff) + 1;
            return -e;
        }
        return e;
    }
}
exports.default = Z80BinUtil;
module.exports = Z80BinUtil;

},{}],9:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bin_util_js_1 = __importDefault(require("./bin-util.js"));
class IMem {
    constructor() {
    }
    create(opt) {
        opt = opt || {};
        this.size = opt.size || 0x10000;
        this.startAddr = opt.startAddr || 0;
        if (this.startAddr < 0 || this.startAddr > 0xffff) {
            throw new Error("Invalid start address of memory");
        }
        if (this.size < 0) {
            throw new Error("Invalid memory size");
        }
        if (this.startAddr + this.size > 0x10000) {
            throw new Error("Invalid combination of start address and memory size.");
        }
    }
    peekByte(address) {
        const msg = "Error: abstruct pokeByte was invoked." +
            `This method must be overrided by the class ${this.constructor.name}`;
        console.error(msg);
        throw new Error(msg);
        return 0;
    }
    pokeByte(address, value) {
        const msg = "Error: abstruct pokeByte was invoked." +
            `This method must be overrided by the class ${this.constructor.name}`;
        console.error(msg);
        throw new Error(msg);
    }
    clear() {
        for (let i = 0; i < this.size; i++) {
            this.pokeByte(i, 0);
        }
    }
    peek(address) {
        return this.peekByte(address);
    }
    poke(address, value) {
        this.pokeByte(address, value);
    }
    peekPair(address) {
        return bin_util_js_1.default.pair(this.peek(address + 1), this.peek(address + 0));
    }
}
exports.default = IMem;
module.exports = IMem;

},{"./bin-util.js":8}],10:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const imem_js_1 = __importDefault(require("./imem.js"));
class MemoryBank extends imem_js_1.default {
    constructor(opt) {
        super();
        this.create(opt);
    }
    create(opt) {
        super.create(opt);
        this.mem = new Array(this.size);
        this.memblk = new Map();
    }
    setMemoryBlock(name, memblk) {
        if (memblk == null) {
            if (this.memblk.has(name)) {
                const mem = this.memblk.get(name);
                const size = mem.size;
                const startAddr = mem.startAddr;
                const endAddr = startAddr + size;
                const nullMem = { peek: () => 0, poke: () => { } };
                for (let j = startAddr; j < endAddr; j++) {
                    this.mem[j] = nullMem;
                }
                this.memblk.delete(name);
            }
        }
        else {
            this.memblk.set(name, memblk);
            const mem = this.memblk.get(name);
            const size = mem.size;
            const startAddr = mem.startAddr;
            const endAddr = startAddr + size;
            for (let j = startAddr; j < endAddr; j++) {
                this.mem[j] = memblk;
            }
        }
    }
    peekByte(address) {
        return (this.mem[address - this.startAddr]).peek(address) & 0xff;
    }
    pokeByte(address, value) {
        (this.mem[address - this.startAddr]).poke(address, value & 0xff);
    }
}
exports.default = MemoryBank;
module.exports = MemoryBank;

},{"./imem.js":9}],11:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const memory_block_cbw_1 = __importDefault(require("./memory-block-cbw"));
class MemoryBlockCbrw extends memory_block_cbw_1.default {
    constructor(opt) {
        super(opt);
        this.onPeek = (addr, value) => (0);
        if (opt.onPeek) {
            this.onPeek = opt.onPeek;
        }
    }
    peek(address) {
        const value = super.peekByte(address);
        const override = this.onPeek(address, value);
        if (override != null && override !== undefined) {
            return override;
        }
        return value;
    }
}
exports.default = MemoryBlockCbrw;
module.exports = MemoryBlockCbrw;

},{"./memory-block-cbw":12}],12:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const memory_block_1 = __importDefault(require("./memory-block"));
class MemoryBlockCbw extends memory_block_1.default {
    constructor(opt) {
        super(opt);
        this.onPoke = (addr, value) => { };
        if (opt.onPoke) {
            this.onPoke = opt.onPoke;
        }
    }
    poke(address, value) {
        super.pokeByte(address, value);
        this.onPoke(address, this.peekByte(address));
    }
}
exports.default = MemoryBlockCbw;
module.exports = MemoryBlockCbw;

},{"./memory-block":13}],13:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const imem_1 = __importDefault(require("./imem"));
class MemoryBlock extends imem_1.default {
    constructor(opt) {
        super();
        super.create(opt);
        this.mem = new Array(this.size);
    }
    peekByte(address) {
        return this.mem[address - this.startAddr];
    }
    pokeByte(address, value) {
        this.mem[address - this.startAddr] = value;
    }
}
exports.default = MemoryBlock;
module.exports = MemoryBlock;

},{"./imem":9}],14:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const number_util_1 = __importDefault(require("../lib/number-util"));
const bin_util_1 = __importDefault(require("./bin-util"));
class Z80_Register {
    constructor() {
        const heap = new ArrayBuffer(64 * 1024);
        this._flagTable = new Uint8Array(heap);
        this._PTableIndex = 0;
        this._ZSTableIndex = 512;
        this._ZSPTableIndex = 1024;
        this.initTable();
        this.clear();
        this._B = 0;
        this._C = 0;
        this._D = 0;
        this._E = 0;
        this._H = 0;
        this._L = 0;
        this._A = 0;
        this._F = 0;
        this.PC = 0;
        this.SP = 0;
        this.IX = 0;
        this.IY = 0;
        this.R = 0;
        this.I = 0;
    }
    ;
    initTable() {
        const setPTable = (idx, value) => {
            this._flagTable[this._PTableIndex + idx] = value;
        };
        const getPTable = (idx) => {
            return this._flagTable[this._PTableIndex + idx];
        };
        const setZSTable = (idx, value) => {
            this._flagTable[this._ZSTableIndex + idx] = value;
        };
        const setZSPTable = (idx, value) => {
            this._flagTable[this._ZSPTableIndex + idx] = value;
        };
        let i = 0;
        let zs = 0;
        let p = 0;
        for (i = 0; i < 256; i++) {
            zs = 0;
            if (i === 0) {
                zs = zs | Z80_Register.Z_FLAG;
            }
            if (i & 0x80) {
                zs = zs | Z80_Register.S_FLAG;
            }
            p = 0;
            if ((i & 1) !== 0) {
                p = p + 1;
            }
            if ((i & 2) !== 0) {
                p = p + 1;
            }
            if ((i & 4) !== 0) {
                p = p + 1;
            }
            if ((i & 8) !== 0) {
                p = p + 1;
            }
            if ((i & 16) !== 0) {
                p = p + 1;
            }
            if ((i & 32) !== 0) {
                p = p + 1;
            }
            if ((i & 64) !== 0) {
                p = p + 1;
            }
            if ((i & 128) !== 0) {
                p = p + 1;
            }
            setPTable(i, ((p & 1) ? 0 : Z80_Register.V_FLAG));
            setZSTable(i, zs);
            setZSPTable(i, zs | getPTable(i));
        }
        for (i = 0; (i) < 256; i = ((i) + 1)) {
            setZSTable(i + 256, this.getZSTable(i) | Z80_Register.C_FLAG);
            setZSPTable(i + 256, this.getZSPTable(i) | Z80_Register.C_FLAG);
            setPTable(i + 256, getPTable(i) | Z80_Register.C_FLAG);
        }
    }
    pair(h, l) {
        return ((0xff & h) << 8) + (0xff & l);
    }
    hi8(nn) {
        return (nn >> 8) & 0xff;
    }
    lo8(nn) {
        return nn & 0xff;
    }
    setB(n) { n = n; this._B = (n & 0xff); }
    getB() { return this._B; }
    setC(n) { n = n; this._C = (n & 0xff); }
    getC() { return this._C; }
    setD(n) { n = n; this._D = (n & 0xff); }
    getD() { return this._D; }
    setE(n) { n = n; this._E = (n & 0xff); }
    getE() { return this._E; }
    setH(n) { n = n; this._H = (n & 0xff); }
    getH() { return this._H; }
    setL(n) { n = n; this._L = (n & 0xff); }
    getL() { return this._L; }
    setA(n) { n = n; this._A = (n & 0xff); }
    getA() { return this._A; }
    setF(n) { n = n; this._F = (n & 0xff); }
    getF() { return this._F; }
    setBC(nn) { nn = nn; this._B = this.hi8(nn); this._C = this.lo8(nn); }
    getBC() { return this.pair(this._B, this._C); }
    setDE(nn) { nn = nn; this._D = this.hi8(nn); this._E = this.lo8(nn); }
    getDE() { return this.pair(this._D, this._E); }
    setHL(nn) { nn = nn; this._H = this.hi8(nn); this._L = this.lo8(nn); }
    getHL() { return this.pair(this._H, this._L); }
    setAF(nn) { nn = nn; this._A = this.hi8(nn); this._F = this.lo8(nn); }
    getAF() { return this.pair(this._A, this._F); }
    testFlag(mask) { mask = mask; return ((this._F & mask) ? 1 : 0); }
    setFlag(mask) { mask = mask; this._F = this._F | mask; }
    clearFlag(mask) { mask = mask; this._F = this._F & ((~mask) & 0xff); }
    flagS() { return ((this._F & Z80_Register.S_FLAG) ? 1 : 0); }
    flagZ() { return ((this._F & Z80_Register.Z_FLAG) ? 1 : 0); }
    flagH() { return ((this._F & Z80_Register.H_FLAG) ? 1 : 0); }
    flagP() { return ((this._F & Z80_Register.V_FLAG) ? 1 : 0); }
    flagN() { return ((this._F & Z80_Register.N_FLAG) ? 1 : 0); }
    flagC() { return ((this._F & Z80_Register.C_FLAG) ? 1 : 0); }
    setFlagS() { this._F = this._F | Z80_Register.S_FLAG; }
    setFlagZ() { this._F = this._F | Z80_Register.Z_FLAG; }
    setFlagH() { this._F = this._F | Z80_Register.H_FLAG; }
    setFlagP() { this._F = this._F | Z80_Register.V_FLAG; }
    setFlagN() { this._F = this._F | Z80_Register.N_FLAG; }
    setFlagC() { this._F = this._F | Z80_Register.C_FLAG; }
    clearFlagS() { this._F = this._F & (~Z80_Register.S_FLAG & 0xff); }
    clearFlagZ() { this._F = this._F & (~Z80_Register.Z_FLAG & 0xff); }
    clearFlagH() { this._F = this._F & (~Z80_Register.H_FLAG & 0xff); }
    clearFlagP() { this._F = this._F & (~Z80_Register.V_FLAG & 0xff); }
    clearFlagN() { this._F = this._F & (~Z80_Register.N_FLAG & 0xff); }
    clearFlagC() { this._F = this._F & (~Z80_Register.C_FLAG & 0xff); }
    ADDW(a, b) {
        const q = a + b;
        this.setF(((this.getF()) & (Z80_Register.S_FLAG | Z80_Register.Z_FLAG | Z80_Register.V_FLAG)) |
            (((a ^ q ^ b) & 0x1000) >> 8) |
            ((q >> 16) & 1));
        return q & 0xffff;
    }
    ADD_HL(n) {
        this.setHL(this.ADDW(this.getHL(), n));
    }
    ADC_HL(n) {
        const HL = this.getHL();
        const q = HL + n + (this.getF() & Z80_Register.C_FLAG);
        this.setF((((HL ^ q ^ n) & 0x1000) >> 8) |
            ((q >> 16) & 1) |
            ((q & 0x8000) >> 8) |
            ((q & 0xffff) ? 0 : Z80_Register.Z_FLAG) |
            (((n ^ HL ^ 0x8000) & (n ^ q) & 0x8000) >> 13));
        this.setHL(q);
    }
    SBC_HL(n) {
        const HL = this.getHL();
        const q = (HL - n - (this.getF() & 1));
        this.setF((((HL ^ q ^ n) & 0x1000) >> 8) |
            ((q >> 16) & 1) |
            ((q & 0x8000) >> 8) |
            ((q & 0xffff) ? 0 : Z80_Register.Z_FLAG) |
            (((n & HL) & (n ^ q) & 0x8000) >> 13) |
            Z80_Register.N_FLAG);
        this.setHL(q);
    }
    incBC() { this.setBC(this.getBC() + 1); }
    decBC() { this.setBC(this.getBC() - 1); }
    incHL() { this.setHL(this.getHL() + 1); }
    decHL() { this.setHL(this.getHL() - 1); }
    incDE() { this.setDE(this.getDE() + 1); }
    decDE() { this.setDE(this.getDE() - 1); }
    RLCA() {
        const acc = this.getA();
        this.setA(((acc << 1) | ((acc & 0x80) >> 7)) & 255);
        this.setF((this.getF() & 0xEC) | (this.getA() & 0x01));
    }
    RLA() {
        const i = this.getF() & Z80_Register.C_FLAG;
        const acc = this.getA();
        this.setF((this.getF() & 0xEC) | ((acc & 0x80) >> 7));
        this.setA(((acc << 1) | i) & 255);
    }
    RRCA() {
        const acc = this.getA();
        this.setF((this.getF() & 0xEC) | (acc & 0x01));
        this.setA((acc >> 1) | ((acc << 7) & 255));
    }
    RRA() {
        const i = this.getF() & Z80_Register.C_FLAG;
        const acc = this.getA();
        this.setF((this.getF() & 0xEC) | (acc & 0x01));
        this.setA((acc >> 1) | (i << 7));
    }
    postIND() {
        this.decHL();
        this.setF(this.getB() ? Z80_Register.N_FLAG : Z80_Register.N_FLAG | Z80_Register.Z_FLAG);
    }
    postINI() {
        this.incHL();
        this.setF(this.getB() ? Z80_Register.N_FLAG : Z80_Register.N_FLAG | Z80_Register.Z_FLAG);
    }
    postOUTD() {
        this.decHL();
        this.setF(this.getB() ? Z80_Register.N_FLAG : Z80_Register.N_FLAG | Z80_Register.Z_FLAG);
    }
    postOUTI() {
        this.incHL();
        this.setF(this.getB() ? Z80_Register.N_FLAG : Z80_Register.N_FLAG | Z80_Register.Z_FLAG);
    }
    onLDD() {
        this.decDE();
        this.decHL();
        this.decBC();
        this.setF((this.getF() & 0xE9) | (this.getBC() ? Z80_Register.V_FLAG : 0));
    }
    onLDI() {
        this.incDE();
        this.incHL();
        this.decBC();
        this.setF((this.getF() & 0xE9) | (this.getBC() ? Z80_Register.V_FLAG : 0));
    }
    addAcc(n) {
        const q = this.getA() + n;
        this.setF((this.getZSTable(q & 255)) | ((q & 256) >> 8) |
            ((this.getA() ^ q ^ n) & Z80_Register.H_FLAG) |
            (((n ^ this.getA() ^ 0x80) & (n ^ q) & 0x80) >> 5));
        this.setA(q & 255);
    }
    addAccWithCarry(n) {
        const q = this.getA() + n + (this.getF() & Z80_Register.C_FLAG);
        this.setF(this.getZSTable(q & 255) | ((q & 256) >> 8) |
            ((this.getA() ^ q ^ n) & Z80_Register.H_FLAG) |
            (((n ^ this.getA() ^ 0x80) & (n ^ q) & 0x80) >> 5));
        this.setA(q & 255);
    }
    subAcc(n) {
        const q = ((this.getA()) - n) & 0x1ff;
        this.setF(this.getZSTable(q & 255) | ((q & 256) >> 8) | Z80_Register.N_FLAG |
            ((this.getA() ^ q ^ n) & Z80_Register.H_FLAG) |
            (((n ^ this.getA() ^ 0x80) & (n ^ q) & 0x80) >> 5));
        this.setA(q & 255);
    }
    subAccWithCarry(n) {
        const q = (this.getA() - n - (this.getF() & Z80_Register.C_FLAG)) & 0x1ff;
        this.setF(this.getZSTable(q & 255) | ((q & 256) >> 8) | Z80_Register.N_FLAG |
            ((this.getA() ^ q ^ n) & Z80_Register.H_FLAG) |
            (((n ^ this.getA() ^ 0x80) & (n ^ q) & 0x80) >> 5));
        this.setA(q & 255);
    }
    andAcc(n) {
        this.setA(this.getA() & (n & 0xff));
        this.setF(this.getZSPTable(this.getA()) | Z80_Register.H_FLAG);
    }
    orAcc(n) {
        this.setA((this.getA()) | (n & 0xff));
        this.setF(this.getZSPTable(this.getA()));
    }
    xorAcc(n) {
        this.setA((this.getA()) ^ (n & 0xff));
        this.setF(this.getZSPTable(this.getA()));
    }
    CPL() {
        this.setA((this.getA() ^ 0xff) & 255);
        this.setF(Z80_Register.H_FLAG | Z80_Register.N_FLAG);
    }
    NEG() {
        const i = this.getA();
        this.setA(0);
        this.subAcc(i);
    }
    getINCValue(n) {
        n = (n + 1) & 255;
        this.setF((this.getF() & Z80_Register.C_FLAG) |
            this.getZSTable(n) |
            (n === 0x80 ? Z80_Register.V_FLAG : 0) |
            ((n & 0x0F) ? 0 : Z80_Register.H_FLAG));
        return n;
    }
    getDECValue(n) {
        this.setF((this.getF() & Z80_Register.C_FLAG) | Z80_Register.N_FLAG |
            (n === 0x80 ? Z80_Register.V_FLAG : 0) |
            ((n & 0x0F) ? 0 : Z80_Register.H_FLAG));
        n = (n - 1) & 255;
        this.setF(this.getF() | this.getZSTable(n));
        return n;
    }
    compareAcc(n) {
        const q = ((this.getA()) - n);
        this.setF((this.getZSTable(q & 255)) | ((q & 256) >> 8) | Z80_Register.N_FLAG |
            ((this.getA() ^ q ^ n) & Z80_Register.H_FLAG) |
            (((n ^ this.getA()) & (n ^ q) & 0x80) >> 5));
    }
    CPI(n) {
        const q = ((this.getA()) - n);
        this.incHL();
        this.decBC();
        this.setF((this.getF() & Z80_Register.C_FLAG) | this.getZSTable(q & 255) |
            ((this.getA() ^ n ^ q) & Z80_Register.H_FLAG) |
            (this.getBC() ? Z80_Register.V_FLAG : 0) | Z80_Register.N_FLAG);
    }
    CPD(n) {
        const q = this.getA() - n;
        this.decHL();
        this.decBC();
        this.setF((this.getF() & Z80_Register.C_FLAG) | this.getZSTable(q & 255) |
            ((this.getA() ^ n ^ q) & Z80_Register.H_FLAG) |
            (this.getBC() ? Z80_Register.V_FLAG : 0) | Z80_Register.N_FLAG);
    }
    RLC(x) {
        const q = x >> 7;
        x = ((x << 1) | q) & 255;
        this.setF(this.getZSPTable(x) | q);
        return x;
    }
    RL(x) {
        const q = x >> 7;
        x = ((x << 1) | (this.getF() & 1)) & 255;
        this.setF(this.getZSPTable(x) | q);
        return x;
    }
    RRC(x) {
        const q = x & 1;
        x = (x >> 1) | ((q << 7) & 255);
        this.setF(this.getZSPTable(x) | q);
        return x;
    }
    RR(x) {
        const q = x & 1;
        x = (x >> 1) | ((this.getF() << 7) & 255);
        this.setF(this.getZSPTable(x) | q);
        return x;
    }
    SLA(x) {
        const q = x >> 7;
        x = (x << 1) & 255;
        this.setF(this.getZSPTable(x) | q);
        return x;
    }
    SRA(x) {
        const q = x & 1;
        x = (x >> 1) | (x & 0x80);
        this.setF(this.getZSPTable(x) | q);
        return x;
    }
    SRL(x) {
        const q = x & 1;
        x = x >> 1;
        this.setF(this.getZSPTable(x) | q);
        return x;
    }
    onReadIoPort(Reg) {
        this.setF((this.getF() & Z80_Register.C_FLAG) | this.getZSPTable(Reg));
    }
    LD_A_I(iff2) {
        this.setA(this.I);
        this.setF((this.getF() & Z80_Register.C_FLAG) | this.getZSTable(this.I) | (iff2 << 2));
    }
    LD_A_R(iff2, r2) {
        this.setA((this.R & 127) | (r2 & 128));
        this.setF((this.getF() & Z80_Register.C_FLAG) | (this.getZSTable(this.getA())) | (iff2 << 2));
    }
    cloneRaw() {
        return {
            B: this.getB(),
            C: this.getC(),
            D: this.getD(),
            E: this.getE(),
            H: this.getH(),
            L: this.getL(),
            A: this.getA(),
            F: this.getF(),
            PC: this.PC,
            SP: this.SP,
            IX: this.IX,
            IY: this.IY,
            R: this.R,
            I: this.I,
        };
    }
    ;
    clear() {
        this._B = 0;
        this._C = 0;
        this._D = 0;
        this._E = 0;
        this._H = 0;
        this._L = 0;
        this._A = 0;
        this._F = 0;
        this.PC = 0;
        this.SP = 0;
        this.IX = 0;
        this.IY = 0;
        this.R = 0;
        this.I = 0;
    }
    setFrom(reg) {
        this.setB(reg.getB());
        this.setC(reg.getC());
        this.setD(reg.getD());
        this.setE(reg.getE());
        this.setH(reg.getH());
        this.setL(reg.getL());
        this.setA(reg.getA());
        this.setF(reg.getF());
        this.PC = reg.PC;
        this.SP = reg.SP;
        this.IX = reg.IX;
        this.IY = reg.IY;
        this.R = reg.R;
        this.I = reg.I;
    }
    setPair(rr, value) {
        switch (rr) {
            case "SP":
                this.SP = value;
                break;
            case "PC":
                this.PC = value;
                break;
            case "IX":
                this.IX = value;
                break;
            case "IY":
                this.IY = value;
                break;
            case "BC":
                this.setBC(value);
                break;
            case "DE":
                this.setDE(value);
                break;
            case "HL":
                this.setHL(value);
                break;
            case "AF":
                this.setAF(value);
                break;
        }
    }
    debugDump() {
        console.info("B:" + number_util_1.default.HEX(this.getB(), 2) + "H " + this.getB() + " " +
            "C:" + number_util_1.default.HEX(this.getC(), 2) + "H " + this.getC() + " / " + this.getBC());
        console.info("D:" + number_util_1.default.HEX(this.getD(), 2) + "H " + this.getD() + " " +
            "E:" + number_util_1.default.HEX(this.getE(), 2) + "H " + this.getE() + " / " + this.getDE());
        console.info("H:" + number_util_1.default.HEX(this.getH(), 2) + "H " + this.getH() + " " +
            "L:" + number_util_1.default.HEX(this.getL(), 2) + "H " + this.getL() + " / " + this.getHL());
        console.info("A:" + number_util_1.default.HEX(this.getA(), 2) + "H " + this.getA());
        console.info("SZ-HPN-C");
        console.info(number_util_1.default.bin(this.getF(), 8));
        console.info("PC:" + number_util_1.default.HEX(this.PC, 4) + "H " + number_util_1.default.bin(this.PC, 16) + "(2) " + this.PC);
        console.info("SP:" + number_util_1.default.HEX(this.SP, 4) + "H " + number_util_1.default.bin(this.SP, 16) + "(2) " + this.SP);
        console.info("I:" + number_util_1.default.HEX(this.I, 2) + "H " + number_util_1.default.bin(this.I, 8) + "(2) " + this.I + " " +
            "R:" + number_util_1.default.HEX(this.R, 2) + "H " + number_util_1.default.bin(this.R, 8) + "(2) " + this.R);
    }
    ADD_IX(n) {
        this.IX = this.ADDW(this.IX, n);
    }
    ADD_IY(n) {
        this.IY = this.ADDW(this.IY, n);
    }
    jumpRel(e) {
        this.PC += bin_util_1.default.getSignedByte(e);
    }
    increment(r) {
        this["set" + r](this.getINCValue(this["get" + r]()));
    }
    decrement(r) {
        this["set" + r](this.getDECValue(this["get" + r]()));
    }
    getZSTable(idx) {
        return this._flagTable[this._ZSTableIndex + idx];
    }
    getZSPTable(idx) {
        return this._flagTable[this._ZSPTableIndex + idx];
    }
    DAA() {
        let i = this.getA();
        const f = this.getF();
        if (f & Z80_Register.C_FLAG) {
            i |= 0x100;
        }
        if (f & Z80_Register.H_FLAG) {
            i |= 0x200;
        }
        if (f & Z80_Register.N_FLAG) {
            i |= 0x400;
        }
        this.setAF(Z80_Register.DAATable[i]);
    }
    ;
}
exports.default = Z80_Register;
Z80_Register.S_FLAG = 0x80;
Z80_Register.Z_FLAG = 0x40;
Z80_Register.H_FLAG = 0x10;
Z80_Register.V_FLAG = 0x04;
Z80_Register.N_FLAG = 0x02;
Z80_Register.C_FLAG = 0x01;
Z80_Register.REG_R_ID2NAME = { 0: "B", 1: "C", 2: "D", 3: "E", 4: "H", 5: "L", 7: "A" };
Z80_Register.CONDITION_INDEX = { NZ: 0, Z: 1, NC: 2, C: 3, PO: 4, PE: 5, P: 6, N: 7 };
Z80_Register.DAATable = [
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
module.exports = Z80_Register;

},{"../lib/number-util":27,"./bin-util":8}],15:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mz700_cg_1 = __importDefault(require("./mz700-cg"));
class PCG700 {
    constructor(screen) {
        this.addr = 0x000;
        this.pattern = 0x00;
        this.we = 0;
        this.ssw = 1;
        this.copy = 0;
        this._screen = screen;
        const patternBuffer = [];
        for (let code = 0; code < 512; code++) {
            patternBuffer.push([0, 0, 0, 0, 0, 0, 0, 0]);
            for (let row = 0; row < 8; row++) {
                patternBuffer[code][row] = mz700_cg_1.default.ROM[code][row];
            }
        }
        this._cg = new mz700_cg_1.default(patternBuffer, 8, 8);
    }
    setPattern(pattern) {
        this.pattern = pattern & 0xff;
    }
    setAddrLo(addr) {
        this.addr = ((this.addr & 0x700) | ((addr & 0xff) << 0));
    }
    setAddrHi(addr) {
        this.addr = ((this.addr & 0x0FF) | ((addr & PCG700.ADDR) << 8));
    }
    setCopy(value) {
        this.copy = (value === 0) ? 0 : 1;
    }
    setWE(value) {
        const we = this.we;
        this.we = (value === 0) ? 0 : 1;
        if (we && !this.we) {
            this.write();
        }
    }
    setSSW(value) {
        const ssw = this.ssw;
        this.ssw = (value === 0) ? 0 : 1;
        if (ssw !== this.ssw) {
            this.applySSW();
        }
    }
    applySSW() {
        if (this.ssw === 0) {
            this._screen.changeCG(this._cg);
            this._screen.redraw();
        }
        else {
            this._screen.restoreCG();
            this._screen.redraw();
        }
    }
    write() {
        const atb = (this.addr >> 10) & 0x01;
        const dispCode = 0x80 + ((this.addr >> 3) & 0x7f);
        const cpos = atb * 256 + dispCode;
        const row = (this.addr >> 0) & 0x07;
        const pattern = ((this.copy === 0) ? this.pattern : mz700_cg_1.default.ROM[cpos][row]);
        this._cg.setPattern(atb, dispCode, row, pattern);
        if (this.ssw === 0) {
            this._screen.redrawChar(atb, dispCode);
        }
    }
}
exports.default = PCG700;
PCG700.COPY = 0x20;
PCG700.WE = 0x10;
PCG700.SSW = 0x08;
PCG700.ADDR = 0x07;
module.exports = PCG700;

},{"./mz700-cg":25}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EventDispatcher {
    constructor() {
        this._handlers = {};
    }
    declareEvent(eventName) {
        this._handlers[eventName] = [];
    }
    addEventListener(eventName, handler) {
        this._handlers[eventName].push(handler);
    }
    fireEvent(eventName) {
        this._handlers[eventName].forEach(handler => handler());
    }
}
exports.default = EventDispatcher;

},{}],17:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const event_dispatcher_1 = __importDefault(require("./event-dispatcher"));
class FlipFlopCounter extends event_dispatcher_1.default {
    constructor(count) {
        super();
        this.declareEvent("change");
        this.initialize();
        this._counterMax = count;
    }
    initialize() {
        this._out = false;
        this._counter = 0;
    }
    readOutput() {
        return this._out;
    }
    count() {
        this._counter++;
        if (this._counter >= this._counterMax / 2) {
            this._out = !this._out;
            this._counter = 0;
            this.fireEvent("change");
            return true;
        }
        return false;
    }
}
exports.default = FlipFlopCounter;
module.exports = FlipFlopCounter;

},{"./event-dispatcher":16}],18:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const flip_flop_counter_1 = __importDefault(require("../lib/flip-flop-counter"));
class IC556 extends flip_flop_counter_1.default {
    constructor(freq) {
        super(freq);
        this._reset = false;
    }
    count() {
        if (this._reset) {
            return flip_flop_counter_1.default.prototype.count.call(this);
        }
        return false;
    }
    loadReset(value) {
        if (!value) {
            if (this._reset) {
                this._reset = false;
                this.initialize();
            }
        }
        else {
            if (!this._reset) {
                this._reset = true;
            }
        }
    }
}
exports.default = IC556;
module.exports = IC556;

},{"../lib/flip-flop-counter":17}],19:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const event_dispatcher_1 = __importDefault(require("./event-dispatcher"));
class Intel8253 {
    constructor() {
        this._counter = [
            new Intel8253Counter(),
            new Intel8253Counter(),
            new Intel8253Counter()
        ];
    }
    setCtrlWord(ctrlword) {
        const index = (ctrlword & 0xc0) >> 6;
        this._counter[index].setCtrlWord(ctrlword & 0x3f);
    }
    ;
    counter(index) {
        return this._counter[index];
    }
}
exports.default = Intel8253;
class Intel8253Counter extends event_dispatcher_1.default {
    constructor() {
        super();
        this.counter = 0xffff;
        this._written = true;
        this._read = true;
        this.out = true;
        this.gate = false;
        this.declareEvent("timeup");
        this.RL = 3;
        this.MODE = 3;
        this.BCD = 0;
        this.value = 0xffff;
        this.counter = 0xffff;
        this._written = true;
        this._read = true;
        this.out = true;
        this.gate = false;
    }
    setCtrlWord(ctrlword) {
        this.RL = (ctrlword & 0x30) >> 4;
        this.MODE = (ctrlword & 0x0e) >> 1;
        this.BCD = (ctrlword & 0x01) !== 0 ? 1 : 0;
        this.value = 0;
        this.counter = 0;
        this._written = true;
        this._read = true;
        this.out = false;
        this.gate = false;
    }
    initCount(counter, handler) {
        this.value = counter;
        this.counter = counter;
        this.addEventListener("timeup", handler);
    }
    load(value) {
        this.counter = 0;
        let setComp = false;
        switch (this.RL) {
            case 0:
                break;
            case 1:
                this.value = (value & 0x00ff);
                this.counter = this.value;
                this.out = false;
                setComp = true;
                break;
            case 2:
                this.value = (value & 0x00ff) << 8;
                this.counter = this.value;
                setComp = true;
                break;
            case 3:
                if (this._written) {
                    this._written = false;
                    this.value = (this.value & 0xff00) | (value & 0x00ff);
                    this.counter = this.value;
                    setComp = false;
                }
                else {
                    this._written = true;
                    this.value = (this.value & 0x00ff) | ((value & 0x00ff) << 8);
                    this.counter = this.value;
                    this.out = false;
                    setComp = true;
                }
                break;
        }
        if (setComp) {
            switch (this.MODE) {
                case 0:
                    this.out = false;
                    break;
                case 1:
                    break;
                case 2:
                case 6:
                    this.out = true;
                    break;
                case 3:
                case 7:
                    this.out = true;
                    break;
                case 4:
                    break;
                case 5:
                    break;
            }
        }
        return setComp;
    }
    read() {
        switch (this.RL) {
            case 0:
                break;
            case 1:
                return (this.counter & 0x00ff);
            case 2:
                return ((this.counter >> 8) & 0x00ff);
            case 3:
                if (this._read) {
                    this._read = false;
                    return (this.counter & 0x00ff);
                }
                else {
                    this._read = true;
                    return ((this.counter >> 8) & 0x00ff);
                }
        }
        return null;
    }
    setGate(gate) {
        this.gate = gate;
    }
    count(count) {
        const prevOut = this.out;
        switch (this.MODE) {
            case 0:
                if (this.counter > 0) {
                    this.counter -= count;
                    if (this.counter <= 0) {
                        this.counter = 0;
                        if (!this.out) {
                            this.out = true;
                        }
                    }
                }
                else {
                    this.counter = this.value;
                }
                break;
            case 1:
                break;
            case 2:
            case 6:
                this.counter -= count;
                if (this.out && this.counter <= 0) {
                    this.out = false;
                    this.counter = this.value;
                }
                else if (!this.out) {
                    this.out = true;
                }
                break;
            case 3:
            case 7:
                this.counter -= count;
                if (this.counter >= this.value / 2) {
                    this.out = true;
                }
                else if (this.counter > 0) {
                    this.out = false;
                }
                else {
                    this.out = true;
                    this.counter = this.value;
                }
                break;
            case 4:
                break;
            case 5:
                break;
        }
        if (!prevOut && this.out) {
            this.fireEvent("timeup");
        }
    }
}
module.exports = Intel8253;

},{"./event-dispatcher":16}],20:[function(require,module,exports){
"use strict";
class MZ_DataRecorder {
    constructor(motorCallback) {
        this._mOn = false;
        this._play = false;
        this._rec = false;
        this._motor = false;
        this._wdata = null;
        this._twdata = null;
        this._rbit = null;
        this._trdata = null;
        this._cmt = null;
        this._pos = 0;
        this._motorCallback = null;
        this._readTopBlank = 0;
        this._motorCallback = motorCallback;
    }
    isCmtSet() {
        return (this._cmt != null);
    }
    getCmt() {
        return this._cmt;
    }
    setCmt(cmt) {
        const m = this.motor();
        if (m) {
            this.stop();
        }
        this._cmt = cmt;
        this._pos = 0;
        this._twdata = null;
        this._rbit = null;
        this._trdata = null;
        this._readTopBlank = 0;
    }
    play() {
        const m = this.motor();
        if (this._cmt != null) {
            this._play = true;
        }
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
    }
    rec() {
        const m = this.motor();
        if (this._cmt != null) {
            this._play = true;
            this._rec = true;
        }
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
    }
    stop() {
        const m = this.motor();
        this._play = false;
        this._rec = false;
        if (m && !this.motor()) {
            this._motorCallback(false);
        }
    }
    ejectCmt() {
        this.stop();
        const cmt = this._cmt;
        this._cmt = null;
        this._pos = 0;
        this._twdata = null;
        this._rbit = null;
        this._trdata = null;
        this._readTopBlank = 0;
        return cmt;
    }
    m_on(state) {
        const m = this.motor();
        if (!this._mOn && state) {
            this._motor = !this._motor;
        }
        this._mOn = state;
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
        if (m && !this.motor()) {
            this._motorCallback(false);
        }
    }
    motor() {
        return this._cmt != null && this._play && this._motor;
    }
    wdata(wdata, tick) {
        if (this.motor() && this._rec) {
            if (this._wdata !== wdata) {
                this._wdata = wdata;
                if (wdata) {
                    this._twdata = tick;
                }
                else {
                    if (this._twdata == null) {
                        this._twdata = tick;
                    }
                    const bit = (tick - this._twdata > 1400);
                    if (this._pos < this._cmt.length) {
                        this._cmt[this._pos] = bit;
                        this._pos++;
                    }
                    else {
                        this._cmt.push(bit);
                        this._pos = this._cmt.length;
                    }
                }
            }
        }
    }
    rdata(tick) {
        if (this.motor()) {
            if (this._pos < this._cmt.length) {
                if (this._pos === 0) {
                    if (this._readTopBlank <
                        MZ_DataRecorder.RDATA_TOP_BLANK_LEN) {
                        ++this._readTopBlank;
                        return false;
                    }
                }
                if (this._pos >= this._cmt.length) {
                    console.log("MZ_DataRecorder stopped at the end of CMT.");
                    this.stop();
                    return false;
                }
                if (this._rbit == null) {
                    this._rbit = this._cmt[this._pos];
                    this._pos++;
                    this._trdata = tick;
                }
                const ticksHigh = (this._rbit ?
                    MZ_DataRecorder.RDATA_CYCLE_HI_LONG :
                    MZ_DataRecorder.RDATA_CYCLE_HI_SHORT);
                const ticks = tick - this._trdata;
                if (ticks >= ticksHigh + MZ_DataRecorder.RDATA_CYCLE_LO) {
                    this._rbit = null;
                }
                const signal = (ticks < ticksHigh);
                return signal;
            }
        }
        return null;
    }
}
MZ_DataRecorder.RDATA_TOP_BLANK_LEN = 1;
MZ_DataRecorder.RDATA_CYCLE_HI_LONG = 1500;
MZ_DataRecorder.RDATA_CYCLE_HI_SHORT = 700;
MZ_DataRecorder.RDATA_CYCLE_LO = 700;
module.exports = MZ_DataRecorder;

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MZMMIO {
    constructor() {
        this._map = [];
        for (let addr = 0xE000; addr < 0xE800; addr++) {
            this._map.push({
                "r": (value) => value,
                "w": (value) => value,
            });
        }
    }
    onRead(address, handler) {
        this._map[address - 0xE000].r = handler;
    }
    onWrite(address, handler) {
        this._map[address - 0xE000].w = handler;
    }
    read(address, value) {
        return this._map[address - 0xE000].r(value);
    }
    write(address, value) {
        return this._map[address - 0xE000].w(value);
    }
}
exports.default = MZMMIO;
module.exports = MZMMIO;

},{}],22:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const number_util_1 = __importDefault(require("./number-util"));
const { HEX } = number_util_1.default;
class MZ_TapeHeader {
    constructor(buf, offset) {
        const arrayToString = (arr, start, end) => {
            let s = "";
            for (let i = start; i < end; i++) {
                if (arr[i] === 0x0d) {
                    break;
                }
                if (arr[i] !== 0) {
                    s += String.fromCharCode(arr[i]);
                }
            }
            return s;
        };
        const readArrayUInt8 = (arr, index) => {
            return (0xff & arr[index]);
        };
        const readArrayUInt16LE = (arr, index) => {
            return (0xff & arr[index]) + (0xff & arr[index + 1]) * 256;
        };
        this.attr = readArrayUInt8(buf, offset + 0);
        const filename = arrayToString(buf, offset + 0x01, offset + 0x12);
        this.filename = filename;
        this.fileSize = readArrayUInt16LE(buf, offset + 0x12);
        this.addrLoad = readArrayUInt16LE(buf, offset + 0x14);
        this.addrExec = readArrayUInt16LE(buf, offset + 0x16);
        const headerBuffer = [];
        for (let i = 0; i < 128; i++) {
            headerBuffer.push(buf[offset + i]);
        }
        this.buffer = headerBuffer;
    }
    setFilename(filename) {
        if (filename.length > 0x10) {
            filename = filename.substr(0, 0x10);
        }
        this.filename = filename;
        let i;
        for (i = 0; i <= 0x10; i++) {
            this.buffer[0x01 + i] = 0;
        }
        filename += "\r";
        for (i = 0; i < filename.length; i++) {
            this.buffer[0x01 + i] = (filename.charCodeAt(i) & 0xff);
        }
    }
    setFilesize(filesize) {
        this.fileSize = filesize;
        this.buffer[0x12] = ((filesize >> 0) & 0xff);
        this.buffer[0x13] = ((filesize >> 8) & 0xff);
    }
    setAddrLoad(addr) {
        this.addrLoad = addr;
        this.buffer[0x14] = ((addr >> 0) & 0xff);
        this.buffer[0x15] = ((addr >> 8) & 0xff);
    }
    setAddrExec(addr) {
        this.addrExec = addr;
        this.buffer[0x16] = ((addr >> 0) & 0xff);
        this.buffer[0x17] = ((addr >> 8) & 0xff);
    }
    getHeadline() {
        return [
            ";======================================================",
            "; attribute :   " + HEX(this.attr, 2) + "H",
            "; filename  :   '" + this.filename + "'",
            "; filesize  :   " + this.fileSize + " bytes",
            "; load addr :   " + HEX(this.addrLoad, 4) + "H",
            "; start addr:   " + HEX(this.addrExec, 4) + "H",
            ";======================================================"
        ].join("\n");
    }
    static get1stFilename(mztArray) {
        if (mztArray && Array.isArray(mztArray) && mztArray.length > 0) {
            return mztArray[0].header.filename;
        }
        return null;
    }
    static createNew() {
        const buf = new Array(128);
        for (let i = 0; i < 128; i++) {
            buf[i] = 0;
        }
        buf[0] = 1;
        return new MZ_TapeHeader(buf, 0);
    }
}
exports.default = MZ_TapeHeader;
module.exports = MZ_TapeHeader;

},{"./number-util":27}],23:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mz_tape_header_1 = __importDefault(require("./mz-tape-header"));
const number_util_1 = __importDefault(require("./number-util"));
const { HEX } = number_util_1.default;
class MZ_Tape {
    constructor(tapeData) {
        this._index = 0;
        this._tapeData = tapeData;
    }
    isThereSignal(signal, n) {
        for (let i = 0; i < n; i++) {
            if (this._tapeData[this._index + i] !== signal) {
                return false;
            }
        }
        this._index += n;
        return true;
    }
    recognizeStartingMark() {
        if (!this.isThereSignal(false, 11000)) {
            return false;
        }
        if (!this.isThereSignal(true, 40)) {
            return false;
        }
        if (!this.isThereSignal(false, 40)) {
            return false;
        }
        if (!this.isThereSignal(true, 1)) {
            return false;
        }
        return true;
    }
    recognizeStarting2Mark() {
        if (!this.isThereSignal(false, 2750)) {
            return false;
        }
        if (!this.isThereSignal(true, 20)) {
            return false;
        }
        if (!this.isThereSignal(false, 20)) {
            return false;
        }
        if (!this.isThereSignal(true, 1)) {
            return false;
        }
        return true;
    }
    readSignal() {
        if (this._index < this._tapeData.length) {
            return this._tapeData[this._index++];
        }
        return null;
    }
    writeSignal(signal) {
        this._tapeData.push(signal);
    }
    writeByte(data) {
        this.writeSignal(true);
        for (let j = 0; j < 8; j++) {
            if ((data & (0x01 << (7 - j))) !== 0) {
                this.writeSignal(true);
            }
            else {
                this.writeSignal(false);
            }
        }
    }
    writeBlock(data) {
        data.forEach(function (d) {
            this.writeByte(d);
        }, this);
        const cs = this.countOnBit(data);
        this.writeByte((cs >> 8) & 0xff);
        this.writeByte((cs >> 0) & 0xff);
        this.writeSignal(true);
    }
    writeDuplexBlock(data) {
        this.writeBlock(data);
        for (let i = 0; i < 256; i++) {
            this.writeSignal(false);
        }
        this.writeBlock(data);
    }
    readByte() {
        let startBit = null;
        do {
            startBit = this.readSignal();
            if (startBit == null) {
                return null;
            }
            if (!startBit) {
                throw "NO START BIT";
            }
        } while (!startBit);
        let buf = 0x00;
        for (let i = 0; i < 8; i++) {
            const bit = this.readSignal();
            if (bit == null) {
                return null;
            }
            else if (bit) {
                buf |= (0x01 << (7 - i));
            }
        }
        return buf;
    }
    readBytes(n) {
        const buf = [];
        for (let i = 0; i < n; i++) {
            const data = this.readByte();
            if (data == null) {
                break;
            }
            buf.push(data);
        }
        return buf;
    }
    countOnBit(blockBytes) {
        let onBitCount = 0;
        const bitno = [0, 1, 2, 3, 4, 5, 6, 7];
        blockBytes.forEach((data) => {
            bitno.forEach((n) => {
                if ((data & (1 << n)) !== 0) {
                    onBitCount++;
                }
            });
        });
        onBitCount &= 0xffff;
        return onBitCount;
    }
    readBlock(n) {
        const blockBytes = this.readBytes(n);
        const checkBytes = this.readBytes(2);
        if (checkBytes.length !== 2) {
            throw "NO BLOCK CHECKSUM";
        }
        const checksum = (checkBytes[0] * 256) + checkBytes[1];
        if (!this.isThereSignal(true, 1)) {
            throw "NO BLOCK END BIT";
        }
        const onBitCount = this.countOnBit(blockBytes);
        if (onBitCount !== checksum) {
            throw "CHECKSUM ERROR";
        }
        return blockBytes;
    }
    readDuplexBlocks(n) {
        const bytes = this.readBlock(n);
        if (bytes == null) {
            throw "FAIL TO READ BLOCK[1]";
        }
        if (!this.isThereSignal(false, 256)) {
            throw "NO DELIMITOR: Short x 256.";
        }
        const bytes2 = this.readBlock(n);
        if (bytes2 == null) {
            throw "FAIL TO READ BLOCK[2]";
        }
        for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] !== bytes2[i]) {
                throw "FAIL TO VERIFY BLOCK 1 and 2";
            }
        }
        return bytes;
    }
    readHeader() {
        if (!this.recognizeStartingMark()) {
            throw "NO STARTING MARK recognized";
        }
        const mztBytes = this.readDuplexBlocks(128);
        if (mztBytes == null) {
            throw "CANNOT READ MZT HEADER";
        }
        return new mz_tape_header_1.default(mztBytes, 0);
    }
    readDataBlock(n) {
        if (!this.recognizeStarting2Mark()) {
            throw "NO STARTING MARK 2 recognized";
        }
        return this.readDuplexBlocks(n);
    }
    outputStartingMark() {
        let i;
        for (i = 0; i < 11000; i++) {
            this.writeSignal(false);
        }
        for (i = 0; i < 40; i++) {
            this.writeSignal(true);
        }
        for (i = 0; i < 40; i++) {
            this.writeSignal(false);
        }
        this.writeSignal(true);
    }
    writeHeader(buffer) {
        this.outputStartingMark();
        this.writeDuplexBlock(buffer);
    }
    writeStarting2Mark() {
        let i;
        for (i = 0; i < 2750; i++) {
            this.writeSignal(false);
        }
        for (i = 0; i < 20; i++) {
            this.writeSignal(true);
        }
        for (i = 0; i < 20; i++) {
            this.writeSignal(false);
        }
        this.writeSignal(true);
    }
    writeDataBlock(buffer) {
        this.writeStarting2Mark();
        this.writeDuplexBlock(buffer);
    }
    static toBytes(bits) {
        try {
            const reader = new MZ_Tape(bits);
            const header = reader.readHeader();
            if (header == null) {
                throw "FAIL TO READ HEADER";
            }
            const body = reader.readDataBlock(header.fileSize);
            if (body == null) {
                throw "FAIL TO READ DATA";
            }
            const extra = [];
            let nonZeroRead = true;
            let extraByte;
            while (nonZeroRead) {
                extraByte = reader.readByte();
                nonZeroRead = (extraByte ? true : false);
                if (nonZeroRead) {
                    console.warn("MZ_Tape.toBytes rest bytes["
                        + extraByte.length + "] =", HEX(extraByte, 2));
                    extra.push(extraByte);
                }
            }
            return header.buffer.concat(body);
        }
        catch (err) {
            console.log("MZ_Tape.toBytes:Error " + err);
        }
        return [];
    }
    static fromBytes(bytes) {
        if (bytes.length < 128) {
            throw "FAIL TO WRITE HEADER";
        }
        const header = new mz_tape_header_1.default(bytes.slice(0, 128), 0);
        const writer = new MZ_Tape([]);
        writer.writeHeader(header.buffer);
        writer.writeDataBlock(bytes.slice(128));
        return writer._tapeData;
    }
    static parseMZT(buf) {
        const sections = [];
        let offset = 0;
        while (offset + 128 <= buf.length) {
            const header = new mz_tape_header_1.default(buf, offset);
            offset += 128;
            if (offset + header.fileSize > buf.length) {
                return null;
            }
            const bodyBuffer = [];
            for (let i = 0; i < header.fileSize; i++) {
                bodyBuffer.push(buf[offset + i]);
            }
            offset += header.fileSize;
            sections.push({
                "header": header,
                "body": {
                    "buffer": bodyBuffer
                }
            });
        }
        return sections;
    }
}
exports.default = MZ_Tape;
module.exports = MZ_Tape;

},{"./mz-tape-header":22,"./number-util":27}],24:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mz700_cg_1 = __importDefault(require("./mz700-cg"));
class MZ700CanvasRenderer {
    constructor() {
        this._ctx = null;
        this.opt = {
            canvas: null,
            cols: MZ700CanvasRenderer.size.cols,
            rows: MZ700CanvasRenderer.size.rows,
            CG: null,
            color: MZ700CanvasRenderer.colors.white,
            backgroundColor: MZ700CanvasRenderer.colors.blue,
        };
        this.vramText = [];
        this.vramAttr = [];
    }
    create(opt) {
        opt = opt || {};
        Object.keys(this.opt).forEach(key => {
            if (key in opt) {
                this.opt[key] = opt[key];
            }
        });
        this._canvas = this.opt.canvas;
        if (this.opt.CG == null) {
            this.opt.CG = new mz700_cg_1.default(mz700_cg_1.default.ROM, 8, 8);
        }
        this._font = this.opt.CG;
        this.vramText = [];
        this.vramAttr = [];
        for (let i = 0; i < this.opt.cols * this.opt.rows; i++) {
            this.vramText.push(0x00);
            this.vramAttr.push(0x71);
        }
        this.idxloc = ((idxloc, cols, rows) => {
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    idxloc.push({
                        x: MZ700CanvasRenderer.charSize.dotWidth * x,
                        y: MZ700CanvasRenderer.charSize.dotHeight * y
                    });
                }
            }
            return idxloc;
        })([], this.opt.cols, this.opt.rows);
    }
    setupRendering() {
        this._ctx = this._canvas.getContext('2d');
        this._ctx.mozImageSmoothingEnabled = false;
        this._ctx.webkitImageSmoothingEnabled = false;
        this._ctx.msImageSmoothingEnabled = false;
        this._ctx.imageSmoothingEnabled = false;
    }
    redrawChar(atb, dispCode) {
        const abit = atb << 7;
        const n = this.opt.cols * this.opt.rows;
        for (let i = 0; i < n; i++) {
            const attr = this.vramAttr[i];
            if (this.vramText[i] === dispCode && (attr & 0x80) === abit) {
                this.writeVram(i, attr, dispCode);
            }
        }
    }
    writeVram(addr, attr, dispcode) {
        this._writeVram(addr, attr, dispcode);
        this.vramText[addr] = dispcode;
        this.vramAttr[addr] = attr;
    }
    _writeVram(addr, attr, dispcode) {
        const loc = this.idxloc[addr];
        if (!this._ctx) {
            return;
        }
        this._ctx.putImageData(this._font.get(attr, dispcode).getImageData(), loc.x, loc.y);
    }
    redraw() {
        const n = this.opt.cols * this.opt.rows;
        for (let i = 0; i < n; i++) {
            this._writeVram(i, this.vramAttr[i], this.vramText[i]);
        }
    }
    changeCG(cgData) {
        this._font = cgData;
    }
    restoreCG() {
        this._font = this.opt.CG;
    }
    clear() {
        const limit = this.opt.rows * this.opt.cols;
        const chars = MZ700CanvasRenderer.str2chars(' ');
        for (let relAddr = 0; relAddr < limit; relAddr++) {
            this.putChars(chars, relAddr, 0);
        }
    }
    puts(s, x, y) {
        const chars = MZ700CanvasRenderer.str2chars(s);
        return this.putChars(chars, x, y);
    }
    putChars(chars, x, y) {
        const limit = this.opt.rows * this.opt.cols;
        const colorSpec = this.opt.color << 4 | this.opt.backgroundColor;
        let n = 0;
        let relAddr = y * this.opt.cols + x;
        chars.forEach(function (c) {
            if (relAddr < limit) {
                const data = MZ700CanvasRenderer.char2dispcode(c);
                this.writeVram(relAddr, (data.attr << 7) | colorSpec, data.dispcode);
                relAddr++;
                n++;
            }
        }, this);
        return n;
    }
    static char2dispcode(c) {
        const charData = MZ700CanvasRenderer.MapChar2DispCode[c];
        if (!charData) {
            return { attr: 0, dispcode: 0xef };
        }
        return charData;
    }
    static str2chars(s) {
        const chars = s.split('');
        const entities = [];
        let entityRef = false;
        let entity = "";
        chars.forEach((c) => {
            if (!entityRef) {
                if (c === '&') {
                    entityRef = true;
                    entity = '';
                }
                else {
                    entities.push(c);
                }
            }
            else {
                if (c === ';') {
                    entities.push(entity.toUpperCase());
                    entityRef = false;
                    entity = '';
                }
                else {
                    entity += c;
                }
            }
        });
        return entities;
    }
}
exports.default = MZ700CanvasRenderer;
MZ700CanvasRenderer.colors = {
    "black": 0,
    "blue": 1,
    "red": 2,
    "magenta": 3,
    "green": 4,
    "cyan": 5,
    "yellow": 6,
    "white": 7,
};
MZ700CanvasRenderer.size = { "cols": 40, "rows": 25 };
MZ700CanvasRenderer.charSize = { "dotWidth": 8, "dotHeight": 8 };
MZ700CanvasRenderer.TableDispCode2Char = [
    [
        [" ", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"],
        ["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "┼", "└", "┘", "├", "┴"],
        ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "=", ";", "/", ".", ","],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["→", "SPADE", "", "", "DIA", "←", "CLUB", "●", "○", "?", "●反転", "", "", "", "", "", ":"],
        ["↑", "<", "[", "HEART", "]", "@", "", ">", "", "BACKSLASH", "HATCH", "", "", "", "", ""],
        ["π", "!", '"', "#", "$", "%", "AMP", "'", "(", ")", "+", "*", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["↓", "チ", "コ", "ソ", "シ", "イ", "ハ", "キ", "ク", "ニ", "マ", "ノ", "リ", "モ", "ミ", "ラ"],
        ["セ", "タ", "ス", "ト", "カ", "ナ", "ヒ", "テ", "サ", "ン", "ツ", "ロ", "ケ", "「", "ァ", "ャ"],
        ["ワ", "ヌ", "フ", "ア", "ウ", "エ", "オ", "ヤ", "ユ", "ヨ", "ホ", "ヘ", "レ", "メ", "ル", "ネ"],
        ["ム", "」", "ィ", "ュ", "ヲ", "、", "ゥ", "ョ", "゜", "・", "ェ", "ッ", "゛", "。", "ォ", "ー"],
        ["PUSHDOWN", "~DOWN", "~UP", "~RIGHT", "~LEFT", "~HOME", "~CLEAR", "UFO", "CARRIGHT", "CARUP", "HUMAN", "LHUMAN", "RHUMAN", "DHUMAN", "FILLEDFACE", "FACE"],
        ["日", "月", "火", "水", "木", "金", "土", "生", "年", "時", "分", "秒", "円", "￥", "￡", "蛇"],
        [" ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        [" ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
    ],
    [
        [" ", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o"],
        ["p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "", "", "", "", "",],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "ち", "こ", "そ", "し", "い", "は", "き", "く", "に", "ま", "の", "り", "も", "み", "ら"],
        ["せ", "た", "す", "と", "か", "な", "ひ", "て", "さ", "ん", "つ", "ろ", "け", "", "ぁ", "ゃ"],
        ["わ", "ぬ", "ふ", "あ", "う", "え", "お", "や", "ゆ", "よ", "ほ", "へ", "れ", "め", "る", "ね"],
        ["む", "", "ぃ", "ゅ", "を", "", "ぅ", "ょ", "", "", "ぇ", "っ", "", "", "ぉ", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ]
];
MZ700CanvasRenderer.MapChar2DispCode = {};
MZ700CanvasRenderer.initializer = (() => {
    MZ700CanvasRenderer.TableDispCode2Char.forEach((table, attr) => {
        table.forEach((line, upper) => {
            line.forEach((c, lower) => {
                if (!(c in MZ700CanvasRenderer.MapChar2DispCode)) {
                    MZ700CanvasRenderer.MapChar2DispCode[c] = {
                        "attr": attr,
                        "dispcode": upper << 4 | lower,
                    };
                }
            });
        });
    });
})();
module.exports = MZ700CanvasRenderer;

},{"./mz700-cg":25}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const global = Function("return this")();
if (!global.ImageData) {
    global.ImageData = require("canvas").ImageData;
}
class mz700cg {
    constructor(patternBuffer, width, height) {
        this._fontTable = null;
        patternBuffer = patternBuffer;
        width = width;
        height = height;
        this._fontTable = null;
        this._patternBuffer = patternBuffer;
        this._width = width;
        this._height = height;
        this.createFontTable();
    }
    createFontTable() {
        this._fontTable = new Array(256 * 256);
        for (let atb = 0; atb < 2; atb++) {
            for (let dispCode = 0; dispCode < 256; dispCode++) {
                this.initFont(atb, dispCode);
            }
        }
        for (let i = 0; i < 256 * 256; i++) {
            if (!this._fontTable[i]) {
                console.warn(`mz700cg._fontTable[0x${i.toString(16)}] is null`);
            }
        }
    }
    initFont(atb, dispCode) {
        const pattern = this._patternBuffer[atb * 256 + dispCode];
        for (let bg = 0; bg < 8; bg++) {
            for (let fg = 0; fg < 8; fg++) {
                const attr = (atb << 7) | (fg << 4) | bg;
                const index0 = mz700cg.tableIndex(attr | 0x00, dispCode);
                const index1 = mz700cg.tableIndex(attr | 0x08, dispCode);
                const font = new FontImage(pattern, mz700cg.Colors[fg], mz700cg.Colors[bg], this._width, this._height);
                this._fontTable[index0] = font;
                this._fontTable[index1] = font;
            }
        }
    }
    setPattern(atb, dispCode, row, pattern) {
        const cpos = atb * 256 + dispCode;
        this._patternBuffer[cpos][row] = pattern;
        this.initFont(atb, dispCode);
    }
    get(attr, dispCode) {
        return this._fontTable[mz700cg.tableIndex(attr, dispCode)];
    }
    static tableIndex(attr, dispCode) {
        return attr << 8 | dispCode;
    }
}
exports.default = mz700cg;
mz700cg.Colors = [
    { R: 0x00, G: 0x00, B: 0x00, A: 0xff },
    { R: 0x00, G: 0x00, B: 0xff, A: 0xff },
    { R: 0xff, G: 0x00, B: 0x00, A: 0xff },
    { R: 0xff, G: 0x00, B: 0xff, A: 0xff },
    { R: 0x00, G: 0xff, B: 0x00, A: 0xff },
    { R: 0x00, G: 0xff, B: 0xff, A: 0xff },
    { R: 0xff, G: 0xff, B: 0x00, A: 0xff },
    { R: 0xff, G: 0xff, B: 0xff, A: 0xff },
];
mz700cg.ROM = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [24, 36, 66, 126, 66, 66, 66, 0],
    [124, 34, 34, 60, 34, 34, 124, 0],
    [28, 34, 64, 64, 64, 34, 28, 0],
    [120, 36, 34, 34, 34, 36, 120, 0],
    [126, 64, 64, 120, 64, 64, 126, 0],
    [126, 64, 64, 120, 64, 64, 64, 0],
    [28, 34, 64, 78, 66, 34, 28, 0],
    [66, 66, 66, 126, 66, 66, 66, 0],
    [28, 8, 8, 8, 8, 8, 28, 0],
    [14, 4, 4, 4, 4, 68, 56, 0],
    [66, 68, 72, 112, 72, 68, 66, 0],
    [64, 64, 64, 64, 64, 64, 126, 0],
    [66, 102, 90, 90, 66, 66, 66, 0],
    [66, 98, 82, 74, 70, 66, 66, 0],
    [24, 36, 66, 66, 66, 36, 24, 0],
    [124, 66, 66, 124, 64, 64, 64, 0],
    [24, 36, 66, 66, 74, 36, 26, 0],
    [124, 66, 66, 124, 72, 68, 66, 0],
    [60, 66, 64, 60, 2, 66, 60, 0],
    [62, 8, 8, 8, 8, 8, 8, 0],
    [66, 66, 66, 66, 66, 66, 60, 0],
    [66, 66, 66, 36, 36, 24, 24, 0],
    [66, 66, 66, 90, 90, 102, 66, 0],
    [66, 66, 36, 24, 36, 66, 66, 0],
    [34, 34, 34, 28, 8, 8, 8, 0],
    [126, 2, 4, 24, 32, 64, 126, 0],
    [8, 8, 8, 8, 255, 8, 8, 8],
    [8, 8, 8, 8, 15, 0, 0, 0],
    [8, 8, 8, 8, 248, 0, 0, 0],
    [8, 8, 8, 8, 15, 8, 8, 8],
    [8, 8, 8, 8, 255, 0, 0, 0],
    [60, 66, 70, 90, 98, 66, 60, 0],
    [8, 24, 40, 8, 8, 8, 62, 0],
    [60, 66, 2, 12, 48, 64, 126, 0],
    [60, 66, 2, 60, 2, 66, 60, 0],
    [4, 12, 20, 36, 126, 4, 4, 0],
    [126, 64, 120, 4, 2, 68, 56, 0],
    [28, 32, 64, 124, 66, 66, 60, 0],
    [126, 66, 4, 8, 16, 16, 16, 0],
    [60, 66, 66, 60, 66, 66, 60, 0],
    [60, 66, 66, 62, 2, 4, 56, 0],
    [0, 0, 0, 126, 0, 0, 0, 0],
    [0, 0, 126, 0, 126, 0, 0, 0],
    [0, 0, 8, 0, 0, 8, 8, 16],
    [0, 2, 4, 8, 16, 32, 64, 0],
    [0, 0, 0, 0, 0, 24, 24, 0],
    [0, 0, 0, 0, 0, 8, 8, 16],
    [0, 255, 0, 0, 0, 0, 0, 0],
    [64, 64, 64, 64, 64, 64, 64, 64],
    [128, 128, 128, 128, 128, 128, 128, 255],
    [1, 1, 1, 1, 1, 1, 1, 255],
    [0, 0, 0, 255, 0, 0, 0, 0],
    [16, 16, 16, 16, 16, 16, 16, 16],
    [255, 255, 0, 0, 0, 0, 0, 0],
    [192, 192, 192, 192, 192, 192, 192, 192],
    [0, 0, 0, 0, 0, 255, 0, 0],
    [4, 4, 4, 4, 4, 4, 4, 4],
    [0, 0, 0, 0, 255, 255, 255, 255],
    [15, 15, 15, 15, 15, 15, 15, 15],
    [0, 0, 0, 0, 0, 0, 0, 255],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 255, 255],
    [3, 3, 3, 3, 3, 3, 3, 3],
    [0, 0, 8, 4, 254, 4, 8, 0],
    [8, 28, 62, 127, 127, 28, 62, 0],
    [255, 127, 63, 31, 15, 7, 3, 1],
    [255, 255, 255, 255, 255, 255, 255, 255],
    [8, 28, 62, 127, 62, 28, 8, 0],
    [0, 0, 16, 32, 127, 32, 16, 0],
    [8, 28, 42, 127, 42, 8, 8, 0],
    [0, 60, 126, 126, 126, 126, 60, 0],
    [0, 60, 66, 66, 66, 66, 60, 0],
    [60, 66, 2, 12, 16, 0, 16, 0],
    [255, 195, 129, 129, 129, 129, 195, 255],
    [0, 0, 0, 0, 3, 4, 8, 8],
    [0, 0, 0, 0, 192, 32, 16, 16],
    [128, 192, 224, 240, 248, 252, 254, 255],
    [1, 3, 7, 15, 31, 63, 127, 255],
    [0, 0, 8, 0, 0, 8, 0, 0],
    [0, 8, 28, 42, 8, 8, 8, 0],
    [14, 24, 48, 96, 48, 24, 14, 0],
    [60, 32, 32, 32, 32, 32, 60, 0],
    [54, 127, 127, 127, 62, 28, 8, 0],
    [60, 4, 4, 4, 4, 4, 60, 0],
    [28, 34, 74, 86, 76, 32, 30, 0],
    [255, 254, 252, 248, 240, 224, 192, 128],
    [112, 24, 12, 6, 12, 24, 112, 0],
    [160, 80, 160, 80, 160, 80, 160, 80],
    [0, 64, 32, 16, 8, 4, 2, 0],
    [170, 85, 170, 85, 170, 85, 170, 85],
    [240, 240, 240, 240, 15, 15, 15, 15],
    [0, 0, 0, 0, 15, 8, 8, 8],
    [0, 0, 0, 0, 248, 8, 8, 8],
    [8, 8, 8, 8, 248, 8, 8, 8],
    [0, 0, 0, 0, 255, 8, 8, 8],
    [0, 0, 1, 62, 84, 20, 20, 0],
    [8, 8, 8, 8, 0, 0, 8, 0],
    [36, 36, 36, 0, 0, 0, 0, 0],
    [36, 36, 126, 36, 126, 36, 36, 0],
    [8, 30, 40, 28, 10, 60, 8, 0],
    [0, 98, 100, 8, 16, 38, 70, 0],
    [48, 72, 72, 48, 74, 68, 58, 0],
    [4, 8, 16, 0, 0, 0, 0, 0],
    [4, 8, 16, 16, 16, 8, 4, 0],
    [32, 16, 8, 8, 8, 16, 32, 0],
    [0, 8, 8, 62, 8, 8, 0, 0],
    [8, 42, 28, 62, 28, 42, 8, 0],
    [15, 15, 15, 15, 240, 240, 240, 240],
    [129, 66, 36, 24, 24, 36, 66, 129],
    [16, 16, 32, 192, 0, 0, 0, 0],
    [8, 8, 4, 3, 0, 0, 0, 0],
    [255, 0, 0, 0, 0, 0, 0, 0],
    [128, 128, 128, 128, 128, 128, 128, 128],
    [255, 128, 128, 128, 128, 128, 128, 128],
    [255, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 255, 0, 0, 0, 0, 0],
    [32, 32, 32, 32, 32, 32, 32, 32],
    [1, 2, 4, 8, 16, 32, 64, 128],
    [128, 64, 32, 16, 8, 4, 2, 1],
    [0, 0, 0, 0, 255, 0, 0, 0],
    [8, 8, 8, 8, 8, 8, 8, 8],
    [255, 255, 255, 255, 0, 0, 0, 0],
    [240, 240, 240, 240, 240, 240, 240, 240],
    [0, 0, 0, 0, 0, 0, 255, 0],
    [2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 255, 255, 255],
    [7, 7, 7, 7, 7, 7, 7, 7],
    [0, 8, 8, 8, 42, 28, 8, 0],
    [4, 56, 8, 62, 8, 8, 16, 0],
    [0, 62, 2, 2, 2, 2, 62, 0],
    [0, 34, 34, 18, 2, 4, 24, 0],
    [0, 48, 2, 50, 2, 4, 56, 0],
    [2, 4, 8, 24, 40, 8, 8, 0],
    [0, 8, 4, 34, 34, 34, 34, 0],
    [8, 62, 8, 62, 8, 8, 8, 0],
    [0, 30, 18, 34, 2, 4, 24, 0],
    [0, 28, 0, 0, 0, 0, 62, 0],
    [0, 62, 2, 2, 20, 8, 4, 0],
    [4, 4, 4, 4, 4, 8, 16, 0],
    [36, 36, 36, 36, 4, 8, 16, 0],
    [0, 62, 16, 62, 16, 16, 14, 0],
    [0, 28, 0, 28, 0, 60, 2, 0],
    [28, 0, 62, 2, 2, 4, 8, 0],
    [16, 62, 18, 20, 16, 16, 14, 0],
    [0, 30, 18, 42, 6, 4, 24, 0],
    [0, 62, 2, 4, 8, 20, 34, 0],
    [16, 16, 16, 24, 20, 16, 16, 0],
    [16, 62, 18, 18, 18, 18, 36, 0],
    [8, 8, 62, 8, 8, 16, 32, 0],
    [32, 32, 62, 32, 32, 32, 30, 0],
    [28, 0, 62, 8, 8, 8, 16, 0],
    [20, 62, 20, 20, 4, 8, 16, 0],
    [0, 48, 0, 2, 2, 4, 56, 0],
    [0, 42, 42, 42, 2, 4, 8, 0],
    [0, 62, 34, 34, 34, 34, 62, 0],
    [16, 30, 36, 4, 4, 4, 8, 0],
    [30, 16, 16, 16, 0, 0, 0, 0],
    [0, 0, 62, 2, 12, 8, 16, 0],
    [0, 0, 16, 62, 18, 20, 16, 0],
    [0, 62, 34, 34, 2, 4, 8, 0],
    [0, 62, 2, 20, 8, 20, 32, 0],
    [0, 62, 2, 2, 2, 4, 24, 0],
    [62, 2, 10, 12, 8, 8, 16, 0],
    [8, 62, 34, 34, 2, 4, 8, 0],
    [0, 62, 8, 8, 8, 8, 62, 0],
    [4, 62, 4, 12, 20, 36, 4, 0],
    [16, 16, 62, 18, 20, 16, 16, 0],
    [0, 28, 4, 4, 4, 4, 62, 0],
    [0, 62, 2, 62, 2, 2, 62, 0],
    [8, 62, 8, 8, 42, 42, 8, 0],
    [0, 16, 40, 4, 2, 2, 0, 0],
    [0, 32, 32, 34, 36, 40, 48, 0],
    [0, 2, 2, 20, 8, 20, 32, 0],
    [0, 8, 40, 40, 42, 42, 44, 0],
    [8, 62, 4, 8, 28, 42, 8, 0],
    [0, 8, 16, 32, 34, 62, 2, 0],
    [0, 0, 0, 8, 8, 8, 120, 0],
    [0, 0, 4, 8, 24, 40, 8, 0],
    [0, 0, 0, 28, 4, 4, 62, 0],
    [0, 62, 2, 62, 2, 4, 8, 0],
    [0, 0, 0, 0, 64, 32, 16, 0],
    [0, 0, 8, 62, 34, 2, 12, 0],
    [0, 0, 60, 4, 60, 4, 60, 0],
    [112, 80, 112, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 32, 0],
    [0, 0, 0, 62, 8, 8, 62, 0],
    [0, 0, 0, 42, 42, 2, 12, 0],
    [16, 72, 32, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 112, 80, 112, 0],
    [0, 0, 4, 62, 12, 20, 36, 0],
    [0, 0, 0, 28, 0, 0, 0, 0],
    [28, 28, 62, 28, 8, 0, 62, 0],
    [255, 247, 247, 247, 213, 227, 247, 255],
    [255, 247, 227, 213, 247, 247, 247, 255],
    [255, 255, 247, 251, 129, 251, 247, 255],
    [255, 255, 239, 223, 129, 223, 239, 255],
    [187, 187, 187, 131, 187, 187, 187, 255],
    [227, 221, 191, 191, 191, 221, 227, 255],
    [24, 36, 126, 255, 90, 36, 0, 0],
    [224, 71, 66, 126, 66, 71, 224, 0],
    [34, 62, 42, 8, 8, 73, 127, 65],
    [28, 28, 8, 62, 8, 8, 20, 34],
    [0, 17, 210, 252, 210, 17, 0, 0],
    [0, 136, 75, 63, 75, 136, 0, 0],
    [34, 20, 8, 8, 62, 8, 28, 28],
    [60, 126, 255, 219, 255, 231, 126, 60],
    [60, 66, 129, 165, 129, 153, 66, 60],
    [62, 34, 34, 62, 34, 34, 62, 0],
    [62, 34, 62, 34, 62, 34, 66, 0],
    [8, 42, 42, 8, 20, 34, 65, 0],
    [8, 9, 58, 12, 28, 42, 73, 0],
    [8, 8, 62, 8, 28, 42, 73, 0],
    [8, 20, 62, 73, 62, 28, 127, 0],
    [0, 8, 8, 62, 8, 8, 127, 0],
    [8, 72, 126, 72, 62, 8, 127, 0],
    [32, 62, 72, 60, 40, 126, 8, 0],
    [4, 126, 84, 127, 82, 127, 10, 0],
    [8, 20, 34, 127, 18, 18, 36, 0],
    [56, 18, 127, 23, 59, 82, 20, 0],
    [127, 73, 73, 127, 65, 65, 65, 0],
    [34, 20, 62, 8, 62, 8, 8, 0],
    [12, 18, 16, 56, 16, 16, 62, 0],
    [0, 192, 200, 84, 84, 85, 34, 0],
    [0, 0, 0, 0, 0, 2, 255, 2],
    [2, 2, 2, 2, 2, 2, 7, 2],
    [2, 2, 2, 2, 2, 2, 255, 2],
    [0, 0, 32, 80, 136, 5, 2, 0],
    [0, 14, 17, 34, 196, 4, 2, 1],
    [0, 255, 0, 129, 66, 66, 129, 0],
    [0, 112, 136, 68, 35, 32, 64, 128],
    [0, 196, 164, 148, 143, 148, 164, 196],
    [0, 35, 37, 41, 241, 41, 37, 35],
    [136, 144, 160, 192, 192, 168, 152, 184],
    [168, 176, 184, 192, 192, 160, 144, 136],
    [128, 64, 32, 16, 31, 32, 64, 128],
    [0, 0, 36, 36, 231, 36, 36, 0],
    [8, 8, 62, 0, 0, 62, 8, 8],
    [8, 16, 32, 16, 8, 4, 2, 4],
    [85, 170, 85, 170, 85, 170, 85, 170],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 112, 112, 112, 0, 0, 0, 0],
    [0, 7, 7, 7, 0, 0, 0, 0],
    [0, 119, 119, 119, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 112, 112, 112],
    [0, 112, 112, 112, 0, 112, 112, 112],
    [0, 7, 7, 7, 0, 112, 112, 112],
    [0, 119, 119, 119, 0, 112, 112, 112],
    [0, 0, 0, 0, 0, 7, 7, 7],
    [0, 112, 112, 112, 0, 7, 7, 7],
    [0, 7, 7, 7, 0, 7, 7, 7],
    [0, 119, 119, 119, 0, 7, 7, 7],
    [0, 0, 0, 0, 0, 119, 119, 119],
    [0, 112, 112, 112, 0, 119, 119, 119],
    [0, 7, 7, 7, 0, 119, 119, 119],
    [0, 119, 119, 119, 0, 119, 119, 119],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 56, 4, 60, 68, 58, 0],
    [64, 64, 92, 98, 66, 98, 92, 0],
    [0, 0, 60, 66, 64, 66, 60, 0],
    [2, 2, 58, 70, 66, 70, 58, 0],
    [0, 0, 60, 66, 126, 64, 60, 0],
    [12, 18, 16, 124, 16, 16, 16, 0],
    [0, 0, 58, 70, 70, 58, 2, 60],
    [64, 64, 92, 98, 66, 66, 66, 0],
    [8, 0, 24, 8, 8, 8, 28, 0],
    [4, 0, 12, 4, 4, 4, 68, 56],
    [64, 64, 68, 72, 80, 104, 68, 0],
    [24, 8, 8, 8, 8, 8, 28, 0],
    [0, 0, 118, 73, 73, 73, 73, 0],
    [0, 0, 92, 98, 66, 66, 66, 0],
    [0, 0, 60, 66, 66, 66, 60, 0],
    [0, 0, 92, 98, 98, 92, 64, 64],
    [0, 0, 58, 70, 70, 58, 2, 2],
    [0, 0, 92, 98, 64, 64, 64, 0],
    [0, 0, 62, 64, 60, 2, 124, 0],
    [16, 16, 124, 16, 16, 18, 12, 0],
    [0, 0, 66, 66, 66, 66, 60, 0],
    [0, 0, 66, 66, 66, 36, 24, 0],
    [0, 0, 65, 73, 73, 73, 54, 0],
    [0, 0, 68, 40, 16, 40, 68, 0],
    [0, 0, 66, 66, 70, 58, 2, 60],
    [0, 0, 126, 4, 24, 32, 126, 0],
    [8, 8, 8, 8, 255, 8, 8, 8],
    [8, 8, 8, 8, 15, 0, 0, 0],
    [8, 8, 8, 8, 248, 0, 0, 0],
    [8, 8, 8, 8, 15, 8, 8, 8],
    [8, 8, 8, 8, 255, 0, 0, 0],
    [60, 66, 70, 90, 98, 66, 60, 0],
    [8, 24, 40, 8, 8, 8, 62, 0],
    [60, 66, 2, 12, 48, 64, 126, 0],
    [60, 66, 2, 60, 2, 66, 60, 0],
    [4, 12, 20, 36, 126, 4, 4, 0],
    [126, 64, 120, 4, 2, 68, 56, 0],
    [28, 32, 64, 124, 66, 66, 60, 0],
    [126, 66, 4, 8, 16, 16, 16, 0],
    [60, 66, 66, 60, 66, 66, 60, 0],
    [60, 66, 66, 62, 2, 4, 56, 0],
    [0, 0, 0, 126, 0, 0, 0, 0],
    [0, 0, 126, 0, 126, 0, 0, 0],
    [0, 0, 8, 0, 0, 8, 8, 16],
    [0, 2, 4, 8, 16, 32, 64, 0],
    [0, 0, 0, 0, 0, 24, 24, 0],
    [0, 0, 0, 0, 0, 8, 8, 16],
    [0, 255, 0, 0, 0, 0, 0, 0],
    [64, 64, 64, 64, 64, 64, 64, 64],
    [128, 128, 128, 128, 128, 128, 128, 255],
    [1, 1, 1, 1, 1, 1, 1, 255],
    [0, 0, 0, 255, 0, 0, 0, 0],
    [16, 16, 16, 16, 16, 16, 16, 16],
    [255, 255, 0, 0, 0, 0, 0, 0],
    [192, 192, 192, 192, 192, 192, 192, 192],
    [0, 0, 0, 0, 0, 255, 0, 0],
    [4, 4, 4, 4, 4, 4, 4, 4],
    [0, 0, 0, 0, 255, 255, 255, 255],
    [15, 15, 15, 15, 15, 15, 15, 15],
    [0, 0, 0, 0, 0, 0, 0, 255],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 255, 255],
    [3, 3, 3, 3, 3, 3, 3, 3],
    [0, 0, 8, 4, 254, 4, 8, 0],
    [8, 28, 62, 127, 127, 28, 62, 0],
    [255, 127, 63, 31, 15, 7, 3, 1],
    [255, 255, 255, 255, 255, 255, 255, 255],
    [8, 28, 62, 127, 62, 28, 8, 0],
    [0, 0, 16, 32, 127, 32, 16, 0],
    [8, 28, 42, 127, 42, 8, 8, 0],
    [0, 60, 126, 126, 126, 126, 60, 0],
    [0, 60, 66, 66, 66, 66, 60, 0],
    [60, 66, 2, 12, 16, 0, 16, 0],
    [255, 195, 129, 129, 129, 129, 195, 255],
    [0, 0, 0, 0, 3, 4, 8, 8],
    [0, 0, 0, 0, 192, 32, 16, 16],
    [128, 192, 224, 240, 248, 252, 254, 255],
    [1, 3, 7, 15, 31, 63, 127, 255],
    [0, 0, 8, 0, 0, 8, 0, 0],
    [0, 8, 28, 42, 8, 8, 8, 0],
    [14, 24, 48, 96, 48, 24, 14, 0],
    [60, 32, 32, 32, 32, 32, 60, 0],
    [54, 127, 127, 127, 62, 28, 8, 0],
    [60, 4, 4, 4, 4, 4, 60, 0],
    [28, 34, 74, 86, 76, 32, 30, 0],
    [255, 254, 252, 248, 240, 224, 192, 128],
    [112, 24, 12, 6, 12, 24, 112, 0],
    [160, 80, 160, 80, 160, 80, 160, 80],
    [0, 64, 32, 16, 8, 4, 2, 0],
    [170, 85, 170, 85, 170, 85, 170, 85],
    [240, 240, 240, 240, 15, 15, 15, 15],
    [0, 0, 0, 0, 15, 8, 8, 8],
    [0, 0, 0, 0, 248, 8, 8, 8],
    [8, 8, 8, 8, 248, 8, 8, 8],
    [0, 0, 0, 0, 255, 8, 8, 8],
    [0, 0, 1, 62, 84, 20, 20, 0],
    [8, 8, 8, 8, 0, 0, 8, 0],
    [36, 36, 36, 0, 0, 0, 0, 0],
    [36, 36, 126, 36, 126, 36, 36, 0],
    [8, 30, 40, 28, 10, 60, 8, 0],
    [0, 98, 100, 8, 16, 38, 70, 0],
    [48, 72, 72, 48, 74, 68, 58, 0],
    [4, 8, 16, 0, 0, 0, 0, 0],
    [4, 8, 16, 16, 16, 8, 4, 0],
    [32, 16, 8, 8, 8, 16, 32, 0],
    [0, 8, 8, 62, 8, 8, 0, 0],
    [8, 42, 28, 62, 28, 42, 8, 0],
    [15, 15, 15, 15, 240, 240, 240, 240],
    [129, 66, 36, 24, 24, 36, 66, 129],
    [16, 16, 32, 192, 0, 0, 0, 0],
    [8, 8, 4, 3, 0, 0, 0, 0],
    [255, 0, 0, 0, 0, 0, 0, 0],
    [128, 128, 128, 128, 128, 128, 128, 128],
    [255, 128, 128, 128, 128, 128, 128, 128],
    [255, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 255, 0, 0, 0, 0, 0],
    [32, 32, 32, 32, 32, 32, 32, 32],
    [4, 8, 17, 34, 68, 136, 16, 32],
    [32, 16, 136, 68, 34, 17, 8, 4],
    [0, 0, 0, 0, 255, 0, 0, 0],
    [8, 8, 8, 8, 8, 8, 8, 8],
    [255, 255, 255, 255, 0, 0, 0, 0],
    [240, 240, 240, 240, 240, 240, 240, 240],
    [0, 0, 0, 0, 0, 0, 255, 0],
    [2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 255, 255, 255],
    [7, 7, 7, 7, 7, 7, 7, 7],
    [0, 8, 8, 8, 42, 28, 8, 0],
    [16, 254, 32, 124, 2, 2, 252, 0],
    [0, 252, 2, 0, 0, 128, 126, 0],
    [60, 8, 16, 126, 8, 16, 12, 0],
    [64, 64, 64, 64, 68, 68, 56, 0],
    [132, 130, 130, 130, 130, 144, 96, 0],
    [132, 158, 132, 132, 156, 166, 92, 0],
    [16, 126, 8, 126, 4, 2, 96, 24],
    [12, 24, 48, 96, 48, 24, 12, 0],
    [158, 128, 128, 128, 128, 144, 222, 0],
    [16, 126, 16, 126, 16, 112, 156, 114],
    [56, 84, 146, 146, 146, 146, 100, 0],
    [68, 68, 68, 100, 4, 8, 16, 0],
    [32, 248, 32, 248, 34, 34, 28, 0],
    [112, 16, 20, 126, 148, 148, 100, 0],
    [96, 0, 156, 162, 194, 130, 28, 0],
    [68, 68, 254, 68, 88, 64, 62, 0],
    [32, 252, 64, 94, 128, 160, 190, 0],
    [8, 254, 8, 56, 72, 56, 8, 16],
    [32, 34, 44, 48, 64, 128, 126, 0],
    [34, 249, 37, 36, 36, 36, 72, 0],
    [32, 250, 65, 68, 156, 166, 28, 0],
    [224, 38, 69, 132, 132, 136, 112, 0],
    [254, 4, 8, 16, 16, 8, 4, 0],
    [32, 254, 16, 8, 68, 32, 24, 0],
    [16, 32, 32, 112, 72, 136, 134, 0],
    [128, 124, 2, 2, 2, 4, 24, 0],
    [124, 8, 16, 44, 66, 2, 36, 24],
    [132, 190, 132, 132, 132, 132, 72, 0],
    [30, 16, 16, 16, 0, 0, 0, 0],
    [0, 32, 112, 32, 120, 148, 104, 0],
    [0, 0, 88, 228, 40, 32, 16, 0],
    [32, 228, 42, 50, 98, 162, 36, 0],
    [4, 68, 124, 74, 178, 151, 102, 0],
    [56, 0, 16, 74, 74, 138, 48, 0],
    [32, 252, 32, 124, 170, 146, 100, 0],
    [24, 0, 60, 66, 2, 4, 8, 0],
    [16, 0, 124, 8, 16, 40, 70, 0],
    [32, 253, 33, 124, 162, 162, 100, 0],
    [72, 76, 50, 226, 36, 16, 16, 8],
    [8, 156, 170, 202, 202, 140, 24, 0],
    [8, 14, 8, 8, 120, 142, 120, 0],
    [158, 132, 158, 132, 156, 166, 220, 0],
    [0, 32, 80, 136, 4, 2, 2, 0],
    [32, 230, 44, 52, 100, 164, 34, 0],
    [4, 68, 124, 74, 178, 146, 100, 0],
    [124, 8, 16, 60, 66, 26, 36, 24],
    [32, 228, 42, 50, 102, 171, 38, 0],
    [32, 253, 33, 96, 160, 98, 62, 0],
    [0, 0, 0, 0, 8, 8, 8, 120],
    [0, 0, 72, 68, 68, 68, 32, 0],
    [0, 0, 16, 184, 212, 152, 48, 0],
    [16, 254, 32, 116, 184, 72, 126, 0],
    [0, 0, 0, 0, 0, 64, 32, 16],
    [0, 32, 0, 120, 4, 4, 8, 0],
    [0, 0, 32, 56, 32, 120, 96, 0],
    [112, 80, 112, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 32, 0],
    [0, 32, 0, 120, 16, 48, 76, 0],
    [0, 0, 0, 248, 4, 4, 24, 0],
    [32, 144, 64, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 112, 80, 112],
    [0, 32, 116, 32, 120, 164, 104, 0],
    [0, 0, 0, 28, 0, 0, 0, 0],
    [28, 28, 62, 28, 8, 0, 62, 0],
    [255, 247, 247, 247, 213, 227, 247, 255],
    [255, 247, 227, 213, 247, 247, 247, 255],
    [255, 255, 247, 251, 129, 251, 247, 255],
    [255, 255, 239, 223, 129, 223, 239, 255],
    [187, 187, 187, 131, 187, 187, 187, 255],
    [227, 221, 191, 191, 191, 221, 227, 255],
    [24, 36, 126, 255, 90, 36, 0, 0],
    [224, 71, 66, 126, 66, 71, 224, 0],
    [34, 62, 42, 8, 8, 73, 127, 65],
    [28, 28, 8, 62, 8, 8, 20, 34],
    [0, 17, 210, 252, 210, 17, 0, 0],
    [0, 136, 75, 63, 75, 136, 0, 0],
    [34, 20, 8, 8, 62, 8, 28, 28],
    [60, 126, 255, 219, 255, 231, 126, 60],
    [60, 66, 129, 165, 129, 153, 66, 60],
    [62, 34, 34, 62, 34, 34, 62, 0],
    [62, 34, 62, 34, 62, 34, 66, 0],
    [8, 42, 42, 8, 20, 34, 65, 0],
    [8, 9, 58, 12, 28, 42, 73, 0],
    [8, 8, 62, 8, 28, 42, 73, 0],
    [8, 20, 62, 73, 62, 28, 127, 0],
    [0, 8, 8, 62, 8, 8, 127, 0],
    [8, 72, 126, 72, 62, 8, 127, 0],
    [32, 62, 72, 60, 40, 126, 8, 0],
    [4, 126, 84, 127, 82, 127, 10, 0],
    [8, 20, 34, 127, 18, 18, 36, 0],
    [56, 18, 127, 23, 59, 82, 20, 0],
    [127, 73, 73, 127, 65, 65, 65, 0],
    [34, 20, 62, 8, 62, 8, 8, 0],
    [12, 18, 16, 56, 16, 16, 62, 0],
    [0, 192, 200, 84, 84, 85, 34, 0],
    [0, 0, 0, 0, 0, 2, 255, 2],
    [2, 2, 2, 2, 2, 2, 7, 2],
    [2, 2, 2, 2, 2, 2, 255, 2],
    [0, 0, 32, 80, 136, 5, 2, 0],
    [0, 14, 17, 34, 196, 4, 2, 1],
    [0, 255, 0, 129, 66, 66, 129, 0],
    [0, 112, 136, 68, 35, 32, 64, 128],
    [0, 196, 164, 148, 143, 148, 164, 196],
    [0, 35, 37, 41, 241, 41, 37, 35],
    [136, 144, 160, 192, 192, 168, 152, 184],
    [168, 176, 184, 192, 192, 160, 144, 136],
    [128, 64, 32, 16, 31, 32, 64, 128],
    [0, 0, 36, 36, 231, 36, 36, 0],
    [8, 8, 62, 0, 0, 62, 8, 8],
    [8, 16, 32, 16, 8, 4, 2, 4],
    [85, 170, 85, 170, 85, 170, 85, 170],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 112, 112, 112, 0, 0, 0, 0],
    [0, 7, 7, 7, 0, 0, 0, 0],
    [0, 119, 119, 119, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 112, 112, 112],
    [0, 112, 112, 112, 0, 112, 112, 112],
    [0, 7, 7, 7, 0, 112, 112, 112],
    [0, 119, 119, 119, 0, 112, 112, 112],
    [0, 0, 0, 0, 0, 7, 7, 7],
    [0, 112, 112, 112, 0, 7, 7, 7],
    [0, 7, 7, 7, 0, 7, 7, 7],
    [0, 119, 119, 119, 0, 7, 7, 7],
    [0, 0, 0, 0, 0, 119, 119, 119],
    [0, 112, 112, 112, 0, 119, 119, 119],
    [0, 7, 7, 7, 0, 119, 119, 119],
    [0, 119, 119, 119, 0, 119, 119, 119]
];
class FontImage {
    constructor(pattern, fg, bg, width, height) {
        this.getImageData = () => {
            const buf = Array(width * 4 * height).fill(0);
            let index = 0;
            for (let row = 0; row < 8; row++) {
                const bits = pattern[row];
                for (let col = 0; col < 8; col++) {
                    if ((bits & (0x80 >> col)) !== 0) {
                        buf[index + 0] = fg.R;
                        buf[index + 1] = fg.G;
                        buf[index + 2] = fg.B;
                        buf[index + 3] = fg.A;
                    }
                    else {
                        buf[index + 0] = bg.R;
                        buf[index + 1] = bg.G;
                        buf[index + 2] = bg.B;
                        buf[index + 3] = bg.A;
                    }
                    index += 4;
                }
            }
            const array = Uint8ClampedArray.from(buf);
            const imageData = new ImageData(array, width, height);
            this.getImageData = () => imageData;
            return this.getImageData();
        };
    }
}
module.exports = mz700cg;

},{"canvas":34}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mz700charcode = {
    ascii2dispcode: [
        0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0,
        0xf0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0,
        0x00, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6b, 0x6a, 0x2f, 0x2a, 0x2e, 0x2d,
        0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x4f, 0x2c, 0x51, 0x2b, 0x57, 0x49,
        0x55, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x52, 0x59, 0x54, 0x50, 0x45,
        0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf, 0xdf, 0xe7, 0xe8, 0xe9, 0xea, 0xec, 0xed,
        0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde, 0xc0,
        0x80, 0xbd, 0x9d, 0xb1, 0xb5, 0xb9, 0xb4, 0x9e, 0xb2, 0xb6, 0xba, 0xbe, 0x9f, 0xb3, 0xb7, 0xbb,
        0xbf, 0xa3, 0x85, 0xa4, 0xa5, 0xa6, 0x94, 0x87, 0x88, 0x9c, 0x82, 0x98, 0x84, 0x92, 0x90, 0x83,
        0x91, 0x81, 0x9a, 0x97, 0x93, 0x95, 0x89, 0xa1, 0xaf, 0x8b, 0x86, 0x96, 0xa2, 0xab, 0xaa, 0x8a,
        0x8e, 0xb0, 0xad, 0x8d, 0xa7, 0xa8, 0xa9, 0x8f, 0x8c, 0xae, 0xac, 0x9b, 0xa0, 0x99, 0xbc, 0xb8,
        0x40, 0x3b, 0x3a, 0x70, 0x3c, 0x71, 0xef, 0x3d, 0x43, 0x56, 0x3f, 0x1e, 0x4a, 0x1c, 0x5d, 0x3e,
        0x5c, 0x1f, 0x5f, 0x5e, 0x37, 0x7b, 0x7f, 0x36, 0x7a, 0x7e, 0x33, 0x4b, 0x4c, 0x1d, 0x6c, 0x5b,
        0x78, 0x41, 0x35, 0x34, 0x74, 0x30, 0x38, 0x75, 0x39, 0x4d, 0x6f, 0x6e, 0x32, 0x77, 0x76, 0x72,
        0x73, 0x47, 0x7c, 0x53, 0x31, 0x4e, 0x6d, 0x48, 0x46, 0x7d, 0x44, 0x1b, 0x58, 0x79, 0x42, 0x60,
    ],
};
exports.default = mz700charcode;
module.exports = mz700charcode;

},{}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NumberUtil {
    static zs(num, base, columns) {
        const s = num.toString(base);
        if (s.length > columns) {
            return s;
        }
        return (`${(new Array(columns)).fill("0").join("")}${s}`).slice(-columns);
    }
    static bin(num, columns) {
        return NumberUtil.zs(num, 2, columns);
    }
    static hex(num, columns) {
        return NumberUtil.zs(num, 16, columns).toUpperCase();
    }
    static HEX(num, columns) {
        return NumberUtil.zs(num, 16, columns).toUpperCase();
    }
    static to8bitSigned(i8u) {
        if ((~0xff & i8u) !== 0) {
            throw new Error([
                `Invalid input value ${i8u}`,
                `(should be between 0 and 255)`,
            ].join(" "));
        }
        if (i8u >= 128) {
            return -(~(i8u - 1) & 0xff);
        }
        return i8u | 0;
    }
    static to8bitUnsigned(i8s) {
        if (i8s < -128 || 127 < i8s) {
            throw new Error([
                `Invalid input value ${i8s}`,
                `(should be between -128 and 127)`,
            ].join(" "));
        }
        if (i8s < 0) {
            return ~(-(i8s + 1)) & 0xff;
        }
        return i8s | 0;
    }
}
exports.default = NumberUtil;
module.exports = NumberUtil;

},{}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function oct(s) {
    return parseInt(s, 8);
}
exports.default = oct;
module.exports = oct;

},{}],29:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bin_util_1 = __importDefault(require("../Z80/bin-util"));
const parseAddress = {
    parseAddress: (addrToken, mapLabelToAddress) => {
        const bytes = parseAddress.parseNumLiteralPair(addrToken);
        if (bytes == null) {
            return null;
        }
        let H = bytes[1];
        let L = bytes[0];
        if (mapLabelToAddress != null) {
            if (typeof (H) === "function") {
                H = H(mapLabelToAddress);
            }
            if (typeof (L) === "function") {
                L = L(mapLabelToAddress);
            }
        }
        else if (typeof (H) === "function" || typeof (L) === "function") {
            return null;
        }
        const addr = bin_util_1.default.pair(H, L);
        return addr;
    },
    parseNumLiteral: (tok) => {
        const n = parseAddress._parseNumLiteral(tok);
        if (typeof (n) === 'number') {
            if (n < -128 || 256 <= n) {
                throw 'operand ' + tok + ' out of range';
            }
            return n & 0xff;
        }
        return ((dictionary) => parseAddress.dereferLowByte(tok, dictionary));
    },
    parseNumLiteralPair: (tok) => {
        const n = parseAddress._parseNumLiteral(tok);
        if (typeof (n) === 'number') {
            if (n < -32768 || 65535 < n) {
                throw 'operand ' + tok + ' out of range';
            }
            return [n & 0xff, (n >> 8) & 0xff];
        }
        return [
            dictionary => (parseAddress.dereferLowByte(tok, dictionary)),
            dictionary => (parseAddress.dereferHighByte(tok, dictionary)),
        ];
    },
    parseRelAddr: (tok, fromAddr) => {
        let n = parseAddress._parseNumLiteral(tok);
        if (typeof (n) === 'number') {
            const c0 = tok.charAt(0);
            if (c0 !== '+' && c0 !== '-') {
                n = n - fromAddr + 2;
            }
            n -= 2;
            if (n < -128 || 256 <= n) {
                throw 'operand ' + tok + ' out of range';
            }
            return n & 0xff;
        }
        return (dictionary => ((parseAddress.derefer(tok, dictionary) - fromAddr) & 0xff));
    },
    dereferLowByte: (label, dictionary) => {
        return parseAddress.derefer(label, dictionary) & 0xff;
    },
    dereferHighByte: (label, dictionary) => {
        return (parseAddress.derefer(label, dictionary) >> 8) & 0xff;
    },
    derefer: (label, dictionary) => {
        if (label in dictionary) {
            return dictionary[label];
        }
        return 0;
    },
    _parseNumLiteral: (tok) => {
        if (/^[+-]?[0-9]+$/.test(tok) || /^[+-]?[0-9A-F]+H$/i.test(tok)) {
            let matches;
            let n = 0;
            const s = (/^-/.test(tok) ? -1 : 1);
            if (/[hH]$/.test(tok)) {
                matches = tok.match(/^[+-]?([0-9a-fA-F]+)[hH]$/);
                n = parseInt(matches[1], 16);
            }
            else if (/^[+-]?0/.test(tok)) {
                matches = tok.match(/^[+-]?([0-7]+)$/);
                n = parseInt(matches[1], 8);
            }
            else {
                matches = tok.match(/^[+-]?([0-9]+)$/);
                n = parseInt(matches[1], 10);
            }
            return s * n;
        }
        return tok;
    },
};
exports.default = parseAddress;
module.exports = parseAddress;

},{"../Z80/bin-util":8}],30:[function(require,module,exports){
(function (global){
'use strict';

var objectAssign = require('object-assign');

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:
// NB: The URL to the CommonJS spec is kept just for tradition.
//     node-assert has evolved a lot since then, both in API and behavior.

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

// Expose a strict only variant of assert
function strict(value, message) {
  if (!value) fail(value, true, message, '==', strict);
}
assert.strict = objectAssign(strict, assert, {
  equal: assert.strictEqual,
  deepEqual: assert.deepStrictEqual,
  notEqual: assert.notStrictEqual,
  notDeepEqual: assert.notDeepStrictEqual
});
assert.strict.strict = assert.strict;

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"object-assign":37,"util/":33}],31:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],32:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],33:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":32,"_process":38,"inherits":31}],34:[function(require,module,exports){
/* globals document, ImageData */

const parseFont = require('./lib/parse-font')

exports.parseFont = parseFont

exports.createCanvas = function (width, height) {
  return Object.assign(document.createElement('canvas'), { width: width, height: height })
}

exports.createImageData = function (array, width, height) {
  // Browser implementation of ImageData looks at the number of arguments passed
  switch (arguments.length) {
    case 0: return new ImageData()
    case 1: return new ImageData(array)
    case 2: return new ImageData(array, width)
    default: return new ImageData(array, width, height)
  }
}

exports.loadImage = function (src, options) {
  return new Promise(function (resolve, reject) {
    const image = Object.assign(document.createElement('img'), options)

    function cleanup () {
      image.onload = null
      image.onerror = null
    }

    image.onload = function () { cleanup(); resolve(image) }
    image.onerror = function () { cleanup(); reject(new Error('Failed to load the image "' + src + '"')) }

    image.src = src
  })
}

},{"./lib/parse-font":35}],35:[function(require,module,exports){
'use strict'

/**
 * Font RegExp helpers.
 */

const weights = 'bold|bolder|lighter|[1-9]00'
  , styles = 'italic|oblique'
  , variants = 'small-caps'
  , stretches = 'ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded'
  , units = 'px|pt|pc|in|cm|mm|%|em|ex|ch|rem|q'
  , string = '\'([^\']+)\'|"([^"]+)"|[\\w\\s-]+'

// [ [ <‘font-style’> || <font-variant-css21> || <‘font-weight’> || <‘font-stretch’> ]?
//    <‘font-size’> [ / <‘line-height’> ]? <‘font-family’> ]
// https://drafts.csswg.org/css-fonts-3/#font-prop
const weightRe = new RegExp('(' + weights + ') +', 'i')
const styleRe = new RegExp('(' + styles + ') +', 'i')
const variantRe = new RegExp('(' + variants + ') +', 'i')
const stretchRe = new RegExp('(' + stretches + ') +', 'i')
const sizeFamilyRe = new RegExp(
  '([\\d\\.]+)(' + units + ') *'
  + '((?:' + string + ')( *, *(?:' + string + '))*)')

/**
 * Cache font parsing.
 */

const cache = {}

const defaultHeight = 16 // pt, common browser default

/**
 * Parse font `str`.
 *
 * @param {String} str
 * @return {Object} Parsed font. `size` is in device units. `unit` is the unit
 *   appearing in the input string.
 * @api private
 */

module.exports = function (str) {
  // Cached
  if (cache[str]) return cache[str]

  // Try for required properties first.
  const sizeFamily = sizeFamilyRe.exec(str)
  if (!sizeFamily) return // invalid

  // Default values and required properties
  const font = {
    weight: 'normal',
    style: 'normal',
    stretch: 'normal',
    variant: 'normal',
    size: parseFloat(sizeFamily[1]),
    unit: sizeFamily[2],
    family: sizeFamily[3].replace(/["']/g, '').replace(/ *, */g, ',')
  }

  // Optional, unordered properties.
  let weight, style, variant, stretch
  // Stop search at `sizeFamily.index`
  let substr = str.substring(0, sizeFamily.index)
  if ((weight = weightRe.exec(substr))) font.weight = weight[1]
  if ((style = styleRe.exec(substr))) font.style = style[1]
  if ((variant = variantRe.exec(substr))) font.variant = variant[1]
  if ((stretch = stretchRe.exec(substr))) font.stretch = stretch[1]

  // Convert to device units. (`font.unit` is the original unit)
  // TODO: ch, ex
  switch (font.unit) {
    case 'pt':
      font.size /= 0.75
      break
    case 'pc':
      font.size *= 16
      break
    case 'in':
      font.size *= 96
      break
    case 'cm':
      font.size *= 96.0 / 2.54
      break
    case 'mm':
      font.size *= 96.0 / 25.4
      break
    case '%':
      // TODO disabled because existing unit tests assume 100
      // font.size *= defaultHeight / 100 / 0.75
      break
    case 'em':
    case 'rem':
      font.size *= defaultHeight / 0.75
      break
    case 'q':
      font.size *= 96 / 25.4 / 4
      break
  }

  return (cache[str] = font)
}

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
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],38:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],39:[function(require,module,exports){
"use strict";
const TransWorker = require("./lib/transworker.js");
const DedicatedTransWorker = TransWorker;
const SharedTransWorker = require("./lib/shared-transworker.js");
const WebSocketClient = require("./lib/websocket-client.js");
const WebSocketServer = require("./lib/websocket-server.js");
TransWorker.Options = require("./lib/transworker-options.js");
TransWorker.WebSocketClient = WebSocketClient;
TransWorker.WebSocketServer = WebSocketServer;


/**
 * Create a worker and an interface instance for the thread.
 *
 * @param {string} workerUrl A worker url. It must use TransWorker.
 * @param {Function} clientCtor client-class constructor.
 * @param {TransWorker.Options} options Options to create a wrapper object for
 *      the main thread.
 * @returns {Transworker} The created TransWorker instance.
 */
TransWorker.createInterface = function(workerUrl, clientCtor, options) {
    options = options || new TransWorker.Options();
    if(workerUrl.constructor !== TransWorker.Options) {
        options = new TransWorker.Options(options);
    }

    const transworker = options.shared ? 
        new SharedTransWorker() : new DedicatedTransWorker();
    transworker._shared = options.shared;
    transworker._syncType = options.syncType;
    transworker.createInvoker(workerUrl, clientCtor);
    return transworker;
};

/**
 * Create a main thread instance for dedicated worker.
 *
 * @param {string} workerUrl A worker url. It must use TransWorker.
 * @param {Function} clientCtor client-class constructor.
 * @param {object} thisObject (Optional) A caller of callback and notification.
 * @param {object} notifyHandlers A map a notification name to the handler.
 * @returns {Transworker} The created Transworker instance.
 */
TransWorker.createInvoker = function(
        workerUrl, clientCtor,
        thisObject, notifyHandlers)
{
    const transworker = new DedicatedTransWorker();
    transworker._syncType = TransWorker.SyncTypeCallback;
    transworker.createInvoker(
        workerUrl, clientCtor,
        thisObject, notifyHandlers);
    return transworker;
};

/**
 * Create a main thread instance for shared worker.
 *
 * @param {string} workerUrl A worker url. It must use TransWorker.
 * @param {Function} clientCtor client-class constructor.
 * @param {object} thisObject (Optional) A caller of callback and notification.
 * @param {object} notifyHandlers A map a notification name to the handler.
 * @returns {Transworker} The created Transworker instance.
 */
TransWorker.createSharedInvoker = function(
        workerUrl, clientCtor,
        thisObject, notifyHandlers)
{
    const transworker = new SharedTransWorker();
    transworker._syncType = TransWorker.SyncTypeCallback;
    transworker.createInvoker(
        workerUrl, clientCtor,
        thisObject, notifyHandlers);
    return transworker;
};

/**
 * Create a worker side instance of DedicatedTransWorker.
 *
 * @param {object} client An instance of the client class.
 * @returns {TransWorker} an instance of TransWorker.
 */
TransWorker.createWorker = function(client) {
    const transworker = new DedicatedTransWorker();
    if(typeof(client) == 'function') {
        client = new client();
    }
    transworker.createWorker(client);
    return transworker;
};

/**
 * Create a worker side instance of SharedTransWorker.
 *
 * @param {object} client An instance of the client class.
 * @returns {TransWorker} an instance of TransWorker.
 */
TransWorker.createSharedWorker = function(client) {
    const transworker = new SharedTransWorker();
    if(typeof(client) == 'function') {
        client = new client();
    }
    transworker.createWorker(client);
    return transworker;
};

module.exports = TransWorker;

},{"./lib/shared-transworker.js":40,"./lib/transworker-options.js":41,"./lib/transworker.js":42,"./lib/websocket-client.js":43,"./lib/websocket-server.js":44}],40:[function(require,module,exports){
"use strict";
const TransWorker = require("./transworker.js");
function SharedTransWorker() {
}
SharedTransWorker.prototype = new TransWorker();
SharedTransWorker.prototype.subscribeWorkerConsole = function() {
    this.subscribe("TransWorker.post_log", msg => console.log(msg));
    this.subscribe("TransWorker.post_error", msg => console.err(msg));
    this.subscribe("TransWorker.post_warn", msg => console.warn(msg));
};

SharedTransWorker.prototype.connectWorker = function(workerUrl) {
    this.worker = new SharedWorker(workerUrl);
    this.messagePort = this.worker.port;
    this.messagePort.onmessage =
        this.onReceiveWorkerMessage.bind(this);
    this.messagePort.start();
};
SharedTransWorker.prototype.publishWorkerConsole = function() {
    const originalConsole = {
        "log": this.worker.console.log,
        "warn": this.worker.console.warn,
        "error": this.worker.console.error,
    };
    const writeConsole = (method, args) => {
        if(this.messagePort) {
            this.postNotify(`TransWorker.post_${method}`, args.join(" "));
        } else {
            originalConsole[method].apply(this.worker, args);
        }
    };
    this.worker.console = {
        "log"  : (...args) => writeConsole("log", args),
        "error": (...args) => writeConsole("error", args),
        "warn" : (...args) => writeConsole("warn", args),
    };
};
SharedTransWorker.prototype.setupOnConnect = function() {
    this.worker.onconnect = e => {
        this.messagePort = e.ports[0];
        this.messagePort.addEventListener(
            "message", this.onReceiveClientMessage.bind(this));
        this.messagePort.start();
    }
};
module.exports = SharedTransWorker;

},{"./transworker.js":42}],41:[function(require,module,exports){
"use strict";
const assert = require("assert");
const TransWorker = require("./transworker.js");

/**
 * Options fot a TransWorker object.
 * @constructor
 * @param {object} options an option object
 */
function TransWorkerOptions(options) {
    options = options || {
        shared: false,
        syncType: TransWorker.SyncTypeCallback,
    };
    options.shared = (options.shared != null ? options.shared : false);
    options.syncType = (options.syncType != null ? options.syncType :
        TransWorker.SyncTypeCallback);
    assert.ok(typeof(options.shared) === "boolean" && (
        options.syncType === TransWorker.SyncTypeCallback ||
        options.syncType === TransWorker.SyncTypePromise));
    this.shared = options.shared;
    this.syncType = options.syncType;
}

module.exports = TransWorkerOptions;

},{"./transworker.js":42,"assert":30}],42:[function(require,module,exports){
"use strict";
const { v4: uuidv4 } = require("uuid");

const globalContext = (Function("return this;")());
let globalContextName = globalContext.constructor.name;
if(!globalContextName) {
    // Browser is NOT webkit, perhaps IE11
    if(globalContext == "[object Window]") {
        globalContextName = "Window";
    } else if(globalContext == "[object WorkerGlobalScope]") {
        globalContextName = "DedicatedWorkerGlobalScope";
    }
}
//
// `globalContextName` takes one of following value:
//
// * "Window"
// * "DedicatedWorkerGlobalScope"
// * "SharedWorkerGlobalScope"
// * "ServiceWorkerGlobalScope"
// * "DedicatedWorkerGlobalScope"
//

/**
 * TransWorker - Inter thread method invocation helper class for the WebWorker.
 *
 * This class offers different implementations for its role on the context.
 *
 * In the main thread, It creates WebWorker instance and creates wrapper
 * functions for all the methods declared in the prototypes of the class given
 * in the parameters.
 *
 * The wrapper method sends a message to the worker with the method name and
 * all the parameter.
 *
 * When the worker side instance received the message, it invokes the method
 * specified by the name in the message with the parameters.
 * The return value will be notified by the message to the main thread
 * instance from the worker.
 *
 * The main thread instance that received the notification notifies the value
 * to the callback function given at first invocation.
 *
 * LICENSE
 *
 * Released under the MIT license
 * http://opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2017 Koji Takami(vzg03566@gmail.com)
 *
 * @constructor
 */
function TransWorker(){
    if(globalContextName == "Window") {
        // fields for the main thread
        this.callbacks = {};
        this._uuid = uuidv4();
        this.queryId = 0;
        this._onNotify = {};
        this._callbacker = null;
    } else {
        // fields for the worker thread
        this.worker = globalContext;
        this.client = null;
        this.messagePort = null;
        this._txObjReceiver = {};
    }
}

TransWorker.context = globalContextName;

/**
 * A literal for the interface methods to synchronize with a callback.
 * @type {Function}
 */
TransWorker.SyncTypeCallback = Function;

/**
 * A literal for the interface methods to synchronize with a Promise.
 * @type {Function}
 */
TransWorker.SyncTypePromise = Promise;

/**
 * Create instance for main thread.
 *
 * @param {string} workerUrl A worker url. It must use TransWorker.
 * @param {Function} clientCtor client-class constructor.
 * @param {object} thisObject (Optional) A caller of callback and notification.
 * @param {object} notifyHandlers A map a notification name to the handler.
 * @returns {undefined}
 */
TransWorker.prototype.createInvoker = function(
        workerUrl, clientCtor,
        thisObject, notifyHandlers)
{
    this._callbacker = thisObject;

    // Create prototype entries same to the client
    const methodNames = Object.keys(clientCtor.prototype)
    if(this._syncType === TransWorker.SyncTypePromise) {
        for(const methodName of methodNames) {
            this[methodName] = this.createPromiseWrapper(methodName).bind(this);
        }
    } else {
        for(const methodName of methodNames) {
            this[methodName] = this.createCallbackWrapper(methodName).bind(this);
        }
    }

    // Entry the handlers to receive notifies
    notifyHandlers = notifyHandlers || {};
    Object.keys(notifyHandlers).forEach(key => {
        if(!(name in this._onNotify)) {
            this._onNotify[key] = [];
        }
        this._onNotify[key].push((...args) => {
            notifyHandlers[key].apply(this._callbacker, args);
        });
    });

    this.subscribeWorkerConsole();

    return this.connectWorker(workerUrl);
};

TransWorker.prototype.onReceiveWorkerMessage = function(e) {
    switch(e.data.type) {
    case 'response':
        try {
            if(e.data.uuid !== this._uuid) {
                break;
            }
            this.callbacks[e.data.queryId].apply(
                    this._callbacker, e.data.param);
        } catch(ex) {
            console.warn("*** exception: ", ex,
                "in method", e.data.method, "params:",
                JSON.stringify(e.data.param));
        }
        delete this.callbacks[e.data.queryId];
        break;
    case 'notify':
        try {
            this._onNotify[e.data.name].forEach(
                notify => notify(e.data.param));
        } catch(ex) {
            console.warn("*** exception: ", ex,
                "in notify", e.data.name, "params:",
                JSON.stringify(e.data.param));
        }
        break;
    }
};

/**
 * @virtual
 * @param {string} workerURL A URL for the worker or server.
 * @returns {undefined}
 */
TransWorker.prototype.connectWorker = function(workerURL) {
    // Load dedicated worker
    this.worker = new Worker(workerURL);
    this.messagePort = this.worker;
    this.messagePort.onmessage =
        this.onReceiveWorkerMessage.bind(this);
};

/**
 * @virtual
 * @returns {undefined}
 */
TransWorker.prototype.subscribeWorkerConsole = function() {
    // NO IMPLEMENTATION on this class
};

/**
 * Register a notification to receive a message from the worker thread.
 * @param {string} name A notification name.
 * @param {Function} handler A notification handler.
 * @returns {undefined}
 */
TransWorker.prototype.subscribe = function(name, handler) {
    if(!handler || typeof(handler) !== "function") {
        throw new Error(
            `Could not subscribe to '${name}' with the handler of non-function`);
    }
    if(!(name in this._onNotify)) {
        this._onNotify[name] = [];
    }
    this._onNotify[name].push((...args) => handler.apply(this, args));
};

/**
 * Create client method wrapper
 * @param {string} methodName A method name to override.
 * @returns {Function} A wrapper function.
 */
TransWorker.prototype.createCallbackWrapper = function(methodName)
{
    return (...param) => {
        try {
            const queryId = this.queryId++;
            if(param.length > 0 && typeof(param.slice(-1)[0]) === "function") {
                this.callbacks[queryId] = param.splice(-1, 1)[0];
            } else {
                this.callbacks[queryId] = (()=>{});
            }
            this.postMessage({
                method: methodName,
                param: param,
                uuid: this._uuid,
                queryId: queryId
            });
        } catch(err) {
            console.error(err.stack);
        }
    };
};

/**
 * Post message.
 * @param {object} message a message object.
 * @param {Array<TransferableObject>|null}  transObjList An array of
 *      objects to be transfered
 * @returns {undefined}
 */
TransWorker.prototype.postMessage = function(message, transObjList) {
    this.messagePort.postMessage(message, transObjList);
};

/**
 * Invoke a remote method and returns a promise object that will resolved with
 * its return value.
 * (for only UI thread)
 * @param {string}  methodName  A name of the object to be transfered
 * @param {Array<any>}  paramList   An array of parameters
 * @param {Array<TransferableObject>|null}  transObjList An array of
 *      objects to be transfered
 * @returns {Promise<any>}  A promise object. The fulfillment value is the return
 *      value of the remote method
 */
TransWorker.prototype.invokeMethod = function(
    methodName, paramList, transObjList)
{
    return new Promise((resolve, reject) => {
        try {
            const queryId = this.queryId++;
            this.callbacks[queryId] = (result => resolve(result));
            this.postMessage({
                method: methodName,
                param: paramList,
                uuid: this._uuid,
                queryId: queryId
            }, transObjList);
        } catch(err) {
            reject(err);
        }
    });
}

/**
 * Create client method wrapper that returns a promise that will be resolved
 * by a value that remote method returns.
 * @param {string} methodName A method name to override.
 * @returns {Function} A wrapper function.
 */
TransWorker.prototype.createPromiseWrapper = function(methodName)
{
    return (...param) => {
        return this.invokeMethod(methodName, param);
    };
};

/**
 * Transfer an object to the worker.
 * (for only UI thread)
 * @param {string}  objName A name of the object to be transfered
 * @param {Transferable}  transferableObj An object to be transfered
 * @returns {Promise<any>} A promise to be resolved a value returned by worker
 *      side method
 */
TransWorker.prototype.transferObject = function(objName, transferableObj)
{
    return this.invokeMethod(
        "onTransferableObject",
        [objName, transferableObj],
        [transferableObj]);
}

/**
 * Create Worker side TransWorker instance.
 *
 * @param {object} client A instance of the client class.
 * @returns {undefined}
 */
TransWorker.prototype.createWorker = function(client) {
    this.client = client;

    // Make the client to be able to use this module
    this.client._transworker = this;

    this.publishWorkerConsole();

    // Override subclass methods by this context
    this.injectSubClassMethod();

    this.setupOnConnect();
};

TransWorker.prototype.injectSubClassMethod = function() {
    Object.keys(this.constructor.prototype)
    .forEach(m => {
        this.client[m] = ((...args) => {
            this.constructor.prototype[m].apply(this, args);
        });
    });
};

/**
 * @virtual
 * @returns {undefined}
 */
TransWorker.prototype.publishWorkerConsole = function() {
    // NO IMPLEMENTATION on this class
};

/**
 * @virtual
 * @returns {undefined}
 */
TransWorker.prototype.setupOnConnect = function() {
    this.messagePort = this.worker;
    this.messagePort.onmessage = this.onReceiveClientMessage.bind(this);
};

// On receive a message, invoke the client
// method and post back its value.
TransWorker.prototype.onReceiveClientMessage = function(e) {
    const returnResult = value => {
        this.postMessage({
            type:'response',
            uuid: e.data.uuid,
            queryId: e.data.queryId,
            method: e.data.method,
            param: [ value ],
        });
    };

    const onError = ex => {
        console.warn("*** exception: ", ex,
            "in method", e.data.method, "params:",
            JSON.stringify(e.data.param));
    };

    try {
        const result = this.client[e.data.method].apply(
            this.client, e.data.param);
        if(result && result.constructor === Promise) {
            result.then( fulfillment => {
                returnResult(fulfillment);
            }).catch(ex => {
                onError(ex);
            });
        } else {
            returnResult(result);
        }
    } catch(ex) {
        onError(ex);
    }
};

/**
 * Post a notify to the UI-thread TransWorker instance
 * @param {string} name A message name.
 * @param {any} param A message parameters.
 * @returns {undefined}
 */
TransWorker.prototype.postNotify = function(name, param) {
    this.postMessage({
        type:'notify',
        name: name,
        param: param
    });
};

/**
 * A primary receiver for a transferable object.
 * (for only Worker instance)
 * @param {string}  objName A name of the object to be transfered
 * @param {Transferable}  transferableObj An object to be transfered
 * @returns {undefined}
 */
TransWorker.prototype.onTransferableObject = function(objName, transferableObj)
{
    this._txObjReceiver[objName](transferableObj);
}

/**
 * Enter a handler to receive a transferable object.
 * (for only Worker instance)
 * @param {string}  objName A name of the object to receive
 * @param {Function} handler A callback function to receive the object
 * @returns {undefined}
 */
TransWorker.prototype.listenTransferableObject = function(objName, handler)
{
    this._txObjReceiver[objName] = handler;
}

// Exports
if(TransWorker.context == 'Window') {
    TransWorker.prototype.create = TransWorker.prototype.createInvoker;
    TransWorker.create = TransWorker.createInvoker;
}
else if( TransWorker.context == 'DedicatedWorkerGlobalScope'
        || TransWorker.context == 'WorkerGlobalScope')
{
    TransWorker.prototype.create = TransWorker.prototype.createWorker;
    TransWorker.create = TransWorker.createWorker;
}

globalContext.TransWorker = TransWorker;
module.exports = TransWorker;

},{"uuid":45}],43:[function(require,module,exports){
"use strict";
const TransWorker = require("./transworker.js");
TransWorker.Options = require("./transworker-options.js");

/**
 * @class
 */
class WebSocketClient extends TransWorker {
    /**
     * Create a worker and an interface instance for the thread.
     *
     * @param {string} wssUrl A WebSocket server url.
     * @param {Function} clientCtor client-class constructor.
     * @param {TransWorker.Options} options Options to create a wrapper object for
     *      the main thread.
     * @returns {Promise<Transworker>} The created TransWorker instance.
     */
    static createInterface(wssUrl, clientCtor, options) {
        options = options || new TransWorker.Options();
        if(options.constructor !== TransWorker.Options) {
            options = new TransWorker.Options(options);
        }

        const transworker = new TransWorker.WebSocketClient();
        transworker._shared = false;
        transworker._syncType = options.syncType;
        return transworker.createInvoker(wssUrl, clientCtor).then(() => {
            return transworker;
        });
    }

    /**
     * Connect to a WebSocket server.
     * @param {string} url WebSocket server end point.
     * @returns {Promise} A promise that is resolved when the connection is
     * establish.
     */
    connectWorker(url) {
        return new Promise((resolve, reject) => {
            try {
                const ws = new WebSocket(url);
                this.worker = null;
                this.messagePort = ws;
                this.messagePort.onmessage = e => {
                    const data = JSON.parse(e.data);
                    this.onReceiveWorkerMessage({data});
                };
                ws.onopen = () => {
                    resolve();
                };
            } catch(err) {
                reject(err);
            }
        });
    }

    /**
     * Post message.
     * @param {object} message a message object.
     * @returns {undefined}
     */
    postMessage(message) {
        this.messagePort.send(JSON.stringify(message));
    }
}
module.exports = WebSocketClient;

},{"./transworker-options.js":41,"./transworker.js":42}],44:[function(require,module,exports){
"use strict";
const WebSocket = require("ws");
const TransWorker = require("./transworker.js");

/**
 * @class
 */
class WebSocketServer extends TransWorker {
    /**
     * Start to listen client connections.
     * @param {http.server} server HTTP server
     * @param {Function} createClient A function to create clientninstance
     * @returns {undefined}
     */
    static listen(server, createClient) {
        this.wss = new WebSocket.Server({server});
        this.wss.on("connection", ws => {
            const transworker = new WebSocketServer();
            transworker.worker = null;
            transworker.messagePort = ws;
            transworker.messagePort.onmessage = e => {
                const data = JSON.parse(e.data);
                transworker.onReceiveClientMessage({data});
            };
            const client = createClient(transworker);
            transworker.client = client;
            transworker.client._transworker = this;
            transworker.injectSubClassMethod();
        });
    }

    /**
     * Post message.
     * @param {object} message a message object.
     * @returns {undefined}
     */
    postMessage(message) {
        this.messagePort.send(JSON.stringify(message));
    }
}
module.exports = WebSocketServer;

},{"./transworker.js":42,"ws":60}],45:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "v1", {
  enumerable: true,
  get: function () {
    return _v.default;
  }
});
Object.defineProperty(exports, "v3", {
  enumerable: true,
  get: function () {
    return _v2.default;
  }
});
Object.defineProperty(exports, "v4", {
  enumerable: true,
  get: function () {
    return _v3.default;
  }
});
Object.defineProperty(exports, "v5", {
  enumerable: true,
  get: function () {
    return _v4.default;
  }
});
Object.defineProperty(exports, "NIL", {
  enumerable: true,
  get: function () {
    return _nil.default;
  }
});
Object.defineProperty(exports, "version", {
  enumerable: true,
  get: function () {
    return _version.default;
  }
});
Object.defineProperty(exports, "validate", {
  enumerable: true,
  get: function () {
    return _validate.default;
  }
});
Object.defineProperty(exports, "stringify", {
  enumerable: true,
  get: function () {
    return _stringify.default;
  }
});
Object.defineProperty(exports, "parse", {
  enumerable: true,
  get: function () {
    return _parse.default;
  }
});

var _v = _interopRequireDefault(require("./v1.js"));

var _v2 = _interopRequireDefault(require("./v3.js"));

var _v3 = _interopRequireDefault(require("./v4.js"));

var _v4 = _interopRequireDefault(require("./v5.js"));

var _nil = _interopRequireDefault(require("./nil.js"));

var _version = _interopRequireDefault(require("./version.js"));

var _validate = _interopRequireDefault(require("./validate.js"));

var _stringify = _interopRequireDefault(require("./stringify.js"));

var _parse = _interopRequireDefault(require("./parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
},{"./nil.js":47,"./parse.js":48,"./stringify.js":52,"./v1.js":53,"./v3.js":54,"./v4.js":56,"./v5.js":57,"./validate.js":58,"./version.js":59}],46:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

/*
 * Browser-compatible JavaScript MD5
 *
 * Modification of JavaScript MD5
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
function md5(bytes) {
  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = new Uint8Array(msg.length);

    for (let i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }

  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
/*
 * Convert an array of little-endian words to an array of bytes
 */


function md5ToHexEncodedArray(input) {
  const output = [];
  const length32 = input.length * 32;
  const hexTab = '0123456789abcdef';

  for (let i = 0; i < length32; i += 8) {
    const x = input[i >> 5] >>> i % 32 & 0xff;
    const hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
    output.push(hex);
  }

  return output;
}
/**
 * Calculate output length with padding and bit length
 */


function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */


function wordsToMd5(x, len) {
  /* append padding */
  x[len >> 5] |= 0x80 << len % 32;
  x[getOutputLength(len) - 1] = len;
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}
/*
 * Convert an array bytes to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */


function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }

  const length8 = input.length * 8;
  const output = new Uint32Array(getOutputLength(length8));

  for (let i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
  }

  return output;
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */


function safeAdd(x, y) {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xffff;
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */


function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */


function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

var _default = md5;
exports.default = _default;
},{}],47:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = '00000000-0000-0000-0000-000000000000';
exports.default = _default;
},{}],48:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  let v;
  const arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

var _default = parse;
exports.default = _default;
},{"./validate.js":58}],49:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
exports.default = _default;
},{}],50:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = rng;
// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
// getRandomValues needs to be invoked in a context where "this" is a Crypto implementation. Also,
// find the complete implementation of crypto (msCrypto) on IE11.
const getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);
const rnds8 = new Uint8Array(16);

function rng() {
  if (!getRandomValues) {
    throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
  }

  return getRandomValues(rnds8);
}
},{}],51:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

// Adapted from Chris Veness' SHA1 code at
// http://www.movable-type.co.uk/scripts/sha1.html
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;

    case 1:
      return x ^ y ^ z;

    case 2:
      return x & y ^ x & z ^ y & z;

    case 3:
      return x ^ y ^ z;
  }
}

function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}

function sha1(bytes) {
  const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = [];

    for (let i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    // Convert Array-like to Array
    bytes = Array.prototype.slice.call(bytes);
  }

  bytes.push(0x80);
  const l = bytes.length / 4 + 2;
  const N = Math.ceil(l / 16);
  const M = new Array(N);

  for (let i = 0; i < N; ++i) {
    const arr = new Uint32Array(16);

    for (let j = 0; j < 16; ++j) {
      arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
    }

    M[i] = arr;
  }

  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;

  for (let i = 0; i < N; ++i) {
    const W = new Uint32Array(80);

    for (let t = 0; t < 16; ++t) {
      W[t] = M[i][t];
    }

    for (let t = 16; t < 80; ++t) {
      W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];

    for (let t = 0; t < 80; ++t) {
      const s = Math.floor(t / 20);
      const T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }

    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }

  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
}

var _default = sha1;
exports.default = _default;
},{}],52:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).substr(1));
}

function stringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  const uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

var _default = stringify;
exports.default = _default;
},{"./validate.js":58}],53:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _rng = _interopRequireDefault(require("./rng.js"));

var _stringify = _interopRequireDefault(require("./stringify.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;

let _clockseq; // Previous uuid creation time


let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || _rng.default)();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || (0, _stringify.default)(b);
}

var _default = v1;
exports.default = _default;
},{"./rng.js":50,"./stringify.js":52}],54:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("./v35.js"));

var _md = _interopRequireDefault(require("./md5.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v3 = (0, _v.default)('v3', 0x30, _md.default);
var _default = v3;
exports.default = _default;
},{"./md5.js":46,"./v35.js":55}],55:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.URL = exports.DNS = void 0;

var _stringify = _interopRequireDefault(require("./stringify.js"));

var _parse = _interopRequireDefault(require("./parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  const bytes = [];

  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
exports.DNS = DNS;
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
exports.URL = URL;

function _default(name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = (0, _parse.default)(namespace);
    }

    if (namespace.length !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return (0, _stringify.default)(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}
},{"./parse.js":48,"./stringify.js":52}],56:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _rng = _interopRequireDefault(require("./rng.js"));

var _stringify = _interopRequireDefault(require("./stringify.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function v4(options, buf, offset) {
  options = options || {};

  const rnds = options.random || (options.rng || _rng.default)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`


  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0, _stringify.default)(rnds);
}

var _default = v4;
exports.default = _default;
},{"./rng.js":50,"./stringify.js":52}],57:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("./v35.js"));

var _sha = _interopRequireDefault(require("./sha1.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v5 = (0, _v.default)('v5', 0x50, _sha.default);
var _default = v5;
exports.default = _default;
},{"./sha1.js":51,"./v35.js":55}],58:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _regex = _interopRequireDefault(require("./regex.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function validate(uuid) {
  return typeof uuid === 'string' && _regex.default.test(uuid);
}

var _default = validate;
exports.default = _default;
},{"./regex.js":49}],59:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function version(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.substr(14, 1), 16);
}

var _default = version;
exports.default = _default;
},{"./validate.js":58}],60:[function(require,module,exports){
'use strict';

module.exports = function () {
  throw new Error(
    'ws does not work in the browser. Browser clients must use the native ' +
      'WebSocket object'
  );
};

},{}]},{},[4]);
