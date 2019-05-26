"use strict";
module.exports = {
    zs: (num, base, columns) => {
        const s = num.toString(base);
        if(s.length > columns) {
            return s;
        }
        return (`${(new Array(columns)).fill("0").join("")}${s}`).slice(-columns);
    },
    bin: (num, columns) => {
        return module.exports.zs(num, 2, columns);
    },
    hex: (num, columns) => {
        return module.exports.zs(num, 16, columns).toUpperCase();
    },
    HEX: (num, columns) => {
        return module.exports.zs(num, 16, columns).toUpperCase();
    },
};