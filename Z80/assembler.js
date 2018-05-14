/**
 * @fileoverview Z80 assembler class.
 */
var Z80LineAssembler = require("./z80-line-assembler");
const parseAddress = require("../lib/parse-addr.js");

/**
 * Z80 Assembler
 *
 * @constructor
 *
 * @param {string} asm_source The source code
 *
 * @param {boolean|undefined} assembleOnly
 * Set true not to resolve the addresses and create machine code.
 *
 * @param {number} startAddr
 * The starting address of assembling.
 */
var Z80_assemble = function(asm_source, assembleOnly, startAddr) {

    if(asm_source == undefined) {
        return;
    }

    /**
     * Assemble result lines
     * @type {object[]}
     */
    this.list = [];
    /**
     * mapping labels to address
     * @type {object}
     */
    this.label2value = {};

    // Assemble the line by line
    let address = startAddr || 0;
    let source_lines = asm_source.split(/\r{0,1}\n/);
    source_lines.forEach( line => {
        let assembled_code = Z80LineAssembler.assemble(
                line, address, this.label2value);
        address = assembled_code.getNextAddress();
        this.list.push(assembled_code);
    });

    /**
     * The list has ORG mnemonic, or not.
     * @type {boolean}
     */
    this._explicitAddress = Z80_assemble.hasExplicitAddress(this.list);

    /**
     * A first address of this assembled codes.
     * @type {number}
     */
    this.min_addr = null;

    /**
     * A last address of this assembled codes.
     * @type {number}
     */
    this.max_addr = null;

    if(assembleOnly) { // Estimate the code size
        let range = Z80_assemble.measureCodeSize(this.list);
        this.min_addr = range.min_addr;
        this.max_addr = range.min_addr;
    }

    /**
     * A binary code as assembling result.
     * @type {number[]}
     */
    this.buffer = null;

    if(!assembleOnly) {
        this.closeAssembling(this.label2value);
    }
};

/**
 * @returns {boolean} true if the source includes the ORG
 * pseudo mnemonic, otherwise false.
 */
Z80_assemble.prototype.isAddressExplicit = function() {
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
Z80_assemble.hasExplicitAddress = function(assembleList) {
    for(let i = 0; i < assembleList.length; i++) {
        if(assembleList[i].mnemonic === "ORG") {
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
Z80_assemble.prototype.closeAssembling = function(mapLabelToAddress) {

    // Resolve address references
    Z80_assemble.resolveAddress(this.list, mapLabelToAddress);

    // Estimate the code size
    let range = Z80_assemble.measureCodeSize(this.list);
    this.min_addr = range.min_addr;
    this.max_addr = range.min_addr;

    // Create machine code buffer
    this.buffer = Z80_assemble.createMachineCode(
        this.list, this.min_addr,
        this.max_addr - this.min_addr + 1);
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
Z80_assemble.resolveAddress = function(assembleList, mapLabelToAddress) {
    assembleList.forEach( line => {
        line.resolveAddress(mapLabelToAddress);
    });
};

/**
 * Determine the addresses of first and last line.
 *
 * @param {Array<object>} assembleList
 * An array of line assembleled information.
 *
 * @returns {object} that has min_addr and max_addr as keys.
 */
Z80_assemble.measureCodeSize = function(assembleList) {
    // address min-max
    let min_addr = null;
    let max_addr = null;
    assembleList.forEach(line => {
        if(line.bytecode.length > 0) {
            if(min_addr == null || line.address < min_addr) {
                min_addr = line.address;
            }
            let lastAddr = line.getLastAddress();
            if(max_addr == null || lastAddr > max_addr) {
                max_addr = lastAddr;
            }
        }
    });
    return {
        min_addr: min_addr,
        max_addr: max_addr,
    };
};

/**
 * Create machine code from the assemble list.
 *
 * @param {Array<object>} assembleList
 * An array of line assembleled information.
 *
 * @param {number} min_addr
 * The address of the first line of the list.
 *
 * @param {number} bytesize
 * The byte code size that simply determind from address.
 *
 * @returns {Array<number>} that contains Z80 machine code.
 */
Z80_assemble.createMachineCode = function(assembleList, min_addr, bytesize) {
    let buffer = new Array(bytesize);
    assembleList.forEach(line => {
        if(line.bytecode.length > 0) {
            Array.prototype.splice.apply(buffer, [
                    line.address - min_addr,
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
Z80_assemble.assemble = function(sources) {

    // Assemble each source
    let assembled = [];
    let startAddr = 0;
    let min_addr = null;
    let max_addr = null;
    let lastAddr = null;
    sources.forEach( src => {
        let asm = new Z80_assemble(src, true, startAddr);
        if(min_addr == null || min_addr > asm.min_addr) {
            min_addr = asm.min_addr;
        }
        if(max_addr == null || max_addr < asm.max_addr) {
            max_addr = asm.max_addr;
        }
        let lineLastAddr = asm.list.slice(-1)[0].getNextAddress() - 1;
        if(lastAddr == null || lastAddr < lineLastAddr) {
            lastAddr = lineLastAddr;
        }
        startAddr = lastAddr + 1;
        assembled.push(asm);
    });

    // Create an integrated address map
    let mapLabelToAddress = {};
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
    let buffer = new Array(lastAddr - min_addr + 1);
    for(let i = 0; i < buffer.length; i++) {
        buffer[i] = 0;
    }
    assembled.forEach(asm => {
        if(asm.buffer.length > 0) {
            let last_addr = asm.max_addr + asm.buffer.length - 1;
            Array.prototype.splice.apply(buffer, [
                    asm.min_addr - min_addr,
                    last_addr - asm.min_addr + 1,
                ].concat(asm.buffer));
        }
    });

    return {
        obj: assembled,
        label2value: mapLabelToAddress,
        min_addr: min_addr,
        max_addr: max_addr,
        buffer: buffer,
    };
};

/**
 * Translate address string to value.
 * @param {string} addrToken
 * The address to be converted.
 * @returns {number} as the address.
 */
Z80_assemble.prototype.parseAddress = function(addrToken) {
    return parseAddress(addrToken, this.label2value);
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
Z80_assemble.prototype.getMap = function() {
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
Z80_assemble.hashMapArray = function(mapLabelToAddress) {
    return Object.keys(mapLabelToAddress).map(label => {
        return { "label": label, "address": mapLabelToAddress[label] };
    }).sort((a,b)=>{ return a.address - b.address; });
};

module.exports = Z80_assemble;
