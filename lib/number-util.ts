"use strict";

/* tslint:disable: no-bitwise */

export default class NumberUtil {
    static zs(num:number, base:number, columns:number):string {
        const s = num.toString(base);
        if(s.length > columns) {
            return s;
        }
        return (`${(new Array(columns)).fill("0").join("")}${s}`).slice(-columns);
    }
    static bin(num:number, columns:number):string {
        return NumberUtil.zs(num, 2, columns);
    }
    static hex(num:number, columns:number):string {
        return NumberUtil.zs(num, 16, columns).toUpperCase();
    }
    static HEX(num:number, columns:number):string {
        return NumberUtil.zs(num, 16, columns).toUpperCase();
    }
    /**
     * Convert unsigned 8 bit integer to signed.
     * @param {number} i8u The input value
     * @returns {number} The converted 8 bit signed integer.
     */
    static to8bitSigned(i8u:number):number {
        if((~0xff & i8u) !== 0) {
            throw new Error([
                `Invalid input value ${i8u}`,
                `(should be between 0 and 255)`,
            ].join(" "));
        }
        if(i8u >= 128) {
            return -( ~(i8u - 1) & 0xff );
        }
        return i8u|0;
    }

    /**
     * Convert signed 8 bit integer to unsigned.
     * @param {number} i8s The input value
     * @returns {number} The converted 8 bit signed integer.
     */
    static to8bitUnsigned(i8s:number):number {
        if(i8s < -128 || 127 < i8s) {
            throw new Error([
                `Invalid input value ${i8s}`,
                `(should be between -128 and 127)`,
            ].join(" "));
        }
        if(i8s < 0) {
            return ~(-(i8s + 1)) & 0xff;
        }
        return i8s|0;
    }

}
module.exports = NumberUtil;