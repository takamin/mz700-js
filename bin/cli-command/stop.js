"use strict";
var CliCommand = require("./command");
module.exports = new CliCommand("stop", function(mz700/*, args*/) {
    mz700.stop();
});
