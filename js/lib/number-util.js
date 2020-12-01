"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NumberUtil {
    static zs(num, base, columns) {
        const s = num.toString(base);
        if (s.length > columns) {
            return s;
        }
        return (`${(new Array(columns)).fill("0").join("")}${s}`).slice(-columns);
    }
    static bin(num, columns) {
        return NumberUtil.zs(num, 2, columns);
    }
    static hex(num, columns) {
        return NumberUtil.zs(num, 16, columns).toUpperCase();
    }
    static HEX(num, columns) {
        return NumberUtil.zs(num, 16, columns).toUpperCase();
    }
    static to8bitSigned(i8u) {
        if ((~0xff & i8u) !== 0) {
            throw new Error([
                `Invalid input value ${i8u}`,
                `(should be between 0 and 255)`,
            ].join(" "));
        }
        if (i8u >= 128) {
            return -(~(i8u - 1) & 0xff);
        }
        return i8u | 0;
    }
    static to8bitUnsigned(i8s) {
        if (i8s < -128 || 127 < i8s) {
            throw new Error([
                `Invalid input value ${i8s}`,
                `(should be between -128 and 127)`,
            ].join(" "));
        }
        if (i8s < 0) {
            return ~(-(i8s + 1)) & 0xff;
        }
        return i8s | 0;
    }
}
exports.default = NumberUtil;
module.exports = NumberUtil;
//# sourceMappingURL=number-util.js.map