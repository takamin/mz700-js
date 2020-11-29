/* tslint:disable: class-name */
/**
 * @fileoverview Z80 assembler class.
 */
import Z80LineAssembler from "./Z80-line-assembler";
import parseAddress from "../lib/parse-addr";

/**
 * Z80 Assembler
 * @class
 */
export default class Z80_assemble {
    /**
     * Assemble result lines
     * @type {object[]}
     */
    list:any[] = [];
    /**
     * mapping labels to address
     * @type {object}
     */
    label2value:any = {};

    /**
     * The list has ORG mnemonic, or not.
     * @type {boolean}
     */
    _explicitAddress:boolean;

    /**
     * A first address of this assembled codes.
     * @type {number}
     */
    minAddr:number = null;

    /**
     * A last address of this assembled codes.
     * @type {number}
     */
    maxAddr:number = null;

    /**
     * A binary code as assembling result.
     * @type {number[]}
     */
    buffer:number[] = null;

    /**
     * @constructor
     * @param {string} asmSource The source code
     * @param {boolean|undefined} assembleOnly
     * Set true not to resolve the addresses and create machine code.
     * @param {number} startAddr
     * The starting address of assembling.
     */
    constructor(asmSource, assembleOnly, startAddr) {

        if(asmSource === undefined) {
            return;
        }

        // Assemble the line by line
        let address = startAddr || 0;
        const sourceLines = asmSource.split(/\r{0,1}\n/);
        sourceLines.forEach( line => {
            const assembledCode = Z80LineAssembler.assemble(
                    line, address, this.label2value);
            address = assembledCode.getNextAddress();
            this.list.push(assembledCode);
        });

        this._explicitAddress = Z80_assemble.hasExplicitAddress(this.list);

        if(assembleOnly) { // Estimate the code size
            const range = Z80_assemble.measureCodeSize(this.list);
            this.minAddr = range.minAddr;
            this.maxAddr = range.minAddr;
        }

        if(!assembleOnly) {
            this.closeAssembling(this.label2value);
        }
    };

    /**
     * @returns {boolean} true if the source includes the ORG
     * pseudo mnemonic, otherwise false.
     */
    isAddressExplicit() {
        return this._explicitAddress;
    };


    /**
     * Check the list having ORG pseudo mnemonic.
     *
     * @param {Array<object>} assembleList
     * An array of line assembleled information.
     *
     * @returns {boolean} true the list includes ORG, otherwise false.
     */
    static hasExplicitAddress(assembleList) {
        for(const asm of assembleList) {
            if(asm.mnemonic === "ORG") {
                return true;
            }
        }
        return false;
    };

    /**
     * Resolve the relocatable addresses and create a machine code.
     *
     * @param {object} mapLabelToAddress
     * A dictionary to get address of the labels.
     *
     * @returns {undefined}
     */
    closeAssembling(mapLabelToAddress) {

        // Resolve address references
        Z80_assemble.resolveAddress(this.list, mapLabelToAddress);

        // Estimate the code size
        const range = Z80_assemble.measureCodeSize(this.list);
        this.minAddr = range.minAddr;
        this.maxAddr = range.minAddr;

        // Create machine code buffer
        this.buffer = Z80_assemble.createMachineCode(
            this.list, this.minAddr,
            this.maxAddr - this.minAddr + 1);
    };

    /**
     * Resolve the undetermined addresses in the assembled list.
     *
     * @param {Array<object>} assembleList
     * An array of line assembleled information.
     *
     * @param {object} mapLabelToAddress
     * A dictionary to get address of the labels.
     *
     * @returns {undefined}
     */
    static resolveAddress(assembleList, mapLabelToAddress) {
        assembleList.forEach( line => {
            line.resolveAddress(mapLabelToAddress);
        });
    };

