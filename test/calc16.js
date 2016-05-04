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
    { name: "ADC HL,BC", test: function() {
        cpu.reg.setBC(1);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.reg.clearFlagC();
        tester.runMnemonics(cpu, ["ADC HL,BC"]);
        report(cpu, "ADC HL(0),BC(1):C=0", cpu.reg.getHL() == 1);
        cpu.reg.setBC(1);
        cpu.reg.setDE(0);
        cpu.reg.setHL(0);
        cpu.reg.setFlagC();
        tester.runMnemonics(cpu, ["ADC HL,BC"]);
        report(cpu, "ADC HL(0),BC(1):C=1", cpu.reg.getHL() == 2);
    }},
    { name: "ADC HL,DE", test: function() {
        cpu.reg.setBC(0);
        cpu.reg.setDE(1);
        cpu.reg.setHL(0);
        cpu.reg.clearFlagC();
        tester.runMnemonics(cpu, ["ADC HL,DE"]);
        report(cpu, "ADC HL(0),DE(1):C=0", cpu.reg.getHL() == 1);
        cpu.reg.setBC(0);
        cpu.reg.setDE(1);
        cpu.reg.setHL(0);
        cpu.reg.setFlagC();
        tester.runMnemonics(cpu, ["ADC HL,DE"]);
        report(cpu, "ADC HL(0),DE(1):C=1", cpu.reg.getHL() == 2);
    }},
];
module.exports = {
    name: "16 bit calcuration",
    test_set: test_set
};
