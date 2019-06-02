"use strict";
import NumberUtil from "../lib/number-util";
import oct from "../lib/oct";
import mz700charcode from "../lib/mz700-charcode";
import parseAddress from "../lib/parse-addr";

/**
 * Z80 assembled line class.
 * Assemble one line source code.
 */
export default class Z80LineAssembler {

    /**
     * Code starting address
     * @type {number}
     */
    address:number = null;

    /**
     * Z80 machine codes
     * @type {number[]}
     */
    bytecode:Array<any> = [];

    /**
     * Attached label
     * @type {string}
     */
    label:string = null;

    /**
     * Z80 mnemonic
     * @type {string}
     */
    mnemonic:string = null;

    /**
     * operand for mnemonic
     * @type {string}
     */
    operand:string = null;

    /**
     * Comment for this line
     * @type {string}
     */
    comment:string = "";

    /**
     * The address that may be jumped or called to
     * @type {number|null}
     */
    ref_addr_to:number =  null;

    /**
     * Referenced count of this address as a distination of the instructions JP, JR, or CALL.
     * @type {number}
     */
    referenced_count:number = 0;

    /**
     * Set address.
     * @param {number} address starting address of this code
     * @returns {undefined}
     */
    setAddress(address:number):void {
        this.address = address;
    };

    /**
     * Set referencing address.
     * @param {number|null} ref_addr_to starting address of this code
     * @returns {undefined}
     */
    setRefAddrTo(ref_addr_to:number):void {
        this.ref_addr_to = ref_addr_to;
    };

    /**
     * Set label for address.
     * @param {string|null} label   A label to be set or remove by null
     * @returns {undefined}
     */
    setLabel(label:string):void {
        this.label = label;
    };

    /**
     * Set comment
     * @param {string} comment comment string.
     * @returns {undefined}
     */
    setComment(comment:string):void {
        this.address = this.address || 0;
        this.comment = comment;
    };

    /**
     * Next starting address of this line.
     * @returns {number} Address.
     */
    getNextAddress():number {
        return this.address + this.bytecode.length;
    };

    /**
     * Last address of the binary codes.
     * @returns {number} Address.
     */
    getLastAddress():number {
        return this.address + this.bytecode.length - 1;
    };

    /**
     * Use a space as a delimiter for operands when the delimiter does not exist.
     *
     * @param {string[]} src_operand
     * The array of operand or delimitor.
     *
     * @returns {string} The representation of the operand as string.
     */
    static joinOperand(src_operand) {
        let dst_operand = [];
        let delimiterPushed = true;
        src_operand.forEach(element => {
            if(element === ",") {
                dst_operand.push(element);
                delimiterPushed = true;
            } else {
                if(!delimiterPushed) {
                    dst_operand.push(" ");
                }
                dst_operand.push(element);
                delimiterPushed = false;
            }
        });
        return dst_operand.join("");
    }

    /**
     * Convert the operand of the DEFB pseudo mnemonic to bytecodes.
     * @param {string[]} operand The operand.
     * @param {object} dictionary The label definition.
     * @returns {number[]} converted.
     */
    static getBytecodesFromOperandOfDEFB(operand, dictionary) {
        let code = [];
        operand.forEach(element => {
            if(element !== ",") {
                if(element.match(/^[0-9]/) || element.match(/^[1-9A-F][0-9A-F]*H$/i)) {
                    code.push(parseAddress.parseNumLiteral(element));
                } else {
                    let strcode = null;
                    switch(element.charAt(0)) {
                        case "'": case "\"":
                            strcode = Z80LineAssembler.convertToAsciiCode(
                                element.substring(1, element.length - 1), true);
                            break;
                        case "`":
                            strcode = Z80LineAssembler.convertToAsciiCode(
                                element.substring(1, element.length - 1), false);
                            break;
                        default:
                            if(element in dictionary) {
                                let deref = dictionary[element];
                                if(deref >= 256) {
                                    throw new Error(
                                        ["The character code exceeds the maximum",
                                        "value of 8 bit with the label", element,
                                        "(", "0x" + NumberUtil.HEX(deref, 4) , ")"].join(" "));
                                }
                                strcode = [deref];
                            } else {
                                throw new Error([
                                    "Fatal: Unrecognized operand for DEFB.", element
                                ].join(" "));
                            }
                    }
                    Array.prototype.push.apply(code, strcode);
                }
            }
        });
        return code;
    };

