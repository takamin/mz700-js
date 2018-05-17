(function(){
    "use strict";
    const Z80BinUtil = require("../Z80/bin-util.js");

    /**
     * Translate address string to value.
     * @param {string} addrToken
     * The address to be converted.
     * @param {object|undefined} mapLabelToAddress
     * A dictionary to get address of the labels.
     * @returns {number} as the address.
     */
    function parseAddress(addrToken, mapLabelToAddress) {
        var bytes = parseAddress.parseNumLiteralPair(addrToken);
        if(bytes == null) {
            return null;
        }
        if(mapLabelToAddress != null) {
            if(typeof(H) == "function") {
                H = H(mapLabelToAddress);
            }
            if(typeof(L) == "function") {
                L = L(mapLabelToAddress);
            }
        } else if(typeof(H) === "function" || typeof(L) === "function") {
            return null;
        }
        var H = bytes[1];
        var L = bytes[0];
        var addr = Z80BinUtil.pair(H,L);
        return addr;
    }

    parseAddress.parseNumLiteral = function(tok) {
        var n = parseAddress._parseNumLiteral(tok);
        if(typeof(n) == 'number') {
            if(n < -128 || 256 <= n) {
                throw 'operand ' + tok + ' out of range';
            }
            return n & 0xff;
        }
        return function(dictionary) {
            return parseAddress.dereferLowByte(tok, dictionary);
        };
    };

    parseAddress.parseNumLiteralPair = function(tok) {
        var n = parseAddress._parseNumLiteral(tok);
        if(typeof(n) == 'number') {
            if(n < -32768 || 65535 < n) {
                throw 'operand ' + tok + ' out of range';
            }
            return [n & 0xff, (n >> 8) & 0xff];
        }
        return [
            function(dictionary){ return parseAddress.dereferLowByte(tok, dictionary); },
            function(dictionary){ return parseAddress.dereferHighByte(tok, dictionary); }
        ];
    };

    parseAddress.parseRelAddr = function(tok, fromAddr) {
        var n = parseAddress._parseNumLiteral(tok);
        if(typeof(n) == 'number') {
            var c0 = tok.charAt(0);
            if(c0 != '+' && c0 != '-') {
                n = n - fromAddr + 2;
            }
            n -= 2;
            if(n < -128 || 256 <= n) {
                throw 'operand ' + tok + ' out of range';
            }
            return n & 0xff;
        }
        return function(dictionary) {
            return (parseAddress.derefer(tok, dictionary) - fromAddr) & 0xff;
        };
    };

    parseAddress.dereferLowByte = function(label, dictionary) {
        return parseAddress.derefer(label, dictionary) & 0xff;
    };

    parseAddress.dereferHighByte = function(label, dictionary) {
        return (parseAddress.derefer(label, dictionary) >> 8) & 0xff;
    };

    parseAddress.derefer = function(label, dictionary) {
        if(label in dictionary) {
            return dictionary[label];
        }
        return 0;
    };

    parseAddress._parseNumLiteral = function(tok) {
        if(/^[+-]?[0-9]+$/.test(tok) || /^[+-]?[0-9A-F]+H$/i.test(tok)) {
            var matches;
            var n = 0;
            var s = (/^-/.test(tok) ? -1:1);
            if(/[hH]$/.test(tok)) {
                matches = tok.match(/^[+-]?([0-9a-fA-F]+)[hH]$/);
                n = parseInt(matches[1], 16);
            } else if(/^[+-]?0/.test(tok)) {
                matches = tok.match(/^[+-]?([0-7]+)$/);
                n = parseInt(matches[1], 8);
            } else {
                matches = tok.match(/^[+-]?([0-9]+)$/);
                n = parseInt(matches[1], 10);
            }
            return s * n;
        }
        return tok;
    };

    module.exports = parseAddress;
}());
