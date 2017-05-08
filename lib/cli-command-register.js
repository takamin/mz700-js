(function(){
    "use strict";
    var CliCommand = require("./cli-command");
    module.exports = new CliCommand("reg", function(mz700/*, args*/) {
        var reg = mz700.getRegister();
        console.log(
                "HL:", reg.getHL().HEX(4) + "H",
                "BC:", reg.getBC().HEX(4) + "H",
                "DE:", reg.getDE().HEX(4) + "H",
                "A:", reg.A.HEX(2) + "H",
                "F:", reg.F.HEX(2) + "H",
                "PC:", reg.PC.HEX(4) + "H",
                "SP:", reg.SP.HEX(4) + "H",
                "IX:", reg.IX.HEX(4) + "H",
                "IY:", reg.IY.HEX(4) + "H",
                "R:", reg.R.HEX(2) + "H",
                "I:", reg.I.HEX(2) + "H");
    });
}());

