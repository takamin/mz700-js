"use strict";
import oct from "../lib/oct";
import MemoryBlock from "./memory-block";
import Z80_Register from "./register";
import BinUtil from "./bin-util";
import Z80LineAssembler from "./Z80-line-assembler";
import NumberUtil from "../lib/number-util";

export default class Z80 {
    memory: MemoryBlock;
    IFF1:number = 0;
    IFF2:number = 0;
    IM:number = 0;
    HALT:number = 0;
    ioPort:Array<number>;
    reg:Z80_Register;
    regB:Z80_Register;
    bpmap:Array<any>;
    consumedTCycle:number = 0;
    _onReadIoPort:Array<Function>;
    _onWriteIoPort:Array<Function>;

    exec:Function = Z80.exec;
    opecodeTable:Array<any>;

    /**
     * Execute the instruction at current program counter.
     * @returns {undefined}
     */
    static exec:Function = function():void {
        this.reg.R = (this.reg.R + 1) & 255;
        const instruction = this.opecodeTable[this.fetch()];
        const cycle = instruction.proc() || instruction.cycle || 4;
        this.consumedTCycle += cycle;
        if(this.bpmap[this.reg.PC] != null) {
            console.log("*** BREAK AT $" + NumberUtil.HEX(this.reg.PC, 4));
            throw "break";
        }
    };
    /**
     * Z80 emulator class.
     * @param {object} opt  The options to create.
     * @constructor
     */
    constructor(opt) {
        opt = opt || { memory: null, };
        this.memory = opt.memory;
        if (opt.memory == null) {
            this.memory = new MemoryBlock();
            this.memory.create();
        }
        this.ioPort = (new Array(256)).fill(0);
        this.reg = new Z80_Register();
        this.regB = new Z80_Register();
        this.bpmap = new Array(0x10000);
        this.consumedTCycle = 0;
        this.createOpecodeTable();
        this._onReadIoPort = (new Array(256)).fill(()=>{});
        this._onWriteIoPort = (new Array(256)).fill(()=>{});
    }
    /**
     * Read a value fron I/O port.
     * @param {number} port A port number(0 to 255).
     * @returns {number} A 8-bit value that was read.
     */
    readIoPort(port:number):number {
        const value = this.ioPort[port];
        this.reg.onReadIoPort(value);
        this._onReadIoPort[port](value);
        return value;
    }
    /**
     * Write I/O port.
     * @param {number} port A port number(0 to 255).
     * @param {number} value A 8-bit value to be written.
     * @returns {undefined}
     */
    writeIoPort(port:number, value:number) {
        this.ioPort[port] = value;
        this._onWriteIoPort[port](value);
    }
    /**
     * Reset.
     * @returns {undefined}
     */
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
    /**
     * Interrupt.
     * @returns {undefined}
     */
    interrupt() {
        if (this.IFF1) {
            this.pushPair(this.reg.PC);
            this.reg.PC = 0x0038;
        }
    }
    /**
     * Clear the break points.
     * @returns {undefined}
     */
    clearBreakPoints() {
        this.bpmap = new Array(0x10000);
        for (let i = 0; i < 0x10000; i++) {
            this.bpmap[i] = null;
        }
    }
    /**
     * Get the break points.
     * @returns {Array<boolean>} The array that the index is
     *      an address and the element is a status whether it
     *      is a break point.
     */
    getBreakPoints() {
        return this.bpmap;
    }
    /**
     * Remove the break points.
     * @param {number} address The staring address.
     * @param {number} size The area size.
     * @returns {undefined}
     */
    removeBreak(address, size) {
        for (let i = 0; i < size; i++) {
            this.bpmap[address + i] = null;
        }
    }
    /**
     * Remove the break points.
     * @param {number} address The staring address.
     * @param {number} size The area size.
     * @returns {undefined}
     */
    setBreak(address, size) {
        for (let i = 0; i < size; i++) {
            this.bpmap[address + i] = true;
        }
    }
    /**
     * Get a 8-bit unsigned value from memory pointed by PC.
     * And the PC goes forward with 1 byte.
     * @returns {number} A 8-bit value.
     */
    fetch():number {
        const PC = this.reg.PC;
        this.reg.PC = (PC + 1) & 0xffff;
        return this.memory.peek(PC);
    }
    /**
     * Get a 8-bit signed value from memory pointed by PC.
     * And the PC goes forward with 1 byte.
     * @returns {number} A 8-bit value.
     */
    fetchSigned():number {
        return NumberUtil.to8bitSigned(this.fetch());
    }