    /**
     * Determine the addresses of first and last line.
     *
     * @param {Z80LineAssembler[]} assembleList
     * An array of line assembleled information.
     *
     * @returns {object} that has minAddr and maxAddr as keys.
     */
    static measureCodeSize(assembleList:Z80LineAssembler[]) {
        // address min-max
        let minAddr = null;
        let maxAddr = null;
        assembleList.forEach(line => {
            if(line.bytecode.length > 0) {
                if(minAddr == null || line.address < minAddr) {
                    minAddr = line.address;
                }
                const lastAddr = line.getLastAddress();
                if(maxAddr == null || lastAddr > maxAddr) {
                    maxAddr = lastAddr;
                }
            }
        });
        return {minAddr, maxAddr};
    };

    /**
     * Create machine code from the assemble list.
     *
     * @param {Z80LineAssembler[]} assembleList
     * An array of line assembleled information.
     *
     * @param {number} minAddr
     * The address of the first line of the list.
     *
     * @param {number} bytesize
     * The byte code size that simply determind from address.
     *
     * @returns {Array<number>} that contains Z80 machine code.
     */
    static createMachineCode(assembleList:Z80LineAssembler[], minAddr:number, bytesize:number) {
        const buffer = new Array(bytesize);
        assembleList.forEach(line => {
            if(line.bytecode.length > 0) {
                Array.prototype.splice.apply(buffer, [
                        line.address - minAddr,
                        line.bytecode.length
                    ].concat(line.bytecode));
            }
        });
        return buffer;
    };

    /**
     * Assemble the sources.
     *
     * @param {Array<string>} sources
     * Z80 assemble source
     *
     * @returns {object} as an assembled result.
     */
    static assemble(sources) {

        // Assemble each source
        const assembled = [];
        let startAddr = 0;
        let minAddr = null;
        let maxAddr = null;
        let lastAddr = null;
        sources.forEach( src => {
            const asm = new Z80_assemble(src, true, startAddr);
            if(minAddr == null || minAddr > asm.minAddr) {
                minAddr = asm.minAddr;
            }
            if(maxAddr == null || maxAddr < asm.maxAddr) {
                maxAddr = asm.maxAddr;
            }
            const lineLastAddr = asm.list.slice(-1)[0].getNextAddress() - 1;
            if(lastAddr == null || lastAddr < lineLastAddr) {
                lastAddr = lineLastAddr;
            }
            startAddr = lastAddr + 1;
            assembled.push(asm);
        });

        // Create an integrated address map
        const mapLabelToAddress = {};
        assembled.forEach( asm => {
            Object.keys(asm.label2value).forEach( label => {
                mapLabelToAddress[label] = asm.label2value[label];
            });
        });

        // Total code size
        assembled.forEach( asm => {
            asm.closeAssembling(mapLabelToAddress);
        });

        // Create machine code
        const buffer = new Array(lastAddr - minAddr + 1);
        for(let i = 0; i < buffer.length; i++) {
            buffer[i] = 0;
        }
        assembled.forEach(asm => {
            if(asm.buffer.length > 0) {
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
    };

    /**
     * Translate address string to value.
     * @param {string} addrToken
     * The address to be converted.
     * @returns {number} as the address.
     */
    parseAddress(addrToken) {
        return parseAddress.parseAddress(addrToken, this.label2value);
    };

    /**
     * Returns a address map list.
     *
     * @description
     * Each element of the list is an object that has two fields 'label' and 'address'.
     * The list is sorted by the address.
     *
     * @returns {object[]} array of address map entry
     */
    getMap() {
        return Z80_assemble.hashMapArray(this.label2value);
    };

    /**
     * Returns a address map list.
     *
     * @description
     * Each element of the list is an object that has two fields 'label' and 'address'.
     * The list is sorted by the address.
     *
     * @param {object} mapLabelToAddress
     * A dictionary to get address of the labels.
     *
     * @returns {object[]} array of address map entry
     */
    static hashMapArray(mapLabelToAddress) {
        return Object.keys(mapLabelToAddress).map(label => {
            return { "label": label, "address": mapLabelToAddress[label] };
        }).sort((a,b)=>{ return a.address - b.address; });
    };
}

module.exports = Z80_assemble;
