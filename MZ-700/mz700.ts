"use strict";
import FractionalTimer from "fractional-timer";
import MZ_TapeHeader   from '../lib/mz-tape-header';
import MZ_Tape         from '../lib/mz-tape';
import MZ_DataRecorder from '../lib/mz-data-recorder';
import Intel8253       from '../lib/intel-8253';
import FlipFlopCounter from '../lib/flip-flop-counter';
import IC556           from '../lib/ic556';
import MZMMIO          from "../lib/mz-mmio.js";
import MZ700KeyMatrix  from './mz700-key-matrix';
import MZ700_Memory    from "./mz700-memory.js";
import Z80             from '../Z80/Z80.js';
import Z80LineAssembler from "../Z80/Z80-line-assembler";
import Z80_Register from "../Z80/register";

export default class MZ700 {
    static Z80_CLOCK = 3.579545 * 1000000;// 3.58 MHz
    static DEFAULT_TIMER_INTERVAL = 1.0 / MZ700.Z80_CLOCK;
    opt:any;
    tid:any;
    clockFactor:number;
    tidMeasClock:any;
    t_cycle_0:number;
    actualClockFreq:number;
    _cycleToWait:number;
    mzt_array:any[];

    keymatrix:MZ700KeyMatrix;
    dataRecorder: MZ_DataRecorder;
    memory:MZ700_Memory;
    mmio:MZMMIO;
    z80:Z80;
    intel8253:Intel8253;
    ic556:IC556

    hblank:FlipFlopCounter;
    vblank:FlipFlopCounter;
    INTMSK:boolean;
    VBLK:boolean;
    MLDST:boolean;
    ic556_OUT:boolean

