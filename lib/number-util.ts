"use strict";
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

}
module.exports = NumberUtil;