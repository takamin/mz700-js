"use strict";
describe("Z80/assembler", () => {
    const assert = require("chai").assert;
    const assembler = require("../Z80/assembler");
    describe("assemble", () => {
        it("should link when the both aseembly does not specify the origin", () => {
            let result = assembler.assemble([
                [
                    "LD HL,1234H",
                ].join("\n"),
                [
                    "XOR A",
                ].join("\n"),
            ]);
            assert.equal(result.minAddr, 0);
            assert.equal(result.maxAddr, 3);
            assert.deepEqual(result.buffer, [0x21, 0x34, 0x12, 0xAF]);
        });
        it("should link when the only first aseembly specify the origin", () => {
            let result = assembler.assemble([
                [
                    "ORG 1200H",
                    "LD HL,1234H",
                ].join("\n"),
                [
                    "XOR A",
                ].join("\n"),
            ]);
            assert.equal(result.minAddr, 0x1200);
            assert.equal(result.maxAddr, 0x1203);
            assert.deepEqual(result.buffer, [0x21, 0x34, 0x12, 0xAF]);
        });
        it("should link when the only second aseembly specify the origin", () => {
            let result = assembler.assemble([
                [
                    "LD HL,1234H",
                ].join("\n"),
                [
                    "ORG 0004H",
                    "XOR A",
                ].join("\n"),
            ]);
            assert.equal(result.minAddr, 0x0000);
            assert.equal(result.maxAddr, 0x0004);
            assert.deepEqual(result.buffer,
                [0x21, 0x34, 0x12, 0x00, 0xAF]);
        });
        it("should link when the both of aseembly specify the origin", () => {
            let result = assembler.assemble([
                [
                    "ORG 0010H",
                    "LD HL,1234H",
                ].join("\n"),
                [
                    "ORG 0014H",
                    "XOR A",
                ].join("\n"),
            ]);
            assert.equal(result.minAddr, 0x0010);
            assert.equal(result.maxAddr, 0x0014);
            assert.deepEqual(result.buffer,
                [0x21, 0x34, 0x12, 0x00, 0xAF]);
        });
        it("should link when the both of aseembly specify the origin as reverse", () => {
            let result = assembler.assemble([
                [
                    "ORG 0014H",
                    "LD HL,1234H",
                ].join("\n"),
                [
                    "ORG 0010H",
                    "XOR A",
                ].join("\n"),
            ]);
            assert.equal(result.minAddr, 0x0010);
            assert.equal(result.maxAddr, 0x0014);
            assert.deepEqual(result.buffer,
                [0xAF, 0x00, 0x00, 0x00, 0x21, 0x34, 0x12, ]);
        });
        it("should generate the integrated address map", () => {
            let result = assembler.assemble([
                [
                    "ORG 1200H",
                    "DEFV1: EQU abcdH",
                    "ENTP1:ENT",
                    "LD HL,DEFV2",
                ].join("\n"),
                [
                    "ENTP2:ENT",
                    "XOR A",
                    "DEFV2:EQU 5678H",
                ].join("\n"),
            ]);
            assert.deepEqual(result.label2value,{
                "ENTP1": 0x1200,
                "ENTP2": 0x1203,
                "DEFV1": 0xABCD,
                "DEFV2": 0x5678,
            });
        });
        it("should resolve the address defined in other assemblies", () => {
            let result = assembler.assemble([
                [
                    "ORG 1200H",
                    "DEFV1: EQU abcdH",
                    "ENTP1:ENT",
                    "LD HL,DEFV2",
                ].join("\n"),
                [
                    "ENTP2:ENT",
                    "XOR A",
                    "JP ENTP1",
                    "DEFV2:EQU 5678H",
                ].join("\n"),
            ]);
            assert.deepEqual(result.buffer,
                [0x21, 0x78, 0x56, 0xAF, 0xC3, 0x00, 0x12, ]);
        });
    });
});
