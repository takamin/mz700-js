var UnitTest = require("./UnitTest");
var fs = require('fs');
eval(fs.readFileSync('Z80Tester.js')+'');
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
    { name: "CPI", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.A = 0x27;
        cpu.reg.setHL(0xD000);
        for(var i = 0; i < 0x28; i++) {
            cpu.memory.poke(0xD000 + i, i);
        }
        for(var i = 0; i < 0x28; i++) {
            tester.runMnemonics(cpu, ["CPI"]);
            report(cpu, "CPI inc HL", cpu.reg.getHL() == 0xD001 + i);
            report(cpu, "CPI dec BC", cpu.reg.getBC() == 0x0027 - i);
            report(cpu, "CPI memory", cpu.memory.peek(0xD000 + i) == i);
            report(cpu, "CPI Z flag", cpu.reg.flagZ() == (i == 0x27));
        }
    }},
    { name: "CPIR", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.A = 0x27;
        cpu.reg.setHL(0xD000);
        for(var i = 0; i < 0x28; i++) {
            cpu.memory.poke(0xD000 + i, i);
        }
        tester.runMnemonics(cpu, ["CPIR"]);
        report(cpu, "CPIR inc HL", cpu.reg.getHL() == 0xD028);
        report(cpu, "CPIR dec BC", cpu.reg.getBC() == 0x0000);
        for(var i = 0; i < 0x28; i++) {
            report(cpu, "CPIR memory", cpu.memory.peek(0xD000 + i) == i);
        }
        report(cpu, "CPIR Z flag", cpu.reg.flagZ() == true);
    }},
    { name: "CPIR 2", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.A = 0x10;
        cpu.reg.setHL(0xD000);
        for(var i = 0; i < 0x28; i++) {
            cpu.memory.poke(0xD000 + i, i);
        }
        tester.runMnemonics(cpu, ["CPIR"]);
        report(cpu, "CPIR inc HL", cpu.reg.getHL() == 0xD011);
        report(cpu, "CPIR dec BC", cpu.reg.getBC() == 0x0017);
        for(var i = 0; i < 0x28; i++) {
            report(cpu, "CPIR memory", cpu.memory.peek(0xD000 + i) == i);
        }
        report(cpu, "CPIR Z flag", cpu.reg.flagZ() == true);
    }},
    { name: "CPD", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.A = 0x27;
        cpu.reg.setHL(0xD027);
        for(var i = 0; i < 0x28; i++) {
            cpu.memory.poke(0xD027 - i, i);
        }
        for(var i = 0; i < 0x28; i++) {
            tester.runMnemonics(cpu, ["CPD"]);
            report(cpu, "CPD #" + i + " dec HL", cpu.reg.getHL() == 0xD026 - i);
            report(cpu, "CPD #" + i + " dec BC", cpu.reg.getBC() == 0x0027 - i);
            report(cpu, "CPD #" + i + " memory", cpu.memory.peek(0xD027 - i) == i);
            report(cpu, "CPD #" + i + " Z flag", cpu.reg.flagZ() == (i == 0x27));
        }
    }},
    { name: "CPDR", test: function() {
        cpu.reg.setBC(0x0028);
        cpu.reg.A = 0x27;
        cpu.reg.setHL(0xD027);
        for(var i = 0; i < 0x28; i++) {
            cpu.memory.poke(0xD027 - i, i);
        }
        tester.runMnemonics(cpu, ["CPDR"]);
        report(cpu, "CPDR dec HL", cpu.reg.getHL() == 0xCFFF);
        report(cpu, "CPDR dec BC", cpu.reg.getBC() == 0x0000);
        for(var i = 0; i < 0x28; i++) {
            report(cpu, "CPDR memory", cpu.memory.peek(0xD027 - i) == i);
        }
        report(cpu, "CPDR Z flag", cpu.reg.flagZ() == true);
    }},
];
module.exports = {
    name: "search",
    test_set: test_set
};

