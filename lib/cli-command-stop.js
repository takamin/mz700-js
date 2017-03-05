(function(){
    "use strict";
    var CliCommand = require("./cli-command");
    module.exports = new CliCommand("stop", function(mz700, args) {
        mz700.stop();
    });
}());


