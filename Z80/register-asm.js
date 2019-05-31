(function() {
    "use strict";
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
    module.exports = Z80Reg8bitIf;
}());