    /**
     * Convert string token to character code for MZ-700.
     *
     * @param {string} str
     * The source string representation.
     *
     * @param {boolean} ascii
     * Optional flag to get ASCII code(default: true).
     * If false is specified, This function returns MZ-700's display code. 
     *
     * @returns {number[]}
     * An array of a character code converted.
     */
    static convertToAsciiCode(str, ascii) {
        let asciicodes = [];
        let i = 0;
        for(;i < str.length;) {
            let c = str.charAt(i++);
            if(c === "\\") {
                c = str.charAt(i++);
                switch(c) {
                    case "0": case "1": case "2": case "3":
                    case "4": case "5": case "6": case "7":
                        {
                            let octstr = c + str.substr(i, 2);
                            if(octstr.length < 3) {
                                throw new Error([
                                    "Unexpected termination at a octal",
                                    "character code sequence",
                                    "at column", (i - 1), "in", str
                                ].join(" "));
                            } else if(!octstr.match(/^[0-7]+$/)) {
                                throw new Error([
                                    "No octal character exists at column",
                                    (i - 1), "in", str].join(" "));
                            } else {
                                let code = oct(octstr);
                                if(code >= 256) {
                                    throw new Error([
                                        "The character code exceeds the maximum",
                                        "value of 8 bit at", i, "in", str].join(" "));
                                }
                                i += 2;
                                asciicodes.push(code);
                            }
                        }
                        break;
                    case "x":
                        {
                            let hexstr = str.substr(i).replace(/^([0-9a-fA-F]*).*$/, "$1");
                            if(hexstr.length === 0) {
                                throw new Error([
                                    "Unexpected termination at a hex",
                                    "character code sequence",
                                    "at column", (i - 1), "in", str].join(" "));
                            }
                            let code = parseInt(hexstr, 16);
                            if(code >= 256) {
                                throw new Error([
                                    "The character code exeed 8 bit",
                                    "length at", i, "in", str].join(" "));
                            }
                            i += hexstr.length;
                            asciicodes.push(code);
                        }
                        break;
                    default:
                        if(ascii) {
                            switch(c) {
                                case "r":   //[CR]
                                    asciicodes.push("\r".charCodeAt(0));
                                    break;
                                default:
                                    asciicodes.push(c.charCodeAt(0));
                                    break;
                            }
                        } else {
                            asciicodes.push(
                                mz700charcode.ascii2dispcode[c.charCodeAt(0)]);
                        }
                        break;
                }
            } else {
                if(ascii) {
                    asciicodes.push(c.charCodeAt(0));
                } else {
                    asciicodes.push(mz700charcode.ascii2dispcode[c.charCodeAt(0)]);
                }
            }
        }
        return asciicodes;
    };

    /**
     * Create Z80 assembler instruction code line.
     *
     * @param {string}          mnemonic    Mnemonic.
     * @param {string|null}     operand     Operand for mnemonic.
     * @param {number[]|null}   machineCode Machine codes.
     *
     * @returns {Z80LineAssembler} assembled line object
     */
    static create(mnemonic:string, operand?:string, machineCode?:Array<number>) {
        var asmline = new Z80LineAssembler();
        asmline.mnemonic = mnemonic;
        asmline.operand = operand || "";
        asmline.bytecode = machineCode || [];
        return asmline;
    };

    static assemble(source, address, dictionary) {
        var asmline = new Z80LineAssembler();
        asmline.address = address;

        var tokens = Z80LineAssembler.tokenize(source);

        var found_label = -1;
        var found_comment = -1;
        for(var j = 0; j < tokens.length; j++) {
            switch(tokens[j]) {
                case ':':
                    if(found_label < 0 && found_comment < 0) {
                        found_label = j;
                    }
                    break;
                case ';':
                    if(found_comment < 0) {
                        found_comment = j;
                    }
                    break;
            }
        }
        if(found_label >= 0) {
            asmline.label = tokens.slice(0, found_label).join('');
            tokens.splice(0, found_label + 1);
            found_comment -= (found_label + 1);
        }
        if(found_comment >= 0) {
            asmline.comment = tokens.slice(found_comment).join('');
            tokens.splice(found_comment);
        }
        if(tokens.length > 0) {
            asmline.mnemonic = tokens[0];
            asmline.operand = Z80LineAssembler.joinOperand(tokens.slice(1));
        }
        if(tokens.length > 0) {
            try {
                asmline.bytecode = asmline.assembleMnemonic(tokens, dictionary);
            } catch(e) {
                asmline.comment += "*** ASSEMBLE ERROR - " + e;
            }
        }
        return asmline;
    };

