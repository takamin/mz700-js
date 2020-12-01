"use strict";
describe("MZ700_memory", () => {
    const assert = require("chai").assert;
    const MZ700_Memory = require("../MZ-700/mz700-memory");
    describe("changeBlock1_VRAM", () => {
        it("should be able to peek a byte at D000 of the TEXT-VRAM", () => {
            const mem = new MZ700_Memory();
            mem.create({});
            mem.changeBlock1_VRAM();
            assert.doesNotThrow(() => {
                mem.peek(0xD000);
            });
        });
    });
    describe("changeBlock1_DRAM", () => {
        it("should be able to peek a byte at D000h of the DRAM", () => {
            const mem = new MZ700_Memory();
            mem.create({});
            mem.changeBlock1_DRAM();
            assert.doesNotThrow(() => {
                mem.peek(0xD000);
            });
        });
    });
});
