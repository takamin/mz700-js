(function() {
    "use strict";
    var fs = require('fs');
    var rmdir = require('rmdir');
    var gitClone = require('git-clone');
    var cloneTransworker = function() {
        gitClone(
            'https://github.com/takamin/transworker.git',
            'lib/transworker',
            function(err) {
                if(err) {
                    console.error(JSON.stringify(err, null, '    '));
                }
            });
    }
    try {
        var stats = fs.lstatSync('lib/transworker');
        if(stats.isDirectory()) {
            rmdir('lib/transworker', function (err, dirs, files) {
                cloneTransworker();
            });
        }
    } catch (ex) {
        console.error(JSON.stringify(ex, null, '    '));
    }
    cloneTransworker();
}());
