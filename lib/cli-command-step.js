(function(){
    "use strict";
    var CliCommand = require("./cli-command");
    module.exports = new CliCommand("step", function(mz700, args) {
        var count = 1;
        if(args.length == 1) {
            count = parseInt(args[0]);
        }
        mz700.exec(count);
    });
}());