    static tokenize(line) {
        var LEX_IDLE=0;
        var LEX_NUMBER=2;
        var LEX_IDENT=3;
        var LEX_CHAR=4;
        var currstat = LEX_IDLE;
        var L = line.length;
        var i = 0;
        var toks = [];
        var tok = '';
        while(i < L) {
            var ch = line.charAt(i);
            switch(currstat) {
                case LEX_IDLE:
                    if(/\s/.test(ch)) {
                        i++;
                    } else {
                        if(ch == '-' || ch =='+') {
                            tok += ch;
                            i++;
                            currstat = LEX_NUMBER;
                        } else if(/[0-9]/.test(ch)) {
                            currstat = LEX_NUMBER;
                        }
                        else if(/[A-Z_?.*#!$]/i.test(ch)) {
                            tok += ch;
                            i++;
                            currstat = LEX_IDENT;
                        }
                        else if(ch === "'" || ch === "\"" || ch === "`") {
                            tok += ch;
                            i++;
                            currstat = LEX_CHAR;
                        }
                        else if( ch == '(' || ch == ')' || ch == ',' || ch == '+' || ch == ':') {
                            toks.push(ch);
                            i++;
                        }
                        else if( ch == ';') {
                            toks.push(ch);
                            i++;
                            var comment = line.substr(i);
                            toks.push(comment);
                            i += comment.length;
                            tok = '';
                        }
                        else {
                            throw 'unrecognized char ' + ch + ' at column ' + i;
                        }
                    }
                    break;
                case LEX_NUMBER:
                    if(/[0-9A-F]/i.test(ch)) {
                        tok += ch;
                        i++;
                    } else if(/H/i.test(ch)) {
                        tok += ch;
                        i++;
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    } else {
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    break;
                case LEX_IDENT:
                    if(/[A-Z_0-9?.*#!$']/i.test(ch)) {
                        tok += ch;
                        i++;
                    } else {
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    break;
                case LEX_CHAR:
                    if(ch == "\\") {
                        ++i;
                        if(i < L) {
                            ch = line.charAt(i);
                            tok += "\\" + ch;
                            i++;
                        }
                    } else if(ch != tok.charAt(0)) {
                        tok += ch;
                        i++;
                    } else {
                        tok += ch;
                        i++;
                        toks.push(tok);
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    break;
                default:
                    throw 'unrecognized status ';
            } 
        }
        if(tok != '') {
            toks.push(tok.toUpperCase());
        }
        return toks;
    };

    /**
     * Resolve the address if it was referenced by a label.
     * @param {object} dictionary   A label to address map.
     * @returns {undefined}
     */
    resolveAddress(dictionary)
    {
        for(var j = 0; j < this.bytecode.length; j++) {
            if(typeof(this.bytecode[j]) == 'function') {
                this.bytecode[j] = this.bytecode[j](dictionary);
            }
        }
    };

    assembleMnemonic(toks, dictionary) {
        var label = this.label;
        //
        // Pseudo Instruction
        //
        if(match_token(toks,['ORG', null])) {
            this.address = parseAddress._parseNumLiteral(toks[1]);
            return [];
        }
        if(match_token(toks,['ENT'])) {
            dictionary[label] = this.address;
            return [];
        }
        if(match_token(toks,['EQU', null])) {
            if(label == null || label == "") {
                throw "empty label for EQU";
            }
            dictionary[label] = parseAddress._parseNumLiteral(toks[1]);
            return [];
        }
        if(match_token(toks,['DEFB', null], true)) {
            return Z80LineAssembler.getBytecodesFromOperandOfDEFB(
                toks.slice(1), dictionary);
        }
        if(match_token(toks,['DEFW', null])) {
            return parseAddress.parseNumLiteralPair(toks[1]);
        }
        if(match_token(toks,['DEFS', null])) {
            var n = parseAddress._parseNumLiteral(toks[1]);
            if(n < 0) {
                throw "negative DEFS number " + toks[1];
            }
            var zeros = [];
            for(var i = 0; i < n; i++) {
                zeros.push(0);
            }
            return zeros;
        }
        //=================================================================================
        //
        // 8bit load group
        //
        //=================================================================================
        if(match_token(toks,['LD', 'A', ',', 'I'])) { return [oct("0355"), oct("0127")]; }
        if(match_token(toks,['LD', 'A', ',', 'R'])) { return [oct("0355"), oct("0137")]; }
        if(match_token(toks,['LD', 'I', ',', 'A'])) { return [oct("0355"), oct("0107")]; }
        if(match_token(toks,['LD', 'R', ',', 'A'])) { return [oct("0355"), oct("0117")]; }
        //=================================================================================
        // Undefined instruction
        //=================================================================================
        if(match_token(toks,['LD', 'B', ',', 'IXH'])) {
            return [0xdd, 0x44];
        }
        if(match_token(toks,['LD', 'C', ',', 'IXL'])) {
            return [0xdd, 0x4d];
        }
        if(match_token(toks,['LD', 'A', ',', 'IXL'])) {
            return [0xdd, 0x7d];
        }
        if(match_token(toks,['ADD', 'A', ',', 'IXH'])) {
            return [0xdd, 0x84];
        }
        if(match_token(toks,['ADD', 'A', ',', 'IXL'])) {
            return [0xdd, 0x85];
        }
        if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', /^[BCDEHLA]$/])) {
            var dst_r = get8bitRegId(toks[1]);
            var src_r = get8bitRegId(toks[3]);
            return [oct("0100") | (dst_r << 3) | (src_r) << 0];
        }
        if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', null])) {
            return (function() {
                var r = get8bitRegId(toks[1]);
                var n = parseAddress.parseNumLiteral(toks[3]);
                return [oct("0006") | (r << 3), n];
            }());
        }
        if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(','HL',')'])) {
            return (function() {
                var r = get8bitRegId(toks[1]);
                return [oct("0106") | (r << 3)];
            }());
        }
        if(match_token(toks,['LD', '(','HL',')', ',', /^[BCDEHLA]$/])) {
            return (function() {
                var r = get8bitRegId(toks[5]);
                return [oct("0160") | r];
            }());
        }
        if(match_token(toks,['LD', '(','HL',')', ',', null])) {
            return (function() {
                var n = parseAddress.parseNumLiteral(toks[5]);
                return [oct("0066"), n];
            }());
        }
        if(match_token(toks,['LD', 'A', ',', '(', /^(BC|DE)$/, ')'])) {
            return (function() {
                var dd = get16bitRegId_dd(toks[4]);
                return [oct("0012") | (dd << 4)];
            }());
        }
        if(match_token(toks,['LD', 'A', ',', '(', null, ')'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[4]);
                return [oct("0072"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', '(', /^(BC|DE)$/, ')', ',', 'A'])) {
            return (function() {
                var dd = get16bitRegId_dd(toks[2]);
                return [oct("0002") | (dd << 4)];
            }());
        }
        if(match_token(toks,['LD', '(', null, ')', ',', 'A'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[2]);
                return [oct("0062"), n[0], n[1]];
            }());
        }
        //=================================================================================
        //
        // 16bit load group
        //
        //=================================================================================
        if(match_token(toks,['LD', 'SP', ',', 'HL'])) { return [oct("0371")]; }
        if(match_token(toks,['LD', 'SP', ',', 'IX'])) { return [0xDD, 0xF9]; }
        if(match_token(toks,['LD', 'SP', ',', 'IY'])) { return [0xfd, 0xF9]; }
        if(match_token(toks,['LD', /^(BC|DE|HL|SP)$/, ',', null])) {
            return (function() {
                var dd = get16bitRegId_dd(toks[1]);
                var n = parseAddress.parseNumLiteralPair(toks[3]);
                return [oct("0001") | (dd << 4), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', 'HL', ',', '(', null, ')'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[4]);
                return [oct("0052"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', 'BC', ',', '(', null, ')'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[4]);
                return [oct("0355"), oct("0113"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', 'DE', ',', '(', null, ')'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[4]);
                return [oct("0355"), oct("0133"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', 'SP', ',', '(', null, ')'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[4]);
                return [oct("0355"), oct("0173"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', '(', null, ')', ',', 'HL'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[2]);
                return [oct("0042"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', '(', null, ')', ',', 'BC'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[2]);
                return [oct("0355"), oct("0103"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', '(', null, ')', ',', 'DE'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[2]);
                return [oct("0355"), oct("0123"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['LD', '(', null, ')', ',', 'SP'])) {
            return (function() {
                var n = parseAddress.parseNumLiteralPair(toks[2]);
                return [oct("0355"), oct("0163"), n[0], n[1]];
            }());
        }
        if(match_token(toks,['PUSH', /^(BC|DE|HL|AF)$/])) {
            return (function() {
                var qq = get16bitRegId_qq(toks[1]);
                return [oct("0305") | (qq << 4)];
            }());
        }
        if(match_token(toks,['POP', /^(BC|DE|HL|AF)$/])) {
            return (function() {
                var qq = get16bitRegId_qq(toks[1]);
                return [oct("0301") | (qq << 4)];
            }());
        }
        //=================================================================================
        // Undefined instruction
        //=================================================================================
        if(match_token(toks,['LD', 'IXH', ',', 'B'])) {
            return [0xdd, 0x60];
        }
        if(match_token(toks,['LD', 'IXL', ',', 'C'])) {
            return [0xdd, 0x69];
        }
        if(match_token(toks,['LD', 'IXH', ',', 'A'])) {
            return [0xdd, 0x67];
        }
        if(match_token(toks,['LD', 'IXL', ',', 'A'])) {
            return [0xdd, 0x6f];
        }
        if(match_token(toks,['CP', 'IXL'])) {
            return [0xdd, 0xbd];
        }
        //=================================================================================
        //
        // エクスチェンジグループ、ブロック転送および、サーチグループ
        //
        //=================================================================================
        if(match_token(toks,['EX', 'DE', ',', 'HL'])) { return [0xEB]; }
        if(match_token(toks,['EX', 'AF', ',', "AF'"])) { return [0x08]; }
        if(match_token(toks,['EXX'])) { return [0xD9]; }
        if(match_token(toks,['EX', '(', 'SP', ')', ',', 'HL'])) { return [0xE3]; }
        if(match_token(toks,['LDI']))   { return [oct("0355"),oct("0240")]; }
        if(match_token(toks,['LDIR']))  { return [oct("0355"),oct("0260")]; }
        if(match_token(toks,['LDD']))   { return [oct("0355"),oct("0250")]; }
        if(match_token(toks,['LDDR']))  { return [oct("0355"),oct("0270")]; }
        if(match_token(toks,['CPI']))   { return [oct("0355"),oct("0241")]; }
        if(match_token(toks,['CPIR']))  { return [oct("0355"),oct("0261")]; }
        if(match_token(toks,['CPD']))   { return [oct("0355"),oct("0251")]; }
        if(match_token(toks,['CPDR']))  { return [oct("0355"),oct("0271")]; }
        
        //=================================================================================
        // 一般目的の演算、及びCPUコントロールグループ
        //=================================================================================
        if(match_token(toks,['DAA']))   { return [oct("0047")]; }
        if(match_token(toks,['CPL']))   { return [oct("0057")]; }
        if(match_token(toks,['NEG']))   { return [oct("0355"),oct("0104")]; }
        if(match_token(toks,['CCF']))   { return [oct("0077")]; }
        if(match_token(toks,['SCF']))   { return [oct("0067")]; }
        if(match_token(toks,['NOP']))   { return [oct("0000")]; }
        if(match_token(toks,['HALT']))  { return [oct("0166")]; }
        if(match_token(toks,['DI']))    { return [oct("0363")]; }
        if(match_token(toks,['EI']))    { return [oct("0373")]; }
        if(match_token(toks,['IM0']))   { return [oct("0355"),oct("0106")]; }
        if(match_token(toks,['IM1']))   { return [oct("0355"),oct("0126")]; }
        if(match_token(toks,['IM2']))   { return [oct("0355"),oct("0136")]; }
        if(match_token(toks,['IM','0']))   { return [oct("0355"),oct("0106")]; }
        if(match_token(toks,['IM','1']))   { return [oct("0355"),oct("0126")]; }
        if(match_token(toks,['IM','2']))   { return [oct("0355"),oct("0136")]; }

        //=================================================================================
        // 16ビット演算グループ
        //=================================================================================
        if(match_token(toks,[/^(ADD|ADC|SBC)$/, 'HL', ',', /^(BC|DE|HL|SP)$/]))   {
            var ss = 0;
            switch(toks[3]) {
                case 'BC': ss = 0; break;
                case 'DE': ss = 1; break;
                case 'HL': ss = 2; break;
                case 'SP': ss = 3; break;
            }
            switch(toks[0]) {
                case 'ADD': return [oct("0011") | (ss << 4)];
                case 'ADC': return [oct("0355"), oct("0112") | (ss << 4)];
                case 'SBC': return [oct("0355"), oct("0102") | (ss << 4)];
            }
            return [];
        }
        if(match_token(toks,['ADD', 'IX', ',', /^(BC|DE|IX|SP)$/]))   {
            switch(toks[3]) {
                case 'BC': return [oct("0335"), oct("0011")];
                case 'DE': return [oct("0335"), oct("0031")];
                case 'IX': return [oct("0335"), oct("0051")];
                case 'SP': return [oct("0335"), oct("0071")];
            }
            return [];
        }
        if(match_token(toks,['ADD', 'IY', ',', /^(BC|DE|IY|SP)$/]))   {
            switch(toks[3]) {
                case 'BC': return [oct("0375"), oct("0011")];
                case 'DE': return [oct("0375"), oct("0031")];
                case 'IY': return [oct("0375"), oct("0051")];
                case 'SP': return [oct("0375"), oct("0071")];
            }
            return [];
        }
        if(match_token(toks,[/^(INC|DEC)$/, /^(BC|DE|HL|SP|IX|IY)$/]))   {
            switch(toks[0]) {
                case 'INC':
                    switch(toks[1]) {
                        case 'BC': return [oct("0003")];
                        case 'DE': return [oct("0023")];
                        case 'HL': return [oct("0043")];
                        case 'SP': return [oct("0063")];
                        case 'IX': return [oct("0335"),oct("0043")];
                        case 'IY': return [oct("0375"),oct("0043")];
                    }
                    break;
                case 'DEC':
                    switch(toks[1]) {
                        case 'BC': return [oct("0013")];
                        case 'DE': return [oct("0033")];
                        case 'HL': return [oct("0053")];
                        case 'SP': return [oct("0073")];
                        case 'IX': return [oct("0335"),oct("0053")];
                        case 'IY': return [oct("0375"),oct("0053")];
                    }
                    break;
            }
            return [];
        }

        //=================================================================================
        // ローテイト・シフトグループ
        //=================================================================================
        if(match_token(toks,['RLCA']))  { return [oct("0007")]; }
        if(match_token(toks,['RLA']))   { return [oct("0027")]; }
        if(match_token(toks,['RRCA']))  { return [oct("0017")]; }
        if(match_token(toks,['RRA']))   { return [oct("0037")]; }

        if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,/^[BCDEHLA]$/])) {
            switch(toks[0]) {
                case 'RLC': return [oct("0313"), oct("0000") | get8bitRegId(toks[1])];
                case 'RL':  return [oct("0313"), oct("0020") | get8bitRegId(toks[1])];
                case 'RRC': return [oct("0313"), oct("0010") | get8bitRegId(toks[1])];
                case 'RR':  return [oct("0313"), oct("0030") | get8bitRegId(toks[1])];
                case 'SLA': return [oct("0313"), oct("0040") | get8bitRegId(toks[1])];
                case 'SRA': return [oct("0313"), oct("0050") | get8bitRegId(toks[1])];
                case 'SRL': return [oct("0313"), oct("0070") | get8bitRegId(toks[1])];
            }
            return [];
        }
        if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(','HL',')']))  {
            switch(toks[0]) {
                case 'RLC': return [oct("0313"), oct("0006")];
                case 'RL':  return [oct("0313"), oct("0026")];
                case 'RRC': return [oct("0313"), oct("0016")];
                case 'RR':  return [oct("0313"), oct("0036")];
                case 'SLA': return [oct("0313"), oct("0046")];
                case 'SRA': return [oct("0313"), oct("0056")];
                case 'SRL': return [oct("0313"), oct("0076")];
            }
            return [];
        }
        if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(',/^(IX|IY)$/,'+',null, ')'])
        || match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(',/^(IX|IY)$/,/^\+.*/, ')']))  {
            return (function() {
                var index_d = ((toks[3] == '+') ? 4 : 3);
                var prefix = 0;
                switch(toks[2]) {
                    case 'IX': prefix = oct("0335"); break;
                    case 'IY': prefix = oct("0375"); break;
                }
                var d = parseAddress.parseNumLiteral(toks[index_d]);
                switch(toks[0]) {
                    case 'RLC': return [prefix, oct("0313"), d, oct("0006")];
                    case 'RL':  return [prefix, oct("0313"), d, oct("0026")];
                    case 'RRC': return [prefix, oct("0313"), d, oct("0016")];
                    case 'RR':  return [prefix, oct("0313"), d, oct("0036")];
                    case 'SLA': return [prefix, oct("0313"), d, oct("0046")];
                    case 'SRA': return [prefix, oct("0313"), d, oct("0056")];
                    case 'SRL': return [prefix, oct("0313"), d, oct("0076")];
                }
                return [];
            }());
        }
        if(match_token(toks,['RLD']))  { return [oct("0355"), oct("0157")]; }
        if(match_token(toks,['RRD']))  { return [oct("0355"), oct("0147")]; }

        //=================================================================================
        // ビットセット・リセット及びテストグループ
        //=================================================================================

        if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', /^[BCDEHLA]$/])) {
            switch(toks[0]) {
                case 'BIT': return [oct("0313"), oct("0100") | (toks[1] << 3) | get8bitRegId(toks[3])];
                case 'SET': return [oct("0313"), oct("0300") | (toks[1] << 3) | get8bitRegId(toks[3])];
                case 'RES': return [oct("0313"), oct("0200") | (toks[1] << 3) | get8bitRegId(toks[3])];
            }
            return [];
        }
        if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(','HL',')']))  {
            switch(toks[0]) {
                case 'BIT': return [oct("0313"), oct("0106") | (toks[1] << 3)];
                case 'SET': return [oct("0313"), oct("0306") | (toks[1] << 3)];
                case 'RES': return [oct("0313"), oct("0206") | (toks[1] << 3)];
            }
            return [];
        }
        if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(',/^(IX|IY)$/,'+',null,')'])
        || match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(',/^(IX|IY)$/,/^\+.*$/,')'])) {
            return (function() {
                var index_d = ((toks[5] == '+') ? 6 : 5);
                var prefix = 0;
                switch(toks[4]) {
                    case 'IX': prefix = oct("0335"); break;
                    case 'IY': prefix = oct("0375"); break;
                }
                var d = parseAddress.parseNumLiteral(toks[index_d]);
                switch(toks[0]) {
                    case 'BIT': return [prefix, oct("0313"), d, oct("0106") | (toks[1] << 3)];
                    case 'SET': return [prefix, oct("0313"), d, oct("0306") | (toks[1] << 3)];
                    case 'RES': return [prefix, oct("0313"), d, oct("0206") | (toks[1] << 3)];
                }
                return [];
            }());
        }

        //=================================================================================
        // ジャンプグループ
        //=================================================================================

        if(match_token(toks,['JP', null]))  {
            return (function() {
                var nn = parseAddress.parseNumLiteralPair(toks[1]);
                return [oct("0303"), nn[0], nn[1]];
            }());
        }
        if(match_token(toks,['JP', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',',  null]))  {
            return (function() {
                var nn = parseAddress.parseNumLiteralPair(toks[3]);
                switch(toks[1]) {
                    case 'NZ':  return [oct("0302"), nn[0], nn[1]];
                    case 'Z':   return [oct("0312"), nn[0], nn[1]];
                    case 'NC':  return [oct("0322"), nn[0], nn[1]];
                    case 'C':   return [oct("0332"), nn[0], nn[1]];
                    case 'PO':  return [oct("0342"), nn[0], nn[1]];
                    case 'PE':  return [oct("0352"), nn[0], nn[1]];
                    case 'P':   return [oct("0362"), nn[0], nn[1]];
                    case 'M':   return [oct("0372"), nn[0], nn[1]];
                }
                return [];
            }());
        }
        if(match_token(toks,['JR', null]))  {
            return (function() {
                var e = parseAddress.parseRelAddr(toks[1], this.address + 2);
                return [oct("0030"), e];
            }.bind(this)());
        }
        if(match_token(toks,['JR', /^(NZ|Z|NC|C)$/, ',',  null]))  {
            return (function() {
                var e = parseAddress.parseRelAddr(toks[3], this.address + 2);
                switch(toks[1]) {
                    case 'NZ':  return [oct("0040"), e];
                    case 'Z':   return [oct("0050"), e];
                    case 'NC':  return [oct("0060"), e];
                    case 'C':   return [oct("0070"), e];
                }
                return [];
            }.bind(this)());
        }
        if(match_token(toks,['JP', '(', /^(HL|IX|IY)$/, ')']))  {
            switch(toks[2]) {
                case 'HL':  return [oct("0351")];
                case 'IX':  return [oct("0335"), oct("0351")];
                case 'IY':  return [oct("0375"), oct("0351")];
            }
            return [];
        }
        if(match_token(toks,['DJNZ', null]))  {
            return (function() {
                var e = parseAddress.parseRelAddr(toks[1], this.address + 2);
                return [oct("0020"), e];
            }.bind(this)());
        }

        //=================================================================================
        // コールリターングループ
        //=================================================================================

        if(match_token(toks,['CALL', null]))  {
            return (function() {
                var nn = parseAddress.parseNumLiteralPair(toks[1]);
                return [oct("0315"), nn[0], nn[1]];
            }());
        }
        if(match_token(toks,['CALL', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',',  null]))  {
            return (function() {
                var nn = parseAddress.parseNumLiteralPair(toks[3]);
                switch(toks[1]) {
                    case 'NZ':  return [oct("0304"), nn[0], nn[1]];
                    case 'Z':   return [oct("0314"), nn[0], nn[1]];
                    case 'NC':  return [oct("0324"), nn[0], nn[1]];
                    case 'C':   return [oct("0334"), nn[0], nn[1]];
                    case 'PO':  return [oct("0344"), nn[0], nn[1]];
                    case 'PE':  return [oct("0354"), nn[0], nn[1]];
                    case 'P':   return [oct("0364"), nn[0], nn[1]];
                    case 'M':   return [oct("0374"), nn[0], nn[1]];
                }
                return [];
            }());
        }
        if(match_token(toks,['RET']))  { return [oct("0311")]; }
        if(match_token(toks,['RET', /^(NZ|Z|NC|C|PO|PE|P|M)$/]))  {
            switch(toks[1]) {
                case 'NZ':  return [oct("0300")];
                case 'Z':   return [oct("0310")];
                case 'NC':  return [oct("0320")];
                case 'C':   return [oct("0330")];
                case 'PO':  return [oct("0340")];
                case 'PE':  return [oct("0350")];
                case 'P':   return [oct("0360")];
                case 'M':   return [oct("0370")];
            }
            return [];
        }
        if(match_token(toks,['RETI']))  { return [oct("0355"), oct("0115")]; }
        if(match_token(toks,['RETN']))  { return [oct("0355"), oct("0105")]; }
        if(match_token(toks,['RST', /^(00H|08H|10H|18H|20H|28H|30H|38H)$/]))  {
            switch(toks[1]) {
                case '00H':  return [oct("0307")];
                case '08H':  return [oct("0317")];
                case '10H':  return [oct("0327")];
                case '18H':  return [oct("0337")];
                case '20H':  return [oct("0347")];
                case '28H':  return [oct("0357")];
                case '30H':  return [oct("0367")];
                case '38H':  return [oct("0377")];
            }
            return [];
        }

        //=================================================================================
        // 入力・出力グループ
        //=================================================================================
        if(match_token(toks,['IN', /^[BCDEHLA]$/, ',', '(','C',')']))  {
            return (function() {
                var r = get8bitRegId(toks[1]);
                return [oct("0355"), oct("0100") | (r << 3)];
            }());
        }
        if(match_token(toks,['IN', 'A', ',', '(', null, ')']))  {
            return (function() {
                var n = parseAddress.parseNumLiteral(toks[4]);
                return [oct("0333"), n];
            }());
        }
        if(match_token(toks,['OUT', '(','C',')', ',', /^[BCDEHLA]$/]))  {
            return (function() {
                var r = get8bitRegId(toks[5]);
                return [oct("0355"), oct("0101") | (r << 3)];
            }());
        }
        if(match_token(toks,['OUT', '(', null, ')', ',', 'A']))  {
            return (function() {
                var n = parseAddress.parseNumLiteral(toks[2]);
                return [oct("0323"), n];
            }());
        }
        if(match_token(toks,['INI']))   { return [oct("0355"), oct("0242")]; }
        if(match_token(toks,['INIR']))  { return [oct("0355"), oct("0262")]; }
        if(match_token(toks,['IND']))   { return [oct("0355"), oct("0252")]; }
        if(match_token(toks,['INDR']))  { return [oct("0355"), oct("0272")]; }
        if(match_token(toks,['OUTI']))  { return [oct("0355"), oct("0243")]; }
        if(match_token(toks,['OTIR']))  { return [oct("0355"), oct("0263")]; }
        if(match_token(toks,['OUTD']))  { return [oct("0355"), oct("0253")]; }
        if(match_token(toks,['OTDR']))  { return [oct("0355"), oct("0273")]; }

        //=================================================================================
        //
        // IX/IY
        //
        //=================================================================================
        if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, '+', null, ')'])
        || match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, null, ')'])) {
            return (function() {
                var index_d = ((toks[5] == '+') ? 6 : 5);
                var r = get8bitRegId(toks[1]);
                var d = parseAddress.parseNumLiteral(toks[index_d]);
                var subope = getSubopeIXIY(toks[4]);
                return [subope, oct("0106") | (r << 3), d];
            }());
        }
        if(match_token(toks,['LD', '(', /^(IX|IY)$/, '+', null, ')', ',', /^[BCDEHLA]$/])
        || match_token(toks,['LD', '(', /^(IX|IY)$/, /^\+.*$/, ')', ',', /^[BCDEHLA]$/])) {
            return (function() {
                var index_d = ((toks[3] == '+') ? 4 : 3);
                var index_r = ((toks[3] == '+') ? 7 : 6);
                var d = parseAddress.parseNumLiteral(toks[index_d]);
                var r = get8bitRegId(toks[index_r]);
                var subope = getSubopeIXIY(toks[2]);
                return [subope, oct("0160") | r, d];
            }());
        }
        if(match_token(toks,['LD', '(', /^(IX|IY)$/, '+', null, ')', ',', null])
        || match_token(toks,['LD', '(', /^(IX|IY)$/, /^\+.*$/, ')', ',', null])) {
            return (function() {
                var index_d = ((toks[3] == '+') ? 4 : 3);
                var index_n = ((toks[3] == '+') ? 7 : 6);
                var d = parseAddress.parseNumLiteral(toks[index_d]);
                var n = parseAddress.parseNumLiteral(toks[index_n]);
                var subope = getSubopeIXIY(toks[2]);
                return [subope, 0x36, d, n];
            }());
        }
        if(match_token(toks,['LD', /^(IX|IY)$/, ',', null])) {
            return (function() {
                var nn = parseAddress.parseNumLiteralPair(toks[3]);
                var subope = getSubopeIXIY(toks[1]);
                return [subope, 0x21, nn[0], nn[1]];
            }());
        }
        if(match_token(toks,['LD', /^(IX|IY)$/, ',', '(', null, ')'])) {
            return (function() {
                var nn = parseAddress.parseNumLiteralPair(toks[4]);
                var subope = getSubopeIXIY(toks[1]);
                return [subope, 0x2A, nn[0], nn[1]];
            }());
        }
        if(match_token(toks,['PUSH', /^(IX|IY)$/])) {
            return (function() {
                var subope = getSubopeIXIY(toks[1]);
                return [subope, 0xE5];
            }());
        }
        if(match_token(toks,['POP', /^(IX|IY)$/])) {
            return (function() {
                var subope = getSubopeIXIY(toks[1]);
                return [subope, 0xE1];
            }());
        }
        if(match_token(toks,['EX', '(','SP',')', ',', /^(IX|IY)$/])) {
            return (function() {
                var subope = getSubopeIXIY(toks[5]);
                return [subope, 0xE3];
            }());
        }

        //=================================================================================
        // 8ビット演算
        //=================================================================================
        if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', /^[BCDEHLA]$/])) {
            return (function() {
                var subseq = getArithmeticSubOpecode(toks[0]);
                var r = get8bitRegId(toks[3]);
                return [oct("0200") | (subseq << 3) | r];
            }());
        }
        if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', null])) {
            return (function() {
                var subseq = getArithmeticSubOpecode(toks[0]);
                var n = parseAddress.parseNumLiteral(toks[3]);
                return [oct("0306") | (subseq << 3), n];
            }());
        }
        if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', 'HL', ')'])) {
            return (function() {
                var subseq = getArithmeticSubOpecode(toks[0]);
                return [oct("0206") | (subseq << 3)];
            }());
        }
        if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, '+', null,  ')'])
        || match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, /^\+.*/,  ')'])) {
            return (function() {
                var index_d = ((toks[5] == '+') ? 6 : 5);
                var subseq = getArithmeticSubOpecode(toks[0]);
                var d = parseAddress.parseNumLiteral(toks[index_d]);
                var subope = getSubopeIXIY(toks[4]);
                return [subope, oct("0206") | (subseq << 3), d];
            }());
        }
        if(match_token(toks,[/^(AND|OR|XOR|CP)$/, /^[BCDEHLA]$/])) {
            return (function() {
                var subseq = getArithmeticSubOpecode(toks[0]);
                var r = get8bitRegId(toks[1]);
                return [oct("0200") | (subseq << 3) | r];
            }());
        }
        if(match_token(toks,[/^(AND|OR|XOR|CP)$/, null])) {
            return (function() {
                var subseq = getArithmeticSubOpecode(toks[0]);
                var n = parseAddress.parseNumLiteral(toks[1]);
                return [oct("0306") | (subseq << 3), n];
            }());
        }
        if(match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', 'HL', ')'])) {
            return (function() {
                var subseq = getArithmeticSubOpecode(toks[0]);
                return [oct("0206") | (subseq << 3)];
            }());
        }
        if(match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, '+', null,  ')'])
        || match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, /^\+.*$/,  ')'])) {
            return (function() {
                var index_d = ((toks[3] == '+') ? 4 : 3);
                var subseq = getArithmeticSubOpecode(toks[0]);
                var d = parseAddress.parseNumLiteral(toks[index_d]);
                var subope = getSubopeIXIY(toks[2]);
                return [subope, oct("0206") | (subseq << 3), d];
            }());
        }
        if(match_token(toks,[/^(INC|DEC)$/, /^[BCDEHLA]$/])) {
            return (function() {
                var r = get8bitRegId(toks[1]);
                switch(toks[0]) {
                    case 'INC': return [oct("0004") | (r << 3)];
                    case 'DEC': return [oct("0005") | (r << 3)];
                }
            }());
        }
        if(match_token(toks,[/^(INC|DEC)$/, '(', 'HL', ')'])) {
            switch(toks[0]) {
                case 'INC': return [oct("0064")];
                case 'DEC': return [oct("0065")];
            }
        }
        if(match_token(toks,[/^(INC|DEC)$/, '(', /^(IX|IY)$/, '+', null,  ')'])
        || match_token(toks,[/^(INC|DEC)$/, '(', /^(IX|IY)$/, /^\+.*$/,  ')'])) {
            return (function() {
                var subope = getSubopeIXIY(toks[2]);
                var index_d = ((toks[3] == '+') ? 4 : 3);
                var d = parseAddress.parseNumLiteral(toks[index_d]);
                switch(toks[0]) {
                    case 'INC': return [subope, oct("0064"), d];
                    case 'DEC': return [subope, oct("0065"), d];
                }
            }());
        }
        console.warn("**** ERROR: CANNOT ASSEMBLE:" + toks.join(" / "));
        return [];
    };

}

