describe("MZ_Tape", function() {
    "use strict";
    var chai = require("chai");
    var assert = chai.assert;
    var MZ_Tape = require("../lib/mz-tape");
    var MZ_TapeHeader = require("../lib/mz-tape-header");
    describe("#isThereSignal", function() {
        describe("searching signal true", function() {
            it("returns true", function() {
                var tape = new MZ_Tape([true, true, false]);
                var result = tape.isThereSignal(true, 2);
                assert.equal(result, true);
            });
            it("returns false at first", function() {
                var tape = new MZ_Tape([false, true, true]);
                var result = tape.isThereSignal(true, 3);
                assert.equal(result, false);
            });
            it("returns false at last", function() {
                var tape = new MZ_Tape([true, true, false]);
                var result = tape.isThereSignal(true, 3);
                assert.equal(result, false);
            });
            describe("index forwarding", function() {
                it("should be incremented, if the pattern is found ", function() {
                    var tape = new MZ_Tape([true, true, false]);
                    var result = tape.isThereSignal(true, 2);
                    assert.equal(tape._index, 2);
                });
                it("should not be modified, if the pattern is not found ", function() {
                    var tape = new MZ_Tape([false, true, false]);
                    var result = tape.isThereSignal(true, 2);
                    assert.equal(tape._index, 0);
                });
            });
        });
        describe("searching signal false", function() {
            it("returns true", function() {
                var tape = new MZ_Tape([false, false, true]);
                var result = tape.isThereSignal(false, 2);
                assert.equal(result, true);
            });
            it("returns false at first", function() {
                var tape = new MZ_Tape([true, false, false]);
                var result = tape.isThereSignal(false, 3);
                assert.equal(result, false);
            });
            it("returns false at last", function() {
                var tape = new MZ_Tape([false, false, true]);
                var result = tape.isThereSignal(false, 3);
                assert.equal(result, false);
            });
            describe("index forwarding", function() {
                it("should be incremented, if the pattern is found ", function() {
                    var tape = new MZ_Tape([false, false, true]);
                    var result = tape.isThereSignal(false, 2);
                    assert.equal(tape._index, 2);
                });
                it("should not be modified, if the pattern is not found ", function() {
                    var tape = new MZ_Tape([false, true, true]);
                    var result = tape.isThereSignal(false, 2);
                    assert.equal(tape._index, 0);
                });
            });
        });
    });
    describe("#recognizeStartingMark", function() {
        var validStartMark = [];
        var invalidStartMark0 = [];
        var invalidStartMark1 = [];
        var invalidStartMark2 = [];
        var invalidStartMark3 = [];
        var pushSignal = function(a, s, n) {
            for(var i = 0; i < n; i++) {
                a.push(s);
            }
        };
        pushSignal(validStartMark, false, 11000);
        pushSignal(validStartMark, true, 40);
        pushSignal(validStartMark, false, 40);
        pushSignal(validStartMark, true, 1);
        validStartMark.forEach(function(s) {
            invalidStartMark0.push(s);
            invalidStartMark1.push(s);
            invalidStartMark2.push(s);
            invalidStartMark3.push(s);
        });
        invalidStartMark0[10009] = !invalidStartMark0[10009];
        invalidStartMark1[11039] = !invalidStartMark1[11039];
        invalidStartMark2[11079] = !invalidStartMark2[11079];
        invalidStartMark3[11080] = !invalidStartMark0[11080];

        it("returns true for valid pattern", function() {
            var tape = new MZ_Tape(validStartMark);
            assert.equal(tape.recognizeStartingMark(), true);
        });
        it("returns false for invalid pattern 0", function() {
            var tape = new MZ_Tape(invalidStartMark0);
            assert.equal(tape.recognizeStartingMark(), false);
        });
        it("returns false for invalid pattern 1", function() {
            var tape = new MZ_Tape(invalidStartMark1);
            assert.equal(tape.recognizeStartingMark(), false);
        });
        it("returns false for invalid pattern 2", function() {
            var tape = new MZ_Tape(invalidStartMark2);
            assert.equal(tape.recognizeStartingMark(), false);
        });
        it("returns false for invalid pattern 3", function() {
            var tape = new MZ_Tape(invalidStartMark3);
            assert.equal(tape.recognizeStartingMark(), false);
        });
    });
    describe("#recognizeStarting2Mark", function() {
        var validStartMark = [];
        var invalidStartMark0 = [];
        var invalidStartMark1 = [];
        var invalidStartMark2 = [];
        var invalidStartMark3 = [];
        var pushSignal = function(a, s, n) {
            for(var i = 0; i < n; i++) {
                a.push(s);
            }
        };
        pushSignal(validStartMark, false, 2750);
        pushSignal(validStartMark, true, 20);
        pushSignal(validStartMark, false, 20);
        pushSignal(validStartMark, true, 1);
        validStartMark.forEach(function(s) {
            invalidStartMark0.push(s);
            invalidStartMark1.push(s);
            invalidStartMark2.push(s);
            invalidStartMark3.push(s);
        });
        invalidStartMark0[2749] = !invalidStartMark0[2749];
        invalidStartMark1[2769] = !invalidStartMark1[2769];
        invalidStartMark2[2789] = !invalidStartMark2[2789];
        invalidStartMark3[2790] = !invalidStartMark0[2790];

        it("returns true for valid pattern", function() {
            var tape = new MZ_Tape(validStartMark);
            assert.equal(tape.recognizeStarting2Mark(), true);
        });
        it("returns false for invalid pattern 0", function() {
            var tape = new MZ_Tape(invalidStartMark0);
            assert.equal(tape.recognizeStarting2Mark(), false);
        });
        it("returns false for invalid pattern 1", function() {
            var tape = new MZ_Tape(invalidStartMark1);
            assert.equal(tape.recognizeStarting2Mark(), false);
        });
        it("returns false for invalid pattern 2", function() {
            var tape = new MZ_Tape(invalidStartMark2);
            assert.equal(tape.recognizeStarting2Mark(), false);
        });
        it("returns false for invalid pattern 3", function() {
            var tape = new MZ_Tape(invalidStartMark3);
            assert.equal(tape.recognizeStarting2Mark(), false);
        });
    });
    describe("readSignal", function() {
        it("read true", function() {
            var tape = new MZ_Tape([true, false, true]);
            tape.readSignal();
            tape.readSignal();
            assert.equal(tape.readSignal(), true);
        });
        it("read false", function() {
            var tape = new MZ_Tape([true, false, true]);
            tape.readSignal();
            assert.equal(tape.readSignal(), false);
        });
        it("cannot read returns null", function() {
            var tape = new MZ_Tape([true, false, true]);
            tape.readSignal();
            tape.readSignal();
            tape.readSignal();
            assert.equal(tape.readSignal(), null);
        });
    });
    describe("writeSignal", function() {
        it("write true", function() {
            var tape = new MZ_Tape([]);
            tape.writeSignal(true);
            assert.equal(tape._tapeData[0], true);
        });
        it("write false", function() {
            var tape = new MZ_Tape([]);
            tape.writeSignal(true);
            tape.writeSignal(false);
            assert.equal(tape._tapeData[1], false);
        });
        it("grows data length", function() {
            var tape = new MZ_Tape([]);
            tape.writeSignal(true);
            tape.writeSignal(false);
            tape.writeSignal(true);
            assert.equal(tape._tapeData.length, 3);
        });
        it("does not change index", function() {
            var tape = new MZ_Tape([]);
            tape.writeSignal(true);
            tape.writeSignal(false);
            tape.writeSignal(true);
            assert.equal(tape._index, 0);
        });
    });
    describe("writeByte", function() {
        it("should put 9 signals par byte", function() {
            var tape = new MZ_Tape([]);
            tape.writeByte(0);
            assert.equal(tape._tapeData.length, 9);
            tape.writeByte(0);
            assert.equal(tape._tapeData.length, 18);
        });
        it("should put a start signal at first", function() {
            var tape = new MZ_Tape([]);
            tape.writeByte(0);
            tape.writeByte(0);
            assert.equal(tape._tapeData[0], true);
            assert.equal(tape._tapeData[9], true);
        });
        it("should put signals along the bits from MSB to LSB", function() {
            var tape = new MZ_Tape([]);
            tape.writeByte(0x80);
            tape.writeByte(0x01);
            assert.equal(tape._tapeData[1], true);
            assert.equal(tape._tapeData[2], false);
            assert.equal(tape._tapeData[3], false);
            assert.equal(tape._tapeData[4], false);
            assert.equal(tape._tapeData[5], false);
            assert.equal(tape._tapeData[6], false);
            assert.equal(tape._tapeData[7], false);
            assert.equal(tape._tapeData[8], false);
            assert.equal(tape._tapeData[10], false);
            assert.equal(tape._tapeData[11], false);
            assert.equal(tape._tapeData[12], false);
            assert.equal(tape._tapeData[13], false);
            assert.equal(tape._tapeData[14], false);
            assert.equal(tape._tapeData[15], false);
            assert.equal(tape._tapeData[16], false);
            assert.equal(tape._tapeData[17], true);
        });
    });
    describe("countOnBit", function() {
        it("should return count of on-bit", function() {
            var tape = new MZ_Tape([]);
            assert.equal(tape.countOnBit([0x00,0x00]), 0);
            assert.equal(tape.countOnBit([0x01,0x00]), 1);
            assert.equal(tape.countOnBit([0x80,0x00]), 1);
            assert.equal(tape.countOnBit([0x01,0x01]), 2);
            assert.equal(tape.countOnBit([0x80,0x80]), 2);
            assert.equal(tape.countOnBit([0x01,0x01]), 2);
            assert.equal(tape.countOnBit([0xFF,0xFF]), 16);
        });
        it("should return 16 bit value", function() {
            var tape = new MZ_Tape([]);
            var huge = [];
            for(var i = 0; i < 8192; i++) {
                huge.push(0xff);
            }
            assert.equal(tape.countOnBit(huge), 0);
            huge[0] = 0xfe;
            assert.equal(tape.countOnBit(huge), 65535);
        });
    });
    describe("writeBlock", function() {
        var data = [];
        for(var i = 0; i < 65; i++) {
            data.push(0xff);
        }
        var expectedLength = (data.length + 2) * 9 + 1;
        var getTestData = function() {
            var tape = new MZ_Tape([]);
            tape.writeBlock(data);
            return tape;
        };
        it("should puts data, checksum and stop bit.", function() {
            var tape = getTestData();
            assert.equal(tape._tapeData.length, expectedLength);
        });
        it("should puts valid data bits.", function() {
            var tape = getTestData();
            assert.equal(tape.isThereSignal(true, 65 * 9), true);
        });
        it("should puts true at last as end mark of the block.", function() {
            var tape = getTestData();
            assert.equal(tape._tapeData[expectedLength-1], true);
        });
        it("should put a valid checksum", function() {
            var tape = getTestData();
            var bitCount = tape.countOnBit(data);
            var cs = [0,0];
            cs[0] = (bitCount >> 8) & 0xff;
            cs[1] = (bitCount >> 0) & 0xff;
            for(var i = 0; i < cs.length; i++) {
                for(var j = 0; j < 8; j++) {
                    assert.equal(
                        tape._tapeData[(65 + i) * 9 + 1 + j],
                        ((cs[i] >> (7 - j)) & 0x01) != 0);
                }
            }
        });
    });
    /***
    describe("toBytes", function() {
        it("should retrieve MZT-file from MZ_Tape", function() {
            assert(false);
        });
    });
    ***/
    describe("fromBytes", function() {
        it("should convert MZT-file to magnetic signal", function() {
            var header = MZ_TapeHeader.createNew();
            header.setFilename("TEST");
            header.setAddrLoad(0x1200);
            header.setAddrExec(0);
            header.setFilesize(3);
            var dataSrc = header.buffer.concat([0xcd,0xcd,0xcd]);
            var dataDst = MZ_Tape.toBytes(MZ_Tape.fromBytes(dataSrc));
            assert(dataSrc.length == dataDst.length);
            dataDst.forEach(function(data,i) {
                assert(data == dataSrc[i]);
            });
        });
    });
});

