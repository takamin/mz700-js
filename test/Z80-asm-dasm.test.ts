describe("Z80 ASM-DASM", ()=>{
    const UnitTest = require("./lib/UnitTest");
    const NumberUtil = require("../lib/number-util");
    const Z80 = require('../Z80/Z80');
    const Z80_assemble = require('../Z80/assembler');
    const line_asm_test_pattern = [
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
        { code:[0xDD, 0x22, 0x34, 0x12], mnemonic:"LD (1234H),IX" },
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
        { code:[0xED, 0o240], mnemonic:"LDI" },
        { code:[0xED, 0o260], mnemonic:"LDIR" },
        { code:[0xED, 0o250], mnemonic:"LDD" },
        { code:[0xED, 0o270], mnemonic:"LDDR" },
        { code:[0xED, 0o241], mnemonic:"CPI" },
        { code:[0xED, 0o261], mnemonic:"CPIR" },
        { code:[0xED, 0o251], mnemonic:"CPD" },
        { code:[0xED, 0o271], mnemonic:"CPDR" },
        { code:[0xEE, 0x12], mnemonic:"XOR 12H" },
        { code:[0o047], mnemonic:'DAA' },
        { code:[0o057], mnemonic:'CPL' },
        { code:[0o355,0o104], mnemonic:'NEG' },
        { code:[0o077], mnemonic:'CCF' },
        { code:[0o067], mnemonic:'SCF' },
        { code:[0o000], mnemonic:'NOP' },
        { code:[0o363], mnemonic:'DI' },
        { code:[0o373], mnemonic:'EI' },
        { code:[0o355,0o106], mnemonic:'IM0' },
        { code:[0o355,0o126], mnemonic:'IM1' },
        { code:[0o355,0o136], mnemonic:'IM2' },
        { code:[0xF1], mnemonic:"POP AF" },
        { code:[0xF5], mnemonic:"PUSH AF" },
        { code:[0xF6, 0x12], mnemonic:"OR 12H" },
        { code:[0xF9], mnemonic:"LD SP,HL" },
        { code:[0xFD, 0x21, 0x34, 0x12], mnemonic:"LD IY,1234H" },
        { code:[0xFD, 0x22, 0x34, 0x12], mnemonic:"LD (1234H),IY" },
        { code:[0xFD, 0x2A, 0x34, 0x12], mnemonic:"LD IY,(1234H)" },
        { code:[0xFD, 0x34, 0x23], mnemonic:"INC (IY+23H)" },
        { code:[0xFD, 0x35, 0x23], mnemonic:"DEC (IY+23H)" },
        { code:[0xFD, 0x36, 0x23, 0x12], mnemonic:"LD (IY+23H),12H" },
        { code:[0xFD, 0x70, 0xff], mnemonic:"LD (IY-1),B" },
        { code:[0xFD, 0x70, 0x80], mnemonic:"LD (IY-128),B" },
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
        { code:[0o011], mnemonic:"ADD HL,BC" },
        { code:[0o031], mnemonic:"ADD HL,DE" },
        { code:[0o051], mnemonic:"ADD HL,HL" },
        { code:[0o071], mnemonic:"ADD HL,SP" },
        { code:[0o355, 0o112], mnemonic:"ADC HL,BC" },
        { code:[0o355, 0o132], mnemonic:"ADC HL,DE" },
        { code:[0o355, 0o152], mnemonic:"ADC HL,HL" },
        { code:[0o355, 0o172], mnemonic:"ADC HL,SP" },
        { code:[0o355, 0o102], mnemonic:"SBC HL,BC" },
        { code:[0o355, 0o122], mnemonic:"SBC HL,DE" },
        { code:[0o355, 0o142], mnemonic:"SBC HL,HL" },
        { code:[0o355, 0o162], mnemonic:"SBC HL,SP" },
        { code:[0o335, 0o011], mnemonic:"ADD IX,BC" },
        { code:[0o335, 0o031], mnemonic:"ADD IX,DE" },
        { code:[0o335, 0o051], mnemonic:"ADD IX,IX" },
        { code:[0o335, 0o071], mnemonic:"ADD IX,SP" },
        { code:[0o375, 0o011], mnemonic:"ADD IY,BC" },
        { code:[0o375, 0o031], mnemonic:"ADD IY,DE" },
        { code:[0o375, 0o051], mnemonic:"ADD IY,IY" },
        { code:[0o375, 0o071], mnemonic:"ADD IY,SP" },
        { code:[0o003], mnemonic:"INC BC" },
        { code:[0o023], mnemonic:"INC DE" },
        { code:[0o043], mnemonic:"INC HL" },
        { code:[0o063], mnemonic:"INC SP" },
        { code:[0o335, 0o043], mnemonic:"INC IX" },
        { code:[0o375, 0o043], mnemonic:"INC IY" },
        { code:[0o013], mnemonic:"DEC BC" },
        { code:[0o033], mnemonic:"DEC DE" },
        { code:[0o053], mnemonic:"DEC HL" },
        { code:[0o073], mnemonic:"DEC SP" },
        { code:[0o335, 0o053], mnemonic:"DEC IX" },
        { code:[0o375, 0o053], mnemonic:"DEC IY" },
        { code:[0o007], mnemonic:"RLCA" },
        { code:[0o027], mnemonic:"RLA" },
        { code:[0o017], mnemonic:"RRCA" },
        { code:[0o037], mnemonic:"RRA" },
        { code:[0o313, 0o000], mnemonic:"RLC B" },
        { code:[0o313, 0o001], mnemonic:"RLC C" },
        { code:[0o313, 0o002], mnemonic:"RLC D" },
        { code:[0o313, 0o003], mnemonic:"RLC E" },
        { code:[0o313, 0o004], mnemonic:"RLC H" },
        { code:[0o313, 0o005], mnemonic:"RLC L" },
        { code:[0o313, 0o007], mnemonic:"RLC A" },
        { code:[0o313, 0o006], mnemonic:"RLC (HL)" },
        { code:[0o335, 0o313, 0x7f, 0o006], mnemonic:"RLC (IX+127)" },
        { code:[0o375, 0o313, 0x01, 0o006], mnemonic:"RLC (IY+1)" },
        { code:[0o313, 0o020], mnemonic:"RL B" },
        { code:[0o313, 0o021], mnemonic:"RL C" },
        { code:[0o313, 0o022], mnemonic:"RL D" },
        { code:[0o313, 0o023], mnemonic:"RL E" },
        { code:[0o313, 0o024], mnemonic:"RL H" },
        { code:[0o313, 0o025], mnemonic:"RL L" },
        { code:[0o313, 0o027], mnemonic:"RL A" },
        { code:[0o313, 0o026], mnemonic:"RL (HL)" },
        { code:[0o335, 0o313, 0x7f, 0o026], mnemonic:"RL (IX+7fH)" },
        { code:[0o375, 0o313, 0x01, 0o026], mnemonic:"RL (IY+01H)" },
        { code:[0o313, 0o010], mnemonic:"RRC B" },
        { code:[0o313, 0o011], mnemonic:"RRC C" },
        { code:[0o313, 0o012], mnemonic:"RRC D" },
        { code:[0o313, 0o013], mnemonic:"RRC E" },
        { code:[0o313, 0o014], mnemonic:"RRC H" },
        { code:[0o313, 0o015], mnemonic:"RRC L" },
        { code:[0o313, 0o017], mnemonic:"RRC A" },
        { code:[0o313, 0o016], mnemonic:"RRC (HL)" },
        { code:[0o335, 0o313, 0x7f, 0o016], mnemonic:"RRC (IX+7fH)" },
        { code:[0o375, 0o313, 0x01, 0o016], mnemonic:"RRC (IY+01H)" },
        { code:[0o313, 0o030], mnemonic:"RR B" },
        { code:[0o313, 0o031], mnemonic:"RR C" },
        { code:[0o313, 0o032], mnemonic:"RR D" },
        { code:[0o313, 0o033], mnemonic:"RR E" },
        { code:[0o313, 0o034], mnemonic:"RR H" },
        { code:[0o313, 0o035], mnemonic:"RR L" },
        { code:[0o313, 0o037], mnemonic:"RR A" },
        { code:[0o313, 0o036], mnemonic:"RR (HL)" },
        { code:[0o335, 0o313, 0x7f, 0o036], mnemonic:"RR (IX+7fH)" },
        { code:[0o375, 0o313, 0x01, 0o036], mnemonic:"RR (IY+01H)" },
        { code:[0o313, 0o040], mnemonic:"SLA B" },
        { code:[0o313, 0o041], mnemonic:"SLA C" },
        { code:[0o313, 0o042], mnemonic:"SLA D" },
        { code:[0o313, 0o043], mnemonic:"SLA E" },
        { code:[0o313, 0o044], mnemonic:"SLA H" },
        { code:[0o313, 0o045], mnemonic:"SLA L" },
        { code:[0o313, 0o047], mnemonic:"SLA A" },
        { code:[0o313, 0o046], mnemonic:"SLA (HL)" },
        { code:[0o335, 0o313, 0x7f, 0o046], mnemonic:"SLA (IX+7fH)" },
        { code:[0o375, 0o313, 0x01, 0o046], mnemonic:"SLA (IY+01H)" },
        { code:[0o313, 0o050], mnemonic:"SRA B" },
        { code:[0o313, 0o051], mnemonic:"SRA C" },
        { code:[0o313, 0o052], mnemonic:"SRA D" },
        { code:[0o313, 0o053], mnemonic:"SRA E" },
        { code:[0o313, 0o054], mnemonic:"SRA H" },
        { code:[0o313, 0o055], mnemonic:"SRA L" },
        { code:[0o313, 0o057], mnemonic:"SRA A" },
        { code:[0o313, 0o056], mnemonic:"SRA (HL)" },
        { code:[0o335, 0o313, 0x7f, 0o056], mnemonic:"SRA (IX+7fH)" },
        { code:[0o375, 0o313, 0x01, 0o056], mnemonic:"SRA (IY+01H)" },
        { code:[0o313, 0o070], mnemonic:"SRL B" },
        { code:[0o313, 0o071], mnemonic:"SRL C" },
        { code:[0o313, 0o072], mnemonic:"SRL D" },
        { code:[0o313, 0o073], mnemonic:"SRL E" },
        { code:[0o313, 0o074], mnemonic:"SRL H" },
        { code:[0o313, 0o075], mnemonic:"SRL L" },
        { code:[0o313, 0o077], mnemonic:"SRL A" },
        { code:[0o313, 0o076], mnemonic:"SRL (HL)" },
        { code:[0o335, 0o313, 0x7f, 0o076], mnemonic:"SRL (IX+7fH)" },
        { code:[0o375, 0o313, 0x01, 0o076], mnemonic:"SRL (IY+01H)" },
        { code:[0o355, 0o157], mnemonic:"RLD" },
        { code:[0o355, 0o147], mnemonic:"RRD" },

        { code:[0o313, 0o100], mnemonic:"BIT 0,B" },
        { code:[0o313, 0o110], mnemonic:"BIT 1,B" },
        { code:[0o313, 0o120], mnemonic:"BIT 2,B" },
        { code:[0o313, 0o130], mnemonic:"BIT 3,B" },
        { code:[0o313, 0o140], mnemonic:"BIT 4,B" },
        { code:[0o313, 0o150], mnemonic:"BIT 5,B" },
        { code:[0o313, 0o160], mnemonic:"BIT 6,B" },
        { code:[0o313, 0o170], mnemonic:"BIT 7,B" },

        { code:[0o313, 0o101], mnemonic:"BIT 0,C" },
        { code:[0o313, 0o111], mnemonic:"BIT 1,C" },
        { code:[0o313, 0o121], mnemonic:"BIT 2,C" },
        { code:[0o313, 0o131], mnemonic:"BIT 3,C" },
        { code:[0o313, 0o141], mnemonic:"BIT 4,C" },
        { code:[0o313, 0o151], mnemonic:"BIT 5,C" },
        { code:[0o313, 0o161], mnemonic:"BIT 6,C" },
        { code:[0o313, 0o171], mnemonic:"BIT 7,C" },

        { code:[0o313, 0o102], mnemonic:"BIT 0,D" },
        { code:[0o313, 0o112], mnemonic:"BIT 1,D" },
        { code:[0o313, 0o122], mnemonic:"BIT 2,D" },
        { code:[0o313, 0o132], mnemonic:"BIT 3,D" },
        { code:[0o313, 0o142], mnemonic:"BIT 4,D" },
        { code:[0o313, 0o152], mnemonic:"BIT 5,D" },
        { code:[0o313, 0o162], mnemonic:"BIT 6,D" },
        { code:[0o313, 0o172], mnemonic:"BIT 7,D" },

        { code:[0o313, 0o103], mnemonic:"BIT 0,E" },
        { code:[0o313, 0o113], mnemonic:"BIT 1,E" },
        { code:[0o313, 0o123], mnemonic:"BIT 2,E" },
        { code:[0o313, 0o133], mnemonic:"BIT 3,E" },
        { code:[0o313, 0o143], mnemonic:"BIT 4,E" },
        { code:[0o313, 0o153], mnemonic:"BIT 5,E" },
        { code:[0o313, 0o163], mnemonic:"BIT 6,E" },
        { code:[0o313, 0o173], mnemonic:"BIT 7,E" },

        { code:[0o313, 0o104], mnemonic:"BIT 0,H" },
        { code:[0o313, 0o114], mnemonic:"BIT 1,H" },
        { code:[0o313, 0o124], mnemonic:"BIT 2,H" },
        { code:[0o313, 0o134], mnemonic:"BIT 3,H" },
        { code:[0o313, 0o144], mnemonic:"BIT 4,H" },
        { code:[0o313, 0o154], mnemonic:"BIT 5,H" },
        { code:[0o313, 0o164], mnemonic:"BIT 6,H" },
        { code:[0o313, 0o174], mnemonic:"BIT 7,H" },

        { code:[0o313, 0o105], mnemonic:"BIT 0,L" },
        { code:[0o313, 0o115], mnemonic:"BIT 1,L" },
        { code:[0o313, 0o125], mnemonic:"BIT 2,L" },
        { code:[0o313, 0o135], mnemonic:"BIT 3,L" },
        { code:[0o313, 0o145], mnemonic:"BIT 4,L" },
        { code:[0o313, 0o155], mnemonic:"BIT 5,L" },
        { code:[0o313, 0o165], mnemonic:"BIT 6,L" },
        { code:[0o313, 0o175], mnemonic:"BIT 7,L" },

        { code:[0o313, 0o107], mnemonic:"BIT 0,A" },
        { code:[0o313, 0o117], mnemonic:"BIT 1,A" },
        { code:[0o313, 0o127], mnemonic:"BIT 2,A" },
        { code:[0o313, 0o137], mnemonic:"BIT 3,A" },
        { code:[0o313, 0o147], mnemonic:"BIT 4,A" },
        { code:[0o313, 0o157], mnemonic:"BIT 5,A" },
        { code:[0o313, 0o167], mnemonic:"BIT 6,A" },
        { code:[0o313, 0o177], mnemonic:"BIT 7,A" },

        { code:[0o313, 0o106], mnemonic:"BIT 0,(HL)" },
        { code:[0o313, 0o116], mnemonic:"BIT 1,(HL)" },
        { code:[0o313, 0o126], mnemonic:"BIT 2,(HL)" },
        { code:[0o313, 0o136], mnemonic:"BIT 3,(HL)" },
        { code:[0o313, 0o146], mnemonic:"BIT 4,(HL)" },
        { code:[0o313, 0o156], mnemonic:"BIT 5,(HL)" },
        { code:[0o313, 0o166], mnemonic:"BIT 6,(HL)" },
        { code:[0o313, 0o176], mnemonic:"BIT 7,(HL)" },

        { code:[0o335, 0o313, 0x89, 0o106], mnemonic:"BIT 0,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o116], mnemonic:"BIT 1,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o126], mnemonic:"BIT 2,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o136], mnemonic:"BIT 3,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o146], mnemonic:"BIT 4,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o156], mnemonic:"BIT 5,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o166], mnemonic:"BIT 6,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o176], mnemonic:"BIT 7,(IX+89H)" },

        { code:[0o375, 0o313, 0x89, 0o106], mnemonic:"BIT 0,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o116], mnemonic:"BIT 1,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o126], mnemonic:"BIT 2,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o136], mnemonic:"BIT 3,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o146], mnemonic:"BIT 4,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o156], mnemonic:"BIT 5,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o166], mnemonic:"BIT 6,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o176], mnemonic:"BIT 7,(IY+89H)" },

        { code:[0o313, 0o300], mnemonic:"SET 0,B" },
        { code:[0o313, 0o310], mnemonic:"SET 1,B" },
        { code:[0o313, 0o320], mnemonic:"SET 2,B" },
        { code:[0o313, 0o330], mnemonic:"SET 3,B" },
        { code:[0o313, 0o340], mnemonic:"SET 4,B" },
        { code:[0o313, 0o350], mnemonic:"SET 5,B" },
        { code:[0o313, 0o360], mnemonic:"SET 6,B" },
        { code:[0o313, 0o370], mnemonic:"SET 7,B" },

        { code:[0o313, 0o301], mnemonic:"SET 0,C" },
        { code:[0o313, 0o311], mnemonic:"SET 1,C" },
        { code:[0o313, 0o321], mnemonic:"SET 2,C" },
        { code:[0o313, 0o331], mnemonic:"SET 3,C" },
        { code:[0o313, 0o341], mnemonic:"SET 4,C" },
        { code:[0o313, 0o351], mnemonic:"SET 5,C" },
        { code:[0o313, 0o361], mnemonic:"SET 6,C" },
        { code:[0o313, 0o371], mnemonic:"SET 7,C" },

        { code:[0o313, 0o302], mnemonic:"SET 0,D" },
        { code:[0o313, 0o312], mnemonic:"SET 1,D" },
        { code:[0o313, 0o322], mnemonic:"SET 2,D" },
        { code:[0o313, 0o332], mnemonic:"SET 3,D" },
        { code:[0o313, 0o342], mnemonic:"SET 4,D" },
        { code:[0o313, 0o352], mnemonic:"SET 5,D" },
        { code:[0o313, 0o362], mnemonic:"SET 6,D" },
        { code:[0o313, 0o372], mnemonic:"SET 7,D" },

        { code:[0o313, 0o303], mnemonic:"SET 0,E" },
        { code:[0o313, 0o313], mnemonic:"SET 1,E" },
        { code:[0o313, 0o323], mnemonic:"SET 2,E" },
        { code:[0o313, 0o333], mnemonic:"SET 3,E" },
        { code:[0o313, 0o343], mnemonic:"SET 4,E" },
        { code:[0o313, 0o353], mnemonic:"SET 5,E" },
        { code:[0o313, 0o363], mnemonic:"SET 6,E" },
        { code:[0o313, 0o373], mnemonic:"SET 7,E" },

        { code:[0o313, 0o304], mnemonic:"SET 0,H" },
        { code:[0o313, 0o314], mnemonic:"SET 1,H" },
        { code:[0o313, 0o324], mnemonic:"SET 2,H" },
        { code:[0o313, 0o334], mnemonic:"SET 3,H" },
        { code:[0o313, 0o344], mnemonic:"SET 4,H" },
        { code:[0o313, 0o354], mnemonic:"SET 5,H" },
        { code:[0o313, 0o364], mnemonic:"SET 6,H" },
        { code:[0o313, 0o374], mnemonic:"SET 7,H" },

        { code:[0o313, 0o305], mnemonic:"SET 0,L" },
        { code:[0o313, 0o315], mnemonic:"SET 1,L" },
        { code:[0o313, 0o325], mnemonic:"SET 2,L" },
        { code:[0o313, 0o335], mnemonic:"SET 3,L" },
        { code:[0o313, 0o345], mnemonic:"SET 4,L" },
        { code:[0o313, 0o355], mnemonic:"SET 5,L" },
        { code:[0o313, 0o365], mnemonic:"SET 6,L" },
        { code:[0o313, 0o375], mnemonic:"SET 7,L" },

        { code:[0o313, 0o307], mnemonic:"SET 0,A" },
        { code:[0o313, 0o317], mnemonic:"SET 1,A" },
        { code:[0o313, 0o327], mnemonic:"SET 2,A" },
        { code:[0o313, 0o337], mnemonic:"SET 3,A" },
        { code:[0o313, 0o347], mnemonic:"SET 4,A" },
        { code:[0o313, 0o357], mnemonic:"SET 5,A" },
        { code:[0o313, 0o367], mnemonic:"SET 6,A" },
        { code:[0o313, 0o377], mnemonic:"SET 7,A" },

        { code:[0o313, 0o306], mnemonic:"SET 0,(HL)" },
        { code:[0o313, 0o316], mnemonic:"SET 1,(HL)" },
        { code:[0o313, 0o326], mnemonic:"SET 2,(HL)" },
        { code:[0o313, 0o336], mnemonic:"SET 3,(HL)" },
        { code:[0o313, 0o346], mnemonic:"SET 4,(HL)" },
        { code:[0o313, 0o356], mnemonic:"SET 5,(HL)" },
        { code:[0o313, 0o366], mnemonic:"SET 6,(HL)" },
        { code:[0o313, 0o376], mnemonic:"SET 7,(HL)" },

        { code:[0o335, 0o313, 0x89, 0o306], mnemonic:"SET 0,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o316], mnemonic:"SET 1,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o326], mnemonic:"SET 2,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o336], mnemonic:"SET 3,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o346], mnemonic:"SET 4,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o356], mnemonic:"SET 5,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o366], mnemonic:"SET 6,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o376], mnemonic:"SET 7,(IX+89H)" },

        { code:[0o375, 0o313, 0x89, 0o306], mnemonic:"SET 0,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o316], mnemonic:"SET 1,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o326], mnemonic:"SET 2,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o336], mnemonic:"SET 3,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o346], mnemonic:"SET 4,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o356], mnemonic:"SET 5,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o366], mnemonic:"SET 6,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o376], mnemonic:"SET 7,(IY+89H)" },

        { code:[0o313, 0o200], mnemonic:"RES 0,B" },
        { code:[0o313, 0o210], mnemonic:"RES 1,B" },
        { code:[0o313, 0o220], mnemonic:"RES 2,B" },
        { code:[0o313, 0o230], mnemonic:"RES 3,B" },
        { code:[0o313, 0o240], mnemonic:"RES 4,B" },
        { code:[0o313, 0o250], mnemonic:"RES 5,B" },
        { code:[0o313, 0o260], mnemonic:"RES 6,B" },
        { code:[0o313, 0o270], mnemonic:"RES 7,B" },

        { code:[0o313, 0o201], mnemonic:"RES 0,C" },
        { code:[0o313, 0o211], mnemonic:"RES 1,C" },
        { code:[0o313, 0o221], mnemonic:"RES 2,C" },
        { code:[0o313, 0o231], mnemonic:"RES 3,C" },
        { code:[0o313, 0o241], mnemonic:"RES 4,C" },
        { code:[0o313, 0o251], mnemonic:"RES 5,C" },
        { code:[0o313, 0o261], mnemonic:"RES 6,C" },
        { code:[0o313, 0o271], mnemonic:"RES 7,C" },

        { code:[0o313, 0o202], mnemonic:"RES 0,D" },
        { code:[0o313, 0o212], mnemonic:"RES 1,D" },
        { code:[0o313, 0o222], mnemonic:"RES 2,D" },
        { code:[0o313, 0o232], mnemonic:"RES 3,D" },
        { code:[0o313, 0o242], mnemonic:"RES 4,D" },
        { code:[0o313, 0o252], mnemonic:"RES 5,D" },
        { code:[0o313, 0o262], mnemonic:"RES 6,D" },
        { code:[0o313, 0o272], mnemonic:"RES 7,D" },

        { code:[0o313, 0o203], mnemonic:"RES 0,E" },
        { code:[0o313, 0o213], mnemonic:"RES 1,E" },
        { code:[0o313, 0o223], mnemonic:"RES 2,E" },
        { code:[0o313, 0o233], mnemonic:"RES 3,E" },
        { code:[0o313, 0o243], mnemonic:"RES 4,E" },
        { code:[0o313, 0o253], mnemonic:"RES 5,E" },
        { code:[0o313, 0o263], mnemonic:"RES 6,E" },
        { code:[0o313, 0o273], mnemonic:"RES 7,E" },

        { code:[0o313, 0o204], mnemonic:"RES 0,H" },
        { code:[0o313, 0o214], mnemonic:"RES 1,H" },
        { code:[0o313, 0o224], mnemonic:"RES 2,H" },
        { code:[0o313, 0o234], mnemonic:"RES 3,H" },
        { code:[0o313, 0o244], mnemonic:"RES 4,H" },
        { code:[0o313, 0o254], mnemonic:"RES 5,H" },
        { code:[0o313, 0o264], mnemonic:"RES 6,H" },
        { code:[0o313, 0o274], mnemonic:"RES 7,H" },

        { code:[0o313, 0o205], mnemonic:"RES 0,L" },
        { code:[0o313, 0o215], mnemonic:"RES 1,L" },
        { code:[0o313, 0o225], mnemonic:"RES 2,L" },
        { code:[0o313, 0o235], mnemonic:"RES 3,L" },
        { code:[0o313, 0o245], mnemonic:"RES 4,L" },
        { code:[0o313, 0o255], mnemonic:"RES 5,L" },
        { code:[0o313, 0o265], mnemonic:"RES 6,L" },
        { code:[0o313, 0o275], mnemonic:"RES 7,L" },

        { code:[0o313, 0o207], mnemonic:"RES 0,A" },
        { code:[0o313, 0o217], mnemonic:"RES 1,A" },
        { code:[0o313, 0o227], mnemonic:"RES 2,A" },
        { code:[0o313, 0o237], mnemonic:"RES 3,A" },
        { code:[0o313, 0o247], mnemonic:"RES 4,A" },
        { code:[0o313, 0o257], mnemonic:"RES 5,A" },
        { code:[0o313, 0o267], mnemonic:"RES 6,A" },
        { code:[0o313, 0o277], mnemonic:"RES 7,A" },

        { code:[0o313, 0o206], mnemonic:"RES 0,(HL)" },
        { code:[0o313, 0o216], mnemonic:"RES 1,(HL)" },
        { code:[0o313, 0o226], mnemonic:"RES 2,(HL)" },
        { code:[0o313, 0o236], mnemonic:"RES 3,(HL)" },
        { code:[0o313, 0o246], mnemonic:"RES 4,(HL)" },
        { code:[0o313, 0o256], mnemonic:"RES 5,(HL)" },
        { code:[0o313, 0o266], mnemonic:"RES 6,(HL)" },
        { code:[0o313, 0o276], mnemonic:"RES 7,(HL)" },

        { code:[0o335, 0o313, 0x89, 0o206], mnemonic:"RES 0,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o216], mnemonic:"RES 1,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o226], mnemonic:"RES 2,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o236], mnemonic:"RES 3,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o246], mnemonic:"RES 4,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o256], mnemonic:"RES 5,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o266], mnemonic:"RES 6,(IX+89H)" },
        { code:[0o335, 0o313, 0x89, 0o276], mnemonic:"RES 7,(IX+89H)" },

        { code:[0o375, 0o313, 0x89, 0o206], mnemonic:"RES 0,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o216], mnemonic:"RES 1,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o226], mnemonic:"RES 2,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o236], mnemonic:"RES 3,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o246], mnemonic:"RES 4,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o256], mnemonic:"RES 5,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o266], mnemonic:"RES 6,(IY+89H)" },
        { code:[0o375, 0o313, 0x89, 0o276], mnemonic:"RES 7,(IY+89H)" },

        { code:[0o303, 0x01, 0x00], mnemonic:"JP 0001h" },
        { code:[0o302, 0x34, 0x12], mnemonic:"JP NZ,1234H" },
        { code:[0o312, 0x34, 0x12], mnemonic:"JP Z,1234H" },
        { code:[0o322, 0x34, 0x12], mnemonic:"JP NC,1234H" },
        { code:[0o332, 0x34, 0x12], mnemonic:"JP C,1234H" },
        { code:[0o342, 0x34, 0x12], mnemonic:"JP PO,1234H" },
        { code:[0o352, 0x34, 0x12], mnemonic:"JP PE,1234H" },
        { code:[0o362, 0x34, 0x12], mnemonic:"JP P,1234H" },
        { code:[0o372, 0x34, 0x12], mnemonic:"JP M,1234H" },

        { code:[0o030, 0x10], mnemonic:"JR 12H" },
        { code:[0o040, 0x10], mnemonic:"JR NZ,12H" },
        { code:[0o050, 0x10], mnemonic:"JR Z,12H" },
        { code:[0o060, 0x10], mnemonic:"JR NC,12H" },
        { code:[0o070, 0x10], mnemonic:"JR C,12H" },

        { code:[0o351], mnemonic:"JP (HL)" },
        { code:[0o335, 0o351], mnemonic:"JP (IX)" },
        { code:[0o375, 0o351], mnemonic:"JP (IY)" },

        { code:[0o020, 0x32], mnemonic:"DJNZ 34H" },

        { code:[0o315, 0x01, 0x00], mnemonic:"CALL 0001H" },
        { code:[0o304, 0x34, 0x12], mnemonic:"CALL NZ,1234H" },
        { code:[0o314, 0x34, 0x12], mnemonic:"CALL Z,1234H" },
        { code:[0o324, 0x34, 0x12], mnemonic:"CALL NC,1234H" },
        { code:[0o334, 0x34, 0x12], mnemonic:"CALL C,1234H" },
        { code:[0o344, 0x34, 0x12], mnemonic:"CALL PO,1234H" },
        { code:[0o354, 0x34, 0x12], mnemonic:"CALL PE,1234H" },
        { code:[0o364, 0x34, 0x12], mnemonic:"CALL P,1234H" },
        { code:[0o374, 0x34, 0x12], mnemonic:"CALL M,1234H" },

        { code:[0o311], mnemonic:"RET" },
        { code:[0o300], mnemonic:"RET NZ" },
        { code:[0o310], mnemonic:"RET Z" },
        { code:[0o320], mnemonic:"RET NC" },
        { code:[0o330], mnemonic:"RET C" },
        { code:[0o340], mnemonic:"RET PO" },
        { code:[0o350], mnemonic:"RET PE" },
        { code:[0o360], mnemonic:"RET P" },
        { code:[0o370], mnemonic:"RET M" },

        { code:[0o355, 0o115], mnemonic:"RETI" },
        { code:[0o355, 0o105], mnemonic:"RETN" },

        { code:[0o307], mnemonic:"RST 00H" },
        { code:[0o317], mnemonic:"RST 08H" },
        { code:[0o327], mnemonic:"RST 10H" },
        { code:[0o337], mnemonic:"RST 18H" },
        { code:[0o347], mnemonic:"RST 20H" },
        { code:[0o357], mnemonic:"RST 28H" },
        { code:[0o367], mnemonic:"RST 30H" },
        { code:[0o377], mnemonic:"RST 38H" },

        { code:[0o333,0x23], mnemonic:"IN A,(23H)" },
        { code:[0o355,0o100], mnemonic:"IN B,(C)" },
        { code:[0o355,0o110], mnemonic:"IN C,(C)" },
        { code:[0o355,0o120], mnemonic:"IN D,(C)" },
        { code:[0o355,0o130], mnemonic:"IN E,(C)" },
        { code:[0o355,0o140], mnemonic:"IN H,(C)" },
        { code:[0o355,0o150], mnemonic:"IN L,(C)" },
        { code:[0o355,0o170], mnemonic:"IN A,(C)" },
        { code:[0o355,0o252], mnemonic:"IND" },
        { code:[0o355,0o262], mnemonic:"INIR" },
        { code:[0o355,0o252], mnemonic:"IND" },
        { code:[0o355,0o272], mnemonic:"INDR" },

        { code:[0o323,0x23], mnemonic:"OUT (23H),A" },
        { code:[0o355,0o101], mnemonic:"OUT (C),B" },
        { code:[0o355,0o111], mnemonic:"OUT (C),C" },
        { code:[0o355,0o121], mnemonic:"OUT (C),D" },
        { code:[0o355,0o131], mnemonic:"OUT (C),E" },
        { code:[0o355,0o141], mnemonic:"OUT (C),H" },
        { code:[0o355,0o151], mnemonic:"OUT (C),L" },
        { code:[0o355,0o171], mnemonic:"OUT (C),A" },
        { code:[0o355,0o243], mnemonic:"OUTI" },
        { code:[0o355,0o263], mnemonic:"OTIR" },
        { code:[0o355,0o253], mnemonic:"OUTD" },
        { code:[0o355,0o273], mnemonic:"OTDR" },

        { code:[0o166], mnemonic:'HALT' },

        { code:[0xDD, 0x70, 0xff], mnemonic:"LD (IX-1),B" },
        { code:[0xDD, 0x70, 0x80], mnemonic:"LD (IX-128),B" },
        { code:[0xDD, 0x70, 0xff], mnemonic:"LD (IX- 1),B" },
        { code:[0xDD, 0x70, 0xff], mnemonic:"LD (IX -1),B" },
        { code:[0xDD, 0x70, 0xff], mnemonic:"LD (IX - 1),B" },
        { code:[0xDD, 0x70, 0x80], mnemonic:"LD (IX- 128),B" },

        { code:[0xDD, 0x34, 0xff], mnemonic:"INC (IX-1)" },
        { code:[0xDD, 0x34, 0xff], mnemonic:"INC (IX -1)" },
        { code:[0xDD, 0x34, 0x80], mnemonic:"INC (IX- 128)" },
        { code:[0xDD, 0x34, 0x80], mnemonic:"INC (IX - 80H)" },

        { code:[0xDD, 0x35, 0x80], mnemonic:"DEC (IX-128)" },
        { code:[0xDD, 0x35, 0x80], mnemonic:"DEC (IX-80H)" },

        { code:[0xDD, 0x86, 0x80], mnemonic:"ADD A,(IX-128)" },
        { code:[0xDD, 0x8E, 0x80], mnemonic:"ADC A,(IX- 80H)" },
        { code:[0xDD, 0x96, 0x80], mnemonic:"SUB A,(IX -128)" },
        { code:[0xDD, 0x9E, 0x80], mnemonic:"SBC A,(IX - 80H)" },

        { code:[0o375, 0o313, 0x00, 0o016], mnemonic:"RRC (IY-00H)" },
        { code:[0o375, 0o313, 0x80, 0o176], mnemonic:"BIT 7,(IY-128)" },
        { code:[0o375, 0o313, 0x80, 0o176], mnemonic:"BIT 7,(IY - 128)" },
        { code:[0o375, 0o313, 0xff, 0o006], mnemonic:"RLC (IY-1)" },
        { code:[0o375, 0o313, 0x00, 0o016], mnemonic:"RRC (IY+00H)" },
        { code:[0o375, 0o313, 0x80, 0o376], mnemonic:"SET 7,(IY -128)" },
        { code:[0o375, 0o313, 0xFF, 0o376], mnemonic:"SET 7,(IY - 1)" },
        { code:[0o375, 0o313, 0xFF, 0o276], mnemonic:"RES 7,(IY -01H)" },

        { code:[0o335, 0o313, 0x80, 0o006], mnemonic:"RLC (IX - 128)" },
        { code:[0o335, 0o313, 0x80, 0o006], mnemonic:"RLC (IX- 128)" },
        { code:[0o335, 0o313, 0x80, 0o026], mnemonic:"RL (IX-80H)" },
        { code:[0o335, 0o313, 0xFF, 0o106], mnemonic:"BIT 0,(IX-1)" },
        { code:[0o335, 0o313, 0x80, 0o106], mnemonic:"BIT 0,(IX- 128)" },
        { code:[0o335, 0o313, 0x7F, 0o306], mnemonic:"SET 0,(IX +127)" },
        { code:[0o335, 0o313, 0x7F, 0o206], mnemonic:"RES 0,(IX+ 127)" },

    ];
    UnitTest.test({
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
                    if(line_asm_test_pattern[i].code.length != codes.length) {
                        test_result = false;
                        test_detail = ` The assembled code length ${line_asm_test_pattern[i].code.length} is expected ${codes.length}`;
                    } else {
                        for(var j = 0; j < line_asm_test_pattern[i].code.length; j++) {
                            if(line_asm_test_pattern[i].code[j] != codes[j]) {
                                test_result = false;
                                test_detail = " The assembled code is different.";
                                break;
                            }
                        }
                    }
                    if(!test_result) {
                        test_detail += " expect:"
                        for(var j = 0; j < line_asm_test_pattern[i].code.length; j++) {
                            test_detail += " " + NumberUtil.HEX(line_asm_test_pattern[i].code[j], 2);
                        }
                        test_detail += "(" + line_asm_test_pattern[i].code.length + "bytes)"; 
                        test_detail += " result:";
                        for(var j = 0; j < codes.length; j++) {
                            test_detail += " " + NumberUtil.HEX(codes[j], 2);
                        }
                        test_detail += "(" + codes.length + "bytes)"; 
                    }
                }
                UnitTest.report(test_name, test_result, test_detail);
            }
            for(var i = 0; i < line_asm_test_pattern.length; i++) {
                var code = line_asm_test_pattern[i].code;
                var test_name = "DISASSEMBLE ["
                    + code.map( function(c) { return NumberUtil.HEX(c, 2); }).join(' ')
                    + '] to "' + line_asm_test_pattern[i].mnemonic + '"';
                var test_result = true;
                var test_detail = "";
                var buf = Buffer.from(code);
                var dasmlist = Z80.dasm(buf);
                dasmlist.forEach(function(mnemonicInfo) {
                    if(!test_result) {
                        return;
                    }
                    try {
                        if(isNaN(mnemonicInfo.addr)) {
                            return;
                        }
                        var binsrcCode = line_asm_test_pattern[i].code.map(
                                function(c) { return NumberUtil.HEX(c, 2); }).join(' ')
                        var disasmCode = mnemonicInfo.code.map(
                                function(c) { return NumberUtil.HEX(c, 2); }).join(' ')
                        if(binsrcCode != disasmCode) {
                            console.log("");
                            console.log("## " + test_name);
                            console.log("");
                            test_result = false;
                            test_detail = "Disasm codes are not equals to source binary.";
                            console.log("BINSRC SOURCE:" + binsrcCode);
                            console.log("DISASM SOURCE:" + disasmCode);
                            console.log(
                                NumberUtil.HEX(mnemonicInfo.addr, 4) + "\t"
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
                                function() { return NumberUtil.HEX(parseInt(arguments[1]), 4)+"H"; });
                        disasmMnemonic = disasmMnemonic.replace(/\b0+([1-9A-F]+H)\b/, function() {return arguments[1] });
                        disasmMnemonic = disasmMnemonic.replace(/ /g, '');
                        var sourceMnemonic = line_asm_test_pattern[i].mnemonic
                        sourceMnemonic = sourceMnemonic.toUpperCase();
                        sourceMnemonic = sourceMnemonic.replace(/\b([0-9]+)\b/,
                                function() { return NumberUtil.HEX(parseInt(arguments[1]), 4)+"H"; });
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
                                NumberUtil.HEX(mnemonicInfo.addr, 4) + "\t"
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
    });
});