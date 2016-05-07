Z80 = function(opt) {
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
    for(var i = 0; i < 256; i++) { this.ioPort[i] = 0; };
	this.reg = new Z80_Register();
	this.regB = new Z80_Register();
    this.onReadIoPort = function(port) {};
    this.onReadIoPort = opt.onReadIoPort || function(port, value) {};
    this.onWriteIoPort = opt.onWriteIoPort || function(port, value) {};
    this.bpmap = new Array(0x10000);
}
Z80.getSignedByte = function(e) {
    e &= 0xff;
    if(e & 0x80) {
        e = ((~e) & 0xff) + 1;
        return -e;
    }
    return e;
}
Z80.pair = function(h,l) { return (0xff & h) * 256 + (0xff & l); };
Z80.hibyte = function(nn) { return (0xff & Math.floor(nn / 256)); };
Z80.lobyte = function(nn) { return nn % 256; };
Z80.prototype.readIoPort = function(port) {
    var value = this.ioPort[port];
    this.reg.onReadIoPort(value);
    this.onReadIoPort(port, value);
    return value;
}
Z80.prototype.writeIoPort = function(port, value) {
    this.ioPort[port] = value;
    this.onWriteIoPort(port, value);
}
Z80.prototype.reset = function() {
    this.IFF1 = 0;
    this.IFF2 = 0;
    this.IM = 0;
    this.HALT = 0;
    this.reg.clear();
    this.regB.clear();
    this.exec = Z80.prototype.exec;
};
Z80.prototype.interrupt = function() {
    if(this.IFF1) {
        //this.IFF1 = 0;
        this.pushPair(this.reg.PC);
        this.reg.PC = 0x0038;
    }
}
Z80.prototype.exec = function() {
    this.reg.R = (this.reg.R + 1) & 255;
    this.opecodeTable[this.fetch()].proc();
    if(this.bpmap[this.reg.PC] != null) {
        console.log("*** BREAK AT $" + this.reg.PC.HEX(4));
        throw "break";
    }
}

Z80.prototype.clearBreakPoints = function() {
    this.bpmap = new Array(0x10000);
};
Z80.prototype.getBreakPoints = function() {
    return this.bpmap;
};
Z80.prototype.removeBreak = function(address, size) {
    for(var i = 0; i < size; i++) {
        this.bpmap[address + i] = null; 
    }
}
Z80.prototype.setBreak = function(address, size) {
    for(var i = 0; i < size; i++) {
        this.bpmap[address + i] = true; 
    }
}

Z80.prototype.fetch = function() {
	var value = this.memory.peek(this.reg.PC);
	this.reg.PC++;
	if(this.reg.PC > 0xffff) {
		this.reg.PC = 0;
	};
    return value;
}

Z80.prototype.fetchPair = function() {
	var value = this.memory.peekPair(this.reg.PC);
	this.reg.PC += 2;
	if(this.reg.PC > 0xffff) {
		this.reg.PC -= 0xffff;
	};
    return value;
}

Z80.prototype.pushPair = function(nn) {
	this.memory.poke(--this.reg.SP, Z80.hibyte(nn));
	this.memory.poke(--this.reg.SP, Z80.lobyte(nn));
}
Z80.prototype.popPair = function(nn) {
	var lo = this.memory.peek(this.reg.SP++);
	var hi = this.memory.peek(this.reg.SP++);
    return Z80.pair(hi, lo);
}

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
    dasmlist.push({ code:[], mnemonic:["ORG", memory_block.startAddr.HEX(4) + "H"] });
    while(cpu.reg.PC < memory_block.startAddr + memory_block.size) {
        var dis = cpu.disassemble(cpu.reg.PC, addr - offset + size);
        dis.addr = cpu.reg.PC;
        dis.refs = 0;
        dasmlist.push( dis );
        cpu.reg.PC += dis.code.length;
    }
    return dasmlist;
}
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
        } else if((disasm = opecodeEntry.disasm(this.memory, addr)) == null) {
            errmsg = "NULL RETURNED";
        } else if(addr + disasm.code.length > last_addr) {
            disasm = null;
        }
    } catch(e) {
        errmsg = "EXCEPTION THROWN";
    }
    if(disasm == null) {
        disasm = {
            code:[opecode],
            mnemonic:["DEFB", opecode.HEX(2) + "H; *** UNKNOWN OPCODE: " + errmsg]
        }
    }
    return disasm;
}
Z80.processAddressReference = function(dasmlist) {
    var addr2dis = {};
    for(var i = 0; i < dasmlist.length; i++) {
        var dis = dasmlist[i];
        addr2dis[dis.addr] = i;
    }
    for(var i = 0; i < dasmlist.length; i++) {
        var dis = dasmlist[i];
        if("ref_addr" in dis) {
            if(dis.ref_addr in addr2dis) {
                var j = addr2dis[dis.ref_addr];
                dasmlist[j].refs++;
            }
        }
    }
    return dasmlist;
}
Z80.dasmlines = function(dasmlist) {
    var dasmlines = [];
    for(var j = 0; j < dasmlist.length; j++) {
        var dis = dasmlist[j];
        var addr;
        if(dis.refs > 0) {
            addr = "$" + dis.addr.HEX(4) + "H:";
        } else {
            addr = "       ";
        }
        addr += "   ";

        var mne = dis.mnemonic[0];
        if(dis.mnemonic.length > 1) {
            while(mne.length < 8) {
                mne += " ";
            }
        }
        var operands = "";
        for(var i = 1; i < dis.mnemonic.length; i++) {
            var operand = dis.mnemonic[i];
            operands += operand;
            if(i < dis.mnemonic.length - 1) {
                operands += ",";
            }
        }
        var line = addr + '      ' + mne + operands;
        while(line.length < 40) {
            line += ' ';
        }

        var codes = [];
        for(var i = 0; i < dis.code.length; i++) {
            codes.push(dis.code[i].HEX(2));
        }
        if(codes.length > 0) {
            line += '; ' + dis.addr.HEX(4) + "H " + codes.join(' ');
        }
        dasmlines.push(line);
    }
    return dasmlines;
}