    /**
     * Get a 16-bit value from memory pointed by PC.
     * And the PC goes forward with 2 bytes.
     * @returns {number} A 16-bit value.
     */
    fetchPair() {
        const PC = this.reg.PC;
        this.reg.PC = (PC + 2) & 0xffff;
        return this.memory.peekPair(PC);
    }
    /**
     * Push 16-bit value to stack pointer(SP).
     * And SP goes back with 2 bytes.
     * @param {number} nn 16 bit integer.
     * @returns {undefined}
     */
    pushPair(nn) {
        this.memory.poke(--this.reg.SP, BinUtil.hibyte(nn));
        this.memory.poke(--this.reg.SP, BinUtil.lobyte(nn));
    }
    /**
     * Pop 16-bit value from stack pointer(SP).
     * And SP goes forward with 2 bytes.
     * @returns {number} 16 bit integer that was read.
     */
    popPair() {
        const lo = this.memory.peek(this.reg.SP++);
        const hi = this.memory.peek(this.reg.SP++);
        return BinUtil.pair(hi, lo);
    }
    /**
     * Increment the specific address value.
     * @param {number} addr A address to increment.
     * @returns {undefined}
     */
    incrementAt(addr) {
        this.memory.poke(addr, this.reg.getINCValue(this.memory.peek(addr)));
    }
    /**
     * Decrement the specific address value.
     * @param {number} addr A address to increment.
     * @returns {undefined}
     */
    decrementAt(addr) {
        this.memory.poke(addr, this.reg.getDECValue(this.memory.peek(addr)));
    }
    /**
     * Disassemble one operation code of Z80.
     *
     * @param {number} addr The starting address
     * @param {number} last_addr    The last address to assemble.
     * @returns {object} A disassembled result.
     */
    disassemble(addr, last_addr) {
        var disasm = null;
        var errmsg = "";
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
                else if (addr + dasmEntry.code.length > last_addr) {
                    disasm = null;
                }
                else {
                    disasm = Z80LineAssembler.create(dasmEntry.mnemonic[0], dasmEntry.mnemonic.slice(1).join(","), dasmEntry.code);
                    if ("ref_addr_to" in dasmEntry) {
                        disasm.setRefAddrTo(dasmEntry.ref_addr_to);
                    }
                }
            }
        }
        catch (e) {
            errmsg = "EXCEPTION THROWN";
        }
        if (disasm == null) {
            disasm = Z80LineAssembler.create("DEFB", NumberUtil.HEX(opecode, 2) + "H", [opecode]);
            disasm.setComment(";*** DISASSEMBLE FAIL: " + errmsg);
        }
        return disasm;
    }
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
    createOpecodeTable() {
        this.opecodeTable = new Array(256);
        var opeIX = new Array(256);
        var opeIY = new Array(256);
        var opeRotate = new Array(256);
        var opeRotateIX = new Array(256);
        var opeRotateIY = new Array(256);
        var opeMisc = new Array(256);
        const fetch = Z80.prototype.fetch.bind(this);
        const fetchSigned = Z80.prototype.fetchSigned.bind(this);
        const fetchPair = Z80.prototype.fetchPair.bind(this);
        const peek = this.memory.peek.bind(this.memory);
        const peekPair = this.memory.peekPair.bind(this.memory);
        const poke = this.memory.poke.bind(this.memory);
        const pushPair = Z80.prototype.pushPair.bind(this);
        const popPair = Z80.prototype.popPair.bind(this);
        for (var i = 0; i < 256; i++) {
            this.opecodeTable[i] = {
                mnemonic: null,
                proc: () => { throw "ILLEGAL OPCODE"; },
                disasm: ((i) => (( /*mem, addr*/) => ({
                    code: [i],
                    mnemonic: ["DEFB", NumberUtil.HEX(i, 2) + "H; *** UNKNOWN OPCODE"]
                })))(i)
            };
            opeIX[i] = {
            mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE DD " + NumberUtil.HEX(i, 2) + " for IX command subset";
                }))(i),
                disasm: ((i) => (( /*mem, addr*/) => ({
                    code: [0xDD],
                    mnemonic: ["DEFB", "DDh; *** UNKNOWN OPCODE " + NumberUtil.HEX(i, 2) + "H"]
                })))(i)
            };
            opeIY[i] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE FD " + NumberUtil.HEX(i, 2) + " for IY command subset";
                }))(i),
                disasm: ((i) => (( /*mem, addr*/) => ({
                    code: [0xFD],
                    mnemonic: ["DEFB", "FDh; *** UNKNOWN OPCODE " + NumberUtil.HEX(i, 2) + "H"]
                })))(i)
            };
            opeRotate[i] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE CB " + NumberUtil.HEX(i, 2) + " for Rotate command subset";
                }))(i),
                disasm: ((i) => (( /*mem, addr*/) => ({
                    code: [0xCB],
                    mnemonic: ["DEFB", "CBh; *** UNKNOWN OPCODE " + NumberUtil.HEX(i, 2) + "H"]
                })))(i)
            };
            opeRotateIX[i] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE DD CB " + NumberUtil.HEX(i, 2) + " for Rotate IX command subset";
                }))(i),
                disasm: ((i) => (( /*mem, addr*/) => ({
                    code: [0xDD, 0xCB],
                    mnemonic: ["DEFW", "CBDDh; *** UNKNOWN OPCODE " + NumberUtil.HEX(i, 2) + "H"]
                })))(i)
            };
            opeRotateIY[i] = {
            mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE FD CB " + NumberUtil.HEX(i, 2) + " for Rotate IY command subset";
                }))(i),
                disasm: ((i) => (( /*mem, addr*/) => ({
                    code: [0xFD, 0xCB],
                    mnemonic: ["DEFW", "CBFDh; *** UNKNOWN OPCODE " + NumberUtil.HEX(i, 2) + "H"]
                })))(i)
            };
            opeMisc[i] = {
                mnemonic: null,
                proc: ((i) => (() => {
                    throw "ILLEGAL OPCODE ED " + NumberUtil.HEX(i, 2) + " for Misc command subset";
                }))(i),
                disasm: ((i) => (( /*mem, addr*/) => ({
                    code: [0xED],
                    mnemonic: ["DEFB", "EDh; *** UNKNOWN OPCODE " + NumberUtil.HEX(i, 2) + "H"]
                })))(i)
            };
        }
        // IX command
        this.opecodeTable[0xDD] = {
            mnemonic: () => opeIX,
            proc: () => { opeIX[fetch()].proc(); },
            disasm: (mem, addr) => opeIX[mem.peek(addr + 1)].disasm(mem, addr),
        };
        // IY command
        this.opecodeTable[0xFD] = {
            mnemonic: () => opeIY,
            proc: () => { opeIY[fetch()].proc(); },
            disasm: (mem, addr) => opeIY[mem.peek(addr + 1)].disasm(mem, addr),
        };
        // Rotate
        this.opecodeTable[0xCB] = {
            mnemonic: () => opeRotate,
            proc: () => { opeRotate[fetch()].proc(); },
            disasm: (mem, addr) => opeRotate[mem.peek(addr + 1)].disasm(mem, addr),
        };
        // Misc
        this.opecodeTable[0xED] = {
            mnemonic: () => opeMisc,
            proc: () => { opeMisc[fetch()].proc(); },
            disasm: (mem, addr) => opeMisc[mem.peek(addr + 1)].disasm(mem, addr),
        };
        //=================================================================================
        //
        // 8bit load group
        //
        //=================================================================================
        //---------------------------------------------------------------------------------
        // LD r,r'		r<-r'					01  r   r'
        //---------------------------------------------------------------------------------
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
        const procs_LD_rr = {
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
        for (const dstRegId of Object.keys(Z80_Register.REG_r_ID2NAME)) {
            const nDstRegId = parseInt(dstRegId);
            const dstRegName = Z80_Register.REG_r_ID2NAME[nDstRegId];
            for (const srcRegId of Object.keys(Z80_Register.REG_r_ID2NAME)) {
                const srcRegName = Z80_Register.REG_r_ID2NAME[srcRegId];
                const opecode = (0x01 << 6) | (nDstRegId << 3) | parseInt(srcRegId);
                this.opecodeTable[opecode] = {
                    mnemonic: "LD " + dstRegName + "," + srcRegName,
                    proc: procs_LD_rr[`LD ${dstRegName},${srcRegName}`],
                    "cycle": 4,
                    disasm: ((opecode, dstRegName, srcRegName) => (( /*mem, addr*/) => ({
                        code: [opecode],
                        mnemonic: ["LD", dstRegName, srcRegName]
                    })))(opecode, dstRegName, srcRegName)
                };
            }
        }
        //---------------------------------------------------------------------------------
        // LD r,n		r<-n					00  r  110	<-  n   ->
        // LD r,(HL)	r<-(HL)					01  r  110
        // LD (HL),r	(HL)<-r					01 110  r 
        // LD (HL),n	(HL)<-n					00 110 110	<-  n   ->
        //---------------------------------------------------------------------------------
        var disa_0x_r_110 = (mem, addr) => {
            var opecode = mem.peek(addr);
            var code = [opecode];
            var x = ((opecode & 0x40) != 0) ? 1 : 0;
            var r1 = (opecode >> 3) & 0x07;
            var r2 = (opecode >> 0) & 0x07;
            var operand = ["???", "???"];
            var n;
            operand[0] = ((r1 == 6) ? "(HL)" : Z80_Register.REG_r_ID2NAME[r1]);
            switch (x) {
                case 0:
                    n = mem.peek(addr + 1);
                    code.push(n);
                    operand[1] = NumberUtil.HEX(n, 2) + "H";
                    break;
                case 1:
                    operand[1] = ((r2 == 6) ? "(HL)" : Z80_Register.REG_r_ID2NAME[r2]);
                    break;
            }
            return {
                code: code,
                mnemonic: ["LD", operand[0], operand[1]]
            };
        };
        //---------------------------------------------------------------------------------
        // LD r,n		r<-n					00  r  110	<-  n   ->
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0006")] = {
            mnemonic: "LD B,n",
            proc: () => { setB(fetch()); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0016")] = {
            mnemonic: "LD C,n",
            proc: () => { setC(fetch()); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0026")] = {
            mnemonic: "LD D,n",
            proc: () => { setD(fetch()); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0036")] = {
            mnemonic: "LD E,n",
            proc: () => { setE(fetch()); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0046")] = {
            mnemonic: "LD H,n",
            proc: () => { setH(fetch()); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0056")] = {
            mnemonic: "LD L,n",
            proc: () => { setL(fetch()); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0076")] = {
            mnemonic: "LD A,n",
            proc: () => { setA(fetch()); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        //---------------------------------------------------------------------------------
        // LD r,(HL)	r<-(HL)					01  r  110
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0106")] = {
            mnemonic: "LD B,(HL)",
            proc: () => { setB(peek(getHL())); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0116")] = {
            mnemonic: "LD C,(HL)",
            proc: () => { setC(peek(getHL())); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0126")] = {
            mnemonic: "LD D,(HL)",
            proc: () => { setD(peek(getHL())); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0136")] = {
            mnemonic: "LD E,(HL)",
            proc: () => { setE(peek(getHL())); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0146")] = {
            mnemonic: "LD H,(HL)",
            proc: () => { setH(peek(getHL())); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0156")] = {
            mnemonic: "LD L,(HL)",
            proc: () => { setL(peek(getHL())); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0176")] = {
            mnemonic: "LD A,(HL)",
            proc: () => { setA(peek(getHL())); },
            "cycle": 7,
            disasm: disa_0x_r_110
        };
        //---------------------------------------------------------------------------------
        // LD (HL),r	(HL)<-r					01 110  r 
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0160")] = {
            mnemonic: "LD (HL),B",
            proc: () => { poke(getHL(), getB()); },
            "cycle": 10,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0161")] = {
            mnemonic: "LD (HL),C",
            proc: () => { poke(getHL(), getC()); },
            "cycle": 10,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0162")] = {
            mnemonic: "LD (HL),D",
            proc: () => { poke(getHL(), getD()); },
            "cycle": 10,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0163")] = {
            mnemonic: "LD (HL),E",
            proc: () => { poke(getHL(), getE()); },
            "cycle": 10,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0164")] = {
            mnemonic: "LD (HL),H",
            proc: () => { poke(getHL(), getH()); },
            "cycle": 10,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0165")] = {
            mnemonic: "LD (HL),L",
            proc: () => { poke(getHL(), getL()); },
            "cycle": 10,
            disasm: disa_0x_r_110
        };
        this.opecodeTable[oct("0167")] = {
            mnemonic: "LD (HL),A",
            proc: () => { poke(getHL(), getA()); },
            "cycle": 10,
            disasm: disa_0x_r_110
        };
        //---------------------------------------------------------------------------------
        // LD (HL),n	(HL)<-n					00 110 110	<-  n   ->
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0066")] = {
            mnemonic: "LD (HL),n",
            proc: () => { poke(getHL(), fetch()); },
            "cycle": 10,
            disasm: disa_0x_r_110
        };
        //---------------------------------------------------------------------------------
        // LD A,(BC)	A<-(BC)					00 001 010
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0012")] = {
            mnemonic: "LD A,(BC)",
            proc: () => { setA(peek(getBC())); },
            "cycle": 7,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["LD", "A", "(BC)"] }; }
        };
        //---------------------------------------------------------------------------------
        // LD A,(DE)	A<-(DE)					00 011 010
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0032")] = {
            mnemonic: "LD A,(DE)",
            proc: () => { setA(peek(getDE())); },
            "cycle": 7,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["LD", "A", "(DE)"] }; }
        };
        //---------------------------------------------------------------------------------
        // LD A,(nn)	A<-(nn)					00 111 010	<-  n   ->	<-  n   ->
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0072")] = {
        mnemonic: "LD A,(nn)",
            proc: () => { setA(peek(fetchPair())); },
            "cycle": 13,
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2)],
                    mnemonic: ["LD", "A", "(" + NumberUtil.HEX(mem.peekPair(addr + 1), 4) + "H)"]
                };
            }
        };
        //--------------------------------------------------------------------------------
        // LD (BC),A	(BC)<-A					00 000 010
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0002")] = {
        mnemonic: "LD (BC),A",
            proc: () => { poke(getBC(), getA()); },
            "cycle": 7,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["LD", "(BC)", "A"] }; }
        };
        //---------------------------------------------------------------------------------
        // LD (DE),A	(DE)<-A					00 010 010
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0022")] = {
        mnemonic: "LD (DE),A",
            proc: () => { poke(getDE(), getA()); },
            "cycle": 7,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["LD", "(DE)", "A"] }; }
        };
        //---------------------------------------------------------------------------------
        // LD (nn),A	(nn)<-A					00 110 010	<-  n   ->	<-  n   ->
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0062")] = {
        mnemonic: "LD (nn),A",
            proc: () => { poke(fetchPair(), getA()); },
            "cycle": 13,
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2)],
                    mnemonic: ["LD", "(" + NumberUtil.HEX(mem.peekPair(addr + 1), 4) + "H)", "A"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // LD A,I		A<-I					11 101 101	01 010 111          S,Z,H=0,P/V=IFF,N=0
        //---------------------------------------------------------------------------------
        opeMisc[oct("0127")] = {
            mnemonic: "LD A,I",
            proc: () => {
                reg.LD_A_I(this.IFF2);
            },
            "cycle": 9,
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "A", "I"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // LD A,R		A<-R					11 101 101	01 011 111          S,Z,H=0,P/V=IFF,N=0
        //---------------------------------------------------------------------------------
        opeMisc[oct("0137")] = {
            mnemonic: "LD A,R",
            proc: () => {
                reg.LD_A_R(this.IFF2, this.regB.R);
            },
            "cycle": 9,
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "A", "R"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // LD I,A		I<-A					11 101 101	01 000 111
        //---------------------------------------------------------------------------------
        opeMisc[oct("0107")] = {
            mnemonic: "LD I,A",
            proc: () => { reg.I = getA(); },
            "cycle": 9,
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "I", "A"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // LD R,A		R<-A					11 101 101	01 001 111
        //---------------------------------------------------------------------------------
        opeMisc[oct("0117")] = {
            mnemonic: "LD R,A",
            proc: () => { reg.R = this.regB.R = getA(); },
            "cycle": 9,
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "R", "A"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // LD r, (IX+d)
        //---------------------------------------------------------------------------------
        var disasm_LD_r_idx_d = function (mem, addr, r, idx) {
            var d = mem.peek(addr + 2);
            return {
                code: [mem.peek(addr), mem.peek(addr + 1), d],
                mnemonic: ["LD", r, "(" + idx + "+" + NumberUtil.HEX(d, 2) + "H)"]
            };
        };
        var disasm_LD_idx_d_r = function (mem, addr, idx, r) {
            const d = mem.peek(addr + 2);
            const d8s = NumberUtil.to8bitSigned(d);
            const displacement = `${d8s>=0?"+":""}${d8s}`;
            return {
                code: [mem.peek(addr), mem.peek(addr + 1), d],
                mnemonic: ["LD", `(${idx}${displacement})`, r]
            };
        };
        opeIX[oct("0106")] = {
            mnemonic: "LD B,(IX+d)",
            proc: () => { setB(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "B", "IX");
            }
        };
        opeIX[oct("0116")] = {
            mnemonic: "LD C,(IX+d)",
            proc: () => { setC(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "C", "IX");
            }
        };
        opeIX[oct("0126")] = {
            mnemonic: "LD D,(IX+d)",
            proc: () => { setD(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "D", "IX");
            }
        };
        opeIX[oct("0136")] = {
            mnemonic: "LD E,(IX+d)",
            proc: () => { setE(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "E", "IX");
            }
        };
        opeIX[oct("0146")] = {
            mnemonic: "LD H,(IX+d)",
            proc: () => { setH(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "H", "IX");
            }
        };
        opeIX[oct("0156")] = {
            mnemonic: "LD L,(IX+d)",
            proc: () => { setL(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "L", "IX");
            }
        };
        opeIX[oct("0176")] = {
            mnemonic: "LD A,(IX+d)",
            proc: () => { setA(peek(reg.IX + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "A", "IX");
            }
        };
        //---------------------------------------------------------------------------------
        // LD (IX+d), r
        //---------------------------------------------------------------------------------
        opeIX[oct("0160")] = {
            mnemonic: "LD (IX+d),B",
            proc: () => { poke(reg.IX + fetchSigned(), getB()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IX", "B");
            }
        };
        opeIX[oct("0161")] = {
            mnemonic: "LD (IX+d),C",
            proc: () => { poke(reg.IX + fetchSigned(), getC()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IX", "C");
            }
        };
        opeIX[oct("0162")] = {
            mnemonic: "LD (IX+d),D",
            proc: () => { poke(reg.IX + fetchSigned(), getD()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IX", "D");
            }
        };
        opeIX[oct("0163")] = {
            mnemonic: "LD (IX+d),E",
            proc: () => { poke(reg.IX + fetchSigned(), getE()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IX", "E");
            }
        };
        opeIX[oct("0164")] = {
            mnemonic: "LD (IX+d),H",
            proc: () => { poke(reg.IX + fetchSigned(), getH()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IX", "H");
            }
        };
        opeIX[oct("0165")] = {
            mnemonic: "LD (IX+d),L",
            proc: () => { poke(reg.IX + fetchSigned(), getL()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IX", "L");
            }
        };
        opeIX[oct("0167")] = {
            mnemonic: "LD (IX+d),A",
            proc: () => { poke(reg.IX + fetchSigned(), getA()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IX", "A");
            }
        };
        //---------------------------------------------------------------------------------
        // LD r, (IX+d)
        //---------------------------------------------------------------------------------
        opeIY[oct("0106")] = {
            mnemonic: "LD B,(IY+d)",
            proc: () => { setB(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "B", "IY");
            }
        };
        opeIY[oct("0116")] = {
            mnemonic: "LD C,(IY+d)",
            proc: () => { setC(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "C", "IY");
            }
        };
        opeIY[oct("0126")] = {
            mnemonic: "LD D,(IY+d)",
            proc: () => { setD(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "D", "IY");
            }
        };
        opeIY[oct("0136")] = {
            mnemonic: "LD E,(IY+d)",
            proc: () => { setE(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "E", "IY");
            }
        };
        opeIY[oct("0146")] = {
            mnemonic: "LD H,(IY+d)",
            proc: () => { setH(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "H", "IY");
            }
        };
        opeIY[oct("0156")] = {
            mnemonic: "LD L,(IY+d)",
            proc: () => { setL(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "L", "IY");
            }
        };
        opeIY[oct("0176")] = {
            mnemonic: "LD A,(IY+d)",
            proc: () => { setA(peek(reg.IY + fetchSigned())); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_r_idx_d(mem, addr, "A", "IY");
            }
        };
        //---------------------------------------------------------------------------------
        // LD (IY+d), r
        //---------------------------------------------------------------------------------
        opeIY[oct("0160")] = {
            mnemonic: "LD (IY+d),B",
            proc: () => { poke(reg.IY + fetchSigned(), getB()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IY", "B");
            }
        };
        opeIY[oct("0161")] = {
            mnemonic: "LD (IY+d),C",
            proc: () => { poke(reg.IY + fetchSigned(), getC()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IY", "C");
            }
        };
        opeIY[oct("0162")] = {
            mnemonic: "LD (IY+d),D",
            proc: () => { poke(reg.IY + fetchSigned(), getD()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IY", "D");
            }
        };
        opeIY[oct("0163")] = {
            mnemonic: "LD (IY+d),E",
            proc: () => { poke(reg.IY + fetchSigned(), getE()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IY", "E");
            }
        };
        opeIY[oct("0164")] = {
            mnemonic: "LD (IY+d),H",
            proc: () => { poke(reg.IY + fetchSigned(), getH()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IY", "H");
            }
        };
        opeIY[oct("0165")] = {
            mnemonic: "LD (IY+d),L",
            proc: () => { poke(reg.IY + fetchSigned(), getL()); },
            "cycle": 19,
            disasm: function (mem, addr) {
                return disasm_LD_idx_d_r(mem, addr, "IY", "L");
            }
        };
        opeIY[oct("0167")] = {
            mnemonic: "LD (IY+d),A",
            proc: () => { poke(reg.IY + fetchSigned(), getA()); },
            "cycle": 19,
            disasm: function (mem, addr) {
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
        var disasm_LD_dd_nn = function (mem, addr:number) {
            var opcode = mem.peek(addr);
            var nnL = mem.peek(addr + 1);
            var nnH = mem.peek(addr + 2);
            var nn = BinUtil.pair(nnH, nnL);
            var ddIndex = ((opcode >> 4) & 0x03);
            const reg16bitName = ["BC","DE","HL","SP"];
            if(ddIndex >= reg16bitName.length) {
                throw "*** LD dd,nn; but unknown dd.";
            }
            const dd = reg16bitName[ddIndex];
            return {
                code: [opcode, nnL, nnH],
                mnemonic: ["LD", dd, NumberUtil.HEX(nn, 4) + "H"]
            };
        };
        this.opecodeTable[oct("0001")] = {
            mnemonic: "LD BC,nn",
            cycle: 10,
            proc: () => {
                setC(fetch());
                setB(fetch());
            },
            disasm: disasm_LD_dd_nn
        };
        this.opecodeTable[oct("0021")] = {
            mnemonic: "LD DE,nn",
            cycle: 10,
            proc: () => {
                setE(fetch());
                setD(fetch());
            },
            disasm: disasm_LD_dd_nn
        };
        this.opecodeTable[oct("0041")] = {
            mnemonic: "LD HL,nn",
            cycle: 10,
            proc: () => {
                setL(fetch());
                setH(fetch());
            },
            disasm: disasm_LD_dd_nn
        };
        this.opecodeTable[oct("0061")] = {
            mnemonic: "LD SP,nn",
            cycle: 10,
            proc: () => {
                reg.SP = fetchPair();
            },
            disasm: disasm_LD_dd_nn
        };
        //---------------------------------------------------------------------------------
        // LD HL,(nn)	H<-(nn+1),L<-(nn)		00 101 010	<-  n   ->	<-  n   ->
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0052")] = {
            mnemonic: "LD HL,(nn)",
            cycle: 16,
            proc: () => {
                var nn = fetchPair();
                setL(peek(nn + 0));
                setH(peek(nn + 1));
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var nnL = mem.peek(addr + 1);
                var nnH = mem.peek(addr + 2);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, nnL, nnH],
                    mnemonic: ["LD", "HL", "(" + NumberUtil.HEX(nn, 4) + "H)"]
                };
            }
        };
        opeMisc[oct("0113")] = {
            mnemonic: "LD BC,(nn)",
            cycle: 20,
            proc: () => {
                var nn = fetchPair();
                setC(peek(nn + 0));
                setB(peek(nn + 1));
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr + 1);
                var nnL = mem.peek(addr + 2);
                var nnH = mem.peek(addr + 3);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "BC", "(" + NumberUtil.HEX(nn, 4) + "H)"]
                };
            }
        };
        opeMisc[oct("0133")] = {
            mnemonic: "LD DE,(nn)",
            cycle: 20,
            proc: () => {
                var nn = fetchPair();
                setE(peek(nn + 0));
                setD(peek(nn + 1));
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr + 1);
                var nnL = mem.peek(addr + 2);
                var nnH = mem.peek(addr + 3);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "DE", "(" + NumberUtil.HEX(nn, 4) + "H)"]
                };
            }
        };
        opeMisc[oct("0153")] = {
            mnemonic: "LD HL,(nn)",
            cycle: 20,
            proc: () => {
                var nn = fetchPair();
                setL(peek(nn + 0));
                setH(peek(nn + 1));
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr + 1);
                var nnL = mem.peek(addr + 2);
                var nnH = mem.peek(addr + 3);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "HL", "(" + NumberUtil.HEX(nn, 4) + "H)"]
                };
            }
        };
        opeMisc[oct("0173")] = {
            mnemonic: "LD SP,(nn)",
            cycle: 20,
            proc: () => {
                reg.SP = peekPair(fetchPair());
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr + 1);
                var nnL = mem.peek(addr + 2);
                var nnH = mem.peek(addr + 3);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "SP", "(" + NumberUtil.HEX(nn, 4) + "H)"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // LD (nn),HL	(nn+1)<-H,(nn)<-L		00 100 010	<-  n   ->	<-  n   ->
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0042")] = {
            mnemonic: "LD (nn), HL",
            cycle: 16,
            proc: () => {
                var nn = fetchPair();
                poke(nn + 0, getL());
                poke(nn + 1, getH());
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var nnL = mem.peek(addr + 1);
                var nnH = mem.peek(addr + 2);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, nnL, nnH],
                    mnemonic: ["LD", "(" + NumberUtil.HEX(nn, 4) + "H)", "HL"]
                };
            }
        };
        opeMisc[oct("0103")] = {
            mnemonic: "LD (nn),BC",
            cycle: 20,
            proc: () => {
                var nn = fetchPair();
                poke(nn + 0, getC());
                poke(nn + 1, getB());
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr + 1);
                var nnL = mem.peek(addr + 2);
                var nnH = mem.peek(addr + 3);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "(" + NumberUtil.HEX(nn, 4) + "H)", "BC"]
                };
            }
        };
        opeMisc[oct("0123")] = {
            mnemonic: "LD (nn),DE",
            cycle: 20,
            proc: () => {
                var nn = fetchPair();
                poke(nn + 0, getE());
                poke(nn + 1, getD());
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr + 1);
                var nnL = mem.peek(addr + 2);
                var nnH = mem.peek(addr + 3);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "(" + NumberUtil.HEX(nn, 4) + "H)", "DE"]
                };
            }
        };
        opeMisc[oct("0143")] = {
            mnemonic: "LD (nn),HL",
            cycle: 20,
            proc: () => {
                var nn = fetchPair();
                poke(nn + 0, getL());
                poke(nn + 1, getH());
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr + 1);
                var nnL = mem.peek(addr + 2);
                var nnH = mem.peek(addr + 3);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "(" + NumberUtil.HEX(nn, 4) + "H)", "HL"]
                };
            }
        };
        opeMisc[oct("0163")] = {
            mnemonic: "LD (nn),SP",
            cycle: 20,
            proc: () => {
                var nn = fetchPair();
                poke(nn + 0, (reg.SP >> 0) & 0xff);
                poke(nn + 1, (reg.SP >> 8) & 0xff);
            },
            disasm: function (mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr + 1);
                var nnL = mem.peek(addr + 2);
                var nnH = mem.peek(addr + 3);
                var nn = BinUtil.pair(nnH, nnL);
                return {
                    code: [opcode, operand, nnL, nnH],
                    mnemonic: ["LD", "(" + NumberUtil.HEX(nn, 4) + "H)", "SP"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // LD SP,HL		SP<-HL					11 111 001
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0371")] = {
            mnemonic: "LD SP,HL",
            cycle: 6,
            proc: () => {
                reg.SP = getHL();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["LD", "SP", "HL"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // PUSH qq		(SP-2)<-qqL,(SP-1)<-qqH	11 qq0 101
        //---------------------------------------------------------------------------------
        this.opecodeTable[0xc0 + (0 << 4) + 0x05] = {
            mnemonic: "PUSH BC",
            cycle: 11,
            proc: () => {
                poke(--reg.SP, getB());
                poke(--reg.SP, getC());
            },
            disasm: function (mem, addr) {
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
            disasm: function (mem, addr) {
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
            disasm: function (mem, addr) {
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
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["PUSH", "AF"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // POP qq		qqL<-(SP),qqH<-(SP+1)	11 qq0 001
        //---------------------------------------------------------------------------------
        this.opecodeTable[0xc0 + (0 << 4) + 0x01] = {
            mnemonic: "POP BC",
            cycle: 10,
            proc: () => {
                setC(peek(reg.SP++));
                setB(peek(reg.SP++));
            },
            disasm: function (mem, addr) {
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
            disasm: function (mem, addr) {
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
            disasm: function (mem, addr) {
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
            disasm: function (mem, addr) {
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
            disasm: function (mem, addr) {
                return {
                    "code": [
                        0xDD, 0x21,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3)
                    ],
                    "mnemonic": [
                        "LD", "IX", NumberUtil.HEX(mem.peekPair(addr + 2), 4) + "H"
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
            disasm: function (mem, addr) {
                return {
                    "code": [
                        0xDD, 0x2A,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3)
                    ],
                    "mnemonic": [
                        "LD", "IX", "(" + NumberUtil.HEX(mem.peekPair(addr + 2), 4) + "H)"
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
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                const n = mem.peek(addr + 3);
                return {
                    "code": [0xDD, 0x36, d, n],
                    "mnemonic": [
                        "LD", `(IX${displacement})`, NumberUtil.HEX(n, 2) + "H"
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
            disasm: function ( /*mem, addr*/) {
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
                poke(--reg.SP, BinUtil.hibyte(reg.IX));
                poke(--reg.SP, BinUtil.lobyte(reg.IX));
            },
            disasm: function ( /*mem, addr*/) {
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
            disasm: function ( /*mem, addr*/) {
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
                var tmpH = peek(reg.SP + 1);
                poke(reg.SP + 1, BinUtil.hibyte(reg.IX));
                var tmpL = peek(reg.SP);
                poke(reg.SP, BinUtil.lobyte(reg.IX));
                reg.IX = BinUtil.pair(tmpH, tmpL);
            },
            disasm: function ( /*mem, addr*/) {
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
            disasm: function (mem, addr) {
                return {
                    "code": [
                        0xFD, 0x21,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3)
                    ],
                    "mnemonic": [
                        "LD", "IY", NumberUtil.HEX(mem.peekPair(addr + 2), 4) + "H"
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
            disasm: function (mem, addr) {
                return {
                    "code": [
                        0xFD, 0x2A,
                        mem.peek(addr + 2),
                        mem.peek(addr + 3)
                    ],
                    "mnemonic": [
                        "LD", "IY", "(" + NumberUtil.HEX(mem.peekPair(addr + 2), 4) + "H)"
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
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                const n = mem.peek(addr + 3);
                return {
                    "code": [0xFD, 0x36, d, n],
                    "mnemonic": [
                        "LD", `(IY${displacement})`, NumberUtil.HEX(n, 2) + "H"
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
            disasm: function ( /*mem, addr*/) {
                return { "code": [0xFD, 0xF9], "mnemonic": ["LD", "SP", "IY"] };
            }
        };
        opeIY[0xE5] = {
            mnemonic: "PUSH IY",
            cycle: 15,
            proc: () => {
                poke(--reg.SP, BinUtil.hibyte(reg.IY));
                poke(--reg.SP, BinUtil.lobyte(reg.IY));
            },
            disasm: function ( /*mem, addr*/) {
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
            disasm: function ( /*mem, addr*/) {
                return { "code": [0xFD, 0xE1], "mnemonic": ["POP", "IY"] };
            }
        };
        opeIY[0xE3] = {
            mnemonic: "EX (SP),IY",
            cycle: 23,
            proc: () => {
                var tmpH = peek(reg.SP + 1);
                poke(reg.SP + 1, (reg.IY >> 8) & 0xff);
                var tmpL = peek(reg.SP);
                poke(reg.SP, (reg.IY >> 0) & 0xff);
                reg.IY = (tmpH << 8) + tmpL;
            },
            disasm: function ( /*mem, addr*/) {
                return { "code": [0xFD, 0xE3], "mnemonic": ["EX", "(SP)", "IY"] };
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
            mnemonic: "EX DE,HL ",
            cycle: 4,
            proc: () => {
                var tmp = getD();
                setD(getH());
                setH(tmp);
                tmp = getE();
                setE(getL());
                setL(tmp);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EX", "DE", "HL"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // EX AF,AF'
        //---------------------------------------------------------------------------------
        this.opecodeTable[0x08] = {
            mnemonic: "EX AF,AF'",
            cycle: 4,
            proc: () => {
                var tmp = getA();
                setA(this.regB.getA());
                this.regB.setA(tmp);
                tmp = reg.getF();
                reg.setF(this.regB.getF());
                this.regB.setF(tmp);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EX", "AF", "AF'"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // EXX
        //---------------------------------------------------------------------------------
        this.opecodeTable[0xD9] = {
            mnemonic: "EXX",
            cycle: 4,
            proc: () => {
                var tmp = getB();
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
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EXX"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        //  EX (SP),HL
        //---------------------------------------------------------------------------------
        this.opecodeTable[0xE3] = {
            mnemonic: "EX (SP),HL",
            cycle: 19,
            proc: () => {
                var tmp = peek(reg.SP + 1);
                poke(reg.SP + 1, getH());
                setH(tmp);
                tmp = peek(reg.SP);
                poke(reg.SP, getL());
                setL(tmp);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EX", "(SP)", "HL"]
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
            mnemonic: "LDI",
            cycle: 16,
            proc: () => {
                poke(getDE(), peek(getHL()));
                reg.onLDI();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LDI"]
                };
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
            mnemonic: "LDIR",
            cycle: "BC≠0→21, BC=0→16",
            proc: () => {
                poke(getDE(), peek(getHL()));
                reg.onLDI();
                if (getBC() != 0) {
                    reg.PC -= 2;
                    return 21;
                }
                return 16;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
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
            mnemonic: "LDD",
            cycle: 16,
            proc: () => {
                poke(getDE(), peek(getHL()));
                reg.onLDD();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
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
            mnemonic: "LDDR",
            cycle: "BC≠0→21, BC=0→16",
            proc: () => {
                poke(getDE(), peek(getHL()));
                reg.onLDD();
                if (getBC() != 0) {
                    reg.PC -= 2;
                    return 21;
                }
                return 16;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
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
            mnemonic: "CPI",
            cycle: 16,
            proc: () => {
                reg.CPI(peek(getHL()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
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
            mnemonic: "CPIR",
            cycle: "{BC≠0 && A≠(HL)}→21, {BC=0 || A=(HL)}→16",
            proc: () => {
                reg.CPI(peek(getHL()));
                if (getBC() != 0 && !reg.flagZ()) {
                    reg.PC -= 2;
                    return 21;
                }
                return 16;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
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
            mnemonic: "CPD",
            cycle: 16,
            proc: () => {
                reg.CPD(peek(getHL()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
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
            mnemonic: "CPDR",
            cycle: "{BC≠0 && A≠(HL)}→21, {BC=0 || A=(HL)}→16",
            proc: () => {
                reg.CPD(peek(getHL()));
                if (getBC() != 0 && !reg.flagZ()) {
                    reg.PC -= 2;
                    return 21;
                }
                return 16;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
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
            mnemonic: "ADD A,B",
            cycle: 4,
            proc: () => { reg.addAcc(getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "B"]
                };
            }
        };
        this.opecodeTable[oct("0201")] = {
            mnemonic: "ADD A,C",
            cycle: 4,
            proc: () => { reg.addAcc(getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "C"]
                };
            }
        };
        this.opecodeTable[oct("0202")] = {
            mnemonic: "ADD A,D",
            cycle: 4,
            proc: () => { reg.addAcc(getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "D"]
                };
            }
        };
        this.opecodeTable[oct("0203")] = {
            mnemonic: "ADD A,E",
            cycle: 4,
            proc: () => { reg.addAcc(getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "E"]
                };
            }
        };
        this.opecodeTable[oct("0204")] = {
            mnemonic: "ADD A,H",
            cycle: 4,
            proc: () => { reg.addAcc(getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "H"]
                };
            }
        };
        this.opecodeTable[oct("0205")] = {
            mnemonic: "ADD A,L",
            cycle: 4,
            proc: () => { reg.addAcc(getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "L"]
                };
            }
        };
        this.opecodeTable[oct("0207")] = {
            mnemonic: "ADD A,A",
            cycle: 4,
            proc: () => { reg.addAcc(getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "A"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // ADD A,n       A <- A + n         11[000]110
        //                                  <---n---->
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0306")] = {
            mnemonic: "ADD A,n",
            cycle: 7,
            proc: () => { reg.addAcc(fetch()); },
            disasm: function (mem, addr) {
                var n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["ADD", "A", NumberUtil.HEX(n, 2) + "H"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // ADD A,(HL)    A <- A + (HL)      10[000]110
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0206")] = {
            mnemonic: "ADD A,(HL)",
            cycle: 7,
            proc: () => { reg.addAcc(peek(getHL())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "A", "(HL)"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // ADD A,(IX+d)  A <- A + (IX+d)    11 011 101
        //                                  10[000]110
        //                                  <---d---->
        //---------------------------------------------------------------------------------
        opeIX[oct("0206")] = {
            mnemonic: "ADD A,(IX+d)",
            cycle: 19,
            proc: () => {
                reg.addAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["ADD", "A", `(IX${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // ADD A,(IY+d)  A <- A + (IY+d)    11 111 101
        //                                  10[000]110
        //                                  <---d---->
        //---------------------------------------------------------------------------------
        opeIY[oct("0206")] = {
            mnemonic: "ADD A,(IY+d)",
            cycle: 19,
            proc: () => {
                reg.addAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["ADD", "A", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // ADC A,s      A <- A + s + CY       [001]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0210")] = {
            mnemonic: "ADC A,B",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "B"]
                };
            }
        };
        this.opecodeTable[oct("0211")] = {
            mnemonic: "ADC A,C",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "C"]
                };
            }
        };
        this.opecodeTable[oct("0212")] = {
            mnemonic: "ADC A,D",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "D"]
                };
            }
        };
        this.opecodeTable[oct("0213")] = {
            mnemonic: "ADC A,E",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "E"]
                };
            }
        };
        this.opecodeTable[oct("0214")] = {
            mnemonic: "ADC A,H",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "H"]
                };
            }
        };
        this.opecodeTable[oct("0215")] = {
            mnemonic: "ADC A,L",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "L"]
                };
            }
        };
        this.opecodeTable[oct("0217")] = {
            mnemonic: "ADC A,A",
            cycle: 4,
            proc: () => { reg.addAccWithCarry(getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "A"]
                };
            }
        };
        this.opecodeTable[oct("0316")] = {
            mnemonic: "ADC A,n",
            cycle: 7,
            proc: () => { reg.addAccWithCarry(fetch()); },
            disasm: function (mem, addr) {
                var n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["ADC", "A", NumberUtil.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct("0216")] = {
            mnemonic: "ADC A,(HL)",
            cycle: 7,
            proc: () => { reg.addAccWithCarry(peek(getHL())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADC", "A", "(HL)"]
                };
            }
        };
        opeIX[oct("0216")] = {
            mnemonic: "ADC A,(IX+d)",
            cycle: 19,
            proc: () => {
                reg.addAccWithCarry(peek(reg.IX + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["ADC", "A", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct("0216")] = {
            mnemonic: "ADC A,(IY+d)",
            cycle: 19,
            proc: () => {
                reg.addAccWithCarry(peek(reg.IY + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["ADC", "A", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // SUB s        A <- A - s            [010]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0220")] = {
            mnemonic: "SUB A,B",
            cycle: 4,
            proc: () => { reg.subAcc(getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "B"]
                };
            }
        };
        this.opecodeTable[oct("0221")] = {
            mnemonic: "SUB A,C",
            cycle: 4,
            proc: () => { reg.subAcc(getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "C"]
                };
            }
        };
        this.opecodeTable[oct("0222")] = {
            mnemonic: "SUB A,D",
            cycle: 4,
            proc: () => { reg.subAcc(getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "D"]
                };
            }
        };
        this.opecodeTable[oct("0223")] = {
            mnemonic: "SUB A,E",
            cycle: 4,
            proc: () => { reg.subAcc(getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "E"]
                };
            }
        };
        this.opecodeTable[oct("0224")] = {
            mnemonic: "SUB A,H",
            cycle: 4,
            proc: () => { reg.subAcc(getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "H"]
                };
            }
        };
        this.opecodeTable[oct("0225")] = {
            mnemonic: "SUB A,L",
            cycle: 4,
            proc: () => { reg.subAcc(getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "L"]
                };
            }
        };
        this.opecodeTable[oct("0227")] = {
            mnemonic: "SUB A,A",
            cycle: 4,
            proc: () => { reg.subAcc(getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "A"]
                };
            }
        };
        this.opecodeTable[oct("0326")] = {
            mnemonic: "SUB A,n",
            cycle: 7,
            proc: () => { reg.subAcc(fetch()); },
            disasm: function (mem, addr) {
                var n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["SUB", "A", NumberUtil.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct("0226")] = {
            mnemonic: "SUB A,(HL)",
            cycle: 7,
            proc: () => {
                reg.subAcc(peek(getHL()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SUB", "A", "(HL)"]
                };
            }
        };
        opeIX[oct("0226")] = {
            mnemonic: "SUB A,(IX+d)",
            cycle: 19,
            proc: () => {
                reg.subAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["SUB", "A", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct("0226")] = {
            mnemonic: "SUB A,(IY+d)",
            cycle: 19,
            proc: () => {
                reg.subAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["SUB", "A", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // SBC A,s      A <- A - s - CY       [011]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0230")] = {
            mnemonic: "SBC A,B",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "B"]
                };
            }
        };
        this.opecodeTable[oct("0231")] = {
            mnemonic: "SBC A,C",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "C"]
                };
            }
        };
        this.opecodeTable[oct("0232")] = {
            mnemonic: "SBC A,D",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "D"]
                };
            }
        };
        this.opecodeTable[oct("0233")] = {
            mnemonic: "SBC A,E",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "E"]
                };
            }
        };
        this.opecodeTable[oct("0234")] = {
            mnemonic: "SBC A,H",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "H"]
                };
            }
        };
        this.opecodeTable[oct("0235")] = {
            mnemonic: "SBC A,L",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "L"]
                };
            }
        };
        this.opecodeTable[oct("0237")] = {
            mnemonic: "SBC A,A",
            cycle: 4,
            proc: () => { reg.subAccWithCarry(getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "A"]
                };
            }
        };
        this.opecodeTable[oct("0336")] = {
            mnemonic: "SBC A,n",
            cycle: 7,
            proc: () => { reg.subAccWithCarry(fetch()); },
            disasm: function (mem, addr) {
                var n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["SBC", "A," + NumberUtil.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct("0236")] = {
            mnemonic: "SBC A,(HL)",
            cycle: 7,
            proc: () => {
                reg.subAccWithCarry(peek(getHL()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SBC", "A", "(HL)"]
                };
            }
        };
        opeIX[oct("0236")] = {
            mnemonic: "SBC A,(IX+d)",
            cycle: 19,
            proc: () => {
                reg.subAccWithCarry(peek(reg.IX + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["SBC", "A", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct("0236")] = {
            mnemonic: "SBC A,(IY+d)",
            cycle: 19,
            proc: () => {
                reg.subAccWithCarry(peek(reg.IY + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["SBC", "A", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // AND s        A <- A & s            [100]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0240")] = {
            mnemonic: "AND B",
            cycle: 4,
            proc: () => { reg.andAcc(getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "B"]
                };
            }
        };
        this.opecodeTable[oct("0241")] = {
            mnemonic: "AND C",
            cycle: 4,
            proc: () => { reg.andAcc(getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "C"]
                };
            }
        };
        this.opecodeTable[oct("0242")] = {
            mnemonic: "AND D",
            cycle: 4,
            proc: () => { reg.andAcc(getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "D"]
                };
            }
        };
        this.opecodeTable[oct("0243")] = {
            mnemonic: "AND E",
            cycle: 4,
            proc: () => { reg.andAcc(getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "E"]
                };
            }
        };
        this.opecodeTable[oct("0244")] = {
            mnemonic: "AND H",
            cycle: 4,
            proc: () => { reg.andAcc(getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "H"]
                };
            }
        };
        this.opecodeTable[oct("0245")] = {
            mnemonic: "AND L",
            cycle: 4,
            proc: () => { reg.andAcc(getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "L"]
                };
            }
        };
        this.opecodeTable[oct("0247")] = {
            mnemonic: "AND A",
            cycle: 4,
            proc: () => { reg.andAcc(getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "A"]
                };
            }
        };
        this.opecodeTable[oct("0346")] = {
            mnemonic: "AND n",
            cycle: 7,
            proc: () => { reg.andAcc(fetch()); },
            disasm: function (mem, addr) {
                var n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["AND", NumberUtil.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct("0246")] = {
            mnemonic: "AND (HL)",
            cycle: 7,
            proc: () => {
                reg.andAcc(peek(getHL()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["AND", "(HL)"]
                };
            }
        };
        opeIX[oct("0246")] = {
            mnemonic: "AND (IX+d)",
            cycle: 19,
            proc: () => {
                reg.andAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["AND", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct("0246")] = {
            mnemonic: "AND (IY+d)",
            cycle: 19,
            proc: () => {
                reg.andAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["AND", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // OR s         A <- A | s            [110]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0260")] = {
            mnemonic: "OR B",
            cycle: 4,
            proc: () => { reg.orAcc(getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "B"]
                };
            }
        };
        this.opecodeTable[oct("0261")] = {
            mnemonic: "OR C",
            cycle: 4,
            proc: () => { reg.orAcc(getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "C"]
                };
            }
        };
        this.opecodeTable[oct("0262")] = {
            mnemonic: "OR D",
            cycle: 4,
            proc: () => { reg.orAcc(getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "D"]
                };
            }
        };
        this.opecodeTable[oct("0263")] = {
            mnemonic: "OR E",
            cycle: 4,
            proc: () => { reg.orAcc(getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "E"]
                };
            }
        };
        this.opecodeTable[oct("0264")] = {
            mnemonic: "OR H",
            cycle: 4,
            proc: () => { reg.orAcc(getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "H"]
                };
            }
        };
        this.opecodeTable[oct("0265")] = {
            mnemonic: "OR L",
            cycle: 4,
            proc: () => { reg.orAcc(getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "L"]
                };
            }
        };
        this.opecodeTable[oct("0267")] = {
            mnemonic: "OR A",
            cycle: 4,
            proc: () => { reg.orAcc(getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "A"]
                };
            }
        };
        this.opecodeTable[oct("0366")] = {
            mnemonic: "OR n",
            cycle: 7,
            proc: () => { reg.orAcc(fetch()); },
            disasm: function (mem, addr) {
                var n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["OR", NumberUtil.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct("0266")] = {
            mnemonic: "OR (HL)",
            cycle: 7,
            proc: () => {
                reg.orAcc(peek(getHL()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["OR", "(HL)"]
                };
            }
        };
        opeIX[oct("0266")] = {
            mnemonic: "OR (IX+d)",
            cycle: 19,
            proc: () => {
                reg.orAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["OR", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct("0266")] = {
            mnemonic: "OR (IY+d)",
            cycle: 19,
            proc: () => {
                reg.orAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["OR", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // XOR s        A <- A ~ s            [101]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0250")] = {
            mnemonic: "XOR B",
            cycle: 4,
            proc: () => { reg.xorAcc(getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "B"]
                };
            }
        };
        this.opecodeTable[oct("0251")] = {
            mnemonic: "XOR C",
            cycle: 4,
            proc: () => { reg.xorAcc(getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "C"]
                };
            }
        };
        this.opecodeTable[oct("0252")] = {
            mnemonic: "XOR D",
            cycle: 4,
            proc: () => { reg.xorAcc(getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "D"]
                };
            }
        };
        this.opecodeTable[oct("0253")] = {
            mnemonic: "XOR E",
            cycle: 4,
            proc: () => { reg.xorAcc(getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "E"]
                };
            }
        };
        this.opecodeTable[oct("0254")] = {
            mnemonic: "XOR H",
            cycle: 4,
            proc: () => { reg.xorAcc(getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "H"]
                };
            }
        };
        this.opecodeTable[oct("0255")] = {
            mnemonic: "XOR L",
            cycle: 4,
            proc: () => { reg.xorAcc(getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "L"]
                };
            }
        };
        this.opecodeTable[oct("0257")] = {
            mnemonic: "XOR A",
            cycle: 4,
            proc: () => { reg.xorAcc(getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "A"]
                };
            }
        };
        this.opecodeTable[oct("0356")] = {
            mnemonic: "XOR n",
            cycle: 7,
            proc: () => { reg.xorAcc(fetch()); },
            disasm: function (mem, addr) {
                var n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["XOR", NumberUtil.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct("0256")] = {
            mnemonic: "XOR (HL)",
            cycle: 7,
            proc: () => { reg.xorAcc(peek(getHL())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["XOR", "(HL)"]
                };
            }
        };
        opeIX[oct("0256")] = {
            mnemonic: "XOR (IX+d)",
            cycle: 19,
            proc: () => {
                reg.xorAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["XOR", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct("0256")] = {
            mnemonic: "XOR (IY+d)",
            cycle: 19,
            proc: () => {
                reg.xorAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["XOR", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // CP s         A - s                 [111]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0270")] = {
            mnemonic: "CP B",
            cycle: 4,
            proc: () => { reg.compareAcc(getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "B"]
                };
            }
        };
        this.opecodeTable[oct("0271")] = {
            mnemonic: "CP C",
            cycle: 4,
            proc: () => { reg.compareAcc(getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "C"]
                };
            }
        };
        this.opecodeTable[oct("0272")] = {
            mnemonic: "CP D",
            cycle: 4,
            proc: () => { reg.compareAcc(getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "D"]
                };
            }
        };
        this.opecodeTable[oct("0273")] = {
            mnemonic: "CP E",
            cycle: 4,
            proc: () => { reg.compareAcc(getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "E"]
                };
            }
        };
        this.opecodeTable[oct("0274")] = {
            mnemonic: "CP H",
            cycle: 4,
            proc: () => { reg.compareAcc(getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "H"]
                };
            }
        };
        this.opecodeTable[oct("0275")] = {
            mnemonic: "CP L",
            cycle: 4,
            proc: () => { reg.compareAcc(getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "L"]
                };
            }
        };
        this.opecodeTable[oct("0277")] = {
            mnemonic: "CP A",
            cycle: 4,
            proc: () => { reg.compareAcc(getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "A"]
                };
            }
        };
        this.opecodeTable[oct("0376")] = {
            mnemonic: "CP n",
            cycle: 7,
            proc: () => { reg.compareAcc(fetch()); },
            disasm: function (mem, addr) {
                var n = mem.peek(addr + 1);
                return {
                    code: [mem.peek(addr), n],
                    mnemonic: ["CP", NumberUtil.HEX(n, 2) + "H"]
                };
            }
        };
        this.opecodeTable[oct("0276")] = {
            mnemonic: "CP (HL)",
            cycle: 7,
            proc: () => {
                reg.compareAcc(peek(getHL()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CP", "(HL)"]
                };
            }
        };
        opeIX[oct("0276")] = {
            mnemonic: "CP (IX+d)",
            cycle: 19,
            proc: () => {
                reg.compareAcc(peek(reg.IX + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["CP", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct("0276")] = {
            mnemonic: "CP (IY+d)",
            cycle: 19,
            proc: () => {
                reg.compareAcc(peek(reg.IY + fetchSigned()));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["CP", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // INC r        r <- r + 1          00 <r>[100]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0004")] = {
            mnemonic: "INC B",
            "cycle": 4,
            proc: () => { reg.increment("B"); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)], mnemonic: ["INC", "B"]
                };
            }
        };
        this.opecodeTable[oct("0014")] = {
            mnemonic: "INC C",
            "cycle": 4,
            proc: () => { reg.increment("C"); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "C"]
                };
            }
        };
        this.opecodeTable[oct("0024")] = {
            mnemonic: "INC D",
            "cycle": 4,
            proc: () => { reg.increment("D"); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "D"]
                };
            }
        };
        this.opecodeTable[oct("0034")] = {
            mnemonic: "INC E",
            "cycle": 4,
            proc: () => { reg.increment("E"); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "E"]
                };
            }
        };
        this.opecodeTable[oct("0044")] = {
            mnemonic: "INC H",
            "cycle": 4,
            proc: () => { reg.increment("H"); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "H"]
                };
            }
        };
        this.opecodeTable[oct("0054")] = {
            mnemonic: "INC L",
            "cycle": 4,
            proc: () => { reg.increment("L"); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "L"]
                };
            }
        };
        this.opecodeTable[oct("0074")] = {
            mnemonic: "INC A",
            "cycle": 4,
            proc: () => { reg.increment("A"); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "A"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // INC (HL)     (HL) <- (HL) + 1    00 110[100]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0064")] = {
            mnemonic: "INC (HL)",
            "cycle": 11,
            proc: () => { this.incrementAt(getHL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
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
            mnemonic: "INC (IX+d)",
            "cycle": 23,
            proc: () => { this.incrementAt(reg.IX + fetchSigned()); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["INC", `(IX${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // INC (IY+d)   (IY+d) <- (IY+d)+1  11 111 101
        //                                  00 110[100]
        //                                  <---d---->
        //---------------------------------------------------------------------------------
        opeIY[oct("0064")] = {
            mnemonic: "INC (IY+d)",
            "cycle": 23,
            proc: () => { this.incrementAt(reg.IY + fetchSigned()); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["INC", `(IY${displacement})`]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // DEC m        m <- m + 1                [100]
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0005")] = {
            mnemonic: "DEC B", proc: () => { reg.decrement("B"); }, "cycle": 4,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["DEC", "B"] }; }
        };
        this.opecodeTable[oct("0015")] = {
            mnemonic: "DEC C", proc: () => { reg.decrement("C"); }, "cycle": 4,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["DEC", "C"] }; }
        };
        this.opecodeTable[oct("0025")] = {
            mnemonic: "DEC D", proc: () => { reg.decrement("D"); }, "cycle": 4,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["DEC", "D"] }; }
        };
        this.opecodeTable[oct("0035")] = {
            mnemonic: "DEC E", proc: () => { reg.decrement("E"); }, "cycle": 4,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["DEC", "E"] }; }
        };
        this.opecodeTable[oct("0045")] = {
            mnemonic: "DEC H", proc: () => { reg.decrement("H"); }, "cycle": 4,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["DEC", "H"] }; }
        };
        this.opecodeTable[oct("0055")] = {
            mnemonic: "DEC L", proc: () => { reg.decrement("L"); }, "cycle": 4,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["DEC", "L"] }; }
        };
        this.opecodeTable[oct("0075")] = {
            mnemonic: "DEC A", proc: () => { reg.decrement("A"); }, "cycle": 4,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["DEC", "A"] }; }
        };
        this.opecodeTable[oct("0065")] = {
            mnemonic: "DEC (HL)", proc: () => { this.decrementAt(getHL()); }, "cycle": 11,
            disasm: function (mem, addr) { return { code: [mem.peek(addr)], mnemonic: ["DEC", "(HL)"] }; }
        };
        opeIX[oct("0065")] = {
            mnemonic: "DEC (IX+d)",
            "cycle": 23,
            proc: () => { this.decrementAt(reg.IX + fetchSigned()); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["DEC", `(IX${displacement})`]
                };
            }
        };
        opeIY[oct("0065")] = {
            mnemonic: "DEC (IY+d)",
            "cycle": 23,
            proc: () => { this.decrementAt(reg.IY + fetchSigned()); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d],
                    mnemonic: ["DEC", `(IY${displacement})`]
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
            mnemonic: "DAA",
            cycle: 4,
            proc: () => { reg.DAA(); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DAA"]
                };
            }
        };
        this.opecodeTable[oct("0057")] = {
            mnemonic: "CPL",
            cycle: 4,
            proc: () => { reg.CPL(); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CPL"]
                };
            }
        };
        this.opecodeTable[oct("0077")] = {
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
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["CCF"]
                };
            }
        };
        this.opecodeTable[oct("0067")] = {
            mnemonic: "SCF",
            cycle: 4,
            proc: () => { reg.setFlagC(); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["SCF"]
                };
            }
        };
        this.opecodeTable[oct("0000")] = {
            mnemonic: "NOP",
            cycle: 4,
            proc: () => { },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["NOP"]
                };
            }
        };
        this.opecodeTable[oct("0166")] = {
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
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["HALT"]
                };
            }
        };
        this.opecodeTable[oct("0363")] = {
            mnemonic: "DI",
            cycle: 4,
            proc: () => { this.IFF1 = this.IFF2 = 0; },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DI"]
                };
            }
        };
        this.opecodeTable[oct("0373")] = {
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
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["EI"]
                };
            }
        };
        opeMisc[oct("0104")] = {
            mnemonic: "NEG",
            cycle: 8,
            proc: () => { reg.NEG(); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["NEG"]
                };
            }
        };
        opeMisc[oct("0106")] = {
            mnemonic: "IM0",
            cycle: 8,
            proc: () => { this.IM = 0; },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IM0"]
                };
            }
        };
        opeMisc[oct("0126")] = {
            mnemonic: "IM1",
            cycle: 8,
            proc: () => { this.IM = 1; },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IM1"]
                };
            }
        };
        opeMisc[oct("0136")] = {
            mnemonic: "IM2",
            cycle: 8,
            proc: () => { this.IM = 2; },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
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
            mnemonic: "ADD HL,BC",
            cycle: 11,
            proc: () => { reg.ADD_HL(getBC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "HL", "BC"]
                };
            }
        };
        this.opecodeTable[oct("0031")] = {
            mnemonic: "ADD HL,DE",
            cycle: 11,
            proc: () => { reg.ADD_HL(getDE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "HL", "DE"]
                };
            }
        };
        this.opecodeTable[oct("0051")] = {
            mnemonic: "ADD HL,HL",
            cycle: 11,
            proc: () => { reg.ADD_HL(getHL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "HL", "HL"]
                };
            }
        };
        this.opecodeTable[oct("0071")] = {
            mnemonic: "ADD HL,SP",
            cycle: 11,
            proc: () => { reg.ADD_HL(reg.SP); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["ADD", "HL", "SP"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // ADC HL,ss    HL <- HL + ss + CY  11 101 101
        //                                  01 ss1 010
        //---------------------------------------------------------------------------------
        opeMisc[oct("0112")] = {
            mnemonic: "ADC HL,BC",
            cycle: 15,
            proc: () => { reg.ADC_HL(getBC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADC", "HL", "BC"]
                };
            }
        };
        opeMisc[oct("0132")] = {
            mnemonic: "ADC HL,DE",
            cycle: 15,
            proc: () => { reg.ADC_HL(getDE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADC", "HL", "DE"]
                };
            }
        };
        opeMisc[oct("0152")] = {
            mnemonic: "ADC HL,HL",
            cycle: 15,
            proc: () => { reg.ADC_HL(getHL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADC", "HL", "HL"]
                };
            }
        };
        opeMisc[oct("0172")] = {
            mnemonic: "ADC HL,SP",
            cycle: 15,
            proc: () => { reg.ADC_HL(reg.SP); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADC", "HL", "SP"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // SBC HL,ss    HL <- HL - ss - CY  11 101 101
        //                                  01 ss0 010
        //---------------------------------------------------------------------------------
        opeMisc[oct("0102")] = {
            mnemonic: "SBC HL,BC",
            cycle: 15,
            proc: () => { reg.SBC_HL(getBC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["SBC", "HL", "BC"]
                };
            }
        };
        opeMisc[oct("0122")] = {
            mnemonic: "SBC HL,DE",
            cycle: 15,
            proc: () => { reg.SBC_HL(getDE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["SBC", "HL", "DE"]
                };
            }
        };
        opeMisc[oct("0142")] = {
            mnemonic: "SBC HL,HL",
            cycle: 15,
            proc: () => { reg.SBC_HL(getHL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["SBC", "HL", "HL"]
                };
            }
        };
        opeMisc[oct("0162")] = {
            mnemonic: "SBC HL,SP",
            cycle: 15,
            proc: () => { reg.SBC_HL(reg.SP); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["SBC", "HL", "SP"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // ADD IX,pp    IX <- IX + pp       11 011 101
        //                                  00 pp1 001
        //---------------------------------------------------------------------------------
        opeIX[oct("0011")] = {
            mnemonic: "ADD IX,BC",
            cycle: 15,
            proc: () => { reg.ADD_IX(getBC()); },
            disasm: function ( /*mem, addr*/) {
                return {
                    code: [0xDD, 0x09],
                    mnemonic: ["ADD", "IX", "BC"]
                };
            }
        };
        opeIX[oct("0031")] = {
            mnemonic: "ADD IX,DE",
            cycle: 15,
            proc: () => { reg.ADD_IX(getDE()); },
            disasm: function ( /*mem, addr*/) {
                return {
                    code: [0xDD, 0x19],
                    mnemonic: ["ADD", "IX", "DE"]
                };
            }
        };
        opeIX[oct("0051")] = {
            mnemonic: "ADD IX,IX",
            cycle: 15,
            proc: () => { reg.ADD_IX(reg.IX); },
            disasm: function ( /*mem, addr*/) {
                return {
                    code: [0xDD, 0x29],
                    mnemonic: ["ADD", "IX", "IX"]
                };
            }
        };
        opeIX[oct("0071")] = {
            mnemonic: "ADD IX,SP",
            cycle: 15,
            proc: () => { reg.ADD_IX(reg.SP); },
            disasm: function ( /*mem, addr*/) {
                return {
                    code: [0xDD, 0x39],
                    mnemonic: ["ADD", "IX", "SP"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // ADD IY,pp    IY <- IY + rr       11 111 101
        //                                  00 rr1 001
        //---------------------------------------------------------------------------------
        opeIY[oct("0011")] = {
            mnemonic: "ADD IY,BC",
            cycle: 15,
            proc: () => { reg.ADD_IY(getBC()); },
            disasm: function ( /*mem, addr*/) {
                return {
                    code: [0xFD, 0x09],
                    mnemonic: ["ADD", "IY", "BC"]
                };
            }
        };
        opeIY[oct("0031")] = {
            mnemonic: "ADD IY,DE",
            cycle: 15,
            proc: () => { reg.ADD_IY(getDE()); },
            disasm: function ( /*mem, addr*/) {
                return {
                    code: [0xFD, 0x19],
                    mnemonic: ["ADD", "IY", "DE"]
                };
            }
        };
        opeIY[oct("0051")] = {
            mnemonic: "ADD IY,IY",
            cycle: 15,
            proc: () => { reg.ADD_IY(reg.IY); },
            disasm: function ( /*mem, addr*/) {
                return {
                    code: [0xFD, 0x29],
                    mnemonic: ["ADD", "IY", "IY"]
                };
            }
        };
        opeIY[oct("0071")] = {
            mnemonic: "ADD IY,SP",
            cycle: 15,
            proc: () => { reg.ADD_IY(reg.SP); },
            disasm: function ( /*mem, addr*/) {
                return {
                    code: [0xFD, 0x39],
                    mnemonic: ["ADD", "IY", "SP"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // INC ss       ss <- ss + 1        00 ss0 011
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0003")] = {
            mnemonic: "INC BC",
            cycle: 6,
            proc: () => {
                reg.incBC();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "BC"]
                };
            }
        };
        this.opecodeTable[oct("0023")] = {
            mnemonic: "INC DE",
            cycle: 6,
            proc: () => {
                reg.incDE();
            },
            disasm: function (mem, addr) {
                return {
                code: [mem.peek(addr)],
                    mnemonic: ["INC", "DE"]
                };
            }
        };
        this.opecodeTable[oct("0043")] = {
            mnemonic: "INC HL",
            cycle: 6,
            proc: () => {
                reg.incHL();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "HL"]
                };
            }
        };
        this.opecodeTable[oct("0063")] = {
            mnemonic: "INC SP",
            cycle: 6,
            proc: () => { reg.SP = (reg.SP + 1) & 0xffff; },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["INC", "SP"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // INC IX       IX <- IX + 1        11 011 101
        //                                  00 100 011
        //---------------------------------------------------------------------------------
        opeIX[oct("0043")] = {
            mnemonic: "INC IX",
            cycle: 10,
            proc: () => {
                reg.IX = (reg.IX + 1) & 0xffff;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INC", "IX"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // INC IY       IY <- IY + 1        11 111 101
        //                                  00 100 011
        //---------------------------------------------------------------------------------
        opeIY[oct("0043")] = {
            mnemonic: "INC IY",
            cycle: 10,
            proc: () => {
                reg.IY = (reg.IY + 1) & 0xffff;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INC", "IY"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // DEC ss       ss <- ss + 1        00 ss1 011
        //---------------------------------------------------------------------------------
        this.opecodeTable[oct("0013")] = {
            mnemonic: "DEC BC",
            cycle: 6,
            proc: () => {
                reg.decBC();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DEC", "BC"]
                };
            }
        };
        this.opecodeTable[oct("0033")] = {
            mnemonic: "DEC DE",
            cycle: 6,
            proc: () => {
                reg.decDE();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DEC", "DE"]
                };
            }
        };
        this.opecodeTable[oct("0053")] = {
            mnemonic: "DEC HL",
            cycle: 6,
            proc: () => {
                reg.decHL();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DEC", "HL"]
                };
            }
        };
        this.opecodeTable[oct("0073")] = {
            mnemonic: "DEC SP",
            cycle: 6,
            proc: () => {
                reg.SP = (reg.SP - 1) & 0xffff;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr)],
                    mnemonic: ["DEC", "SP"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // DEC IX       IX <- IX + 1        11 011 101
        //                                  00 101 011
        //---------------------------------------------------------------------------------
        opeIX[oct("0053")] = {
            mnemonic: "DEC IX",
            cycle: 10,
            proc: () => {
                reg.IX = (reg.IX - 1) & 0xffff;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["DEC", "IX"]
                };
            }
        };
        //---------------------------------------------------------------------------------
        // DEC IY       IY <- IY + 1        11 111 101
        //                                  00 101 011
        //---------------------------------------------------------------------------------
        opeIY[oct("0053")] = {
            mnemonic: "DEC IY",
            cycle: 10,
            proc: () => {
                reg.IY = (reg.IY - 1) & 0xffff;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["DEC", "IY"]
                };
            }
        };
        //=================================================================================
        // ローテイト・シフトグループ
        //=================================================================================
        this.opecodeTable[oct("0007")] = {
            mnemonic: "RLCA",
            cycle: 4,
            proc: () => { reg.RLCA(); },
            disasm: function ( /*mem,addr*/) {
                return {
                    code: [oct("0007")],
                    mnemonic: ["RLCA"]
                };
            }
        };
        this.opecodeTable[oct("0027")] = {
            mnemonic: "RLA",
            cycle: 4,
            proc: () => { reg.RLA(); },
            disasm: function ( /*mem,addr*/) {
                return {
                    code: [oct("0027")],
                    mnemonic: ["RLA"]
                };
            }
        };
        this.opecodeTable[oct("0017")] = {
            mnemonic: "RRCA",
            cycle: 4,
            proc: () => { reg.RRCA(); },
            disasm: function ( /*mem,addr*/) {
                return {
                    code: [oct("0017")],
                    mnemonic: ["RRCA"]
                };
            }
        };
        this.opecodeTable[oct("0037")] = {
            mnemonic: "RRA",
            cycle: 4,
            proc: () => { reg.RRA(); },
            disasm: function ( /*mem,addr*/) {
                return {
                    code: [oct("0037")],
                    mnemonic: ["RRA"]
                };
            }
        };
        opeIX[oct("0313")] = {
            mnemonic: function () { return opeRotateIX; },
            proc: () => {
                const d = fetchSigned();
                const feature = fetch();
                opeRotateIX[feature].proc(d);
            },
            disasm: function (mem, addr) {
                var feature = mem.peek(addr + 3);
                return opeRotateIX[feature].disasm(mem, addr);
            }
        };
        opeIY[oct("0313")] = {
            mnemonic: function () { return opeRotateIY; },
            proc: () => {
                const d = fetchSigned();
                const feature = fetch();
                opeRotateIY[feature].proc(d);
            },
            disasm: function (mem, addr) {
                var feature = mem.peek(addr + 3);
                return opeRotateIY[feature].disasm(mem, addr);
            }
        };
        opeRotate[oct("0000")] = {
            mnemonic: "RLC B",
            cycle: 4,
            proc: () => {
                setB(reg.RLC(getB()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "B"]
                };
            }
        };
        opeRotate[oct("0001")] = {
            mnemonic: "RLC C",
            cycle: 4,
            proc: () => {
                setC(reg.RLC(getC()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "C"]
                };
            }
        };
        opeRotate[oct("0002")] = {
            mnemonic: "RLC D",
            cycle: 4,
            proc: () => {
                setD(reg.RLC(getD()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "D"]
                };
            }
        };
        opeRotate[oct("0003")] = {
            mnemonic: "RLC E",
            cycle: 4,
            proc: () => {
                setE(reg.RLC(getE()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "E"]
                };
            }
        };
        opeRotate[oct("0004")] = {
            mnemonic: "RLC H",
            cycle: 4,
            proc: () => {
                setH(reg.RLC(getH()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "H"]
                };
            }
        };
        opeRotate[oct("0005")] = {
            mnemonic: "RLC L",
            cycle: 4,
            proc: () => {
                setL(reg.RLC(getL()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "L"]
                };
            }
        };
        opeRotate[oct("0007")] = {
            mnemonic: "RLC A",
            cycle: 4,
            proc: () => {
                setA(reg.RLC(getA()));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "A"]
                };
            }
        };
        opeRotate[oct("0006")] = {
            mnemonic: "RLC (HL)",
            cycle: 15,
            proc: () => {
                var adr = getHL();
                poke(adr, reg.RLC(peek(adr)));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLC", "(HL)"]
                };
            }
        };
        opeRotateIX[oct("0006")] = {
            mnemonic: "RLC (IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, reg.RLC(peek(adr)));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RLC", `(IX${displacement})`]
                };
            }
        };
        opeRotateIY[oct("0006")] = {
            mnemonic: "RLC (IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, reg.RLC(peek(adr)));
            },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RLC", `(IY${displacement})`]
                };
            }
        };
        opeRotate[oct("0020")] = {
            mnemonic: "RL B",
            cycle: 8,
            proc: () => { setB(reg.RL(getB())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "B"] }; }
        };
        opeRotate[oct("0021")] = {
            mnemonic: "RL C",
            cycle: 8,
            proc: () => { setC(reg.RL(getC())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "C"] }; }
        };
        opeRotate[oct("0022")] = {
            mnemonic: "RL D",
            cycle: 8,
            proc: () => { setD(reg.RL(getD())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "D"] }; }
        };
        opeRotate[oct("0023")] = {
            mnemonic: "RL E",
            cycle: 8,
            proc: () => { setE(reg.RL(getE())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "E"] }; }
        };
        opeRotate[oct("0024")] = {
            mnemonic: "RL H",
            cycle: 8,
            proc: () => { setH(reg.RL(getH())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "H"] }; }
        };
        opeRotate[oct("0025")] = {
            mnemonic: "RL L",
            cycle: 8,
            proc: () => { setL(reg.RL(getL())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "L"] }; }
        };
        opeRotate[oct("0026")] = {
            mnemonic: "RL (HL)",
            cycle: 15,
            proc: () => { var adr = getHL(); poke(adr, reg.RL(peek(adr))); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "(HL)"] }; }
        };
        opeRotate[oct("0027")] = {
            mnemonic: "RL A",
            cycle: 8,
            proc: () => { setA(reg.RL(getA())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RL", "A"] }; }
        };
        opeRotateIX[oct("0026")] = {
            mnemonic: "RL (IX+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IX + d; poke(adr, reg.RL(peek(adr))); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RL", `(IX${displacement})`]
                };
            }
        };
        opeRotateIY[oct("0026")] = {
            mnemonic: "RL (IY+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IY + d; poke(adr, reg.RL(peek(adr))); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RL", `(IY${displacement})`]
                };
            }
        };
        opeRotate[oct("0010")] = {
            mnemonic: "RRC B",
            cycle: 4,
            proc: () => { setB(reg.RRC(getB())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "B"] }; }
        };
        opeRotate[oct("0011")] = {
            mnemonic: "RRC C",
            cycle: 4,
            proc: () => { setC(reg.RRC(getC())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "C"] }; }
        };
        opeRotate[oct("0012")] = {
            mnemonic: "RRC D",
            cycle: 4,
            proc: () => { setD(reg.RRC(getD())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "D"] }; }
        };
        opeRotate[oct("0013")] = {
            mnemonic: "RRC E",
            cycle: 4,
            proc: () => { setE(reg.RRC(getE())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "E"] }; }
        };
        opeRotate[oct("0014")] = {
            mnemonic: "RRC H",
            cycle: 4,
            proc: () => { setH(reg.RRC(getH())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "H"] }; }
        };
        opeRotate[oct("0015")] = {
            mnemonic: "RRC L",
            cycle: 4,
            proc: () => { setL(reg.RRC(getL())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "L"] }; }
        };
        opeRotate[oct("0017")] = {
            mnemonic: "RRC A",
            cycle: 4,
            proc: () => { setA(reg.RRC(getA())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "A"] }; }
        };
        opeRotate[oct("0016")] = {
            mnemonic: "RRC (HL)",
            cycle: 15,
            proc: () => { var adr = getHL(); poke(adr, reg.RRC(peek(adr))); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RRC", "(HL)"] }; }
        };
        opeRotateIX[oct("0016")] = {
            mnemonic: "RRC (IX+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IX + d; poke(adr, reg.RRC(peek(adr))); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RRC", `(IX${displacement})`]
                };
            }
        };
        opeRotateIY[oct("0016")] = {
            mnemonic: "RRC (IY+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IY + d; poke(adr, reg.RRC(peek(adr))); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["RRC", `(IY${displacement})`]
                };
            }
        };
        opeRotate[oct("0030")] = {
            mnemonic: "RR B",
            cycle: 8,
            proc: () => { setB(reg.RR(getB())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "B"] }; }
        };
        opeRotate[oct("0031")] = {
            mnemonic: "RR C",
            cycle: 8,
            proc: () => { setC(reg.RR(getC())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "C"] }; }
        };
        opeRotate[oct("0032")] = {
            mnemonic: "RR D",
            cycle: 8,
            proc: () => { setD(reg.RR(getD())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "D"] }; }
        };
        opeRotate[oct("0033")] = {
            mnemonic: "RR E",
            cycle: 8,
            proc: () => { setE(reg.RR(getE())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "E"] }; }
        };
        opeRotate[oct("0034")] = {
            mnemonic: "RR H",
            cycle: 8,
            proc: () => { setH(reg.RR(getH())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "H"] }; }
        };
        opeRotate[oct("0035")] = {
            mnemonic: "RR L",
            cycle: 8,
            proc: () => { setL(reg.RR(getL())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "L"] }; }
        };
        opeRotate[oct("0036")] = {
            mnemonic: "RR (HL)",
            cycle: 15,
            proc: () => { var adr = getHL(); poke(adr, reg.RR(peek(adr))); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "(HL)"] }; }
        };
        opeRotate[oct("0037")] = {
            mnemonic: "RR A",
            cycle: 8,
            proc: () => { setA(reg.RR(getA())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["RR", "A"] }; }
        };
        opeRotateIX[oct("0036")] = {
            mnemonic: "RR (IX+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IX + d; poke(adr, reg.RR(peek(adr))); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["RR", "(IX+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotateIY[oct("0036")] = {
            mnemonic: "RR (IY+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IY + d; poke(adr, reg.RR(peek(adr))); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["RR", "(IY+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotate[oct("0040")] = {
            mnemonic: "SLA B",
            cycle: 8,
            proc: () => { setB(reg.SLA(getB())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "B"] }; }
        };
        opeRotate[oct("0041")] = {
            mnemonic: "SLA C",
            cycle: 8,
            proc: () => { setC(reg.SLA(getC())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "C"] }; }
        };
        opeRotate[oct("0042")] = {
            mnemonic: "SLA D",
            cycle: 8,
            proc: () => { setD(reg.SLA(getD())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "D"] }; }
        };
        opeRotate[oct("0043")] = {
            mnemonic: "SLA E",
            cycle: 8,
            proc: () => { setE(reg.SLA(getE())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "E"] }; }
        };
        opeRotate[oct("0044")] = {
            mnemonic: "SLA H",
            cycle: 8,
            proc: () => { setH(reg.SLA(getH())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "H"] }; }
        };
        opeRotate[oct("0045")] = {
            mnemonic: "SLA L",
            cycle: 8,
            proc: () => { setL(reg.SLA(getL())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "L"] }; }
        };
        opeRotate[oct("0047")] = {
            mnemonic: "SLA A",
            cycle: 8,
            proc: () => { setA(reg.SLA(getA())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "A"] }; }
        };
        opeRotate[oct("0046")] = {
            mnemonic: "SLA (HL)",
            cycle: 15,
            proc: () => { var adr = getHL(); poke(adr, reg.SLA(peek(adr))); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SLA", "(HL)"] }; }
        };
        opeRotateIX[oct("0046")] = {
            mnemonic: "SLA (IX+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IX + d; poke(adr, reg.SLA(peek(adr))); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["SLA", "(IX+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotateIY[oct("0046")] = {
            mnemonic: "SLA (IY+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IY + d; poke(adr, reg.SLA(peek(adr))); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["SLA", "(IY+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotate[oct("0050")] = {
            mnemonic: "SRA B",
            cycle: 8,
            proc: () => { setB(reg.SRA(getB())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "B"] }; }
        };
        opeRotate[oct("0051")] = {
            mnemonic: "SRA C",
            cycle: 8,
            proc: () => { setC(reg.SRA(getC())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "C"] }; }
        };
        opeRotate[oct("0052")] = {
            mnemonic: "SRA D",
            cycle: 8,
            proc: () => { setD(reg.SRA(getD())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "D"] }; }
        };
        opeRotate[oct("0053")] = {
            mnemonic: "SRA E",
            cycle: 8,
            proc: () => { setE(reg.SRA(getE())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "E"] }; }
        };
        opeRotate[oct("0054")] = {
            mnemonic: "SRA H",
            cycle: 8,
            proc: () => { setH(reg.SRA(getH())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "H"] }; }
        };
        opeRotate[oct("0055")] = {
            mnemonic: "SRA L",
            cycle: 8,
            proc: () => { setL(reg.SRA(getL())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "L"] }; }
        };
        opeRotate[oct("0057")] = {
            mnemonic: "SRA A",
            cycle: 8,
            proc: () => { setA(reg.SRA(getA())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "A"] }; }
        };
        opeRotate[oct("0056")] = {
            mnemonic: "SRA (HL)",
            cycle: 15,
            proc: () => { var adr = getHL(); poke(adr, reg.SRA(peek(adr))); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRA", "(HL)"] }; }
        };
        opeRotateIX[oct("0056")] = {
            mnemonic: "SRA (IX+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IX + d; poke(adr, reg.SRA(peek(adr))); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["SRA", "(IX+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotateIY[oct("0056")] = {
            mnemonic: "SRA (IY+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IY + d; poke(adr, reg.SRA(peek(adr))); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), mem.peek(addr + 2), mem.peek(addr + 3)],
                    mnemonic: ["SRA", "(IY+" + mem.peek(addr + 2) + ")"]
                };
            }
        };
        opeRotate[oct("0070")] = {
            mnemonic: "SRL B",
            cycle: 8,
            proc: () => { setB(reg.SRL(getB())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "B"] }; }
        };
        opeRotate[oct("0071")] = {
            mnemonic: "SRL C",
            cycle: 8,
            proc: () => { setC(reg.SRL(getC())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "C"] }; }
        };
        opeRotate[oct("0072")] = {
            mnemonic: "SRL D",
            cycle: 8,
            proc: () => { setD(reg.SRL(getD())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "D"] }; }
        };
        opeRotate[oct("0073")] = {
            mnemonic: "SRL E",
            cycle: 8,
            proc: () => { setE(reg.SRL(getE())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "E"] }; }
        };
        opeRotate[oct("0074")] = {
            mnemonic: "SRL H",
            cycle: 8,
            proc: () => { setH(reg.SRL(getH())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "H"] }; }
        };
        opeRotate[oct("0075")] = {
            mnemonic: "SRL L",
            cycle: 8,
            proc: () => { setL(reg.SRL(getL())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "L"] }; }
        };
        opeRotate[oct("0077")] = {
            mnemonic: "SRL A",
            cycle: 8,
            proc: () => { setA(reg.SRL(getA())); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "A"] }; }
        };
        opeRotate[oct("0076")] = {
            mnemonic: "SRL (HL)",
            cycle: 15,
            proc: () => { var adr = getHL(); poke(adr, reg.SRL(peek(adr))); },
            disasm: function (mem, addr) { return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ["SRL", "(HL)"] }; }
        };
        opeRotateIX[oct("0076")] = {
            mnemonic: "SRL (IX+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IX + d; poke(adr, reg.SRL(peek(adr))); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["SRL", `(IX${displacement})`]
                };
            }
        };
        opeRotateIY[oct("0076")] = {
            mnemonic: "SRL (IY+d)",
            cycle: 23,
            proc: (d) => { var adr = reg.IY + d; poke(adr, reg.SRL(peek(adr))); },
            disasm: function (mem, addr) {
                const d = mem.peek(addr + 2);
                const d8s = NumberUtil.to8bitSigned(d);
                const displacement = `${d8s>=0?"+":""}${d8s}`;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1), d, mem.peek(addr + 3)],
                    mnemonic: ["SRL", `(IY${displacement})`]
                };
            }
        };
        opeMisc[oct("0157")] = {
            mnemonic: "RLD",
            cycle: 18,
            proc: () => {
                var adr = getHL();
                var n = peek(adr);
                var AH = getA() & 0xf0;
                var AL = getA() & 0x0f;
                var nH = (n >> 4) & 0x0f;
                var nL = (n >> 0) & 0x0f;
                setA(AH | nH);
                n = (nL << 4) | AL;
                poke(adr, n);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RLD"]
                };
            }
        };
        opeMisc[oct("0147")] = {
            mnemonic: "RRD",
            cycle: 18,
            proc: () => {
                var adr = getHL();
                var n = peek(adr);
                var AH = getA() & 0xf0;
                var AL = getA() & 0x0F;
                var nH = (n >> 4) & 0x0f;
                var nL = (n >> 0) & 0x0f;
                setA(AH | nL);
                n = (AL << 4) | nH;
                poke(adr, n);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["RRD"]
                };
            }
        };
        //=================================================================================
        // ビットセット・リセット及びテストグループ
        //=================================================================================
        var reg8 = ["B", "C", "D", "E", "H", "L", "(HL)", "A"];
        var regI, bit;
        for (regI = 0; regI < reg8.length; regI++) {
            for (bit = 0; bit < 8; bit++) {
                opeRotate[oct("0100") | (bit << 3) | regI] = {
                    mnemonic: "BIT " + bit + "," + reg8[regI],
                    cycle: (function (r) { return r != 6 ? 8 : 12; } (regI)),
                    proc: ((b, r) => {
                        if (r != 6) {
                            return () => {
                                var value = reg["get" + reg8[r]]();
                                if ((value & (1 << b)) != 0) {
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
                                var adr = getHL();
                                var value = peek(adr);
                                if ((value & (1 << b)) != 0) {
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
                    disasm: (function (b, n) {
                        return function (mem, addr) {
                            return {
                                code: [mem.peek(addr), mem.peek(addr + 1)],
                                mnemonic: ["BIT", b, n]
                            };
                        };
                    })(bit, reg8[regI])
                };
            }
        }
        var disasm_bit_b_IDX_d = (mem, addr, b, idx) => {
            const d = mem.peek(addr + 2);
            const d8s = NumberUtil.to8bitSigned(d);
            const displacement = `${d8s>=0?"+":""}${d8s}`;
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
        opeRotateIX[oct("0106")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 0, "IX"); }
        };
        opeRotateIX[oct("0116")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 1, "IX"); }
        };
        opeRotateIX[oct("0126")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 2, "IX"); }
        };
        opeRotateIX[oct("0136")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 3, "IX"); }
        };
        opeRotateIX[oct("0146")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 4, "IX"); }
        };
        opeRotateIX[oct("0156")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 5, "IX"); }
        };
        opeRotateIX[oct("0166")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 6, "IX"); }
        };
        opeRotateIX[oct("0176")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 7, "IX"); }
        };
        opeRotateIY[oct("0106")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 0, "IY"); }
        };
        opeRotateIY[oct("0116")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 1, "IY"); }
        };
        opeRotateIY[oct("0126")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 2, "IY"); }
        };
        opeRotateIY[oct("0136")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 3, "IY"); }
        };
        opeRotateIY[oct("0146")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 4, "IY"); }
        };
        opeRotateIY[oct("0156")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 5, "IY"); }
        };
        opeRotateIY[oct("0166")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 6, "IY"); }
        };
        opeRotateIY[oct("0176")] = {
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
            disasm: function (mem, addr) { return disasm_bit_b_IDX_d(mem, addr, 7, "IY"); }
        };
        for (regI = 0; regI < reg8.length; regI++) {
            for (bit = 0; bit < 8; bit++) {
                opeRotate[oct("0300") | (bit << 3) | regI] = {
                    mnemonic: "SET " + bit + "," + reg8[regI],
                    cycle: (function (r) { return r != 6 ? 4 : 15; } (regI)),
                    proc: ((b, r) => {
                        if (r != 6) {
                            return () => {
                                reg["set" + reg8[r]](reg["get" + reg8[r]]() | (1 << b));
                            };
                        }
                        else {
                            return () => {
                                var adr = getHL();
                                poke(adr, peek(adr) | (1 << b));
                            };
                        }
                    })(bit, regI),
                    disasm: (function (b, n) {
                        return function (mem, addr) {
                            return {
                                code: [mem.peek(addr), mem.peek(addr + 1)],
                                mnemonic: ["SET", b, n]
                            };
                        };
                    })(bit, reg8[regI])
                };
            }
        }
        var disasm_set_b_IDX_d = (mem, addr, b, idx) => {
            const d = mem.peek(addr + 2);
            const d8s = NumberUtil.to8bitSigned(d);
            const displacement = `${d8s>=0?"+":""}${d8s}`;
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
        opeRotateIX[oct("0306")] = {
            mnemonic: "SET 0,(IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 0));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 0, "IX"); }
        };
        opeRotateIX[oct("0316")] = {
            mnemonic: "SET 1,(IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 1));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 1, "IX"); }
        };
        opeRotateIX[oct("0326")] = {
            mnemonic: "SET 2,(IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 2));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 2, "IX"); }
        };
        opeRotateIX[oct("0336")] = {
            mnemonic: "SET 3,(IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 3));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 3, "IX"); }
        };
        opeRotateIX[oct("0346")] = {
            mnemonic: "SET 4,(IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 4));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 4, "IX"); }
        };
        opeRotateIX[oct("0356")] = {
            mnemonic: "SET 5,(IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 5));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 5, "IX"); }
        };
        opeRotateIX[oct("0366")] = {
            mnemonic: "SET 6,(IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 6));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 6, "IX"); }
        };
        opeRotateIX[oct("0376")] = {
            mnemonic: "SET 7,(IX+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IX + d;
                poke(adr, peek(adr) | (1 << 7));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 7, "IX"); }
        };
        opeRotateIY[oct("0306")] = {
            mnemonic: "SET 0,(IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 0));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 0, "IY"); }
        };
        opeRotateIY[oct("0316")] = {
            mnemonic: "SET 1,(IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 1));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 1, "IY"); }
        };
        opeRotateIY[oct("0326")] = {
            mnemonic: "SET 2,(IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 2));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 2, "IY"); }
        };
        opeRotateIY[oct("0336")] = {
            mnemonic: "SET 3,(IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 3));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 3, "IY"); }
        };
        opeRotateIY[oct("0346")] = {
            mnemonic: "SET 4,(IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 4));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 4, "IY"); }
        };
        opeRotateIY[oct("0356")] = {
            mnemonic: "SET 5,(IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 5));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 5, "IY"); }
        };
        opeRotateIY[oct("0366")] = {
            mnemonic: "SET 6,(IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 6));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 6, "IY"); }
        };
        opeRotateIY[oct("0376")] = {
            mnemonic: "SET 7,(IY+d)",
            cycle: 23,
            proc: (d) => {
                var adr = reg.IY + d;
                poke(adr, peek(adr) | (1 << 7));
            },
            disasm: function (mem, addr) { return disasm_set_b_IDX_d(mem, addr, 7, "IY"); }
        };
        var procRES_8bit = (b, r) => {
            var bits = ~(1 << b);
            return () => {
                reg["set" + r](reg["get" + r]() & bits);
            };
        };
        var disaRES_8bit = (b, r) => {
            var regidx = "BCDEHL A".indexOf(r);
            var bits = b << 3;
            return ( /*mem, addr*/) => {
                return {
                    code: [0xCB, oct("0200") | bits | regidx],
                    mnemonic: ["RES", b, r]
                };
            };
        };
        var procRES_xHL = (b) => {
            var bits = (~(1 << b) & 0xff);
            return ((bits) => {
                return () => {
                    var adr = getHL();
                    var v0 = peek(adr);
                    var v1 = v0 & bits;
                    poke(adr, v1);
                };
            })(bits);
        };
        var disaRES_xHL = (b) => {
            var bits = b << 3;
            return ((bits) => {
                return ( /*mem, addr*/) => {
                    return {
                        code: [0xCB, oct("0200") | bits | 6],
                        mnemonic: ["RES", b, "(HL)"]
                    };
                };
            })(bits);
        };
        var procRES_xIDXd = (b, IDX) => {
            var bits = 0xff & ~(1 << b);
            return ((bits) => {
                return (d) => {
                    var adr = reg[IDX] + d;
                    var v0 = peek(adr);
                    var v1 = v0 & bits;
                    poke(adr, v1);
                };
            })(bits);
        };
        var disaRES_xIDXd = (b, IDX) => {
            const bits = b << 3;
            const opecode = { "IX": 0xDD, "IY": 0xFD }[IDX];
            return ((bits, opecode) => {
                return (mem, addr) => {
                    const d = mem.peek(addr + 2);
                    const d8s = NumberUtil.to8bitSigned(d);
                    const displacement = `${d8s>=0?"+":""}${d8s}`;
                    const feature = mem.peek(addr + 3);
                    return {
                        code: [opecode, 0xCB, d, feature],
                        mnemonic: ["RES", b, `(${IDX}${displacement})`],
                    };
                };
            })(bits, opecode);
        };
        opeRotate[oct("0200")] = { mnemonic: "RES 0,B", cycle: 8, proc: procRES_8bit(0, "B"), disasm: disaRES_8bit(0, "B") };
        opeRotate[oct("0210")] = { mnemonic: "RES 1,B", cycle: 8, proc: procRES_8bit(1, "B"), disasm: disaRES_8bit(1, "B") };
        opeRotate[oct("0220")] = { mnemonic: "RES 2,B", cycle: 8, proc: procRES_8bit(2, "B"), disasm: disaRES_8bit(2, "B") };
        opeRotate[oct("0230")] = { mnemonic: "RES 3,B", cycle: 8, proc: procRES_8bit(3, "B"), disasm: disaRES_8bit(3, "B") };
        opeRotate[oct("0240")] = { mnemonic: "RES 4,B", cycle: 8, proc: procRES_8bit(4, "B"), disasm: disaRES_8bit(4, "B") };
        opeRotate[oct("0250")] = { mnemonic: "RES 5,B", cycle: 8, proc: procRES_8bit(5, "B"), disasm: disaRES_8bit(5, "B") };
        opeRotate[oct("0260")] = { mnemonic: "RES 6,B", cycle: 8, proc: procRES_8bit(6, "B"), disasm: disaRES_8bit(6, "B") };
        opeRotate[oct("0270")] = { mnemonic: "RES 7,B", cycle: 8, proc: procRES_8bit(7, "B"), disasm: disaRES_8bit(7, "B") };
        opeRotate[oct("0201")] = { mnemonic: "RES 0,C", cycle: 8, proc: procRES_8bit(0, "C"), disasm: disaRES_8bit(0, "C") };
        opeRotate[oct("0211")] = { mnemonic: "RES 1,C", cycle: 8, proc: procRES_8bit(1, "C"), disasm: disaRES_8bit(1, "C") };
        opeRotate[oct("0221")] = { mnemonic: "RES 2,C", cycle: 8, proc: procRES_8bit(2, "C"), disasm: disaRES_8bit(2, "C") };
        opeRotate[oct("0231")] = { mnemonic: "RES 3,C", cycle: 8, proc: procRES_8bit(3, "C"), disasm: disaRES_8bit(3, "C") };
        opeRotate[oct("0241")] = { mnemonic: "RES 4,C", cycle: 8, proc: procRES_8bit(4, "C"), disasm: disaRES_8bit(4, "C") };
        opeRotate[oct("0251")] = { mnemonic: "RES 5,C", cycle: 8, proc: procRES_8bit(5, "C"), disasm: disaRES_8bit(5, "C") };
        opeRotate[oct("0261")] = { mnemonic: "RES 6,C", cycle: 8, proc: procRES_8bit(6, "C"), disasm: disaRES_8bit(6, "C") };
        opeRotate[oct("0271")] = { mnemonic: "RES 7,C", cycle: 8, proc: procRES_8bit(7, "C"), disasm: disaRES_8bit(7, "C") };
        opeRotate[oct("0202")] = { mnemonic: "RES 0,D", cycle: 8, proc: procRES_8bit(0, "D"), disasm: disaRES_8bit(0, "D") };
        opeRotate[oct("0212")] = { mnemonic: "RES 1,D", cycle: 8, proc: procRES_8bit(1, "D"), disasm: disaRES_8bit(1, "D") };
        opeRotate[oct("0222")] = { mnemonic: "RES 2,D", cycle: 8, proc: procRES_8bit(2, "D"), disasm: disaRES_8bit(2, "D") };
        opeRotate[oct("0232")] = { mnemonic: "RES 3,D", cycle: 8, proc: procRES_8bit(3, "D"), disasm: disaRES_8bit(3, "D") };
        opeRotate[oct("0242")] = { mnemonic: "RES 4,D", cycle: 8, proc: procRES_8bit(4, "D"), disasm: disaRES_8bit(4, "D") };
        opeRotate[oct("0252")] = { mnemonic: "RES 5,D", cycle: 8, proc: procRES_8bit(5, "D"), disasm: disaRES_8bit(5, "D") };
        opeRotate[oct("0262")] = { mnemonic: "RES 6,D", cycle: 8, proc: procRES_8bit(6, "D"), disasm: disaRES_8bit(6, "D") };
        opeRotate[oct("0272")] = { mnemonic: "RES 7,D", cycle: 8, proc: procRES_8bit(7, "D"), disasm: disaRES_8bit(7, "D") };
        opeRotate[oct("0203")] = { mnemonic: "RES 0,E", cycle: 8, proc: procRES_8bit(0, "E"), disasm: disaRES_8bit(0, "E") };
        opeRotate[oct("0213")] = { mnemonic: "RES 1,E", cycle: 8, proc: procRES_8bit(1, "E"), disasm: disaRES_8bit(1, "E") };
        opeRotate[oct("0223")] = { mnemonic: "RES 2,E", cycle: 8, proc: procRES_8bit(2, "E"), disasm: disaRES_8bit(2, "E") };
        opeRotate[oct("0233")] = { mnemonic: "RES 3,E", cycle: 8, proc: procRES_8bit(3, "E"), disasm: disaRES_8bit(3, "E") };
        opeRotate[oct("0243")] = { mnemonic: "RES 4,E", cycle: 8, proc: procRES_8bit(4, "E"), disasm: disaRES_8bit(4, "E") };
        opeRotate[oct("0253")] = { mnemonic: "RES 5,E", cycle: 8, proc: procRES_8bit(5, "E"), disasm: disaRES_8bit(5, "E") };
        opeRotate[oct("0263")] = { mnemonic: "RES 6,E", cycle: 8, proc: procRES_8bit(6, "E"), disasm: disaRES_8bit(6, "E") };
        opeRotate[oct("0273")] = { mnemonic: "RES 7,E", cycle: 8, proc: procRES_8bit(7, "E"), disasm: disaRES_8bit(7, "E") };
        opeRotate[oct("0204")] = { mnemonic: "RES 0,H", cycle: 8, proc: procRES_8bit(0, "H"), disasm: disaRES_8bit(0, "H") };
        opeRotate[oct("0214")] = { mnemonic: "RES 1,H", cycle: 8, proc: procRES_8bit(1, "H"), disasm: disaRES_8bit(1, "H") };
        opeRotate[oct("0224")] = { mnemonic: "RES 2,H", cycle: 8, proc: procRES_8bit(2, "H"), disasm: disaRES_8bit(2, "H") };
        opeRotate[oct("0234")] = { mnemonic: "RES 3,H", cycle: 8, proc: procRES_8bit(3, "H"), disasm: disaRES_8bit(3, "H") };
        opeRotate[oct("0244")] = { mnemonic: "RES 4,H", cycle: 8, proc: procRES_8bit(4, "H"), disasm: disaRES_8bit(4, "H") };
        opeRotate[oct("0254")] = { mnemonic: "RES 5,H", cycle: 8, proc: procRES_8bit(5, "H"), disasm: disaRES_8bit(5, "H") };
        opeRotate[oct("0264")] = { mnemonic: "RES 6,H", cycle: 8, proc: procRES_8bit(6, "H"), disasm: disaRES_8bit(6, "H") };
        opeRotate[oct("0274")] = { mnemonic: "RES 7,H", cycle: 8, proc: procRES_8bit(7, "H"), disasm: disaRES_8bit(7, "H") };
        opeRotate[oct("0205")] = { mnemonic: "RES 0,L", cycle: 8, proc: procRES_8bit(0, "L"), disasm: disaRES_8bit(0, "L") };
        opeRotate[oct("0215")] = { mnemonic: "RES 1,L", cycle: 8, proc: procRES_8bit(1, "L"), disasm: disaRES_8bit(1, "L") };
        opeRotate[oct("0225")] = { mnemonic: "RES 2,L", cycle: 8, proc: procRES_8bit(2, "L"), disasm: disaRES_8bit(2, "L") };
        opeRotate[oct("0235")] = { mnemonic: "RES 3,L", cycle: 8, proc: procRES_8bit(3, "L"), disasm: disaRES_8bit(3, "L") };
        opeRotate[oct("0245")] = { mnemonic: "RES 4,L", cycle: 8, proc: procRES_8bit(4, "L"), disasm: disaRES_8bit(4, "L") };
        opeRotate[oct("0255")] = { mnemonic: "RES 5,L", cycle: 8, proc: procRES_8bit(5, "L"), disasm: disaRES_8bit(5, "L") };
        opeRotate[oct("0265")] = { mnemonic: "RES 6,L", cycle: 8, proc: procRES_8bit(6, "L"), disasm: disaRES_8bit(6, "L") };
        opeRotate[oct("0275")] = { mnemonic: "RES 7,L", cycle: 8, proc: procRES_8bit(7, "L"), disasm: disaRES_8bit(7, "L") };
        opeRotate[oct("0207")] = { mnemonic: "RES 0,A", cycle: 8, proc: procRES_8bit(0, "A"), disasm: disaRES_8bit(0, "A") };
        opeRotate[oct("0217")] = { mnemonic: "RES 1,A", cycle: 8, proc: procRES_8bit(1, "A"), disasm: disaRES_8bit(1, "A") };
        opeRotate[oct("0227")] = { mnemonic: "RES 2,A", cycle: 8, proc: procRES_8bit(2, "A"), disasm: disaRES_8bit(2, "A") };
        opeRotate[oct("0237")] = { mnemonic: "RES 3,A", cycle: 8, proc: procRES_8bit(3, "A"), disasm: disaRES_8bit(3, "A") };
        opeRotate[oct("0247")] = { mnemonic: "RES 4,A", cycle: 8, proc: procRES_8bit(4, "A"), disasm: disaRES_8bit(4, "A") };
        opeRotate[oct("0257")] = { mnemonic: "RES 5,A", cycle: 8, proc: procRES_8bit(5, "A"), disasm: disaRES_8bit(5, "A") };
        opeRotate[oct("0267")] = { mnemonic: "RES 6,A", cycle: 8, proc: procRES_8bit(6, "A"), disasm: disaRES_8bit(6, "A") };
        opeRotate[oct("0277")] = { mnemonic: "RES 7,A", cycle: 8, proc: procRES_8bit(7, "A"), disasm: disaRES_8bit(7, "A") };
        opeRotate[oct("0206")] = { mnemonic: "RES 0,(HL)", cycle: 15, proc: procRES_xHL(0), disasm: disaRES_xHL(0) };
        opeRotate[oct("0216")] = { mnemonic: "RES 1,(HL)", cycle: 15, proc: procRES_xHL(1), disasm: disaRES_xHL(1) };
        opeRotate[oct("0226")] = { mnemonic: "RES 2,(HL)", cycle: 15, proc: procRES_xHL(2), disasm: disaRES_xHL(2) };
        opeRotate[oct("0236")] = { mnemonic: "RES 3,(HL)", cycle: 15, proc: procRES_xHL(3), disasm: disaRES_xHL(3) };
        opeRotate[oct("0246")] = { mnemonic: "RES 4,(HL)", cycle: 15, proc: procRES_xHL(4), disasm: disaRES_xHL(4) };
        opeRotate[oct("0256")] = { mnemonic: "RES 5,(HL)", cycle: 15, proc: procRES_xHL(5), disasm: disaRES_xHL(5) };
        opeRotate[oct("0266")] = { mnemonic: "RES 6,(HL)", cycle: 15, proc: procRES_xHL(6), disasm: disaRES_xHL(6) };
        opeRotate[oct("0276")] = { mnemonic: "RES 7,(HL)", cycle: 15, proc: procRES_xHL(7), disasm: disaRES_xHL(7) };
        // 10 000 110
        opeRotateIX[oct("0206")] = { mnemonic: "RES 0,(IX+d)", cycle: 23, proc: procRES_xIDXd(0, "IX"), disasm: disaRES_xIDXd(0, "IX") };
        opeRotateIX[oct("0216")] = { mnemonic: "RES 1,(IX+d)", cycle: 23, proc: procRES_xIDXd(1, "IX"), disasm: disaRES_xIDXd(1, "IX") };
        opeRotateIX[oct("0226")] = { mnemonic: "RES 2,(IX+d)", cycle: 23, proc: procRES_xIDXd(2, "IX"), disasm: disaRES_xIDXd(2, "IX") };
        opeRotateIX[oct("0236")] = { mnemonic: "RES 3,(IX+d)", cycle: 23, proc: procRES_xIDXd(3, "IX"), disasm: disaRES_xIDXd(3, "IX") };
        opeRotateIX[oct("0246")] = { mnemonic: "RES 4,(IX+d)", cycle: 23, proc: procRES_xIDXd(4, "IX"), disasm: disaRES_xIDXd(4, "IX") };
        opeRotateIX[oct("0256")] = { mnemonic: "RES 5,(IX+d)", cycle: 23, proc: procRES_xIDXd(5, "IX"), disasm: disaRES_xIDXd(5, "IX") };
        opeRotateIX[oct("0266")] = { mnemonic: "RES 6,(IX+d)", cycle: 23, proc: procRES_xIDXd(6, "IX"), disasm: disaRES_xIDXd(6, "IX") };
        opeRotateIX[oct("0276")] = { mnemonic: "RES 7,(IX+d)", cycle: 23, proc: procRES_xIDXd(7, "IX"), disasm: disaRES_xIDXd(7, "IX") };
        opeRotateIY[oct("0206")] = { mnemonic: "RES 0,(IY+d)", cycle: 23, proc: procRES_xIDXd(0, "IY"), disasm: disaRES_xIDXd(0, "IY") };
        opeRotateIY[oct("0216")] = { mnemonic: "RES 1,(IY+d)", cycle: 23, proc: procRES_xIDXd(1, "IY"), disasm: disaRES_xIDXd(1, "IY") };
        opeRotateIY[oct("0226")] = { mnemonic: "RES 2,(IY+d)", cycle: 23, proc: procRES_xIDXd(2, "IY"), disasm: disaRES_xIDXd(2, "IY") };
        opeRotateIY[oct("0236")] = { mnemonic: "RES 3,(IY+d)", cycle: 23, proc: procRES_xIDXd(3, "IY"), disasm: disaRES_xIDXd(3, "IY") };
        opeRotateIY[oct("0246")] = { mnemonic: "RES 4,(IY+d)", cycle: 23, proc: procRES_xIDXd(4, "IY"), disasm: disaRES_xIDXd(4, "IY") };
        opeRotateIY[oct("0256")] = { mnemonic: "RES 5,(IY+d)", cycle: 23, proc: procRES_xIDXd(5, "IY"), disasm: disaRES_xIDXd(5, "IY") };
        opeRotateIY[oct("0266")] = { mnemonic: "RES 6,(IY+d)", cycle: 23, proc: procRES_xIDXd(6, "IY"), disasm: disaRES_xIDXd(6, "IY") };
        opeRotateIY[oct("0276")] = { mnemonic: "RES 7,(IY+d)", cycle: 23, proc: procRES_xIDXd(7, "IY"), disasm: disaRES_xIDXd(7, "IY") };
        //=================================================================================
        // ジャンプグループ
        //=================================================================================
        var disaJumpGroup = (mem, addr) => {
            var opecode = mem.peek(addr);
            var code = [opecode];
            var mnemonic = [];
            var e, n0, n1;
            var ref_addr_to = null;
            switch (opecode & oct("0300")) {
                case oct("0000"):
                    mnemonic.push("JR");
                    e = BinUtil.getSignedByte(mem.peek(addr + 1));
                    ref_addr_to = addr + e + 2;
                    code.push(e & 0xff);
                    if (e + 2 >= 0) {
                        e = "+" + (e + 2);
                    }
                    else {
                        e = "" + (e + 2);
                    }
                    switch (opecode & oct("0070")) {
                        case oct("0030"): break;
                        case oct("0070"):
                            mnemonic.push("C");
                            break;
                        case oct("0050"):
                            mnemonic.push("Z");
                            break;
                        case oct("0060"):
                            mnemonic.push("NC");
                            break;
                        case oct("0040"):
                            mnemonic.push("NZ");
                            break;
                        default:
                            throw "UNKNOWN OPCODE";
                    }
                    mnemonic.push(NumberUtil.HEX(ref_addr_to, 4) + 'H;(' + e + ')');
                    break;
                case oct("0300"):
                    mnemonic.push("JP");
                    switch (opecode & oct("0003")) {
                        case 1:
                            mnemonic.push("(HL)");
                            break;
                        case 2:
                            n0 = mem.peek(addr + 1);
                            n1 = mem.peek(addr + 2);
                            ref_addr_to = BinUtil.pair(n1, n0);
                            code.push(n0);
                            code.push(n1);
                            switch (opecode & oct("0070")) {
                                case oct("0000"):
                                    mnemonic.push("NZ");
                                    break;
                                case oct("0010"):
                                    mnemonic.push("Z");
                                    break;
                                case oct("0020"):
                                    mnemonic.push("NC");
                                    break;
                                case oct("0030"):
                                    mnemonic.push("C");
                                    break;
                                case oct("0040"):
                                    mnemonic.push("PO");
                                    break;
                                case oct("0050"):
                                    mnemonic.push("PE");
                                    break;
                                case oct("0060"):
                                    mnemonic.push("P");
                                    break;
                                case oct("0070"):
                                    mnemonic.push("M");
                                    break;
                            }
                            mnemonic.push(NumberUtil.HEX(n1, 2) + NumberUtil.HEX(n0, 2) + 'H');
                            break;
                        case 3:
                            n0 = mem.peek(addr + 1);
                            n1 = mem.peek(addr + 2);
                            ref_addr_to = BinUtil.pair(n1, n0);
                            code.push(n0);
                            code.push(n1);
                            mnemonic.push(NumberUtil.HEX(n1, 2) + NumberUtil.HEX(n0, 2) + 'H');
                            break;
                    }
                    break;
                default:
                    throw "UNKNOWN OPCODE";
            }
            return { code: code, mnemonic: mnemonic, ref_addr_to: ref_addr_to };
        };
        this.opecodeTable[oct("0303")] = {
            mnemonic: "JP nn",
            "cycle": 10,
            proc: () => { var nn = fetchPair(); reg.PC = nn; },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0302")] = {
            mnemonic: "JP NZ,nn",
            "cycle": 10,
            proc: () => {
            var nn = fetchPair(); if (!reg.flagZ()) {
                reg.PC = nn;
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0312")] = {
            mnemonic: "JP Z,nn",
            "cycle": 10,
            proc: () => {
            var nn = fetchPair(); if (reg.flagZ()) {
                reg.PC = nn;
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0322")] = {
            mnemonic: "JP NC,nn",
            "cycle": 10,
            proc: () => {
            var nn = fetchPair(); if (!reg.flagC()) {
                reg.PC = nn;
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0332")] = {
            mnemonic: "JP C,nn",
            "cycle": 10,
            proc: () => {
            var nn = fetchPair(); if (reg.flagC()) {
                reg.PC = nn;
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0342")] = {
            mnemonic: "JP PO,nn",
            "cycle": 10,
            proc: () => {
            var nn = fetchPair(); if (!reg.flagP()) {
                reg.PC = nn;
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0352")] = {
            mnemonic: "JP PE,nn",
            "cycle": 10,
            proc: () => {
            var nn = fetchPair(); if (reg.flagP()) {
                reg.PC = nn;
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0362")] = {
            mnemonic: "JP P,nn",
            "cycle": 10,
            proc: () => {
            var nn = fetchPair(); if (!reg.flagS()) {
                reg.PC = nn;
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0372")] = {
            mnemonic: "JP M,nn",
            "cycle": 10,
            proc: () => {
            var nn = fetchPair(); if (reg.flagS()) {
                reg.PC = nn;
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0030")] = {
            mnemonic: "JR e",
            "cycle": 12,
            proc: () => { var e = fetch(); reg.jumpRel(e); },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0070")] = {
            mnemonic: "JR C,e",
            "cycle": 12,
            proc: () => {
            var e = fetch(); if (reg.flagC()) {
                reg.jumpRel(e);
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0050")] = {
            mnemonic: "JR Z,e",
            "cycle": 12,
            proc: () => {
            var e = fetch(); if (reg.flagZ()) {
                reg.jumpRel(e);
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0060")] = {
            mnemonic: "JR NC,e",
            "cycle": 12,
            proc: () => {
            var e = fetch(); if (!reg.flagC()) {
                reg.jumpRel(e);
            }
            },
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0040")] = {
            mnemonic: "JR NZ,e",
            proc: () => {
            var e = fetch(); if (!reg.flagZ()) {
                reg.jumpRel(e);
            }
            },
            "cycle": 12,
            disasm: disaJumpGroup
        };
        this.opecodeTable[oct("0351")] = {
            mnemonic: "JP (HL)",
            "cycle": 4,
            proc: () => { reg.PC = getHL(); },
            disasm: disaJumpGroup
        };
        opeIX[oct("0351")] = {
            mnemonic: "JP (IX)",
            "cycle": 8,
            proc: () => { reg.PC = reg.IX; },
            disasm: function (mem, addr) {
                return { code: [mem.peek(addr), mem.peek(addr + 1)], mnemonic: ['JP', '(IX)'] };
            }
        };
        opeIY[oct("0351")] = {
            mnemonic: "JP (IY)",
            "cycle": 8,
            proc: () => { reg.PC = reg.IY; },
            disasm: function (mem, addr) {
                return {
                code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ['JP', '(IY)']
                };
            }
        };
        //
        // Z80 Undefined Instruction
        //
        opeIX[ /* DD 44 = 01-000-100 = */oct("0104")] = {
            mnemonic: "LD B,IXH",
            proc: () => {
                setB(((reg.IX >> 8) & 0xff));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "B", "IXH"]
                };
            }
        };
        opeIX[ /* DD 4D = 01-001-101 = */oct("0115")] = {
            mnemonic: "LD C,IXL",
            proc: () => {
                setC((reg.IX & 0xff));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "C", "IXL"]
                };
            }
        };
        opeIX[ /* DD 60 = 01-100-000 = */oct("0140")] = {
            mnemonic: "LD IXH,B",
            proc: () => {
                reg.IX = (0xff00 & (getB() << 8)) | (reg.IX & 0xff);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "IXH", "B"]
                };
            }
        };
        opeIX[ /* DD 67 = 01-100-111 = */oct("0147")] = {
            mnemonic: "LD IXH,A",
            proc: () => {
                reg.IX = (0xff00 & (getA() << 8)) | (reg.IX & 0xff);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "IXH", "A"]
                };
            }
        };
        opeIX[ /* DD 69 = 01-101-001 = */oct("0151")] = {
            mnemonic: "LD IXL,C",
            proc: () => {
                reg.IX = (0xff00 & reg.IX) | (getC() & 0xff);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "IXL", "C"]
                };
            }
        };
        opeIX[ /* DD 6F = 01-101-111 = */oct("0157")] = {
            mnemonic: "LD IXL,A",
            proc: () => {
                reg.IX = (0xff00 & reg.IX) | (getA() & 0xff);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "IXL", "A"]
                };
            }
        };
        opeIX[ /* DD 7D = 01-111-101 = */oct("0175")] = {
            mnemonic: "LD A,IXL",
            proc: () => {
                setA((reg.IX & 0xff));
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["LD", "A", "IXL"]
                };
            }
        };
        opeIX[ /* DD 84 = 10-000-100 = */oct("0204")] = {
            mnemonic: "ADD A,IXH",
            proc: () => {
                reg.addAcc((reg.IX >> 8) & 0xff);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADD", "A", "IXH"]
                };
            }
        };
        opeIX[ /* DD 85 = 10-000-101 = */oct("0205")] = {
            mnemonic: "ADD A,IXL",
            proc: () => {
                reg.addAcc(reg.IX & 0xff);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["ADD", "A", "IXL"]
                };
            }
        };
        opeIX[ /* DD BD = 10-111-101 = */oct("0275")] = {
            mnemonic: "CP IXL",
            proc: () => {
                reg.compareAcc(reg.IX & 0xff);
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["CP", "IXL"]
                };
            }
        };
        this.opecodeTable[oct("0020")] = {
            mnemonic: "DJNZ",
            "cycle": 13,
            proc: () => {
                var e = fetch();
                reg.decrement("B");
                if (getB()) {
                    reg.jumpRel(e);
                }
            },
            disasm: function (mem, addr) {
                var e = BinUtil.getSignedByte(mem.peek(addr + 1));
                var ref_addr_to = addr + e + 2;
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ['DJNZ', NumberUtil.HEX(ref_addr_to, 4) + 'H;(' + (((e + 2 >= 0) ? "+" : "") + (e + 2)) + ')'],
                    ref_addr_to: ref_addr_to
                };
            }
        };
        //=================================================================================
        // コールリターングループ
        //=================================================================================
        this.opecodeTable[oct("0315")] = {
            mnemonic: "CALL nn",
            cycle: 17,
            proc: () => {
                var nn = fetchPair();
                pushPair(reg.PC);
                reg.PC = nn;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "" + NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0304")] = {
            mnemonic: "CALL NZ,nn",
            cycle: "NZ→17,Z→10",
            proc: () => {
                var nn = fetchPair();
                if (!reg.flagZ()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "NZ", NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0314")] = {
            mnemonic: "CALL Z,nn",
            cycle: "Z→17,NZ→10",
            proc: () => {
                var nn = fetchPair();
                if (reg.flagZ()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "Z", NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0324")] = {
            mnemonic: "CALL NC,nn",
            cycle: "NC→17, C→10",
            proc: () => {
                var nn = fetchPair();
                if (!reg.flagC()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "NC", NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0334")] = {
            mnemonic: "CALL C,nn",
            cycle: "C→17, NC→10",
            proc: () => {
                var nn = fetchPair();
                if (reg.flagC()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "C", NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0344")] = {
            mnemonic: "CALL PO,nn",
            cycle: "Parity Odd→17, Even→10",
            proc: () => {
                var nn = fetchPair();
                if (!reg.flagP()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "PO", NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0354")] = {
            mnemonic: "CALL PE,nn",
            cycle: "Parity Even→17, Odd→10",
            proc: () => {
                var nn = fetchPair();
                if (reg.flagP()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "PE", NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0364")] = {
            mnemonic: "CALL P,nn",
            cycle: "P→17, M→10",
            proc: () => {
                var nn = fetchPair();
                if (!reg.flagS()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "P", NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0374")] = {
            mnemonic: "CALL M,nn",
            cycle: "M→17, P→10",
            proc: () => {
                var nn = fetchPair();
                if (reg.flagS()) {
                    pushPair(reg.PC);
                    reg.PC = nn;
                    return 17;
                }
                return 10;
            },
            disasm: function (m, a) {
                var l = m.peek(a + 1), h = m.peek(a + 2);
                var addr = BinUtil.pair(h, l);
                return {
                    code: [m.peek(a), l, h],
                    mnemonic: ["CALL", "M", NumberUtil.HEX(addr, 4) + "H"],
                    ref_addr_to: addr
                };
            }
        };
        this.opecodeTable[oct("0311")] = {
            mnemonic: "RET",
            "cycle": 10,
            proc: () => { reg.PC = popPair(); },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET"]
                };
            }
        };
        this.opecodeTable[oct("0300")] = {
            mnemonic: "RET NZ",
            "cycle": "NZ→11, Z→5",
            proc: () => {
            if (!reg.flagZ()) {
                reg.PC = popPair();
                return 11;
            } return 5;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "NZ"]
                };
            }
        };
        this.opecodeTable[oct("0310")] = {
            mnemonic: "RET Z",
            "cycle": "Z→5, NZ→11",
            proc: () => {
            if (reg.flagZ()) {
                reg.PC = popPair();
                return 11;
            } return 5;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "Z"]
                };
            }
        };
        this.opecodeTable[oct("0320")] = {
            mnemonic: "RET NC",
            "cycle": "NC→11,C→5",
            proc: () => {
            if (!reg.flagC()) {
                reg.PC = popPair();
                return 11;
            } return 5;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "NC"]
                };
            }
        };
        this.opecodeTable[oct("0330")] = {
            mnemonic: "RET C",
            "cycle": "C→11,NC→5",
            proc: () => {
            if (reg.flagC()) {
                reg.PC = popPair();
                return 11;
            } return 5;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "C"]
                };
            }
        };
        this.opecodeTable[oct("0340")] = {
            mnemonic: "RET PO",
            "cycle": "Parity Odd→11, Parity Even→5",
            proc: () => {
            if (!reg.flagP()) {
                reg.PC = popPair();
                return 11;
            } return 5;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "PO"]
                };
            }
        };
        this.opecodeTable[oct("0350")] = {
            mnemonic: "RET PE",
            "cycle": "Parity Even→11, Parity Odd→5",
            proc: () => {
            if (reg.flagP()) {
                reg.PC = popPair();
                return 11;
            } return 5;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "PE"]
                };
            }
        };
        this.opecodeTable[oct("0360")] = {
            mnemonic: "RET P",
            "cycle": "P→11, M→5",
            proc: () => {
            if (!reg.flagS()) {
                reg.PC = popPair();
                return 11;
            } return 5;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "P"]
                };
            }
        };
        this.opecodeTable[oct("0370")] = {
            mnemonic: "RET M",
            "cycle": "M→11, P→5",
            proc: () => {
            if (reg.flagS()) {
                reg.PC = popPair();
                return 11;
            } return 5;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a)],
                    mnemonic: ["RET", "M"]
                };
            }
        };
        opeMisc[oct("0115")] = {
            mnemonic: "RETI",
            "cycle": 15,
            proc: () => {
                reg.PC = popPair();
                this.IFF1 = this.IFF2;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a), m.peek(a + 1)],
                    mnemonic: ["RETI"]
                };
            }
        };
        opeMisc[oct("0105")] = {
            mnemonic: "RETN",
            "cycle": 14,
            proc: () => {
                reg.PC = popPair();
                this.IFF1 = this.IFF2;
            },
            disasm: function (m, a) {
                return {
                    code: [m.peek(a), m.peek(a + 1)],
                    mnemonic: ["RETN"]
                };
            }
        };
        var rstVt = [0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38];
        for (var rstI = 0; rstI < rstVt.length; rstI++) {
            this.opecodeTable[oct("0307") | (rstI << 3)] = {
                mnemonic: "RST " + NumberUtil.HEX(rstVt[rstI], 2) + "H",
                proc: ((vec) => {
                    return () => {
                        pushPair(reg.PC);
                        reg.PC = vec;
                    };
                })(rstVt[rstI]),
                "cycle": 12,
                disasm: (function (vect) {
                    return function (mem, addr) {
                        return {
                            code: [mem.peek(addr)],
                            mnemonic: ["RST", NumberUtil.HEX(vect, 2) + "H"]
                        };
                    };
                })(rstVt[rstI])
            };
        }
        //=================================================================================
        // 入力・出力グループ
        //=================================================================================
        this.opecodeTable[oct("0333")] = {
            mnemonic: "IN A,(n)",
            cycle: 11,
            proc: () => { setA(this.readIoPort(fetch())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "A", "(" + mem.peek(addr + 1) + ")"]
                };
            }
        };
        opeMisc[oct("0100")] = {
            mnemonic: "IN B,(C)",
            cycle: 12,
            proc: () => { setB(this.readIoPort(getC())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "B", "(C)"]
                };
            }
        };
        opeMisc[oct("0110")] = {
            mnemonic: "IN C,(C)",
            cycle: 12,
            proc: () => { setC(this.readIoPort(getC())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "C", "(C)"]
                };
            }
        };
        opeMisc[oct("0120")] = {
            mnemonic: "IN D,(C)",
            cycle: 12,
            proc: () => { setD(this.readIoPort(getC())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "D", "(C)"]
                };
            }
        };
        opeMisc[oct("0130")] = {
            mnemonic: "IN E,(C)",
            cycle: 12,
            proc: () => { setE(this.readIoPort(getC())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "E", "(C)"]
                };
            }
        };
        opeMisc[oct("0140")] = {
            mnemonic: "IN H,(C)",
            cycle: 12,
            proc: () => { setH(this.readIoPort(getC())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "H", "(C)"]
                };
            }
        };
        opeMisc[oct("0150")] = {
            mnemonic: "IN L,(C)",
            cycle: 12,
            proc: () => { setL(this.readIoPort(getC())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "L", "(C)"]
                };
            }
        };
        opeMisc[oct("0170")] = {
            mnemonic: "IN A,(C)",
            cycle: 12,
            proc: () => { setA(this.readIoPort(getC())); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IN", "A", "(C)"]
                };
            }
        };
        opeMisc[oct("0242")] = {
            mnemonic: "INI",
            cycle: 16,
            proc: () => {
                setB((getB() - 1) & 0xff);
                poke(getHL(), this.readIoPort(getC()));
                reg.postINI();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INI"]
                };
            }
        };
        opeMisc[oct("0262")] = {
            mnemonic: "INIR",
            cycle: "21 x reg B",
            proc: () => {
                setB((getB() - 1) & 0xff);
                poke(getHL(), this.readIoPort(getC()));
                reg.postINI();
                if (getB() != 0) {
                    reg.PC -= 2;
                }
                return 21;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INIR"]
                };
            }
        };
        opeMisc[oct("0252")] = {
            mnemonic: "IND",
            cycle: 16,
            proc: () => {
                setB((getB() - 1) & 0xff);
                poke(getHL(), this.readIoPort(getC()));
                reg.postIND();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["IND"]
                };
            }
        };
        opeMisc[oct("0272")] = {
            mnemonic: "INDR",
            cycle: "21 x reg B",
            proc: () => {
                setB((getB() - 1) & 0xff);
                poke(getHL(), this.readIoPort(getC()));
                reg.postIND();
                if (getB() != 0) {
                    reg.PC -= 2;
                }
                return 21;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["INDR"]
                };
            }
        };
        this.opecodeTable[oct("0323")] = {
            mnemonic: "OUT (n),A",
            cycle: 11,
            proc: () => { this.writeIoPort(fetch(), getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(" + mem.peek(addr + 1) + ")", "A"]
                };
            }
        };
        opeMisc[oct("0101")] = {
            mnemonic: "OUT (C),B",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getB()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "B"]
                };
            }
        };
        opeMisc[oct("0111")] = {
            mnemonic: "OUT (C),C",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getC()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "C"]
                };
            }
        };
        opeMisc[oct("0121")] = {
            mnemonic: "OUT (C),D",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getD()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "D"]
                };
            }
        };
        opeMisc[oct("0131")] = {
            mnemonic: "OUT (C),E",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getE()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "E"]
                };
            }
        };
        opeMisc[oct("0141")] = {
            mnemonic: "OUT (C),H",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getH()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "H"]
                };
            }
        };
        opeMisc[oct("0151")] = {
            mnemonic: "OUT (C),L",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getL()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "L"]
                };
            }
        };
        opeMisc[oct("0171")] = {
            mnemonic: "OUT (C),A",
            cycle: 12,
            proc: () => { this.writeIoPort(getC(), getA()); },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUT", "(C)", "A"]
                };
            }
        };
        opeMisc[oct("0243")] = {
            mnemonic: "OUTI",
            cycle: 16,
            proc: () => {
                setB((getB() - 1) & 0xff);
                this.writeIoPort(getC(), peek(getHL()));
                reg.postOUTI();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUTI"]
                };
            }
        };
        opeMisc[oct("0263")] = {
            mnemonic: "OTIR",
            cycle: "21 x reg B",
            proc: () => {
                setB((getB() - 1) & 0xff);
                this.writeIoPort(getC(), peek(getHL()));
                reg.postOUTI();
                if (getB() != 0) {
                    reg.PC -= 2;
                }
                return 21;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OTIR"]
                };
            }
        };
        opeMisc[oct("0253")] = {
            mnemonic: "OUTD",
            cycle: 16,
            proc: () => {
                setB((getB() - 1) & 0xff);
                this.writeIoPort(getC(), peek(getHL()));
                reg.postOUTD();
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OUTD"]
                };
            }
        };
        opeMisc[oct("0273")] = {
            mnemonic: "OTDR",
            cycle: "21 x reg B",
            proc: () => {
                setB((getB() - 1) & 0xff);
                this.writeIoPort(getC(), peek(getHL()));
                reg.postOUTD();
                if (getB() != 0) {
                    reg.PC -= 2;
                }
                return 21;
            },
            disasm: function (mem, addr) {
                return {
                    code: [mem.peek(addr), mem.peek(addr + 1)],
                    mnemonic: ["OTDR"]
                };
            }
        };
    }
    onReadIoPort(port:number, handler:Function) {
        this._onReadIoPort[port] = handler;
    }
    onWriteIoPort(port:number, handler:Function) {
        this._onWriteIoPort[port] = handler;
    }
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
        const memory_block = new MemoryBlock();
        memory_block.create({ startAddr: addr - offset, size: size });
        memory_block.mem = buf;
        const cpu = new Z80({ memory: memory_block });
        cpu.reg.PC = memory_block.startAddr;
        const orgInst = Z80LineAssembler.create(
            "ORG", NumberUtil.HEX(memory_block.startAddr, 4) + "H");
        orgInst.setAddress(memory_block.startAddr),
            dasmlist.push(orgInst);
        while (cpu.reg.PC < memory_block.startAddr + memory_block.size) {
            const dis = cpu.disassemble(cpu.reg.PC, addr - offset + size);
            dis.setAddress(cpu.reg.PC);
            if (dis.bytecode.length > 0) {
                dis.setComment('; ' + NumberUtil.HEX(dis.address, 4) + "H " +
                    dis.bytecode.map(function (b) {
                        return NumberUtil.HEX(b, 2);
                    }).join(" "));
            }
            dasmlist.push(dis);
            cpu.reg.PC += dis.bytecode.length;
        }
        return Z80.processAddressReference(dasmlist);
    }
    /**
     * Create information of the referenced count.
     * @param {object[]} dasmlist   A result of disassembling.
     * @return {object[]} Same object to parameter.
     */
    static processAddressReference(dasmlist) {
        const addr2line = {};
        dasmlist.forEach((dis, lineno) => {
            addr2line[dis.address] = lineno;
        });
        dasmlist.forEach((dis, i, arr) => {
            if (dis.ref_addr_to != null && dis.ref_addr_to in addr2line) {
                const lineno = addr2line[dis.ref_addr_to];
                arr[lineno].referenced_count++;
            }
        });
        dasmlist.forEach((dis, i, arr) => {
            if (dis.referenced_count > 0) {
                arr[i].setLabel("$" + NumberUtil.HEX(dis.address, 4) + "H");
            }
        });
        return dasmlist;
    }
    static dasmlines(dasmlist) {
        return dasmlist.map(function (dis) {
            var addr;
            if (dis.referenced_count > 0) {
                addr = "$" + NumberUtil.HEX(dis.address, 4) + "H:";
            }
            else {
                addr = "       ";
            }
            addr += "   ";
            var mne = dis.mnemonic || "";
            let operand = dis.operand || "";
            if (mne && operand) {
                while (mne.length < 8) {
                    mne += " ";
                }
            }
            var line = addr + '      ' + mne + operand;
            if (mne || operand) {
                while (line.length < 40) {
                    line += ' ';
                }
            }
            if (dis.comment != "") {
                if (dis.referenced_count == 0 && !mne && !operand) {
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

module.exports = Z80;
