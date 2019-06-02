(function(){
    "use strict";
    var CliCommand = require("./command");
    var parseAddr = require("../../lib/parse-addr");
    module.exports = new CliCommand("jp", function(mz700, args) {
        if(args.length < 1) {
            console.log("Error: No address specified; 'jp 1234h'");
            return false;
        }
        var addrTok = args[0];
        var addr = parseAddr(addrTok);
        mz700.setPC(addr);
    });
}());
