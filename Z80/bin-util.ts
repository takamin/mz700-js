"use strict";

/* tslint:disable:no-bitwise */

export default class Z80BinUtil {
    static pair(h:number, l:number):number {
        return ((0xff & h) << 8) + (0xff & l);
    }
    static hibyte(nn:number):number {
        return (nn >> 8) & 0xff;
    }
    static lobyte(nn:number):number {
        return nn & 0xff;
    }
    static getSignedByte(e:number):number {
        e = e & 0xff;
        if(e & 0x80) {
            e = ((~e) & 0xff) + 1;
            return -e;
        }
        return e;
    }
}
module.exports = Z80BinUtil;