"use strict";
const assert = require("chai").assert;
const Z80LineAssembler = require("../Z80/z80-line-assembler.js");
const oct = require("../lib/oct.js");
describe("Z80LineAssembler", () => {
    describe("#assemble", () => {
        describe("pseudo mnemonic DEFB", () => {
            describe("single numeric operand", () => {
                it("should recognize a decimal number", () => {
                    let asm = Z80LineAssembler.assemble("DEFB 128", 0, {});
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], 128);
                });
                it("should recognize a hexadecimal number", () => {
                    let asm = Z80LineAssembler.assemble("DEFB FEH", 0, {});
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], 0xFE);
                });
                it("should recognize a octadecimal number", () => {
                    let asm = Z80LineAssembler.assemble("DEFB 0123", 0, {});
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], oct("0123"));
                });
            });
            describe("multiple numeric operand", () => {
                it("should recognize as array delimited by a comma", () => {
                    let asm = Z80LineAssembler.assemble("DEFB 128, FEH,0123", 0, {});
                    assert.equal(asm.mnemonic, "DEFB");
                    assert.equal(asm.operand, "128,FEH,0123");
                    assert.deepEqual(asm.bytecode, [128, 0xfe, oct("0123")]);
                });
                it("should recognize as array delimited by a space", () => {
                    let asm = Z80LineAssembler.assemble("DEFB 128   FEH 0123", 0, {});
                    assert.equal(asm.mnemonic, "DEFB");
                    assert.equal(asm.operand, "128 FEH 0123");
                    assert.deepEqual(asm.bytecode, [128, 0xfe, oct("0123")]);
                });
            });
            describe("ASCII string", () => {
                it("should recognize one character", () => {
                    let asm = Z80LineAssembler.assemble("DEFB \"A\"");
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], 0x41);
                });
                it("should recognize octal ascii-code", () => {
                    let asm = Z80LineAssembler.assemble("DEFB \"\\123\"");
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], oct("123"));
                });
                it("should recognize hexa ascii-code", () => {
                    let asm = Z80LineAssembler.assemble("DEFB \"\\x41\"");
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], 0x41);
                });
                it("should recognize carriage return", () => {
                    let asm = Z80LineAssembler.assemble("DEFB \"\\r\"");
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], 13);//CR
                });
                it("should recognize ascii string", () => {
                    let asm = Z80LineAssembler.assemble("DEFB \"ABC\"");
                    assert.deepEqual(asm.bytecode, [0x41, 0x42, 0x43]);
                });
            });
            describe("MZ-700 display code", () => {
                it("should recognize one character", () => {
                    let asm = Z80LineAssembler.assemble("DEFB `A`");
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], 0x01);
                });
                it("should recognize octal code", () => {
                    let asm = Z80LineAssembler.assemble("DEFB `\\123`");
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], oct("123"));
                });
                it("should recognize hexa code", () => {
                    let asm = Z80LineAssembler.assemble("DEFB `\\x41`");
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], 0x41);
                });
                it("should recognize as string", () => {
                    let asm = Z80LineAssembler.assemble("DEFB `ABC`");
                    assert.deepEqual(asm.bytecode, [0x01, 0x02, 0x03]);
                });
            });
            describe("Referencing a label", () => {
                it("should recognize a label defined", () => {
                    let asm = Z80LineAssembler.assemble("DEFB DATA", 0, {DATA:0xAB});
                    assert.equal(asm.bytecode.length, 1);
                    assert.equal(asm.bytecode[0], 0xAB);
                });
            });
        });
    });
});

