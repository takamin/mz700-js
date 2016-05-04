var fs = require('fs');
eval(fs.readFileSync('../lib/ex_number.js')+'');
eval(fs.readFileSync('../Z80/emulator.js')+'');
eval(fs.readFileSync('../Z80/memory.js')+'');
eval(fs.readFileSync('../Z80/register.js')+'');
eval(fs.readFileSync('../Z80/assembler.js')+'');
function Z80Tester() {  }
Z80Tester.prototype.runMnemonics = function(Z80, mnemonics) {
    var stadr = null;
    for(var i = 0; i < mnemonics.length; i++) {
        var asm = new Z80_assemble(mnemonics[i]);
        asm.list.forEach((function(Z80) { return function(line) {
            if("bytecode" in line && line.bytecode.length > 0) {
                var addr = line.address;
                if(stadr == null) {
                    stadr = addr;   
                }
                line.bytecode.forEach(function(mcode) {
                    Z80.memory.poke(addr++, mcode);
                });
            }
        };}(Z80)));
    }
    if(stadr != null) {
        Z80.reg.PC = stadr;
        try {
            while(true) {
                Z80.exec();
                if(Z80.reg.PC != stadr) {
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
