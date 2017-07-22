/**
 * @fileoverview Z80 assembler class.
 */
var Z80BinUtil = require("./bin-util.js");
var Z80LineAssembler = require("./z80-line-assembler");

/**
 * Z80 Assembler
 *
 * @param {string} asm_source The source code
 * @constructor
 */
var Z80_assemble = function(asm_source) {
    var i;

    if(asm_source == undefined) {
        return;
    }

    //
    // Assemble
    //

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

    var address = 0;

    var source_lines = asm_source.split(/\r{0,1}\n/);
    for(i = 0; i < source_lines.length; i++) {
        var assembled_code = Z80LineAssembler.assemble(
                source_lines[i], address, this.label2value);
        address = assembled_code.getNextAddress();
        this.list.push(assembled_code);
    }

    //
    // Resolve address symbols
    //
    for(i = 0; i < this.list.length; i++) {
        this.list[i].resolveAddress(this.label2value);
    }

    //
    // Create machine code array
    //

    // address min-max
    var min_addr = null;
    var max_addr = null;
    this.list.forEach(function(line) {
        if(line.bytecode.length > 0) {
            if(min_addr == null || line.address < min_addr) {
                min_addr = line.address;
            }
            var lastAddr = line.getLastAddress();
            if(max_addr == null || lastAddr > max_addr) {
                max_addr = lastAddr;
            }
        }
    });

    /**
     * A starting address of this assembled codes.
     * @type {number}
     */
    this.min_addr = min_addr;

    /**
     * A binary code as assembling result.
     * @type {number[]}
     */
    this.buffer = new Array(max_addr - min_addr + 1);
    this.list.forEach(function(line) {
        if(line.bytecode.length > 0) {
            Array.prototype.splice.apply(this.buffer, [
                    line.address - min_addr,
                    line.bytecode.length
                ].concat(line.bytecode));
        }
    }, this);
};

Z80_assemble.prototype.parseAddress = function(addrToken) {
    var bytes = Z80LineAssembler.parseNumLiteralPair(addrToken);
    if(bytes == null) {
        return null;
    }
    var H = bytes[1]; if(typeof(H) == 'function') { H = H(this.label2value); }
    var L = bytes[0]; if(typeof(L) == 'function') { L = L(this.label2value); }
    var addr = Z80BinUtil.pair(H,L);
    return addr;
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
    return Object.keys(this.label2value).map(function(label) {
        return { "label": label, "address": this.label2value[label] };
    }, this).sort(function(a,b){ return a.address - b.address; });
};

module.exports = Z80_assemble;
