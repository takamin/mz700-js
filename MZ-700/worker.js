//
// Codes for Worker context.
// Override the methods in Worker context
//
(function(g) {
    "use strict";
    require("../lib/context.js");
    if(!g.context.webWorker) {
        throw new Error("This script must run on WebWorker context.");
    }
    var TransWorker = require('transworker');
    var MZ700 = require('./emulator');
    TransWorker.create(MZ700);
}(Function("return this;")()));
