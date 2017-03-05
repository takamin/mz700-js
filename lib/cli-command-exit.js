(function(){
    "use strict";
    var CliCommand = require("./cli-command");
    module.exports = new CliCommand("exit", function(mz700, args) {
        mz700.stop();
        process.exit(0);
    });
}());
