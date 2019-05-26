var Z80_assemble = require('../Z80/assembler');
function Z80Tester() {  }
Z80Tester.prototype.runMnemonics = function(Z80cpu, mnemonics) {
    var stadr = null;
    mnemonics.forEach(function(mnemonic) {
        var asm = Z80_assemble.assemble([mnemonic]).obj[0];
        asm.list.forEach(function(line) {
            if("bytecode" in line && line.bytecode.length > 0) {
                var addr = line.address;
                if(stadr == null) {
                    stadr = addr;   
                }
                line.bytecode.forEach(function(mcode) {
                    Z80cpu.memory.poke(addr++, mcode);
                });
            }
        });
    });
    if(stadr != null) {
        Z80cpu.reg.PC = stadr;
        try {
            while(true) {
                Z80cpu.exec();
                if(Z80cpu.reg.PC != stadr) {
                    break;
                }
            }
        } catch(e) {
            console.log("*** exception:" + e + ", code:" + mnemonics.join('/'));
        }
    } else {
        console.error("*** could not assemble code:" + mnemonics.join('/'));
    }
};
module.exports = Z80Tester;
