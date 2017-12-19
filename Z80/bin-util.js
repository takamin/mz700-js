/* eslint no-unused-vars: "off" */
"use strict";
module.exports = (function (stdlib, foreign, heap) {
    "use asm";
    function pair(h, l) {
        h = h|0;
        l = l|0;
        return (((0xff & h) << 8) + (0xff & l))|0;
    }
    function hibyte(nn) {
        nn = nn|0;
        return ((nn >> 8) & 0xff)|0;
    }
    function lobyte(nn) {
        nn = nn | 0;
        return (nn & 0xff)|0;
    }
    function getSignedByte(e) {
        e = e|0;
        e = e & 0xff;
        if(e & 0x80) {
            e = (((~e) & 0xff) + 1)|0;
            return -e|0;
        }
        return e|0;
    }
    return {
        pair: pair,
        hibyte: hibyte,
        lobyte: lobyte,
        getSignedByte: getSignedByte
    };
}(Function("return this;")()));