function getSubopeIXIY(tok) {
    var subope = 0;
    switch(tok) {
        case 'IX': subope = oct("0335"); break;
        case 'IY': subope = oct("0375"); break;
    }
    return subope;
}

function getArithmeticSubOpecode(opecode) {
    var subseq = 0;
    switch(opecode) {
        case 'ADD': subseq = 0; break;
        case 'ADC': subseq = 1; break;
        case 'SUB': subseq = 2; break;
        case 'SBC': subseq = 3; break;
        case 'AND': subseq = 4; break;
        case 'OR': subseq = 6; break;
        case 'XOR': subseq = 5; break;
        case 'CP': subseq = 7; break;
    }
    return subseq;
}

function get16bitRegId_dd(name) {
    var r = null;
    switch(name) {
        case 'BC': r = 0; break;
        case 'DE': r = 1; break;
        case 'HL': r = 2; break;
        case 'SP': r = 3; break;
        default: break;
    }
    return r;
}

function get16bitRegId_qq(name) {
    var r = null;
    switch(name) {
        case 'BC': r = 0; break;
        case 'DE': r = 1; break;
        case 'HL': r = 2; break;
        case 'AF': r = 3; break;
        default: break;
    }
    return r;
}

function get8bitRegId(name) {
    var r = null;
    switch(name) {
        case 'B': r = 0; break;
        case 'C': r = 1; break;
        case 'D': r = 2; break;
        case 'E': r = 3; break;
        case 'H': r = 4; break;
        case 'L': r = 5; break;
        case 'A': r = 7; break;
        default: break;
    }
    return r;
}

