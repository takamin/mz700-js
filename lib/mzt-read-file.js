/* global Promise */
(function() {
    "use strict";
    var fs = require('fs');
    var MZ700 = require("../MZ-700/mz700.js");
    module.exports = function (filename) {
        return new Promise(function(resolv, reject) {
            if(!filename) {
                resolv(null);
                return;
            }
            console.log("Loading " + filename + " ... ");
            fs.readFile(filename, function(err, data) {
                if(err) {
                    reject(err);
                } else {
                    var mzt_list = MZ700.parseMZT(data);
                    if(mzt_list == null || !Array.isArray(mzt_list) || mzt_list.length == 0) {
                        reject("Error could not read " + filename);
                    }
                    resolv(mzt_list);
                }
            });
        });
    };
}());
