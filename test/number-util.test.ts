describe("NumberUtil", ()=>{
    const chai = require("chai");
    const assert = chai.assert;
    const NumberUtil = require("../lib/number-util");
    describe(".to8bitSigned", ()=>{
        describe("zero or positive number should not be converted", () => {
            it("should not convert 0", ()=>{
                assert.equal(NumberUtil.to8bitSigned(0x00), 0);
            });
            it("should not convert 1", ()=>{
                assert.equal(NumberUtil.to8bitSigned(0x01), 1);
            });
            it("should not convert 0x7F", ()=>{
                assert.equal(NumberUtil.to8bitSigned(0x7f), 0x7f);
            });
        });
        describe("negative value should be converted", ()=>{
            it("should convert 0xFF to -1", ()=>{
                assert.equal(NumberUtil.to8bitSigned(0xff), -1);
            });
            it("should convert 0x80 to -128", ()=>{
                assert.equal(NumberUtil.to8bitSigned(0x80), -128);
            });
        });
        describe("throws when the input value is out of range", () => {
            it("should throw for -1", ()=>{
                assert.throw(()=>{
                    NumberUtil.to8bitSigned(-1);
                })
            });
            it("should throw for 0x100", ()=>{
                assert.throw(()=>{
                    NumberUtil.to8bitSigned(0x100);
                })
            });
        });
    });
    describe(".to8bitUnsigned", ()=>{
        describe("zero or positive number should not be converted", () => {
            it("should not convert 0", ()=>{
                assert.equal(NumberUtil.to8bitUnsigned(0x00), 0);
            });
            it("should not convert 1", ()=>{
                assert.equal(NumberUtil.to8bitUnsigned(0x01), 1);
            });
            it("should not convert 0x7f", ()=>{
                assert.equal(NumberUtil.to8bitUnsigned(0x7f), 0x7f);
            });
        });
        describe("negative value should be converted", ()=>{
            it("should convert -1 to 0xff", ()=>{
                assert.equal(NumberUtil.to8bitUnsigned(-1), 0xff);
            });
            it("should convert -128 to 0x80", ()=>{
                assert.equal(NumberUtil.to8bitUnsigned(-128), 0x80);
            });
        });
        describe("throws when the input value is out of range", () => {
            it("should throw for -129", ()=>{
                assert.throw(()=>{
                    NumberUtil.to8bitUnsigned(-129);
                })
            });
            it("should throw for 128", ()=>{
                assert.throw(()=>{
                    NumberUtil.to8bitUnsigned(128);
                })
            });
        });
    });
});
