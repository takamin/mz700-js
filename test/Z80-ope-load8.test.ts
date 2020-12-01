describe("load 8 bit", ()=>{
    const UnitTest = require("./lib/UnitTest");
    const Z80Tester = require('./lib/Z80Tester');
    const Z80 = require('../Z80/Z80');
    const NumberUtil = require("../lib/number-util");

    const tester = new Z80Tester();
    const cpu = new Z80();
    const tests = [
        function() {
            ["IX","IY"].forEach(function(IDX) {
                ["B","C","D","E","H","L","A"].forEach(function(r) {
                    [0,1,127,-128].forEach(function(d) {
                        const d_u8 = NumberUtil.to8bitUnsigned(d);
                        const notD = (0xff & ~d_u8);
                        cpu.memory.poke(0x1200 + d, notD );
                        cpu.reg["set" + r]( d_u8 );
                        cpu.reg[IDX] = 0x1200;
                        var mne = "LD (" + IDX + (d >= 0 ? "+" : "") + d +")," + r;
                        tester.runMnemonics(cpu, [mne]);
                        if(cpu.memory.peek(0x1200 + d) != d_u8) {
                            console.error(`***** ASSEMBLING TEST FAILS on mnemonic ${mne}`);
                            console.error(`d:${d}`);
                            console.error(`d_u8:${d_u8}`);
                            console.error(`notD:${notD}`);
                            console.error(`cpu.memory.peek(0x1200 + ${d}):${cpu.memory.peek(0x1200 + d)}`);
                        }
                        UnitTest.report(
                                mne + " - 1. mem " + NumberUtil.HEX(0x1200+d, 4) + "H must be " + d_u8,
                                cpu.memory.peek(0x1200 + d) == d_u8,
                                NumberUtil.HEX(d_u8, 2) + "H");
                        UnitTest.report(
                                mne + " - 2. " + IDX + " is not changed",
                                cpu.reg[IDX] == 0x1200,
                                "changed to " + NumberUtil.HEX(cpu.reg[IDX], 4) + "H");
                        UnitTest.report(
                                mne + " - 3 " + r + " is not changed",
                                cpu.reg["get" + r]() == d_u8,
                                "changed to " + NumberUtil.HEX(cpu.reg["get"+r](), 2) + "H");
                    });
                });
            });
        },
        function() {
            ["IX","IY"].forEach(function(IDX) {
                ["B","C","D","E","H","L","A"].forEach(function(r) {
                    [0,1,127,-128].forEach(function(d) {
                        cpu.reg["set" + r]( 0xff & ~NumberUtil.to8bitUnsigned(d) );
                        cpu.memory.poke(0x1200 + d, NumberUtil.to8bitUnsigned(d));
                        cpu.reg[IDX] = 0x1200;
                        var mne = "LD "+ r + ",(" + IDX + (d >= 0 ? "+" : "") + d +")";
                        tester.runMnemonics(cpu, [mne]);
                        UnitTest.report(
                                mne + " - 1. reg "+ r + " must be " + d,
                                cpu.reg["get"+r]() == NumberUtil.to8bitUnsigned(d),
                                NumberUtil.HEX(cpu.reg["get"+r](), 2) + "H");
                        UnitTest.report(
                                mne + " - 2. " + IDX + " is not changed",
                                cpu.reg[IDX] == 0x1200,
                                "changed to " + NumberUtil.HEX(cpu.reg[IDX], 4) + "H");
                        UnitTest.report(
                                mne + " - 3. mem " + NumberUtil.HEX(0x1200+d, 4)
                                + "H is not changed " + (0xff & d),
                                cpu.memory.peek(0x1200 + d) == NumberUtil.to8bitUnsigned(d),
                                "changed to " + NumberUtil.HEX(cpu.memory.peek(0x1200+d), 4) + "H");
                    });
                });
            });
        },
        function() {
            ["IX","IY"].forEach(function(IDX) {
                [0,1,127,-128].forEach(function(d) {
                    [0,1,254,255].forEach(function(n) {
                        cpu.memory.poke(0x1200 + d, 0xff & ~n);
                        cpu.reg[IDX] = 0x1200;
                        var mne = "LD (" + IDX + (d >= 0 ? "+" : "") + d +")," + NumberUtil.HEX(n, 2) + "H";
                        tester.runMnemonics(cpu, [mne]);
                        UnitTest.report(
                                mne + " - 1. mem " + NumberUtil.HEX(0x1200+d, 4) + "H must be " + NumberUtil.HEX(n, 2),
                                cpu.memory.peek(0x1200 + d) == n,
                                NumberUtil.HEX(cpu.memory.peek(0x1200 + d), 2)  + "H");
                        UnitTest.report(
                                mne + " - 2. " + IDX + " is not changed",
                                cpu.reg[IDX] == 0x1200,
                                "changed to " + NumberUtil.HEX(cpu.reg[IDX], 4) + "H");
                    });
                });
            });
        }
    ];
    var test_set = [
        { name: "LD B,255", test: function() { cpu.reg.setB( 0 ); tester.runMnemonics(cpu, ["LD B,255"]); return cpu.reg.getB() == 255; }},
        { name: "LD C,255", test: function() { cpu.reg.setC( 0 ); tester.runMnemonics(cpu, ["LD C,255"]); return cpu.reg.getC() == 255; }},
        { name: "LD D,255", test: function() { cpu.reg.setD( 0 ); tester.runMnemonics(cpu, ["LD D,255"]); return cpu.reg.getD() == 255; }},
        { name: "LD E,255", test: function() { cpu.reg.setE( 0 ); tester.runMnemonics(cpu, ["LD E,255"]); return cpu.reg.getE() == 255; }},
        { name: "LD H,255", test: function() { cpu.reg.setH( 0 ); tester.runMnemonics(cpu, ["LD H,255"]); return cpu.reg.getH() == 255; }},
        { name: "LD L,255", test: function() { cpu.reg.setL( 0 ); tester.runMnemonics(cpu, ["LD L,255"]); return cpu.reg.getL() == 255; }},
        { name: "LD A,255", test: function() { cpu.reg.setA( 0 ); tester.runMnemonics(cpu, ["LD A,255"]); return cpu.reg.getA() == 255; }},

        { name: "LD B,(HL)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setB( 0 );
            tester.runMnemonics(cpu, ["LD B,(HL)"]);
            return cpu.reg.getB() == 255;
        }},
        { name: "LD C,(HL)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setC( 0 );
            tester.runMnemonics(cpu, ["LD C,(HL)"]);
            return cpu.reg.getC() == 255;
        }},
        { name: "LD D,(HL)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setD( 0 );
            tester.runMnemonics(cpu, ["LD D,(HL)"]);
            return cpu.reg.getD() == 255;
        }},
        { name: "LD E,(HL)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setE( 0 );
            tester.runMnemonics(cpu, ["LD E,(HL)"]);
            return cpu.reg.getE() == 255;
        }},
        { name: "LD H,(HL)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            tester.runMnemonics(cpu, ["LD H,(HL)"]);
            return cpu.reg.getH() == 255;
        }},
        { name: "LD L,(HL)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            tester.runMnemonics(cpu, ["LD L,(HL)"]);
            return cpu.reg.getL() == 255;
        }},
        { name: "LD A,(HL)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setA( 0 );
            tester.runMnemonics(cpu, ["LD A,(HL)"]);
            return cpu.reg.getA() == 255;
        }},

        { name: "LD (HL),B", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setB( 128 );
            tester.runMnemonics(cpu, ["LD (HL),B"]);
            return cpu.memory.peek(0x1234) == 128;
        }},
        { name: "LD (HL),C", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setC( 128 );
            tester.runMnemonics(cpu, ["LD (HL),C"]);
            return cpu.memory.peek(0x1234) == 128;
        }},
        { name: "LD (HL),D", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setD( 128 );
            tester.runMnemonics(cpu, ["LD (HL),D"]);
            return cpu.memory.peek(0x1234) == 128;
        }},
        { name: "LD (HL),E", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setE( 128 );
            tester.runMnemonics(cpu, ["LD (HL),E"]);
            return cpu.memory.peek(0x1234) == 128;
        }},
        { name: "LD (HL),H", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            tester.runMnemonics(cpu, ["LD (HL),H"]);
            return cpu.memory.peek(0x1234) == 0x12;
        }},
        { name: "LD (HL),L", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            tester.runMnemonics(cpu, ["LD (HL),L"]);
            return cpu.memory.peek(0x1234) == 0x34;
        }},
        { name: "LD (HL),A", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setA( 128 );
            tester.runMnemonics(cpu, ["LD (HL),A"]);
            return cpu.memory.peek(0x1234) == 128;
        }},
        { name: "LD (BC),A", test: function() {
            cpu.reg.setBC(0x1234);
            cpu.reg.setHL(0);
            cpu.reg.setDE(0);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setA( 128 );
            tester.runMnemonics(cpu, ["LD (BC),A"]);
            return cpu.memory.peek(0x1234) == 128;
        }},
        { name: "LD (DE),A", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0x1234);
            cpu.reg.setHL(0);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setA( 128 );
            tester.runMnemonics(cpu, ["LD (DE),A"]);
            return cpu.memory.peek(0x1234) == 128;
        }},
        { name: "LD A,(BC)", test: function() {
            cpu.reg.setBC(0x1234);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setA( 0 );
            tester.runMnemonics(cpu, ["LD A,(BC)"]);
            return cpu.reg.getA() == 255;
        }},
        { name: "LD A,(DE)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0x1234);
            cpu.reg.setHL(0);
            cpu.memory.poke(0x1234, 255);
            cpu.reg.setA( 0 );
            tester.runMnemonics(cpu, ["LD A,(DE)"]);
            return cpu.reg.getA() == 255;
        }},
        { name: "LD (HL),nn", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0x1234);
            cpu.memory.poke(0x1234, 128);
            tester.runMnemonics(cpu, ["LD (HL),FFh"]);
            return cpu.memory.peek(0x1234) == 0xff;
        }},
        { name: "LD A,(nn)", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0);
            cpu.memory.poke(0x1234, 128);
            cpu.reg.setA( 0 );
            tester.runMnemonics(cpu, ["LD A,(1234H)"]);
            return cpu.reg.getA() == 128;
        }},
        { name: "LD (nn),A", test: function() {
            cpu.reg.setBC(0);
            cpu.reg.setDE(0);
            cpu.reg.setHL(0);
            cpu.memory.poke(0x1234, 128);
            cpu.reg.setA( 0 );
            tester.runMnemonics(cpu, ["LD (1234h),A"]);
            return cpu.memory.peek(0x1234) == 0;
        }},
    ];
    UnitTest.test({
        name: "8 bit load group",
        test: function() {
            for(var i = 0; i < tests.length; i++) {
                tests[i]();
            }
        },
        test_set: test_set
    });
    const chai = require("chai");
    const assert = chai.assert;
    describe("load inter 8 bit register", function() {
        var reg8 = "ABCDEHL".split('');
        reg8.forEach(function(dst) {
            reg8.forEach(function(src) {
                if(src != dst) {
                    describe("LD " + dst + "," + src, function() {
                        it("should assign 0", function() {
                            cpu.reg["set" + src](0);
                            cpu.reg["set" + dst](1);
                            tester.runMnemonics(cpu, [
                                    "LD " + dst + "," + src
                            ]);
                            assert.equal(0, cpu.reg["get" + dst]());
                        });
                        it("should assign 255", function() {
                            cpu.reg["set" + src](255);
                            cpu.reg["set" + dst](1);
                            tester.runMnemonics(cpu, [
                                    "LD " + dst + "," + src
                            ]);
                            assert.equal(255, cpu.reg["get" + dst]());
                        });
                    });
                }
            });
        });
        reg8.forEach(function(dst) {
            var src = dst;
            describe("LD " + dst + "," + src, function() {
                it("should not change from 0", function() {
                    cpu.reg["set" + src](0);
                    tester.runMnemonics(cpu, [
                            "LD " + dst + "," + src
                    ]);
                    assert.equal(0, cpu.reg["get" + dst]());
                });
                it("should not change from 255", function() {
                    cpu.reg["set" + src](255);
                    tester.runMnemonics(cpu, [
                            "LD " + dst + "," + src
                    ]);
                    assert.equal(255, cpu.reg["get" + dst]());
                });
            });
        });
    });
});