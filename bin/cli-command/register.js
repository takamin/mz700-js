"use strict";
const NumberUtil = require("../../lib/number-util.js");
var CliCommand = require("./command");
module.exports = new CliCommand("reg", function(mz700/*, args*/) {
    var reg = mz700.getRegister();
    console.log([
            `HL:${NumberUtil.HEX(reg.H, 2)}${NumberUtil.HEX(reg.L, 2)}H`,
            `BC:${NumberUtil.HEX(reg.B, 2)}${NumberUtil.HEX(reg.C, 2)}H`,
            `DE:${NumberUtil.HEX(reg.D, 2)}${NumberUtil.HEX(reg.E, 2)}H`,
            `A:${NumberUtil.HEX(reg.A, 2)}H`,
            `F:${NumberUtil.HEX(reg.F, 2)}H`,
            `PC:${NumberUtil.HEX(reg.PC, 4)}H`,
            `SP:${NumberUtil.HEX(reg.SP, 4)}H`,
            `IX:${NumberUtil.HEX(reg.IX, 4)}H`,
            `IY:${NumberUtil.HEX(reg.IY, 4)}H`,
            `R:${NumberUtil.HEX(reg.R, 2)}H`,
            `I:${NumberUtil.HEX(reg.I, 2)}H`,
    ].join(" "));
});

