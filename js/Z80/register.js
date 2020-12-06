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
    setB(n) { this._B = (n & 0xff); }
    getB() { return this._B; }
    setC(n) { this._C = (n & 0xff); }
    getC() { return this._C; }
    setD(n) { this._D = (n & 0xff); }
    getD() { return this._D; }
    setE(n) { this._E = (n & 0xff); }
    getE() { return this._E; }
    setH(n) { this._H = (n & 0xff); }
    getH() { return this._H; }
    setL(n) { this._L = (n & 0xff); }
    getL() { return this._L; }
    setA(n) { this._A = (n & 0xff); }
    getA() { return this._A; }
    setF(n) { this._F = (n & 0xff); }
    getF() { return this._F; }
    setBC(nn) { this._B = this.hi8(nn); this._C = this.lo8(nn); }
    getBC() { return this.pair(this._B, this._C); }
    setDE(nn) { this._D = this.hi8(nn); this._E = this.lo8(nn); }
    getDE() { return this.pair(this._D, this._E); }
    setHL(nn) { this._H = this.hi8(nn); this._L = this.lo8(nn); }
    getHL() { return this.pair(this._H, this._L); }
    setAF(nn) { this._A = this.hi8(nn); this._F = this.lo8(nn); }
    getAF() { return this.pair(this._A, this._F); }
    testFlag(mask) { return ((this._F & mask) ? 1 : 0); }
    setFlag(mask) { this._F = this._F | mask; }
    clearFlag(mask) { this._F = this._F & ((~mask) & 0xff); }
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
//# sourceMappingURL=register.js.map