/**
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
            disasm: (function(i) { return function(mem, addr) {
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
            disasm: (function(i) { return function(mem, addr) {
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
            disasm: (function(i) { return function(mem, addr) {
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
            disasm: (function(i) { return function(mem, addr) {
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
            disasm: (function(i) { return function(mem, addr) {
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
            disasm: (function(i) { return function(mem, addr) {
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
            disasm: (function(i) { return function(mem, addr) {
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
	for(var dstRegId in Z80_Register.REG_r_ID2NAME) {
		dstRegName = Z80_Register.REG_r_ID2NAME[dstRegId];
		for(var srcRegId in Z80_Register.REG_r_ID2NAME) {
			srcRegName = Z80_Register.REG_r_ID2NAME[srcRegId];
			var opecode = (0x01 << 6) | (dstRegId << 3) | srcRegId;
			this.opecodeTable[opecode] = {
					mnemonic:"LD " + dstRegName + "," + srcRegName,
					proc:
						function (opecode, dstRegName, srcRegName) {
							return function() {
                                THIS.reg[dstRegName] = THIS.reg[srcRegName];
							}
						}(opecode, dstRegName, srcRegName),
                    disasm:
						function (opecode, dstRegName, srcRegName) {
                            return function(mem, addr) {
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
    this.opecodeTable[0006] = { mnemonic:"LD B,n", proc: function() { THIS.reg.B = THIS.fetch(); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0016] = { mnemonic:"LD C,n", proc: function() { THIS.reg.C = THIS.fetch(); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0026] = { mnemonic:"LD D,n", proc: function() { THIS.reg.D = THIS.fetch(); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0036] = { mnemonic:"LD E,n", proc: function() { THIS.reg.E = THIS.fetch(); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0046] = { mnemonic:"LD H,n", proc: function() { THIS.reg.H = THIS.fetch(); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0056] = { mnemonic:"LD L,n", proc: function() { THIS.reg.L = THIS.fetch(); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0076] = { mnemonic:"LD A,n", proc: function() { THIS.reg.A = THIS.fetch(); }, disasm: disa_0x_r_110 };
	//---------------------------------------------------------------------------------
	// LD r,(HL)	r<-(HL)					01  r  110
	//---------------------------------------------------------------------------------
    this.opecodeTable[0106] = { mnemonic:"LD B,(HL)", proc: function() { THIS.reg.B = THIS.memory.peek(THIS.reg.getHL()); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0116] = { mnemonic:"LD C,(HL)", proc: function() { THIS.reg.C = THIS.memory.peek(THIS.reg.getHL()); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0126] = { mnemonic:"LD D,(HL)", proc: function() { THIS.reg.D = THIS.memory.peek(THIS.reg.getHL()); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0136] = { mnemonic:"LD E,(HL)", proc: function() { THIS.reg.E = THIS.memory.peek(THIS.reg.getHL()); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0146] = { mnemonic:"LD H,(HL)", proc: function() { THIS.reg.H = THIS.memory.peek(THIS.reg.getHL()); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0156] = { mnemonic:"LD L,(HL)", proc: function() { THIS.reg.L = THIS.memory.peek(THIS.reg.getHL()); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0176] = { mnemonic:"LD A,(HL)", proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.getHL()); }, disasm: disa_0x_r_110 };
	//---------------------------------------------------------------------------------
	// LD (HL),r	(HL)<-r					01 110  r 
	//---------------------------------------------------------------------------------
    this.opecodeTable[0160] = { mnemonic:"LD (HL),B", proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.B); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0161] = { mnemonic:"LD (HL),C", proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.C); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0162] = { mnemonic:"LD (HL),D", proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.D); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0163] = { mnemonic:"LD (HL),E", proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.E); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0164] = { mnemonic:"LD (HL),H", proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.H); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0165] = { mnemonic:"LD (HL),L", proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.L); }, disasm: disa_0x_r_110 };
    this.opecodeTable[0167] = { mnemonic:"LD (HL),A", proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.reg.A); }, disasm: disa_0x_r_110 };
	//---------------------------------------------------------------------------------
	// LD (HL),n	(HL)<-n					00 110 110	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[0066] = { mnemonic:"LD (HL),n",
        proc: function() { THIS.memory.poke(THIS.reg.getHL(), THIS.fetch()); }, disasm: disa_0x_r_110 };
	//---------------------------------------------------------------------------------
	// LD A,(BC)	A<-(BC)					00 001 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[0012] = { mnemonic:"LD A,(BC)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.getBC()); },
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "A", "(BC)"]};}  };
	//---------------------------------------------------------------------------------
	// LD A,(DE)	A<-(DE)					00 011 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[0032] = { mnemonic:"LD A,(DE)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.getDE()); },
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "A", "(DE)"]};} };
	//---------------------------------------------------------------------------------
	// LD A,(nn)	A<-(nn)					00 111 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[0072] = { mnemonic:"LD A,(nn)",
        proc: function() { THIS.reg.A = THIS.memory.peek(THIS.fetchPair()); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2)],
                mnemonic: ["LD", "A","(" + mem.peekPair(addr+1).HEX(4) + "H)"]};
        }
    };
	//--------------------------------------------------------------------------------
	// LD (BC),A	(BC)<-A					00 000 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[0002] = { mnemonic:"LD (BC),A",
        proc: function() { THIS.memory.poke(THIS.reg.getBC(), THIS.reg.A); },
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "(BC)","A"]};} };
	//---------------------------------------------------------------------------------
	// LD (DE),A	(DE)<-A					00 010 010
	//---------------------------------------------------------------------------------
	this.opecodeTable[0022] = { mnemonic:"LD (DE),A",
        proc: function() { THIS.memory.poke(THIS.reg.getDE(), THIS.reg.A); },
        disasm: function(mem,addr) {return {code:[mem.peek(addr)], mnemonic: ["LD", "(DE)","A"]};} };
	//---------------------------------------------------------------------------------
	// LD (nn),A	(nn)<-A					00 110 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[0062] = { mnemonic:"LD (nn),A",
        proc: function() { THIS.memory.poke(THIS.fetchPair(), THIS.reg.A); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2)],
                mnemonic: ["LD", "(" + mem.peekPair(addr+1).HEX(4) + "H)","A"]};
        }
    };
	
    //---------------------------------------------------------------------------------
    // LD A,I		A<-I					11 101 101	01 010 111          S,Z,H=0,P/V=IFF,N=0
    //---------------------------------------------------------------------------------
	opeMisc[0127] = { mnemonic:"LD A,I", proc: function() {
        THIS.reg.LD_A_I(THIS.IFF2);
    }, disasm: function(mem,addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic: ["LD", "A","I"]}; } };
    //---------------------------------------------------------------------------------
    // LD A,R		A<-R					11 101 101	01 011 111          S,Z,H=0,P/V=IFF,N=0
    //---------------------------------------------------------------------------------
	opeMisc[0137] = { mnemonic:"LD A,R", proc: function() {
        THIS.reg.LD_A_R(THIS.IFF2, THIS.regB.R);
    }, disasm: function(mem,addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic: ["LD", "A","R"]}; } };
    //---------------------------------------------------------------------------------
    // LD I,A		I<-A					11 101 101	01 000 111
    //---------------------------------------------------------------------------------
	opeMisc[0107] = { mnemonic:"LD I,A", proc: function() { THIS.reg.I = THIS.reg.A; },
    disasm: function(mem,addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic: ["LD", "I","A"]}; } };
    //---------------------------------------------------------------------------------
    // LD R,A		R<-A					11 101 101	01 001 111
    //---------------------------------------------------------------------------------
	opeMisc[0117] = { mnemonic:"LD R,A", proc: function() { THIS.reg.R = THIS.regB.R = THIS.reg.A; },
    disasm: function(mem,addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic: ["LD", "R","A"]}; } };

    opeIX[0106] = { mnemonic:"LD B,(IX+d)", proc: function() { THIS.reg.B = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); }};
    opeIX[0116] = { mnemonic:"LD C,(IX+d)", proc: function() { THIS.reg.C = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); }};
    opeIX[0126] = { mnemonic:"LD D,(IX+d)", proc: function() { THIS.reg.D = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); }};
    opeIX[0136] = { mnemonic:"LD E,(IX+d)", proc: function() { THIS.reg.E = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); }};
    opeIX[0146] = { mnemonic:"LD H,(IX+d)", proc: function() { THIS.reg.H = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); }};
    opeIX[0156] = { mnemonic:"LD L,(IX+d)", proc: function() { THIS.reg.L = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); }};
    opeIX[0176] = { mnemonic:"LD A,(IX+d)", proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.IX + THIS.fetch()); }};
    
    opeIX[0160] = { mnemonic:"LD (IX+d),B", proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.B); }};
    opeIX[0161] = { mnemonic:"LD (IX+d),C", proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.C); }};
    opeIX[0162] = { mnemonic:"LD (IX+d),D", proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.D); }};
    opeIX[0163] = { mnemonic:"LD (IX+d),E", proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.E); }};
    opeIX[0164] = { mnemonic:"LD (IX+d),H", proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.H); }};
    opeIX[0165] = { mnemonic:"LD (IX+d),L", proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.L); }};
    opeIX[0167] = { mnemonic:"LD (IX+d),A", proc: function() { THIS.memory.poke(THIS.reg.IX + THIS.fetch(), THIS.reg.A); }};

    opeIY[0106] = { mnemonic:"LD B,(IY+d)", proc: function() { THIS.reg.B = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); }};
    opeIY[0116] = { mnemonic:"LD C,(IY+d)", proc: function() { THIS.reg.C = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); }};
    opeIY[0126] = { mnemonic:"LD D,(IY+d)", proc: function() { THIS.reg.D = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); }};
    opeIY[0136] = { mnemonic:"LD E,(IY+d)", proc: function() { THIS.reg.E = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); }};
    opeIY[0146] = { mnemonic:"LD H,(IY+d)", proc: function() { THIS.reg.H = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); }};
    opeIY[0156] = { mnemonic:"LD L,(IY+d)", proc: function() { THIS.reg.L = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); }};
    opeIY[0176] = { mnemonic:"LD A,(IY+d)", proc: function() { THIS.reg.A = THIS.memory.peek(THIS.reg.IY + THIS.fetch()); }};

    opeIY[0160] = { mnemonic:"LD (IY+d),B", proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.B); }};
    opeIY[0161] = { mnemonic:"LD (IY+d),C", proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.C); }};
    opeIY[0162] = { mnemonic:"LD (IY+d),D", proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.D); }};
    opeIY[0163] = { mnemonic:"LD (IY+d),E", proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.E); }};
    opeIY[0164] = { mnemonic:"LD (IY+d),H", proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.H); }};
    opeIY[0165] = { mnemonic:"LD (IY+d),L", proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.L); }};
    opeIY[0167] = { mnemonic:"LD (IY+d),A", proc: function() { THIS.memory.poke(THIS.reg.IY + THIS.fetch(), THIS.reg.A); }};
	//=================================================================================
	//
	// 16bit load group
	//
	//=================================================================================
	
	//---------------------------------------------------------------------------------
	// LD dd,nn		dd<-nn					00 dd0 001	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
    disasm_LD_dd_nn = function(mem,addr) {
        var opcode = mem.peek(addr);
        var nnL = mem.peek(addr+1);
        var nnH = mem.peek(addr+2);
        var nn = Z80.pair(nnH,nnL);
        var dd = ((opcode >> 4) & 0x03);
        switch(dd) {
            case 0: dd = "BC"; break;
            case 1: dd = "DE"; break;
            case 2: dd = "HL"; break;
            case 3: dd = "SP"; break;
            default: throw "*** LD dd,nn; but unknown dd."; break;
        }
        return {
            code:[opcode,nnL,nnH],
            mnemonic: ["LD", dd, nn.HEX(4) + "H" ]};
    };
    this.opecodeTable[0001] = { mnemonic:"LD BC,nn", proc: function() { THIS.reg.C = THIS.fetch(); THIS.reg.B = THIS.fetch(); }, disasm: disasm_LD_dd_nn };
    this.opecodeTable[0021] = { mnemonic:"LD DE,nn", proc: function() { THIS.reg.E = THIS.fetch(); THIS.reg.D = THIS.fetch(); }, disasm: disasm_LD_dd_nn };
    this.opecodeTable[0041] = { mnemonic:"LD HL,nn", proc: function() { THIS.reg.L = THIS.fetch(); THIS.reg.H = THIS.fetch(); }, disasm: disasm_LD_dd_nn };
    this.opecodeTable[0061] = { mnemonic:"LD SP,nn", proc: function() { THIS.reg.SP = THIS.fetchPair(); }, disasm: disasm_LD_dd_nn };
	
	//---------------------------------------------------------------------------------
	// LD HL,(nn)	H<-(nn+1),L<-(nn)		00 101 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[0052] = {
			mnemonic:"LD HL,(nn)",
			proc: function() {
                var nn = THIS.fetchPair();
                THIS.reg.L = THIS.memory.peek(nn + 0);
                THIS.reg.H = THIS.memory.peek(nn + 1);
            },
            disasm: function(mem, addr) {
                var opcode = mem.peek(addr);
                var nnL = mem.peek(addr+1);
                var nnH = mem.peek(addr+2);
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,nnL,nnH],
                    mnemonic: ["LD", "HL","(" + nn.HEX(4) + "H)" ]};
            }
	};
    opeMisc[0113] = {
			mnemonic:"LD BC,(nn)",
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
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD", "BC","(" + nn.HEX(4) + "H)" ]};
            }
	};
    opeMisc[0133] = {
			mnemonic:"LD DE,(nn)",
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
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD", "DE","(" + nn.HEX(4) + "H)" ]};
            }
	};
    opeMisc[0153] = {
			mnemonic:"LD HL,(nn)",
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
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD", "HL","(" + nn.HEX(4) + "H)" ]};
            }
	};
    opeMisc[0173] = {
			mnemonic:"LD SP,(nn)",
			proc: function() {
                THIS.reg.SP = THIS.fetchPair();
            },
            disasm: function(mem, addr) {
                var opcode = mem.peek(addr);
                var operand = mem.peek(addr+1);
                var nnL = mem.peek(addr+2);
                var nnH = mem.peek(addr+3);
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD", "SP","(" + nn.HEX(4) + "H)" ]};
            }
	};

	//---------------------------------------------------------------------------------
	// LD (nn),HL	(nn+1)<-H,(nn)<-L		00 100 010	<-  n   ->	<-  n   ->
	//---------------------------------------------------------------------------------
	this.opecodeTable[0042] = {
        mnemonic:"LD (nn), HL", proc: function() {
            var nn = THIS.fetchPair();
            THIS.memory.poke(nn + 0, THIS.reg.L); 
            THIS.memory.poke(nn + 1, THIS.reg.H);
        },
        disasm: function(mem, addr) {
            var opcode = mem.peek(addr);
            var nnL = mem.peek(addr+1);
            var nnH = mem.peek(addr+2);
            var nn = Z80.pair(nnH,nnL);
            return {
                code:[opcode,nnL,nnH],
                mnemonic: ["LD", "(" + nn.HEX(4) + "H)","HL" ]};
        }
	}
    opeMisc[0103] = {
			mnemonic:"LD (nn),BC",
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
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD","(" + nn.HEX(4) + "H)", "BC" ]};
            }
	};
    opeMisc[0123] = {
			mnemonic:"LD (nn),DE",
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
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD","(" + nn.HEX(4) + "H)", "DE" ]};
            }
	};
    opeMisc[0143] = {
			mnemonic:"LD (nn),HL",
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
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD","(" + nn.HEX(4) + "H)", "HL" ]};
            }
	};
    opeMisc[0163] = {
			mnemonic:"LD (nn),SP",
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
                var nn = Z80.pair(nnH,nnL);
                return {
                    code:[opcode,operand,nnL,nnH],
                    mnemonic: ["LD","(" + nn.HEX(4) + "H)", "SP" ]};
            }
	};
	//---------------------------------------------------------------------------------
	// LD SP,HL		SP<-HL					11 111 001
	//---------------------------------------------------------------------------------
	this.opecodeTable[0371] = { mnemonic:"LD SP,HL", proc: function() { THIS.reg.SP = THIS.reg.getHL(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["LD", "SP","HL" ]}; }
    };
	//---------------------------------------------------------------------------------
	// PUSH qq		(SP-2)<-qqL,(SP-1)<-qqH	11 qq0 101
	//---------------------------------------------------------------------------------
    this.opecodeTable[0xc0 + (0 << 4) + 0x05] = {
        mnemonic:"PUSH BC", proc: function() {
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.B);
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["PUSH", "BC" ]}; }
    };
    this.opecodeTable[0xc0 + (1 << 4) + 0x05] = {
        mnemonic:"PUSH DE", proc: function() {
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.D);
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["PUSH", "DE" ]}; }
    };
    this.opecodeTable[0xc0 + (2 << 4) + 0x05] = {
        mnemonic:"PUSH HL", proc: function() {
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.H);
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["PUSH", "HL" ]}; }
    };
    this.opecodeTable[0xc0 + (3 << 4) + 0x05] = {
        mnemonic:"PUSH AF", proc: function() {
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.A);
            THIS.memory.poke(--THIS.reg.SP, THIS.reg.F); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["PUSH", "AF" ]}; }
    };
	//---------------------------------------------------------------------------------
	// POP qq		qqL<-(SP),qqH<-(SP+1)	11 qq0 001
	//---------------------------------------------------------------------------------
    this.opecodeTable[0xc0 + (0 << 4) + 0x01] = {
        mnemonic:"POP BC", proc: function() {
            THIS.reg.C = THIS.memory.peek(THIS.reg.SP++);
            THIS.reg.B = THIS.memory.peek(THIS.reg.SP++); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["POP", "BC" ]}; }
    };
    this.opecodeTable[0xc0 + (1 << 4) + 0x01] = {
        mnemonic:"POP DE", proc: function() {
            THIS.reg.E = THIS.memory.peek(THIS.reg.SP++);
            THIS.reg.D = THIS.memory.peek(THIS.reg.SP++); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["POP", "DE" ]}; }
    };
    this.opecodeTable[0xc0 + (2 << 4) + 0x01] = {
        mnemonic:"POP HL", proc: function() {
            THIS.reg.L = THIS.memory.peek(THIS.reg.SP++);
            THIS.reg.H = THIS.memory.peek(THIS.reg.SP++); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["POP", "HL" ]}; }
    };
    this.opecodeTable[0xc0 + (3 << 4) + 0x01] = {
        mnemonic:"POP AF", proc: function() {
            THIS.reg.F = THIS.memory.peek(THIS.reg.SP++);
            THIS.reg.A = THIS.memory.peek(THIS.reg.SP++); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["POP", "AF" ]}; }
    };

    opeIX[0x21] = { mnemonic:"LD IX,nn",
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
    opeIX[0x2A] = { mnemonic:"LD IX,(nn)",
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
    opeIX[0x36] = { mnemonic:"LD (IX+d),n",
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
    opeIX[0xF9] = { mnemonic:"LD SP,IX",
        proc: function() {
            THIS.reg.SP = THIS.reg.IX;
        },
        disasm: function(mem, addr) {
            return { "code" : [ 0xDD, 0xF9 ], "mnemonic" : [ "LD", "SP", "IX" ] };
        }
    };
    opeIX[0xE5] = { mnemonic:"PUSH IX",
        proc: function() {
            THIS.memory.poke(--THIS.reg.SP, Z80.hibyte(THIS.reg.IX));
            THIS.memory.poke(--THIS.reg.SP, Z80.lobyte(THIS.reg.IX));
        },
        disasm: function(mem, addr) {
            return { "code" : [ 0xDD, 0xE5 ], "mnemonic" : [ "PUSH", "IX" ] };
        }
    };
    opeIX[0xE1] = { mnemonic:"POP IX",
        proc: function() {
            THIS.reg.IX = THIS.memory.peekPair(THIS.reg.SP);
            THIS.reg.SP += 2;
        },
        disasm: function(mem, addr) {
            return { "code" : [ 0xDD, 0xE1 ], "mnemonic" : [ "POP", "IX" ] };
        }
    };
    opeIX[0xE3] = { mnemonic:"EX (SP),IX",
        proc: function () {
            var tmpH = THIS.memory.peek(THIS.reg.SP + 1);
            THIS.memory.poke(THIS.reg.SP + 1, Z80.hibyte(THIS.reg.IX));
            var tmpL = THIS.memory.peek(THIS.reg.SP);
            THIS.memory.poke(THIS.reg.SP, Z80.lobyte(THIS.reg.IX));
            THIS.reg.IX = Z80.pair(tmpH, tmpL);
        },
        disasm: function(mem, addr) {
            return { "code" : [ 0xDD, 0xE3 ], "mnemonic" : [ "EX", "(SP)", "IX" ] };
        }
    };

    opeIY[0x21] = { mnemonic:"LD IY,nn",
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
    opeIY[0x2A] = { mnemonic:"LD IY,(nn)",
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
    opeIY[0x36] = { mnemonic:"LD (IY+d),n",
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
    opeIY[0xF9] = { mnemonic:"LD SP,IY",
        proc: function() {
            THIS.reg.SP = THIS.reg.IY;
        },
        disasm: function(mem, addr) {
            return { "code" : [ 0xFD, 0xF9 ], "mnemonic" : [ "LD", "SP", "IY" ] };
        }
    };
    opeIY[0xE5] = { mnemonic:"PUSH IY",
        proc: function() {
            THIS.memory.poke(--THIS.reg.SP, Z80.hibyte(THIS.reg.IY));
            THIS.memory.poke(--THIS.reg.SP, Z80.lobyte(THIS.reg.IY));
        },
        disasm: function(mem, addr) {
            return { "code" : [ 0xFD, 0xE5 ], "mnemonic" : [ "PUSH", "IY" ] };
        }
    };
    opeIY[0xE1] = { mnemonic:"POP IY",
        proc: function() {
            THIS.reg.IY = THIS.memory.peekPair(THIS.reg.SP);
            THIS.reg.SP += 2;
        },
        disasm: function(mem, addr) {
            return { "code" : [ 0xFD, 0xE1 ], "mnemonic" : [ "POP", "IY" ] };
        }
    };
    opeIY[0xE3] = { mnemonic:"EX (SP),IY",
        proc: function () {
            var tmpH = THIS.memory.peek(THIS.reg.SP + 1);
            THIS.memory.poke(THIS.reg.SP + 1, (THIS.reg.IY >> 8) & 0xff);
            var tmpL = THIS.memory.peek(THIS.reg.SP);
            THIS.memory.poke(THIS.reg.SP, (THIS.reg.IY >> 0) & 0xff);
            THIS.reg.IY = (tmpH << 8) + tmpL;
        },
        disasm: function(mem, addr) {
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
            proc: function () {
                var tmp = THIS.reg.D;
                THIS.reg.D = THIS.reg.H;
                THIS.reg.H = tmp;
                tmp = THIS.reg.E;
                THIS.reg.E = THIS.reg.L;
                THIS.reg.L = tmp;
            },
            disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["EX", "DE","HL" ]}; }
    };
    //---------------------------------------------------------------------------------
    // EX AF,AF'
    //---------------------------------------------------------------------------------
    this.opecodeTable[0x08] = {
            mnemonic:"EX AF,AF'",
            proc: function () {
                var tmp = THIS.reg.A;
                THIS.reg.A = THIS.regB.A;
                THIS.regB.A = tmp;
                tmp = THIS.reg.F;
                THIS.reg.F = THIS.regB.F;
                THIS.regB.F = tmp;
            },
            disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["EX", "AF","AF'" ]}; }
    };
    //---------------------------------------------------------------------------------
    // EXX
    //---------------------------------------------------------------------------------
    this.opecodeTable[0xD9] = {
            mnemonic:"EXX",
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
            disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["EXX"]}; }
    };
    //---------------------------------------------------------------------------------
    //  EX (SP),HL
    //---------------------------------------------------------------------------------
    this.opecodeTable[0xE3] = {
            mnemonic:"EX (SP),HL",
            proc: function () {
                var tmp = THIS.memory.peek(THIS.reg.SP + 1);
                THIS.memory.poke(THIS.reg.SP + 1, THIS.reg.H);
                THIS.reg.H = tmp;

                tmp = THIS.memory.peek(THIS.reg.SP);
                THIS.memory.poke(THIS.reg.SP, THIS.reg.L);
                THIS.reg.L = tmp;
            },
            disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["EX", "(SP)","HL"]}; }
    };
    //---------------------------------------------------------------------------------
    // LDI                  (DE) <- (HL)        11 101 101
    //                      DE <- DE + 1        10 100 000
    //                      HL <- HL + 1
    //                      BC <- BC - 1
    //---------------------------------------------------------------------------------
	opeMisc[0240] = { mnemonic:"LDI", proc: function() {
            THIS.memory.poke(THIS.reg.getDE(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.reg.onLDI();
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["LDI"]}; }
    };
    //---------------------------------------------------------------------------------
    // LDIR                 (DE) <- (HL)        11 101 101
    //                      DE <- DE + 1        10 110 000
    //                      HL <- HL + 1
    //                      BC <- BC - 1
    //                      BC=0まで繰り返す
    //---------------------------------------------------------------------------------
	opeMisc[0260] = { mnemonic:"LDIR", proc: function() {
            THIS.memory.poke(THIS.reg.getDE(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.reg.onLDI();
            if(THIS.reg.getBC() != 0) {
                THIS.reg.PC -= 2;
            }
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["LDIR"]}; }
    };
    //---------------------------------------------------------------------------------
    // LDD                  (DE) <- (HL)        11 101 101
    //                      DE <- DE - 1        10 101 000
    //                      HL <- HL - 1
    //                      BC <- BC - 1
    //---------------------------------------------------------------------------------
	opeMisc[0250] = { mnemonic:"LDD", proc: function() {
            THIS.memory.poke(THIS.reg.getDE(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.reg.onLDD();
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["LDD"]}; }
    };
    //---------------------------------------------------------------------------------
    // LDDR                 (DE) <- (HL)        11 101 101
    //                      DE <- DE - 1        10 111 000
    //                      HL <- HL - 1
    //                      BC <- BC - 1
    //                      BC=0まで繰り返す
    //---------------------------------------------------------------------------------
	opeMisc[0270] = { mnemonic:"LDDR", proc: function() {
            THIS.memory.poke(THIS.reg.getDE(), THIS.memory.peek(THIS.reg.getHL()));
            THIS.reg.onLDD();
            if(THIS.reg.getBC() != 0) {
                THIS.reg.PC -= 2;
            }
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["LDDR"]}; }
    };
    //---------------------------------------------------------------------------------
    // CPI                  A-(HL)              11 101 101
    //                      HL <- HL + 1        10 100 001
    //                      BC <- BC - 1
    //---------------------------------------------------------------------------------
	opeMisc[0241] = { mnemonic:"CPI", proc: function() {
            THIS.reg.CPI(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["CPI"]}; }
    };
    //---------------------------------------------------------------------------------
    // CPIR                 A-(HL)              11 101 101
    //                      HL <- HL + 1        10 110 001
    //                      BC <- BC - 1
    //                      BC=0まで繰り返す
    //---------------------------------------------------------------------------------
	opeMisc[0261] = { mnemonic:"CPIR", proc: function() {
            THIS.reg.CPI(THIS.memory.peek(THIS.reg.getHL()));
            if(THIS.reg.getBC() != 0 && !THIS.reg.flagZ()) {
                THIS.reg.PC -= 2;
            }
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["CPIR"]}; }
    };
    //---------------------------------------------------------------------------------
    // CPD                  A-(HL)              11 101 101
    //                      HL <- HL - 1        10 101 001
    //                      BC <- BC - 1
    //---------------------------------------------------------------------------------
	opeMisc[0251] = { mnemonic:"CPD", proc: function() {
            THIS.reg.CPD(THIS.memory.peek(THIS.reg.getHL()));
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["CPD"]}; }
    };
    //---------------------------------------------------------------------------------
    // CPDR                 A-(HL)              11 101 101
    //                      HL <- HL - 1        10 111 001
    //                      BC <- BC - 1
    //                      BC=0まで繰り返す
    //---------------------------------------------------------------------------------
	opeMisc[0271] = { mnemonic:"CPDR", proc: function() {
            THIS.reg.CPD(THIS.memory.peek(THIS.reg.getHL()));
            if(THIS.reg.getBC() != 0 && !THIS.reg.flagZ()) {
                THIS.reg.PC -= 2;
            }
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["CPDR"]}; }
    };

    //=================================================================================
    // 8ビット演算・論理グループ
    //=================================================================================

    //---------------------------------------------------------------------------------
    // ADD A,r      A <- A + r          10[000]<r>
    //---------------------------------------------------------------------------------
    this.opecodeTable[0200] = { mnemonic:"ADD A,B", proc: function() { THIS.reg.addAcc(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "A","B"]}; } };
    this.opecodeTable[0201] = { mnemonic:"ADD A,C", proc: function() { THIS.reg.addAcc(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "A","C"]}; } };
    this.opecodeTable[0202] = { mnemonic:"ADD A,D", proc: function() { THIS.reg.addAcc(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "A","D"]}; } };
    this.opecodeTable[0203] = { mnemonic:"ADD A,E", proc: function() { THIS.reg.addAcc(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "A","E"]}; } };
    this.opecodeTable[0204] = { mnemonic:"ADD A,H", proc: function() { THIS.reg.addAcc(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "A","H"]}; } };
    this.opecodeTable[0205] = { mnemonic:"ADD A,L", proc: function() { THIS.reg.addAcc(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "A","L"]}; } };
    this.opecodeTable[0207] = { mnemonic:"ADD A,A", proc: function() { THIS.reg.addAcc(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "A","A"]}; } };
    //---------------------------------------------------------------------------------
    // ADD A,n       A <- A + n         11[000]110
    //                                  <---n---->
    //---------------------------------------------------------------------------------
    this.opecodeTable[0306] = { mnemonic:"ADD A,n", proc: function() { THIS.reg.addAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return { code:[mem.peek(addr),n], mnemonic: ["ADD", "A", n.HEX(2) + "H"]};
        }};
    //---------------------------------------------------------------------------------
    // ADD A,(HL)    A <- A + (HL)      10[000]110
    //---------------------------------------------------------------------------------
    this.opecodeTable[0206] = { mnemonic:"ADD A,(HL)", proc: function() { THIS.reg.addAcc(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "A","(HL)"]}; } };
    //---------------------------------------------------------------------------------
    // ADD A,(IX+d)  A <- A + (IX+d)    11 011 101
    //                                  10[000]110
    //                                  <---d---->
    //---------------------------------------------------------------------------------
    opeIX[0206] = { mnemonic:"ADD A,(IX+d)", proc: function() { THIS.reg.addAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // ADD A,(IY+d)  A <- A + (IY+d)    11 111 101
    //                                  10[000]110
    //                                  <---d---->
    //---------------------------------------------------------------------------------
    opeIY[0206] = { mnemonic:"ADD A,(IY+d)", proc: function() { THIS.reg.addAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // ADC A,s      A <- A + s + CY       [001]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0210] = { mnemonic:"ADC A,B", proc: function() { THIS.reg.addAccWithCarry(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADC", "A", "B"]}; } };
    this.opecodeTable[0211] = { mnemonic:"ADC A,C", proc: function() { THIS.reg.addAccWithCarry(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADC", "A", "C"]}; } };
    this.opecodeTable[0212] = { mnemonic:"ADC A,D", proc: function() { THIS.reg.addAccWithCarry(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADC", "A", "D"]}; } };
    this.opecodeTable[0213] = { mnemonic:"ADC A,E", proc: function() { THIS.reg.addAccWithCarry(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADC", "A", "E"]}; } };
    this.opecodeTable[0214] = { mnemonic:"ADC A,H", proc: function() { THIS.reg.addAccWithCarry(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADC", "A", "H"]}; } };
    this.opecodeTable[0215] = { mnemonic:"ADC A,L", proc: function() { THIS.reg.addAccWithCarry(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADC", "A", "L"]}; } };
    this.opecodeTable[0217] = { mnemonic:"ADC A,A", proc: function() { THIS.reg.addAccWithCarry(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADC", "A", "A"]}; } };
    this.opecodeTable[0316] = { mnemonic:"ADC A,n", proc: function() { THIS.reg.addAccWithCarry(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return { code:[mem.peek(addr),n], mnemonic: ["ADC", "A", n.HEX(2) + "H"]};
        }};
    this.opecodeTable[0216] = { mnemonic:"ADC A,(HL)", proc: function() { THIS.reg.addAccWithCarry(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADC", "A", "(HL)"]}; } };
    opeIX[0216] = { mnemonic:"ADC A,(IX+d)", proc: function() { THIS.reg.addAccWithCarry(THIS.memory.peek(THIS.reg.IX + THIS.fetch())); }};
    opeIY[0216] = { mnemonic:"ADC A,(IY+d)", proc: function() { THIS.reg.addAccWithCarry(THIS.memory.peek(THIS.reg.IY + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // SUB s        A <- A - s            [010]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0220] = { mnemonic:"SUB A,B", proc: function() { THIS.reg.subAcc(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SUB", "A", "B"]}; } };
    this.opecodeTable[0221] = { mnemonic:"SUB A,C", proc: function() { THIS.reg.subAcc(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SUB", "A", "C"]}; } };
    this.opecodeTable[0222] = { mnemonic:"SUB A,D", proc: function() { THIS.reg.subAcc(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SUB", "A", "D"]}; } };
    this.opecodeTable[0223] = { mnemonic:"SUB A,E", proc: function() { THIS.reg.subAcc(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SUB", "A", "E"]}; } };
    this.opecodeTable[0224] = { mnemonic:"SUB A,H", proc: function() { THIS.reg.subAcc(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SUB", "A", "H"]}; } };
    this.opecodeTable[0225] = { mnemonic:"SUB A,L", proc: function() { THIS.reg.subAcc(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SUB", "A", "L"]}; } };
    this.opecodeTable[0227] = { mnemonic:"SUB A,A", proc: function() { THIS.reg.subAcc(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SUB", "A", "A"]}; } };
    this.opecodeTable[0326] = { mnemonic:"SUB A,n", proc: function() { THIS.reg.subAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return { code:[mem.peek(addr),n], mnemonic: ["SUB", "A", n.HEX(2) + "H"]};
        }};
    this.opecodeTable[0226] = { mnemonic:"SUB A,(HL)", proc: function() { THIS.reg.subAcc(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SUB", "A", "(HL)"]}; } };
    opeIX[0226] = { mnemonic:"SUB A,(IX+d)", proc: function() { THIS.reg.subAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch())); }};
    opeIY[0226] = { mnemonic:"SUB A,(IY+d)", proc: function() { THIS.reg.subAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // SBC A,s      A <- A - s - CY       [011]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0230] = { mnemonic:"SBC A,B", proc: function() { THIS.reg.subAccWithCarry(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SBC", "A", "B"]}; } };
    this.opecodeTable[0231] = { mnemonic:"SBC A,C", proc: function() { THIS.reg.subAccWithCarry(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SBC", "A", "C"]}; } };
    this.opecodeTable[0232] = { mnemonic:"SBC A,D", proc: function() { THIS.reg.subAccWithCarry(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SBC", "A", "D"]}; } };
    this.opecodeTable[0233] = { mnemonic:"SBC A,E", proc: function() { THIS.reg.subAccWithCarry(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SBC", "A", "E"]}; } };
    this.opecodeTable[0234] = { mnemonic:"SBC A,H", proc: function() { THIS.reg.subAccWithCarry(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SBC", "A", "H"]}; } };
    this.opecodeTable[0235] = { mnemonic:"SBC A,L", proc: function() { THIS.reg.subAccWithCarry(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SBC", "A", "L"]}; } };
    this.opecodeTable[0237] = { mnemonic:"SBC A,A", proc: function() { THIS.reg.subAccWithCarry(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SBC", "A", "A"]}; } };
    this.opecodeTable[0336] = { mnemonic:"SBC A,n", proc: function() { THIS.reg.subAccWithCarry(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return { code:[mem.peek(addr),n], mnemonic: ["SBC", "A," + n.HEX(2) + "H"]};
        }};
    this.opecodeTable[0236] = { mnemonic:"SBC A,(HL)", proc: function() { THIS.reg.subAccWithCarry(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SBC", "A", "(HL)"]}; } };
    opeIX[0236] = { mnemonic:"SBC A,(IX+d)", proc: function() { THIS.reg.subAccWithCarry(THIS.memory.peek(THIS.reg.IX + THIS.fetch())); }};
    opeIY[0236] = { mnemonic:"SBC A,(IY+d)", proc: function() { THIS.reg.subAccWithCarry(THIS.memory.peek(THIS.reg.IY + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // AND s        A <- A & s            [100]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0240] = { mnemonic:"AND B", proc: function() { THIS.reg.andAcc(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["AND", "B"]}; } };
    this.opecodeTable[0241] = { mnemonic:"AND C", proc: function() { THIS.reg.andAcc(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["AND", "C"]}; } };
    this.opecodeTable[0242] = { mnemonic:"AND D", proc: function() { THIS.reg.andAcc(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["AND", "D"]}; } };
    this.opecodeTable[0243] = { mnemonic:"AND E", proc: function() { THIS.reg.andAcc(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["AND", "E"]}; } };
    this.opecodeTable[0244] = { mnemonic:"AND H", proc: function() { THIS.reg.andAcc(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["AND", "H"]}; } };
    this.opecodeTable[0245] = { mnemonic:"AND L", proc: function() { THIS.reg.andAcc(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["AND", "L"]}; } };
    this.opecodeTable[0247] = { mnemonic:"AND A", proc: function() { THIS.reg.andAcc(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["AND", "A"]}; } };
    this.opecodeTable[0346] = { mnemonic:"AND n", proc: function() { THIS.reg.andAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return { code:[mem.peek(addr),n], mnemonic: ["AND", n.HEX(2) + "H"]};
        }};
    this.opecodeTable[0246] = { mnemonic:"AND (HL)", proc: function() { THIS.reg.andAcc(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["AND", "(HL)"]}; } };
    opeIX[0246] = { mnemonic:"AND (IX+d)", proc: function() { THIS.reg.andAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch())); }};
    opeIY[0246] = { mnemonic:"AND (IY+d)", proc: function() { THIS.reg.andAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // OR s         A <- A | s            [110]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0260] = { mnemonic:"OR B", proc: function() { THIS.reg.orAcc(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["OR", "B"]}; } };
    this.opecodeTable[0261] = { mnemonic:"OR C", proc: function() { THIS.reg.orAcc(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["OR", "C"]}; } };
    this.opecodeTable[0262] = { mnemonic:"OR D", proc: function() { THIS.reg.orAcc(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["OR", "D"]}; } };
    this.opecodeTable[0263] = { mnemonic:"OR E", proc: function() { THIS.reg.orAcc(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["OR", "E"]}; } };
    this.opecodeTable[0264] = { mnemonic:"OR H", proc: function() { THIS.reg.orAcc(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["OR", "H"]}; } };
    this.opecodeTable[0265] = { mnemonic:"OR L", proc: function() { THIS.reg.orAcc(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["OR", "L"]}; } };
    this.opecodeTable[0267] = { mnemonic:"OR A", proc: function() { THIS.reg.orAcc(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["OR", "A"]}; } };
    this.opecodeTable[0366] = { mnemonic:"OR n", proc: function() { THIS.reg.orAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return { code:[mem.peek(addr),n], mnemonic: ["OR", n.HEX(2) + "H"]};
        }};
    this.opecodeTable[0266] = { mnemonic:"OR (HL)", proc: function() { THIS.reg.orAcc(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["OR", "(HL)"]}; } };
    opeIX[0266] = { mnemonic:"OR (IX+d)", proc: function() { THIS.reg.orAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch())); }};
    opeIY[0266] = { mnemonic:"OR (IY+d)", proc: function() { THIS.reg.orAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // XOR s        A <- A ~ s            [101]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0250] = { mnemonic:"XOR B", proc: function() { THIS.reg.xorAcc(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["XOR", "B"]}; } };
    this.opecodeTable[0251] = { mnemonic:"XOR C", proc: function() { THIS.reg.xorAcc(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["XOR", "C"]}; } };
    this.opecodeTable[0252] = { mnemonic:"XOR D", proc: function() { THIS.reg.xorAcc(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["XOR", "D"]}; } };
    this.opecodeTable[0253] = { mnemonic:"XOR E", proc: function() { THIS.reg.xorAcc(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["XOR", "E"]}; } };
    this.opecodeTable[0254] = { mnemonic:"XOR H", proc: function() { THIS.reg.xorAcc(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["XOR", "H"]}; } };
    this.opecodeTable[0255] = { mnemonic:"XOR L", proc: function() { THIS.reg.xorAcc(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["XOR", "L"]}; } };
    this.opecodeTable[0257] = { mnemonic:"XOR A", proc: function() { THIS.reg.xorAcc(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["XOR", "A"]}; } };
    this.opecodeTable[0356] = { mnemonic:"XOR n", proc: function() { THIS.reg.xorAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return { code:[mem.peek(addr),n], mnemonic: ["XOR", n.HEX(2) + "H"]};
        }};
    this.opecodeTable[0256] = { mnemonic:"XOR (HL)", proc: function() { THIS.reg.xorAcc(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["XOR", "(HL)"]}; } };
    opeIX[0256] = { mnemonic:"XOR (IX+d)", proc: function() { THIS.reg.xorAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch())); }};
    opeIY[0256] = { mnemonic:"XOR (IY+d)", proc: function() { THIS.reg.xorAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // CP s         A - s                 [111]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0270] = { mnemonic:"CP B", proc: function() { THIS.reg.compareAcc(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CP", "B"]}; } };
    this.opecodeTable[0271] = { mnemonic:"CP C", proc: function() { THIS.reg.compareAcc(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CP", "C"]}; } };
    this.opecodeTable[0272] = { mnemonic:"CP D", proc: function() { THIS.reg.compareAcc(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CP", "D"]}; } };
    this.opecodeTable[0273] = { mnemonic:"CP E", proc: function() { THIS.reg.compareAcc(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CP", "E"]}; } };
    this.opecodeTable[0274] = { mnemonic:"CP H", proc: function() { THIS.reg.compareAcc(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CP", "H"]}; } };
    this.opecodeTable[0275] = { mnemonic:"CP L", proc: function() { THIS.reg.compareAcc(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CP", "L"]}; } };
    this.opecodeTable[0277] = { mnemonic:"CP A", proc: function() { THIS.reg.compareAcc(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CP", "A"]}; } };
    this.opecodeTable[0376] = { mnemonic:"CP n", proc: function() { THIS.reg.compareAcc(THIS.fetch()); },
        disasm: function(mem, addr) {
            var n = mem.peek(addr + 1);
            return { code:[mem.peek(addr),n], mnemonic: ["CP", n.HEX(2) + "H"]};
        }};
    this.opecodeTable[0276] = { mnemonic:"CP (HL)", proc: function() { THIS.reg.compareAcc(THIS.memory.peek(THIS.reg.getHL())); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CP", "(HL)"]}; } };
    opeIX[0276] = { mnemonic:"CP (IX+d)", proc: function() { THIS.reg.compareAcc(THIS.memory.peek(THIS.reg.IX + THIS.fetch())); }};
    opeIY[0276] = { mnemonic:"CP (IY+d)", proc: function() { THIS.reg.compareAcc(THIS.memory.peek(THIS.reg.IY + THIS.fetch())); }};
    //---------------------------------------------------------------------------------
    // INC r        r <- r + 1          00 <r>[100]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0004] = { mnemonic:"INC B", proc: function() { THIS.reg.increment("B"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "B"]}; } };
    this.opecodeTable[0014] = { mnemonic:"INC C", proc: function() { THIS.reg.increment("C"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "C"]}; } };
    this.opecodeTable[0024] = { mnemonic:"INC D", proc: function() { THIS.reg.increment("D"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "D"]}; } };
    this.opecodeTable[0034] = { mnemonic:"INC E", proc: function() { THIS.reg.increment("E"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "E"]}; } };
    this.opecodeTable[0044] = { mnemonic:"INC H", proc: function() { THIS.reg.increment("H"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "H"]}; } };
    this.opecodeTable[0054] = { mnemonic:"INC L", proc: function() { THIS.reg.increment("L"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "L"]}; } };
    this.opecodeTable[0074] = { mnemonic:"INC A", proc: function() { THIS.reg.increment("A"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "A"]}; } };
    //---------------------------------------------------------------------------------
    // INC (HL)     (HL) <- (HL) + 1    00 110[100]
    //---------------------------------------------------------------------------------
    this.opecodeTable[0064] = { mnemonic:"INC (HL)", proc: function() { THIS.incrementAt(THIS.reg.getHL()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "(HL)"]}; } };
    //---------------------------------------------------------------------------------
    // INC (IX+d)   (IX+d) <- (IX+d)+1  11 011 101
    //                                  00 110[100]
    //                                  <---d---->
    //---------------------------------------------------------------------------------
    opeIX[0064] = {
        mnemonic:"INC (IX+d)",
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
    opeIY[0064] = {
        mnemonic:"INC (IY+d)",
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
    this.opecodeTable[0005] = { mnemonic:"DEC B", proc: function() { THIS.reg.decrement("B"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "B"]}; } };
    this.opecodeTable[0015] = { mnemonic:"DEC C", proc: function() { THIS.reg.decrement("C"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "C"]}; } };
    this.opecodeTable[0025] = { mnemonic:"DEC D", proc: function() { THIS.reg.decrement("D"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "D"]}; } };
    this.opecodeTable[0035] = { mnemonic:"DEC E", proc: function() { THIS.reg.decrement("E"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "E"]}; } };
    this.opecodeTable[0045] = { mnemonic:"DEC H", proc: function() { THIS.reg.decrement("H"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "H"]}; } };
    this.opecodeTable[0055] = { mnemonic:"DEC L", proc: function() { THIS.reg.decrement("L"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "L"]}; } };
    this.opecodeTable[0075] = { mnemonic:"DEC A", proc: function() { THIS.reg.decrement("A"); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "A"]}; } };
    this.opecodeTable[0065] = { mnemonic:"DEC (HL)", proc: function() { THIS.decrementAt(THIS.reg.getHL()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "(HL)"]}; } };
    opeIX[0065] = { mnemonic:"DEC (IX+d)", proc: function() { THIS.decrementAt(THIS.reg.IX + THIS.fetch()); }};
    opeIY[0065] = { mnemonic:"DEC (IY+d)", proc: function() { THIS.decrementAt(THIS.reg.IY + THIS.fetch()); }};

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
    this.opecodeTable[0047] = { mnemonic:"DAA", proc: function() {
            THIS.reg.DAA();
            /*****************************************************
            var m = 0;
            var C = 0;
            var AH = (THIS.reg.A >> 4) & 0x0f;
            var AL = (THIS.reg.A >> 0) & 0x0f;
            if(THIS.reg.FlagN() == 0) {
                if(THIS.reg.FlagC() == 0) {
                    if(THIS.reg.FlagH() == 0) {
                        if(AH <= 8) {
                            if(AL > 9) {
                                m = 0x06;
                            }
                        } else if(AH == 9) {
                            if(AL > 9) {
                                m = 0x66;
                                C = 1;
                            }
                        } else {
                            if(AL <= 9) {
                                m = 0x60;
                            } else {
                                m = 0x66;
                            }
                            C = 1;
                        }
                    } else {
                        if(AH <= 8) {
                            m = 0x06;
                        } else if(AH == 9) {
                            if(AL <= 9) {
                                m = 0x06;
                            } else {
                                m = 0x66;
                                C = 1;
                            }
                        } else {
                            m = 0x66;
                            C = 1;
                        }
                    }
                } else {
                    if(THIS.reg.FlagH() == 0) {
                        if(AL <= 9) {
                            m = 0x60;
                        } else {
                            m = 0x66;
                        }
                    } else {
                        m = 0x66;
                    }
                    C = 1;
                }
            } else {
                if(THIS.reg.FlagC() == 0) {
                    if(THIS.reg.FlagH() == 0) {
                        if(AH <= 8) {
                            if(AL > 9) {
                                m = 0xfa;
                            }
                        } else if(AH == 9) {
                            if(AL > 9) {
                                m = 0x9a;
                                C = 1;
                            }
                        } else {
                            if(AL <= 9) {
                                m = 0xa0;
                            } else {
                                m = 0x9a;
                            }
                            C = 1;
                        }
                    } else {
                        if(AH <= 8) {
                            m = 0xfa;
                        } else if(AH == 9) {
                            if(AL <= 9) {
                                m = 0xfa;
                            } else {
                                m = 0x9a;
                                C = 1;
                            }
                        } else {
                            m = 0x9a;
                            C = 1;
                        }
                    }
                } else {
                    if(THIS.reg.FlagH() == 0) {
                        if(AL <= 9) {
                            m = 0xa0;
                        } else {
                            m = 0x9a;
                        }
                    } else {
                        m = 0x9a;
                    }
                    C = 1;
                }
            }
            THIS.reg.A = (THIS.reg.A + m) & 0xff;
            THIS.reg.SetFlagC(C);
            ****************************************/
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DAA"]}; } };
    this.opecodeTable[0057] = { mnemonic:"CPL", proc: function() { THIS.reg.CPL(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CPL"]}; } };
    this.opecodeTable[0077] = { mnemonic:"CCF", proc: function() { if(THIS.reg.flagC()) { THIS.reg.clearFlagC(); } else { THIS.reg.setFlagC(); } },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["CCF"]}; } };
    this.opecodeTable[0067] = { mnemonic:"SCF", proc: function() { THIS.reg.setFlagC(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["SCF"]}; } };
    this.opecodeTable[0000] = { mnemonic:"NOP", proc: function() {},
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["NOP"]}; } };
    this.opecodeTable[0166] = { mnemonic:"HALT",
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
    this.opecodeTable[0363] = { mnemonic:"DI", proc: function() { THIS.IFF1 = THIS.IFF2 = 0; },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DI"]}; } };
    this.opecodeTable[0373] = { mnemonic:"EI", proc: function() {
            if (!THIS.IFF1) {
                THIS.IFF1 = this.IFF2 = 1;
                THIS.reg.R = (THIS.reg.R + 1) & 255;
                THIS.exec();
                THIS.interrupt();
            } else {
                THIS.IFF2 = 1;
            }
        },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["EI"]}; } };
    opeMisc[0104] = { mnemonic:"NEG", proc: function() { THIS.reg.NEG(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["NEG"]}; } };
    opeMisc[0106] = { mnemonic:"IM0", proc: function() { THIS.IM = 0; },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["IM0"]}; } };
    opeMisc[0126] = { mnemonic:"IM1", proc: function() { THIS.IM = 1; },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["IM1"]}; } };
    opeMisc[0136] = { mnemonic:"IM2", proc: function() { THIS.IM = 2; },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["IM2"]}; } };

    //=================================================================================
    // 16ビット演算グループ
    //=================================================================================

    //---------------------------------------------------------------------------------
    // ADD HL,ss    HL <- HL + ss       00 ss1 001
    //---------------------------------------------------------------------------------
    this.opecodeTable[0011] = { mnemonic:"ADD HL,BC", proc: function() { THIS.reg.ADD_HL(THIS.reg.getBC()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "HL", "BC"]}; } };
    this.opecodeTable[0031] = { mnemonic:"ADD HL,DE", proc: function() { THIS.reg.ADD_HL(THIS.reg.getDE()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "HL", "DE"]}; } };
    this.opecodeTable[0051] = { mnemonic:"ADD HL,HL", proc: function() { THIS.reg.ADD_HL(THIS.reg.getHL()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "HL", "HL"]}; } };
    this.opecodeTable[0071] = { mnemonic:"ADD HL,SP", proc: function() { THIS.reg.ADD_HL(THIS.reg.getSP()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["ADD", "HL", "SP"]}; } };
    //---------------------------------------------------------------------------------
    // ADC HL,ss    HL <- HL + ss + CY  11 101 101
    //                                  01 ss1 010
    //---------------------------------------------------------------------------------
    opeMisc[0112] = { mnemonic:"ADC HL,BC", proc: function() { THIS.reg.ADC_HL(THIS.reg.getBC()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["ADC", "HL", "BC"]}; } };
    opeMisc[0132] = { mnemonic:"ADC HL,DE", proc: function() { THIS.reg.ADC_HL(THIS.reg.getDE()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["ADC", "HL", "DE"]}; } };
    opeMisc[0152] = { mnemonic:"ADC HL,HL", proc: function() { THIS.reg.ADC_HL(THIS.reg.getHL()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["ADC", "HL", "HL"]}; } };
    opeMisc[0172] = { mnemonic:"ADC HL,SP", proc: function() { THIS.reg.ADC_HL(THIS.reg.getSP()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["ADC", "HL", "SP"]}; } };
    //---------------------------------------------------------------------------------
    // SBC HL,ss    HL <- HL - ss - CY  11 101 101
    //                                  01 ss0 010
    //---------------------------------------------------------------------------------
    opeMisc[0102] = { mnemonic:"SBC HL,BC", proc: function() { THIS.reg.SBC_HL(THIS.reg.getBC()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["SBC", "HL", "BC"]}; } };
    opeMisc[0122] = { mnemonic:"SBC HL,DE", proc: function() { THIS.reg.SBC_HL(THIS.reg.getDE()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["SBC", "HL", "DE"]}; } };
    opeMisc[0142] = { mnemonic:"SBC HL,HL", proc: function() { THIS.reg.SBC_HL(THIS.reg.getHL()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["SBC", "HL", "HL"]}; } };
    opeMisc[0162] = { mnemonic:"SBC HL,SP", proc: function() { THIS.reg.SBC_HL(THIS.reg.getSP()); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic: ["SBC", "HL", "SP"]}; } };
    //---------------------------------------------------------------------------------
    // ADD IX,pp    IX <- IX + pp       11 011 101
    //                                  00 pp1 001
    //---------------------------------------------------------------------------------
    opeIX[0011] = { mnemonic:"ADD IX,BC", proc: function() { THIS.reg.ADD_IX(THIS.reg.getBC()); },
        disasm: function(mem, addr) {
            return {
                code: [ 0xDD, 0x09 ],
                mnemonic: ["ADD", "IX", "BC"]
            };
        }
    };
    opeIX[0031] = { mnemonic:"ADD IX,DE", proc: function() { THIS.reg.ADD_IX(THIS.reg.getDE()); },
        disasm: function(mem, addr) {
            return {
                code: [ 0xDD, 0x19 ],
                mnemonic: ["ADD", "IX", "DE"]
            };
        }
    };
    opeIX[0051] = { mnemonic:"ADD IX,IX", proc: function() { THIS.reg.ADD_IX(THIS.reg.IX); },
        disasm: function(mem, addr) {
            return {
                code: [ 0xDD, 0x29 ],
                mnemonic: ["ADD", "IX", "IX"]
            };
        }
    };
    opeIX[0071] = { mnemonic:"ADD IX,SP", proc: function() { THIS.reg.ADD_IX(THIS.reg.SP); },
        disasm: function(mem, addr) {
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
    opeIY[0011] = { mnemonic:"ADD IY,BC", proc: function() { THIS.reg.ADD_IY(THIS.reg.getBC()); },
        disasm: function(mem, addr) {
            return {
                code: [ 0xFD, 0x09 ],
                mnemonic: ["ADD", "IY", "BC"]
            };
        }
    };
    opeIY[0031] = { mnemonic:"ADD IY,DE", proc: function() { THIS.reg.ADD_IY(THIS.reg.getDE()); },
        disasm: function(mem, addr) {
            return {
                code: [ 0xFD, 0x19 ],
                mnemonic: ["ADD", "IY", "DE"]
            };
        }
    };
    opeIY[0051] = { mnemonic:"ADD IY,IY", proc: function() { THIS.reg.ADD_IY(THIS.reg.IY); },
        disasm: function(mem, addr) {
            return {
                code: [ 0xFD, 0x29 ],
                mnemonic: ["ADD", "IY", "IY"]
            };
        }
    };
    opeIY[0071] = { mnemonic:"ADD IY,SP", proc: function() { THIS.reg.ADD_IY(THIS.reg.SP); },
        disasm: function(mem, addr) {
            return {
                code: [ 0xFD, 0x39 ],
                mnemonic: ["ADD", "IY", "SP"]
            };
        }
    };
    //---------------------------------------------------------------------------------
    // INC ss       ss <- ss + 1        00 ss0 011
    //---------------------------------------------------------------------------------
    this.opecodeTable[0003] = { mnemonic:"INC BC", proc: function() { THIS.reg.incBC(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "BC"]}; } };
    this.opecodeTable[0023] = { mnemonic:"INC DE", proc: function() { THIS.reg.incDE(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "DE"]}; } };
    this.opecodeTable[0043] = { mnemonic:"INC HL", proc: function() { THIS.reg.incHL(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "HL"]}; } };
    this.opecodeTable[0063] = { mnemonic:"INC SP", proc: function() { THIS.reg.SP = (THIS.reg.SP + 1) & 0xffff; },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["INC", "SP"]}; } };
    //---------------------------------------------------------------------------------
    // INC IX       IX <- IX + 1        11 011 101
    //                                  00 100 011
    //---------------------------------------------------------------------------------
    opeIX[0043] = { mnemonic:"INC IX", proc: function() { THIS.reg.IX = (THIS.reg.IX + 1) & 0xffff; }};
    //---------------------------------------------------------------------------------
    // INC IY       IY <- IY + 1        11 111 101
    //                                  00 100 011
    //---------------------------------------------------------------------------------
    opeIY[0043] = { mnemonic:"INC IY", proc: function() { THIS.reg.IY = (THIS.reg.IY + 1) & 0xffff; }};
    //---------------------------------------------------------------------------------
    // DEC ss       ss <- ss + 1        00 ss1 011
    //---------------------------------------------------------------------------------
    this.opecodeTable[0013] = { mnemonic:"DEC BC", proc: function() { THIS.reg.decBC(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "BC"]}; } };
    this.opecodeTable[0033] = { mnemonic:"DEC DE", proc: function() { THIS.reg.decDE(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "DE"]}; } };
    this.opecodeTable[0053] = { mnemonic:"DEC HL", proc: function() { THIS.reg.decHL(); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "HL"]}; } };
    this.opecodeTable[0073] = { mnemonic:"DEC SP", proc: function() { THIS.reg.SP = (THIS.reg.SP - 1) & 0xffff; },
        disasm: function(mem, addr) { return { code:[mem.peek(addr)], mnemonic: ["DEC", "SP"]}; } };
    //---------------------------------------------------------------------------------
    // DEC IX       IX <- IX + 1        11 011 101
    //                                  00 101 011
    //---------------------------------------------------------------------------------
    opeIX[0053] = { mnemonic:"DEC IX", proc: function() { THIS.reg.IX = (THIS.reg.IX - 1) & 0xffff; }};
    //---------------------------------------------------------------------------------
    // DEC IY       IY <- IY + 1        11 111 101
    //                                  00 101 011
    //---------------------------------------------------------------------------------
    opeIY[0053] = { mnemonic:"DEC IY", proc: function() { THIS.reg.IY = (THIS.reg.IY - 1) & 0xffff; }};

    //=================================================================================
    // ローテイト・シフトグループ
    //=================================================================================
    this.opecodeTable[0007] = { mnemonic:"RLCA",
        proc: function() { THIS.reg.RLCA(); },
        disasm: function(mem,addr) { return { code:[0007],mnemonic:["RLCA"]};}
    };
    this.opecodeTable[0027] = { mnemonic:"RLA", proc:
        function() { THIS.reg.RLA(); },
        disasm: function(mem,addr) { return { code:[0027],mnemonic:["RLA"]};}
    };
    this.opecodeTable[0017] = { mnemonic:"RRCA",
        proc: function() { THIS.reg.RRCA(); },
        disasm: function(mem,addr) { return { code:[0017],mnemonic:["RRCA"]};}
    };
    this.opecodeTable[0037] = { mnemonic:"RRA",
        proc: function() { THIS.reg.RRA(); },
        disasm: function(mem,addr) { return { code:[0037],mnemonic:["RRA"]};}
    };
    
    opeIX[0313] = { mnemonic: function() { return opeRotateIX; },
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
    opeIY[0313] = { mnemonic: function() { return opeRotateIY; },
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

    opeRotate[0000] = { mnemonic:"RLC B", proc: function() { THIS.reg.B = THIS.reg.RLC(THIS.reg.B); },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","B"]
            };
        }
    };
    opeRotate[0001] = { mnemonic:"RLC C", proc: function() { THIS.reg.C = THIS.reg.RLC(THIS.reg.C); },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","C"]
            };
        }
    };
    opeRotate[0002] = { mnemonic:"RLC D", proc: function() { THIS.reg.D = THIS.reg.RLC(THIS.reg.D); },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","D"]
            };
        }
    };
    opeRotate[0003] = { mnemonic:"RLC E", proc: function() { THIS.reg.E = THIS.reg.RLC(THIS.reg.E); },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","E"]
            };
        }
    };
    opeRotate[0004] = { mnemonic:"RLC H", proc: function() { THIS.reg.H = THIS.reg.RLC(THIS.reg.H); },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","H"]
            };
        }
    };
    opeRotate[0005] = { mnemonic:"RLC L", proc: function() { THIS.reg.L = THIS.reg.RLC(THIS.reg.L); },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","L"]
            };
        }
    };
    opeRotate[0007] = { mnemonic:"RLC A", proc: function() { THIS.reg.A = THIS.reg.RLC(THIS.reg.A); },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","A"]
            };
        }
    };
    opeRotate[0006] = { mnemonic:"RLC (HL)", proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.RLC(THIS.memory.peek(adr))); },
        disasm:function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1)],
                mnemonic:["RLC","(HL)"]
            };
        }
    };
    opeRotateIX[0006] = { mnemonic: "RLC (IX+d)",
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
    opeRotateIY[0006] = { mnemonic: "RLC (IY+d)",
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
    opeRotate[0020] = {
        mnemonic:"RL B",
        proc: function() { THIS.reg.B = THIS.reg.RL(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","B"] };}
    };
    opeRotate[0021] = {
        mnemonic:"RL C",
        proc: function() { THIS.reg.C = THIS.reg.RL(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","C"] };}
    };
    opeRotate[0022] = {
        mnemonic:"RL D",
        proc: function() { THIS.reg.D = THIS.reg.RL(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","D"] };}
    };
    opeRotate[0023] = {
        mnemonic:"RL E",
        proc: function() { THIS.reg.E = THIS.reg.RL(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","E"] };}
    };
    opeRotate[0024] = {
        mnemonic:"RL H",
        proc: function() { THIS.reg.H = THIS.reg.RL(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","H"] };}
    };
    opeRotate[0025] = {
        mnemonic:"RL L",
        proc: function() { THIS.reg.L = THIS.reg.RL(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","L"] };}
    };
    opeRotate[0026] = {
        mnemonic:"RL (HL)",
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.RL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RL","(HL)"] };}
    };
    opeRotateIX[0026] = {
        mnemonic: "RL (IX+d)",
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.RL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RL","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[0026] = {
        mnemonic: "RL (IY+d)",
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.RL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RL","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeRotate[0010] = {
        mnemonic:"RRC B",
        proc: function() { THIS.reg.B = THIS.reg.RRC(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","B"] };}
    };
    opeRotate[0011] = {
        mnemonic:"RRC C",
        proc: function() { THIS.reg.C = THIS.reg.RRC(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","C"] };}
    };
    opeRotate[0012] = {
        mnemonic:"RRC D",
        proc: function() { THIS.reg.D = THIS.reg.RRC(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","D"] };}
    };
    opeRotate[0013] = {
        mnemonic:"RRC E",
        proc: function() { THIS.reg.E = THIS.reg.RRC(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","E"] };}
    };
    opeRotate[0014] = {
        mnemonic:"RRC H",
        proc: function() { THIS.reg.H = THIS.reg.RRC(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","H"] };}
    };
    opeRotate[0015] = {
        mnemonic:"RRC L",
        proc: function() { THIS.reg.L = THIS.reg.RRC(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","L"] };}
    };
    opeRotate[0017] = {
        mnemonic:"RRC A",
        proc: function() { THIS.reg.A = THIS.reg.RRC(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","A"] };}
    };
    opeRotate[0016] = {
        mnemonic:"RRC (HL)",
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.RRC(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RRC","(HL)"] };}
    };
    opeRotateIX[0016] = {
        mnemonic: "RRC (IX+d)",
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.RRC(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RRC","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[0016] = {
        mnemonic: "RRC (IY+d)",
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.RRC(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RRC","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    
    opeRotate[0030] = {
        mnemonic:"RR B",
        proc: function() { THIS.reg.B = THIS.reg.RR(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","B"] };}
    };
    opeRotate[0031] = {
        mnemonic:"RR C",
        proc: function() { THIS.reg.C = THIS.reg.RR(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","C"] };}
    };
    opeRotate[0032] = {
        mnemonic:"RR D",
        proc: function() { THIS.reg.D = THIS.reg.RR(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","D"] };}
    };
    opeRotate[0033] = {
        mnemonic:"RR E",
        proc: function() { THIS.reg.E = THIS.reg.RR(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","E"] };}
    };
    opeRotate[0034] = {
        mnemonic:"RR H",
        proc: function() { THIS.reg.H = THIS.reg.RR(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","H"] };}
    };
    opeRotate[0035] = {
        mnemonic:"RR L",
        proc: function() { THIS.reg.L = THIS.reg.RR(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","L"] };}
    };
    opeRotate[0036] = {
        mnemonic:"RR (HL)",
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.RR(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["RR","(HL)"] };}
    };
    opeRotateIX[0036] = {
        mnemonic: "RR (IX+d)",
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.RR(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RR","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[0036] = {
        mnemonic: "RR (IY+d)",
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.RR(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["RR","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeRotate[0040] = {
        mnemonic:"SLA B",
        proc: function() { THIS.reg.B = THIS.reg.SLA(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","B"] };}
    };
    opeRotate[0041] = {
        mnemonic:"SLA C",
        proc: function() { THIS.reg.C = THIS.reg.SLA(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","C"] };}
    };
    opeRotate[0042] = {
        mnemonic:"SLA D",
        proc: function() { THIS.reg.D = THIS.reg.SLA(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","D"] };}
    };
    opeRotate[0043] = {
        mnemonic:"SLA E",
        proc: function() { THIS.reg.E = THIS.reg.SLA(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","E"] };}
    };
    opeRotate[0044] = {
        mnemonic:"SLA H",
        proc: function() { THIS.reg.H = THIS.reg.SLA(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","H"] };}
    };
    opeRotate[0045] = {
        mnemonic:"SLA L",
        proc: function() { THIS.reg.L = THIS.reg.SLA(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","L"] };}
    };
    opeRotate[0047] = {
        mnemonic:"SLA A",
        proc: function() { THIS.reg.A = THIS.reg.SLA(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","A"] };}
    };
    opeRotate[0046] = {
        mnemonic:"SLA (HL)",
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.SLA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SLA","(HL)"] };}
    };
    opeRotateIX[0046] = {
        mnemonic: "SLA (IX+d)",
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.SLA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SLA","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[0046] = {
        mnemonic: "SLA (IY+d)",
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.SLA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SLA","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeRotate[0050] = {
        mnemonic:"SRA B",
        proc: function() { THIS.reg.B = THIS.reg.SRA(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","B"] };}
    };
    opeRotate[0051] = {
        mnemonic:"SRA C",
        proc: function() { THIS.reg.C = THIS.reg.SRA(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","C"] };}
    };
    opeRotate[0052] = {
        mnemonic:"SRA D",
        proc: function() { THIS.reg.D = THIS.reg.SRA(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","D"] };}
    };
    opeRotate[0053] = {
        mnemonic:"SRA E",
        proc: function() { THIS.reg.E = THIS.reg.SRA(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","E"] };}
    };
    opeRotate[0054] = {
        mnemonic:"SRA H",
        proc: function() { THIS.reg.H = THIS.reg.SRA(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","H"] };}
    };
    opeRotate[0055] = {
        mnemonic:"SRA L",
        proc: function() { THIS.reg.L = THIS.reg.SRA(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","L"] };}
    };
    opeRotate[0057] = {
        mnemonic:"SRA A",
        proc: function() { THIS.reg.A = THIS.reg.SRA(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","A"] };}
    };
    opeRotate[0056] = {
        mnemonic:"SRA (HL)",
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.SRA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRA","(HL)"] };}
    };
    opeRotateIX[0056] = {
        mnemonic: "SRA (IX+d)",
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.SRA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SRA","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[0056] = {
        mnemonic: "SRA (IY+d)",
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.SRA(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SRA","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeRotate[0070] = {
        mnemonic:"SRL B",
        proc: function() { THIS.reg.B = THIS.reg.SRL(THIS.reg.B); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","B"] };}
    };
    opeRotate[0071] = {
        mnemonic:"SRL C",
        proc: function() { THIS.reg.C = THIS.reg.SRL(THIS.reg.C); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","C"] };}
    };
    opeRotate[0072] = {
        mnemonic:"SRL D",
        proc: function() { THIS.reg.D = THIS.reg.SRL(THIS.reg.D); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","D"] };}
    };
    opeRotate[0073] = {
        mnemonic:"SRL E",
        proc: function() { THIS.reg.E = THIS.reg.SRL(THIS.reg.E); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","E"] };}
    };
    opeRotate[0074] = {
        mnemonic:"SRL H",
        proc: function() { THIS.reg.H = THIS.reg.SRL(THIS.reg.H); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","H"] };}
    };
    opeRotate[0075] = {
        mnemonic:"SRL L",
        proc: function() { THIS.reg.L = THIS.reg.SRL(THIS.reg.L); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","L"] };}
    };
    opeRotate[0077] = {
        mnemonic:"SRL A",
        proc: function() { THIS.reg.A = THIS.reg.SRL(THIS.reg.A); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","A"] };}
    };
    opeRotate[0076] = {
        mnemonic:"SRL (HL)",
        proc: function() { var adr = THIS.reg.getHL(); THIS.memory.poke(adr, THIS.reg.SRL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) { return { code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:["SRL","(HL)"] };}
    };
    opeRotateIX[0076] = {
        mnemonic: "SRL (IX+d)",
        proc: function(d) { var adr = THIS.reg.IX + d; THIS.memory.poke(adr, THIS.reg.SRL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SRL","(IX+" + mem.peek(addr+2) + ")"]
            };
        }
    };
    opeRotateIY[0076] = {
        mnemonic: "SRL (IY+d)",
        proc: function(d) { var adr = THIS.reg.IY + d; THIS.memory.poke(adr, THIS.reg.SRL(THIS.memory.peek(adr))); },
        disasm: function(mem, addr) {
            return {
                code:[mem.peek(addr), mem.peek(addr+1), mem.peek(addr+2), mem.peek(addr+3)],
                mnemonic:["SRL","(IY+" + mem.peek(addr+2) + ")"]
            };
        }
    };

    opeMisc[0157] = { mnemonic:"RLD", proc: function() {
        var adr = THIS.reg.getHL();
        var n = THIS.memory.peek(adr);
        var AH = THIS.reg.A & 0xf0;
        var AL = THIS.reg.A & 0x0f;
        var nH = (n >> 4) & 0x0f;
        var nL = (n >> 0) & 0x0f;
        
        THIS.reg.A = AH | nH;
        n = (nL << 4) | AL;
        
        THIS.memory.poke(adr, n);
    }, disasm: function(mem, addr) {
        return {
            code:[mem.peek(addr), mem.peek(addr+1)],
            mnemonic:["RLD"]
        };
    }};
    opeMisc[0147] = { mnemonic:"RRD", proc: function() {
        var adr = THIS.reg.getHL();
        var n = THIS.memory.peek(adr);
        var AH = THIS.reg.A & 0xf0;
        var AL = THIS.reg.A & 0x0F;
        var nH = (n >> 4) & 0x0f;
        var nL = (n >> 0) & 0x0f;

        THIS.reg.A = AH | nL;
        n = (AL << 4) | nH;
        
        THIS.memory.poke(adr, n);
    }, disasm: function(mem, addr) {
        return {
            code:[mem.peek(addr), mem.peek(addr+1)],
            mnemonic:["RRD"] };
    }};

    //=================================================================================
    // ビットセット・リセット及びテストグループ
    //=================================================================================

    var reg8=["B","C","D","E","H","L","(HL)","A"];
    for(var regI = 0; regI < reg8.length; regI++) {
        for(var bit = 0; bit < 8; bit++) {
            var code = 0300|(bit<<3)|regI;
            opeRotate[0100|(bit<<3)|regI] = {
                mnemonic:"BIT " + bit + "," + reg8[regI],
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
    opeRotateIX[0106] = { mnemonic:"BIT 0,(IX+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 0)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIX[0116] = { mnemonic:"BIT 1,(IX+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 1)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIX[0126] = { mnemonic:"BIT 2,(IX+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 2)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIX[0136] = { mnemonic:"BIT 3,(IX+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 3)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIX[0146] = { mnemonic:"BIT 4,(IX+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 4)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIX[0156] = { mnemonic:"BIT 5,(IX+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 5)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIX[0166] = { mnemonic:"BIT 6,(IX+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 6)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIX[0176] = { mnemonic:"BIT 7,(IX+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IX+d) & (1 << 7)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};

    opeRotateIY[0106] = { mnemonic:"BIT 0,(IY+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 0)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIY[0116] = { mnemonic:"BIT 1,(IY+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 1)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIY[0126] = { mnemonic:"BIT 2,(IY+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 2)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIY[0136] = { mnemonic:"BIT 3,(IY+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 3)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIY[0146] = { mnemonic:"BIT 4,(IY+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 4)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIY[0156] = { mnemonic:"BIT 5,(IY+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 5)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIY[0166] = { mnemonic:"BIT 6,(IY+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 6)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};
    opeRotateIY[0176] = { mnemonic:"BIT 7,(IY+d)", proc: function(d) { if(THIS.memory.peek(THIS.reg.IY+d) & (1 << 7)) { THIS.reg.clearFlagZ(); } else { THIS.reg.setFlagZ(); } THIS.reg.setFlagH(); THIS.reg.clearFlagN() }};

    for(var regI = 0; regI < reg8.length; regI++) {
        for(var bit = 0; bit < 8; bit++) {
            var code = 0300|(bit<<3)|regI;
            opeRotate[0300|(bit<<3)|regI] = {
                mnemonic:"SET " + bit + "," + reg8[regI],
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
    opeRotateIX[0306] = { mnemonic:"SET 0,(IX+d)", proc: function(d) { var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 0)); }};
    opeRotateIX[0316] = { mnemonic:"SET 1,(IX+d)", proc: function(d) { var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 1)); }};
    opeRotateIX[0326] = { mnemonic:"SET 2,(IX+d)", proc: function(d) { var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 2)); }};
    opeRotateIX[0336] = { mnemonic:"SET 3,(IX+d)", proc: function(d) { var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 3)); }};
    opeRotateIX[0346] = { mnemonic:"SET 4,(IX+d)", proc: function(d) { var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 4)); }};
    opeRotateIX[0356] = { mnemonic:"SET 5,(IX+d)", proc: function(d) { var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 5)); }};
    opeRotateIX[0366] = { mnemonic:"SET 6,(IX+d)", proc: function(d) { var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 6)); }};
    opeRotateIX[0376] = { mnemonic:"SET 7,(IX+d)", proc: function(d) { var adr = THIS.reg.IX+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 7)); }};

    opeRotateIY[0306] = { mnemonic:"SET 0,(IY+d)", proc: function(d) { var adr = THIS.reg.IY+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 0)); }};
    opeRotateIY[0316] = { mnemonic:"SET 1,(IY+d)", proc: function(d) { var adr = THIS.reg.IY+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 1)); }};
    opeRotateIY[0326] = { mnemonic:"SET 2,(IY+d)", proc: function(d) { var adr = THIS.reg.IY+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 2)); }};
    opeRotateIY[0336] = { mnemonic:"SET 3,(IY+d)", proc: function(d) { var adr = THIS.reg.IY+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 3)); }};
    opeRotateIY[0346] = { mnemonic:"SET 4,(IY+d)", proc: function(d) { var adr = THIS.reg.IY+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 4)); }};
    opeRotateIY[0356] = { mnemonic:"SET 5,(IY+d)", proc: function(d) { var adr = THIS.reg.IY+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 5)); }};
    opeRotateIY[0366] = { mnemonic:"SET 6,(IY+d)", proc: function(d) { var adr = THIS.reg.IY+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 6)); }};
    opeRotateIY[0376] = { mnemonic:"SET 7,(IY+d)", proc: function(d) { var adr = THIS.reg.IY+d; THIS.memory.poke(adr, THIS.memory.peek(adr) | (1 << 7)); }};

    var procRES_8bit = function(b,r) {
        var bits = ~(1 << b);
        return function() {
            THIS.reg[r] &= bits;
        };
    };
    var disaRES_8bit = function(b,r) {
        var regidx = "BCDEHL A".indexOf(r);
        var bits = b << 3;
        return function(mem, addr) {
            return {
                code:[0xCB, 0200 | bits | regidx ],
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
        return (function(bits) { return function(mem, addr) {
            return {
                code:[0xCB, 0200 | bits | 6 ],
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
    opeRotate[0200] = { mnemonic:"RES 0,B", proc: procRES_8bit(0,"B"), disasm: disaRES_8bit(0,"B")};
    opeRotate[0210] = { mnemonic:"RES 1,B", proc: procRES_8bit(1,"B"), disasm: disaRES_8bit(1,"B")};
    opeRotate[0220] = { mnemonic:"RES 2,B", proc: procRES_8bit(2,"B"), disasm: disaRES_8bit(2,"B")};
    opeRotate[0230] = { mnemonic:"RES 3,B", proc: procRES_8bit(3,"B"), disasm: disaRES_8bit(3,"B")};
    opeRotate[0240] = { mnemonic:"RES 4,B", proc: procRES_8bit(4,"B"), disasm: disaRES_8bit(4,"B")};
    opeRotate[0250] = { mnemonic:"RES 5,B", proc: procRES_8bit(5,"B"), disasm: disaRES_8bit(5,"B")};
    opeRotate[0260] = { mnemonic:"RES 6,B", proc: procRES_8bit(6,"B"), disasm: disaRES_8bit(6,"B")};
    opeRotate[0270] = { mnemonic:"RES 7,B", proc: procRES_8bit(7,"B"), disasm: disaRES_8bit(7,"B")};

    opeRotate[0201] = { mnemonic:"RES 0,C", proc: procRES_8bit(0,"C"), disasm: disaRES_8bit(0,"C")};
    opeRotate[0211] = { mnemonic:"RES 1,C", proc: procRES_8bit(1,"C"), disasm: disaRES_8bit(1,"C")};
    opeRotate[0221] = { mnemonic:"RES 2,C", proc: procRES_8bit(2,"C"), disasm: disaRES_8bit(2,"C")};
    opeRotate[0231] = { mnemonic:"RES 3,C", proc: procRES_8bit(3,"C"), disasm: disaRES_8bit(3,"C")};
    opeRotate[0241] = { mnemonic:"RES 4,C", proc: procRES_8bit(4,"C"), disasm: disaRES_8bit(4,"C")};
    opeRotate[0251] = { mnemonic:"RES 5,C", proc: procRES_8bit(5,"C"), disasm: disaRES_8bit(5,"C")};
    opeRotate[0261] = { mnemonic:"RES 6,C", proc: procRES_8bit(6,"C"), disasm: disaRES_8bit(6,"C")};
    opeRotate[0271] = { mnemonic:"RES 7,C", proc: procRES_8bit(7,"C"), disasm: disaRES_8bit(7,"C")};

    opeRotate[0202] = { mnemonic:"RES 0,D", proc: procRES_8bit(0,"D"), disasm: disaRES_8bit(0,"D")};
    opeRotate[0212] = { mnemonic:"RES 1,D", proc: procRES_8bit(1,"D"), disasm: disaRES_8bit(1,"D")};
    opeRotate[0222] = { mnemonic:"RES 2,D", proc: procRES_8bit(2,"D"), disasm: disaRES_8bit(2,"D")};
    opeRotate[0232] = { mnemonic:"RES 3,D", proc: procRES_8bit(3,"D"), disasm: disaRES_8bit(3,"D")};
    opeRotate[0242] = { mnemonic:"RES 4,D", proc: procRES_8bit(4,"D"), disasm: disaRES_8bit(4,"D")};
    opeRotate[0252] = { mnemonic:"RES 5,D", proc: procRES_8bit(5,"D"), disasm: disaRES_8bit(5,"D")};
    opeRotate[0262] = { mnemonic:"RES 6,D", proc: procRES_8bit(6,"D"), disasm: disaRES_8bit(6,"D")};
    opeRotate[0272] = { mnemonic:"RES 7,D", proc: procRES_8bit(7,"D"), disasm: disaRES_8bit(7,"D")};

    opeRotate[0203] = { mnemonic:"RES 0,E", proc: procRES_8bit(0,"E"), disasm: disaRES_8bit(0,"E")};
    opeRotate[0213] = { mnemonic:"RES 1,E", proc: procRES_8bit(1,"E"), disasm: disaRES_8bit(1,"E")};
    opeRotate[0223] = { mnemonic:"RES 2,E", proc: procRES_8bit(2,"E"), disasm: disaRES_8bit(2,"E")};
    opeRotate[0233] = { mnemonic:"RES 3,E", proc: procRES_8bit(3,"E"), disasm: disaRES_8bit(3,"E")};
    opeRotate[0243] = { mnemonic:"RES 4,E", proc: procRES_8bit(4,"E"), disasm: disaRES_8bit(4,"E")};
    opeRotate[0253] = { mnemonic:"RES 5,E", proc: procRES_8bit(5,"E"), disasm: disaRES_8bit(5,"E")};
    opeRotate[0263] = { mnemonic:"RES 6,E", proc: procRES_8bit(6,"E"), disasm: disaRES_8bit(6,"E")};
    opeRotate[0273] = { mnemonic:"RES 7,E", proc: procRES_8bit(7,"E"), disasm: disaRES_8bit(7,"E")};

    opeRotate[0204] = { mnemonic:"RES 0,H", proc: procRES_8bit(0,"H"), disasm: disaRES_8bit(0,"H")};
    opeRotate[0214] = { mnemonic:"RES 1,H", proc: procRES_8bit(1,"H"), disasm: disaRES_8bit(1,"H")};
    opeRotate[0224] = { mnemonic:"RES 2,H", proc: procRES_8bit(2,"H"), disasm: disaRES_8bit(2,"H")};
    opeRotate[0234] = { mnemonic:"RES 3,H", proc: procRES_8bit(3,"H"), disasm: disaRES_8bit(3,"H")};
    opeRotate[0244] = { mnemonic:"RES 4,H", proc: procRES_8bit(4,"H"), disasm: disaRES_8bit(4,"H")};
    opeRotate[0254] = { mnemonic:"RES 5,H", proc: procRES_8bit(5,"H"), disasm: disaRES_8bit(5,"H")};
    opeRotate[0264] = { mnemonic:"RES 6,H", proc: procRES_8bit(6,"H"), disasm: disaRES_8bit(6,"H")};
    opeRotate[0274] = { mnemonic:"RES 7,H", proc: procRES_8bit(7,"H"), disasm: disaRES_8bit(7,"H")};

    opeRotate[0205] = { mnemonic:"RES 0,L", proc: procRES_8bit(0,"L"), disasm: disaRES_8bit(0,"L")};
    opeRotate[0215] = { mnemonic:"RES 1,L", proc: procRES_8bit(1,"L"), disasm: disaRES_8bit(1,"L")};
    opeRotate[0225] = { mnemonic:"RES 2,L", proc: procRES_8bit(2,"L"), disasm: disaRES_8bit(2,"L")};
    opeRotate[0235] = { mnemonic:"RES 3,L", proc: procRES_8bit(3,"L"), disasm: disaRES_8bit(3,"L")};
    opeRotate[0245] = { mnemonic:"RES 4,L", proc: procRES_8bit(4,"L"), disasm: disaRES_8bit(4,"L")};
    opeRotate[0255] = { mnemonic:"RES 5,L", proc: procRES_8bit(5,"L"), disasm: disaRES_8bit(5,"L")};
    opeRotate[0265] = { mnemonic:"RES 6,L", proc: procRES_8bit(6,"L"), disasm: disaRES_8bit(6,"L")};
    opeRotate[0275] = { mnemonic:"RES 7,L", proc: procRES_8bit(7,"L"), disasm: disaRES_8bit(7,"L")};

    opeRotate[0207] = { mnemonic:"RES 0,A", proc: procRES_8bit(0,"A"), disasm: disaRES_8bit(0,"A")};
    opeRotate[0217] = { mnemonic:"RES 1,A", proc: procRES_8bit(1,"A"), disasm: disaRES_8bit(1,"A")};
    opeRotate[0227] = { mnemonic:"RES 2,A", proc: procRES_8bit(2,"A"), disasm: disaRES_8bit(2,"A")};
    opeRotate[0237] = { mnemonic:"RES 3,A", proc: procRES_8bit(3,"A"), disasm: disaRES_8bit(3,"A")};
    opeRotate[0247] = { mnemonic:"RES 4,A", proc: procRES_8bit(4,"A"), disasm: disaRES_8bit(4,"A")};
    opeRotate[0257] = { mnemonic:"RES 5,A", proc: procRES_8bit(5,"A"), disasm: disaRES_8bit(5,"A")};
    opeRotate[0267] = { mnemonic:"RES 6,A", proc: procRES_8bit(6,"A"), disasm: disaRES_8bit(6,"A")};
    opeRotate[0277] = { mnemonic:"RES 7,A", proc: procRES_8bit(7,"A"), disasm: disaRES_8bit(7,"A")};

    opeRotate[0206] = { mnemonic:"RES 0,(HL)", proc: procRES_xHL(0), disasm: disaRES_xHL(0)};
    opeRotate[0216] = { mnemonic:"RES 1,(HL)", proc: procRES_xHL(1), disasm: disaRES_xHL(1)};
    opeRotate[0226] = { mnemonic:"RES 2,(HL)", proc: procRES_xHL(2), disasm: disaRES_xHL(2)};
    opeRotate[0236] = { mnemonic:"RES 3,(HL)", proc: procRES_xHL(3), disasm: disaRES_xHL(3)};
    opeRotate[0246] = { mnemonic:"RES 4,(HL)", proc: procRES_xHL(4), disasm: disaRES_xHL(4)};
    opeRotate[0256] = { mnemonic:"RES 5,(HL)", proc: procRES_xHL(5), disasm: disaRES_xHL(5)};
    opeRotate[0266] = { mnemonic:"RES 6,(HL)", proc: procRES_xHL(6), disasm: disaRES_xHL(6)};
    opeRotate[0276] = { mnemonic:"RES 7,(HL)", proc: procRES_xHL(7), disasm: disaRES_xHL(7)};

    // 10 000 110
    opeRotateIX[0206] = { mnemonic:"RES 0,(IX+d)", proc: procRES_xIDXd(0,"IX"), disasm: disaRES_xIDXd(0,"IX")};
    opeRotateIX[0216] = { mnemonic:"RES 1,(IX+d)", proc: procRES_xIDXd(1,"IX"), disasm: disaRES_xIDXd(1,"IX")};
    opeRotateIX[0226] = { mnemonic:"RES 2,(IX+d)", proc: procRES_xIDXd(2,"IX"), disasm: disaRES_xIDXd(2,"IX")};
    opeRotateIX[0236] = { mnemonic:"RES 3,(IX+d)", proc: procRES_xIDXd(3,"IX"), disasm: disaRES_xIDXd(3,"IX")};
    opeRotateIX[0246] = { mnemonic:"RES 4,(IX+d)", proc: procRES_xIDXd(4,"IX"), disasm: disaRES_xIDXd(4,"IX")};
    opeRotateIX[0256] = { mnemonic:"RES 5,(IX+d)", proc: procRES_xIDXd(5,"IX"), disasm: disaRES_xIDXd(5,"IX")};
    opeRotateIX[0266] = { mnemonic:"RES 6,(IX+d)", proc: procRES_xIDXd(6,"IX"), disasm: disaRES_xIDXd(6,"IX")};
    opeRotateIX[0276] = { mnemonic:"RES 7,(IX+d)", proc: procRES_xIDXd(7,"IX"), disasm: disaRES_xIDXd(7,"IX")};

    opeRotateIY[0206] = { mnemonic:"RES 0,(IY+d)", proc: procRES_xIDXd(0,"IY"), disasm: disaRES_xIDXd(0,"IY")};
    opeRotateIY[0216] = { mnemonic:"RES 1,(IY+d)", proc: procRES_xIDXd(1,"IY"), disasm: disaRES_xIDXd(1,"IY")};
    opeRotateIY[0226] = { mnemonic:"RES 2,(IY+d)", proc: procRES_xIDXd(2,"IY"), disasm: disaRES_xIDXd(2,"IY")};
    opeRotateIY[0236] = { mnemonic:"RES 3,(IY+d)", proc: procRES_xIDXd(3,"IY"), disasm: disaRES_xIDXd(3,"IY")};
    opeRotateIY[0246] = { mnemonic:"RES 4,(IY+d)", proc: procRES_xIDXd(4,"IY"), disasm: disaRES_xIDXd(4,"IY")};
    opeRotateIY[0256] = { mnemonic:"RES 5,(IY+d)", proc: procRES_xIDXd(5,"IY"), disasm: disaRES_xIDXd(5,"IY")};
    opeRotateIY[0266] = { mnemonic:"RES 6,(IY+d)", proc: procRES_xIDXd(6,"IY"), disasm: disaRES_xIDXd(6,"IY")};
    opeRotateIY[0276] = { mnemonic:"RES 7,(IY+d)", proc: procRES_xIDXd(7,"IY"), disasm: disaRES_xIDXd(7,"IY")};

    //=================================================================================
    // ジャンプグループ
    //=================================================================================
    var disa_0x_r_110 = function(mem, addr) {
        var opecode = mem.peek(addr);
        var code = [opecode];
        var x = ((opecode & 0x40) != 0) ? 1 : 0;
        var r1 = (opecode >> 3) & 0x07;
        var r2 = (opecode >> 0) & 0x07;
		var operand = ["???","???"];
        
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
            mnemonic:   ["LD", operand[0] + "," + operand[1]] 
        };
    };
    var disaJumpGroup = function(mem, addr) {
        var opecode = mem.peek(addr);
        var code = [opecode];
        var mnemonic = [];
        var e,n0,n1;
        var ref_addr = null;

        switch(opecode & 0300) {
            case 0000:
                mnemonic.push("JR");
                e = Z80.getSignedByte(mem.peek(addr+1));
                ref_addr = addr + e + 2;
                code.push(e & 0xff);
                if(e + 2 >= 0) { e = "+" + (e + 2); } else { e = "" + (e + 2); }
                switch(opecode & 0070) {
                    case 0030: break;
                    case 0070: mnemonic.push("C"); break;
                    case 0050: mnemonic.push("Z"); break;
                    case 0060: mnemonic.push("NC"); break;
                    case 0040: mnemonic.push("NZ"); break;
                    default:
                        throw "UNKNOWN OPCODE";
                }
                mnemonic.push(ref_addr.HEX(4) + 'H;(' + e + ')' );
                break;
            case 0300:
                mnemonic.push("JP");
                switch(opecode & 0003) {
                    case 1: mnemonic.push("(HL)"); break;
                    case 2:
                        n0 = mem.peek(addr+1);
                        n1 = mem.peek(addr+2);
                        ref_addr = Z80.pair(n1, n0);
                        code.push(n0);
                        code.push(n1);
                        switch(opecode & 0070) {
                            case 0000: mnemonic.push("NZ"); break;
                            case 0010: mnemonic.push("Z");  break;
                            case 0020: mnemonic.push("NC"); break;
                            case 0030: mnemonic.push("C");  break;
                            case 0040: mnemonic.push("PO"); break;
                            case 0050: mnemonic.push("PE"); break;
                            case 0060: mnemonic.push("P");  break;
                            case 0070: mnemonic.push("M");  break;
                        }
                        mnemonic.push(n1.HEX(2) + n0.HEX(2) + 'H');
                        break;
                    case 3:
                        n0 = mem.peek(addr+1);
                        n1 = mem.peek(addr+2);
                        ref_addr = Z80.pair(n1, n0);
                        code.push(n0);
                        code.push(n1);
                        mnemonic.push(n1.HEX(2) + n0.HEX(2) + 'H');
                        break;
                }
                break;
            default:
                throw "UNKNOWN OPCODE";
        }
        return { code:code, mnemonic:mnemonic, ref_addr: ref_addr };
    };
    this.opecodeTable[0303] = { mnemonic:"JP nn",   proc: function() { var nn = THIS.fetchPair(); THIS.reg.PC = nn; }, disasm: disaJumpGroup };
    this.opecodeTable[0302] = { mnemonic:"JP NZ,nn",proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagZ()) { THIS.reg.PC = nn; } }, disasm: disaJumpGroup };
    this.opecodeTable[0312] = { mnemonic:"JP Z,nn", proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagZ())  { THIS.reg.PC = nn; } }, disasm: disaJumpGroup };
    this.opecodeTable[0322] = { mnemonic:"JP NC,nn",proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagC()) { THIS.reg.PC = nn; } }, disasm: disaJumpGroup };
    this.opecodeTable[0332] = { mnemonic:"JP C,nn", proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagC())  { THIS.reg.PC = nn; } }, disasm: disaJumpGroup };
    this.opecodeTable[0342] = { mnemonic:"JP PO,nn",proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagP()) { THIS.reg.PC = nn; } }, disasm: disaJumpGroup };
    this.opecodeTable[0352] = { mnemonic:"JP PE,nn",proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagP())  { THIS.reg.PC = nn; } }, disasm: disaJumpGroup };
    this.opecodeTable[0362] = { mnemonic:"JP P,nn", proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagS()) { THIS.reg.PC = nn; } }, disasm: disaJumpGroup };
    this.opecodeTable[0372] = { mnemonic:"JP M,nn", proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagS())  { THIS.reg.PC = nn; } }, disasm: disaJumpGroup };
    this.opecodeTable[0030] = { mnemonic:"JR e",    proc: function() { var e = THIS.fetch(); THIS.reg.jumpRel(e); }, disasm: disaJumpGroup };
    this.opecodeTable[0070] = { mnemonic:"JR C,e",  proc: function() { var e = THIS.fetch(); if(THIS.reg.flagC())   { THIS.reg.jumpRel(e); } }, disasm: disaJumpGroup };
    this.opecodeTable[0050] = { mnemonic:"JR Z,e",  proc: function() { var e = THIS.fetch(); if(THIS.reg.flagZ())   { THIS.reg.jumpRel(e); } }, disasm: disaJumpGroup };
    this.opecodeTable[0060] = { mnemonic:"JR NC,e", proc: function() { var e = THIS.fetch(); if(!THIS.reg.flagC())  { THIS.reg.jumpRel(e); } }, disasm: disaJumpGroup };
    this.opecodeTable[0040] = { mnemonic:"JR NZ,e", proc: function() { var e = THIS.fetch(); if(!THIS.reg.flagZ())  { THIS.reg.jumpRel(e); } }, disasm: disaJumpGroup };
    this.opecodeTable[0351] = { mnemonic:"JP (HL)", proc: function() { THIS.reg.PC = THIS.reg.getHL(); }, disasm: disaJumpGroup };
    opeIX[0351] = { mnemonic:"JP (IX)", proc: function() { THIS.reg.PC = THIS.reg.IX; }, disasm: function(mem,addr) { return {code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:['JP','(IX)'] }; }};
    opeIY[0351] = { mnemonic:"JP (IY)", proc: function() { THIS.reg.PC = THIS.reg.IY; }, disasm: function(mem,addr) { return {code:[mem.peek(addr), mem.peek(addr+1)], mnemonic:['JP','(IY)'] }; }};
    this.opecodeTable[0020] = { mnemonic:"DJNZ",
        proc: function() {
            var e = THIS.fetch();
            THIS.reg.decrement("B");
            if(THIS.reg.B) {
                THIS.reg.jumpRel(e);
            }
        },
        disasm: function(mem,addr) {
            var e = Z80.getSignedByte(mem.peek(addr+1));
            var ref_addr = addr + e + 2;
            return {
                code:[mem.peek(addr), mem.peek(addr + 1)],
                mnemonic:['DJNZ', ref_addr.HEX(4) + 'H;(' + (((e + 2 >= 0) ? "+" : "" ) + (e + 2)) + ')'],
                ref_addr: ref_addr
            };
        }
    };
    //=================================================================================
    // コールリターングループ
    //=================================================================================
    this.opecodeTable[0315] = { mnemonic:"CALL nn", proc: function() { var nn = THIS.fetchPair(); THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL",""+addr.HEX(4)+"H"],ref_addr:addr};}};
    this.opecodeTable[0304] = { mnemonic:"CALL NZ,nn",proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagZ()) { THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; } },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL","NZ",addr.HEX(4)+"H"],ref_addr:addr};}};
    this.opecodeTable[0314] = { mnemonic:"CALL Z,nn", proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagZ())  { THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; } },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL","Z",addr.HEX(4)+"H"],ref_addr:addr};}};
    this.opecodeTable[0324] = { mnemonic:"CALL NC,nn",proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagC()) { THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; } },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL","NC",addr.HEX(4)+"H"],ref_addr:addr};}};
    this.opecodeTable[0334] = { mnemonic:"CALL C,nn", proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagC())  { THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; } },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL","C",addr.HEX(4)+"H"],ref_addr:addr};}};
    this.opecodeTable[0344] = { mnemonic:"CALL PO,nn",proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagP()) { THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; } },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL","PO",addr.HEX(4)+"H"],ref_addr:addr};}};
    this.opecodeTable[0354] = { mnemonic:"CALL PE,nn",proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagP())  { THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; } },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL","PE",addr.HEX(4)+"H"],ref_addr:addr};}};
    this.opecodeTable[0364] = { mnemonic:"CALL P,nn", proc: function() { var nn = THIS.fetchPair(); if(!THIS.reg.flagS()) { THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; } },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL","P",addr.HEX(4)+"H"],ref_addr:addr};}};
    this.opecodeTable[0374] = { mnemonic:"CALL M,nn", proc: function() { var nn = THIS.fetchPair(); if(THIS.reg.flagS())  { THIS.pushPair(THIS.reg.PC); THIS.reg.PC = nn; } },
        disasm: function(m,a) {var l=m.peek(a+1),h=m.peek(a+2);var addr=Z80.pair(h,l);return{code:[m.peek(a),l,h],mnemonic:["CALL","M",addr.HEX(4)+"H"],ref_addr:addr};}};

    this.opecodeTable[0311] = { mnemonic:"RET", proc: function() { THIS.reg.PC = THIS.popPair(); },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET"]};}};
    this.opecodeTable[0300] = { mnemonic:"RET NZ",proc: function() { if(!THIS.reg.flagZ()) { THIS.reg.PC = THIS.popPair(); } },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET","NZ"]};}};
    this.opecodeTable[0310] = { mnemonic:"RET Z", proc: function() { if(THIS.reg.flagZ())  { THIS.reg.PC = THIS.popPair(); } },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET","Z"]};}};
    this.opecodeTable[0320] = { mnemonic:"RET NC",proc: function() { if(!THIS.reg.flagC()) { THIS.reg.PC = THIS.popPair(); } },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET","NC"]};}};
    this.opecodeTable[0330] = { mnemonic:"RET C", proc: function() { if(THIS.reg.flagC())  { THIS.reg.PC = THIS.popPair(); } },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET","C"]};}};
    this.opecodeTable[0340] = { mnemonic:"RET PO",proc: function() { if(!THIS.reg.flagP()) { THIS.reg.PC = THIS.popPair(); } },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET","PO"]};}};
    this.opecodeTable[0350] = { mnemonic:"RET PE",proc: function() { if(THIS.reg.flagP())  { THIS.reg.PC = THIS.popPair(); } },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET","PE"]};}};
    this.opecodeTable[0360] = { mnemonic:"RET P", proc: function() { if(!THIS.reg.flagS()) { THIS.reg.PC = THIS.popPair(); } },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET","P"]};}};
    this.opecodeTable[0370] = { mnemonic:"RET M", proc: function() { if(THIS.reg.flagS())  { THIS.reg.PC = THIS.popPair(); } },
        disasm: function(m,a) {return{code:[m.peek(a)],mnemonic:["RET","M"]};}};

    opeMisc[0115] = { mnemonic:"RETI",
        proc: function() {
            THIS.reg.PC = THIS.popPair();
            THIS.IFF1 = THIS.IFF2;
        },
        disasm: function(m,a) {return{code:[m.peek(a),m.peek(a+1)],mnemonic:["RETI"]};}};
    opeMisc[0105] = { mnemonic:"RETN",
        proc: function() {
            THIS.reg.PC = THIS.popPair();
            THIS.IFF1 = THIS.IFF2;
        },
        disasm: function(m,a) {return{code:[m.peek(a),m.peek(a+1)],mnemonic:["RETN"]};}};

    var rstVt=[0x00,0x08,0x10,0x18,0x20,0x28,0x30,0x38];
    for(var rstI = 0; rstI < rstVt.length; rstI++) {
        this.opecodeTable[0307 | (rstI << 3)] = {
            mnemonic: "RST " + rstVt[rstI].HEX(2) + "H",
            proc: (function(vec) {
                    return function() {
                        THIS.pushPair(THIS.reg.PC);
                        THIS.reg.PC = vec;
                    }
                })(rstVt[rstI]),
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
    this.opecodeTable[0333] = {
        mnemonic:"IN A,(n)",
        proc: function() { THIS.reg.A = THIS.readIoPort(THIS.fetch()); },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["IN", "A", "(" + mem.peek(addr+1) + ")"]
            };
        }
    };
    opeMisc[0100] = { mnemonic:"IN B,(C)", proc: function() { THIS.reg.B = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["IN", "B", "(C)"] }; } };
    opeMisc[0110] = { mnemonic:"IN C,(C)", proc: function() { THIS.reg.C = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["IN", "C", "(C)"] }; } };
    opeMisc[0120] = { mnemonic:"IN D,(C)", proc: function() { THIS.reg.D = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["IN", "D", "(C)"] }; } };
    opeMisc[0130] = { mnemonic:"IN E,(C)", proc: function() { THIS.reg.E = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["IN", "E", "(C)"] }; } };
    opeMisc[0140] = { mnemonic:"IN H,(C)", proc: function() { THIS.reg.H = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["IN", "H", "(C)"] }; } };
    opeMisc[0150] = { mnemonic:"IN L,(C)", proc: function() { THIS.reg.L = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["IN", "L", "(C)"] }; } };
    opeMisc[0160] = { mnemonic:"IN A,(C)", proc: function() { THIS.reg.A = THIS.readIoPort(THIS.reg.C); },
        disasm: function(mem,addr) { return { code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["IN", "A", "(C)"] }; } };
    opeMisc[0242] = { mnemonic:"INI", proc: function() {
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
    opeMisc[0262] = { mnemonic:"INIR", proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.C));
            THIS.postINI();
            if(THIS.reg.B != 0) {
                THIS.reg.PC -= 2;
            }
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["INIR"]
            };
        }
    };
    opeMisc[0252] = { mnemonic:"IND", proc: function() {
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
    opeMisc[0272] = { mnemonic:"INDR", proc: function() {
            THIS.reg.B = (THIS.reg.B - 1) & 0xff;
            THIS.memory.poke(THIS.reg.getHL(), THIS.readIoPort(THIS.reg.C));
            THIS.postIND();
            if(THIS.reg.B != 0) {
                THIS.reg.PC -= 2;
            }
        },
        disasm: function(mem,addr) {
            return {
                code:[mem.peek(addr),mem.peek(addr+1)],
                mnemonic:["INDR"]
            };
        }
    };
    this.opecodeTable[0323] = { mnemonic:"OUT (n),A", proc: function() { THIS.writeIoPort(THIS.fetch(), THIS.reg.A); },
        disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUT", "(" + mem.peek(addr+1) + ")", "A"]};} };
    opeMisc[0101] = { mnemonic:"OUT (C),B", proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.B); },
        disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUT", "(C)","B"]};} };
    opeMisc[0111] = { mnemonic:"OUT (C),C", proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.C); },
        disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUT", "(C)", "C"]};} };
    opeMisc[0121] = { mnemonic:"OUT (C),D", proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.D); },
        disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUT", "(C)", "D"]};} };
    opeMisc[0131] = { mnemonic:"OUT (C),E", proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.E); },
        disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUT", "(C)", "E"]};} };
    opeMisc[0141] = { mnemonic:"OUT (C),H", proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.H); },
        disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUT", "(C)", "H"]};} };
    opeMisc[0151] = { mnemonic:"OUT (C),L", proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.L); },
        disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUT", "(C)", "L"]};} };
    opeMisc[0161] = { mnemonic:"OUT (C),A", proc: function() { THIS.writeIoPort(THIS.reg.C, THIS.reg.A); },
        disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUT", "(C)", "A"]};} };
    opeMisc[0243] = { mnemonic:"OUTI", proc: function() {
        THIS.reg.B = (THIS.reg.B - 1) & 0xff;
        THIS.writeIoPort(THIS.reg.C, THIS.memory.peek(THIS.reg.getHL()));
        THIS.postOUTI();
    }, disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUTI"]};}};
    opeMisc[0263] = { mnemonic:"OTIR", proc: function() {
        THIS.reg.B = (THIS.reg.B - 1) & 0xff;
        THIS.writeIoPort(THIS.reg.C, THIS.memory.peek(THIS.reg.getHL()));
        THIS.postOUTI();
        if(THIS.reg.B != 0) {
            THIS.reg.PC -= 2;
        }
    }, disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OTIR"]};}};
    opeMisc[0253] = { mnemonic:"OUTD", proc: function() {
        THIS.reg.B = (THIS.reg.B - 1) & 0xff;
        THIS.writeIoPort(THIS.reg.C, THIS.memory.peek(THIS.reg.getHL()));
        THIS.postOUTD();
    }, disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OUTD"]};}};
    opeMisc[0273] = { mnemonic:"OTDR", proc: function() {
        THIS.reg.B = (THIS.reg.B - 1) & 0xff;
        THIS.writeIoPort(THIS.reg.C, THIS.memory.peek(THIS.reg.getHL()));
        THIS.postOUTD();
        if(THIS.reg.B != 0) {
            THIS.reg.PC -= 2;
        }
    }, disasm: function(mem,addr) { return {code:[mem.peek(addr),mem.peek(addr+1)], mnemonic:["OTDR"]};}};
}
