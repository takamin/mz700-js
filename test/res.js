var UnitTest = require("./UnitTest");
var Z80Tester = require('./Z80Tester.js');
var Z80 = require('../Z80/Z80.js');
const NumberUtil = require("../lib/number-util.js");

var tester = new Z80Tester();
var cpu = new Z80();
var tests = [
    function() {
        ["B","C","D","E","H","L","A"].forEach(function(r) {
            for(var b = 0; b < 8; b++) {
                var mnemonic = "RES " + b + "," + r;
                var init = 0xff;
                var expect = 0xff & ~(1 << b);

                cpu.reg["set" + r]( init );
                tester.runMnemonics(cpu, [mnemonic]);
                UnitTest.report(
                        "" + mnemonic + ": to " + NumberUtil.HEX(init, 2) + "H must be " + NumberUtil.HEX(expect, 2) + "H",
                        cpu.reg["get" + r]() == expect,
                        NumberUtil.HEX(cpu.reg["get" + r](), 2) + "H");
            }
        });
    },
    function() {
        for(var b = 0; b < 8; b++) {
            var mnemonic = "RES " + b + ", (HL)";
            var init = 0xff;
            var expect = 0xff & ~(1 << b);
            var addr = 0x1200;
            cpu.reg.setHL(addr);
            cpu.memory.poke(addr, init);
            tester.runMnemonics(cpu, [mnemonic]);
            var result = cpu.memory.peek(addr);
            UnitTest.report(
                    "" + mnemonic + ": to " + NumberUtil.HEX(init, 2) + "H must be " + NumberUtil.HEX(expect, 2) + "H",
                    result == expect,
                    NumberUtil.HEX(result, 2) + "H");
        }
    },
    function() {
        ["IX","IY"].forEach(function(idx) {
            [0, 1, 127, -128, -1].forEach( d => {
                for(let b = 0; b < 8; b++) {
                    const mnemonic = `RES ${b},(${idx}${d>=0?"+":""}${d})`;
                    const init = 0xff;
                    const expect = 0xff & ~(1 << b);
                    const addr = 0x100;
                    cpu.reg[idx] = addr;
                    cpu.memory.poke(addr + d, init);
                    tester.runMnemonics(cpu, [mnemonic]);
                    const result = cpu.memory.peek(addr + d);
                    UnitTest.report(
                            "" + mnemonic + ": to " + NumberUtil.HEX(init, 2) + "H must be " + NumberUtil.HEX(expect, 2) + "H",
                            result == expect,
                            NumberUtil.HEX(result, 2) + "H");
                }
            });
        });
    }
];
var test_set = [ ];
UnitTest.test({
    name: "RES b,r",
    test: function() {
        for(var i = 0; i < tests.length; i++) {
            tests[i]();
        }
    },
    test_set: test_set
});

