const Z80Tester = require('./lib/Z80Tester.js');
const Z80 = require('../Z80/Z80.js');
const tester = new Z80Tester();
const cpu = new Z80();
const chai = require("chai");
const assert = chai.assert;
describe("8 bit calculation", ()=>{
    describe("When C flag is set", ()=>{
        describe("ADC A,n", ()=>{
            it("should add extra 1", ()=>{
                cpu.reg.setA(0x00);
                cpu.reg.setFlagC();
                tester.runMnemonics(cpu, [ "ADC A,1" ]);
                assert.equal(cpu.reg.getA(), 2);
            });
        });
        describe("SBC A,n", ()=>{
            it("should subtract extra 1", ()=>{
                cpu.reg.setA(0x02);
                cpu.reg.setFlagC();
                tester.runMnemonics(cpu, [ "SBC A,1" ]);
                assert.equal(cpu.reg.getA(), 0);
            });
        });
    });
    describe("When C flag is cleared", ()=>{
        describe("ADC A,n", ()=>{
            it("should not add extra 1", ()=>{
                cpu.reg.setA(0x00);
                cpu.reg.clearFlagC();
                tester.runMnemonics(cpu, [ "ADC A,1" ]);
                assert.equal(cpu.reg.getA(), 1);
            });
        });
        describe("SBC A,n", ()=>{
            it("should not subtract extra 1", ()=>{
                cpu.reg.setA(0x02);
                cpu.reg.clearFlagC();
                tester.runMnemonics(cpu, [ "SBC A,1" ]);
                assert.equal(cpu.reg.getA(), 1);
            });
        });
    });
});
