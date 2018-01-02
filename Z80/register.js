/* eslint no-unused-vars: "off" */
(function() {
    "use strict";
    var Z80BinUtil = require("./bin-util.js");
    function Z80Reg8bitIf(stdlib, foreign, heap) {
        "use asm";

        var S_FLAG = 0x80;
        var Z_FLAG = 0x40;
        var H_FLAG = 0x10;
        var V_FLAG = 0x04;
        var N_FLAG = 0x02;
        var C_FLAG = 0x01;

        var _B = 0;
        var _C = 0;
        var _D = 0;
        var _E = 0;
        var _H = 0;
        var _L = 0;
        var _A = 0;
        var _F = 0;

        var _flagTable = new stdlib.Uint8Array(heap);
        var _PTableIndex = 0;
        var _ZSTableIndex = 512;
        var _ZSPTableIndex = 1024;
        function getPTable(idx) {
            idx = idx | 0;
            return _flagTable[_PTableIndex|0 + idx]|0;
        }
        function setPTable(idx, value) {
            idx = idx | 0;
            value = value | 0;
            _flagTable[_PTableIndex|0 + idx] = value;
        }
        function getZSTable(idx) {
            idx = idx | 0;
            return _flagTable[_ZSTableIndex|0 + idx]|0;
        }
        function setZSTable(idx, value) {
            idx = idx | 0;
            value = value | 0;
            _flagTable[_ZSTableIndex|0 + idx] = value;
        }
        function getZSPTable(idx) {
            idx = idx | 0;
            return _flagTable[_ZSPTableIndex|0 + idx]|0;
        }
        function setZSPTable(idx, value) {
            idx = idx | 0;
            value = value | 0;
            _flagTable[_ZSPTableIndex|0 + idx] = value;
        }

        function initialize() {
            var i = 0;
            var zs = 0;
            var p = 0;
            for (i = 0; (i|0) < 256; i = ((i|0) + 1)|0) {
                zs = 0;
                if ((i|0) == 0) {
                    zs = zs|Z_FLAG;
                }
                if (i & 0x80) {
                    zs = zs|S_FLAG;
                }

                p = 0;
                if (((i & 1)|0) != 0) { p = (p + 1)|0; }
                if (((i & 2)|0) != 0) { p = (p + 1)|0; }
                if (((i & 4)|0) != 0) { p = (p + 1)|0; }
                if (((i & 8)|0) != 0) { p = (p + 1)|0; }
                if (((i & 16)|0) != 0) { p = (p + 1)|0; }
                if (((i & 32)|0) != 0) { p = (p + 1)|0; }
                if (((i & 64)|0) != 0) { p = (p + 1)|0; }
                if (((i & 128)|0) != 0) { p = (p + 1)|0; }

                setPTable(  i, ((p & 1) ? 0 : V_FLAG)|0);
                setZSTable( i,  zs | 0);
                setZSPTable(i, (zs | (getPTable(i)|0))|0);
            }
            for (i = 0; (i|0) < 256; i = ((i|0) + 1)|0) {
                setZSTable(  (i + 256)|0, (  (getZSTable(i|0)|0) | C_FLAG)|0 );
                setZSPTable( (i + 256)|0, ( (getZSPTable(i|0)|0) | C_FLAG)|0 );
                setPTable(   (i + 256)|0, (   (getPTable(i|0)|0) | C_FLAG)|0 );
            }
        }

        function pair(h, l) {
            h = h|0;
            l = l|0;
            return (((0xff & h) << 8) + (0xff & l))|0;
        }
        function hi8(nn) {
            nn = nn|0;
            return ((nn >> 8) & 0xff)|0;
        }
        function lo8(nn) {
            nn = nn | 0;
            return (nn & 0xff)|0;
        }

        function clear() {
            _B = 0;
            _C = 0;
            _D = 0;
            _E = 0;
            _H = 0;
            _L = 0;
            _A = 0;
            _F = 0;
        }
        function setB(n) { n = n|0; _B = (n & 0xff)|0; }
        function getB() { return _B|0; }
        function setC(n) { n = n|0; _C = (n & 0xff)|0; }
        function getC() { return _C|0; }
        function setD(n) { n = n|0; _D = (n & 0xff)|0; }
        function getD() { return _D|0; }
        function setE(n) { n = n|0; _E = (n & 0xff)|0; }
        function getE() { return _E|0; }
        function setH(n) { n = n|0; _H = (n & 0xff)|0; }
        function getH() { return _H|0; }
        function setL(n) { n = n|0; _L = (n & 0xff)|0; }
        function getL() { return _L|0; }
        function setA(n) { n = n|0; _A = (n & 0xff)|0; }
        function getA() { return _A|0; }
        function setF(n) { n = n|0; _F = (n & 0xff)|0; }
        function getF() { return _F|0; }
        function setBC(nn) { nn = nn|0; _B = hi8(nn)|0; _C = lo8(nn)|0; }
        function getBC() { return pair(_B, _C)|0; }
        function setDE(nn) { nn = nn|0; _D = hi8(nn)|0; _E = lo8(nn)|0; }
        function getDE() { return pair(_D, _E)|0; }
        function setHL(nn) { nn = nn|0; _H = hi8(nn)|0; _L = lo8(nn)|0; }
        function getHL() { return pair(_H, _L)|0; }
        function setAF(nn) { nn = nn|0; _A = hi8(nn)|0; _F = lo8(nn)|0; }
        function getAF() { return pair(_A, _F)|0; }
        function testFlag(mask) { mask = mask|0; return ((_F & mask) ? 1:0)|0; }
        function setFlag(mask) { mask = mask|0; _F = _F | mask; }
        function clearFlag(mask) { mask = mask|0; _F = _F & ((~mask) & 0xff); }

        /* TEST FLAG BIT */
        function flagS() {return ((_F & S_FLAG) ? 1:0)|0; }
        function flagZ() {return ((_F & Z_FLAG) ? 1:0)|0; }
        function flagH() {return ((_F & H_FLAG) ? 1:0)|0; }
        function flagP() {return ((_F & V_FLAG) ? 1:0)|0; }
        function flagN() {return ((_F & N_FLAG) ? 1:0)|0; }
        function flagC() {return ((_F & C_FLAG) ? 1:0)|0; }

        /* SET FLAG BIT */
        function setFlagS() { _F = _F | S_FLAG; }
        function setFlagZ() { _F = _F | Z_FLAG; }
        function setFlagH() { _F = _F | H_FLAG; }
        function setFlagP() { _F = _F | V_FLAG; }
        function setFlagN() { _F = _F | N_FLAG; }
        function setFlagC() { _F = _F | C_FLAG; }

        /* CLEAR FLAG BIT */
        function clearFlagS() { _F = _F & (~S_FLAG & 0xff); }
        function clearFlagZ() { _F = _F & (~Z_FLAG & 0xff); }
        function clearFlagH() { _F = _F & (~H_FLAG & 0xff); }
        function clearFlagP() { _F = _F & (~V_FLAG & 0xff); }
        function clearFlagN() { _F = _F & (~N_FLAG & 0xff); }
        function clearFlagC() { _F = _F & (~C_FLAG & 0xff); }

        //#define M_ADDW(Reg1,Reg2)                              \
        //{                                                      \
        // int q;                                                \
        // q=R.Reg1.D+R.Reg2.D;                                  \
        // R.AF.B.l=(R.AF.B.l&(S_FLAG|Z_FLAG|V_FLAG))|           \
        //          (((R.Reg1.D^q^R.Reg2.D)&0x1000)>>8)|         \
        //          ((q>>16)&1);                                 \
        // R.Reg1.W.l=q;                                         \
        //}
        function ADDW(a, b)
        {
            a = a|0;
            b = b|0;

            var q = 0;

            q = (a + b)|0;
            setF(
                        ((getF()|0) & ( S_FLAG | Z_FLAG | V_FLAG )) |
                        (((a ^ q ^ b) & 0x1000) >> 8) |
                        ((q >> 16) & 1)
                );

            return (q & 0xffff)|0;
        }
        function ADD_HL(n)
        {
            n = n | 0;

            setHL(ADDW(getHL()|0, n)|0);
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
        function ADC_HL(n)
        {
            n = n | 0;

            var HL = 0;
            var q = 0;

            HL = getHL()|0;
            q = (HL + n + ((getF()|0) & C_FLAG))|0;
            setF( (((HL ^ q ^ n) & 0x1000) >> 8) |
                ((q >> 16) & 1) |
                ((q & 0x8000) >> 8) |
                ((q & 0xffff) ? 0 : Z_FLAG) |
                (((n ^ HL ^ 0x8000) & (n ^ q) & 0x8000) >> 13));
            setHL(q);
        }

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
        function SBC_HL(n)
        {
            n = n | 0;

            var HL = 0;
            var q = 0;
            HL = getHL()|0;
            q = (HL - n - ((getF()|0) & 1))|0;
            setF( (((HL ^ q ^ n) & 0x1000) >> 8) |
                ((q >> 16) & 1) |
                ((q & 0x8000) >> 8) |
                ((q & 0xffff) ? 0 : Z_FLAG) |
                (((n & HL) & (n ^ q) & 0x8000) >> 13) |
                N_FLAG);
            setHL(q);
        }

        function incBC() { setBC(((getBC()|0) + 1)|0); }
        function decBC() { setBC(((getBC()|0) - 1)|0); }
        function incHL() { setHL(((getHL()|0) + 1)|0); }
        function decHL() { setHL(((getHL()|0) - 1)|0); }
        function incDE() { setDE(((getDE()|0) + 1)|0); }
        function decDE() { setDE(((getDE()|0) - 1)|0); }

        //#define M_RLCA
        // R.AF.B.h=(R.AF.B.h<<1)|((R.AF.B.h&0x80)>>7);
        // R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&C_FLAG)
        function RLCA() {
            var acc = 0;
            acc = getA()|0;
            setA((((acc << 1) | ((acc & 0x80) >> 7)) & 255)|0);
            setF((((getF()|0) & 0xEC) | ((getA()|0) & 0x01))|0);
        }
        //#define M_RLA               \
        //{                           \
        // int i;                     \
        // i=R.AF.B.l&C_FLAG;         \
        // R.AF.B.l=(R.AF.B.l&0xEC)|((R.AF.B.h&0x80)>>7); \
        // R.AF.B.h=(R.AF.B.h<<1)|i;  \
        //}
        function RLA() {
            var i = 0;
            var acc = 0;
            i = (getF()|0) & C_FLAG;
            acc = getA()|0;
            setF((((getF()|0) & 0xEC) | ((acc & 0x80) >> 7))|0);
            setA((((acc << 1) | i) & 255)|0);
        }
        //#define M_RRCA              \
        // R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&0x01); \
        // R.AF.B.h=(R.AF.B.h>>1)|(R.AF.B.h<<7)
        function RRCA() {
            var acc = 0;
            acc = getA()|0;
            setF((((getF()|0) & 0xEC) | (acc & 0x01))|0);
            setA(((acc >> 1) | ((acc << 7) & 255))|0);
        }
        //#define M_RRA               \
        //{                           \
        // int i;                     \
        // i=R.AF.B.l&C_FLAG;         \
        // R.AF.B.l=(R.AF.B.l&0xEC)|(R.AF.B.h&0x01); \
        // R.AF.B.h=(R.AF.B.h>>1)|(i<<7);            \
        //}
        function RRA() {
            var i = 0;
            var acc = 0;
            i = (getF()|0) & C_FLAG;
            acc = getA()|0;
            setF((((getF()|0) & 0xEC) | (acc & 0x01))|0);
            setA(((acc >> 1) | (i << 7))|0);
        }
        //static void ind(void)
        //{
        // --R.BC.B.h;
        // M_WRMEM(R.HL.D,DoIn(R.BC.B.l,R.BC.B.h));
        // --R.HL.W.l;
        // R.AF.B.l=(R.BC.B.h)? N_FLAG:(N_FLAG|Z_FLAG);
        //}
        function postIND() {
            decHL();
            setF(((getB()|0) ? N_FLAG : (N_FLAG | Z_FLAG))|0);
        }
        //static void ini(void)
        //{
        // --R.BC.B.h;
        // M_WRMEM(R.HL.D,DoIn(R.BC.B.l,R.BC.B.h));
        // ++R.HL.W.l;
        // R.AF.B.l=(R.BC.B.h)? N_FLAG:(N_FLAG|Z_FLAG);
        //}
        function postINI() {
            incHL();
            setF(((getB()|0) ? N_FLAG : (N_FLAG | Z_FLAG))|0);
        }
        //static void outd(void)
        //{
        // --R.BC.B.h;
        // DoOut (R.BC.B.l,R.BC.B.h,(word)M_RDMEM(R.HL.D));
        // --R.HL.W.l;
        // R.AF.B.l=(R.BC.B.h)? N_FLAG:(Z_FLAG|N_FLAG);
        //}
        function postOUTD() {
            decHL();
            setF(((getB()|0) ? N_FLAG : (N_FLAG | Z_FLAG))|0);
        }
        //static void outi(void)
        //{
        // --R.BC.B.h;
        // DoOut (R.BC.B.l,R.BC.B.h,(word)M_RDMEM(R.HL.D));
        // ++R.HL.W.l;
        // R.AF.B.l=(R.BC.B.h)? N_FLAG:(Z_FLAG|N_FLAG);
        //}
        function postOUTI() {
            incHL();
            setF(((getB()|0) ? N_FLAG : (N_FLAG | Z_FLAG))|0);
        }

        //static void ldd(void)
        //{
        // M_WRMEM(R.DE.D,M_RDMEM(R.HL.D));
        // --R.DE.W.l;
        // --R.HL.W.l;
        // --R.BC.W.l;
        // R.AF.B.l=(R.AF.B.l&0xE9)|(R.BC.D? V_FLAG:0);
        //}
        function onLDD() {
            decDE();
            decHL();
            decBC();
            setF((((getF()|0) & 0xE9) | ((getBC()|0) ? V_FLAG : 0))|0);
        }
        //static void ldi(void)
        //{
        // M_WRMEM(R.DE.D,M_RDMEM(R.HL.D));
        // ++R.DE.W.l;
        // ++R.HL.W.l;
        // --R.BC.W.l;
        // R.AF.B.l=(R.AF.B.l&0xE9)|(R.BC.D? V_FLAG:0);
        //}
        function onLDI() {
            incDE();
            incHL();
            decBC();
            setF((((getF()|0) & 0xE9) | ((getBC()|0) ? V_FLAG : 0))|0);
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
        function addAcc(n) {
            n = n | 0;
            var q = 0;
            q = ((getA()|0) + n)|0;
            setF(( (getZSTable((q & 255)|0)|0) | ((q & 256) >> 8) |
                (((getA()|0) ^ q ^ n) & H_FLAG) |
                (((n ^ (getA()|0) ^ 0x80) & (n ^ q) & 0x80) >> 5) )|0);
            setA((q & 255)|0);
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
        function addAccWithCarry(n) {
            n = n | 0;
            var q = 0;
            q = ((getA()|0) + n + ((getF()|0) & C_FLAG))|0;
            setF( ((getZSTable((q & 255)|0)|0) | ((q & 256) >> 8) |
                (((getA()|0) ^ q ^ n) & H_FLAG) |
                (((n ^ (getA()|0) ^ 0x80) & (n ^ q) & 0x80) >> 5))|0 );
            setA( (q & 255)|0 );
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
        function subAcc(n) {
            n = n | 0;
            var q = 0;

            q = (((getA()|0) - n) & 0x1ff)|0;
            setF( ((getZSTable((q & 255)|0)|0) | ((q & 256) >> 8) | N_FLAG |
                (((getA()|0) ^ q ^ n) & H_FLAG) |
                (((n ^ (getA()|0) ^ 0x80) & (n ^ q) & 0x80) >> 5))|0 );
            setA( (q & 255)|0 );
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
        function subAccWithCarry(n) {
            n = n | 0;
            var q = 0;

            q = (((getA()|0) - n - ((getF()|0) & C_FLAG)) & 0x1ff)|0;
            setF( ((getZSTable((q & 255)|0)|0) | ((q & 256) >> 8) | N_FLAG |
                  (((getA()|0) ^ q ^ n) & H_FLAG) |
                  (((n ^ (getA()|0) ^ 0x80) & (n ^ q) & 0x80) >> 5))|0 );
            setA( (q & 255)|0 );
        }
        //#define M_AND(Reg)
        //  R.AF.B.h &= Reg;
        //  R.AF.B.l = ZSPTable[R.AF.B.h] | H_FLAG
        function andAcc(n) {
            n = n | 0;
            setA( ((getA()|0) & (n & 0xff))|0);
            setF( ((getZSPTable(getA()|0)|0) | H_FLAG)|0 );
        }
        //#define M_OR(Reg)
        //  R.AF.B.h |= Reg;
        //  R.AF.B.l = ZSPTable[R.AF.B.h]
        function orAcc(n) {
            n = n | 0;
            setA( ((getA()|0) | (n & 0xff))|0 );
            setF( getZSPTable(getA()|0)|0 );
        }
        //#define M_XOR(Reg)
        //  R.AF.B.h ^= Reg;
        //  R.AF.B. l= ZSPTable[R.AF.B.h]
        function xorAcc(n) {
            n = n | 0;
            setA( ((getA()|0) ^ (n & 0xff))|0 );
            setF( getZSPTable(getA()|0)|0 );
        }
        //static void cpl(void) {
        //  R.AF.B.h^=0xFF;
        //  R.AF.B.l|=(H_FLAG|N_FLAG);
        //}
        function CPL() {
            setA((((getA()|0) ^ 0xff) & 255)|0);
            setF((H_FLAG | N_FLAG)|0);
        }

        //static void neg(void)
        //{
        // byte i;
        // i=R.AF.B.h;
        // R.AF.B.h=0;
        // M_SUB(i);
        //}
        function NEG() {
            var i = 0;
            i = getA()|0;
            setA(0);
            subAcc(i);
        }
        //#define M_INC(Reg)
        // ++Reg;
        // R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[Reg]|
        //          ((Reg==0x80)?V_FLAG:0)|((Reg&0x0F)?0:H_FLAG)
        function getINCValue(n) {
            n = n | 0;
            n = ((n + 1)|0) & 255;
            setF( (((getF()|0) & C_FLAG) |
                (getZSTable(n)|0) |
                (((n|0) == 0x80) ? V_FLAG : 0) |
                ((n & 0x0F) ? 0 : H_FLAG))|0 );
            return n|0;
        }
        //#define M_DEC(Reg)
        //  R.AF.B.l=(R.AF.B.l&C_FLAG)|N_FLAG|
        //           ((Reg==0x80)?V_FLAG:0)|((Reg&0x0F)?0:H_FLAG);
        //  R.AF.B.l|=ZSTable[--Reg]
        function getDECValue(n) {
            n = n | 0;
            setF( (((getF()|0) & C_FLAG) | N_FLAG |
                (((n|0) == 0x80) ? V_FLAG : 0) |
                ((n & 0x0F) ? 0 : H_FLAG))|0 );
            n = ((n - 1)|0) & 255;
            setF( (getF()|0) | (getZSTable(n)|0) );
            return n|0;
        }
        //#define M_CP(Reg)
        //{
        // int q;
        // q=R.AF.B.h-Reg;
        // R.AF.B.l=ZSTable[q&255]|((q&256)>>8)|N_FLAG|
        //          ((R.AF.B.h^q^Reg)&H_FLAG)|
        //          (((Reg^R.AF.B.h)&(Reg^q)&0x80)>>5);
        //}
        function compareAcc(n) {
            n = n | 0;
            var q = 0;
            q = ((getA()|0) - n)|0;
            setF( ((getZSTable((q & 255)|0)|0) | ((q & 256) >> 8) | N_FLAG |
                (((getA()|0) ^ q ^ n) & H_FLAG) |
                (((n ^ (getA()|0)) & (n ^ q) & 0x80) >> 5))|0 );
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
        function CPI(n) {
            n = n | 0;
            var q = 0;
            q = ((getA()|0) - n)|0;
            incHL();
            decBC();
            setF( (((getF()|0) & C_FLAG) | (getZSTable((q & 255)|0)|0) |
                  (((getA()|0) ^ n ^ q) & H_FLAG) |
                  ((getBC()|0) ? V_FLAG : 0) | N_FLAG)|0 );
        }
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
        function CPD(n) {
            n = n | 0;
            var q = 0;
            q = ((getA()|0) - n)|0;
            decHL();
            decBC();
            setF( (((getF()|0) & C_FLAG) | (getZSTable((q & 255)|0)|0) |
                  (((getA()|0) ^ n ^ q) & H_FLAG) |
                  ((getBC()|0) ? V_FLAG : 0) | N_FLAG)|0 );
        }
        //#define M_RLC(Reg)
        //{
        // int q;
        // q=Reg>>7;
        // Reg=(Reg<<1)|q;
        // R.AF.B.l=ZSPTable[Reg]|q;
        //}
        function RLC(x) {
            x = x|0;
            var q = 0;
            q = (x >> 7)|0;
            x = (((x << 1) | q) & 255)|0;
            setF( ((getZSPTable(x|0)|0) | q)|0 );
            return x|0;
        }
        //#define M_RL(Reg)            \
        //{                            \
        // int q;                      \
        // q=Reg>>7;                   \
        // Reg=(Reg<<1)|(R.AF.B.l&1);  \
        // R.AF.B.l=ZSPTable[Reg]|q;   \
        //}
        function RL(x) {
            x = x|0;
            var q = 0;
            q = (x >> 7)|0;
            x = ((x << 1) | ((getF()|0) & 1)) & 255;
            setF( ((getZSPTable(x|0)|0) | q)|0 );
            return x|0;
        }
        //#define M_RRC(Reg)         \
        //{                          \
        // int q;                    \
        // q=Reg&1;                  \
        // Reg=(Reg>>1)|(q<<7);      \
        // R.AF.B.l=ZSPTable[Reg]|q; \
        //}
        function RRC(x) {
            x = x|0;
            var q = 0;
            q = (x & 1)|0;
            x = (x >> 1) | ((q << 7) & 255);
            setF( ((getZSPTable(x|0)|0) | q)|0 );
            return x|0;
        }
        //#define M_RR(Reg)            \
        //{                            \
        // int q;                      \
        // q=Reg&1;                    \
        // Reg=(Reg>>1)|(R.AF.B.l<<7); \
        // R.AF.B.l=ZSPTable[Reg]|q;   \
        //}
        function RR(x) {
            x = x|0;
            var q = 0;
            q = (x & 1)|0;
            x = (x >> 1) | (((getF()|0) << 7) & 255);
            setF( ((getZSPTable(x|0)|0) | q)|0 );
            return x|0;
        }
        //#define M_SLA(Reg)           \
        //{                            \
        // int q;                      \
        // q=Reg>>7;                   \
        // Reg<<=1;                    \
        // R.AF.B.l=ZSPTable[Reg]|q;   \
        //}
        function SLA(x) {
            x = x|0;
            var q = 0;
            q = (x >> 7)|0;
            x = (x << 1) & 255;
            setF( ((getZSPTable(x|0)|0) | q)|0 );
            return x|0;
        }
        //#define M_SRA(Reg)           \
        //{                            \
        // int q;                      \
        // q=Reg&1;                    \
        // Reg=(Reg>>1)|(Reg&0x80);    \
        // R.AF.B.l=ZSPTable[Reg]|q;   \
        //}
        function SRA(x) {
            x = x|0;
            var q = 0;
            q = (x & 1)|0;
            x = (x >> 1) | (x & 0x80);
            setF( ((getZSPTable(x|0)|0) | q)|0 );
            return x|0;
        }
        //#define M_SRL(Reg)           \
        //{                            \
        // int q;                      \
        // q=Reg&1;                    \
        // Reg>>=1;                    \
        // R.AF.B.l=ZSPTable[Reg]|q;   \
        //}
        function SRL(x) {
            x = x|0;
            var q = 0;
            q = (x & 1)|0;
            x = x >> 1;
            setF( ((getZSPTable(x|0)|0) | q)|0 );
            return x|0;
        }
        //#define DoIn(lo,hi)     Z80_In( (word) ((lo)|((word) ((hi)<<8) )))
        //#define M_IN(Reg)           \
        //        Reg=DoIn(R.BC.B.l,R.BC.B.h); \
        //        R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSPTable[Reg]
        function onReadIoPort(Reg) {
            Reg = Reg|0;
            setF( (((getF()|0) & C_FLAG) | (getZSPTable(Reg|0)|0))|0 );
        }
        //static void ld_a_i(void)
        //{
        // R.AF.B.h=R.I;
        // R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[R.I]|(R.IFF2<<2);
        //}
        function LD_A_I(iff2, I) {
            iff2 = iff2|0;
            I = I|0;
            setA(I);
            setF( (((getF()|0) & C_FLAG) | (getZSTable(I)|0) | (iff2 << 2))|0 );
        }
        //static void ld_a_r(void)
        //{
        // R.AF.B.h=(R.R&127)|(R.R2&128);
        // R.AF.B.l=(R.AF.B.l&C_FLAG)|ZSTable[R.AF.B.h]|(R.IFF2<<2);
        //}
        function LD_A_R(iff2,r2, R) {
            iff2 = iff2|0;
            r2 = r2|0;
            R = R|0;
            setA((R & 127) | (r2 & 128));
            setF( (((getF()|0) & C_FLAG) | (getZSTable((getA()|0))|0) | (iff2 << 2))|0 );
        }

        return {
            getPTable: getPTable,
            setPTable: setPTable,
            getZSTable: getZSTable,
            setZSTable: setZSTable,
            getZSPTable: getZSPTable,
            setZSPTable: setZSPTable,
            initialize: initialize,
            clear: clear,
            setB: setB, getB: getB,
            setC: setC, getC: getC,
            setD: setD, getD: getD,
            setE: setE, getE: getE,
            setH: setH, getH: getH,
            setL: setL, getL: getL,
            setA: setA, getA: getA,
            setF: setF, getF: getF,
            setBC: setBC, getBC: getBC,
            setDE: setDE, getDE: getDE,
            setHL: setHL, getHL: getHL,
            setAF: setAF, getAF: getAF,
            testFlag: testFlag, setFlag: setFlag, clearFlag: clearFlag,
            flagS: flagS,
            flagZ: flagZ,
            flagH: flagH,
            flagP: flagP,
            flagN: flagN,
            flagC: flagC,
            setFlagS: setFlagS,
            setFlagZ: setFlagZ,
            setFlagH: setFlagH,
            setFlagP: setFlagP,
            setFlagN: setFlagN,
            setFlagC: setFlagC,
            clearFlagS: clearFlagS,
            clearFlagZ: clearFlagZ,
            clearFlagH: clearFlagH,
            clearFlagP: clearFlagP,
            clearFlagN: clearFlagN,
            clearFlagC: clearFlagC,
            ADDW: ADDW,
            ADD_HL: ADD_HL,
            ADC_HL: ADC_HL,
            SBC_HL: SBC_HL,
            incBC: incBC,
            decBC: decBC,
            incHL: incHL,
            decHL: decHL,
            incDE: incDE,
            decDE: decDE,
            RLCA: RLCA,
            RLA: RLA,
            RRCA: RRCA,
            RRA: RRA,
            postIND: postIND,
            postINI: postINI,
            postOUTD: postOUTD,
            postOUTI: postOUTI,
            onLDD: onLDD,
            onLDI: onLDI,
            addAcc: addAcc,
            addAccWithCarry: addAccWithCarry,
            subAcc: subAcc,
            subAccWithCarry: subAccWithCarry,
            andAcc: andAcc,
            orAcc: orAcc,
            xorAcc: xorAcc,
            CPL: CPL,
            NEG: NEG,
            getINCValue: getINCValue,
            getDECValue: getDECValue,
            compareAcc: compareAcc,
            CPI: CPI,
            CPD: CPD,
            RLC: RLC,
            RL: RL,
            RRC: RRC,
            RR: RR,
            SLA: SLA,
            SRA: SRA,
            SRL: SRL,
            onReadIoPort: onReadIoPort,
            LD_A_I: LD_A_I,
            LD_A_R: LD_A_R,
        };
    }

    var Z80_Register = function() {
        var stdlib = (Function("return this;")());
        var foreign = Z80BinUtil;
        var heap = new ArrayBuffer(64 * 1024);
        this._reg8 = Z80Reg8bitIf( stdlib, foreign, heap);
        this._reg8.initialize();
        this.clear();

        //16bit register
        this.PC = 0;	//プログラムカウンタ
        this.SP = 0;	//スタックポインタ
        this.IX = 0;	//インデックスレジスタX
        this.IY = 0;	//インデックスレジスタY
        
        this.R = 0;	//リフレッシュレジスタ
        this.I = 0;	//割り込みベクタ
        this.getB = this._reg8.getB;
        this.getC = this._reg8.getC;
        this.getD = this._reg8.getD;
        this.getE = this._reg8.getE;
        this.getH = this._reg8.getH;
        this.getL = this._reg8.getL;
        this.getA = this._reg8.getA;
        this.getF = this._reg8.getF;
        this.setB = this._reg8.setB;
        this.setC = this._reg8.setC;
        this.setD = this._reg8.setD;
        this.setE = this._reg8.setE;
        this.setH = this._reg8.setH;
        this.setL = this._reg8.setL;
        this.setA = this._reg8.setA;
        this.setF = this._reg8.setF;
        this.testFlag = this._reg8.testFlag;
        this.flagS = this._reg8.flagS;
        this.flagZ = this._reg8.flagZ;
        this.flagH = this._reg8.flagH;
        this.flagP = this._reg8.flagP;
        this.flagN = this._reg8.flagN;
        this.flagC = this._reg8.flagC;
        this.setFlag = this._reg8.setFlag;
        this.setFlagS = this._reg8.setFlagS;
        this.setFlagZ = this._reg8.setFlagZ;
        this.setFlagH = this._reg8.setFlagH;
        this.setFlagP = this._reg8.setFlagP;
        this.setFlagN = this._reg8.setFlagN;
        this.setFlagC = this._reg8.setFlagC;
        this.clearFlag = this._reg8.clearFlag;
        this.clearFlagS = this._reg8.clearFlagS;
        this.clearFlagZ = this._reg8.clearFlagZ;
        this.clearFlagH = this._reg8.clearFlagH;
        this.clearFlagP = this._reg8.clearFlagP;
        this.clearFlagN = this._reg8.clearFlagN;
        this.clearFlagC = this._reg8.clearFlagC;
        this.getHL = this._reg8.getHL;
        this.getBC = this._reg8.getBC;
        this.getDE = this._reg8.getDE;
        this.getAF = this._reg8.getAF;
        this.setHL = this._reg8.setHL;
        this.setBC = this._reg8.setBC;
        this.setDE = this._reg8.setDE;
        this.setAF = this._reg8.setAF;
        this.ADD_HL = this._reg8.ADD_HL;
        this.ADC_HL = this._reg8.ADC_HL;
        this.SBC_HL = this._reg8.SBC_HL;
        this.incBC = this._reg8.incBC;
        this.decBC = this._reg8.decBC;
        this.incHL = this._reg8.incHL;
        this.decHL = this._reg8.decHL;
        this.incDE = this._reg8.incDE;
        this.decDE = this._reg8.decDE;
        this.RLCA = this._reg8.RLCA;
        this.RLA = this._reg8.RLA;
        this.RRCA = this._reg8.RRCA;
        this.RRA = this._reg8.RRA;
        this.postIND = this._reg8.postIND;
        this.postINI = this._reg8.postINI;
        this.postOUTD = this._reg8.postOUTD;
        this.postOUTI = this._reg8.postOUTI;
        this.onLDD = this._reg8.onLDD;
        this.onLDI = this._reg8.onLDI;
        this.addAcc = this._reg8.addAcc;
        this.addAccWithCarry = this._reg8.addAccWithCarry;
        this.subAcc = this._reg8.subAcc;
        this.subAccWithCarry = this._reg8.subAccWithCarry;
        this.andAcc = this._reg8.andAcc;
        this.orAcc = this._reg8.orAcc;
        this.xorAcc = this._reg8.xorAcc;
        this.CPL = this._reg8.CPL;
        this.NEG = this._reg8.NEG;
        this.getINCValue = this._reg8.getINCValue;
        this.getDECValue = this._reg8.getDECValue;
        this.compareAcc = this._reg8.compareAcc;
        this.CPI = this._reg8.CPI;
        this.CPD = this._reg8.CPD;
        this.RLC = this._reg8.RLC;
        this.RL = this._reg8.RL;
        this.RRC = this._reg8.RRC;
        this.RR = this._reg8.RR;
        this.SLA = this._reg8.SLA;
        this.SRA = this._reg8.SRA;
        this.SRL = this._reg8.SRL;
        this.onReadIoPort = this._reg8.onReadIoPort;
    };

    Z80_Register.prototype.cloneRaw = function() {
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
    };
    Z80_Register.prototype.clear = function() {
        this._reg8.clear();
        this.PC = 0;
        this.SP = 0;
        this.IX = 0;
        this.IY = 0;
        this.R = 0;
        this.I = 0;
    }
    Z80_Register.prototype.setFrom = function(reg) {
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
    Z80_Register.prototype.setPair = function(rr, value) {
        switch(rr) {
            case "SP": this.SP = value; break;
            case "PC": this.PC = value; break;
            case "IX": this.IX = value; break;
            case "IY": this.IY = value; break;
            case "BC": this.setBC( value ); break;
            case "DE": this.setDE( value ); break;
            case "HL": this.setHL( value ); break;
            case "AF": this.setAF( value ); break;
        }
    }
    Z80_Register.prototype.debugDump = function() {
        console.info(
                "B:" + this.getB().HEX(2) + "H " + this.getB() + " " +
                "C:" + this.getC().HEX(2) + "H " + this.getC() + " / " + this.getBC());
        console.info(
                "D:" + this.getD().HEX(2) + "H " + this.getD() + " " +
                "E:" + this.getE().HEX(2) + "H " + this.getE() + " / " + this.getDE());
        console.info(
                "H:" + this.getH().HEX(2) + "H " + this.getH() + " " +
                "L:" + this.getL().HEX(2) + "H " + this.getL() + " / " + this.getHL());
        console.info("A:" + this.getA().HEX(2) + "H " + this.getA());
        console.info("SZ-HPN-C");
        console.info(this.getF().bin(8));
        console.info("PC:" + this.PC.HEX(4) + "H " + this.PC.bin(16) + "(2) " + this.PC);
        console.info("SP:" + this.SP.HEX(4) + "H " + this.SP.bin(16) + "(2) " + this.SP);
        console.info("I:" + this.I.HEX(2) + "H " + this.I.bin(8) + "(2) " + this.I + " " +
        "R:" + this.R.HEX(2) + "H " + this.R.bin(8) + "(2) " + this.R);
    }

    Z80_Register.prototype.ADD_IX = function(n)
    {
        this.IX = this._reg8.ADDW(this.IX, n);
    }
    Z80_Register.prototype.ADD_IY = function(n)
    {
        this.IY = this._reg8.ADDW(this.IY, n);
    }

    Z80_Register.prototype.jumpRel = function(e) {
        this.PC += Z80BinUtil.getSignedByte(e);
    }
    Z80_Register.prototype.increment = function(r) {
        this["set" + r]( this.getINCValue(this["get" + r]()) );
    }
    Z80_Register.prototype.decrement = function(r) {
        this["set" + r]( this.getDECValue(this["get" + r]()) );
    }
    Z80_Register.prototype.LD_A_I = function(iff2) {
        this._reg8.LD_A_I(iff2, this.I);
    };
    Z80_Register.prototype.LD_A_R = function(iff2,r2) {
        this._reg8.LD_A_R(iff2, r2, this.R);
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

    /* FLAG MASK BIT CONSTANT */
    var H_FLAG = 0x10;
    var N_FLAG = 0x02;
    var C_FLAG = 0x01;

    Z80_Register.prototype.DAA = function() {
        var i = this.getA();
        var f = this.getF();
        if(f & C_FLAG) { i |= 0x100; }
        if(f & H_FLAG) { i |= 0x200; }
        if(f & N_FLAG) { i |= 0x400; }
        this.setAF(DAATable[i]);
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

    module.exports = Z80_Register;
}());
