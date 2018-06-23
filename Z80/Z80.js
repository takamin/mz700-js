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

        var mne = dis.mnemonic || "";
        let operand = dis.operand || "";
        if(mne && operand) {
            while(mne.length < 8) {
                mne += " ";
            }
        }
        var line = addr + '      ' + mne + operand;
        if(mne || operand) {
            while(line.length < 40) {
                line += ' ';
            }
        }
        if(dis.comment != "") {
            if(dis.referenced_count == 0 && !mne && !operand) {
                line = dis.comment;
            } else {
                line += dis.comment;
            }
        }

        return line.replace(/\s*$/, "");
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
                                THIS.reg["set" + dstRegName]( THIS.reg["get" + srcRegName]() );
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
        proc: function() { THIS.reg.setB( THIS.fetch() ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0016")] = {
        mnemonic:"LD C,n",
        proc: function() { THIS.reg.setC( THIS.fetch() ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0026")] = {
        mnemonic:"LD D,n",
        proc: function() { THIS.reg.setD( THIS.fetch() ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0036")] = {
        mnemonic:"LD E,n",
        proc: function() { THIS.reg.setE( THIS.fetch() ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0046")] = {
        mnemonic:"LD H,n",
        proc: function() { THIS.reg.setH( THIS.fetch() ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0056")] = {
        mnemonic:"LD L,n",
        proc: function() { THIS.reg.setL( THIS.fetch() ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0076")] = {
        mnemonic:"LD A,n",
        proc: function() { THIS.reg.setA( THIS.fetch() ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
	//---------------------------------------------------------------------------------
	// LD r,(HL)	r<-(HL)					01  r  110
	//---------------------------------------------------------------------------------
    this.opecodeTable[oct("0106")] = {
        mnemonic:"LD B,(HL)",
        proc: function() { THIS.reg.setB( THIS.memory.peek(THIS.reg.getHL()) ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0116")] = {
        mnemonic:"LD C,(HL)",
        proc: function() { THIS.reg.setC( THIS.memory.peek(THIS.reg.getHL()) ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0126")] = {
        mnemonic:"LD D,(HL)",
        proc: function() { THIS.reg.setD( THIS.memory.peek(THIS.reg.getHL()) ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0136")] = {
        mnemonic:"LD E,(HL)",
        proc: function() { THIS.reg.setE( THIS.memory.peek(THIS.reg.getHL()) ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0146")] = {
        mnemonic:"LD H,(HL)",
        proc: function() { THIS.reg.setH( THIS.memory.peek(THIS.reg.getHL()) ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0156")] = {
        mnemonic:"LD L,(HL)",
        proc: function() { THIS.reg.setL( THIS.memory.peek(THIS.reg.getHL()) ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0176")] = {
        mnemonic:"LD A,(HL)",
        proc: function() { THIS.reg.setA( THIS.memory.peek(THIS.reg.getHL()) ); },
        "cycle": 7,
        disasm: disa_0x_r_110
    };
	//---------------------------------------------------------------------------------
	// LD (HL),r	(HL)<-r					01 110  r 
	//---------------------------------------------------------------------------------
    this.opecodeTable[oct("0160")] = {
        mnemonic:"LD (HL),B",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.getB()); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0161")] = {
        mnemonic:"LD (HL),C",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.getC()); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0162")] = {
        mnemonic:"LD (HL),D",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.getD()); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0163")] = {
        mnemonic:"LD (HL),E",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.getE()); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0164")] = {
        mnemonic:"LD (HL),H",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.getH()); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0165")] = {
        mnemonic:"LD (HL),L",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.getL()); },
        "cycle": 10,
        disasm: disa_0x_r_110
    };
    this.opecodeTable[oct("0167")] = {
        mnemonic:"LD (HL),A",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.getA()); },
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
        proc: function() { THIS.reg.setA( THIS.memory.peek(THIS.reg.getBC()) ); },
        "cycle": 7,
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "A", "(BC)"]};}
    };
	//---------------------------------------------------------------------------------
	// LD A,(DE)	A<-(DE)					00 011 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0032")] = {
        mnemonic:"LD A,(DE)",
        proc: function() { THIS.reg.setA( THIS.memory.peek(THIS.reg.getDE()) ); },
        "cycle": 7,
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "A", "(DE)"]};}
    };
	//---------------------------------------------------------------------------------
	// LD A,(nn)	A<-(nn)					00 111 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0072")] = { mnemonic:"LD A,(nn)",
        proc: function() { THIS.reg.setA( THIS.memory.peek(THIS.fetchPair()) ); },
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
        proc: function() { THIS.memory.poke(THIS.reg.getBC(), THIS.reg.getA()); },
        "cycle": 7,
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "(BC)","A"]};} };
	//---------------------------------------------------------------------------------
	// LD (DE),A	(DE)<-A					00 010 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0022")] = { mnemonic:"LD (DE),A",
        proc: function() { THIS.memory.poke(THIS.reg.getDE(), THIS.reg.getA()); },
        "cycle": 7,
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "(DE)","A"]};} };
	//---------------------------------------------------------------------------------
	// LD (nn),A	(nn)<-A					00 110 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[oct("0062")] = { mnemonic:"LD (nn),A",
        proc: function() { THIS.memory.poke(THIS.fetchPair(), THIS.reg.getA()); },
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
        proc: function() { THIS.reg.I = THIS.reg.getA(); },
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
        proc: function() { THIS.reg.R = THIS.regB.R = THIS.reg.getA(); },
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
        proc: function() { THIS.reg.setB( THIS.memory.peek(THIS.reg.IX + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "B", "IX");
        }
    };
    opeIX[oct("0116")] = {
        mnemonic:"LD C,(IX+d)",
        proc: function() { THIS.reg.setC( THIS.memory.peek(THIS.reg.IX + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "C", "IX");
        }
    };
    opeIX[oct("0126")] = {
        mnemonic:"LD D,(IX+d)",
        proc: function() { THIS.reg.setD( THIS.memory.peek(THIS.reg.IX + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "D", "IX");
        }
    };
    opeIX[oct("0136")] = {
        mnemonic:"LD E,(IX+d)",
        proc: function() { THIS.reg.setE( THIS.memory.peek(THIS.reg.IX + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "E", "IX");
        }
    };
    opeIX[oct("0146")] = {
        mnemonic:"LD H,(IX+d)",
        proc: function() { THIS.reg.setH( THIS.memory.peek(THIS.reg.IX + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "H", "IX");
        }
    };
    opeIX[oct("0156")] = {
        mnemonic:"LD L,(IX+d)",
        proc: function() { THIS.reg.setL( THIS.memory.peek(THIS.reg.IX + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "L", "IX");
        }
    };
    opeIX[oct("0176")] = {
        mnemonic:"LD A,(IX+d)",
        proc: function() { THIS.reg.setA( THIS.memory.peek(THIS.reg.IX + THIS.fetch()) ); },
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
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.getB()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "B");
        }
    };
    opeIX[oct("0161")] = {
        mnemonic:"LD (IX+d),C",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.getC()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "C");
        }
    };
    opeIX[oct("0162")] = {
        mnemonic:"LD (IX+d),D",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.getD()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "D");
        }
    };
    opeIX[oct("0163")] = {
        mnemonic:"LD (IX+d),E",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.getE()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "E");
        }
    };
    opeIX[oct("0164")] = {
        mnemonic:"LD (IX+d),H",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.getH()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "H");
        }
    };
    opeIX[oct("0165")] = {
        mnemonic:"LD (IX+d),L",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.getL()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IX", "L");
        }
    };
    opeIX[oct("0167")] = {
        mnemonic:"LD (IX+d),A",
        proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.getA()); },
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
        proc: function() { THIS.reg.setB( THIS.memory.peek(THIS.reg.IY + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "B", "IY");
        }
    };
    opeIY[oct("0116")] = {
        mnemonic:"LD C,(IY+d)",
        proc: function() { THIS.reg.setC( THIS.memory.peek(THIS.reg.IY + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "C", "IY");
        }
    };
    opeIY[oct("0126")] = {
        mnemonic:"LD D,(IY+d)",
        proc: function() { THIS.reg.setD( THIS.memory.peek(THIS.reg.IY + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "D", "IY");
        }
    };
    opeIY[oct("0136")] = {
        mnemonic:"LD E,(IY+d)",
        proc: function() { THIS.reg.setE( THIS.memory.peek(THIS.reg.IY + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "E", "IY");
        }
    };
    opeIY[oct("0146")] = {
        mnemonic:"LD H,(IY+d)",
        proc: function() { THIS.reg.setH( THIS.memory.peek(THIS.reg.IY + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "H", "IY");
        }
    };
    opeIY[oct("0156")] = {
        mnemonic:"LD L,(IY+d)",
        proc: function() { THIS.reg.setL( THIS.memory.peek(THIS.reg.IY + THIS.fetch()) ); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_r_idx_d(mem, addr, "L", "IY");
        }
    };
    opeIY[oct("0176")] = {
        mnemonic:"LD A,(IY+d)",
        proc: function() { THIS.reg.setA( THIS.memory.peek(THIS.reg.IY + THIS.fetch()) ); },
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
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.getB()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "B");
        }
    };
    opeIY[oct("0161")] = {
        mnemonic:"LD (IY+d),C",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.getC()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "C");
        }
    };
    opeIY[oct("0162")] = {
        mnemonic:"LD (IY+d),D",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.getD()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "D");
        }
    };
    opeIY[oct("0163")] = {
        mnemonic:"LD (IY+d),E",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.getE()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "E");
        }
    };
    opeIY[oct("0164")] = {
        mnemonic:"LD (IY+d),H",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.getH()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "H");
        }
    };
    opeIY[oct("0165")] = {
        mnemonic:"LD (IY+d),L",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.getL()); },
        "cycle": 19,
        disasm: function(mem, addr) {
            return disasm_LD_idx_d_r(mem, addr, "IY", "L");
        }
    };
    opeIY[oct("0167")] = {
        mnemonic:"LD (IY+d),A",
        proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.getA()); },
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
            THIS.reg.setC( THIS.fetch() );
            THIS.reg.setB( THIS.fetch() );
        },
        disasm: disasm_LD_dd_nn
    };
    this.opecodeTable[oct("0021")] = {
        mnemonic:"LD DE,nn",
        cycle: 10,
        proc: function() {
            THIS.reg.setE( THIS.fetch() );
            THIS.reg.setD( THIS.fetch() );
        },
        disasm: disasm_LD_dd_nn
    };
    this.opecodeTable[oct("0041")] = {
        mnemonic:"LD HL,nn",
        cycle: 10,
        proc: function() {
            THIS.reg.setL( THIS.fetch() );
            THIS.reg.setH( THIS.fetch() );
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
            THIS.reg.setL( THIS.memory.peek(nn + 0) );
            THIS.reg.setH( THIS.memory.peek(nn + 1) );
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
            THIS.reg.setC( THIS.memory.peek(nn + 0) );
            THIS.reg.setB( THIS.memory.peek(nn + 1) );
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
            THIS.reg.setE( THIS.memory.peek(nn + 0) );
            THIS.reg.setD( THIS.memory.peek(nn + 1) );
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
            THIS.reg.setL( THIS.memory.peek(nn + 0) );
            THIS.reg.setH( THIS.memory.peek(nn + 1) );
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
            THIS.memory.poke(nn + 0, THIS.reg.getL()); 
            THIS.memory.poke(nn + 1, THIS.reg.getH());
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
            THIS.memory.poke(nn + 0, THIS.reg.getC());
            THIS.memory.poke(nn + 1, THIS.reg.getB());
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
            THIS.memory.poke(nn + 0, THIS.reg.getE());
            THIS.memory.poke(nn + 1, THIS.reg.getD());
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
            THIS.memory.poke(nn + 0, THIS.reg.getL());
            THIS.memory.poke(nn + 1, THIS.reg.getH());
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
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.getB());
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.getC()); },
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
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.getD());
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.getE()); },
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
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.getH());
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.getL()); },
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
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.getA());
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.getF()); },
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
            THIS.reg.setC( THIS.memory.peek(THIS.reg.SP++) );
            THIS.reg.setB( THIS.memory.peek(THIS.reg.SP++) ); },
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
            THIS.reg.setE( THIS.memory.peek(THIS.reg.SP++) );
            THIS.reg.setD( THIS.memory.peek(THIS.reg.SP++) ); },
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
            THIS.reg.setL( THIS.memory.peek(THIS.reg.SP++) );
            THIS.reg.setH( THIS.memory.peek(THIS.reg.SP++) ); },
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
            THIS.reg.setF( THIS.memory.peek(THIS.reg.SP++) );
            THIS.reg.setA( THIS.memory.peek(THIS.reg.SP++) ); },
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
            var tmp = THIS.reg.getD();
            THIS.reg.setD( THIS.reg.getH() );
            THIS.reg.setH( tmp );
            tmp = THIS.reg.getE();
            THIS.reg.setE( THIS.reg.getL() );
            THIS.reg.setL( tmp );
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
            var tmp = THIS.reg.getA();
            THIS.reg.setA( THIS.regB.getA() );
            THIS.regB.setA( tmp );
            tmp = THIS.reg.getF();
            THIS.reg.setF( THIS.regB.getF() );
            THIS.regB.setF( tmp );
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
            var tmp = THIS.reg.getB();
            THIS.reg.setB( THIS.regB.getB() );
            THIS.regB.setB( tmp );
            tmp = THIS.reg.getC();
            THIS.reg.setC( THIS.regB.getC() );
            THIS.regB.setC( tmp );

            tmp = THIS.reg.getD();
            THIS.reg.setD( THIS.regB.getD() );
            THIS.regB.setD( tmp );
            tmp = THIS.reg.getE();
            THIS.reg.setE( THIS.regB.getE() );
            THIS.regB.setE( tmp );

            tmp = THIS.reg.getH();
            THIS.reg.setH( THIS.regB.getH() );
            THIS.regB.setH( tmp );
            tmp = THIS.reg.getL();
            THIS.reg.setL( THIS.regB.getL() );
            THIS.regB.setL( tmp );
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
            THIS.memory.poke(THIS.reg.SP + 1, THIS.reg.getH());
            THIS.reg.setH( tmp );

            tmp = THIS.memory.peek(THIS.reg.SP);
            THIS.memory.poke(THIS.reg.SP, THIS.reg.getL());
            THIS.reg.setL( tmp );
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
        proc: function() { THIS.reg.addAcc(THIS.reg.getB()); },
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
        proc: function() { THIS.reg.addAcc(THIS.reg.getC()); },
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
        proc: function() { THIS.reg.addAcc(THIS.reg.getD()); },
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
        proc: function() { THIS.reg.addAcc(THIS.reg.getE()); },
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
        proc: function() { THIS.reg.addAcc(THIS.reg.getH()); },
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
        proc: function() { THIS.reg.addAcc(THIS.reg.getL()); },
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
        proc: function() { THIS.reg.addAcc(THIS.reg.getA()); },
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
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.getB()); },
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
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.getC()); },
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
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.getD()); },
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
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.getE()); },
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
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.getH()); },
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
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.getL()); },
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
        proc: function() { THIS.reg.addAccWithCarry(THIS.reg.getA()); },
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
        proc: function() { THIS.reg.subAcc(THIS.reg.getB()); },
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
        proc: function() { THIS.reg.subAcc(THIS.reg.getC()); },
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
        proc: function() { THIS.reg.subAcc(THIS.reg.getD()); },
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
        proc: function() { THIS.reg.subAcc(THIS.reg.getE()); },
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
        proc: function() { THIS.reg.subAcc(THIS.reg.getH()); },
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
        proc: function() { THIS.reg.subAcc(THIS.reg.getL()); },
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
        proc: function() { THIS.reg.subAcc(THIS.reg.getA()); },
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
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.getB()); },
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
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.getC()); },
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
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.getD()); },
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
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.getE()); },
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
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.getH()); },
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
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.getL()); },
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
        proc: function() { THIS.reg.subAccWithCarry(THIS.reg.getA()); },
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
        proc: function() { THIS.reg.andAcc(THIS.reg.getB()); },
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
        proc: function() { THIS.reg.andAcc(THIS.reg.getC()); },
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
        proc: function() { THIS.reg.andAcc(THIS.reg.getD()); },
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
        proc: function() { THIS.reg.andAcc(THIS.reg.getE()); },
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
        proc: function() { THIS.reg.andAcc(THIS.reg.getH()); },
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
        proc: function() { THIS.reg.andAcc(THIS.reg.getL()); },
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
        proc: function() { THIS.reg.andAcc(THIS.reg.getA()); },
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
        proc: function() { THIS.reg.orAcc(THIS.reg.getB()); },
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
        proc: function() { THIS.reg.orAcc(THIS.reg.getC()); },
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
        proc: function() { THIS.reg.orAcc(THIS.reg.getD()); },
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
        proc: function() { THIS.reg.orAcc(THIS.reg.getE()); },
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
        proc: function() { THIS.reg.orAcc(THIS.reg.getH()); },
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
        proc: function() { THIS.reg.orAcc(THIS.reg.getL()); },
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
        proc: function() { THIS.reg.orAcc(THIS.reg.getA()); },
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
        proc: function() { THIS.reg.xorAcc(THIS.reg.getB()); },
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
        proc: function() { THIS.reg.xorAcc(THIS.reg.getC()); },
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
        proc: function() { THIS.reg.xorAcc(THIS.reg.getD()); },
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
        proc: function() { THIS.reg.xorAcc(THIS.reg.getE()); },
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
        proc: function() { THIS.reg.xorAcc(THIS.reg.getH()); },
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
        proc: function() { THIS.reg.xorAcc(THIS.reg.getL()); },
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
        proc: function() { THIS.reg.xorAcc(THIS.reg.getA()); },
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
        proc: function() { THIS.reg.compareAcc(THIS.reg.getB()); },
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
        proc: function() { THIS.reg.compareAcc(THIS.reg.getC()); },
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
        proc: function() { THIS.reg.compareAcc(THIS.reg.getD()); },
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
        proc: function() { THIS.reg.compareAcc(THIS.reg.getE()); },
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
        proc: function() { THIS.reg.compareAcc(THIS.reg.getH()); },
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
        proc: function() { THIS.reg.compareAcc(THIS.reg.getL()); },
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
        proc: function() { THIS.reg.compareAcc(THIS.reg.getA()); },
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
            THIS.reg.setB( THIS.reg.RLC(THIS.reg.getB()) );
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
            THIS.reg.setC( THIS.reg.RLC(THIS.reg.getC()) );
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
            THIS.reg.setD( THIS.reg.RLC(THIS.reg.getD()) );
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
            THIS.reg.setE( THIS.reg.RLC(THIS.reg.getE()) );
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
            THIS.reg.setH( THIS.reg.RLC(THIS.reg.getH()) );
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
            THIS.reg.setL( THIS.reg.RLC(THIS.reg.getL()) );
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
            THIS.reg.setA( THIS.reg.RLC(THIS.reg.getA()) );
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
        proc: function() { THIS.reg.setB( THIS.reg.RL(THIS.reg.getB()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","B"] };}
    };
    opeRotate[oct("0021")] = {
        mnemonic:"RL C",
        cycle: 8,
        proc: function() { THIS.reg.setC( THIS.reg.RL(THIS.reg.getC()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","C"] };}
    };
    opeRotate[oct("0022")] = {
        mnemonic:"RL D",
        cycle: 8,
        proc: function() { THIS.reg.setD( THIS.reg.RL(THIS.reg.getD()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","D"] };}
    };
    opeRotate[oct("0023")] = {
        mnemonic:"RL E",
        cycle: 8,
        proc: function() { THIS.reg.setE( THIS.reg.RL(THIS.reg.getE()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","E"] };}
    };
    opeRotate[oct("0024")] = {
        mnemonic:"RL H",
        cycle: 8,
        proc: function() { THIS.reg.setH( THIS.reg.RL(THIS.reg.getH()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","H"] };}
    };
    opeRotate[oct("0025")] = {
        mnemonic:"RL L",
        cycle: 8,
        proc: function() { THIS.reg.setL( THIS.reg.RL(THIS.reg.getL()) ); },
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
        proc: function() { THIS.reg.setA( THIS.reg.RL(THIS.reg.getA()) ); },
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
        proc: function() { THIS.reg.setB( THIS.reg.RRC(THIS.reg.getB()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","B"] };}
    };
    opeRotate[oct("0011")] = {
        mnemonic:"RRC C",
        cycle: 4,
        proc: function() { THIS.reg.setC( THIS.reg.RRC(THIS.reg.getC()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","C"] };}
    };
    opeRotate[oct("0012")] = {
        mnemonic:"RRC D",
        cycle: 4,
        proc: function() { THIS.reg.setD( THIS.reg.RRC(THIS.reg.getD()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","D"] };}
    };
    opeRotate[oct("0013")] = {
        mnemonic:"RRC E",
        cycle: 4,
        proc: function() { THIS.reg.setE( THIS.reg.RRC(THIS.reg.getE()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","E"] };}
    };
    opeRotate[oct("0014")] = {
        mnemonic:"RRC H",
        cycle: 4,
        proc: function() { THIS.reg.setH( THIS.reg.RRC(THIS.reg.getH()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","H"] };}
    };
    opeRotate[oct("0015")] = {
        mnemonic:"RRC L",
        cycle: 4,
        proc: function() { THIS.reg.setL( THIS.reg.RRC(THIS.reg.getL()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","L"] };}
    };
    opeRotate[oct("0017")] = {
        mnemonic:"RRC A",
        cycle: 4,
        proc: function() { THIS.reg.setA( THIS.reg.RRC(THIS.reg.getA()) ); },
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
        proc: function() { THIS.reg.setB( THIS.reg.RR(THIS.reg.getB()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","B"] };}
    };
    opeRotate[oct("0031")] = {
        mnemonic:"RR C",
        cycle: 8,
        proc: function() { THIS.reg.setC( THIS.reg.RR(THIS.reg.getC()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","C"] };}
    };
    opeRotate[oct("0032")] = {
        mnemonic:"RR D",
        cycle: 8,
        proc: function() { THIS.reg.setD( THIS.reg.RR(THIS.reg.getD()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","D"] };}
    };
    opeRotate[oct("0033")] = {
        mnemonic:"RR E",
        cycle: 8,
        proc: function() { THIS.reg.setE( THIS.reg.RR(THIS.reg.getE()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","E"] };}
    };
    opeRotate[oct("0034")] = {
        mnemonic:"RR H",
        cycle: 8,
        proc: function() { THIS.reg.setH( THIS.reg.RR(THIS.reg.getH()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","H"] };}
    };
    opeRotate[oct("0035")] = {
        mnemonic:"RR L",
        cycle: 8,
        proc: function() { THIS.reg.setL( THIS.reg.RR(THIS.reg.getL()) ); },
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
        proc: function() { THIS.reg.setA( THIS.reg.RR(THIS.reg.getA()) ); },
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
        proc: function() { THIS.reg.setB( THIS.reg.SLA(THIS.reg.getB()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","B"] };}
    };
    opeRotate[oct("0041")] = {
        mnemonic:"SLA C",
        cycle:8,
        proc: function() { THIS.reg.setC( THIS.reg.SLA(THIS.reg.getC()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","C"] };}
    };
    opeRotate[oct("0042")] = {
        mnemonic:"SLA D",
        cycle:8,
        proc: function() { THIS.reg.setD( THIS.reg.SLA(THIS.reg.getD()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","D"] };}
    };
    opeRotate[oct("0043")] = {
        mnemonic:"SLA E",
        cycle:8,
        proc: function() { THIS.reg.setE( THIS.reg.SLA(THIS.reg.getE()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","E"] };}
    };
    opeRotate[oct("0044")] = {
        mnemonic:"SLA H",
        cycle:8,
        proc: function() { THIS.reg.setH( THIS.reg.SLA(THIS.reg.getH()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","H"] };}
    };
    opeRotate[oct("0045")] = {
        mnemonic:"SLA L",
        cycle:8,
        proc: function() { THIS.reg.setL( THIS.reg.SLA(THIS.reg.getL()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","L"] };}
    };
    opeRotate[oct("0047")] = {
        mnemonic:"SLA A",
        cycle:8,
        proc: function() { THIS.reg.setA( THIS.reg.SLA(THIS.reg.getA()) ); },
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
        proc: function() { THIS.reg.setB( THIS.reg.SRA(THIS.reg.getB()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","B"] };}
    };
    opeRotate[oct("0051")] = {
        mnemonic:"SRA C",
        cycle: 8,
        proc: function() { THIS.reg.setC( THIS.reg.SRA(THIS.reg.getC()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","C"] };}
    };
    opeRotate[oct("0052")] = {
        mnemonic:"SRA D",
        cycle: 8,
        proc: function() { THIS.reg.setD( THIS.reg.SRA(THIS.reg.getD()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","D"] };}
    };
    opeRotate[oct("0053")] = {
        mnemonic:"SRA E",
        cycle: 8,
        proc: function() { THIS.reg.setE( THIS.reg.SRA(THIS.reg.getE()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","E"] };}
    };
    opeRotate[oct("0054")] = {
        mnemonic:"SRA H",
        cycle: 8,
        proc: function() { THIS.reg.setH( THIS.reg.SRA(THIS.reg.getH()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","H"] };}
    };
    opeRotate[oct("0055")] = {
        mnemonic:"SRA L",
        cycle: 8,
        proc: function() { THIS.reg.setL( THIS.reg.SRA(THIS.reg.getL()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","L"] };}
    };
    opeRotate[oct("0057")] = {
        mnemonic:"SRA A",
        cycle: 8,
        proc: function() { THIS.reg.setA( THIS.reg.SRA(THIS.reg.getA()) ); },
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
        proc: function() { THIS.reg.setB( THIS.reg.SRL(THIS.reg.getB()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","B"] };}
    };
    opeRotate[oct("0071")] = {
        mnemonic:"SRL C",
        cycle: 8,
        proc: function() { THIS.reg.setC( THIS.reg.SRL(THIS.reg.getC()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","C"] };}
    };
    opeRotate[oct("0072")] = {
        mnemonic:"SRL D",
        cycle: 8,
        proc: function() { THIS.reg.setD( THIS.reg.SRL(THIS.reg.getD()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","D"] };}
    };
    opeRotate[oct("0073")] = {
        mnemonic:"SRL E",
        cycle: 8,
        proc: function() { THIS.reg.setE( THIS.reg.SRL(THIS.reg.getE()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","E"] };}
    };
    opeRotate[oct("0074")] = {
        mnemonic:"SRL H",
        cycle: 8,
        proc: function() { THIS.reg.setH( THIS.reg.SRL(THIS.reg.getH()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","H"] };}
    };
    opeRotate[oct("0075")] = {
        mnemonic:"SRL L",
        cycle: 8,
        proc: function() { THIS.reg.setL( THIS.reg.SRL(THIS.reg.getL()) ); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","L"] };}
    };
    opeRotate[oct("0077")] = {
        mnemonic:"SRL A",
        cycle: 8,
        proc: function() { THIS.reg.setA( THIS.reg.SRL(THIS.reg.getA()) ); },
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
            var AH = THIS.reg.getA() & 0xf0;
            var AL = THIS.reg.getA() & 0x0f;
            var nH = (n >> 4) & 0x0f;
            var nL = (n >> 0) & 0x0f;
            
            THIS.reg.setA( AH | nH );
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
            var AH = THIS.reg.getA() & 0xf0;
            var AL = THIS.reg.getA() & 0x0F;
            var nH = (n >> 4) & 0x0f;
            var nL = (n >> 0) & 0x0f;

            THIS.reg.setA( AH | nL );
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
                            var value = THIS.reg["get" + reg8[r]]();
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
                            THIS.reg["set" + reg8[r]]( THIS.reg["get" + reg8[r]]() | (1 << b) );
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
            THIS.reg["set" + r]( THIS.reg["get" + r]() & bits );
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
            THIS.reg.setB( ((THIS.reg.IX >> 8) & 0xff) );
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
            THIS.reg.setC( (THIS.reg.IX & 0xff) );
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
            THIS.reg.IX = (0xff00 & (THIS.reg.getB() << 8)) | (THIS.reg.IX & 0xff);
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
            THIS.reg.IX = (0xff00 & (THIS.reg.getA() << 8)) | (THIS.reg.IX & 0xff);
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
            THIS.reg.IX = (0xff00 & THIS.reg.IX ) | (THIS.reg.getC() & 0xff);
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
            THIS.reg.IX = (0xff00 & THIS.reg.IX ) | (THIS.reg.getA() & 0xff);
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
            THIS.reg.setA( (THIS.reg.IX & 0xff) );
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
            if(THIS.reg.getB()) {
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
        proc: function() { THIS.reg.setA( THIS.readIoPort(THIS.fetch()) ); },
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
        proc: function() { THIS.reg.setB( THIS.readIoPort(THIS.reg.getC()) ); },
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
        proc: function() { THIS.reg.setC( THIS.readIoPort(THIS.reg.getC()) ); },
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
        proc: function() { THIS.reg.setD( THIS.readIoPort(THIS.reg.getC()) ); },
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
        proc: function() { THIS.reg.setE( THIS.readIoPort(THIS.reg.getC()) ); },
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
        proc: function() { THIS.reg.setH( THIS.readIoPort(THIS.reg.getC()) ); },
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
        proc: function() { THIS.reg.setL( THIS.readIoPort(THIS.reg.getC()) ); },
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
        proc: function() { THIS.reg.setA( THIS.readIoPort(THIS.reg.getC()) ); },
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
            THIS.reg.setB( (THIS.reg.getB() - 1) & 0xff );
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.getC()));
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
            THIS.reg.setB( (THIS.reg.getB() - 1) & 0xff );
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.getC()));
            THIS.postINI();
            if(THIS.reg.getB() != 0) {
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
            THIS.reg.setB( (THIS.reg.getB() - 1) & 0xff );
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.getC()));
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
            THIS.reg.setB( (THIS.reg.getB() - 1) & 0xff );
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.getC()));
            THIS.postIND();
            if(THIS.reg.getB() != 0) {
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
        proc: function() { THIS.writeIoPort(THIS.fetch(), THIS.reg.getA()); },
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
        proc: function() { THIS.writeIoPort(THIS.reg.getC(), THIS.reg.getB()); },
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
        proc: function() { THIS.writeIoPort(THIS.reg.getC(), THIS.reg.getC()); },
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
        proc: function() { THIS.writeIoPort(THIS.reg.getC(), THIS.reg.getD()); },
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
        proc: function() { THIS.writeIoPort(THIS.reg.getC(), THIS.reg.getE()); },
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
        proc: function() { THIS.writeIoPort(THIS.reg.getC(), THIS.reg.getH()); },
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
        proc: function() { THIS.writeIoPort(THIS.reg.getC(), THIS.reg.getL()); },
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
        proc: function() { THIS.writeIoPort(THIS.reg.getC(), THIS.reg.getA()); },
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
            THIS.reg.setB( (THIS.reg.getB() - 1) & 0xff );
            THIS.writeIoPort(THIS.reg.getC(), THIS.memory.peek(THIS.reg.getHL()));
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
            THIS.reg.setB( (THIS.reg.getB() - 1) & 0xff );
            THIS.writeIoPort(THIS.reg.getC(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.postOUTI();
            if(THIS.reg.getB() != 0) {
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
            THIS.reg.setB( (THIS.reg.getB() - 1) & 0xff );
            THIS.writeIoPort(THIS.reg.getC(), THIS.memory.peek(THIS.reg.getHL()));
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
            THIS.reg.setB( (THIS.reg.getB() - 1) & 0xff );
            THIS.writeIoPort(THIS.reg.getC(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.postOUTD();
            if(THIS.reg.getB() != 0) {
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