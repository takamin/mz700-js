"use strict";
var CliCommand = require("./command");
module.exports = new CliCommand("exit", function(mz700/*, args*/) {
    mz700.stop();
    process.exit(0);
});
