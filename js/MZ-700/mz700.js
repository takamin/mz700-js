"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fractional_timer_1 = __importDefault(require("fractional-timer"));
const mz_tape_header_1 = __importDefault(require("../lib/mz-tape-header"));
const mz_tape_1 = __importDefault(require("../lib/mz-tape"));
const mz_data_recorder_1 = __importDefault(require("../lib/mz-data-recorder"));
const intel_8253_1 = __importDefault(require("../lib/intel-8253"));
const flip_flop_counter_1 = __importDefault(require("../lib/flip-flop-counter"));
const ic556_1 = __importDefault(require("../lib/ic556"));
const mz_mmio_js_1 = __importDefault(require("../lib/mz-mmio.js"));
const mz700_key_matrix_1 = __importDefault(require("./mz700-key-matrix"));
const mz700_memory_js_1 = __importDefault(require("./mz700-memory.js"));
const Z80_js_1 = __importDefault(require("../Z80/Z80.js"));
const Z80_line_assembler_1 = __importDefault(require("../Z80/Z80-line-assembler"));
const PCG_700_1 = __importDefault(require("../lib/PCG-700"));
class MZ700 {
    constructor() { }
    create(opt) {
        this.keymatrix = new mz700_key_matrix_1.default();
        this.intel8253 = new intel_8253_1.default();
        this.intel8253.counter(1).initCount(15700, () => {
            this.intel8253.counter(2).count(1);
        });
        this.intel8253.counter(2).initCount(43200, () => {
            if (this.INTMSK) {
                this.z80.interrupt();
            }
        });
        this.hblank = new flip_flop_counter_1.default(MZ700.Z80_CLOCK / 15700);
        this.hblank.addEventListener("change", () => {
            this.intel8253.counter(1).count(1);
        });
        this.vblank = new flip_flop_counter_1.default(MZ700.Z80_CLOCK / 50);
        this.VBLK = false;
        this.vblank.addEventListener("change", () => {
            this.VBLK = !this.VBLK;
        });
        this.ic556 = new ic556_1.default(MZ700.Z80_CLOCK / 3);
        this.ic556Out = false;
        this.ic556.addEventListener("change", () => {
            this.ic556Out = !this.ic556Out;
        });
        this.INTMSK = false;
        this.MLDST = false;
        let motorOffDelayTid = null;
        this.dataRecorder = new mz_data_recorder_1.default(motorState => {
            if (motorState) {
                if (motorOffDelayTid != null) {
                    clearTimeout(motorOffDelayTid);
                    motorOffDelayTid = null;
                }
                this.opt.onStartDataRecorder();
            }
            else {
                motorOffDelayTid = setTimeout(() => {
                    motorOffDelayTid = null;
                    this.opt.onStopDataRecorder();
                }, 100);
            }
        });
        this.opt = {
            started: () => { },
            stopped: () => { },
            onBreak: () => { },
            onVramUpdate: () => { },
            onUpdateScrn: () => { },
            onMmioRead: () => { },
            onMmioWrite: () => { },
            startSound: () => { },
            stopSound: () => { },
            onStartDataRecorder: () => { },
            onStopDataRecorder: () => { }
        };
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
        this.tCycle0 = 0;
        this.actualClockFreq = 0.0;
        this._cycleToWait = 0;
        this.mmio = new mz_mmio_js_1.default();
        for (let address = 0xE000; address < 0xE800; address++) {
            this.mmio.onRead(address, value => this.opt.onMmioRead(address, value));
            this.mmio.onWrite(address, value => this.opt.onMmioWrite(address, value));
        }
        this.mmio.onWrite(0xE000, value => {
            this.memory.poke(0xE001, this.keymatrix.getKeyData(value));
            this.ic556.loadReset((value & 0x80) !== 0);
        });
        this.mmio.onRead(0xE002, value => {
            value = value & 0x0f;
            if (this.dataRecorder.motor()) {
                value = value | 0x10;
            }
            else {
                value = value & 0xef;
            }
            if (this.dataRecorder_readBit()) {
                value = value | 0x20;
            }
            else {
                value = value & 0xdf;
            }
            if (this.ic556Out) {
                value = value | 0x40;
            }
            else {
                value = value & 0xbf;
            }
            if (this.VBLK) {
                value = value | 0x80;
            }
            else {
                value = value & 0x7f;
            }
            return value;
        });
        this.mmio.onWrite(0xE003, value => {
            if ((value & 0x80) === 0) {
                const bit = ((value & 0x01) !== 0);
                const bitno = (value & 0x0e) >> 1;
                switch (bitno) {
                    case 0:
                        break;
                    case 1:
                        this.dataRecorder_writeBit(bit);
                        break;
                    case 2:
                        this.INTMSK = bit;
                        break;
                    case 3:
                        this.dataRecorder_motorOn(bit);
                        break;
                }
            }
        });
        this.mmio.onRead(0xE004, () => this.intel8253.counter(0).read());
        this.mmio.onWrite(0xE004, value => {
            if (this.intel8253.counter(0).load(value) && this.MLDST) {
                this.opt.startSound(895000 / this.intel8253.counter(0).value);
            }
        });
        this.mmio.onRead(0xE005, () => this.intel8253.counter(1).read());
        this.mmio.onWrite(0xE005, value => this.intel8253.counter(1).load(value));
        this.mmio.onRead(0xE006, () => this.intel8253.counter(2).read());
        this.mmio.onWrite(0xE006, value => this.intel8253.counter(2).load(value));
        this.mmio.onWrite(0xE007, value => this.intel8253.setCtrlWord(value));
        this.mmio.onRead(0xE008, value => {
            value = value & 0xfe;
            if (this.hblank.readOutput()) {
                value = value | 0x01;
            }
            else {
                value = value & 0xfe;
            }
            return value;
        });
        this.mmio.onWrite(0xE008, value => {
            this.MLDST = ((value & 0x01) !== 0);
            if (this.MLDST) {
                this.opt.startSound(895000 / this.intel8253.counter(0).value);
            }
            else {
                this.opt.stopSound();
            }
        });
        this.memory = new mz700_memory_js_1.default();
        this.memory.create({
            onVramUpdate: (index, dispcode, attr) => {
                this.opt.onVramUpdate(index, dispcode, attr);
            },
            onMappedIoRead: (address, value) => {
                const readValue = this.mmio.read(address, value);
                if (readValue == null || readValue === undefined) {
                    return value;
                }
                return readValue;
            },
            onMappedIoUpdate: (address, value) => {
                this.mmio.write(address, value);
                return value;
            }
        });
        this.z80 = new Z80_js_1.default({ memory: this.memory });
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
            this.memory.poke(assembled.minAddr + i, assembled.buffer[i]);
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
        }
        catch (ex) {
            return -1;
        }
        return 0;
    }
    clock() {
        this.hblank.count();
        this.vblank.count();
        this.ic556.count();
    }
    setCassetteTape(tapeData) {
        if (tapeData.length > 0) {
            if (tapeData.length <= 128) {
                this.dataRecorder_setCmt([]);
                console.error("error buf.length <= 128");
                return null;
            }
            this.mztArray = mz_tape_1.default.parseMZT(tapeData);
            if (this.mztArray == null || this.mztArray.length < 1) {
                console.error("setCassetteTape fail to parse");
                return null;
            }
        }
        this.dataRecorder_setCmt(tapeData);
        return this.mztArray;
    }
    getCassetteTape() {
        const cmt = this.dataRecorder.getCmt();
        if (cmt == null) {
            return null;
        }
        return mz_tape_1.default.toBytes(cmt);
    }
    loadCassetteTape() {
        for (const mzt of this.mztArray) {
            for (let i = 0; i < mzt.header.fileSize; i++) {
                this.memory.poke(mzt.header.addrLoad + i, mzt.body.buffer[i]);
            }
        }
    }
    reset() {
        this.memory.enableBlock1();
        this.memory.enableBlock1();
        this.memory.changeBlock0_MONITOR();
        this.memory.changeBlock1_VRAM();
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
            }
            else {
                const cycle0 = this.z80.consumedTCycle;
                this.z80.exec();
                this._cycleToWait = this.z80.consumedTCycle - cycle0;
            }
            this.clock();
        }
        catch (ex) {
            console.log("Error:", ex);
            console.log(ex.stack);
            this.stop();
            this.opt.onBreak();
        }
    }
    dataRecorder_setCmt(bytes) {
        if (bytes.length === 0) {
            this.dataRecorder.setCmt([]);
            return [];
        }
        const cmt = mz_tape_1.default.fromBytes(bytes);
        this.dataRecorder.setCmt(cmt);
        return cmt;
    }
    dataRecorder_ejectCmt() {
        if (this.dataRecorder.isCmtSet()) {
            const cmt = this.dataRecorder.ejectCmt();
            if (cmt != null) {
                return mz_tape_1.default.toBytes(cmt);
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
        this.tid = fractional_timer_1.default.setInterval(this.run.bind(this), MZ700.DEFAULT_TIMER_INTERVAL, 80, execCount);
        const mint = 1000;
        this.tidMeasClock = setInterval(() => {
            this.actualClockFreq = (this.z80.consumedTCycle - this.tCycle0) / (mint / 1000);
            this.tCycle0 = this.z80.consumedTCycle;
        }, mint);
    }
    stopEmulation() {
        if (this.tid != null) {
            fractional_timer_1.default.clearInterval(this.tid);
            this.tid = null;
        }
        if (this.tidMeasClock != null) {
            clearInterval(this.tidMeasClock);
            this.tidMeasClock = null;
            this.actualClockFreq = 0.0;
        }
    }
    static disassemble(mztArray) {
        const dasmlist = [];
        mztArray.forEach(mzt => {
            console.assert(mzt.header.constructor === mz_tape_header_1.default, "No MZT-header");
            const mzthead = mzt.header.getHeadline().split("\n");
            Array.prototype.push.apply(dasmlist, mzthead.map(line => {
                const asmline = new Z80_line_assembler_1.default();
                asmline.setComment(line);
                return asmline;
            }));
            Array.prototype.push.apply(dasmlist, Z80_js_1.default.dasm(mzt.body.buffer, 0, mzt.header.fileSize, mzt.header.addrLoad));
        });
        const dasmlines = Z80_js_1.default.dasmlines(dasmlist);
        return {
            outbuf: dasmlines.join("\n") + "\n",
            dasmlines,
            asmlist: dasmlist
        };
    }
    attachPCG700(pcg700) {
        this.mmio.onWrite(0xE010, value => pcg700.setPattern(value & 0xff));
        this.mmio.onWrite(0xE011, value => pcg700.setAddrLo(value & 0xff));
        this.mmio.onWrite(0xE012, value => {
            pcg700.setAddrHi(value & PCG_700_1.default.ADDR);
            pcg700.setCopy(value & PCG_700_1.default.COPY);
            pcg700.setWE(value & PCG_700_1.default.WE);
            pcg700.setSSW(value & PCG_700_1.default.SSW);
        });
        this.memory.poke(0xE010, 0x00);
        this.memory.poke(0xE011, 0x00);
        this.memory.poke(0xE012, 0x18);
    }
}
exports.default = MZ700;
MZ700.Z80_CLOCK = 3.579545 * 1000000;
MZ700.DEFAULT_TIMER_INTERVAL = 1.0 / MZ700.Z80_CLOCK;
module.exports = MZ700;
//# sourceMappingURL=mz700.js.map