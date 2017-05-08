/* global getModule */
var Z80BinUtil = getModule("Z80BinUtil") || require("./bin-util.js");
var Z80LineAssembler = getModule("Z80LineAssembler") || require("./z80-line-assembler")
var Z80_assemble = function(asm_source) {
    var i;

    if(asm_source == undefined) {
        return;
    }

    //
    // Assemble
    //
    this.list = [];
    this.label2value = {};
    this.address = 0;

    var source_lines = asm_source.split(/\r{0,1}\n/);
    for(i = 0; i < source_lines.length; i++) {
        var assembled_code = new Z80LineAssembler(
                source_lines[i],
                this.address,
                this.label2value);
        this.address = assembled_code.getNextAddress();
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
        if("address" in line && "bytecode" in line && line.bytecode.length > 0) {
            if(min_addr == null || line.address < min_addr) {
                min_addr = line.address;
            }
            if(max_addr == null || line.address + line.bytecode.length - 1 > max_addr) {
                max_addr = line.address + line.bytecode.length - 1;
            }
        }
    });
    this.min_addr = min_addr;
    this.buffer = new Array(max_addr - min_addr + 1);
    this.list.forEach(function(line) {
        if("address" in line && "bytecode" in line && line.bytecode.length > 0) {
            Array.prototype.splice.apply(this.buffer,
                [line.address - min_addr, line.bytecode.length].concat(line.bytecode));
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

module.exports = Z80_assemble;
