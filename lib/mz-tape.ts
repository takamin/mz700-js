"use strict";
import MZ_TapeHeader from './mz-tape-header';
import NumberUtil from "./number-util";
const { HEX } = NumberUtil;

/* tslint:disable: class-name no-console no-bitwise no-string-throw */

export default class MZ_Tape {
    _index:number;
    _tapeData;
    constructor(tapeData) {
        this._index = 0;
        this._tapeData = tapeData;
    }
    isThereSignal(signal, n) {
        for (let i = 0; i < n; i++) {
            if (this._tapeData[this._index + i] !== signal) {
                return false;
            }
        }
        this._index += n;
        return true;
    }
    recognizeStartingMark() {
        // START MARK
        if (!this.isThereSignal(false, 11000)) {
            return false;
        }
        if (!this.isThereSignal(true, 40)) {
            return false;
        }
        if (!this.isThereSignal(false, 40)) {
            return false;
        }
        if (!this.isThereSignal(true, 1)) {
            return false;
        }
        return true;
    }
    recognizeStarting2Mark() {
        // START MARK
        if (!this.isThereSignal(false, 2750)) {
            return false;
        }
        if (!this.isThereSignal(true, 20)) {
            return false;
        }
        if (!this.isThereSignal(false, 20)) {
            return false;
        }
        if (!this.isThereSignal(true, 1)) {
            return false;
        }
        return true;
    }
    readSignal() {
        if (this._index < this._tapeData.length) {
            return this._tapeData[this._index++];
        }
        return null;
    }
    writeSignal(signal) {
        this._tapeData.push(signal);
    }
    writeByte(data) {
        this.writeSignal(true);
        for (let j = 0; j < 8; j++) {
            if ((data & (0x01 << (7 - j))) !== 0) {
                this.writeSignal(true);
            }
            else {
                this.writeSignal(false);
            }
        }
    }
    writeBlock(data) {
        data.forEach(function (d) {
            this.writeByte(d);
        }, this);
        const cs = this.countOnBit(data);
        this.writeByte((cs >> 8) & 0xff);
        this.writeByte((cs >> 0) & 0xff);
        this.writeSignal(true);
    }
    writeDuplexBlock(data) {
        this.writeBlock(data);
        for (let i = 0; i < 256; i++) {
            this.writeSignal(false);
        }
        this.writeBlock(data);
    }
    readByte() {
        // fast forward to starting bit
        let startBit = null;
        do {
            startBit = this.readSignal();
            if (startBit == null) {
                return null; // End Of Stream
            }
            if (!startBit) {
                throw "NO START BIT";
            }
        } while (!startBit);
        // Read 8 bits and build 1 byte.
        // The bits are read from MSB to LSB.
        let buf = 0x00;
        for (let i = 0; i < 8; i++) {
            const bit = this.readSignal();
            if (bit == null) {
                return null;
            }
            else if (bit) {
                buf |= (0x01 << (7 - i));
            }
        }
        return buf;
    }
    readBytes(n) {
        const buf = [];
        for (let i = 0; i < n; i++) {
            const data = this.readByte();
            if (data == null) {
                break;
            }
            buf.push(data);
        }
        return buf;
    }
    countOnBit(blockBytes) {
        let onBitCount = 0;
        const bitno = [0, 1, 2, 3, 4, 5, 6, 7];
        blockBytes.forEach((data) => {
            bitno.forEach((n) => {
                if ((data & (1 << n)) !== 0) {
                    onBitCount++;
                }
            });
        });
        onBitCount &= 0xffff;
        return onBitCount;
    }
    readBlock(n) {
        // Read block bytes
        const blockBytes = this.readBytes(n);
        // read 2 bytes of checksum
        const checkBytes = this.readBytes(2);
        if (checkBytes.length !== 2) {
            throw "NO BLOCK CHECKSUM";
        }
        const checksum = (checkBytes[0] * 256) + checkBytes[1];
        // Read block end signal(long)
        if (!this.isThereSignal(true, 1)) {
            throw "NO BLOCK END BIT";
        }
        const onBitCount = this.countOnBit(blockBytes);
        if (onBitCount !== checksum) {
            throw "CHECKSUM ERROR";
        }
        return blockBytes;
    }
    readDuplexBlocks(n) {
        const bytes = this.readBlock(n);
        if (bytes == null) {
            throw "FAIL TO READ BLOCK[1]";
        }
        // Block delimitor
        if (!this.isThereSignal(false, 256)) {
            throw "NO DELIMITOR: Short x 256.";
        }
        const bytes2 = this.readBlock(n);
        if (bytes2 == null) {
            throw "FAIL TO READ BLOCK[2]";
        }
        // Check each bytes
        for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] !== bytes2[i]) {
                throw "FAIL TO VERIFY BLOCK 1 and 2";
            }
        }
        return bytes;
    }
    readHeader() {
        // Header starting block
        if (!this.recognizeStartingMark()) {
            throw "NO STARTING MARK recognized";
        }
        // MZT header
        const mztBytes = this.readDuplexBlocks(128);
        if (mztBytes == null) {
            throw "CANNOT READ MZT HEADER";
        }
        return new MZ_TapeHeader(mztBytes, 0);
    }
    readDataBlock(n) {
        // Data starting mark
        if (!this.recognizeStarting2Mark()) {
            throw "NO STARTING MARK 2 recognized";
        }
        // Read duplexed data bytes
        return this.readDuplexBlocks(n);
    }
    outputStartingMark() {
        let i;
        // START MARK
        for (i = 0; i < 11000; i++) {
            this.writeSignal(false);
        }
        for (i = 0; i < 40; i++) {
            this.writeSignal(true);
        }
        for (i = 0; i < 40; i++) {
            this.writeSignal(false);
        }
        this.writeSignal(true);
    }
    writeHeader(buffer) {
        this.outputStartingMark();
        this.writeDuplexBlock(buffer);
    }
    writeStarting2Mark() {
        let i;
        // Body mark
        for (i = 0; i < 2750; i++) {
            this.writeSignal(false);
        }
        for (i = 0; i < 20; i++) {
            this.writeSignal(true);
        }
        for (i = 0; i < 20; i++) {
            this.writeSignal(false);
        }
        this.writeSignal(true);
    }
    writeDataBlock(buffer) {
        // Data starting mark
        this.writeStarting2Mark();
        this.writeDuplexBlock(buffer);
    }
    static toBytes(bits) {
        try {
            const reader = new MZ_Tape(bits);
            const header = reader.readHeader();
            if (header == null) {
                throw "FAIL TO READ HEADER";
            }
            const body = reader.readDataBlock(header.fileSize);
            if (body == null) {
                throw "FAIL TO READ DATA";
            }
            const extra = [];
            let nonZeroRead = true;
            let extraByte;
            while (nonZeroRead) {
                extraByte = reader.readByte();
                nonZeroRead = (extraByte ? true : false);
                if (nonZeroRead) {
                    console.warn("MZ_Tape.toBytes rest bytes["
                        + extraByte.length + "] =", HEX(extraByte, 2));
                    extra.push(extraByte);
                }
            }
            // MZT + body
            return header.buffer.concat(body);
        }
        catch (err) {
            console.log("MZ_Tape.toBytes:Error " + err);
        }
        return [];
    }
    static fromBytes(bytes) {
        if (bytes.length < 128) {
            throw "FAIL TO WRITE HEADER";
        }
        const header = new MZ_TapeHeader(bytes.slice(0, 128), 0);
        const writer = new MZ_Tape([]);
        writer.writeHeader(header.buffer);
        writer.writeDataBlock(bytes.slice(128));
        return writer._tapeData;
    }
    static parseMZT(buf) {
        const sections = [];
        let offset = 0;
        while (offset + 128 <= buf.length) {
            const header = new MZ_TapeHeader(buf, offset);
            offset += 128;
            if(offset + header.fileSize > buf.length) {
                return null;
            }
            const bodyBuffer = [];
            for (let i = 0; i < header.fileSize; i++) {
                bodyBuffer.push(buf[offset + i]);
            }
            offset += header.fileSize;
            sections.push({
                "header": header,
                "body": {
                    "buffer": bodyBuffer
                }
            });
        }
        return sections;
    }
}
module.exports = MZ_Tape;
