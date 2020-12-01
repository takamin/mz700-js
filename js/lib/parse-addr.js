"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bin_util_1 = __importDefault(require("../Z80/bin-util"));
const parseAddress = {
    parseAddress: (addrToken, mapLabelToAddress) => {
        const bytes = parseAddress.parseNumLiteralPair(addrToken);
        if (bytes == null) {
            return null;
        }
        let H = bytes[1];
        let L = bytes[0];
        if (mapLabelToAddress != null) {
            if (typeof (H) === "function") {
                H = H(mapLabelToAddress);
            }
            if (typeof (L) === "function") {
                L = L(mapLabelToAddress);
            }
        }
        else if (typeof (H) === "function" || typeof (L) === "function") {
            return null;
        }
        const addr = bin_util_1.default.pair(H, L);
        return addr;
    },
    parseNumLiteral: (tok) => {
        const n = parseAddress._parseNumLiteral(tok);
        if (typeof (n) === 'number') {
            if (n < -128 || 256 <= n) {
                throw 'operand ' + tok + ' out of range';
            }
            return n & 0xff;
        }
        return ((dictionary) => parseAddress.dereferLowByte(tok, dictionary));
    },
    parseNumLiteralPair: (tok) => {
        const n = parseAddress._parseNumLiteral(tok);
        if (typeof (n) === 'number') {
            if (n < -32768 || 65535 < n) {
                throw 'operand ' + tok + ' out of range';
            }
            return [n & 0xff, (n >> 8) & 0xff];
        }
        return [
            dictionary => (parseAddress.dereferLowByte(tok, dictionary)),
            dictionary => (parseAddress.dereferHighByte(tok, dictionary)),
        ];
    },
    parseRelAddr: (tok, fromAddr) => {
        let n = parseAddress._parseNumLiteral(tok);
        if (typeof (n) === 'number') {
            const c0 = tok.charAt(0);
            if (c0 !== '+' && c0 !== '-') {
                n = n - fromAddr + 2;
            }
            n -= 2;
            if (n < -128 || 256 <= n) {
                throw 'operand ' + tok + ' out of range';
            }
            return n & 0xff;
        }
        return (dictionary => ((parseAddress.derefer(tok, dictionary) - fromAddr) & 0xff));
    },
    dereferLowByte: (label, dictionary) => {
        return parseAddress.derefer(label, dictionary) & 0xff;
    },
    dereferHighByte: (label, dictionary) => {
        return (parseAddress.derefer(label, dictionary) >> 8) & 0xff;
    },
    derefer: (label, dictionary) => {
        if (label in dictionary) {
            return dictionary[label];
        }
        return 0;
    },
    _parseNumLiteral: (tok) => {
        if (/^[+-]?[0-9]+$/.test(tok) || /^[+-]?[0-9A-F]+H$/i.test(tok)) {
            let matches;
            let n = 0;
            const s = (/^-/.test(tok) ? -1 : 1);
            if (/[hH]$/.test(tok)) {
                matches = tok.match(/^[+-]?([0-9a-fA-F]+)[hH]$/);
                n = parseInt(matches[1], 16);
            }
            else if (/^[+-]?0/.test(tok)) {
                matches = tok.match(/^[+-]?([0-7]+)$/);
                n = parseInt(matches[1], 8);
            }
            else {
                matches = tok.match(/^[+-]?([0-9]+)$/);
                n = parseInt(matches[1], 10);
            }
            return s * n;
        }
        return tok;
    },
};
exports.default = parseAddress;
module.exports = parseAddress;
//# sourceMappingURL=parse-addr.js.map