"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const number_util_1 = __importDefault(require("../lib/number-util"));
const oct_1 = __importDefault(require("../lib/oct"));
const mz700_charcode_1 = __importDefault(require("../lib/mz700-charcode"));
const parse_addr_1 = __importDefault(require("../lib/parse-addr"));
class Z80LineAssembler {
    constructor() {
        this.address = null;
        this.bytecode = [];
        this.label = null;
        this.mnemonic = null;
        this.operand = null;
        this.comment = "";
        this.refAddrTo = null;
        this.refCount = 0;
    }
    setAddress(address) {
        this.address = address;
    }
    setRefAddrTo(refAddrTo) {
        this.refAddrTo = refAddrTo;
    }
    setLabel(label) {
        this.label = label;
    }
    setComment(comment) {
        this.address = this.address || 0;
        this.comment = comment;
    }
    getNextAddress() {
        return this.address + this.bytecode.length;
    }
    getLastAddress() {
        return this.address + this.bytecode.length - 1;
    }
    static joinOperand(srcOperand) {
        const dstOperand = [];
        let delimiterPushed = true;
        srcOperand.forEach(element => {
            if (element === ",") {
                dstOperand.push(element);
                delimiterPushed = true;
            }
            else {
                if (!delimiterPushed) {
                    dstOperand.push(" ");
                }
                dstOperand.push(element);
                delimiterPushed = false;
            }
        });
        return dstOperand.join("");
    }
    static getBytecodesFromOperandOfDEFB(operand, dictionary) {
        const code = [];
        operand.forEach(element => {
            if (element !== ",") {
                if (element.match(/^[0-9]/) || element.match(/^[1-9A-F][0-9A-F]*H$/i)) {
                    code.push(parse_addr_1.default.parseNumLiteral(element));
                }
                else {
                    let strcode = null;
                    switch (element.charAt(0)) {
                        case "'":
                        case "\"":
                            strcode = Z80LineAssembler.convertToAsciiCode(element.substring(1, element.length - 1), true);
                            break;
                        case "`":
                            strcode = Z80LineAssembler.convertToAsciiCode(element.substring(1, element.length - 1), false);
                            break;
                        default:
                            if (element in dictionary) {
                                const deref = dictionary[element];
                                if (deref >= 256) {
                                    throw new Error(["The character code exceeds the maximum",
                                        "value of 8 bit with the label", element,
                                        "(", "0x" + number_util_1.default.HEX(deref, 4), ")"].join(" "));
                                }
                                strcode = [deref];
                            }
                            else {
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
    }
    static convertToAsciiCode(str, ascii) {
        const asciicodes = [];
        for (let i = 0; i < str.length;) {
            let c = str.charAt(i++);
            if (c === "\\") {
                c = str.charAt(i++);
                switch (c) {
                    case "0":
                    case "1":
                    case "2":
                    case "3":
                    case "4":
                    case "5":
                    case "6":
                    case "7":
                        {
                            const octstr = c + str.substr(i, 2);
                            if (octstr.length < 3) {
                                throw new Error([
                                    "Unexpected termination at a octal",
                                    "character code sequence",
                                    "at column", (i - 1), "in", str
                                ].join(" "));
                            }
                            else if (!octstr.match(/^[0-7]+$/)) {
                                throw new Error([
                                    "No octal character exists at column",
                                    (i - 1), "in", str
                                ].join(" "));
                            }
                            else {
                                const code = oct_1.default(octstr);
                                if (code >= 256) {
                                    throw new Error([
                                        "The character code exceeds the maximum",
                                        "value of 8 bit at", i, "in", str
                                    ].join(" "));
                                }
                                i += 2;
                                asciicodes.push(code);
                            }
                        }
                        break;
                    case "x":
                        {
                            const hexstr = str.substr(i).replace(/^([0-9a-fA-F]*).*$/, "$1");
                            if (hexstr.length === 0) {
                                throw new Error([
                                    "Unexpected termination at a hex",
                                    "character code sequence",
                                    "at column", (i - 1), "in", str
                                ].join(" "));
                            }
                            const code = parseInt(hexstr, 16);
                            if (code >= 256) {
                                throw new Error([
                                    "The character code exeed 8 bit",
                                    "length at", i, "in", str
                                ].join(" "));
                            }
                            i += hexstr.length;
                            asciicodes.push(code);
                        }
                        break;
                    default:
                        if (ascii) {
                            switch (c) {
                                case "r":
                                    asciicodes.push("\r".charCodeAt(0));
                                    break;
                                default:
                                    asciicodes.push(c.charCodeAt(0));
                                    break;
                            }
                        }
                        else {
                            asciicodes.push(mz700_charcode_1.default.ascii2dispcode[c.charCodeAt(0)]);
                        }
                        break;
                }
            }
            else {
                if (ascii) {
                    asciicodes.push(c.charCodeAt(0));
                }
                else {
                    asciicodes.push(mz700_charcode_1.default.ascii2dispcode[c.charCodeAt(0)]);
                }
            }
        }
        return asciicodes;
    }
    static parseIndexDisplacer(toks, indexOfSign) {
        const indexD = indexOfSign + (toks[indexOfSign].match(/^[+-]$/) ? 1 : 0);
        const d = parse_addr_1.default.parseNumLiteral(toks[indexD]);
        if (indexD === indexOfSign + 1 && toks[indexOfSign] === '-') {
            return number_util_1.default.to8bitUnsigned(-d);
        }
        return d;
    }
    static create(mnemonic, operand, machineCode) {
        const asmline = new Z80LineAssembler();
        asmline.mnemonic = mnemonic;
        asmline.operand = operand || "";
        asmline.bytecode = machineCode || [];
        return asmline;
    }
    static assemble(source, address, dictionary) {
        const asmline = new Z80LineAssembler();
        asmline.address = address;
        const tokens = Z80LineAssembler.tokenize(source);
        let foundLabel = -1;
        let foundComment = -1;
        for (let j = 0; j < tokens.length; j++) {
            switch (tokens[j]) {
                case ':':
                    if (foundLabel < 0 && foundComment < 0) {
                        foundLabel = j;
                    }
                    break;
                case ';':
                    if (foundComment < 0) {
                        foundComment = j;
                    }
                    break;
            }
        }
        if (foundLabel >= 0) {
            asmline.label = tokens.slice(0, foundLabel).join('');
            tokens.splice(0, foundLabel + 1);
            foundComment -= (foundLabel + 1);
        }
        if (foundComment >= 0) {
            asmline.comment = tokens.slice(foundComment).join('');
            tokens.splice(foundComment);
        }
        if (tokens.length > 0) {
            asmline.mnemonic = tokens[0];
            asmline.operand = Z80LineAssembler.joinOperand(tokens.slice(1));
        }
        if (tokens.length > 0) {
            try {
                asmline.bytecode = asmline.assembleMnemonic(tokens, dictionary);
            }
            catch (e) {
                asmline.comment += "*** ASSEMBLE ERROR - " + e;
                console.error(`!!! Error !!! ${e.message}`);
                console.error(`tokens: ${tokens.join(' ')}`);
                console.error(e.stack);
            }
        }
        return asmline;
    }
    static tokenize(line) {
        const LEX_IDLE = 0;
        const LEX_NUMBER = 2;
        const LEX_IDENT = 3;
        const LEX_CHAR = 4;
        let currstat = LEX_IDLE;
        const L = line.length;
        let i = 0;
        const toks = [];
        let tok = '';
        while (i < L) {
            let ch = line.charAt(i);
            switch (currstat) {
                case LEX_IDLE:
                    if (/\s/.test(ch)) {
                        i++;
                    }
                    else {
                        if (ch === '-' || ch === '+') {
                            tok += ch;
                            i++;
                            currstat = LEX_NUMBER;
                        }
                        else if (/[0-9]/.test(ch)) {
                            currstat = LEX_NUMBER;
                        }
                        else if (/[A-Z_?.*#!$]/i.test(ch)) {
                            tok += ch;
                            i++;
                            currstat = LEX_IDENT;
                        }
                        else if (ch === "'" || ch === "\"" || ch === "`") {
                            tok += ch;
                            i++;
                            currstat = LEX_CHAR;
                        }
                        else if (ch === '(' || ch === ')' || ch === ',' || ch === '+' || ch === ':') {
                            toks.push(ch);
                            i++;
                        }
                        else if (ch === ';') {
                            toks.push(ch);
                            i++;
                            const comment = line.substr(i);
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
                    if (/[0-9A-F]/i.test(ch)) {
                        tok += ch;
                        i++;
                    }
                    else if (/H/i.test(ch)) {
                        tok += ch;
                        i++;
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    else {
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    break;
                case LEX_IDENT:
                    if (/[A-Z_0-9?.*#!$']/i.test(ch)) {
                        tok += ch;
                        i++;
                    }
                    else {
                        toks.push(tok.toUpperCase());
                        tok = '';
                        currstat = LEX_IDLE;
                    }
                    break;
                case LEX_CHAR:
                    if (ch === "\\") {
                        ++i;
                        if (i < L) {
                            ch = line.charAt(i);
                            tok += "\\" + ch;
                            i++;
                        }
                    }
                    else if (ch !== tok.charAt(0)) {
                        tok += ch;
                        i++;
                    }
                    else {
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
        if (tok !== '') {
            toks.push(tok.toUpperCase());
        }
        return toks;
    }
    resolveAddress(dictionary) {
        for (let j = 0; j < this.bytecode.length; j++) {
            if (typeof (this.bytecode[j]) === 'function') {
                const deref = this.bytecode[j];
                this.bytecode[j] = deref(dictionary);
            }
        }
    }
    assembleMnemonic(toks, dictionary) {
        const label = this.label;
        if (match_token(toks, ['ORG', null])) {
            this.address = parse_addr_1.default._parseNumLiteral(toks[1]);
            return [];
        }
        if (match_token(toks, ['ENT'])) {
            dictionary[label] = this.address;
            return [];
        }
        if (match_token(toks, ['EQU', null])) {
            if (label === null || label === "") {
                throw "empty label for EQU";
            }
            dictionary[label] = parse_addr_1.default._parseNumLiteral(toks[1]);
            return [];
        }
        if (match_token(toks, ['DEFB', null], true)) {
            return Z80LineAssembler.getBytecodesFromOperandOfDEFB(toks.slice(1), dictionary);
        }
        if (match_token(toks, ['DEFW', null])) {
            return parse_addr_1.default.parseNumLiteralPair(toks[1]);
        }
        if (match_token(toks, ['DEFS', null])) {
            const n = parse_addr_1.default._parseNumLiteral(toks[1]);
            if (n < 0) {
                throw "negative DEFS number " + toks[1];
            }
            return Array(n).fill(0);
        }
        if (match_token(toks, ['LD', 'A', ',', 'I'])) {
            return [oct_1.default("0355"), oct_1.default("0127")];
        }
        if (match_token(toks, ['LD', 'A', ',', 'R'])) {
            return [oct_1.default("0355"), oct_1.default("0137")];
        }
        if (match_token(toks, ['LD', 'I', ',', 'A'])) {
            return [oct_1.default("0355"), oct_1.default("0107")];
        }
        if (match_token(toks, ['LD', 'R', ',', 'A'])) {
            return [oct_1.default("0355"), oct_1.default("0117")];
        }
        if (match_token(toks, ['LD', 'B', ',', 'IXH'])) {
            return [0xdd, 0x44];
        }
        if (match_token(toks, ['LD', 'C', ',', 'IXL'])) {
            return [0xdd, 0x4d];
        }
        if (match_token(toks, ['LD', 'A', ',', 'IXL'])) {
            return [0xdd, 0x7d];
        }
        if (match_token(toks, ['ADD', 'A', ',', 'IXH'])) {
            return [0xdd, 0x84];
        }
        if (match_token(toks, ['ADD', 'A', ',', 'IXL'])) {
            return [0xdd, 0x85];
        }
        if (match_token(toks, ['LD', /^[BCDEHLA]$/, ',', /^[BCDEHLA]$/])) {
            const dstR = get8bitRegId(toks[1]);
            const srcR = get8bitRegId(toks[3]);
            return [oct_1.default("0100") | (dstR << 3) | (srcR) << 0];
        }
        if (match_token(toks, ['LD', /^[BCDEHLA]$/, ',', null])) {
            return (() => {
                const r = get8bitRegId(toks[1]);
                const n = parse_addr_1.default.parseNumLiteral(toks[3]);
                return [oct_1.default("0006") | (r << 3), n];
            })();
        }
        if (match_token(toks, ['LD', /^[BCDEHLA]$/, ',', '(', 'HL', ')'])) {
            return (() => {
                const r = get8bitRegId(toks[1]);
                return [oct_1.default("0106") | (r << 3)];
            })();
        }
        if (match_token(toks, ['LD', '(', 'HL', ')', ',', /^[BCDEHLA]$/])) {
            return (() => {
                const r = get8bitRegId(toks[5]);
                return [oct_1.default("0160") | r];
            })();
        }
        if (match_token(toks, ['LD', '(', 'HL', ')', ',', null])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteral(toks[5]);
                return [oct_1.default("0066"), n];
            })();
        }
        if (match_token(toks, ['LD', 'A', ',', '(', /^(BC|DE)$/, ')'])) {
            return (() => {
                const dd = get16bitRegId_dd(toks[4]);
                return [oct_1.default("0012") | (dd << 4)];
            })();
        }
        if (match_token(toks, ['LD', 'A', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0072"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', /^(BC|DE)$/, ')', ',', 'A'])) {
            return (() => {
                const dd = get16bitRegId_dd(toks[2]);
                return [oct_1.default("0002") | (dd << 4)];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'A'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0062"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'SP', ',', 'HL'])) {
            return [oct_1.default("0371")];
        }
        if (match_token(toks, ['LD', 'SP', ',', 'IX'])) {
            return [0xDD, 0xF9];
        }
        if (match_token(toks, ['LD', 'SP', ',', 'IY'])) {
            return [0xfd, 0xF9];
        }
        if (match_token(toks, ['LD', /^(BC|DE|HL|SP)$/, ',', null])) {
            return (() => {
                const dd = get16bitRegId_dd(toks[1]);
                const n = parse_addr_1.default.parseNumLiteralPair(toks[3]);
                return [oct_1.default("0001") | (dd << 4), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'HL', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0052"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'BC', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0355"), oct_1.default("0113"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'DE', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0355"), oct_1.default("0133"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', 'SP', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                return [oct_1.default("0355"), oct_1.default("0173"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'HL'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0042"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'BC'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0355"), oct_1.default("0103"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'DE'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0355"), oct_1.default("0123"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', 'SP'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                return [oct_1.default("0355"), oct_1.default("0163"), n[0], n[1]];
            })();
        }
        if (match_token(toks, ['PUSH', /^(BC|DE|HL|AF)$/])) {
            return (() => {
                const qq = get16bitRegId_qq(toks[1]);
                return [oct_1.default("0305") | (qq << 4)];
            })();
        }
        if (match_token(toks, ['POP', /^(BC|DE|HL|AF)$/])) {
            return (() => {
                const qq = get16bitRegId_qq(toks[1]);
                return [oct_1.default("0301") | (qq << 4)];
            })();
        }
        if (match_token(toks, ['LD', 'IXH', ',', 'B'])) {
            return [0xdd, 0x60];
        }
        if (match_token(toks, ['LD', 'IXL', ',', 'C'])) {
            return [0xdd, 0x69];
        }
        if (match_token(toks, ['LD', 'IXH', ',', 'A'])) {
            return [0xdd, 0x67];
        }
        if (match_token(toks, ['LD', 'IXL', ',', 'A'])) {
            return [0xdd, 0x6f];
        }
        if (match_token(toks, ['CP', 'IXL'])) {
            return [0xdd, 0xbd];
        }
        if (match_token(toks, ['EX', 'DE', ',', 'HL'])) {
            return [0xEB];
        }
        if (match_token(toks, ['EX', 'AF', ',', "AF'"])) {
            return [0x08];
        }
        if (match_token(toks, ['EXX'])) {
            return [0xD9];
        }
        if (match_token(toks, ['EX', '(', 'SP', ')', ',', 'HL'])) {
            return [0xE3];
        }
        if (match_token(toks, ['LDI'])) {
            return [oct_1.default("0355"), oct_1.default("0240")];
        }
        if (match_token(toks, ['LDIR'])) {
            return [oct_1.default("0355"), oct_1.default("0260")];
        }
        if (match_token(toks, ['LDD'])) {
            return [oct_1.default("0355"), oct_1.default("0250")];
        }
        if (match_token(toks, ['LDDR'])) {
            return [oct_1.default("0355"), oct_1.default("0270")];
        }
        if (match_token(toks, ['CPI'])) {
            return [oct_1.default("0355"), oct_1.default("0241")];
        }
        if (match_token(toks, ['CPIR'])) {
            return [oct_1.default("0355"), oct_1.default("0261")];
        }
        if (match_token(toks, ['CPD'])) {
            return [oct_1.default("0355"), oct_1.default("0251")];
        }
        if (match_token(toks, ['CPDR'])) {
            return [oct_1.default("0355"), oct_1.default("0271")];
        }
        if (match_token(toks, ['DAA'])) {
            return [oct_1.default("0047")];
        }
        if (match_token(toks, ['CPL'])) {
            return [oct_1.default("0057")];
        }
        if (match_token(toks, ['NEG'])) {
            return [oct_1.default("0355"), oct_1.default("0104")];
        }
        if (match_token(toks, ['CCF'])) {
            return [oct_1.default("0077")];
        }
        if (match_token(toks, ['SCF'])) {
            return [oct_1.default("0067")];
        }
        if (match_token(toks, ['NOP'])) {
            return [oct_1.default("0000")];
        }
        if (match_token(toks, ['HALT'])) {
            return [oct_1.default("0166")];
        }
        if (match_token(toks, ['DI'])) {
            return [oct_1.default("0363")];
        }
        if (match_token(toks, ['EI'])) {
            return [oct_1.default("0373")];
        }
        if (match_token(toks, ['IM0'])) {
            return [oct_1.default("0355"), oct_1.default("0106")];
        }
        if (match_token(toks, ['IM1'])) {
            return [oct_1.default("0355"), oct_1.default("0126")];
        }
        if (match_token(toks, ['IM2'])) {
            return [oct_1.default("0355"), oct_1.default("0136")];
        }
        if (match_token(toks, ['IM', '0'])) {
            return [oct_1.default("0355"), oct_1.default("0106")];
        }
        if (match_token(toks, ['IM', '1'])) {
            return [oct_1.default("0355"), oct_1.default("0126")];
        }
        if (match_token(toks, ['IM', '2'])) {
            return [oct_1.default("0355"), oct_1.default("0136")];
        }
        if (match_token(toks, [/^(ADD|ADC|SBC)$/, 'HL', ',', /^(BC|DE|HL|SP)$/])) {
            let ss = 0;
            switch (toks[3]) {
                case 'BC':
                    ss = 0;
                    break;
                case 'DE':
                    ss = 1;
                    break;
                case 'HL':
                    ss = 2;
                    break;
                case 'SP':
                    ss = 3;
                    break;
            }
            switch (toks[0]) {
                case 'ADD': return [oct_1.default("0011") | (ss << 4)];
                case 'ADC': return [oct_1.default("0355"), oct_1.default("0112") | (ss << 4)];
                case 'SBC': return [oct_1.default("0355"), oct_1.default("0102") | (ss << 4)];
            }
            return [];
        }
        if (match_token(toks, ['ADD', 'IX', ',', /^(BC|DE|IX|SP)$/])) {
            switch (toks[3]) {
                case 'BC': return [oct_1.default("0335"), oct_1.default("0011")];
                case 'DE': return [oct_1.default("0335"), oct_1.default("0031")];
                case 'IX': return [oct_1.default("0335"), oct_1.default("0051")];
                case 'SP': return [oct_1.default("0335"), oct_1.default("0071")];
            }
            return [];
        }
        if (match_token(toks, ['ADD', 'IY', ',', /^(BC|DE|IY|SP)$/])) {
            switch (toks[3]) {
                case 'BC': return [oct_1.default("0375"), oct_1.default("0011")];
                case 'DE': return [oct_1.default("0375"), oct_1.default("0031")];
                case 'IY': return [oct_1.default("0375"), oct_1.default("0051")];
                case 'SP': return [oct_1.default("0375"), oct_1.default("0071")];
            }
            return [];
        }
        if (match_token(toks, [/^(INC|DEC)$/, /^(BC|DE|HL|SP|IX|IY)$/])) {
            switch (toks[0]) {
                case 'INC':
                    switch (toks[1]) {
                        case 'BC': return [oct_1.default("0003")];
                        case 'DE': return [oct_1.default("0023")];
                        case 'HL': return [oct_1.default("0043")];
                        case 'SP': return [oct_1.default("0063")];
                        case 'IX': return [oct_1.default("0335"), oct_1.default("0043")];
                        case 'IY': return [oct_1.default("0375"), oct_1.default("0043")];
                    }
                    break;
                case 'DEC':
                    switch (toks[1]) {
                        case 'BC': return [oct_1.default("0013")];
                        case 'DE': return [oct_1.default("0033")];
                        case 'HL': return [oct_1.default("0053")];
                        case 'SP': return [oct_1.default("0073")];
                        case 'IX': return [oct_1.default("0335"), oct_1.default("0053")];
                        case 'IY': return [oct_1.default("0375"), oct_1.default("0053")];
                    }
                    break;
            }
            return [];
        }
        if (match_token(toks, ['RLCA'])) {
            return [oct_1.default("0007")];
        }
        if (match_token(toks, ['RLA'])) {
            return [oct_1.default("0027")];
        }
        if (match_token(toks, ['RRCA'])) {
            return [oct_1.default("0017")];
        }
        if (match_token(toks, ['RRA'])) {
            return [oct_1.default("0037")];
        }
        if (match_token(toks, [/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/, /^[BCDEHLA]$/])) {
            switch (toks[0]) {
                case 'RLC': return [oct_1.default("0313"), oct_1.default("0000") | get8bitRegId(toks[1])];
                case 'RL': return [oct_1.default("0313"), oct_1.default("0020") | get8bitRegId(toks[1])];
                case 'RRC': return [oct_1.default("0313"), oct_1.default("0010") | get8bitRegId(toks[1])];
                case 'RR': return [oct_1.default("0313"), oct_1.default("0030") | get8bitRegId(toks[1])];
                case 'SLA': return [oct_1.default("0313"), oct_1.default("0040") | get8bitRegId(toks[1])];
                case 'SRA': return [oct_1.default("0313"), oct_1.default("0050") | get8bitRegId(toks[1])];
                case 'SRL': return [oct_1.default("0313"), oct_1.default("0070") | get8bitRegId(toks[1])];
            }
            return [];
        }
        if (match_token(toks, [/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/, '(', 'HL', ')'])) {
            switch (toks[0]) {
                case 'RLC': return [oct_1.default("0313"), oct_1.default("0006")];
                case 'RL': return [oct_1.default("0313"), oct_1.default("0026")];
                case 'RRC': return [oct_1.default("0313"), oct_1.default("0016")];
                case 'RR': return [oct_1.default("0313"), oct_1.default("0036")];
                case 'SLA': return [oct_1.default("0313"), oct_1.default("0046")];
                case 'SRA': return [oct_1.default("0313"), oct_1.default("0056")];
                case 'SRL': return [oct_1.default("0313"), oct_1.default("0076")];
            }
            return [];
        }
        if (match_token(toks, [/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/, '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/, '(', /^(IX|IY)$/, /^[+-].*/, ')'])) {
            const prefix = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            switch (toks[0]) {
                case 'RLC': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0006")];
                case 'RL': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0026")];
                case 'RRC': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0016")];
                case 'RR': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0036")];
                case 'SLA': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0046")];
                case 'SRA': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0056")];
                case 'SRL': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0076")];
            }
            return [];
        }
        if (match_token(toks, ['RLD'])) {
            return [oct_1.default("0355"), oct_1.default("0157")];
        }
        if (match_token(toks, ['RRD'])) {
            return [oct_1.default("0355"), oct_1.default("0147")];
        }
        if (match_token(toks, [/^(BIT|SET|RES)$/, /^[0-7]$/, ',', /^[BCDEHLA]$/])) {
            switch (toks[0]) {
                case 'BIT': return [oct_1.default("0313"), oct_1.default("0100") | (parseInt(toks[1], 10) << 3) | get8bitRegId(toks[3])];
                case 'SET': return [oct_1.default("0313"), oct_1.default("0300") | (parseInt(toks[1], 10) << 3) | get8bitRegId(toks[3])];
                case 'RES': return [oct_1.default("0313"), oct_1.default("0200") | (parseInt(toks[1], 10) << 3) | get8bitRegId(toks[3])];
            }
            return [];
        }
        if (match_token(toks, [/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(', 'HL', ')'])) {
            switch (toks[0]) {
                case 'BIT': return [oct_1.default("0313"), oct_1.default("0106") | (parseInt(toks[1], 10) << 3)];
                case 'SET': return [oct_1.default("0313"), oct_1.default("0306") | (parseInt(toks[1], 10) << 3)];
                case 'RES': return [oct_1.default("0313"), oct_1.default("0206") | (parseInt(toks[1], 10) << 3)];
            }
            return [];
        }
        if (match_token(toks, [/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(', /^(IX|IY)$/, /^[+-].*$/, ')'])) {
            const prefix = getSubopeIXIY(toks[4]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 5);
            switch (toks[0]) {
                case 'BIT': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0106") | (parseInt(toks[1], 10) << 3)];
                case 'SET': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0306") | (parseInt(toks[1], 10) << 3)];
                case 'RES': return [prefix, oct_1.default("0313"), d8u, oct_1.default("0206") | (parseInt(toks[1], 10) << 3)];
            }
            return [];
        }
        if (match_token(toks, ['JP', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[1]);
                return [oct_1.default("0303"), nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['JP', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[3]);
                switch (toks[1]) {
                    case 'NZ': return [oct_1.default("0302"), nn[0], nn[1]];
                    case 'Z': return [oct_1.default("0312"), nn[0], nn[1]];
                    case 'NC': return [oct_1.default("0322"), nn[0], nn[1]];
                    case 'C': return [oct_1.default("0332"), nn[0], nn[1]];
                    case 'PO': return [oct_1.default("0342"), nn[0], nn[1]];
                    case 'PE': return [oct_1.default("0352"), nn[0], nn[1]];
                    case 'P': return [oct_1.default("0362"), nn[0], nn[1]];
                    case 'M': return [oct_1.default("0372"), nn[0], nn[1]];
                }
                return [];
            })();
        }
        if (match_token(toks, ['JR', null])) {
            return (() => {
                const e = parse_addr_1.default.parseRelAddr(toks[1], this.address + 2);
                return [oct_1.default("0030"), e];
            })();
        }
        if (match_token(toks, ['JR', /^(NZ|Z|NC|C)$/, ',', null])) {
            return (() => {
                const e = parse_addr_1.default.parseRelAddr(toks[3], this.address + 2);
                switch (toks[1]) {
                    case 'NZ': return [oct_1.default("0040"), e];
                    case 'Z': return [oct_1.default("0050"), e];
                    case 'NC': return [oct_1.default("0060"), e];
                    case 'C': return [oct_1.default("0070"), e];
                }
                return [];
            })();
        }
        if (match_token(toks, ['JP', '(', /^(HL|IX|IY)$/, ')'])) {
            switch (toks[2]) {
                case 'HL': return [oct_1.default("0351")];
                case 'IX': return [oct_1.default("0335"), oct_1.default("0351")];
                case 'IY': return [oct_1.default("0375"), oct_1.default("0351")];
            }
            return [];
        }
        if (match_token(toks, ['DJNZ', null])) {
            return (() => {
                const e = parse_addr_1.default.parseRelAddr(toks[1], this.address + 2);
                return [oct_1.default("0020"), e];
            })();
        }
        if (match_token(toks, ['CALL', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[1]);
                return [oct_1.default("0315"), nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['CALL', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[3]);
                switch (toks[1]) {
                    case 'NZ': return [oct_1.default("0304"), nn[0], nn[1]];
                    case 'Z': return [oct_1.default("0314"), nn[0], nn[1]];
                    case 'NC': return [oct_1.default("0324"), nn[0], nn[1]];
                    case 'C': return [oct_1.default("0334"), nn[0], nn[1]];
                    case 'PO': return [oct_1.default("0344"), nn[0], nn[1]];
                    case 'PE': return [oct_1.default("0354"), nn[0], nn[1]];
                    case 'P': return [oct_1.default("0364"), nn[0], nn[1]];
                    case 'M': return [oct_1.default("0374"), nn[0], nn[1]];
                }
                return [];
            })();
        }
        if (match_token(toks, ['RET'])) {
            return [oct_1.default("0311")];
        }
        if (match_token(toks, ['RET', /^(NZ|Z|NC|C|PO|PE|P|M)$/])) {
            switch (toks[1]) {
                case 'NZ': return [oct_1.default("0300")];
                case 'Z': return [oct_1.default("0310")];
                case 'NC': return [oct_1.default("0320")];
                case 'C': return [oct_1.default("0330")];
                case 'PO': return [oct_1.default("0340")];
                case 'PE': return [oct_1.default("0350")];
                case 'P': return [oct_1.default("0360")];
                case 'M': return [oct_1.default("0370")];
            }
            return [];
        }
        if (match_token(toks, ['RETI'])) {
            return [oct_1.default("0355"), oct_1.default("0115")];
        }
        if (match_token(toks, ['RETN'])) {
            return [oct_1.default("0355"), oct_1.default("0105")];
        }
        if (match_token(toks, ['RST', /^(00H|08H|10H|18H|20H|28H|30H|38H)$/])) {
            switch (toks[1]) {
                case '00H': return [oct_1.default("0307")];
                case '08H': return [oct_1.default("0317")];
                case '10H': return [oct_1.default("0327")];
                case '18H': return [oct_1.default("0337")];
                case '20H': return [oct_1.default("0347")];
                case '28H': return [oct_1.default("0357")];
                case '30H': return [oct_1.default("0367")];
                case '38H': return [oct_1.default("0377")];
            }
            return [];
        }
        if (match_token(toks, ['IN', /^[BCDEHLA]$/, ',', '(', 'C', ')'])) {
            return (() => {
                const r = get8bitRegId(toks[1]);
                return [oct_1.default("0355"), oct_1.default("0100") | (r << 3)];
            })();
        }
        if (match_token(toks, ['IN', 'A', ',', '(', null, ')'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteral(toks[4]);
                return [oct_1.default("0333"), n];
            })();
        }
        if (match_token(toks, ['OUT', '(', 'C', ')', ',', /^[BCDEHLA]$/])) {
            return (() => {
                const r = get8bitRegId(toks[5]);
                return [oct_1.default("0355"), oct_1.default("0101") | (r << 3)];
            })();
        }
        if (match_token(toks, ['OUT', '(', null, ')', ',', 'A'])) {
            return (() => {
                const n = parse_addr_1.default.parseNumLiteral(toks[2]);
                return [oct_1.default("0323"), n];
            })();
        }
        if (match_token(toks, ['INI'])) {
            return [oct_1.default("0355"), oct_1.default("0242")];
        }
        if (match_token(toks, ['INIR'])) {
            return [oct_1.default("0355"), oct_1.default("0262")];
        }
        if (match_token(toks, ['IND'])) {
            return [oct_1.default("0355"), oct_1.default("0252")];
        }
        if (match_token(toks, ['INDR'])) {
            return [oct_1.default("0355"), oct_1.default("0272")];
        }
        if (match_token(toks, ['OUTI'])) {
            return [oct_1.default("0355"), oct_1.default("0243")];
        }
        if (match_token(toks, ['OTIR'])) {
            return [oct_1.default("0355"), oct_1.default("0263")];
        }
        if (match_token(toks, ['OUTD'])) {
            return [oct_1.default("0355"), oct_1.default("0253")];
        }
        if (match_token(toks, ['OTDR'])) {
            return [oct_1.default("0355"), oct_1.default("0273")];
        }
        if (match_token(toks, ['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, ['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, null, ')'])) {
            const r = get8bitRegId(toks[1]);
            const subope = getSubopeIXIY(toks[4]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 5);
            return [subope, oct_1.default("0106") | (r << 3), d8u];
        }
        if (match_token(toks, ['LD', '(', /^(IX|IY)$/, /^[+-]$/, null, ')', ',', /^[BCDEHLA]$/])
            || match_token(toks, ['LD', '(', /^(IX|IY)$/, /^[+-].*$/, ')', ',', /^[BCDEHLA]$/])) {
            const subope = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            const indexR = ((toks[3] === '+' || toks[3] === '-') ? 7 : 6);
            const r = get8bitRegId(toks[indexR]);
            return [subope, oct_1.default("0160") | r, d8u];
        }
        if (match_token(toks, ['LD', '(', /^(IX|IY)$/, /^[+-]$/, null, ')', ',', null])
            || match_token(toks, ['LD', '(', /^(IX|IY)$/, /^[+-].*$/, ')', ',', null])) {
            const subope = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            const indexN = ((toks[3] === '+' || toks[3] === '-') ? 7 : 6);
            const n = parse_addr_1.default.parseNumLiteral(toks[indexN]);
            return [subope, 0x36, d8u, n];
        }
        if (match_token(toks, ['LD', /^(IX|IY)$/, ',', null])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[3]);
                const subope = getSubopeIXIY(toks[1]);
                return [subope, 0x21, nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['LD', '(', null, ')', ',', /^(IX|IY)$/])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[2]);
                const subope = getSubopeIXIY(toks[5]);
                return [subope, 0x22, nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['LD', /^(IX|IY)$/, ',', '(', null, ')'])) {
            return (() => {
                const nn = parse_addr_1.default.parseNumLiteralPair(toks[4]);
                const subope = getSubopeIXIY(toks[1]);
                return [subope, 0x2A, nn[0], nn[1]];
            })();
        }
        if (match_token(toks, ['PUSH', /^(IX|IY)$/])) {
            return (() => {
                const subope = getSubopeIXIY(toks[1]);
                return [subope, 0xE5];
            })();
        }
        if (match_token(toks, ['POP', /^(IX|IY)$/])) {
            return (() => {
                const subope = getSubopeIXIY(toks[1]);
                return [subope, 0xE1];
            })();
        }
        if (match_token(toks, ['EX', '(', 'SP', ')', ',', /^(IX|IY)$/])) {
            return (() => {
                const subope = getSubopeIXIY(toks[5]);
                return [subope, 0xE3];
            })();
        }
        if (match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', /^[BCDEHLA]$/])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                const r = get8bitRegId(toks[3]);
                return [oct_1.default("0200") | (subseq << 3) | r];
            })();
        }
        if (match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', null])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                const n = parse_addr_1.default.parseNumLiteral(toks[3]);
                return [oct_1.default("0306") | (subseq << 3), n];
            })();
        }
        if (match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', 'HL', ')'])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                return [oct_1.default("0206") | (subseq << 3)];
            })();
        }
        if (match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, /^[+-].*/, ')'])) {
            const subseq = getArithmeticSubOpecode(toks[0]);
            const subope = getSubopeIXIY(toks[4]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 5);
            return [subope, oct_1.default("0206") | (subseq << 3), d8u];
        }
        if (match_token(toks, [/^(AND|OR|XOR|CP)$/, /^[BCDEHLA]$/])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                const r = get8bitRegId(toks[1]);
                return [oct_1.default("0200") | (subseq << 3) | r];
            })();
        }
        if (match_token(toks, [/^(AND|OR|XOR|CP)$/, null])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                const n = parse_addr_1.default.parseNumLiteral(toks[1]);
                return [oct_1.default("0306") | (subseq << 3), n];
            })();
        }
        if (match_token(toks, [/^(AND|OR|XOR|CP)$/, '(', 'HL', ')'])) {
            return (() => {
                const subseq = getArithmeticSubOpecode(toks[0]);
                return [oct_1.default("0206") | (subseq << 3)];
            })();
        }
        if (match_token(toks, [/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, /^[+-].*$/, ')'])) {
            const subseq = getArithmeticSubOpecode(toks[0]);
            const subope = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            return [subope, oct_1.default("0206") | (subseq << 3), d8u];
        }
        if (match_token(toks, [/^(INC|DEC)$/, /^[BCDEHLA]$/])) {
            return (() => {
                const r = get8bitRegId(toks[1]);
                switch (toks[0]) {
                    case 'INC': return [oct_1.default("0004") | (r << 3)];
                    case 'DEC': return [oct_1.default("0005") | (r << 3)];
                }
            })();
        }
        if (match_token(toks, [/^(INC|DEC)$/, '(', 'HL', ')'])) {
            switch (toks[0]) {
                case 'INC': return [oct_1.default("0064")];
                case 'DEC': return [oct_1.default("0065")];
            }
        }
        if (match_token(toks, [/^(INC|DEC)$/, '(', /^(IX|IY)$/, /^[+-]$/, null, ')'])
            || match_token(toks, [/^(INC|DEC)$/, '(', /^(IX|IY)$/, /^[+-].*$/, ')'])) {
            const subope = getSubopeIXIY(toks[2]);
            const d8u = Z80LineAssembler.parseIndexDisplacer(toks, 3);
            switch (toks[0]) {
                case 'INC': return [subope, oct_1.default("0064"), d8u];
                case 'DEC': return [subope, oct_1.default("0065"), d8u];
            }
        }
        console.warn("**** ERROR: CANNOT ASSEMBLE:" + toks.join(" / "));
        return [];
    }
}
exports.default = Z80LineAssembler;
function getSubopeIXIY(tok) {
    let subope = 0;
    switch (tok) {
        case 'IX':
            subope = oct_1.default("0335");
            break;
        case 'IY':
            subope = oct_1.default("0375");
            break;
    }
    return subope;
}
function getArithmeticSubOpecode(opecode) {
    let subseq = 0;
    switch (opecode) {
        case 'ADD':
            subseq = 0;
            break;
        case 'ADC':
            subseq = 1;
            break;
        case 'SUB':
            subseq = 2;
            break;
        case 'SBC':
            subseq = 3;
            break;
        case 'AND':
            subseq = 4;
            break;
        case 'OR':
            subseq = 6;
            break;
        case 'XOR':
            subseq = 5;
            break;
        case 'CP':
            subseq = 7;
            break;
    }
    return subseq;
}
function get16bitRegId_dd(name) {
    let r = null;
    switch (name) {
        case 'BC':
            r = 0;
            break;
        case 'DE':
            r = 1;
            break;
        case 'HL':
            r = 2;
            break;
        case 'SP':
            r = 3;
            break;
        default: break;
    }
    return r;
}
function get16bitRegId_qq(name) {
    let r = null;
    switch (name) {
        case 'BC':
            r = 0;
            break;
        case 'DE':
            r = 1;
            break;
        case 'HL':
            r = 2;
            break;
        case 'AF':
            r = 3;
            break;
        default: break;
    }
    return r;
}
function get8bitRegId(name) {
    let r = null;
    switch (name) {
        case 'B':
            r = 0;
            break;
        case 'C':
            r = 1;
            break;
        case 'D':
            r = 2;
            break;
        case 'E':
            r = 3;
            break;
        case 'H':
            r = 4;
            break;
        case 'L':
            r = 5;
            break;
        case 'A':
            r = 7;
            break;
        default: break;
    }
    return r;
}
function match_token(toks, pattern, lastNullOfPatternMatchAll) {
    lastNullOfPatternMatchAll = lastNullOfPatternMatchAll || false;
    if (!lastNullOfPatternMatchAll) {
        if (toks.length !== pattern.length) {
            return false;
        }
    }
    else {
        if (toks.length < pattern.length) {
            return false;
        }
    }
    for (let i = 0; i < toks.length; i++) {
        if (pattern[i] != null) {
            if (typeof (pattern[i]) === 'string') {
                if (toks[i] !== pattern[i]) {
                    return false;
                }
            }
            else if (typeof (pattern[i]) === 'object') {
                if (pattern[i] instanceof RegExp) {
                    const re = pattern[i];
                    if (!re.test(toks[i])) {
                        return false;
                    }
                }
            }
        }
        else if (lastNullOfPatternMatchAll) {
            if (i === pattern.length - 1) {
                break;
            }
        }
    }
    return true;
}
module.exports = Z80LineAssembler;
//# sourceMappingURL=Z80-line-assembler.js.map