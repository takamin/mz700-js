var UnitTest = require("./lib/UnitTest.js");
var Z80Tester = require('./lib/Z80Tester.js');
var Z80 = require('../Z80/Z80.js');
var cpu = new Z80();

var tester = new Z80Tester();
function report(cpu, name, result) {
    if(result === true) {
        UnitTest.report(name, true);
    } else {
        UnitTest.report(name, false);
    }
}
var test_set = [
    { name: "LD HL,(1234h)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.reg.A = 0;
        cpu.reg.F = 0;
        cpu.reg.SP = 0xfffe;
        cpu.reg.IX = 0;
        cpu.reg.IY = 0;
        cpu.memory.poke(0x1234, 0xCD);
        cpu.memory.poke(0x1235, 0xAB);
        tester.runMnemonics(cpu, ["LD HL,(1234h)"]);
        report(cpu, "LD HL,1234h (1)", cpu.reg.getBC() == 0);
        report(cpu, "LD HL,1234h (2)", cpu.reg.getDE() == 0);
        report(cpu, "LD HL,1234h (3)", cpu.reg.getHL() == 0xABCD);
        report(cpu, "LD HL,1234h (4)", cpu.reg.A == 0);
        report(cpu, "LD HL,1234h (5)", cpu.reg.F == 0);
        report(cpu, "LD HL,1234h (6)", cpu.reg.SP == 0xfffe);
        report(cpu, "LD HL,1234h (7)", cpu.reg.IX == 0);
        report(cpu, "LD HL,1234h (8)", cpu.reg.IY == 0);
    }},
    { name: "LD (1234h),HL", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0x1234);
        cpu.reg.A = 0;
        cpu.reg.F = 0;
        cpu.reg.SP = 0xfffe;
        cpu.reg.IX = 0;
        cpu.reg.IY = 0;
        cpu.memory.poke(0x1234, 0xCD);
        cpu.memory.poke(0x1235, 0xAB);
        tester.runMnemonics(cpu, ["LD (1234h),HL"]);
        report(cpu, "LD HL,1234h (1)", cpu.reg.getBC() == 0);
        report(cpu, "LD HL,1234h (2)", cpu.reg.getDE() == 0);
        report(cpu, "LD HL,1234h (3)", cpu.reg.getHL() == 0x1234);
        report(cpu, "LD HL,1234h (4)", cpu.reg.A == 0);
        report(cpu, "LD HL,1234h (5)", cpu.reg.F == 0);
        report(cpu, "LD HL,1234h (6)", cpu.reg.SP == 0xfffe);
        report(cpu, "LD HL,1234h (7)", cpu.reg.IX == 0);
        report(cpu, "LD HL,1234h (8)", cpu.reg.IY == 0);
        report(cpu, "LD HL,1234h (9)", cpu.memory.peek(0x1234) == 0x34);
        report(cpu, "LD HL,1234h (10)", cpu.memory.peek(0x1235) == 0x12);
    }},
    { name: "LD BC,1234h", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.reg.A = 0;
        cpu.reg.F = 0;
        cpu.reg.SP = 0xfffe;
        cpu.reg.IX = 0;
        cpu.reg.IY = 0;
        tester.runMnemonics(cpu, ["LD BC,1234h"]);
        report(cpu, "LD BC,1234h (1)", cpu.reg.getBC() == 0x1234);
        report(cpu, "LD BC,1234h (2)", cpu.reg.getDE() == 0);
        report(cpu, "LD BC,1234h (3)", cpu.reg.getHL() == 0);
        report(cpu, "LD BC,1234h (4)", cpu.reg.A == 0);
        report(cpu, "LD BC,1234h (5)", cpu.reg.F == 0);
        report(cpu, "LD BC,1234h (6)", cpu.reg.SP == 0xfffe);
        report(cpu, "LD BC,1234h (7)", cpu.reg.IX == 0);
        report(cpu, "LD BC,1234h (8)", cpu.reg.IY == 0);
    }},
    { name: "LD DE,1234h", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.reg.A = 0;
        cpu.reg.F = 0;
        cpu.reg.SP = 0xfffe;
        cpu.reg.IX = 0;
        cpu.reg.IY = 0;
        tester.runMnemonics(cpu, ["LD DE,1234h"]);
        report(cpu, "LD DE,1234h (1)", cpu.reg.getBC() == 0);
        report(cpu, "LD DE,1234h (2)", cpu.reg.getDE() == 0x1234);
        report(cpu, "LD DE,1234h (3)", cpu.reg.getHL() == 0);
        report(cpu, "LD DE,1234h (4)", cpu.reg.A == 0);
        report(cpu, "LD DE,1234h (5)", cpu.reg.F == 0);
        report(cpu, "LD DE,1234h (6)", cpu.reg.SP == 0xfffe);
        report(cpu, "LD DE,1234h (7)", cpu.reg.IX == 0);
        report(cpu, "LD DE,1234h (8)", cpu.reg.IY == 0);
    }},
    { name: "LD HL,1234h", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.reg.A = 0;
        cpu.reg.F = 0;
        cpu.reg.SP = 0xfffe;
        cpu.reg.IX = 0;
        cpu.reg.IY = 0;
        tester.runMnemonics(cpu, ["LD HL,1234h"]);
        report(cpu, "LD HL,1234h (1)", cpu.reg.getBC() == 0);
        report(cpu, "LD HL,1234h (2)", cpu.reg.getDE() == 0);
        report(cpu, "LD HL,1234h (3)", cpu.reg.getHL() == 0x1234);
        report(cpu, "LD HL,1234h (4)", cpu.reg.A == 0);
        report(cpu, "LD HL,1234h (5)", cpu.reg.F == 0);
        report(cpu, "LD HL,1234h (6)", cpu.reg.SP == 0xfffe);
        report(cpu, "LD HL,1234h (7)", cpu.reg.IX == 0);
        report(cpu, "LD HL,1234h (8)", cpu.reg.IY == 0);
    }},
    { name: "LD SP,(1234h)", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.reg.A = 0;
        cpu.reg.F = 0;
        cpu.reg.SP = 0xfffe;
        cpu.reg.IX = 0;
        cpu.reg.IY = 0;
        cpu.memory.poke(0x1234, 0xCD);
        cpu.memory.poke(0x1235, 0xAB);
        tester.runMnemonics(cpu, ["LD SP,(1234h)"]);
        report(cpu, "LD SP,(1234h) (1)", cpu.reg.getBC() == 0);
        report(cpu, "LD SP,(1234h) (2)", cpu.reg.getDE() == 0);
        report(cpu, "LD SP,(1234h) (3)", cpu.reg.getHL() == 0);
        report(cpu, "LD SP,(1234h) (4)", cpu.reg.A == 0);
        report(cpu, "LD SP,(1234h) (5)", cpu.reg.F == 0);
        report(cpu, "LD SP,(1234h) (6)", cpu.reg.SP == 0xABCD);
        report(cpu, "LD SP,(1234h) (7)", cpu.reg.IX == 0);
        report(cpu, "LD SP,(1234h) (8)", cpu.reg.IY == 0);
    }},
];
UnitTest.test({
    name: "16 bit load group",
    test_set: test_set
});
