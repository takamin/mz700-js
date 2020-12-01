describe("ROTATE", ()=>{
    const UnitTest = require("./lib/UnitTest");
    const Z80Tester = require('./lib/Z80Tester');
    const Z80 = require('../Z80/Z80');

    const tester = new Z80Tester();
    const cpu = new Z80();
    const registers_rr = new Array("B", "C", "D", "E", "H", "L", "A");
    const test_set = [];

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

    UnitTest.test({
        name: "Rotate group",
        test_set: test_set
    });
});
