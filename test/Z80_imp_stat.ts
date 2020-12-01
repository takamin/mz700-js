const NumberUtil = require("../lib/number-util");
const Z80 = require('../Z80/Z80');
const Z80_assemble = require('../Z80/assembler');
const z80 = new Z80();
function get_hex_code(codes) {
    const a = [];
    codes.forEach(function(code) {
        a.push( NumberUtil.HEX(code, 2) );
    });
    return a.join(" ");
}
let total = 0;
let nodasm = 0;
let noemu = 0;
const check_table = function (table, codes) {
    const code_list = [];
    let i = 0;
    table.forEach(function(def) {
        codes.push(i);
        if(def.mnemonic !== null) {
            const type = typeof(def.mnemonic);
            let strcode = "";
            let mnemonic = "";
            let implementOK = true;
            let errorMessages = [];
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
                    const asmDasmErrors = check_asm_dasm(codes);
                    if(asmDasmErrors !== 0) {
                        implementOK = false;
                        errorMessages = errorMessages.concat(asmDasmErrors);
                    }
                }
                strcode = (get_hex_code(codes) + "               ").substring(0, 12);
                mnemonic = (def.mnemonic + "                        ").substring(0, 18);
                let errmsg = "";
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
let errDisasm = 0;
let disasmUnsupported = 0;
let asmDasmMatch = 0;
let asmDasmNotMatch = 0;
const check_asm_dasm = function (codes) {
    let errorMessages:any = 0;
    const codes_src = codes.concat();
    codes_src.push(0x12,0x34,0x56,0x78);
    let swapcode = false;
    if(codes_src.length > 3
        && codes_src[0] == 0xDD && codes_src[1] == 0xCB
        || codes_src[0] == 0xFD && codes_src[1] == 0xCB)
    {
        swapcode = true;
        const tmp = codes_src[2];
        codes_src[2] = codes_src[3];
        codes_src[3] = tmp;
    }

    //
    // DISASSEMBLE
    //
    let addr = 0;
    for(let i = 0; i < codes_src.length; i++) {
        z80.memory.poke(addr + i, codes_src[i]);
    }
    const dis = z80.disassemble(addr);
    if(!dis) {
        ++errDisasm;
        errorMessages = ["Error on disassemble the code " + JSON.stringify(dis)];
    } else {
        const asm = dis.mnemonic + " " + dis.operand;

        //
        // ASSEMBLE
        //
        const asm_result = Z80_assemble.assemble([asm]).obj[0];
        const codes_result = asm_result.list[0].bytecode;
        let match = true;
        for(let i = 0; i < codes_result.length; i++) {
            if(codes_result[i] != codes_src[i]) {
                match = false;
            }
        }

        if(asm.match(/UNKNOWN/)) {
            ++disasmUnsupported;
            errorMessages = ["DISASSEMBLE FAIL:",
                            codes_src.map(function(n) {
                                return NumberUtil.HEX(n, 2);
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
                        return NumberUtil.HEX(n, 2);
                    }).join(' '),
                "ASM: " + codes_result.map(function(n) {
                        return NumberUtil.HEX(n, 2);
                    }).join(' ')];
        }
    }
    return errorMessages;
};
const all_the_codes = check_table(z80.opecodeTable, []);
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
