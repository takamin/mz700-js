var UnitTest = require("./UnitTest");
var fs = require('fs');
eval(fs.readFileSync('../lib/ex_number.js')+'');
eval(fs.readFileSync('../Z80/emulator.js')+'');
eval(fs.readFileSync('../Z80/register.js')+'');
eval(fs.readFileSync('../Z80/assembler.js')+'');
eval(fs.readFileSync('../Z80/memory.js')+'');
eval(fs.readFileSync('../MZ-700/emulator.js')+'');
eval(fs.readFileSync('../MZ-700/mztape.js')+'');
var line_asm_test_pattern = [
    { code:[0x00], mnemonic:"NOP" },
    { code:[0x01, 0x34, 0x12], mnemonic:"LD BC,1234H" },
    { code:[0x02], mnemonic:"LD (BC),A" },
    { code:[0x04], mnemonic:"INC B" },
    { code:[0x05], mnemonic:"DEC B" },
    { code:[0x06, 0x12], mnemonic:"LD B,12H" },
    { code:[0x08], mnemonic:"EX AF,AF'" },
    { code:[0x0A], mnemonic:"LD A,(BC)" },
    { code:[0x0C], mnemonic:"INC C" },
    { code:[0x0D], mnemonic:"DEC C" },
    { code:[0x0E, 0x12], mnemonic:"LD C,12H" },
    { code:[0x11, 0x34, 0x12], mnemonic:"LD DE,1234H" },
    { code:[0x12], mnemonic:"LD (DE),A" },
    { code:[0x14], mnemonic:"INC D" },
    { code:[0x15], mnemonic:"DEC D" },
    { code:[0x16, 0x12], mnemonic:"LD D,12H" },
    { code:[0x1A], mnemonic:"LD A,(DE)" },
    { code:[0x1C], mnemonic:"INC E" },
    { code:[0x1D], mnemonic:"DEC E" },
    { code:[0x1E, 0x12], mnemonic:"LD E,12H" },
    { code:[0x21, 0x34, 0x12], mnemonic:"LD HL,1234H" },
    { code:[0x22, 0x34, 0x12], mnemonic:"LD (1234H), HL" },
    { code:[0x24], mnemonic:"INC H" },
    { code:[0x25], mnemonic:"DEC H" },
    { code:[0x26, 0x12], mnemonic:"LD H,12H" },
    { code:[0x2A, 0x34, 0x12], mnemonic:"LD HL,(1234H)" },
    { code:[0x2C], mnemonic:"INC L" },
    { code:[0x2D], mnemonic:"DEC L" },
    { code:[0x2E, 0x12], mnemonic:"LD L,12H" },
    { code:[0x31, 0x34, 0x12], mnemonic:"LD SP,1234H" },
    { code:[0x32, 0x34, 0x12], mnemonic:"LD (1234H),A" },
    { code:[0x34], mnemonic:"INC (HL)" },
    { code:[0x35], mnemonic:"DEC (HL)" },
    { code:[0x36, 0x12], mnemonic:"LD (HL),12H" },
    { code:[0x3A, 0x34, 0x12], mnemonic:"LD A,(1234H)" },
    { code:[0x3C], mnemonic:"INC A" },
    { code:[0x3D], mnemonic:"DEC A" },
    { code:[0x3E, 0x12], mnemonic:"LD A,12H" },
    { code:[0x40], mnemonic:"LD B,B" },
    { code:[0x41], mnemonic:"LD B,C" },
    { code:[0x42], mnemonic:"LD B,D" },
    { code:[0x43], mnemonic:"LD B,E" },
    { code:[0x44], mnemonic:"LD B,H" },
    { code:[0x45], mnemonic:"LD B,L" },
    { code:[0x46], mnemonic:"LD B,(HL)" },
    { code:[0x47], mnemonic:"LD B,A" },
    { code:[0x48], mnemonic:"LD C,B" },
    { code:[0x49], mnemonic:"LD C,C" },
    { code:[0x4A], mnemonic:"LD C,D" },
    { code:[0x4B], mnemonic:"LD C,E" },
    { code:[0x4C], mnemonic:"LD C,H" },
    { code:[0x4D], mnemonic:"LD C,L" },
    { code:[0x4E], mnemonic:"LD C,(HL)" },
    { code:[0x4F], mnemonic:"LD C,A" },
    { code:[0x50], mnemonic:"LD D,B" },
    { code:[0x51], mnemonic:"LD D,C" },
    { code:[0x52], mnemonic:"LD D,D" },
    { code:[0x53], mnemonic:"LD D,E" },
    { code:[0x54], mnemonic:"LD D,H" },
    { code:[0x55], mnemonic:"LD D,L" },
    { code:[0x56], mnemonic:"LD D,(HL)" },
    { code:[0x57], mnemonic:"LD D,A" },
    { code:[0x58], mnemonic:"LD E,B" },
    { code:[0x59], mnemonic:"LD E,C" },
    { code:[0x5A], mnemonic:"LD E,D" },
    { code:[0x5B], mnemonic:"LD E,E" },
    { code:[0x5C], mnemonic:"LD E,H" },
    { code:[0x5D], mnemonic:"LD E,L" },
    { code:[0x5E], mnemonic:"LD E,(HL)" },
    { code:[0x5F], mnemonic:"LD E,A" },
    { code:[0x60], mnemonic:"LD H,B" },
    { code:[0x61], mnemonic:"LD H,C" },
    { code:[0x62], mnemonic:"LD H,D" },
    { code:[0x63], mnemonic:"LD H,E" },
    { code:[0x64], mnemonic:"LD H,H" },
    { code:[0x65], mnemonic:"LD H,L" },
    { code:[0x66], mnemonic:"LD H,(HL)" },
    { code:[0x67], mnemonic:"LD H,A" },
    { code:[0x68], mnemonic:"LD L,B" },
    { code:[0x69], mnemonic:"LD L,C" },
    { code:[0x6A], mnemonic:"LD L,D" },
    { code:[0x6B], mnemonic:"LD L,E" },
    { code:[0x6C], mnemonic:"LD L,H" },
    { code:[0x6D], mnemonic:"LD L,L" },
    { code:[0x6E], mnemonic:"LD L,(HL)" },
    { code:[0x6F], mnemonic:"LD L,A" },
    { code:[0x70], mnemonic:"LD (HL),B" },
    { code:[0x71], mnemonic:"LD (HL),C" },
    { code:[0x72], mnemonic:"LD (HL),D" },
    { code:[0x73], mnemonic:"LD (HL),E" },
    { code:[0x74], mnemonic:"LD (HL),H" },
    { code:[0x75], mnemonic:"LD (HL),L" },
    { code:[0x77], mnemonic:"LD (HL),A" },
    { code:[0x78], mnemonic:"LD A,B" },
    { code:[0x79], mnemonic:"LD A,C" },
    { code:[0x7A], mnemonic:"LD A,D" },
    { code:[0x7B], mnemonic:"LD A,E" },
    { code:[0x7C], mnemonic:"LD A,H" },
    { code:[0x7D], mnemonic:"LD A,L" },
    { code:[0x7E], mnemonic:"LD A,(HL)" },
    { code:[0x7F], mnemonic:"LD A,A" },
    { code:[0x80], mnemonic:"ADD A,B" },
    { code:[0x81], mnemonic:"ADD A,C" },
    { code:[0x82], mnemonic:"ADD A,D" },
    { code:[0x83], mnemonic:"ADD A,E" },
    { code:[0x84], mnemonic:"ADD A,H" },
    { code:[0x85], mnemonic:"ADD A,L" },
    { code:[0x86], mnemonic:"ADD A,(HL)" },
    { code:[0x87], mnemonic:"ADD A,A" },
    { code:[0x88], mnemonic:"ADC A,B" },
    { code:[0x89], mnemonic:"ADC A,C" },
    { code:[0x8A], mnemonic:"ADC A,D" },
    { code:[0x8B], mnemonic:"ADC A,E" },
    { code:[0x8C], mnemonic:"ADC A,H" },
    { code:[0x8D], mnemonic:"ADC A,L" },
    { code:[0x8E], mnemonic:"ADC A,(HL)" },
    { code:[0x8F], mnemonic:"ADC A,A" },
    { code:[0x90], mnemonic:"SUB A,B" },
    { code:[0x91], mnemonic:"SUB A,C" },
    { code:[0x92], mnemonic:"SUB A,D" },
    { code:[0x93], mnemonic:"SUB A,E" },
    { code:[0x94], mnemonic:"SUB A,H" },
    { code:[0x95], mnemonic:"SUB A,L" },
    { code:[0x96], mnemonic:"SUB A,(HL)" },
    { code:[0x97], mnemonic:"SUB A,A" },
    { code:[0x98], mnemonic:"SBC A,B" },
    { code:[0x99], mnemonic:"SBC A,C" },
    { code:[0x9A], mnemonic:"SBC A,D" },
    { code:[0x9B], mnemonic:"SBC A,E" },
    { code:[0x9C], mnemonic:"SBC A,H" },
    { code:[0x9D], mnemonic:"SBC A,L" },
    { code:[0x9E], mnemonic:"SBC A,(HL)" },
    { code:[0x9F], mnemonic:"SBC A,A" },
    { code:[0xA0], mnemonic:"AND B" },
    { code:[0xA1], mnemonic:"AND C" },
    { code:[0xA2], mnemonic:"AND D" },
    { code:[0xA3], mnemonic:"AND E" },
    { code:[0xA4], mnemonic:"AND H" },
    { code:[0xA5], mnemonic:"AND L" },
    { code:[0xA6], mnemonic:"AND (HL)" },
    { code:[0xA7], mnemonic:"AND A" },
    { code:[0xA8], mnemonic:"XOR B" },
    { code:[0xA9], mnemonic:"XOR C" },
    { code:[0xAA], mnemonic:"XOR D" },
    { code:[0xAB], mnemonic:"XOR E" },
    { code:[0xAC], mnemonic:"XOR H" },
    { code:[0xAD], mnemonic:"XOR L" },
    { code:[0xAE], mnemonic:"XOR (HL)" },
    { code:[0xAF], mnemonic:"XOR A" },
    { code:[0xB0], mnemonic:"OR B" },
    { code:[0xB1], mnemonic:"OR C" },
    { code:[0xB2], mnemonic:"OR D" },
    { code:[0xB3], mnemonic:"OR E" },
    { code:[0xB4], mnemonic:"OR H" },
    { code:[0xB5], mnemonic:"OR L" },
    { code:[0xB6], mnemonic:"OR (HL)" },
    { code:[0xB7], mnemonic:"OR A" },
    { code:[0xB8], mnemonic:"CP B" },
    { code:[0xB9], mnemonic:"CP C" },
    { code:[0xBA], mnemonic:"CP D" },
    { code:[0xBB], mnemonic:"CP E" },
    { code:[0xBC], mnemonic:"CP H" },
    { code:[0xBD], mnemonic:"CP L" },
    { code:[0xBE], mnemonic:"CP (HL)" },
    { code:[0xBF], mnemonic:"CP A" },
    { code:[0xC1], mnemonic:"POP BC" },
    { code:[0xC5], mnemonic:"PUSH BC" },
    { code:[0xC6, 0x12], mnemonic:"ADD A,12H" },
    { code:[0xCE, 0x12], mnemonic:"ADC A,12H" },
    { code:[0xD1], mnemonic:"POP DE" },
    { code:[0xD5], mnemonic:"PUSH DE" },
    { code:[0xD6, 0x12], mnemonic:"SUB A,12H" },
    { code:[0xD9], mnemonic:"EXX" },
    { code:[0xDD, 0x21, 0x34, 0x12], mnemonic:"LD IX,1234H" },
    { code:[0xDD, 0x2A, 0x34, 0x12], mnemonic:"LD IX,(1234H)" },
    { code:[0xDD, 0x34, 0x23], mnemonic:"INC (IX+23H)" },
    { code:[0xDD, 0x34, 0x23], mnemonic:"INC (IX+ 23H)" },
    { code:[0xDD, 0x35, 0x23], mnemonic:"DEC (IX+ 23H)" },
    { code:[0xDD, 0x35, 0x23], mnemonic:"DEC (IX+23H)" },
    { code:[0xDD, 0x36, 0x23, 0x12], mnemonic:"LD (IX+23H),12H" },
    { code:[0xDD, 0x70, 0x23], mnemonic:"LD (IX+23H),B" },
    { code:[0xDD, 0x71, 0x23], mnemonic:"LD (IX+23H),C" },
    { code:[0xDD, 0x72, 0x23], mnemonic:"LD (IX+23H),D" },
    { code:[0xDD, 0x73, 0x23], mnemonic:"LD (IX+23H),E" },
    { code:[0xDD, 0x74, 0x23], mnemonic:"LD (IX+23H),H" },
    { code:[0xDD, 0x75, 0x23], mnemonic:"LD (IX+23H),L" },
    { code:[0xDD, 0x77, 0x23], mnemonic:"LD (IX+23H),A" },
    { code:[0xDD, 0x86, 0x23], mnemonic:"ADD A,(IX+23H)" },
    { code:[0xDD, 0x8E, 0x23], mnemonic:"ADC A,(IX+23H)" },
    { code:[0xDD, 0x96, 0x23], mnemonic:"SUB A,(IX+23H)" },
    { code:[0xDD, 0x9E, 0x23], mnemonic:"SBC A,(IX+23H)" },
    { code:[0xDD, 0xA6, 0x23], mnemonic:"AND (IX+23H)" },
    { code:[0xDD, 0xAE, 0x23], mnemonic:"XOR (IX+23H)" },
    { code:[0xDD, 0xB6, 0x23], mnemonic:"OR (IX+23H)" },
    { code:[0xDD, 0xBE, 0x23], mnemonic:"CP (IX+23H)" },
    { code:[0xDD, 0xE1], mnemonic:"POP IX" },
    { code:[0xDD, 0xE3], mnemonic:"EX (SP),IX" },
    { code:[0xDD, 0xE5], mnemonic:"PUSH IX" },
    { code:[0xDD, 0xF9], mnemonic:"LD SP,IX" },
    { code:[0xDE, 0x12], mnemonic:"SBC A,12H" },
    { code:[0xE1], mnemonic:"POP HL" },
    { code:[0xE3], mnemonic:"EX (SP),HL" },
    { code:[0xE5], mnemonic:"PUSH HL" },
    { code:[0xE6, 0x12], mnemonic:"AND 12H" },
    { code:[0xEB], mnemonic:"EX DE,HL " },
    { code:[0xED, 0x47], mnemonic:"LD I,A" },
    { code:[0xED, 0x4F], mnemonic:"LD R,A" },
    { code:[0xED, 0x57], mnemonic:"LD A,I" },
    { code:[0xED, 0x5F], mnemonic:"LD A,R" },
    { code:[0xED, 0240], mnemonic:"LDI" },
    { code:[0xED, 0260], mnemonic:"LDIR" },
    { code:[0xED, 0250], mnemonic:"LDD" },
    { code:[0xED, 0270], mnemonic:"LDDR" },
    { code:[0xED, 0241], mnemonic:"CPI" },
    { code:[0xED, 0261], mnemonic:"CPIR" },
    { code:[0xED, 0251], mnemonic:"CPD" },
    { code:[0xED, 0271], mnemonic:"CPDR" },
    { code:[0xEE, 0x12], mnemonic:"XOR 12H" },
    { code:[0047], mnemonic:'DAA' },
    { code:[0057], mnemonic:'CPL' },
    { code:[0355,0104], mnemonic:'NEG' },
    { code:[0077], mnemonic:'CCF' },
    { code:[0067], mnemonic:'SCF' },
    { code:[0000], mnemonic:'NOP' },
    { code:[0363], mnemonic:'DI' },
    { code:[0373], mnemonic:'EI' },
    { code:[0355,0106], mnemonic:'IM0' },
    { code:[0355,0126], mnemonic:'IM1' },
    { code:[0355,0136], mnemonic:'IM2' },
    { code:[0xF1], mnemonic:"POP AF" },
    { code:[0xF5], mnemonic:"PUSH AF" },
    { code:[0xF6, 0x12], mnemonic:"OR 12H" },
    { code:[0xF9], mnemonic:"LD SP,HL" },
    { code:[0xFD, 0x21, 0x34, 0x12], mnemonic:"LD IY,1234H" },
    { code:[0xFD, 0x2A, 0x34, 0x12], mnemonic:"LD IY,(1234H)" },
    { code:[0xFD, 0x34, 0x23], mnemonic:"INC (IY+23H)" },
    { code:[0xFD, 0x35, 0x23], mnemonic:"DEC (IY+23H)" },
    { code:[0xFD, 0x36, 0x23, 0x12], mnemonic:"LD (IY+23H),12H" },
    { code:[0xFD, 0x70, 0x23], mnemonic:"LD (IY+23H),B" },
    { code:[0xFD, 0x71, 0x23], mnemonic:"LD (IY+23H),C" },
    { code:[0xFD, 0x72, 0x23], mnemonic:"LD (IY+23H),D" },
    { code:[0xFD, 0x73, 0x23], mnemonic:"LD (IY+23H),E" },
    { code:[0xFD, 0x74, 0x23], mnemonic:"LD (IY+23H),H" },
    { code:[0xFD, 0x75, 0x23], mnemonic:"LD (IY+23H),L" },
    { code:[0xFD, 0x77, 0x23], mnemonic:"LD (IY+23H),A" },
    { code:[0xFD, 0x86, 0x23], mnemonic:"ADD A,(IY+23H)" },
    { code:[0xFD, 0x8E, 0x23], mnemonic:"ADC A,(IY+23H)" },
    { code:[0xFD, 0x96, 0x23], mnemonic:"SUB A,(IY+23H)" },
    { code:[0xFD, 0x9E, 0x23], mnemonic:"SBC A,(IY+23H)" },
    { code:[0xFD, 0xA6, 0x23], mnemonic:"AND (IY+23H)" },
    { code:[0xFD, 0xAE, 0x23], mnemonic:"XOR (IY+23H)" },
    { code:[0xFD, 0xB6, 0x23], mnemonic:"OR (IY+23H)" },
    { code:[0xFD, 0xBE, 0x23], mnemonic:"CP (IY+23H)" },
    { code:[0xFD, 0xE1], mnemonic:"POP IY" },
    { code:[0xFD, 0xE3], mnemonic:"EX (SP),IY" },
    { code:[0xFD, 0xE5], mnemonic:"PUSH IY" },
    { code:[0xFD, 0xF9], mnemonic:"LD SP,IY" },
    { code:[0xFE, 0x12], mnemonic:"CP 12H" },
    { code:[0011], mnemonic:"ADD HL,BC" },
    { code:[0031], mnemonic:"ADD HL,DE" },
    { code:[0051], mnemonic:"ADD HL,HL" },
    { code:[0071], mnemonic:"ADD HL,SP" },
    { code:[0355, 0112], mnemonic:"ADC HL,BC" },
    { code:[0355, 0132], mnemonic:"ADC HL,DE" },
    { code:[0355, 0152], mnemonic:"ADC HL,HL" },
    { code:[0355, 0172], mnemonic:"ADC HL,SP" },
    { code:[0355, 0102], mnemonic:"SBC HL,BC" },
    { code:[0355, 0122], mnemonic:"SBC HL,DE" },
    { code:[0355, 0142], mnemonic:"SBC HL,HL" },
    { code:[0355, 0162], mnemonic:"SBC HL,SP" },
    { code:[0335, 0011], mnemonic:"ADD IX,BC" },
    { code:[0335, 0031], mnemonic:"ADD IX,DE" },
    { code:[0335, 0051], mnemonic:"ADD IX,IX" },
    { code:[0335, 0071], mnemonic:"ADD IX,SP" },
    { code:[0375, 0011], mnemonic:"ADD IY,BC" },
    { code:[0375, 0031], mnemonic:"ADD IY,DE" },
    { code:[0375, 0051], mnemonic:"ADD IY,IY" },
    { code:[0375, 0071], mnemonic:"ADD IY,SP" },
    { code:[0003], mnemonic:"INC BC" },
    { code:[0023], mnemonic:"INC DE" },
    { code:[0043], mnemonic:"INC HL" },
    { code:[0063], mnemonic:"INC SP" },
    { code:[0335, 0043], mnemonic:"INC IX" },
    { code:[0375, 0043], mnemonic:"INC IY" },
    { code:[0013], mnemonic:"DEC BC" },
    { code:[0033], mnemonic:"DEC DE" },
    { code:[0053], mnemonic:"DEC HL" },
    { code:[0073], mnemonic:"DEC SP" },
    { code:[0335, 0053], mnemonic:"DEC IX" },
    { code:[0375, 0053], mnemonic:"DEC IY" },
    { code:[0007], mnemonic:"RLCA" },
    { code:[0027], mnemonic:"RLA" },
    { code:[0017], mnemonic:"RRCA" },
    { code:[0037], mnemonic:"RRA" },
    { code:[0313, 0000], mnemonic:"RLC B" },
    { code:[0313, 0001], mnemonic:"RLC C" },
    { code:[0313, 0002], mnemonic:"RLC D" },
    { code:[0313, 0003], mnemonic:"RLC E" },
    { code:[0313, 0004], mnemonic:"RLC H" },
    { code:[0313, 0005], mnemonic:"RLC L" },
    { code:[0313, 0007], mnemonic:"RLC A" },
    { code:[0313, 0006], mnemonic:"RLC (HL)" },
    { code:[0335, 0313, 0x98, 0006], mnemonic:"RLC (IX+98H)" },
    { code:[0375, 0313, 0x98, 0006], mnemonic:"RLC (IY+98H)" },
    { code:[0313, 0020], mnemonic:"RL B" },
    { code:[0313, 0021], mnemonic:"RL C" },
    { code:[0313, 0022], mnemonic:"RL D" },
    { code:[0313, 0023], mnemonic:"RL E" },
    { code:[0313, 0024], mnemonic:"RL H" },
    { code:[0313, 0025], mnemonic:"RL L" },
    { code:[0313, 0027], mnemonic:"RL A" },
    { code:[0313, 0026], mnemonic:"RL (HL)" },
    { code:[0335, 0313, 0x98, 0026], mnemonic:"RL (IX+98H)" },
    { code:[0375, 0313, 0x98, 0026], mnemonic:"RL (IY+98H)" },
    { code:[0313, 0010], mnemonic:"RRC B" },
    { code:[0313, 0011], mnemonic:"RRC C" },
    { code:[0313, 0012], mnemonic:"RRC D" },
    { code:[0313, 0013], mnemonic:"RRC E" },
    { code:[0313, 0014], mnemonic:"RRC H" },
    { code:[0313, 0015], mnemonic:"RRC L" },
    { code:[0313, 0017], mnemonic:"RRC A" },
    { code:[0313, 0016], mnemonic:"RRC (HL)" },
    { code:[0335, 0313, 0x98, 0016], mnemonic:"RRC (IX+98H)" },
    { code:[0375, 0313, 0x98, 0016], mnemonic:"RRC (IY+98H)" },
    { code:[0313, 0030], mnemonic:"RR B" },
    { code:[0313, 0031], mnemonic:"RR C" },
    { code:[0313, 0032], mnemonic:"RR D" },
    { code:[0313, 0033], mnemonic:"RR E" },
    { code:[0313, 0034], mnemonic:"RR H" },
    { code:[0313, 0035], mnemonic:"RR L" },
    { code:[0313, 0037], mnemonic:"RR A" },
    { code:[0313, 0036], mnemonic:"RR (HL)" },
    { code:[0335, 0313, 0x98, 0036], mnemonic:"RR (IX+98H)" },
    { code:[0375, 0313, 0x98, 0036], mnemonic:"RR (IY+98H)" },
    { code:[0313, 0040], mnemonic:"SLA B" },
    { code:[0313, 0041], mnemonic:"SLA C" },
    { code:[0313, 0042], mnemonic:"SLA D" },
    { code:[0313, 0043], mnemonic:"SLA E" },
    { code:[0313, 0044], mnemonic:"SLA H" },
    { code:[0313, 0045], mnemonic:"SLA L" },
    { code:[0313, 0047], mnemonic:"SLA A" },
    { code:[0313, 0046], mnemonic:"SLA (HL)" },
    { code:[0335, 0313, 0x98, 0046], mnemonic:"SLA (IX+98H)" },
    { code:[0375, 0313, 0x98, 0046], mnemonic:"SLA (IY+98H)" },
    { code:[0313, 0050], mnemonic:"SRA B" },
    { code:[0313, 0051], mnemonic:"SRA C" },
    { code:[0313, 0052], mnemonic:"SRA D" },
    { code:[0313, 0053], mnemonic:"SRA E" },
    { code:[0313, 0054], mnemonic:"SRA H" },
    { code:[0313, 0055], mnemonic:"SRA L" },
    { code:[0313, 0057], mnemonic:"SRA A" },
    { code:[0313, 0056], mnemonic:"SRA (HL)" },
    { code:[0335, 0313, 0x98, 0056], mnemonic:"SRA (IX+98H)" },
    { code:[0375, 0313, 0x98, 0056], mnemonic:"SRA (IY+98H)" },
    { code:[0313, 0070], mnemonic:"SRL B" },
    { code:[0313, 0071], mnemonic:"SRL C" },
    { code:[0313, 0072], mnemonic:"SRL D" },
    { code:[0313, 0073], mnemonic:"SRL E" },
    { code:[0313, 0074], mnemonic:"SRL H" },
    { code:[0313, 0075], mnemonic:"SRL L" },
    { code:[0313, 0077], mnemonic:"SRL A" },
    { code:[0313, 0076], mnemonic:"SRL (HL)" },
    { code:[0335, 0313, 0x98, 0076], mnemonic:"SRL (IX+98H)" },
    { code:[0375, 0313, 0x98, 0076], mnemonic:"SRL (IY+98H)" },
    { code:[0355, 0157], mnemonic:"RLD" },
    { code:[0355, 0147], mnemonic:"RRD" },

    { code:[0313, 0100], mnemonic:"BIT 0,B" },
    { code:[0313, 0110], mnemonic:"BIT 1,B" },
    { code:[0313, 0120], mnemonic:"BIT 2,B" },
    { code:[0313, 0130], mnemonic:"BIT 3,B" },
    { code:[0313, 0140], mnemonic:"BIT 4,B" },
    { code:[0313, 0150], mnemonic:"BIT 5,B" },
    { code:[0313, 0160], mnemonic:"BIT 6,B" },
    { code:[0313, 0170], mnemonic:"BIT 7,B" },

    { code:[0313, 0101], mnemonic:"BIT 0,C" },
    { code:[0313, 0111], mnemonic:"BIT 1,C" },
    { code:[0313, 0121], mnemonic:"BIT 2,C" },
    { code:[0313, 0131], mnemonic:"BIT 3,C" },
    { code:[0313, 0141], mnemonic:"BIT 4,C" },
    { code:[0313, 0151], mnemonic:"BIT 5,C" },
    { code:[0313, 0161], mnemonic:"BIT 6,C" },
    { code:[0313, 0171], mnemonic:"BIT 7,C" },

    { code:[0313, 0102], mnemonic:"BIT 0,D" },
    { code:[0313, 0112], mnemonic:"BIT 1,D" },
    { code:[0313, 0122], mnemonic:"BIT 2,D" },
    { code:[0313, 0132], mnemonic:"BIT 3,D" },
    { code:[0313, 0142], mnemonic:"BIT 4,D" },
    { code:[0313, 0152], mnemonic:"BIT 5,D" },
    { code:[0313, 0162], mnemonic:"BIT 6,D" },
    { code:[0313, 0172], mnemonic:"BIT 7,D" },

    { code:[0313, 0103], mnemonic:"BIT 0,E" },
    { code:[0313, 0113], mnemonic:"BIT 1,E" },
    { code:[0313, 0123], mnemonic:"BIT 2,E" },
    { code:[0313, 0133], mnemonic:"BIT 3,E" },
    { code:[0313, 0143], mnemonic:"BIT 4,E" },
    { code:[0313, 0153], mnemonic:"BIT 5,E" },
    { code:[0313, 0163], mnemonic:"BIT 6,E" },
    { code:[0313, 0173], mnemonic:"BIT 7,E" },

    { code:[0313, 0104], mnemonic:"BIT 0,H" },
    { code:[0313, 0114], mnemonic:"BIT 1,H" },
    { code:[0313, 0124], mnemonic:"BIT 2,H" },
    { code:[0313, 0134], mnemonic:"BIT 3,H" },
    { code:[0313, 0144], mnemonic:"BIT 4,H" },
    { code:[0313, 0154], mnemonic:"BIT 5,H" },
    { code:[0313, 0164], mnemonic:"BIT 6,H" },
    { code:[0313, 0174], mnemonic:"BIT 7,H" },

    { code:[0313, 0105], mnemonic:"BIT 0,L" },
    { code:[0313, 0115], mnemonic:"BIT 1,L" },
    { code:[0313, 0125], mnemonic:"BIT 2,L" },
    { code:[0313, 0135], mnemonic:"BIT 3,L" },
    { code:[0313, 0145], mnemonic:"BIT 4,L" },
    { code:[0313, 0155], mnemonic:"BIT 5,L" },
    { code:[0313, 0165], mnemonic:"BIT 6,L" },
    { code:[0313, 0175], mnemonic:"BIT 7,L" },

    { code:[0313, 0107], mnemonic:"BIT 0,A" },
    { code:[0313, 0117], mnemonic:"BIT 1,A" },
    { code:[0313, 0127], mnemonic:"BIT 2,A" },
    { code:[0313, 0137], mnemonic:"BIT 3,A" },
    { code:[0313, 0147], mnemonic:"BIT 4,A" },
    { code:[0313, 0157], mnemonic:"BIT 5,A" },
    { code:[0313, 0167], mnemonic:"BIT 6,A" },
    { code:[0313, 0177], mnemonic:"BIT 7,A" },

    { code:[0313, 0106], mnemonic:"BIT 0,(HL)" },
    { code:[0313, 0116], mnemonic:"BIT 1,(HL)" },
    { code:[0313, 0126], mnemonic:"BIT 2,(HL)" },
    { code:[0313, 0136], mnemonic:"BIT 3,(HL)" },
    { code:[0313, 0146], mnemonic:"BIT 4,(HL)" },
    { code:[0313, 0156], mnemonic:"BIT 5,(HL)" },
    { code:[0313, 0166], mnemonic:"BIT 6,(HL)" },
    { code:[0313, 0176], mnemonic:"BIT 7,(HL)" },

    { code:[0335, 0313, 0x89, 0106], mnemonic:"BIT 0,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0116], mnemonic:"BIT 1,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0126], mnemonic:"BIT 2,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0136], mnemonic:"BIT 3,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0146], mnemonic:"BIT 4,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0156], mnemonic:"BIT 5,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0166], mnemonic:"BIT 6,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0176], mnemonic:"BIT 7,(IX+89H)" },

    { code:[0375, 0313, 0x89, 0106], mnemonic:"BIT 0,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0116], mnemonic:"BIT 1,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0126], mnemonic:"BIT 2,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0136], mnemonic:"BIT 3,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0146], mnemonic:"BIT 4,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0156], mnemonic:"BIT 5,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0166], mnemonic:"BIT 6,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0176], mnemonic:"BIT 7,(IY+89H)" },

    { code:[0313, 0300], mnemonic:"SET 0,B" },
    { code:[0313, 0310], mnemonic:"SET 1,B" },
    { code:[0313, 0320], mnemonic:"SET 2,B" },
    { code:[0313, 0330], mnemonic:"SET 3,B" },
    { code:[0313, 0340], mnemonic:"SET 4,B" },
    { code:[0313, 0350], mnemonic:"SET 5,B" },
    { code:[0313, 0360], mnemonic:"SET 6,B" },
    { code:[0313, 0370], mnemonic:"SET 7,B" },

    { code:[0313, 0301], mnemonic:"SET 0,C" },
    { code:[0313, 0311], mnemonic:"SET 1,C" },
    { code:[0313, 0321], mnemonic:"SET 2,C" },
    { code:[0313, 0331], mnemonic:"SET 3,C" },
    { code:[0313, 0341], mnemonic:"SET 4,C" },
    { code:[0313, 0351], mnemonic:"SET 5,C" },
    { code:[0313, 0361], mnemonic:"SET 6,C" },
    { code:[0313, 0371], mnemonic:"SET 7,C" },

    { code:[0313, 0302], mnemonic:"SET 0,D" },
    { code:[0313, 0312], mnemonic:"SET 1,D" },
    { code:[0313, 0322], mnemonic:"SET 2,D" },
    { code:[0313, 0332], mnemonic:"SET 3,D" },
    { code:[0313, 0342], mnemonic:"SET 4,D" },
    { code:[0313, 0352], mnemonic:"SET 5,D" },
    { code:[0313, 0362], mnemonic:"SET 6,D" },
    { code:[0313, 0372], mnemonic:"SET 7,D" },

    { code:[0313, 0303], mnemonic:"SET 0,E" },
    { code:[0313, 0313], mnemonic:"SET 1,E" },
    { code:[0313, 0323], mnemonic:"SET 2,E" },
    { code:[0313, 0333], mnemonic:"SET 3,E" },
    { code:[0313, 0343], mnemonic:"SET 4,E" },
    { code:[0313, 0353], mnemonic:"SET 5,E" },
    { code:[0313, 0363], mnemonic:"SET 6,E" },
    { code:[0313, 0373], mnemonic:"SET 7,E" },

    { code:[0313, 0304], mnemonic:"SET 0,H" },
    { code:[0313, 0314], mnemonic:"SET 1,H" },
    { code:[0313, 0324], mnemonic:"SET 2,H" },
    { code:[0313, 0334], mnemonic:"SET 3,H" },
    { code:[0313, 0344], mnemonic:"SET 4,H" },
    { code:[0313, 0354], mnemonic:"SET 5,H" },
    { code:[0313, 0364], mnemonic:"SET 6,H" },
    { code:[0313, 0374], mnemonic:"SET 7,H" },

    { code:[0313, 0305], mnemonic:"SET 0,L" },
    { code:[0313, 0315], mnemonic:"SET 1,L" },
    { code:[0313, 0325], mnemonic:"SET 2,L" },
    { code:[0313, 0335], mnemonic:"SET 3,L" },
    { code:[0313, 0345], mnemonic:"SET 4,L" },
    { code:[0313, 0355], mnemonic:"SET 5,L" },
    { code:[0313, 0365], mnemonic:"SET 6,L" },
    { code:[0313, 0375], mnemonic:"SET 7,L" },

    { code:[0313, 0307], mnemonic:"SET 0,A" },
    { code:[0313, 0317], mnemonic:"SET 1,A" },
    { code:[0313, 0327], mnemonic:"SET 2,A" },
    { code:[0313, 0337], mnemonic:"SET 3,A" },
    { code:[0313, 0347], mnemonic:"SET 4,A" },
    { code:[0313, 0357], mnemonic:"SET 5,A" },
    { code:[0313, 0367], mnemonic:"SET 6,A" },
    { code:[0313, 0377], mnemonic:"SET 7,A" },

    { code:[0313, 0306], mnemonic:"SET 0,(HL)" },
    { code:[0313, 0316], mnemonic:"SET 1,(HL)" },
    { code:[0313, 0326], mnemonic:"SET 2,(HL)" },
    { code:[0313, 0336], mnemonic:"SET 3,(HL)" },
    { code:[0313, 0346], mnemonic:"SET 4,(HL)" },
    { code:[0313, 0356], mnemonic:"SET 5,(HL)" },
    { code:[0313, 0366], mnemonic:"SET 6,(HL)" },
    { code:[0313, 0376], mnemonic:"SET 7,(HL)" },

    { code:[0335, 0313, 0x89, 0306], mnemonic:"SET 0,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0316], mnemonic:"SET 1,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0326], mnemonic:"SET 2,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0336], mnemonic:"SET 3,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0346], mnemonic:"SET 4,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0356], mnemonic:"SET 5,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0366], mnemonic:"SET 6,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0376], mnemonic:"SET 7,(IX+89H)" },

    { code:[0375, 0313, 0x89, 0306], mnemonic:"SET 0,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0316], mnemonic:"SET 1,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0326], mnemonic:"SET 2,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0336], mnemonic:"SET 3,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0346], mnemonic:"SET 4,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0356], mnemonic:"SET 5,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0366], mnemonic:"SET 6,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0376], mnemonic:"SET 7,(IY+89H)" },

    { code:[0313, 0200], mnemonic:"RES 0,B" },
    { code:[0313, 0210], mnemonic:"RES 1,B" },
    { code:[0313, 0220], mnemonic:"RES 2,B" },
    { code:[0313, 0230], mnemonic:"RES 3,B" },
    { code:[0313, 0240], mnemonic:"RES 4,B" },
    { code:[0313, 0250], mnemonic:"RES 5,B" },
    { code:[0313, 0260], mnemonic:"RES 6,B" },
    { code:[0313, 0270], mnemonic:"RES 7,B" },

    { code:[0313, 0201], mnemonic:"RES 0,C" },
    { code:[0313, 0211], mnemonic:"RES 1,C" },
    { code:[0313, 0221], mnemonic:"RES 2,C" },
    { code:[0313, 0231], mnemonic:"RES 3,C" },
    { code:[0313, 0241], mnemonic:"RES 4,C" },
    { code:[0313, 0251], mnemonic:"RES 5,C" },
    { code:[0313, 0261], mnemonic:"RES 6,C" },
    { code:[0313, 0271], mnemonic:"RES 7,C" },

    { code:[0313, 0202], mnemonic:"RES 0,D" },
    { code:[0313, 0212], mnemonic:"RES 1,D" },
    { code:[0313, 0222], mnemonic:"RES 2,D" },
    { code:[0313, 0232], mnemonic:"RES 3,D" },
    { code:[0313, 0242], mnemonic:"RES 4,D" },
    { code:[0313, 0252], mnemonic:"RES 5,D" },
    { code:[0313, 0262], mnemonic:"RES 6,D" },
    { code:[0313, 0272], mnemonic:"RES 7,D" },

    { code:[0313, 0203], mnemonic:"RES 0,E" },
    { code:[0313, 0213], mnemonic:"RES 1,E" },
    { code:[0313, 0223], mnemonic:"RES 2,E" },
    { code:[0313, 0233], mnemonic:"RES 3,E" },
    { code:[0313, 0243], mnemonic:"RES 4,E" },
    { code:[0313, 0253], mnemonic:"RES 5,E" },
    { code:[0313, 0263], mnemonic:"RES 6,E" },
    { code:[0313, 0273], mnemonic:"RES 7,E" },

    { code:[0313, 0204], mnemonic:"RES 0,H" },
    { code:[0313, 0214], mnemonic:"RES 1,H" },
    { code:[0313, 0224], mnemonic:"RES 2,H" },
    { code:[0313, 0234], mnemonic:"RES 3,H" },
    { code:[0313, 0244], mnemonic:"RES 4,H" },
    { code:[0313, 0254], mnemonic:"RES 5,H" },
    { code:[0313, 0264], mnemonic:"RES 6,H" },
    { code:[0313, 0274], mnemonic:"RES 7,H" },

    { code:[0313, 0205], mnemonic:"RES 0,L" },
    { code:[0313, 0215], mnemonic:"RES 1,L" },
    { code:[0313, 0225], mnemonic:"RES 2,L" },
    { code:[0313, 0235], mnemonic:"RES 3,L" },
    { code:[0313, 0245], mnemonic:"RES 4,L" },
    { code:[0313, 0255], mnemonic:"RES 5,L" },
    { code:[0313, 0265], mnemonic:"RES 6,L" },
    { code:[0313, 0275], mnemonic:"RES 7,L" },

    { code:[0313, 0207], mnemonic:"RES 0,A" },
    { code:[0313, 0217], mnemonic:"RES 1,A" },
    { code:[0313, 0227], mnemonic:"RES 2,A" },
    { code:[0313, 0237], mnemonic:"RES 3,A" },
    { code:[0313, 0247], mnemonic:"RES 4,A" },
    { code:[0313, 0257], mnemonic:"RES 5,A" },
    { code:[0313, 0267], mnemonic:"RES 6,A" },
    { code:[0313, 0277], mnemonic:"RES 7,A" },

    { code:[0313, 0206], mnemonic:"RES 0,(HL)" },
    { code:[0313, 0216], mnemonic:"RES 1,(HL)" },
    { code:[0313, 0226], mnemonic:"RES 2,(HL)" },
    { code:[0313, 0236], mnemonic:"RES 3,(HL)" },
    { code:[0313, 0246], mnemonic:"RES 4,(HL)" },
    { code:[0313, 0256], mnemonic:"RES 5,(HL)" },
    { code:[0313, 0266], mnemonic:"RES 6,(HL)" },
    { code:[0313, 0276], mnemonic:"RES 7,(HL)" },

    { code:[0335, 0313, 0x89, 0206], mnemonic:"RES 0,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0216], mnemonic:"RES 1,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0226], mnemonic:"RES 2,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0236], mnemonic:"RES 3,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0246], mnemonic:"RES 4,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0256], mnemonic:"RES 5,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0266], mnemonic:"RES 6,(IX+89H)" },
    { code:[0335, 0313, 0x89, 0276], mnemonic:"RES 7,(IX+89H)" },

    { code:[0375, 0313, 0x89, 0206], mnemonic:"RES 0,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0216], mnemonic:"RES 1,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0226], mnemonic:"RES 2,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0236], mnemonic:"RES 3,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0246], mnemonic:"RES 4,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0256], mnemonic:"RES 5,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0266], mnemonic:"RES 6,(IY+89H)" },
    { code:[0375, 0313, 0x89, 0276], mnemonic:"RES 7,(IY+89H)" },

    { code:[0303, 0x01, 0x00], mnemonic:"JP 0001h" },
    { code:[0302, 0x34, 0x12], mnemonic:"JP NZ,1234H" },
    { code:[0312, 0x34, 0x12], mnemonic:"JP Z,1234H" },
    { code:[0322, 0x34, 0x12], mnemonic:"JP NC,1234H" },
    { code:[0332, 0x34, 0x12], mnemonic:"JP C,1234H" },
    { code:[0342, 0x34, 0x12], mnemonic:"JP PO,1234H" },
    { code:[0352, 0x34, 0x12], mnemonic:"JP PE,1234H" },
    { code:[0362, 0x34, 0x12], mnemonic:"JP P,1234H" },
    { code:[0372, 0x34, 0x12], mnemonic:"JP M,1234H" },

    { code:[0030, 0x10], mnemonic:"JR 12H" },
    { code:[0040, 0x10], mnemonic:"JR NZ,12H" },
    { code:[0050, 0x10], mnemonic:"JR Z,12H" },
    { code:[0060, 0x10], mnemonic:"JR NC,12H" },
    { code:[0070, 0x10], mnemonic:"JR C,12H" },

    { code:[0351], mnemonic:"JP (HL)" },
    { code:[0335, 0351], mnemonic:"JP (IX)" },
    { code:[0375, 0351], mnemonic:"JP (IY)" },

    { code:[0020, 0x32], mnemonic:"DJNZ 34H" },

    { code:[0315, 0x01, 0x00], mnemonic:"CALL 0001H" },
    { code:[0304, 0x34, 0x12], mnemonic:"CALL NZ,1234H" },
    { code:[0314, 0x34, 0x12], mnemonic:"CALL Z,1234H" },
    { code:[0324, 0x34, 0x12], mnemonic:"CALL NC,1234H" },
    { code:[0334, 0x34, 0x12], mnemonic:"CALL C,1234H" },
    { code:[0344, 0x34, 0x12], mnemonic:"CALL PO,1234H" },
    { code:[0354, 0x34, 0x12], mnemonic:"CALL PE,1234H" },
    { code:[0364, 0x34, 0x12], mnemonic:"CALL P,1234H" },
    { code:[0374, 0x34, 0x12], mnemonic:"CALL M,1234H" },

    { code:[0311], mnemonic:"RET" },
    { code:[0300], mnemonic:"RET NZ" },
    { code:[0310], mnemonic:"RET Z" },
    { code:[0320], mnemonic:"RET NC" },
    { code:[0330], mnemonic:"RET C" },
    { code:[0340], mnemonic:"RET PO" },
    { code:[0350], mnemonic:"RET PE" },
    { code:[0360], mnemonic:"RET P" },
    { code:[0370], mnemonic:"RET M" },

    { code:[0355, 0115], mnemonic:"RETI" },
    { code:[0355, 0105], mnemonic:"RETN" },

    { code:[0307], mnemonic:"RST 00H" },
    { code:[0317], mnemonic:"RST 08H" },
    { code:[0327], mnemonic:"RST 10H" },
    { code:[0337], mnemonic:"RST 18H" },
    { code:[0347], mnemonic:"RST 20H" },
    { code:[0357], mnemonic:"RST 28H" },
    { code:[0367], mnemonic:"RST 30H" },
    { code:[0377], mnemonic:"RST 38H" },

    { code:[0333,0x23], mnemonic:"IN A,(23H)" },
    { code:[0355,0100], mnemonic:"IN B,(C)" },
    { code:[0355,0110], mnemonic:"IN C,(C)" },
    { code:[0355,0120], mnemonic:"IN D,(C)" },
    { code:[0355,0130], mnemonic:"IN E,(C)" },
    { code:[0355,0140], mnemonic:"IN H,(C)" },
    { code:[0355,0150], mnemonic:"IN L,(C)" },
    { code:[0355,0170], mnemonic:"IN A,(C)" },
    { code:[0355,0252], mnemonic:"IND" },
    { code:[0355,0262], mnemonic:"INIR" },
    { code:[0355,0252], mnemonic:"IND" },
    { code:[0355,0272], mnemonic:"INDR" },

    { code:[0323,0x23], mnemonic:"OUT (23H),A" },
    { code:[0355,0101], mnemonic:"OUT (C),B" },
    { code:[0355,0111], mnemonic:"OUT (C),C" },
    { code:[0355,0121], mnemonic:"OUT (C),D" },
    { code:[0355,0131], mnemonic:"OUT (C),E" },
    { code:[0355,0141], mnemonic:"OUT (C),H" },
    { code:[0355,0151], mnemonic:"OUT (C),L" },
    { code:[0355,0171], mnemonic:"OUT (C),A" },
    { code:[0355,0243], mnemonic:"OUTI" },
    { code:[0355,0263], mnemonic:"OTIR" },
    { code:[0355,0253], mnemonic:"OUTD" },
    { code:[0355,0273], mnemonic:"OTDR" },

    { code:[0166], mnemonic:'HALT' },
];
module.exports = {
    name: "Z80 Assembler",
    test: function() {
        for(var i = 0; i < line_asm_test_pattern.length; i++) {
            var test_name = line_asm_test_pattern[i].mnemonic;
            var test_result = true;
            var test_detail = "";
            var asmlist = new Z80_assemble(line_asm_test_pattern[i].mnemonic);
            if(asmlist == null || asmlist.length <= 0) {
                test_result = false;
                test_detail = " FAIL TO TRANSLATE.";
            } else {
                var codes = [];
                asmlist.list.forEach(function(asmline) {
                    if("bytecode" in asmline && asmline.bytecode.length > 0) {
                        asmline.bytecode.forEach(function(code) {
                            codes.push(code);
                        });
                    }
                });
                //var codes = asmlist.list[0].bytecode;
                if(line_asm_test_pattern[i].code.length != codes.length) {
                    test_result = false;
                    test_detail = " LENGTH DIFFER.";
                } else {
                    for(var j = 0; j < line_asm_test_pattern[i].code.length; j++) {
                        if(line_asm_test_pattern[i].code[j] != codes[j]) {
                            test_result = false;
                            test_detail = " CODES DIFFER.";
                            break;
                        }
                    }
                }
                if(!test_result) {
                    test_detail += " expect:"
                    for(var j = 0; j < line_asm_test_pattern[i].code.length; j++) {
                        test_detail += " " + line_asm_test_pattern[i].code[j].HEX(2);
                    }
                    test_detail += "(" + line_asm_test_pattern[i].code.length + "bytes)"; 
                    test_detail += " result:";
                    for(var j = 0; j < codes.length; j++) {
                        test_detail += " " + codes[j].HEX(2);
                    }
                    test_detail += "(" + codes.length + "bytes)"; 
                }
            }
            UnitTest.report(test_name, test_result, test_detail);
        }
        for(var i = 0; i < line_asm_test_pattern.length; i++) {
            var code = line_asm_test_pattern[i].code;
            var test_name = "DISASSEMBLE ["
                + code.map( function(c) { return c.HEX(2); }).join(' ')
                + '] to "' + line_asm_test_pattern[i].mnemonic + '"';
            var test_result = true;
            var test_detail = "";
            var buf = new Buffer(code);
            var dasmlist = Z80.dasm(buf);
            var addr = 0;
            dasmlist.forEach(function(mnemonicInfo) {
                if(!test_result) {
                    return;
                }
                try {
                    if(isNaN(mnemonicInfo.addr)) {
                        return;
                    }
                    var binsrcCode = line_asm_test_pattern[i].code.map(
                            function(c) { return c.HEX(2); }).join(' ')
                    var disasmCode = mnemonicInfo.code.map(
                            function(c) { return c.HEX(2); }).join(' ')
                    if(binsrcCode != disasmCode) {
                        console.log("");
                        console.log("## " + test_name);
                        console.log("");
                        test_result = false;
                        test_detail = "Disasm codes are not equals to source binary.";
                        console.log("BINSRC SOURCE:" + binsrcCode);
                        console.log("DISASM SOURCE:" + disasmCode);
                        console.log(
                            mnemonicInfo.addr.HEX(4) + "\t"
                            + disasmCode + "\t"
                            + ((mnemonicInfo.mnemonic.length == 0) ? '':
                                mnemonicInfo.mnemonic[0] + "\t"
                                + mnemonicInfo.mnemonic.slice(1).join(",")));
                        return;
                    }
                    var disasmMnemonic = '';
                    if(mnemonicInfo.mnemonic.length > 0) {
                        disasmMnemonic = mnemonicInfo.mnemonic[0];
                        if(mnemonicInfo.mnemonic.length > 1) {
                            disasmMnemonic += " " + mnemonicInfo.mnemonic.slice(1).join(",");
                        }
                    }
                    disasmMnemonic = disasmMnemonic.replace(/;.*$/, '');
                    disasmMnemonic = disasmMnemonic.toUpperCase();
                    disasmMnemonic = disasmMnemonic.replace(/\b([0-9]+)\b/,
                            function() { return parseInt(arguments[1]).HEX(4)+"H"; });
                    disasmMnemonic = disasmMnemonic.replace(/\b0+([1-9A-F]+H)\b/, function() {return arguments[1] });
                    disasmMnemonic = disasmMnemonic.replace(/ /g, '');
                    var sourceMnemonic = line_asm_test_pattern[i].mnemonic
                    sourceMnemonic = sourceMnemonic.toUpperCase();
                    sourceMnemonic = sourceMnemonic.replace(/\b([0-9]+)\b/,
                            function() { return parseInt(arguments[1]).HEX(4)+"H"; });
                    sourceMnemonic = sourceMnemonic.replace(/\b0+([1-9A-F]+H)\b/, function() {return arguments[1] });
                    sourceMnemonic = sourceMnemonic.replace(/ /g, '');
                    if(disasmMnemonic != sourceMnemonic) {
                        console.log("");
                        console.log("## " + test_name);
                        console.log("");
                        test_result = false;
                        test_detail = "Disasm Mnemonics are not equals to source.";
                        console.log("");
                        console.log("*** DISASSEMBLED RESULT UNMATCH");
                        console.log("    DISASSEMBLED:" + disasmMnemonic);
                        console.log("     SOURCE CODE:" + line_asm_test_pattern[i].mnemonic);
                        console.log(
                            mnemonicInfo.addr.HEX(4) + "\t"
                            + disasmCode + "\t"
                            + ((mnemonicInfo.mnemonic.length == 0) ? '':
                                mnemonicInfo.mnemonic[0] + "\t"
                                + mnemonicInfo.mnemonic.slice(1).join(",")));
                        console.log("");
                    }
                }
                catch(ex) {
                    console.log("*** EXCEPTION " + ex);
                    console.log("*** EXCEPTION FAIL to " + test_name);
                    console.log(JSON.stringify(mnemonicInfo,null,"  "));
                }
            });
            UnitTest.report(test_name, test_result, test_detail);
        }
    }
};
