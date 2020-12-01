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
//# sourceMappingURL=Z80.js.map