(function(){
    "use strict";
    var CliCommand = require("./command");
    var { parseAddress } = require("../../lib/parse-addr");
    var { HEX } = require("../../lib/number-util");
    module.exports = new CliCommand("bp", function(mz700, args) {
        var bp = mz700.getBreakPoints();
        if(args.length > 0) {
            var bp_cmd = args[0];
            if(bp_cmd != "set" && bp_cmd != "rm" && bp_cmd != "clear") {
                console.log("Error: Unrecognized", bp_cmd);
                return false;
            }
            if(bp_cmd == "clear") {
                if(args.length > 1) {
                    console.log("Error: No a parameter for 'clear'");
                    return false;
                }
                mz700.clearBreakPoints();
                return;
            }
            var address_list = args.slice(1);
            address_list.forEach(function(addrTok) {
                var addr = parseAddress(addrTok);
                if(bp_cmd == "set") {
                    mz700.addBreak(addr, 1, null);
                } else if(bp_cmd == "rm") {
                    mz700.removeBreak(addr, 1, null);
                }
            });
        }
        bp.forEach(function(state, addr) {
            if(state != null) {
                console.log(
                    "ADDR:" + HEX(parseInt(addr), 4) + "H",
                    state);
            }
        });
    });
}());

