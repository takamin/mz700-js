// Z80_Register class for Z80
Z80_Register = function() {
	// 8bit register / 16 bit register pair
	this.B = 0;
	this.C = 0;
	this.D = 0;
	this.E = 0;
	this.H = 0;
	this.L = 0;
	this.A = 0;
	this.F = 0;
	
	//16bit register
	this.PC = 0;	//プログラムカウンタ
	this.SP = 0;	//スタックポインタ
	this.IX = 0;	//インデックスレジスタX
	this.IY = 0;	//インデックスレジスタY
	
	this.R = 0;	//リフレッシュレジスタ
	this.I = 0;	//割り込みベクタ
};
(function() {

/* FLAG MASK BIT CONSTANT */
var S_FLAG = 0x80;
var Z_FLAG = 0x40;
var H_FLAG = 0x10;
var V_FLAG = 0x04;
var N_FLAG = 0x02;
var C_FLAG = 0x01;

//
// I have ported these codes from https://github.com/marukun700/mz700win/tree/master/z80
//
var PTable = new Array(512);
var ZSTable = new Array(512);
var ZSPTable = new Array(512);
for (var i = 0; i < 256; ++i) {
    var zs = 0;
    if (i == 0) {
        zs |= Z_FLAG;
    }
    if (i & 0x80) {
        zs |= S_FLAG;
    }

    var p = 0;
    if (i & 1) { ++p; }
    if (i & 2) { ++p; }
    if (i & 4) { ++p; }
    if (i & 8) { ++p; }
    if (i & 16) { ++p; }
    if (i & 32) { ++p; }
    if (i & 64) { ++p; }
    if (i & 128) { ++p; }

    PTable[i] = (p & 1) ? 0 : V_FLAG;
    ZSTable[i] = zs;
    ZSPTable[i] = zs | PTable[i];
}
for (var i = 0; i < 256; ++i) {
    ZSTable[i + 256] = ZSTable[i] | C_FLAG;
    ZSPTable[i + 256] = ZSPTable[i] | C_FLAG;
    PTable[i + 256] = PTable[i] | C_FLAG;
}

Z80_Register.prototype.clear = function() {
	this.B = 0;
	this.C = 0;
	this.D = 0;
	this.E = 0;
	this.H = 0;
	this.L = 0;
	this.A = 0;
	this.F = 0;
	this.PC = 0;
	this.SP = 0;
	this.IX = 0;
	this.IY = 0;
	this.R = 0;
	this.I = 0;
}
Z80_Register.prototype.setFrom = function(reg) {
	this.B = reg.B;
	this.C = reg.C;
	this.D = reg.D;
	this.E = reg.E;
	this.H = reg.H;
	this.L = reg.L;
	this.A = reg.A;
	this.F = reg.F;
	this.PC = reg.PC;
	this.SP = reg.SP;
	this.IX = reg.IX;
	this.IY = reg.IY;
	this.R = reg.R;
	this.I = reg.I;
}
Z80_Register.prototype.setPair = function(rr, value) {
	if(rr == "SP" || rr == "PC" || rr == "IX" || rr == "IY") {
		this[rr] = value;
	} else {
		this[rr.substring(1,2)] = Z80.lobyte(value);
		this[rr.substring(0,1)] = Z80.hibyte(value);
	}
}
Z80_Register.prototype.debugDump = function() {
	console.info(
            "B:" + this.B.HEX(2) + "H " + this.B + " " +
            "C:" + this.C.HEX(2) + "H " + this.C + " / " + this.getBC());
	console.info(
            "D:" + this.D.HEX(2) + "H " + this.D + " " +
            "E:" + this.E.HEX(2) + "H " + this.E + " / " + this.getDE());
	console.info(
            "H:" + this.H.HEX(2) + "H " + this.H + " " +
            "L:" + this.L.HEX(2) + "H " + this.L + " / " + this.getHL());
	console.info("A:" + this.A.HEX(2) + "H " + this.A);
	console.info("SZ-HPN-C");
	console.info(this.F.bin(8));
	console.info("PC:" + this.PC.HEX(4) + "H " + this.PC.bin(16) + "(2) " + this.PC);
	console.info("SP:" + this.SP.HEX(4) + "H " + this.SP.bin(16) + "(2) " + this.SP);
	console.info("I:" + this.I.HEX(2) + "H " + this.I.bin(8) + "(2) " + this.I + " " +
	"R:" + this.R.HEX(2) + "H " + this.R.bin(8) + "(2) " + this.R);
}


/* GET 16bit register pair value */
Z80_Register.prototype.getHL = function() { return Z80.pair(this.H, this.L); };
Z80_Register.prototype.getBC = function() { return Z80.pair(this.B, this.C); };
Z80_Register.prototype.getDE = function() { return Z80.pair(this.D, this.E); };
Z80_Register.prototype.getAF = function() { return Z80.pair(this.A, this.F); };

/* SET 16bit register pair value */
Z80_Register.prototype.setHL = function(nn) { this.H = Z80.hibyte(nn); this.L = Z80.lobyte(nn); };
Z80_Register.prototype.setBC = function(nn) { this.B = Z80.hibyte(nn); this.C = Z80.lobyte(nn); };
Z80_Register.prototype.setDE = function(nn) { this.D = Z80.hibyte(nn); this.E = Z80.lobyte(nn); };
Z80_Register.prototype.setAF = function(nn) { this.A = Z80.hibyte(nn); this.F = Z80.lobyte(nn); };

/* TEST FLAG BIT */
Z80_Register.prototype.testFlag	= function(mask) { return (this.F & mask) != 0 ? true : false; };
Z80_Register.prototype.flagS = function() {return this.testFlag(S_FLAG); }
Z80_Register.prototype.flagZ = function() {return this.testFlag(Z_FLAG); }
Z80_Register.prototype.flagH = function() {return this.testFlag(H_FLAG); }
Z80_Register.prototype.flagP = function() {return this.testFlag(V_FLAG); }
Z80_Register.prototype.flagN = function() {return this.testFlag(N_FLAG); }
Z80_Register.prototype.flagC = function() {return this.testFlag(C_FLAG); }

/* SET FLAG BIT */
Z80_Register.prototype.setFlag = function(mask) {this.F |= mask; }
Z80_Register.prototype.setFlagS = function() { this.setFlag(S_FLAG); }
Z80_Register.prototype.setFlagZ = function() { this.setFlag(Z_FLAG); }
Z80_Register.prototype.setFlagH = function() { this.setFlag(H_FLAG); }
Z80_Register.prototype.setFlagP = function() { this.setFlag(V_FLAG); }
Z80_Register.prototype.setFlagN = function() { this.setFlag(N_FLAG); }
Z80_Register.prototype.setFlagC = function() { this.setFlag(C_FLAG); }

/* CLEAR FLAG BIT */
Z80_Register.prototype.clearFlag = function(mask) {this.F &= ~mask; }
Z80_Register.prototype.clearFlagS = function() { this.clearFlag(S_FLAG); }
Z80_Register.prototype.clearFlagZ = function() { this.clearFlag(Z_FLAG); }
Z80_Register.prototype.clearFlagH = function() { this.clearFlag(H_FLAG); }
Z80_Register.prototype.clearFlagP = function() { this.clearFlag(V_FLAG); }
Z80_Register.prototype.clearFlagN = function() { this.clearFlag(N_FLAG); }
Z80_Register.prototype.clearFlagC = function() { this.clearFlag(C_FLAG); }

Z80_Register.prototype.ADD_HL = function(n)
{
    this.setHL(this._ADD(this.getHL(), n));
}
//#define M_ADCW(Reg)                                            \
//{                                                              \
// int q;                                                        \
// q=R.HL.D+R.Reg.D+(R.AF.D&1);                                  \
// R.AF.B.l=(((R.HL.D^q^R.Reg.D)&0x1000)>>8)|                    \
//          ((q>>16)&1)|                                         \
//          ((q&0x8000)>>8)|                                     \
//          ((q&65535)?0:Z_FLAG)|                                \
//          (((R.Reg.D^R.HL.D^0x8000)&(R.Reg.D^q)&0x8000)>>13);  \
// R.HL.W.l=q;                                                   \
//}
Z80_Register.prototype.ADC_HL = function(n)
{
    var HL = this.getHL();
    var q = HL + n + (this.F & C_FLAG);
    this.F = (((HL ^ q ^ n) & 0x1000) >> 8) |
        ((q >> 16) & 1) |
        ((q & 0x8000) >> 8) |
        ((q & 0xffff) ? 0 : Z_FLAG) |
        (((n ^ HL ^ 0x8000) & (n ^ q) & 0x8000) >> 13);
    this.setHL(q & 0xffff);
};
//#define M_SBCW(Reg)                                    \
//{                                                      \
// int q;                                                \
// q=R.HL.D-R.Reg.D-(R.AF.D&1);                          \
// R.AF.B.l=(((R.HL.D^q^R.Reg.D)&0x1000)>>8)|            \
//          ((q>>16)&1)|                                 \
//          ((q&0x8000)>>8)|                             \
//          ((q&65535)?0:Z_FLAG)|                        \
//          (((R.Reg.D^R.HL.D)&(R.Reg.D^q)&0x8000)>>13)| \
//          N_FLAG;                                      \
// R.HL.W.l=q;                                           \
//}
Z80_Register.prototype.SBC_HL = function(n)
{
    var HL = this.getHL();
    var q = HL - n - (this.F & 1);
    this.F = (((HL ^ q ^ n) & 0x1000) >> 8) |
        ((q >> 16) & 1) |
        ((q & 0x8000) >> 8) |
        ((q & 0xffff) ? 0 : Z_FLAG) |
        (((n & HL) & (n ^ q) & 0x8000) >> 13) |
        N_FLAG;
    this.setHL(q & 0xffff);
};
Z80_Register.prototype.ADD_IX = function(n)
{
    this.IX = this._ADD(this.IX, n);
}
Z80_Register.prototype.ADD_IY = function(n)
{
    this.IY = this._ADD(this.IY, n);
}
//#define M_ADDW(Reg1,Reg2)                              \
//{                                                      \
// int q;                                                \
// q=R.Reg1.D+R.Reg2.D;                                  \
// R.AF.B.l=(R.AF.B.l&(S_FLAG|Z_FLAG|V_FLAG))|           \
//          (((R.Reg1.D^q^R.Reg2.D)&0x1000)>>8)|         \
//          ((q>>16)&1);                                 \
// R.Reg1.W.l=q;                                         \
//}
Z80_Register.prototype._ADD = function(a, b)
{
    var q = a + b;
    this.F = (this.F & (S_FLAG | Z_FLAG | V_FLAG)) |
        (((a ^ q ^ b) & 0x1000) >> 8) |
        ((q >> 16) & 1);
    return q & 0xffff;
};
Z80_Register.prototype.jumpRel = function(e) {
    this.PC += Z80.getSignedByte(e);
}
//static void cpl(void) {
//  R.AF.B.h^=0xFF;
//  R.AF.B.l|=(H_FLAG|N_FLAG);
//}
Z80_Register.prototype.CPL = function() {
    this.A = (this.A ^ 0xff) & 255;
    this.F = (H_FLAG | N_FLAG);
}
//static void neg(void)
//{
// byte i;
// i=R.AF.B.h;
// R.AF.B.h=0;
// M_SUB(i);
//}
Z80_Register.prototype.NEG = function() {
    var i = this.A;
    this.A = 0;
    this.subAcc(i);
}
//  #define M_ADD(Reg)
//  {
//      int q;
//      q=R.AF.B.h+Reg;
//      R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|
//          ((R.AF.B.h^q^Reg)&H_FLAG)|
//          (((Reg^R.AF.B.h^0x80)&(Reg^q)&0x80)>>5);
//      R.AF.B.h=q;
//  }
Z80_Register.prototype.addAcc = function(n) {
    var q = this.A + n;
    this.F = ZSTable[q & 255] | ((q & 256) >> 8) |
        ((this.A ^ q ^ n) & H_FLAG) |
        (((n ^ this.A ^ 0x80) & (n ^ q) & 0x80) >> 5);
    this.A = (q & 255);
}
//  #define M_ADC(Reg)
//  {
//      int q;
//      q = R.AF.B.h + Reg + (R.AF.B.l & 1);
//      R.AF.B.l = ZSTable[q & 255] | ((q & 256) >> 8) |
//            ((R.AF.B.h ^ q ^ Reg) & H_FLAG) |
//            (((Reg ^ R.AF.B.h ^ 0x80) & (Reg ^ q) & 0x80) >> 5);
//      R.AF.B.h = q;
//  }
//
Z80_Register.prototype.addAccWithCarry = function(n) {
    var q = this.A + n + (this.F & C_FLAG);
    this.F = ZSTable[q & 255] | ((q & 256) >> 8) |
        ((this.A ^ q ^ n) & H_FLAG) |
        (((n ^ this.A ^ 0x80) & (n ^ q) & 0x80) >> 5);
    this.A = (q & 255);
}
//  #define M_SUB(Reg)                                      \
//  {                                                       \
//   int q;                                                 \
//   q=R.AF.B.h-Reg;                                        \
//   R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|N_FLAG|           \
//            ((R.AF.B.h^q^Reg)&H_FLAG)|                    \
//            (((Reg^R.AF.B.h)&(Reg^q)&0x80)>>5);           \
//   R.AF.B.h=q;                                            \
//  }
//  
Z80_Register.prototype.subAcc = function(n) {
    var q = (this.A - n) & 0x1ff;
    this.F = ZSTable[q & 255] | ((q & 256) >> 8) | N_FLAG |
        ((this.A ^ q ^ n) & H_FLAG) |
        (((n ^ this.A ^ 0x80) & (n ^ q) & 0x80) >> 5);
    this.A = (q & 255);
}
//  #define M_SBC(Reg)                                      \
//  {                                                       \
//   int q;                                                 \
//   q=R.AF.B.h-Reg-(R.AF.B.l&1);                           \
//   R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|N_FLAG|           \
//            ((R.AF.B.h^q^Reg)&H_FLAG)|                    \
//            (((Reg^R.AF.B.h)&(Reg^q)&0x80)>>5);           \
//   R.AF.B.h=q;                                            \
//  }
Z80_Register.prototype.subAccWithCarry = function(n) {
    var q = (this.A - n - (this.F & C_FLAG)) & 0x1ff;
    this.F = ZSTable[q & 255] | ((q & 256) >> 8) | N_FLAG |
        ((this.A ^ q ^ n) & H_FLAG) |
        (((n ^ this.A ^ 0x80) & (n ^ q) & 0x80) >> 5);
    this.A = (q & 255);
}
//#define M_AND(Reg)
//  R.AF.B.h &= Reg;
//  R.AF.B.l = ZSPTable[R.AF.B.h] | H_FLAG
Z80_Register.prototype.andAcc = function(n) {
    this.A &= (n & 0xff);
    this.F = ZSPTable[this.A] | H_FLAG;
}
//#define M_OR(Reg)
//  R.AF.B.h |= Reg;
//  R.AF.B.l = ZSPTable[R.AF.B.h]
Z80_Register.prototype.orAcc = function(n) {
    this.A |= (n & 0xff);
    this.F = ZSPTable[this.A];
}
//#define M_XOR(Reg)
//  R.AF.B.h ^= Reg;
//  R.AF.B. l= ZSPTable[R.AF.B.h]
Z80_Register.prototype.xorAcc = function(n) {
    this.A ^= (n & 0xff);
    this.F = ZSPTable[this.A];
}
Z80_Register.prototype.increment = function(r) {
    this[r] = this.getINCValue(this[r]);
}
//#define M_INC(Reg)
// ++Reg;
// R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[Reg]|
//          ((Reg==0x80)?V_FLAG:0)|((Reg&0x0F)?0:H_FLAG)
Z80_Register.prototype.getINCValue = function(n) {
    n = (n + 1) & 255;
    this.F = (this.F & C_FLAG) |
        ZSTable[n] |
        ((n == 0x80) ? V_FLAG : 0) |
        ((n & 0x0F) ? 0 : H_FLAG);
    return n;
};
Z80_Register.prototype.decrement = function(r) {
    this[r] = this.getDECValue(this[r]);
}
//#define M_DEC(Reg)
//  R.AF.B.l=(R.AF.B.l&C_FLAG)|N_FLAG|
//           ((Reg==0x80)?V_FLAG:0)|((Reg&0x0F)?0:H_FLAG);
//  R.AF.B.l|=ZSTable[--Reg]
Z80_Register.prototype.getDECValue = function(n) {
    this.F = (this.F & C_FLAG) | N_FLAG |
        ((n == 0x80) ? V_FLAG : 0) |
        ((n & 0x0F) ? 0 : H_FLAG);
    n = (n - 1) & 255;
    this.F |= ZSTable[n];
    return n;
};
//#define M_CP(Reg)
//{
// int q;
// q=R.AF.B.h-Reg;
// R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|N_FLAG|
//          ((R.AF.B.h^q^Reg)&H_FLAG)|
//          (((Reg^R.AF.B.h)&(Reg^q)&0x80)>>5);
//}
Z80_Register.prototype.compareAcc = function(n) {
    var q = this.A - n;
    this.F = ZSTable[q & 255] | ((q & 256) >> 8) | N_FLAG |
        ((this.A ^ q ^ n) & H_FLAG) |
        (((n ^ this.A) & (n ^ q) & 0x80) >> 5);
}
//static void cpi(void)
//{
// byte i,j;
// i=M_RDMEM(R.HL.D);
// j=R.AF.B.h-i;
// ++R.HL.W.l;
// --R.BC.W.l;
// R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[j]|
//          ((R.AF.B.h^i^j)&H_FLAG)|(R.BC.D? V_FLAG:0)|N_FLAG;
//}
Z80_Register.prototype.CPI = function(n) {
    var q = this.A - n;
    this.incHL();
    this.decBC();
    this.F = (this.F & C_FLAG) | ZSTable[q & 255] |
        ((this.A ^ n ^ q) & H_FLAG) |
        (this.getBC() ? V_FLAG : 0) | N_FLAG;
};
//static void cpd(void)
//{
// byte i,j;
// i=M_RDMEM(R.HL.D);
// j=R.AF.B.h-i;
// --R.HL.W.l;
// --R.BC.W.l;
// R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[j]|
//          ((R.AF.B.h^i^j)&H_FLAG)|(R.BC.D? V_FLAG:0)|N_FLAG;
//}
Z80_Register.prototype.CPD = function(n) {
    var q = this.A - n;
    this.decHL();
    this.decBC();
    this.F = (this.F & C_FLAG) | ZSTable[q & 255] |
        ((this.A ^ n ^ q) & H_FLAG) |
        (this.getBC() ? V_FLAG : 0) | N_FLAG;
}
//#define M_RLCA
// R.AF.B.h=(R.AF.B.h<<1)|((R.AF.B.h&0x80)>>7);
// R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&C_FLAG)
Z80_Register.prototype.RLCA = function() {
    this.A = ((this.A << 1) | ((this.A & 0x80) >> 7)) & 255;
    this.F = (this.F & 0xEC) | (this.A & 0x01);
}
//#define M_RLC(Reg)
//{
// int q;
// q=Reg>>7;
// Reg=(Reg<<1)|q;
// R.AF.B.l=ZSPTable[Reg]|q;
//}
Z80_Register.prototype.RLC = function(x) {
    var q = x >> 7;
    x = ((x << 1) | q) & 255;
    this.F = ZSPTable[x] | q;
    return x;
}
//#define M_RLA               \
//{                           \
// int i;                     \
// i=R.AF.B.l&C_FLAG;         \
// R.AF.B.l=(R.AF.B.l&0xEC)|((R.AF.B.h&0x80)>>7); \
// R.AF.B.h=(R.AF.B.h<<1)|i;  \
//}
Z80_Register.prototype.RLA = function() {
    var i = this.F & C_FLAG;
    this.F = (this.F & 0xEC) | ((this.A & 0x80) >> 7);
    this.A = ((this.A << 1) | i) & 255;
}
//#define M_RL(Reg)            \
//{                            \
// int q;                      \
// q=Reg>>7;                   \
// Reg=(Reg<<1)|(R.AF.B.l&1);  \
// R.AF.B.l=ZSPTable[Reg]|q;   \
//}
Z80_Register.prototype.RL = function(x) {
    var q = x >> 7;
    x = ((x << 1) | (this.F & 1)) & 255;
    this.F = ZSPTable[x] | q;
    return x;
}
//#define M_RRCA              \
// R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&0x01); \
// R.AF.B.h=(R.AF.B.h>>1)|(R.AF.B.h<<7)
Z80_Register.prototype.RRCA = function() {
    this.F = (this.F & 0xEC) | (this.A & 0x01);
    this.A = (this.A >> 1) | ((this.A << 7) & 255);
}
//#define M_RRC(Reg)         \
//{                          \
// int q;                    \
// q=Reg&1;                  \
// Reg=(Reg>>1)|(q<<7);      \
// R.AF.B.l=ZSPTable[Reg]|q; \
//}
Z80_Register.prototype.RRC = function(x) {
    var q = x & 1;
    x = (x >> 1) | ((q << 7) & 255);
    this.F = ZSPTable[x] | q;
    return x;
}
//#define M_RRA               \
//{                           \
// int i;                     \
// i=R.AF.B.l&C_FLAG;         \
// R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&0x01); \
// R.AF.B.h=(R.AF.B.h>>1)|(i<<7);            \
//}
Z80_Register.prototype.RRA = function() {
    var i = this.F & C_FLAG;
    this.F = (this.F & 0xEC) | (this.A & 0x01);
    this.A = (this.A >> 1) | (i << 7);
}
//#define M_RR(Reg)            \
//{                            \
// int q;                      \
// q=Reg&1;                    \
// Reg=(Reg>>1)|(R.AF.B.l<<7); \
// R.AF.B.l=ZSPTable[Reg]|q;   \
//}
Z80_Register.prototype.RR = function(x) {
    var q = x & 1;
    x = (x >> 1) | ((this.F << 7) & 255);
    this.F = ZSPTable[x] | q;
    return x;
}
//#define M_SLA(Reg)           \
//{                            \
// int q;                      \
// q=Reg>>7;                   \
// Reg<<=1;                    \
// R.AF.B.l=ZSPTable[Reg]|q;   \
//}
Z80_Register.prototype.SLA = function(x) {
    var q = x >> 7;
    x = (x << 1) & 255;
    this.F = ZSPTable[x] | q;
    return x;
}
//#define M_SRA(Reg)           \
//{                            \
// int q;                      \
// q=Reg&1;                    \
// Reg=(Reg>>1)|(Reg&0x80);    \
// R.AF.B.l=ZSPTable[Reg]|q;   \
//}
Z80_Register.prototype.SRA = function(x) {
    var q = x & 1;
    x = (x >> 1) | (x & 0x80);
    this.F = ZSPTable[x] | q;
    return x;
}
//#define M_SRL(Reg)           \
//{                            \
// int q;                      \
// q=Reg&1;                    \
// Reg>>=1;                    \
// R.AF.B.l=ZSPTable[Reg]|q;   \
//}
Z80_Register.prototype.SRL = function(x) {
    var q = x & 1;
    x >>= 1;
    this.F = ZSPTable[x] | q;
    return x;
}
//#define DoIn(lo,hi)     Z80_In( (word) ((lo)|((word) ((hi)<<8) )))
//#define M_IN(Reg)           \
//        Reg=DoIn(R.BC.B.l,R.BC.B.h); \
//        R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSPTable[Reg]
Z80_Register.prototype.onReadIoPort = function(Reg) {
    this.F = (this.F & C_FLAG) | ZSPTable[Reg];
};
//static void ind(void)
//{
// --R.BC.B.h;
// M_WRMEM(R.HL.D,DoIn(R.BC.B.l,R.BC.B.h));
// --R.HL.W.l;
// R.AF.B.l=(R.BC.B.h)? N_FLAG:(N_FLAG|Z_FLAG);
//}
Z80_Register.prototype.postIND = function() {
    this.decHL();
    this.F = (this.B) ? N_FLAG : (N_FLAG | Z_FLAG);
};
//static void ini(void)
//{
// --R.BC.B.h;
// M_WRMEM(R.HL.D,DoIn(R.BC.B.l,R.BC.B.h));
// ++R.HL.W.l;
// R.AF.B.l=(R.BC.B.h)? N_FLAG:(N_FLAG|Z_FLAG);
//}
Z80_Register.prototype.postINI = function() {
    this.incHL();
    this.F = (this.B) ? N_FLAG : (N_FLAG | Z_FLAG);
};
//static void outd(void)
//{
// --R.BC.B.h;
// DoOut (R.BC.B.l,R.BC.B.h,(word)M_RDMEM(R.HL.D));
// --R.HL.W.l;
// R.AF.B.l=(R.BC.B.h)? N_FLAG:(Z_FLAG|N_FLAG);
//}
Z80_Register.prototype.postOUTD = function() {
    this.decHL();
    this.F = (this.B) ? N_FLAG : (N_FLAG | Z_FLAG);
};
//static void outi(void)
//{
// --R.BC.B.h;
// DoOut (R.BC.B.l,R.BC.B.h,(word)M_RDMEM(R.HL.D));
// ++R.HL.W.l;
// R.AF.B.l=(R.BC.B.h)? N_FLAG:(Z_FLAG|N_FLAG);
//}
Z80_Register.prototype.postOUTI = function() {
    this.incHL();
    this.F = (this.B) ? N_FLAG : (N_FLAG | Z_FLAG);
};
//static void ld_a_i(void)
//{
// R.AF.B.h=R.I;
// R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[R.I]|(R.IFF2<<2);
//}
Z80_Register.prototype.LD_A_I = function(iff2) {
    this.A = this.I;
    this.F = (this.F & C_FLAG) | ZSTable[this.I] | (iff2 << 2)
};
//static void ld_a_r(void)
//{
// R.AF.B.h=(R.R&127)|(R.R2&128);
// R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[R.AF.B.h]|(R.IFF2<<2);
//}
Z80_Register.prototype.LD_A_R = function(iff2,r2) {
    this.A = (this.R & 127) | (r2 & 128);
    this.F = (this.F & C_FLAG) | ZSTable[this.A] | (iff2 << 2)
};
Z80_Register.prototype.incBC = function() {
    this.setBC((this.getBC() + 1) & 0xffff);
}
Z80_Register.prototype.decBC = function() {
    this.setBC((this.getBC() - 1) & 0xffff);
}
Z80_Register.prototype.incHL = function() {
    this.setHL((this.getHL() + 1) & 0xffff);
}
Z80_Register.prototype.decHL = function() {
    this.setHL((this.getHL() - 1) & 0xffff);
}
Z80_Register.prototype.incDE = function() {
    this.setDE((this.getDE() + 1) & 0xffff);
}
Z80_Register.prototype.decDE = function() {
    this.setDE((this.getDE() - 1) & 0xffff);
}
//static void ldd(void)
//{
// M_WRMEM(R.DE.D,M_RDMEM(R.HL.D));
// --R.DE.W.l;
// --R.HL.W.l;
// --R.BC.W.l;
// R.AF.B.l=(R.AF.B.l&0xE9)|(R.BC.D? V_FLAG:0);
//}
Z80_Register.prototype.onLDD = function() {
    this.decDE();
    this.decHL();
    this.decBC();
    this.F = (this.F & 0xE9) | (this.getBC() ? V_FLAG : 0);
};
//static void ldi(void)
//{
// M_WRMEM(R.DE.D,M_RDMEM(R.HL.D));
// ++R.DE.W.l;
// ++R.HL.W.l;
// --R.BC.W.l;
// R.AF.B.l=(R.AF.B.l&0xE9)|(R.BC.D? V_FLAG:0);
//}
Z80_Register.prototype.onLDI = function() {
    this.incDE();
    this.incHL();
    this.decBC();
    this.F = (this.F & 0xE9) | (this.getBC() ? V_FLAG : 0);
};

/* -------------------
 * r,r'		レジスタ
 * -------------------
 * 000		B
 * 001		C
 * 010		D
 * 011		E
 * 100		H
 * 101		L
 * 111		A
 */
Z80_Register.REG_r_ID2NAME = {0:"B",1:"C",2:"D",3:"E",4:"H",5:"L",7:"A"};
/* -------------------
 * dd,ss	ペアレジスタ
 * -------------------
 * 00		BC
 * 01		DE
 * 10		HL
 * 11		SP
 */
/* -------------------
 * qq		ペアレジスタ
 * -------------------
 * 00		BC
 * 01		DE
 * 10		HL
 * 11		AF
 */

/* -------------------
 * pp		ペアレジスタ
 * -------------------
 * 00		BC
 * 01		DE
 * 10		IX
 * 11		SP
 */

/* -------------------
 * rr		ペアレジスタ
 * -------------------
 * 00		BC
 * 01		DE
 * 10		IY
 * 11		SP
 */

/* -------------------
 * b		ビットセット
 * -------------------
 * 000		0
 * 001		1
 * 010		2
 * 011		3
 * 100		4
 * 101		5
 * 110		6
 * 111		7
 */
/* ---------------------------
 * cc		コンディション
 * ---------------------------
 * 000		NZ	Non Zero
 * 001		Z	Zero
 * 010		NC	Non Carry
 * 011		C	Carry
 * 100		PO	Parity Odd
 * 101		PE	Parity Even
 * 110		P	sign Positive
 * 111		N	sign Negative
 */
Z80_Register.CONDITION_INDEX = { NZ:0, Z:1, NC:2, C:3, PO:4, PE:5, P:6, N:7 };

/* -------------------
 * t		p
 * -------------------
 * 000		00H
 * 001		08H
 * 010		10H
 * 011		18H
 * 100		20H
 * 101		28H
 * 110		30H
 * 111		38H
 */
Z80_Register.prototype.DAA = function() {
    var i = this.A;
    if(this.F & C_FLAG) { i |= 0x100; }
    if(this.F & H_FLAG) { i |= 0x200; }
    if(this.F & N_FLAG) { i |= 0x400; }
    var AF = DAATable[i] & 0xffff;
    this.A = (AF >> 8) & 0xff;
    this.F = (AF >> 0) & 0xff;
};
var DAATable = [
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
}());