    constructor() { }
    create(opt) {

        //MZ700 Key Matrix
        this.keymatrix = new MZ700KeyMatrix();

        // Create 8253
        this.intel8253 = new Intel8253();
        this.intel8253.counter(1).initCount(15700, () => {
            this.intel8253.counter(2).count(1);
        });
        this.intel8253.counter(2).initCount(43200, () => {
            if (this.INTMSK) {
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
            if (motorState) {
                if (motorOffDelayTid != null) {
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
            started: () => { },
            stopped: () => { },
            onBreak: () => { },
            onVramUpdate: ( /*index, dispcode, attr*/) => { },
            onUpdateScrn: ( /*buffer*/) => { },
            onMmioRead: ( /*address, value*/) => { },
            onMmioWrite: ( /*address, value*/) => { },
            startSound: ( /*freq*/) => { },
            stopSound: () => { },
            onStartDataRecorder: () => { },
            onStopDataRecorder: () => { }
        };

        //
        // Override option to receive notifications with callbacks.
        //
        opt = opt || {};
        Object.keys(opt).forEach(key => {
            if (!(key in this.opt)) {
                console.warn(`Unknown option key ${key} is specified.`);
            }
        });
        Object.keys(this.opt).forEach(key => {
            if (key in opt) {
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
        for (let address = 0xE000; address < 0xE800; address++) {
            this.mmio.onRead(address,
                value => this.opt.onMmioRead(address, value));
            this.mmio.onWrite(address,
                value => this.opt.onMmioWrite(address, value));
        }

        //MMIO $E000
        this.mmio.onWrite(0xE000, value => {
            this.memory.poke(0xE001, this.keymatrix.getKeyData(value));
            this.ic556.loadReset((value & 0x80) != 0);
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
            if (this.dataRecorder.motor()) {
                value = value | 0x10;
            } else {
                value = value & 0xef;
            }
            // PC5 - RDATA : A bit data to read
            if (this.dataRecorder_readBit()) {
                value = value | 0x20;
            } else {
                value = value & 0xdf;
            }
            // PC6 - 556_OUT : A signal to blink cursor on the screen
            if (this.ic556_OUT) {
                value = value | 0x40;
            } else {
                value = value & 0xbf;
            }
            // PC7 - VBLK : A virtical blanking signal
            // set V-BLANK bit
            if (this.VBLK) {
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
            if ((value & 0x80) == 0) {
                const bit = ((value & 0x01) != 0);
                const bitno = (value & 0x0e) >> 1;
                //const name = [
                //    "SOUNDMSK(MZ-1500)",
                //    "WDATA","INTMSK","M-ON",
                //    "MOTOR","RDATA", "556 OUT", "VBLK"][bitno];
                //console.log("$E003 8255 CTRL BITSET", name, bit);
                switch (bitno) {
                    case 0: //SOUNDMSK
                        break;
                    case 1: //WDATA
                        this.dataRecorder_writeBit(bit);
                        break;
                    case 2: //INTMSK
                        this.INTMSK = bit; //trueで割り込み許可
                        break;
                    case 3: //M-ON
                        this.dataRecorder_motorOn(bit);
                        break;
                }
            }
        });

        //MMIO $E004
        this.mmio.onRead(0xE004, () => this.intel8253.counter(0).read());
        this.mmio.onWrite(0xE004, value => {
            if (this.intel8253.counter(0).load(value) && this.MLDST) {
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
            if (this.hblank.readOutput()) {
                value = value | 0x01;
            } else {
                value = value & 0xfe;
            }
            return value;
        });
        this.mmio.onWrite(0xE008, value => {
            if ((this.MLDST = ((value & 0x01) != 0)) == true) {
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
                if (readValue == null || readValue == undefined) {
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
    }
    setMonitorRom(bin) {
        this.memory.setMonitorRom(bin);
    }
    writeAsmCode(assembled) {
        for (let i = 0; i < assembled.buffer.length; i++) {
            this.memory.poke(
                assembled.minAddr + i,
                assembled.buffer[i]);
        }
        return assembled.minAddr;
    }
    exec(execCount) {
        execCount = execCount || 1;
        try {
            for (let i = 0; i < execCount; i++) {
                this.z80.exec();
                this.clock();
            }
        } catch (ex) {
            return -1;
        }
        return 0;
    }
    clock() {

        // HBLNK - 15.7 kHz clock
        this.hblank.count();

        // VBLNK - 50 Hz
        this.vblank.count();

        // CURSOR BLNK - 1 Hz
        this.ic556.count();

    }
    setCassetteTape(tape_data) {
        if (tape_data.length > 0) {
            if (tape_data.length <= 128) {
                this.dataRecorder_setCmt([]);
                console.error("error buf.length <= 128");
                return null;
            }
            this.mzt_array = MZ_Tape.parseMZT(tape_data);
            if (this.mzt_array == null || this.mzt_array.length < 1) {
                console.error("setCassetteTape fail to parse");
                return null;
            }
        }
        this.dataRecorder_setCmt(tape_data);
        return this.mzt_array;
    }
    /**
     * Get CMT content without ejecting.
     * @returns {Buffer|null} CMT data buffer
     */
    getCassetteTape() {
        const cmt = this.dataRecorder.getCmt();
        if (cmt == null) {
            return null;
        }
        return MZ_Tape.toBytes(cmt);
    }
    loadCassetteTape() {
        for (let i = 0; i < this.mzt_array.length; i++) {
            const mzt = this.mzt_array[i];
            for (let j = 0; j < mzt.header.fileSize; j++) {
                this.memory.poke(mzt.header.addrLoad + j, mzt.body.buffer[j]);
            }
        }
    }
    reset() {
        this.memory.enableBlock1();
        this.memory.enableBlock1();
        this.memory.changeBlock0_MONITOR();
        this.memory.changeBlock1_VRAM();

        // Clear VRAM
        for (let i = 0; i < 40 * 25; i++) {
            this.memory.poke(0xd000 + i, 0x00);
            this.memory.poke(0xd800 + i, 0x71);
        }
        this.z80.reset();
    }
    getRegister() {
        const reg = this.z80.reg.cloneRaw();
        reg._ = this.z80.regB.cloneRaw();
        reg.IFF1 = this.z80.IFF1;
        reg.IFF2 = this.z80.IFF2;
        reg.IM = this.z80.IM;
        reg.HALT = this.z80.HALT;
        return reg;
    }
    setPC(addr) {
        this.z80.reg.PC = addr;
    }
    /**
     * Read memory.
     * @param {number} addrStart start address
     * @param {number} addrEnd (optional) end address
     * @returns {number|Array<number>} A value in the start addr or memory block
     */
    readMemory(addrStart, addrEnd) {
        if (addrEnd) {
            return Array(addrEnd - addrStart).fill(null)
                .map(() => this.memory.peek(addrStart++));
        }
        return this.memory.peek(addrStart);
    }
    setKeyState(strobe, bit, state) {
        this.keymatrix.setKeyMatrixState(strobe, bit, state);
    }
    clearBreakPoints() {
        this.z80.clearBreakPoints();
    }
    getBreakPoints() {
        return this.z80.getBreakPoints();
    }
    removeBreak(addr, size) {
        this.z80.removeBreak(addr, size);
    }
    addBreak(addr, size) {
        this.z80.setBreak(addr, size);
    }
    //
    // For TransWorker
    //
    start() {
        if ("tid" in this && this.tid != null) {
            console.warn("MZ700.start(): already started");
            return false;
        }
        this.startEmulation();
        this.opt.started();

        return true;
    }
    stop() {
        const running = (this.tid != null);
        this.stopEmulation();
        if (running) {
            this.opt.stopped();
        }
    }
    step() {
        if ("tid" in this && this.tid != null) {
            this.stop();
            return;
        }
        this.exec(1);
        this.opt.started();
        this.opt.stopped();
    }
    run() {
        try {
            if (this._cycleToWait > 0) {
                this._cycleToWait--;
            } else {
                const cycle0 = this.z80.consumedTCycle;
                this.z80.exec();
                this._cycleToWait = this.z80.consumedTCycle - cycle0;
            }
            this.clock();
        } catch (ex) {
            console.log("Error:", ex);
            console.log(ex.stack);
            this.stop();
            this.opt.onBreak();
        }
    }
    dataRecorder_setCmt(bytes) {
        if (bytes.length == 0) {
            this.dataRecorder.setCmt([]);
            return [];
        }
        const cmt = MZ_Tape.fromBytes(bytes);
        this.dataRecorder.setCmt(cmt);
        return cmt;
    }
    dataRecorder_ejectCmt() {
        if (this.dataRecorder.isCmtSet()) {
            const cmt = this.dataRecorder.ejectCmt();
            if (cmt != null) {
                return MZ_Tape.toBytes(cmt);
            }
        }
        return [];
    }
    dataRecorder_pushPlay() {
        this.dataRecorder.play();
    }
    dataRecorder_pushRec() {
        if (this.dataRecorder.isCmtSet()) {
            this.dataRecorder.ejectCmt();
        }
        this.dataRecorder.setCmt([]);
        this.dataRecorder.rec();
    }
    dataRecorder_pushStop() {
        this.dataRecorder.stop();
    }
    dataRecorder_motorOn(state) {
        this.dataRecorder.m_on(state);
    }
    dataRecorder_readBit() {
        return this.dataRecorder.rdata(this.z80.consumedTCycle);
    }
    dataRecorder_writeBit(state) {
        this.dataRecorder.wdata(state, this.z80.consumedTCycle);
    }
    getClockFactor() {
        return this.clockFactor;
    }
    setClockFactor(clockFactor) {
        const running = (this.tid != null);
        if (running) {
            this.stopEmulation();
        }
        this.clockFactor = clockFactor;
        if (running) {
            this.startEmulation();
        }
    }
    getActualClockFreq() {
        return this.actualClockFreq;
    }
    startEmulation() {
        const execCount = Math.round(200 * this.clockFactor);
        this.tid = FractionalTimer.setInterval(
            this.run.bind(this), MZ700.DEFAULT_TIMER_INTERVAL, 80, execCount);
        const mint = 1000;
        this.tidMeasClock = setInterval(() => {
            this.actualClockFreq = (this.z80.consumedTCycle - this.t_cycle_0) / (mint / 1000);
            this.t_cycle_0 = this.z80.consumedTCycle;
        }, mint);
    }
    stopEmulation() {
        if (this.tid != null) {
            FractionalTimer.clearInterval(this.tid);
            this.tid = null;
        }
        if (this.tidMeasClock != null) {
            clearInterval(this.tidMeasClock);
            this.tidMeasClock = null;
            this.actualClockFreq = 0.0;
        }
    }
    //
    // Disassemble
    //
    static disassemble(mztape_array) {
        let dasmlist = [];
        mztape_array.forEach(mzt => {
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
    }
}
module.exports = MZ700;
