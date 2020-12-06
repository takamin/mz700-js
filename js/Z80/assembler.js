"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Z80_line_assembler_1 = __importDefault(require("./Z80-line-assembler"));
const parse_addr_1 = __importDefault(require("../lib/parse-addr"));
class Z80_assemble {
    constructor(asmSource, assembleOnly, startAddr) {
        this.list = [];
        this.label2value = {};
        this.minAddr = null;
        this.maxAddr = null;
        this.buffer = null;
        if (asmSource === undefined) {
            return;
        }
        let address = startAddr || 0;
        const sourceLines = asmSource.split(/\r{0,1}\n/);
        sourceLines.forEach(line => {
            const assembledCode = Z80_line_assembler_1.default.assemble(line, address, this.label2value);
            address = assembledCode.getNextAddress();
            this.list.push(assembledCode);
        });
        this._explicitAddress = Z80_assemble.hasExplicitAddress(this.list);
        if (assembleOnly) {
            const range = Z80_assemble.measureCodeSize(this.list);
            this.minAddr = range.minAddr;
            this.maxAddr = range.minAddr;
        }
        if (!assembleOnly) {
            this.closeAssembling(this.label2value);
        }
    }
    isAddressExplicit() {
        return this._explicitAddress;
    }
    static hasExplicitAddress(assembleList) {
        for (const asm of assembleList) {
            if (asm.mnemonic === "ORG") {
                return true;
            }
        }
        return false;
    }
    closeAssembling(mapLabelToAddress) {
        Z80_assemble.resolveAddress(this.list, mapLabelToAddress);
        const range = Z80_assemble.measureCodeSize(this.list);
        this.minAddr = range.minAddr;
        this.maxAddr = range.minAddr;
        this.buffer = Z80_assemble.createMachineCode(this.list, this.minAddr, this.maxAddr - this.minAddr + 1);
    }
    static resolveAddress(assembleList, mapLabelToAddress) {
        assembleList.forEach(line => {
            line.resolveAddress(mapLabelToAddress);
        });
    }
    static measureCodeSize(assembleList) {
        let minAddr = null;
        let maxAddr = null;
        assembleList.forEach(line => {
            if (line.bytecode.length > 0) {
                if (minAddr == null || line.address < minAddr) {
                    minAddr = line.address;
                }
                const lastAddr = line.getLastAddress();
                if (maxAddr == null || lastAddr > maxAddr) {
                    maxAddr = lastAddr;
                }
            }
        });
        return { minAddr, maxAddr };
    }
    static createMachineCode(assembleList, minAddr, bytesize) {
        const buffer = new Array(bytesize);
        assembleList.forEach(line => {
            if (line.bytecode.length > 0) {
                Array.prototype.splice.apply(buffer, [
                    line.address - minAddr,
                    line.bytecode.length
                ].concat(line.bytecode));
            }
        });
        return buffer;
    }
    static assemble(sources) {
        const assembled = [];
        let startAddr = 0;
        let minAddr = null;
        let maxAddr = null;
        let lastAddr = null;
        sources.forEach(src => {
            const asm = new Z80_assemble(src, true, startAddr);
            if (minAddr == null || minAddr > asm.minAddr) {
                minAddr = asm.minAddr;
            }
            if (maxAddr == null || maxAddr < asm.maxAddr) {
                maxAddr = asm.maxAddr;
            }
            const lineLastAddr = asm.list.slice(-1)[0].getNextAddress() - 1;
            if (lastAddr == null || lastAddr < lineLastAddr) {
                lastAddr = lineLastAddr;
            }
            startAddr = lastAddr + 1;
            assembled.push(asm);
        });
        const mapLabelToAddress = {};
        assembled.forEach(asm => {
            Object.keys(asm.label2value).forEach(label => {
                mapLabelToAddress[label] = asm.label2value[label];
            });
        });
        assembled.forEach(asm => {
            asm.closeAssembling(mapLabelToAddress);
        });
        const buffer = new Array(lastAddr - minAddr + 1);
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = 0;
        }
        assembled.forEach(asm => {
            if (asm.buffer.length > 0) {
                const endAddr = asm.maxAddr + asm.buffer.length - 1;
                Array.prototype.splice.apply(buffer, [
                    asm.minAddr - minAddr,
                    endAddr - asm.minAddr + 1,
                ].concat(asm.buffer));
            }
        });
        return {
            obj: assembled,
            label2value: mapLabelToAddress,
            minAddr,
            maxAddr,
            buffer,
        };
    }
    parseAddress(addrToken) {
        return parse_addr_1.default.parseAddress(addrToken, this.label2value);
    }
    getMap() {
        return Z80_assemble.hashMapArray(this.label2value);
    }
    static hashMapArray(mapLabelToAddress) {
        return Object.keys(mapLabelToAddress).map(label => {
            return { label, address: mapLabelToAddress[label] };
        }).sort((a, b) => { return a.address - b.address; });
    }
}
exports.default = Z80_assemble;
module.exports = Z80_assemble;
//# sourceMappingURL=assembler.js.map