/**
 * Check the syntax of the tokens with specific pattern declared by regular
 * expressions.
 *
 * @param {string[]} toks
 * The array of tokens to be checked.
 *
 * @param {string[]} pattern
 * The syntax pattern declaration including concrete strings or objects of
 * regular expression.
 *
 * @param {boolean} lastNullOfPatternMatchAll
 * Optional flag to match all tokens to the last null in the pattern.
 *
 * @returns {boolean} true if the tokens follows the syntax. otherwise false.
 */
function match_token(toks, pattern, lastNullOfPatternMatchAll?) {
    lastNullOfPatternMatchAll = lastNullOfPatternMatchAll || false;
    if(!lastNullOfPatternMatchAll) {
        if(toks.length != pattern.length) {
            return false;
        }
    } else {
        if(toks.length < pattern.length) {
            return false;
        }
    }
    for (var i = 0; i < toks.length; i++) {
        if(pattern[i] != null) {
            if(typeof(pattern[i]) == 'string') {
                if(toks[i] != pattern[i]) {
                    return false;
                }
            } else if(typeof(pattern[i]) == 'object') {
                if(pattern[i].constructor.name == 'RegExp') {
                    if(!pattern[i].test(toks[i])) {
                        return false;
                    }
                }
            }
        } else if(lastNullOfPatternMatchAll) {
            if(i == pattern.length - 1) {
                break;
            }
        }
    }
    return true;
}

module.exports = Z80LineAssembler;