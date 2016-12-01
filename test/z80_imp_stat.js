var fs = require('fs');
eval(fs.readFileSync('../lib/ex_number.js')+'');
eval(fs.readFileSync('../Z80/emulator.js')+'');
eval(fs.readFileSync('../Z80/memory.js')+'');
eval(fs.readFileSync('../Z80/register.js')+'');
eval(fs.readFileSync('../Z80/assembler.js')+'');
var z80 = new Z80();
function get_hex_code(codes) {
    var a = [];
    codes.forEach(function(code) {
        a.push(code.HEX(2));
    });
    return a.join(" ");
}
var total = 0;
var nodasm = 0;
var noemu = 0;
var check_table = function (table, codes) {
    var code_list = [];
    var i = 0;
    table.forEach(function(def) {
        codes.push(i);
        if(def.mnemonic !== null) {
            var type = typeof(def.mnemonic);
            var strcode = "";
            var mnemonic = "";
            var implementOK = true;
            var errorMessages = [];
            switch(type) {
            case 'string':
                ++total;
                if(!def.proc) {
                    ++noemu;
                    errorMessages.push("NO EMULATOR");
                    implementOK = false;
                } else if(!def.disasm) {
                    ++nodasm;
                    errorMessages.push("NO DISASSEMBLER");
                    implementOK = false;
                } else if(def.proc && def.disasm) {
                    var asmDasmErrors = check_asm_dasm(codes);
                    if(asmDasmErrors !== 0) {
                        implementOK = false;
                        errorMessages = errorMessages.concat(asmDasmErrors);
                    }
                }
                strcode = (get_hex_code(codes) + "               ").substring(0, 12);
                mnemonic = (def.mnemonic + "                        ").substring(0, 18);
                var errmsg = "";
                if(errorMessages.length >= 1) {
                    errmsg = errorMessages[0];
                    errorMessages = errorMessages.slice(1);
                }
                console.log(strcode + mnemonic + (implementOK?"OK":"*** ") + errmsg);
                errorMessages.forEach(function(msg) {
                    console.log("    * " + msg);
                });
                code_list.push(codes.concat());
                break;
            case 'function':
                check_table(def.mnemonic(), codes).forEach(function(codes) {
                    code_list.push(codes.concat());
                });
                break;
            }
        }
        codes.pop(i);
        i++;
    });
    return code_list;
};
var errDisasm = 0;
var disasmUnsupported = 0;
var asmDasmMatch = 0;
var asmDasmNotMatch = 0;
var check_asm_dasm = function (codes) {
    var errorMessages = 0;
    var codes_src = codes.concat();
    codes_src.push(0x12,0x34,0x56,0x78);
    var swapcode = false;
    if(codes_src.length > 3
        && codes_src[0] == 0xDD && codes_src[1] == 0xCB
        || codes_src[0] == 0xFD && codes_src[1] == 0xCB)
    {
        swapcode = true;
        var tmp = codes_src[2];
        codes_src[2] = codes_src[3];
        codes_src[3] = tmp;
    }

    //
    // DISASSEMBLE
    //
    var addr = 0;
    for(var i = 0; i < codes_src.length; i++) {
        z80.memory.poke(addr + i, codes_src[i]);
    }
    var dis = z80.disassemble(addr);
    if(!dis) {
        ++errDisasm;
        errorMessages = ["Error on disassemble the code " + JSON.stringify(dis)];
    } else {
        var asm = dis.mnemonic[0] + " " + dis.mnemonic.slice(1).join(',');    

        //
        // ASSEMBLE
        //
        asm_result = new Z80_assemble(asm);
        codes_result = asm_result.list[0].bytecode;
        var match = true;
        for(var i = 0; i < codes_result.length; i++) {
            if(codes_result[i] != codes_src[i]) {
                match = false;
            }
        }

        if(asm.match(/UNKNOWN/)) {
            ++disasmUnsupported;
            errorMessages = ["DISASSEMBLE FAIL:",
                            codes_src.map(function(n) {
                                return Number.prototype.HEX.call(n, 2);
                            }).join(' '),
                            asm];
        } else if(!match) {
            //
            // SPECIAL CHECK FOR DUPLICATED INSTRUCTION
            //
            // 1. LD (nn),HL : [ 22 nL nH ] / [ ED 63 nL nH ]
            // 2. LD HL,(nn) : [ 2A nL nH ] / [ ED 6B nL nH ]
            //
            if(codes_src.length >= 4) {
                if(codes_src[0] == 0xED && codes_src[1] == 0x63) {
                    if(codes_result.length == 3
                            && codes_result[0] == 0x22
                            && codes_result[1] == codes_src[2]
                            && codes_result[2] == codes_src[3])
                    {
                        return [];
                    }
                }
                if(codes_src[0] == 0xED && codes_src[1] == 0x6B) {
                    if(codes_result.length == 3
                            && codes_result[0] == 0x2A
                            && codes_result[1] == codes_src[2]
                            && codes_result[2] == codes_src[3])
                    {
                        return [];
                    }
                }
            }

            ++asmDasmNotMatch;
            errorMessages = [
                "CODES UNMATCH MATCH: " + asm,
                "ORG: " + codes_src.slice(0, codes_result.length)
                    .map(function(n) {
                        return Number.prototype.HEX.call(n, 2);
                    }).join(' '),
                "ASM: " + codes_result.map(function(n) {
                        return Number.prototype.HEX.call(n, 2);
                    }).join(' ')];
        }
    }
    return errorMessages;
};
var all_the_codes = check_table(z80.opecodeTable, []);
/*
all_the_codes.forEach(function(codes) {
    check_asm_dasm(codes);
});
*/
console.log("----");
console.log("Total check count:", total);
console.log("Not emulated:", noemu);
console.log("Disassembler:");
console.log("  Not implemented:", nodasm);
console.log("  Unsupported    :", disasmUnsupported);
console.log("  Fail           :", errDisasm);
console.log("  Not correct    :", asmDasmNotMatch);
if(noemu > 0 || nodasm > 0 ||
        disasmUnsupported > 0 ||
        errDisasm > 0 ||
        asmDasmNotMatch > 0)
{
    process.exit(1);
}
