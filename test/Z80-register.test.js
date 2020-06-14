var UnitTest = require("./lib/UnitTest.js");
var Z80_Register = require('../Z80/register.js');
var tests = [
    function () {
        var reg = new Z80_Register();
        UnitTest.report("initial value of B", reg.getB() == 0);
        UnitTest.report("initial value of C", reg.getC() == 0);
        UnitTest.report("initial value of D", reg.getD() == 0);
        UnitTest.report("initial value of E", reg.getE() == 0);
        UnitTest.report("initial value of H", reg.getH() == 0);
        UnitTest.report("initial value of L", reg.getL() == 0);
        UnitTest.report("initial value of A", reg.getA() == 0);
        UnitTest.report("initial value of F", reg.getF() == 0);
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
        reg.setB(0x55 + i++);
        reg.setC(0x55 + i++);
        reg.setD(0x55 + i++);
        reg.setE(0x55 + i++);
        reg.setH(0x55 + i++);
        reg.setL(0x55 + i++);
        reg.setA(0x55 + i++);
        reg.setF(0x55 + i++);
        reg.PC = 0x55 + i++;
        reg.SP = 0x55 + i++;
        reg.IX = 0x55 + i++;
        reg.IY = 0x55 + i++;
        reg.R = 0x55 + i++;
        reg.I = 0x55 + i++;
        var reg2 = new Z80_Register();
        reg2.setFrom(reg);
        i = 0;
        UnitTest.report("set value of B", reg2.getB() == 0x55 + i++);
        UnitTest.report("set value of C", reg2.getC() == 0x55 + i++);
        UnitTest.report("set value of D", reg2.getD() == 0x55 + i++);
        UnitTest.report("set value of E", reg2.getE() == 0x55 + i++);
        UnitTest.report("set value of H", reg2.getH() == 0x55 + i++);
        UnitTest.report("set value of L", reg2.getL() == 0x55 + i++);
        UnitTest.report("set value of A", reg2.getA() == 0x55 + i++);
        UnitTest.report("set value of F", reg2.getF() == 0x55 + i++);
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
        reg.setB(0x55 + i++);
        reg.setC(0x55 + i++);
        reg.setD(0x55 + i++);
        reg.setE(0x55 + i++);
        reg.setH(0x55 + i++);
        reg.setL(0x55 + i++);
        reg.setA(0x55 + i++);
        reg.setF(0x55 + i++);
        reg.PC = 0x55 + i++;
        reg.SP = 0x55 + i++;
        reg.IX = 0x55 + i++;
        reg.IY = 0x55 + i++;
        reg.R = 0x55 + i++;
        reg.I = 0x55 + i++;
        reg.clear();
        UnitTest.report("cleared value of B", reg.getB() == 0);
        UnitTest.report("cleared value of C", reg.getC() == 0);
        UnitTest.report("cleared value of D", reg.getD() == 0);
        UnitTest.report("cleared value of E", reg.getE() == 0);
        UnitTest.report("cleared value of H", reg.getH() == 0);
        UnitTest.report("cleared value of L", reg.getL() == 0);
        UnitTest.report("cleared value of A", reg.getA() == 0);
        UnitTest.report("cleared value of F", reg.getF() == 0);
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
        reg.setA( 0 );
        reg.NEG();
        UnitTest.report("NEG 0 A", reg.getA() == 0x00);
        UnitTest.report("NEG 0 flagZ", reg.flagZ() == true);
        UnitTest.report("NEG 0 flagS", reg.flagS() == false);
        UnitTest.report("NEG 0 flagC", reg.flagC() == false);
        
        reg.setA( 1 );
        reg.NEG();
        UnitTest.report("NEG 1 A", reg.getA() == 0xff);
        UnitTest.report("NEG 1 flagZ", reg.flagZ() == false);
        UnitTest.report("NEG 1 flagS", reg.flagS() == true);
        UnitTest.report("NEG 1 flagC", reg.flagC() == true);

        reg.setA( 0xff );
        reg.NEG();
        UnitTest.report("NEG 0xff A", reg.getA() == 0x01);
        UnitTest.report("NEG 0xff flagZ", reg.flagZ() == false);
        UnitTest.report("NEG 0xff flagS", reg.flagS() == false);
        UnitTest.report("NEG 0xff flagC", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.clear();
        reg.setA( 0 );
        reg.addAcc(0);
        UnitTest.report("addAcc 0+0 A", reg.getA() == 0x00);
        UnitTest.report("addAcc 0+0 flagZ", reg.flagZ() == true);
        UnitTest.report("addAcc 0+0 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 0+0 flagC", reg.flagC() == false);
        
        reg.setA( 0 );
        reg.addAcc(1);
        UnitTest.report("addAcc 0+1 A", reg.getA() == 0x01);
        UnitTest.report("addAcc 0+1 flagZ", reg.flagZ() == false);
        UnitTest.report("addAcc 0+1 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 0+1 flagC", reg.flagC() == false);

        reg.setA( 126 );
        reg.addAcc(1);
        UnitTest.report("addAcc 126+1 A", reg.getA() == 127);
        UnitTest.report("addAcc 0+1 flagZ", reg.flagZ() == false);
        UnitTest.report("addAcc 0+1 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 0+1 flagC", reg.flagC() == false);

        reg.setA( 126 );
        reg.addAcc(2);
        UnitTest.report("addAcc 126+2 A", reg.getA() == 128);
        UnitTest.report("addAcc 126+2 flagZ", reg.flagZ() == false);
        UnitTest.report("addAcc 126+2 flagS", reg.flagS() == true);
        UnitTest.report("addAcc 126+2 flagC", reg.flagC() == false);

        reg.setA( 126 );
        reg.addAcc(130);
        UnitTest.report("addAcc 126+130 A", reg.getA() == 0);
        UnitTest.report("addAcc 126+130 flagZ", reg.flagZ() == true);
        UnitTest.report("addAcc 126+130 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 126+130 flagC", reg.flagC() == true);

        reg.setA( 126 );
        reg.addAcc(131);
        UnitTest.report("addAcc 126+131 A", reg.getA() == 1);
        UnitTest.report("addAcc 126+131 flagZ", reg.flagZ() == false);
        UnitTest.report("addAcc 126+131 flagS", reg.flagS() == false);
        UnitTest.report("addAcc 126+131 flagC", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.setA( 0x40 );
        reg.RLCA();
        UnitTest.report("RLCA A == 0x80", reg.getA() == 0x80);
        UnitTest.report("RLCA Cy == false", reg.flagC() == false);
        reg.RLCA();
        UnitTest.report("RLCA A == 0x01", reg.getA() == 0x01);
        UnitTest.report("RLCA Cy == true", reg.flagC() == true);
    },
    function() {
        var reg = new Z80_Register();
        reg.setA( 0x40 );
        reg.clearFlagC();
        reg.RRCA();
        UnitTest.report("(1)RRCA A == 0x20", reg.getA() == 0x20);
        UnitTest.report("(2)RRCA Cy == false", reg.flagC() == false);
        reg.setA( 0x20 );
        reg.setFlagC();
        reg.RRCA();
        UnitTest.report("(3)RRCA A == 0x10", reg.getA() == 0x10);
        UnitTest.report("(4)RRCA Cy == false", reg.flagC() == false);
        reg.setA( 0x01 );
        reg.setFlagC();
        reg.RRCA();
        UnitTest.report("(5)RRCA A == 0x80", reg.getA() == 0x80);
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
        reg.setA( 0x40 );
        reg.clearFlagC();
        reg.RRA();
        UnitTest.report("(1)RRA A == 0x20", reg.getA() == 0x20);
        UnitTest.report("(2)RRA Cy == false", reg.flagC() == false);
        reg.setA( 0x20 );
        reg.setFlagC();
        reg.RRA();
        UnitTest.report("(3)RRA A == 0x90", reg.getA() == 0x90);
        UnitTest.report("(4)RRA Cy == false", reg.flagC() == false);
        reg.setA( 0x21 );
        reg.setFlagC();
        reg.RRA();
        UnitTest.report("(5)RRA A == 0x90", reg.getA() == 0x90);
        UnitTest.report("(6)RRA Cy == true", reg.flagC() == true);
        reg.setA( 0x01 );
        reg.clearFlagC();
        reg.setFlagZ();
        reg.RRA();
        UnitTest.report("(7)RRA A == 0x00", reg.getA() == 0x00);
        UnitTest.report("(8)RRA Z == true", reg.flagZ() == true);
        UnitTest.report("(9)RRA Cy == true", reg.flagC() == true);
        reg.setA( 0x01 );
        reg.setFlagC();
        reg.clearFlagZ();
        reg.RRA();
        UnitTest.report("(10)RRA A == 0x80", reg.getA() == 0x80);
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
        reg.setA( 0x40 );
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
        reg.setA( 0x40 );
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
UnitTest.test({
    name: "Z80_Register",
    test: function() {
        for(var i = 0; i < tests.length; i++) {
            tests[i]();
        }
    }
});
const chai = require("chai");
const assert = chai.assert;
describe("Z80_Register", function() {
    describe("8 bit register", function() {
        var reg8 = "ABCDEFHL".split('');
        var reg = new Z80_Register();
        reg8.forEach(function(r) {
            describe(r, function() {
                it("should be 1 by setting 1", function() {
                    reg["set" + r](1);
                    assert.equal(1, reg["get" + r]());
                });
                it("should be 255 by setting 255", function() {
                    reg["set" + r](255);
                    assert.equal(255, reg["get" + r]());
                });
                it("should be 0 by setting 0", function() {
                    reg["set" + r](0);
                    assert.equal(0, reg["get" + r]());
                });
                it("should be 255 by setting -1", function() {
                    reg["set" + r](-1);
                    assert.equal(255, reg["get" + r]());
                });
                it("should be 0 by setting 256", function() {
                    reg["set" + r](256);
                    assert.equal(0, reg["get" + r]());
                });
            });
            describe("increment " + r, function() {
                it("should set 1 when it was 0", function() {
                    reg["set" + r](0);
                    reg.increment(r);
                    assert.equal(1, reg["get" + r]());
                });
                it("should plus 128 value when it was 127", function() {
                    reg["set" + r](127);
                    reg.increment(r);
                    assert.equal(128, reg["get" + r]());
                });
                it("should plus 0 value when it was 255", function() {
                    reg["set" + r](255);
                    reg.increment(r);
                    assert.equal(0, reg["get" + r]());
                });
            });
            describe("decrement " + r, function() {
                it("should set 0 when it was 1", function() {
                    reg["set" + r](1);
                    reg.decrement(r);
                    assert.equal(0, reg["get" + r]());
                });
                it("should plus 128 value when it was 127", function() {
                    reg["set" + r](128);
                    reg.decrement(r);
                    assert.equal(127, reg["get" + r]());
                });
                it("should plus 0 value when it was 255", function() {
                    reg["set" + r](0);
                    reg.decrement(r);
                    assert.equal(255, reg["get" + r]());
                });
            });
        });
        reg8.forEach(function(current) {
            describe(current + " register", function() {
                describe("should not be affected", function() {
                    reg8.forEach(function(other) {
                        if(other !== current) {
                            it("by " + other + " register", function() {
                                reg["set" + current](123);
                                reg["set" + other](246);
                                assert.equal(123, reg["get" + current]());
                            });
                        }
                    });
                });
            });
        });
    });
    describe("flags", function() {
        var reg = new Z80_Register();
        var flags = "SZHPNC".split('');
        flags.forEach(function(current) {
            describe(current + " flag", function() {
                it("should be set", function() {
                    reg["setFlag" + current]();
                    assert.equal(true, reg["flag" + current]());
                });
                it("should be cleared", function() {
                    reg["clearFlag" + current]();
                    assert.equal(false, reg["flag" + current]());
                });
            });
        });
        flags.forEach(function(current) {
            describe(current + " flag", function() {
                describe("should not be cleared", function() {
                    flags.forEach(function(other) {
                        if(other !== current) {
                            it("by " + other + " flag", function() {
                                reg["setFlag" + current]();
                                reg["clearFlag" + other]();
                                assert.equal(true, reg["flag" + current]());
                            });
                        }
                    });
                });
                describe("should not be set", function() {
                    flags.forEach(function(other) {
                        if(other !== current) {
                            it("by " + other + " flag", function() {
                                reg["clearFlag" + current]();
                                reg["setFlag" + other]();
                                assert.equal(false, reg["flag" + current]());
                            });
                        }
                    });
                });
            });
        });
        describe("pair register", function() {
            var reg = new Z80_Register();
            ["BC","DE","HL","AF"].forEach(function(rr) {
                describe(rr, function() {
                    it("should be 1 by setting 1", function() {
                        reg["set" + rr](1);
                        assert.equal(1, reg["get" + rr]());
                    });
                    it("should be 65535 by setting 65535", function() {
                        reg["set" + rr](65535);
                        assert.equal(65535, reg["get" + rr]());
                    });
                    it("should be 0 by setting 0", function() {
                        reg["set" + rr](0);
                        assert.equal(0, reg["get" + rr]());
                    });
                    it("should be 255 by setting -1", function() {
                        reg["set" + rr](-1);
                        assert.equal(65535, reg["get" + rr]());
                    });
                    it("should be 0 by setting 65536", function() {
                        reg["set" + rr](65536);
                        assert.equal(0, reg["get" + rr]());
                    });
                    var rh = rr.split('')[0];
                    var rl = rr.split('')[1];
                    it("should be integrated by " + rh + " and " + rl, function() {
                        reg["set" + rh](0x12);
                        reg["set" + rl](0x34);
                        assert.equal(0x1234, reg["get" + rr]());
                    });
                    it("should be duplicated to " + rh + " and " + rl, function() {
                        reg["set" + rr](0x1234);
                        assert.equal(0x12, reg["get" + rh]());
                        assert.equal(0x34, reg["get" + rl]());
                    });
                });
            });
        });
    });
    describe("cloneRaw", function() {
        it("should be cloned", function() {
            var reg = new Z80_Register();
            reg.setA(1);
            reg.setB(2);
            reg.setC(3);
            reg.setD(4);
            reg.setE(5);
            reg.setF(6);
            reg.setH(7);
            reg.setL(8);
            reg.PC = 9;
            reg.SP = 10;
            reg.IX = 11;
            reg.IY = 12;
            reg.R = 13;
            reg.I = 14;
            assert.deepEqual({
                A:1,B:2,C:3,D:4,E:5,F:6,H:7,L:8,
                PC:9,SP:10,IX:11,IY:12,R:13,I:14},
                reg.cloneRaw());
        });
    });
});
