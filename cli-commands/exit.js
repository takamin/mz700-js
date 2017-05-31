(function(){
    "use strict";
    var CliCommand = require("../lib/cli-command");
    module.exports = new CliCommand("exit", function(mz700/*, args*/) {
        mz700.stop();
        process.exit(0);
    });
}());
