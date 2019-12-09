var Z80Tester = require('./Z80Tester.js');
var Z80 = require('../Z80/Z80.js');

var tester = new Z80Tester();
var cpu = new Z80();
var registers_rr = new Array("B", "C", "D", "E", "H", "L", "A");
var test_set = [];

//
// RRC
//
registers_rr.forEach(function(rr) {
    test_set.push({ name: "RRC " + rr + " - clear flag C", test: function() {
        cpu.reg["set" + rr]( 0 );
        cpu.reg.setFlagC();
        tester.runMnemonics(cpu, ["RRC " + rr + ""]);
        return cpu.reg.flagC() == 0;
    }});
    test_set.push({ name: "RRC " + rr + " - set flag C", test: function() {
        cpu.reg["set" + rr]( 1 );
        cpu.reg.clearFlagC();
        tester.runMnemonics(cpu, ["RRC " + rr + ""]);
        return cpu.reg.flagC() == 1;
    }});
    test_set.push({ name: "RRC " + rr + " - rotate 0", test: function() {
        cpu.reg["set" + rr]( 0x92 );//10010010;
        cpu.reg.setFlagC();
        tester.runMnemonics(cpu, ["RRC " + rr + ""]);
        return cpu.reg["get" + rr]() == 0x49;//01001001
    }});
    test_set.push({ name: "RRC " + rr + " - rotate 1", test: function() {
        cpu.reg["set" + rr]( 0x49 );//01001001;
        cpu.reg.setFlagC();
        tester.runMnemonics(cpu, ["RRC " + rr + ""]);
        return cpu.reg["get" + rr]() == 0xa4;//10100100
    }});
});
//
// RLC
//
registers_rr.forEach(function(rr) {
    test_set.push({ name: "RLC " + rr + " - clear flag C", test: function() {
        cpu.reg["set" + rr]( 0 );
        cpu.reg.setFlagC();
        tester.runMnemonics(cpu, ["RLC " + rr + ""]);
        return cpu.reg.flagC() == 0;
    }});
    test_set.push({ name: "RLC " + rr + " - set flag C", test: function() {
        cpu.reg["set" + rr]( 0x80 );
        cpu.reg.clearFlagC();
        tester.runMnemonics(cpu, ["RLC " + rr + ""]);
        return cpu.reg.flagC() == 1;
    }});
    test_set.push({ name: "RLC " + rr + " - rotate 0", test: function() {
        cpu.reg["set" + rr]( 0x49 );//01001001;
        cpu.reg.setFlagC();
        tester.runMnemonics(cpu, ["RLC " + rr + ""]);
        return cpu.reg["get" + rr]() == 0x92;//10010010
    }});
    test_set.push({ name: "RLC " + rr + " - rotate 1", test: function() {
        cpu.reg["set" + rr]( 0x92 );//10010010;
        cpu.reg.setFlagC();
        tester.runMnemonics(cpu, ["RLC " + rr + ""]);
        return cpu.reg["get" + rr]() == 0x25;//00100101
    }});
});

const UnitTest = require("./UnitTest");
UnitTest.test({
    name: "Rotate group",
    test_set: test_set
});
