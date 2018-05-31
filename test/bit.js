require("../lib/context");
var UnitTest = require("./UnitTest");
var Z80Tester = require('./Z80Tester.js');
var Z80 = require('../Z80/Z80.js');
var tester = new Z80Tester();
var cpu = new Z80();
const chai = require("chai");
const assert = chai.assert;
var reg8 = "ABCDEHL".split('');
describe("BIT/SET/RES", function() {
    reg8.forEach(function(r) {
        [0,1,2,3,4,5,6,7].forEach(function(bit) {
            describe("BIT " + bit + "," + r, function() {
                it("should be NZ / H / NN", function() {
                    var on = 1 << bit;
                    cpu.reg["set" + r](on);
                    cpu.reg.clearFlagZ();
                    tester.runMnemonics(cpu, [
                            "BIT " + bit + "," + r
                    ]);
                    assert.equal(false, cpu.reg.flagZ());
                    assert.equal(true, cpu.reg.flagH());
                    assert.equal(false, cpu.reg.flagN());
                });
                it("should be Z / H / NN", function() {
                    var off = ~(1 << bit);
                    cpu.reg["set" + r](off);
                    cpu.reg.setFlagZ();
                    tester.runMnemonics(cpu, [
                            "BIT " + bit + "," + r
                    ]);
                    assert.equal(true, cpu.reg.flagZ());
                    assert.equal(true, cpu.reg.flagH());
                    assert.equal(false, cpu.reg.flagN());
                });
            });
            describe("SET " + bit + "," + r, function() {
                it("should set the bit", function() {
                    cpu.reg["set" + r](0);
                    tester.runMnemonics(cpu, [
                            "SET " + bit + "," + r
                    ]);
                    assert.equal(1 << bit, cpu.reg["get" + r]());
                });
                it("should set the bit when it already set", function() {
                    cpu.reg["set" + r](1 << bit);
                    tester.runMnemonics(cpu, [
                            "SET " + bit + "," + r
                    ]);
                    assert.equal(1 << bit, cpu.reg["get" + r]());
                });
                it("should not reset other bits", function() {
                    cpu.reg["set" + r](~(1 << bit));
                    tester.runMnemonics(cpu, [
                            "SET " + bit + "," + r
                    ]);
                    assert.equal(255, cpu.reg["get" + r]());
                });
            });
            describe("RES " + bit + "," + r, function() {
                it("should reset the bit", function() {
                    cpu.reg["set" + r](255);
                    cpu.reg.clearFlagZ();
                    tester.runMnemonics(cpu, [
                            "RES " + bit + "," + r
                    ]);
                    assert.equal(0xff & (~(1 << bit)), cpu.reg["get" + r]());
                });
                it("should reset the bit when it already reset", function() {
                    cpu.reg["set" + r](~(1 << bit));
                    cpu.reg.clearFlagZ();
                    tester.runMnemonics(cpu, [
                            "RES " + bit + "," + r
                    ]);
                    assert.equal(0xff & (~(1 << bit)), cpu.reg["get" + r]());
                });
                it("should not set other bits", function() {
                    cpu.reg["set" + r](1 << bit);
                    cpu.reg.clearFlagZ();
                    tester.runMnemonics(cpu, [
                            "RES " + bit + "," + r
                    ]);
                    assert.equal(0, cpu.reg["get" + r]());
                });
            });
        });
    });
});
