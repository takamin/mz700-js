var UnitTest = require("./lib/UnitTest.js");
var Z80Tester = require('./lib/Z80Tester.js');
var Z80 = require('../Z80/Z80.js');
var cpu = new Z80();

var tester = new Z80Tester();
function report(cpu, name, result) {
    if(result === true) {
        UnitTest.report(name, true);
    } else {
        UnitTest.report(name, false, "");
        cpu.reg.debugDump();
    }
}
var test_set = [
    { name: "LDI", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.setDE(0xD000);
        cpu.reg.setHL(0xD028);
        cpu.memory.poke(0xD000, 0);
        cpu.memory.poke(0xD028, 1);
        tester.runMnemonics(cpu, ["LDI"]);
        report(cpu, "LDI inc DE", cpu.reg.getDE() == 0xD001);
        report(cpu, "LDI inc HL", cpu.reg.getHL() == 0xD029);
        report(cpu, "LDI dec BC", cpu.reg.getBC() == 0x0027);
        report(cpu, "LDI memory", cpu.memory.peek(0xD000) == 1);
    }},
    { name: "LDIR", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.setDE(0xD000);
        cpu.reg.setHL(0xD028);
        for(var i = 0; i < 0x28; i++) {
            cpu.memory.poke(0xD000 + i, ~i & 0xff);
            cpu.memory.poke(0xD028 + i, i);
        }
        tester.runMnemonics(cpu, ["LDIR"]);
        report(cpu, "LDIR inc DE", cpu.reg.getDE() == 0xD028);
        report(cpu, "LDIR inc HL", cpu.reg.getHL() == 0xD050);
        report(cpu, "LDIR dec BC", cpu.reg.getBC() == 0x0000);
        for(var i = 0; i < 0x28; i++) {
            report(cpu, "LDI memory", cpu.memory.peek(0xD000 + i) == i);
        }
    }},
    { name: "LDD", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.setDE(0xD000);
        cpu.reg.setHL(0xD028);
        cpu.memory.poke(0xD000, 0);
        cpu.memory.poke(0xD028, 1);
        tester.runMnemonics(cpu, ["LDD"]);
        report(cpu, "LDD dec DE", cpu.reg.getDE() == 0xCFFF);
        report(cpu, "LDD dec HL", cpu.reg.getHL() == 0xD027);
        report(cpu, "LDD dec BC", cpu.reg.getBC() == 0x0027);
        report(cpu, "LDD memory", cpu.memory.peek(0xD000) == 1);
    }},
    { name: "LDDR", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.setDE(0xD027);
        cpu.reg.setHL(0xD04F);
        for(var i = 0; i < 0x28; i++) {
            cpu.memory.poke(0xD028 - 0x28 + i, ~i & 0xff);
            cpu.memory.poke(0xD050 - 0x28 + i, i);
        }
        tester.runMnemonics(cpu, ["LDDR"]);
        report(cpu, "LDDR dec DE", cpu.reg.getDE() == 0xCFFF);
        report(cpu, "LDDR dec HL", cpu.reg.getHL() == 0xD027);
        report(cpu, "LDDR dec BC", cpu.reg.getBC() == 0x0000);
        for(var i = 0; i < 0x28; i++) {
            report(cpu, "LDI memory", cpu.memory.peek(0xD000 + i) == i);
        }
    }},
];
UnitTest.test({
    name: "block transfer",
    test_set: test_set
});
