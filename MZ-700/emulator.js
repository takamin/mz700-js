function MZ700(opt) {
    var THIS = this;

    //MZ700 Key Matrix
    this.keymatrix = new mz700keymatrix();

    //HBLNK F/F in 15.7 kHz
    this.hblank = new FlipFlopCounter(15700);

    //VBLNK F/F in 50 Hz
    this.vblank = new FlipFlopCounter(50);

    // create IC 556 to create HBLNK(cursor blink) by 3 Hz?
    this.ic556 = new IC556(3);

    this.INTMSK = false;

    this.MLDST = false;

    opt = opt || {};
    opt.onVramUpdate = opt.onVramUpdate || function(){};
    opt.onMmioRead = opt.onMmioRead || function(){};
    opt.onMmioWrite = opt.onMmioWrite || function(){};

    this.mmioMap = [];
    for(var address = 0xE000; address < 0xE800; address++) {
        this.mmioMap.push({ "r": false, "w": false });
    }
    this.memory = new MZ700_Memory({
        onVramUpdate: opt.onVramUpdate,
        onMappedIoRead: function(address, value) {

            //MMIO: Input from memory mapped peripherals
            if(THIS.mmioIsMappedToRead(address)) {
                opt.onMmioRead(address, value);
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

                    if(THIS.ic556.readOutput()) {
                        value = value | 0x40;
                    } else {
                        value = value & 0xbf;
                    }

                    // set V-BLANK bit
                    if(THIS.vblank.readOutput()) {
                        value = value | 0x80;
                    } else {
                        value = value & 0x7f;
                    }
                    return value;
                    break;
                case 0xE004:
                    return THIS.intel8253.counter[0].read();
                    break;
                case 0xE005:
                    return THIS.intel8253.counter[1].read();
                    break;
                case 0xE006:
                    return THIS.intel8253.counter[2].read();
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
                    return value;
                    break;
            }
            return value;
        },
        onMappedIoUpdate: function(address, value) {

            //MMIO: Output to memory mapped peripherals
            if(THIS.mmioIsMappedToWrite(address)) {
                opt.onMmioWrite(address, value);
            }

            switch(address) {
                case 0xE000:
                    this.poke(0xE001, THIS.keymatrix.getKeyData(value));
                    THIS.ic556.loadReset(value & 0x80);
                    break;
                case 0xE003:
                    if((value & 0x80) == 0) {
                        var bit = ((value & 0x01) != 0);
                        var bitno = (value & 0x0e) >> 1;
                        switch(bitno) {
                            case 2://INTMSK
                                THIS.INTMSK = bit;//trueで割り込み許可
                                break;
                        }
                    }
                    break;
                case 0xE004:
                    if(THIS.intel8253.counter[0].load(value) && THIS.MLDST) {
                        opt.startSound(895000 / THIS.intel8253.counter[0].value);
                    }
                    break;
                case 0xE005: THIS.intel8253.counter[1].load(value); break;
                case 0xE006: THIS.intel8253.counter[2].load(value); break;
                case 0xE007: THIS.intel8253.setCtrlWord(value); break;
                case 0xE008:
                    if((THIS.MLDST = ((value & 0x01) != 0)) == true) {
                        opt.startSound(895000 / THIS.intel8253.counter[0].value);
                    } else {
                        opt.stopSound();
                    }
                    break;
            }

            return value;
        }
    });

    // create 8253
    this.intel8253 = new Intel8253();

    this.z80 = new Z80({
        memory: THIS.memory,
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
            THIS.showStatus();
        }
    });
}
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
    var asm_list = assembled.list;
    var entry_point = -1;
    for(var i = 0; i < asm_list.length; i++) {
        var bytes = asm_list[i].bytecode;
        if(bytes != null && bytes.length > 0) {
            var address = asm_list[i].address;
            for(var j = 0; j < bytes.length; j++) {
                if(entry_point < 0) {
                    entry_point = address + j;
                }
                this.memory.poke(address + j, bytes[j]);
            }
        }
    }
    return entry_point;
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
}
MZ700.prototype.clock = function() {
    // HBLNK - 15.7 kHz clock
    if(this.hblank.count()) {
        // Load 15.7kHz clock to 8253 #1
        if(this.hblank.readOutput()) {
            var ctr1_out0 = this.intel8253.counter[1].out;
            this.intel8253.counter[1].count(1 * 4);
            var ctr1_out1 = this.intel8253.counter[1].out;
            if(!ctr1_out0 && ctr1_out1) {
                var ctr2_out0 = this.intel8253.counter[2].out;
                this.intel8253.counter[2].count(1);
                var ctr2_out1 = this.intel8253.counter[2].out;
                if(this.INTMSK && !ctr2_out0 && ctr2_out1) {
                    this.z80.interrupt();
                }
            }
        }
    }

    // VBLNK - 50 Hz
    this.vblank.count();

    // CURSOR BLNK - 1 Hz
    this.ic556.count();

};
MZ700.prototype.setCassetteTape = function(tape_data) {
    this.tape_data = tape_data;
    if(tape_data.length <= 128) {
        console.error("error buf.length <= 128");
        return null;
    }
    this.mzt_array = MZ700.parseMZT(tape_data);
    if(this.mzt_array == null || this.mzt_array.length < 1) {
        console.error("setCassetteTape fail to parse");
        return null;
    }
    return this.mzt_array;
};
MZ700.prototype.loadCassetteTape = function() {
    for(var i = 0; i < this.mzt_array.length; i++) {
        var mzt = this.mzt_array[i];
        for(var j = 0; j < mzt.header.file_size; j++) {
            this.memory.poke(mzt.header.addr_load + j, mzt.body.buffer[j]);
        }
    }
}
MZ700.prototype.reset = function() {
    this.memory.enableBlock1();
    this.memory.enableBlock1();
    this.memory.changeBlock0_MONITOR();
    this.memory.changeBlock1_VRAM();
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
MZ700.prototype.clearBreakPoints = function(callback) {
    this.z80.clearBreakPoints();
};
MZ700.prototype.getBreakPoints = function(callback) {
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
// MZ-700 Key Matrix
//
function mz700keymatrix() {
    this.keymap = new Array(10);
    for(var i = 0; i < this.keymap.length; i++) {
        this.keymap[i] = 0xff;
    }
}
mz700keymatrix.prototype.getKeyData = function(strobe) {
    var keydata = 0xff;
    strobe &= 0x0f;
    if(strobe < this.keymap.length) {
        keydata = this.keymap[strobe];
    }
    return keydata;
};
mz700keymatrix.prototype.setKeyMatrixState = function(strobe, bit, state) {
    if(state) {
        // clear bit
        this.keymap[strobe] &= ((~(1 << bit)) & 0xff);
    } else {
        // set bit
        this.keymap[strobe] |= ((1 << bit) & 0xff);
    }
};

//
// FlipFlopCounter
//
function FlipFlopCounter(freq) {
    this.initialize();
    this.setFrequency(freq);
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
}
FlipFlopCounter.prototype.readOutput = function() {
    return this._out;
};
FlipFlopCounter.prototype.count = function() {
    this._counter += FlipFlopCounter.SPEED_FACTOR;
    if(this._counter >= this._counter_max / 2) {
        this._out = !this._out;
        this._counter = 0;
        return true;
    }
    return false;
};
//
// IC BJ 556
//
function IC556(freq) {
    this._reset = false;
    this.initialize();
    this.setFrequency(freq);
};
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

//
// Intel 8253 Programmable Interval Timer
//
function Intel8253() {
    this.counter = [ new Intel8253Counter(), new Intel8253Counter(), new Intel8253Counter() ];
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
function Intel8253Counter() {
    this.RL = 0;
    this.MODE = 0;
    this.BCD = 0;
    this.value = 0;
    this.counter = 0;
    this._written = true;
    this._read = true;
    this.out = false;
    this.gate = false;
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
        case 0:
            break;
        case 1:
            this.value = (value & 0x00ff);
            this.counter = this.value;
            this.out = false;
            set_comp = true;
            break;
        case 2:
            this.value = (value & 0x00ff) << 8;
            this.counter = this.value;
            set_comp = true;
            break;
        case 3:
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
        case 0:
            break;
        case 1:
            return (this.counter & 0x00ff);
            break;
        case 2:
            return (this.counter & 0x00ff) << 8;
            break;
        case 3:
            if(this._read) {
                this._read = false;
                return (this.counter & 0x00ff);
            } else {
                this._read = true;
                return ((this.counter >> 8) & 0x00ff);
            }
            break;
    }
};
Intel8253Counter.prototype.setGate = function(gate) {
    this.gate = gate;
};
Intel8253Counter.prototype.count = function(count) {
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
            if(this.out && this.counter <= 0) {
                this.out = false;
                this.counter = this.value;
            } else if(!this.out && this.counter <= this.value / 2) {
                this.out = true;
            }
            break;
        case 4:
            break;
        case 5:
            break;
    }
};

//
// For TransWorker
//
MZ700.prototype.start = function() {
    this.tid = null;
    this.NUM_OF_EXEC_OPCODE = 1000;
    this.RUNNING_INTERVAL = 7;
    this.tid = setInterval((function(app) { return function() {
        app.run();
    };}(this)), this.RUNNING_INTERVAL);
};
MZ700.prototype.stop = function() {
    if(this.tid != null) {
        clearInterval(this.tid);
        this.tid = null;
    }
};
MZ700.prototype.run = function() {
    try {
        for(var i = 0; i < this.NUM_OF_EXEC_OPCODE; i++) {
            this.z80.exec();
            this.clock();
        }
    } catch(ex) {
        console.log("MZ700.run exception:", ex);
        this.stop();
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
        outbuf += ";======================================================\n"
        outbuf += "; attribute :   " + mzt.header.attr.HEX(2) + "H\n";
        outbuf += "; filename  :   '" + mzt.header.filename + "'\n";
        outbuf += "; filesize  :   " + mzt.header.file_size + " bytes\n";
        outbuf += "; load addr :   " + mzt.header.addr_load.HEX(4) + "H\n";
        outbuf += "; start addr:   " + mzt.header.addr_exec.HEX(4) + "H\n";
        outbuf += ";======================================================\n"
        var lines = Z80.dasm(
            mzt.body.buffer, 0,
            mzt.header.file_size,
            mzt.header.addr_load);
        lines.forEach(function(line) {
            dasmlist.push(line);
        });
    });
    Z80.processAddressReference(dasmlist);
    var dasmlines = Z80.dasmlines(dasmlist);
    outbuf += dasmlines.join("\n") + "\n";
    return {"outbuf": outbuf, "dasmlines": dasmlines};
};
