(function(){
    "use strict";
    var CliCommand = require("./cli-command");
    module.exports = new CliCommand("run", function(mz700/*, args*/) {
        mz700.start();
    });
}());
