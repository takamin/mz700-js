(function() {
    "use strict";
    var fs = require("fs");
    module.exports = function(moduleRootPath) {
        try {
            var fname = (moduleRootPath||"..") + "/package.json";
            return JSON.parse(fs.readFileSync(fname, "utf-8"));
        } catch (ex) {
            console.log("get-package-json: ERROR " + ex);
            throw ex;
        }
    };
}());
