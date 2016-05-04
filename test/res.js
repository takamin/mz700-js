var UnitTest = require("./UnitTest");
var fs = require('fs');
eval(fs.readFileSync('Z80Tester.js')+'');

var tester = new Z80Tester();
var cpu = new Z80();
var tests = [
    function() {
        ["B","C","D","E","H","L","A"].forEach(function(r) {
            for(var b = 0; b < 8; b++) {
                var mnemonic = "RES " + b + "," + r;
                var init = 0xff;
                var expect = 0xff & ~(1 << b);

                cpu.reg[r] = init;
                tester.runMnemonics(cpu, [mnemonic]);
                UnitTest.report(
                        "" + mnemonic + ": to " + init.HEX(2) + "H must be " + expect.HEX(2) + "H",
                        cpu.reg[r] == expect,
                        cpu.reg[r].HEX(2) + "H");
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
                    "" + mnemonic + ": to " + init.HEX(2) + "H must be " + expect.HEX(2) + "H",
                    result == expect,
                    result.HEX(2) + "H");
        }
    },
    function() {
        ["IX","IY"].forEach(function(idx) {
            [0, 1, 127, 254, 255].forEach(function(d) {
                for(var b = 0; b < 8; b++) {
                    var mnemonic = "RES " + b + ",(" + idx + "+" + d + ")";
                    var init = 0xff;
                    var expect = 0xff & ~(1 << b);
                    var addr = 0x100;
                    cpu.reg[idx] = addr;
                    cpu.memory.poke(addr + d, init);
                    tester.runMnemonics(cpu, [mnemonic]);
                    var result = cpu.memory.peek(addr + d);
                    UnitTest.report(
                            "" + mnemonic + ": to " + init.HEX(2) + "H must be " + expect.HEX(2) + "H",
                            result == expect,
                            result.HEX(2) + "H");
                }
            });
        });
    }
];
var test_set = [ ];
module.exports = {
    name: "RES b,r",
    test: function() {
        for(var i = 0; i < tests.length; i++) {
            tests[i]();
        }
    },
    test_set: test_set
};

