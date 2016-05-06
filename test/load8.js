var UnitTest = require("./UnitTest");
var fs = require('fs');
eval(fs.readFileSync('Z80Tester.js')+'');

var tester = new Z80Tester();
var cpu = new Z80();
var tests = [
    function() {
        ["IX","IY"].forEach(function(IDX) {
            ["B","C","D","E","H","L","A"].forEach(function(r) {
                [0,1,254,255].forEach(function(d) {
                    cpu.memory.poke(0x1200 + d, (0xff & (~d)));
                    cpu.reg[r] = d;
                    cpu.reg[IDX] = 0x1200;
                    var mne = "LD (" + IDX + "+" + d +")," + r;
                    tester.runMnemonics(cpu, [mne]);
                    UnitTest.report(
                            mne + " - 1. mem " + (0x1200+d).HEX(4) + "H must be " + d,
                            cpu.memory.peek(0x1200 + d) == d,
                            d.HEX(2) + "H");
                    UnitTest.report(
                            mne + " - 2. " + IDX + " is not changed",
                            cpu.reg[IDX] == 0x1200,
                            "changed to " + cpu.reg[IDX].HEX(4) + "H");
                    UnitTest.report(
                            mne + " - 3 " + r + " is not changed",
                            cpu.reg[r] == d,
                            "changed to " + cpu.reg[r].HEX(2) + "H");
                });
            });
        });
    },
    function() {
        ["IX","IY"].forEach(function(IDX) {
            ["B","C","D","E","H","L","A"].forEach(function(r) {
                [0,1,254,255].forEach(function(d) {
                    cpu.reg[r] = (0xff & (~d));
                    cpu.memory.poke(0x1200 + d, d);
                    cpu.reg[IDX] = 0x1200;
                    var mne = "LD "+ r + ",(" + IDX + "+" + d +")";
                    tester.runMnemonics(cpu, [mne]);
                    UnitTest.report(
                            mne + " - 1. reg "+ r + " must be " + d,
                            cpu.reg[r] == d,
                            cpu.reg[r].HEX(2) + "H");
                    UnitTest.report(
                            mne + " - 2. " + IDX + " is not changed",
                            cpu.reg[IDX] == 0x1200,
                            "changed to " + cpu.reg[IDX].HEX(4) + "H");
                    UnitTest.report(
                            mne + " - 3. mem " + (0x1200+d).HEX(4)
                            + "H is not changed " + d,
                            cpu.memory.peek(0x1200 + d) == d,
                            "changed to " + cpu.memory.peek(0x1200 + d).HEX(4) + "H");
                });
            });
        });
    },
    function() {
        ["IX","IY"].forEach(function(IDX) {
            [0,1,254,255].forEach(function(d) {
                [0,1,254,255].forEach(function(n) {
                    cpu.memory.poke(0x1200 + d, (0xff & (~d)));
                    cpu.reg[IDX] = 0x1200;
                    var mne = "LD (" + IDX + "+" + d +")," + n.HEX(2) + "H";
                    tester.runMnemonics(cpu, [mne]);
                    UnitTest.report(
                            mne + " - 1. mem " + (0x1200+d).HEX(4) + "H must be " + d,
                            cpu.memory.peek(0x1200 + d) == n,
                            d.HEX(2) + "H");
                    UnitTest.report(
                            mne + " - 2. " + IDX + " is not changed",
                            cpu.reg[IDX] == 0x1200,
                            "changed to " + cpu.reg[IDX].HEX(4) + "H");
                });
            });
        });
    }
];
var test_set = [
    { name: "LD B,255", test: function() { cpu.reg.B = 0; tester.runMnemonics(cpu, ["LD B,255"]); return cpu.reg.B == 255; }},
    { name: "LD C,255", test: function() { cpu.reg.C = 0; tester.runMnemonics(cpu, ["LD C,255"]); return cpu.reg.C == 255; }},
    { name: "LD D,255", test: function() { cpu.reg.D = 0; tester.runMnemonics(cpu, ["LD D,255"]); return cpu.reg.D == 255; }},
    { name: "LD E,255", test: function() { cpu.reg.E = 0; tester.runMnemonics(cpu, ["LD E,255"]); return cpu.reg.E == 255; }},
    { name: "LD H,255", test: function() { cpu.reg.H = 0; tester.runMnemonics(cpu, ["LD H,255"]); return cpu.reg.H == 255; }},
    { name: "LD L,255", test: function() { cpu.reg.L = 0; tester.runMnemonics(cpu, ["LD L,255"]); return cpu.reg.L == 255; }},
    { name: "LD A,255", test: function() { cpu.reg.A = 0; tester.runMnemonics(cpu, ["LD A,255"]); return cpu.reg.A == 255; }},

    { name: "LD B,(HL)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.B = 0;
        tester.runMnemonics(cpu, ["LD B,(HL)"]);
        return cpu.reg.B == 255;
    }},
    { name: "LD C,(HL)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.C = 0;
        tester.runMnemonics(cpu, ["LD C,(HL)"]);
        return cpu.reg.C == 255;
    }},
    { name: "LD D,(HL)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.D = 0;
        tester.runMnemonics(cpu, ["LD D,(HL)"]);
        return cpu.reg.D == 255;
    }},
    { name: "LD E,(HL)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.E = 0;
        tester.runMnemonics(cpu, ["LD E,(HL)"]);
        return cpu.reg.E == 255;
    }},
    { name: "LD H,(HL)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        tester.runMnemonics(cpu, ["LD H,(HL)"]);
        return cpu.reg.H == 255;
    }},
    { name: "LD L,(HL)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        tester.runMnemonics(cpu, ["LD L,(HL)"]);
        return cpu.reg.L == 255;
    }},
    { name: "LD A,(HL)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.A = 0;
        tester.runMnemonics(cpu, ["LD A,(HL)"]);
        return cpu.reg.A == 255;
    }},

    { name: "LD (HL),B", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.B = 128;
        tester.runMnemonics(cpu, ["LD (HL),B"]);
        return cpu.memory.peek(0x1234) == 128;
    }},
    { name: "LD (HL),C", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.C = 128;
        tester.runMnemonics(cpu, ["LD (HL),C"]);
        return cpu.memory.peek(0x1234) == 128;
    }},
    { name: "LD (HL),D", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.D = 128;
        tester.runMnemonics(cpu, ["LD (HL),D"]);
        return cpu.memory.peek(0x1234) == 128;
    }},
    { name: "LD (HL),E", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.E = 128;
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
        cpu.reg.A = 128;
        tester.runMnemonics(cpu, ["LD (HL),A"]);
        return cpu.memory.peek(0x1234) == 128;
    }},
    { name: "LD (BC),A", test: function() {
        cpu.reg.setBC(0x1234);
        cpu.reg.setHL(0);
        cpu.reg.setDE(0);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.A = 128;
        tester.runMnemonics(cpu, ["LD (BC),A"]);
        return cpu.memory.peek(0x1234) == 128;
    }},
    { name: "LD (DE),A", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0x1234);
        cpu.reg.setHL(0);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.A = 128;
        tester.runMnemonics(cpu, ["LD (DE),A"]);
        return cpu.memory.peek(0x1234) == 128;
    }},
    { name: "LD A,(BC)", test: function() {
        cpu.reg.setBC(0x1234);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.A = 0;
        tester.runMnemonics(cpu, ["LD A,(BC)"]);
        return cpu.reg.A == 255;
    }},
    { name: "LD A,(DE)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0x1234);
        cpu.reg.setHL(0);
        cpu.memory.poke(0x1234, 255);
        cpu.reg.A = 0;
        tester.runMnemonics(cpu, ["LD A,(DE)"]);
        return cpu.reg.A == 255;
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
        cpu.reg.A = 0;
        tester.runMnemonics(cpu, ["LD A,(1234H)"]);
        return cpu.reg.A == 128;
    }},
    { name: "LD (nn),A", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.memory.poke(0x1234, 128);
        cpu.reg.A = 0;
        tester.runMnemonics(cpu, ["LD (1234h),A"]);
        return cpu.memory.peek(0x1234) == 0;
    }},
];
module.exports = {
    name: "8 bit load group",
    test: function() {
        for(var i = 0; i < tests.length; i++) {
            tests[i]();
        }
    },
    test_set: test_set
};
