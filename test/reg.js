var UnitTest = require("./UnitTest");
var fs = require('fs');
eval(fs.readFileSync('../lib/ex_number.js')+'');
eval(fs.readFileSync('../Z80/emulator.js')+'');
eval(fs.readFileSync('../Z80/memory.js')+'');
eval(fs.readFileSync('../Z80/register.js')+'');
var tests = [
    function () {
        var reg = new Z80_Register();
        UnitTest.report("initial value of B", reg.B == 0);
        UnitTest.report("initial value of C", reg.C == 0);
        UnitTest.report("initial value of D", reg.D == 0);
        UnitTest.report("initial value of E", reg.E == 0);
        UnitTest.report("initial value of H", reg.H == 0);
        UnitTest.report("initial value of L", reg.L == 0);
        UnitTest.report("initial value of A", reg.A == 0);
        UnitTest.report("initial value of F", reg.F == 0);
        UnitTest.report("initial value of PC", reg.PC == 0);
        UnitTest.report("initial value of SP", reg.SP == 0);
        UnitTest.report("initial value of IX", reg.IX == 0);
        UnitTest.report("initial value of IY", reg.IY == 0);
        UnitTest.report("initial value of R", reg.R == 0);
        UnitTest.report("initial value of I", reg.I == 0);
    },
    function () {
        var reg = new Z80_Register();
        var i = 0;
        reg.B = 0x55 + i++;
        reg.C = 0x55 + i++;
        reg.D = 0x55 + i++;
        reg.E = 0x55 + i++;
        reg.H = 0x55 + i++;
        reg.L = 0x55 + i++;
        reg.A = 0x55 + i++;
        reg.F = 0x55 + i++;
        reg.PC = 0x55 + i++;
        reg.SP = 0x55 + i++;
        reg.IX = 0x55 + i++;
        reg.IY = 0x55 + i++;
        reg.R = 0x55 + i++;
        reg.I = 0x55 + i++;
        var reg2 = new Z80_Register();
        reg2.setFrom(reg);
        i = 0;
        UnitTest.report("set value of B", reg2.B == 0x55 + i++);
        UnitTest.report("set value of C", reg2.C == 0x55 + i++);
        UnitTest.report("set value of D", reg2.D == 0x55 + i++);
        UnitTest.report("set value of E", reg2.E == 0x55 + i++);
        UnitTest.report("set value of H", reg2.H == 0x55 + i++);
        UnitTest.report("set value of L", reg2.L == 0x55 + i++);
        UnitTest.report("set value of A", reg2.A == 0x55 + i++);
        UnitTest.report("set value of F", reg2.F == 0x55 + i++);
        UnitTest.report("set value of PC", reg2.PC == 0x55 + i++);
        UnitTest.report("set value of SP", reg2.SP == 0x55 + i++);
        UnitTest.report("set value of IX", reg2.IX == 0x55 + i++);
        UnitTest.report("set value of IY", reg2.IY == 0x55 + i++);
        UnitTest.report("set value of R", reg2.R == 0x55 + i++);
        UnitTest.report("set value of I", reg2.I == 0x55 + i++);
    },
    function () {
        var reg = new Z80_Register();
        var i = 0;
        reg.B = 0x55 + i++;
        reg.C = 0x55 + i++;
        reg.D = 0x55 + i++;
        reg.E = 0x55 + i++;
        reg.H = 0x55 + i++;
        reg.L = 0x55 + i++;
        reg.A = 0x55 + i++;
        reg.F = 0x55 + i++;
        reg.PC = 0x55 + i++;
        reg.SP = 0x55 + i++;
        reg.IX = 0x55 + i++;
        reg.IY = 0x55 + i++;
        reg.R = 0x55 + i++;
        reg.I = 0x55 + i++;
        reg.clear();
        UnitTest.report("cleared value of B", reg.B == 0);
        UnitTest.report("cleared value of C", reg.C == 0);
        UnitTest.report("cleared value of D", reg.D == 0);
        UnitTest.report("cleared value of E", reg.E == 0);
        UnitTest.report("cleared value of H", reg.H == 0);
        UnitTest.report("cleared value of L", reg.L == 0);
        UnitTest.report("cleared value of A", reg.A == 0);
        UnitTest.report("cleared value of F", reg.F == 0);
        UnitTest.report("cleared value of PC", reg.PC == 0);
        UnitTest.report("cleared value of SP", reg.SP == 0);
        UnitTest.report("cleared value of IX", reg.IX == 0);
        UnitTest.report("cleared value of IY", reg.IY == 0);
        UnitTest.report("cleared value of R", reg.R == 0);
        UnitTest.report("cleared value of I", reg.I == 0);
    },
    function() {
        var reg = new Z80_Register();
        reg.clear();
        reg.setPair("PC", 0x1234);
        UnitTest.report("After set PC by setPair, value of B", reg.B == 0);
        UnitTest.report("After set PC by setPair, value of C", reg.C == 0);
        UnitTest.report("After set PC by setPair, value of D", reg.D == 0);
        UnitTest.report("After set PC by setPair, value of E", reg.E == 0);
        UnitTest.report("After set PC by setPair, value of H", reg.H == 0);
        UnitTest.report("After set PC by setPair, value of L", reg.L == 0);
        UnitTest.report("After set PC by setPair, value of A", reg.A == 0);
        UnitTest.report("After set PC by setPair, value of F", reg.F == 0);
        UnitTest.report("After set PC by setPair, value of PC", reg.PC == 0x1234);
        UnitTest.report("After set PC by setPair, value of SP", reg.SP == 0);
        UnitTest.report("After set PC by setPair, value of IX", reg.IX == 0);
        UnitTest.report("After set PC by setPair, value of IY", reg.IY == 0);
        UnitTest.report("After set PC by setPair, value of R", reg.R == 0);
        UnitTest.report("After set PC by setPair, value of I", reg.I == 0);
        reg.clear();
        reg.setPair("SP", 0x1234);
        UnitTest.report("After set SP by setPair, value of B", reg.B == 0);
        UnitTest.report("After set SP by setPair, value of C", reg.C == 0);
        UnitTest.report("After set SP by setPair, value of D", reg.D == 0);
        UnitTest.report("After set SP by setPair, value of E", reg.E == 0);
        UnitTest.report("After set SP by setPair, value of H", reg.H == 0);
        UnitTest.report("After set SP by setPair, value of L", reg.L == 0);
        UnitTest.report("After set SP by setPair, value of A", reg.A == 0);
        UnitTest.report("After set SP by setPair, value of F", reg.F == 0);
        UnitTest.report("After set SP by setPair, value of PC", reg.PC == 0);
        UnitTest.report("After set SP by setPair, value of SP", reg.SP == 0x1234);
        UnitTest.report("After set SP by setPair, value of IX", reg.IX == 0);
        UnitTest.report("After set SP by setPair, value of IY", reg.IY == 0);
        UnitTest.report("After set SP by setPair, value of R", reg.R == 0);
        UnitTest.report("After set SP by setPair, value of I", reg.I == 0);
        reg.clear();
        reg.setPair("IX", 0x1234);
        UnitTest.report("After set IX by setPair, value of B", reg.B == 0);
        UnitTest.report("After set IX by setPair, value of C", reg.C == 0);
        UnitTest.report("After set IX by setPair, value of D", reg.D == 0);
        UnitTest.report("After set IX by setPair, value of E", reg.E == 0);
        UnitTest.report("After set IX by setPair, value of H", reg.H == 0);
        UnitTest.report("After set IX by setPair, value of L", reg.L == 0);
        UnitTest.report("After set IX by setPair, value of A", reg.A == 0);
        UnitTest.report("After set IX by setPair, value of F", reg.F == 0);
        UnitTest.report("After set IX by setPair, value of PC", reg.PC == 0);
        UnitTest.report("After set IX by setPair, value of SP", reg.SP == 0);
        UnitTest.report("After set IX by setPair, value of IX", reg.IX == 0x1234);
        UnitTest.report("After set IX by setPair, value of IY", reg.IY == 0);
        UnitTest.report("After set IX by setPair, value of R", reg.R == 0);
        UnitTest.report("After set IX by setPair, value of I", reg.I == 0);
        reg.clear();
        reg.setPair("IY", 0x1234);
        UnitTest.report("After set IY by setPair, value of B", reg.B == 0);
        UnitTest.report("After set IY by setPair, value of C", reg.C == 0);
        UnitTest.report("After set IY by setPair, value of D", reg.D == 0);
        UnitTest.report("After set IY by setPair, value of E", reg.E == 0);
        UnitTest.report("After set IY by setPair, value of H", reg.H == 0);
        UnitTest.report("After set IY by setPair, value of L", reg.L == 0);
        UnitTest.report("After set IY by setPair, value of A", reg.A == 0);
        UnitTest.report("After set IY by setPair, value of F", reg.F == 0);
        UnitTest.report("After set IY by setPair, value of PC", reg.PC == 0);
        UnitTest.report("After set IY by setPair, value of SP", reg.SP == 0);
        UnitTest.report("After set IY by setPair, value of IX", reg.IX == 0);
        UnitTest.report("After set IY by setPair, value of IY", reg.IY == 0x1234);
        UnitTest.report("After set IY by setPair, value of R", reg.R == 0);
        UnitTest.report("After set IY by setPair, value of I", reg.I == 0);
    },
    /************************************************************************************
    function() {
        var reg = new Z80_Register();
        reg.setFlagP();
        reg.updateFlagV(127);
        UnitTest.report("(1)updateFlagV(127) clear the flag P/V", reg.flagP() == false);
        reg.setFlagP();
        reg.updateFlagV(-128);
        UnitTest.report("(2)updateFlagV(-128) clear the flag P/V", reg.flagP() == false);
        reg.clearFlagP();
        reg.updateFlagV(128);
        UnitTest.report("(3)updateFlagV(128) set the flag P/V", reg.flagP() == true);
        reg.clearFlagP();
        reg.updateFlagV(-129);
        UnitTest.report("(4)updateFlagV(-129) set the flag P/V", reg.flagP() == true);
    },
    ************************************************************************************/
    function() {
        var reg = new Z80_Register();
        reg.clear();
        reg.A = 0;
        reg.NEG();
        UnitTest.report("NEG 0 A", reg.A == 0x00);
        UnitTest.report("NEG 0 flagZ", reg.flagZ() == true);
        UnitTest.report("NEG 0 flagS", reg.flagS() == false);
        UnitTest.report("NEG 0 flagC", reg.flagC() == false);
        
        reg.A = 1;
        reg.NEG();
        UnitTest.report("NEG 1 A", reg.A == 0xff);
        UnitTest.report("NEG 1 flagZ", reg.flagZ() == false);
        UnitTest.report("NEG 1 flagS", reg.flagS() == true);
        UnitTest.report("NEG 1 flagC", reg.flagC() == true);

        reg.A = 0xff;
        reg.NEG();
        UnitTest.report("NEG 0xff A", reg.A == 0x01);
        UnitTest.report("NEG 0xff flagZ", reg.flagZ() == false);
        UnitTest.report("NEG 0xff flagS", reg.flagS() == false);
        UnitTest.report("NEG 0xff flagC", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.clear();
        reg.A = 0;
        reg.addAcc(0);
        UnitTest.report("addAcc 0+0 A", reg.A == 0x00);
        UnitTest.report("addAcc 0+0 flagZ", reg.flagZ() == true);
        UnitTest.report("addAcc 0+0 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 0+0 flagC", reg.flagC() == false);
        
        reg.A = 0;
        reg.addAcc(1);
        UnitTest.report("addAcc 0+1 A", reg.A == 0x01);
        UnitTest.report("addAcc 0+1 flagZ", reg.flagZ() == false);
        UnitTest.report("addAcc 0+1 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 0+1 flagC", reg.flagC() == false);

        reg.A = 126;
        reg.addAcc(1);
        UnitTest.report("addAcc 126+1 A", reg.A == 127);
        UnitTest.report("addAcc 0+1 flagZ", reg.flagZ() == false);
        UnitTest.report("addAcc 0+1 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 0+1 flagC", reg.flagC() == false);

        reg.A = 126;
        reg.addAcc(2);
        UnitTest.report("addAcc 126+2 A", reg.A == 128);
        UnitTest.report("addAcc 126+2 flagZ", reg.flagZ() == false);
        UnitTest.report("addAcc 126+2 flagS", reg.flagS() == true);
        UnitTest.report("addAcc 126+2 flagC", reg.flagC() == false);

        reg.A = 126;
        reg.addAcc(130);
        UnitTest.report("addAcc 126+130 A", reg.A == 0);
        UnitTest.report("addAcc 126+130 flagZ", reg.flagZ() == true);
        UnitTest.report("addAcc 126+130 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 126+130 flagC", reg.flagC() == true);

        reg.A = 126;
        reg.addAcc(131);
        UnitTest.report("addAcc 126+131 A", reg.A == 1);
        UnitTest.report("addAcc 126+131 flagZ", reg.flagZ() == false);
        UnitTest.report("addAcc 126+131 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 126+131 flagC", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.A = 0x40;
        reg.RLCA();
        UnitTest.report("RLCA A == 0x80", reg.A == 0x80);
        UnitTest.report("RLCA Cy == false", reg.flagC() == false);
        reg.RLCA();
        UnitTest.report("RLCA A == 0x01", reg.A == 0x01);
        UnitTest.report("RLCA Cy == true", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.A = 0x40;
        reg.clearFlagC();
        reg.RRCA();
        UnitTest.report("(1)RRCA A == 0x20", reg.A == 0x20);
        UnitTest.report("(2)RRCA Cy == false", reg.flagC() == false);
        reg.A = 0x20;
        reg.setFlagC();
        reg.RRCA();
        UnitTest.report("(3)RRCA A == 0x10", reg.A == 0x10);
        UnitTest.report("(4)RRCA Cy == false", reg.flagC() == false);
        reg.A = 0x01;
        reg.setFlagC();
        reg.RRCA();
        UnitTest.report("(5)RRCA A == 0x80", reg.A == 0x80);
        UnitTest.report("(6)RRCA Z == false", reg.flagZ() == false);
        UnitTest.report("(7)RRCA Cy == true", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.clearFlagC();
        var r = reg.RRC(0x40);
        UnitTest.report("(1)RRC r == 0x80", r == 0x20);
        UnitTest.report("(2)RRC Cy == false", reg.flagC() == false);
        reg.setFlagC();
        r = reg.RRC(0x20);
        UnitTest.report("(3)RRC r == 0x10", r == 0x10);
        UnitTest.report("(4)RRC Cy == false", reg.flagC() == false);
        reg.setFlagC();
        r = reg.RRC(0x01);
        UnitTest.report("(5)RRC r == 0x80", r == 0x80);
        UnitTest.report("(6)RRC Z == false", reg.flagZ() == false);
        UnitTest.report("(7)RRC Cy == true", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.A = 0x40;
        reg.clearFlagC();
        reg.RRA();
        UnitTest.report("(1)RRA A == 0x20", reg.A == 0x20);
        UnitTest.report("(2)RRA Cy == false", reg.flagC() == false);
        reg.A = 0x20;
        reg.setFlagC();
        reg.RRA();
        UnitTest.report("(3)RRA A == 0x90", reg.A == 0x90);
        UnitTest.report("(4)RRA Cy == false", reg.flagC() == false);
        reg.A = 0x21;
        reg.setFlagC();
        reg.RRA();
        UnitTest.report("(5)RRA A == 0x90", reg.A == 0x90);
        UnitTest.report("(6)RRA Cy == true", reg.flagC() == true);
        reg.A = 0x01;
        reg.clearFlagC();
        reg.setFlagZ();
        reg.RRA();
        UnitTest.report("(7)RRA A == 0x00", reg.A == 0x00);
        UnitTest.report("(8)RRA Z == true", reg.flagZ() == true);
        UnitTest.report("(9)RRA Cy == true", reg.flagC() == true);
        reg.A = 0x01;
        reg.setFlagC();
        reg.clearFlagZ();
        reg.RRA();
        UnitTest.report("(10)RRA A == 0x80", reg.A == 0x80);
        UnitTest.report("(11)RRA Z == false", reg.flagZ() == false);
        UnitTest.report("(12)RRA Cy == true", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.clearFlagC();
        var r = reg.RR(0x40);
        UnitTest.report("(1)RR r == 0x80", r == 0x20);
        UnitTest.report("(2)RR Cy == false", reg.flagC() == false);
        UnitTest.report("(3)RR S == false", reg.flagS() == false);
        reg.setFlagC();
        r = reg.RR(0x20);
        UnitTest.report("(4)RR r == 0x90", r == 0x90);
        UnitTest.report("(5)RR Cy == false", reg.flagC() == false);
        reg.setFlagC();
        r = reg.RR(0x21);
        UnitTest.report("(6)RR r == 0x90", r == 0x90);
        UnitTest.report("(7)RR Cy == true", reg.flagC() == true);
        UnitTest.report("(8)RR S == true", reg.flagS() == true);
        reg.setFlagC();
        r = reg.RR(0x01);
        UnitTest.report("(9)RR r == 0x80", r == 0x80);
        UnitTest.report("(10)RR Z == false", reg.flagZ() == false);
        UnitTest.report("(11)RR Cy == true", reg.flagC() == true);
        UnitTest.report("(12)RR S == true", reg.flagS() == true);
    },
    /****************************************************************
    function() {
        var reg = new Z80_Register();
        reg.updateFlagP(0x00);
        UnitTest.report("even bits P/V == 1 (1)", reg.flagP() == 1);
        reg.updateFlagP(0x50);
        UnitTest.report("even bits P/V == 1 (2)", reg.flagP() == 1);
        reg.updateFlagP(0xa0);
        UnitTest.report("even bits P/V == 1 (3)", reg.flagP() == 1);
        reg.updateFlagP(0x05);
        UnitTest.report("even bits P/V == 1 (4)", reg.flagP() == 1);
        reg.updateFlagP(0x0a);
        UnitTest.report("even bits P/V == 1 (5)", reg.flagP() == 1);
        reg.updateFlagP(0xff);
        UnitTest.report("even bits P/V == 1 (6)", reg.flagP() == 1);
        reg.updateFlagP(0x01);
        UnitTest.report("even bits P/V == 0 (7)", reg.flagP() == 0);
        reg.updateFlagP(0x51);
        UnitTest.report("even bits P/V == 1 (8)", reg.flagP() == 0);
        reg.updateFlagP(0xa1);
        UnitTest.report("even bits P/V == 1 (9)", reg.flagP() == 0);
        reg.updateFlagP(0x15);
        UnitTest.report("even bits P/V == 1 (10)", reg.flagP() == 0);
        reg.updateFlagP(0x1a);
        UnitTest.report("even bits P/V == 1 (11)", reg.flagP() == 0);
        reg.updateFlagP(0xef);
        UnitTest.report("even bits P/V == 1 (12)", reg.flagP() == 0);

    },
    ******************************************************************/
    function() {
        var reg = new Z80_Register();
        reg.A = 0x40;
        reg.clearFlagS();
        reg.clearFlagC();
        reg.clearFlagZ();
        reg.clearFlagP();
        var r = reg.RLC(0x40);
        UnitTest.report("(1)RLC r == 0x80", r == 0x80);
        UnitTest.report("(2)RLC S == true", reg.flagS() == true);
        UnitTest.report("(3)RLC Z == false", reg.flagZ() == false);
        UnitTest.report("(4)RLC Cy == false", reg.flagZ() == false);
        UnitTest.report("(5)RLC P/V == false", reg.flagP() == false);
        reg.clearFlagS();
        reg.clearFlagC();
        reg.clearFlagZ();
        reg.clearFlagP();
        r = reg.RLC(r);
        UnitTest.report("(6)RLC r == 0x01", r == 0x01);
        UnitTest.report("(7)RLC S == false", reg.flagS() == false);
        UnitTest.report("(8)RLC Z == false", reg.flagZ() == false);
        UnitTest.report("(9)RLC Cy == true", reg.flagC() == true);
        UnitTest.report("(10)RLC P/V == false", reg.flagP() == false);
        reg.clearFlagS();
        reg.clearFlagC();
        reg.clearFlagZ();
        reg.clearFlagP();
        r = reg.RLC(0);
        UnitTest.report("(11)RLC r == 0x00", r == 0x00);
        UnitTest.report("(12)RLC S == false", reg.flagS() == false);
        UnitTest.report("(13)RLC Z == true", reg.flagZ() == true);
        UnitTest.report("(14)RLC Cy == false", reg.flagC() == false);
        UnitTest.report("(15)RLC P/V == false", reg.flagP() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.A = 0x40;
        reg.clearFlagC();
        var r = reg.RL(0x40);
        UnitTest.report("(1)RL r == 0x80", r == 0x80);
        UnitTest.report("(2)RL S == true", reg.flagS() == true);
        UnitTest.report("(3)RL Z == false", reg.flagZ() == false);
        UnitTest.report("(4)RL Cy == false", reg.flagZ() == false);
        UnitTest.report("(5)RL P/V == false", reg.flagP() == false);
        reg.clearFlagC();
        r = reg.RL(r);
        UnitTest.report("(6)RL r == 0x00", r == 0x00);
        UnitTest.report("(7)RL S == false", reg.flagS() == false);
        UnitTest.report("(8)RL Z == true", reg.flagZ() == true);
        UnitTest.report("(9)RL Cy == true", reg.flagC() == true);
        UnitTest.report("(10)RL P/V == true", reg.flagP() == true);
        reg.setFlagC();
        r = reg.RL(0);
        UnitTest.report("(11)RL r == 0x01", r == 0x01);
        UnitTest.report("(12)RL S == false", reg.flagS() == false);
        UnitTest.report("(13)RL Z == false", reg.flagZ() == false);
        UnitTest.report("(14)RL Cy == false", reg.flagC() == false);
        UnitTest.report("(15)RL P/V == false", reg.flagP() == false);
    }
];
module.exports = {
    name: "Z80 Register",
    test: function() {
        for(var i = 0; i < tests.length; i++) {
            tests[i]();
        }
    }
};
