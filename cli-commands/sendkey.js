/* global Promise */
(function(){
    "use strict";
    var CliCommand = require("../lib/cli-command");
    var MZ700KeyMatrix = require("../MZ-700/mz700-key-matrix.js");
    function CliCommandSendKey() {
        this._durationMake = 250;
        this._durationRelease = 250;
    }
    CliCommandSendKey.prototype = new CliCommand("key", function(mz700, args) {
        var inkey = [];
        var s = args.join(" ").toUpperCase();
        var i = 0;
        while(i < s.length) {
            var c = s.charAt(i);
            if(c == '\\') {
                i++;
                if(i < s.length) {
                    inkey.push(s.charAt(i));
                }
            } else if(c == '[') {
                c = "";
                i++;
                while(i < s.length && s.charAt(i) != ']') {
                    c += s.charAt(i);
                    i++;
                }
                if(i < s.length && c != "") {
                    inkey.push(c);
                }
                i++;
            } else {
                inkey.push(s.charAt(i));
            }
            i++;
        }
        var pushKeys = [];
        inkey.forEach(function(strcode) {
            if(strcode in MZ700KeyMatrix.Str2Key) {
                var key = MZ700KeyMatrix.Str2Key[strcode];
                pushKeys.push(key);
            } else {
                console.log("Not found" + strcode);
            }
        });
        var durationRelease = this._durationRelese;
        var durationMake = this._durationMake;
        var pushKey = function(key) {
            return new Promise(function(resolv, reject) {
                try {
                    mz700.setKeyState(key.strobe, key.bit, true, null);
                    setTimeout(function() {
                        mz700.setKeyState(key.strobe, key.bit, false, null);
                        setTimeout(function() { resolv(); },
                            durationRelease);
                    }, durationMake);
                } catch(ex) {
                    reject(ex);
                }
            });
        };
        return new Promise(function(resolv, reject) {
            var sendKeys = function(i) {
                try {
                    var key = pushKeys[i];
                    console.log("SEND KEY [" + i + "/" + pushKeys.length + "] " + key.face);
                    pushKey(key).then(function() {
                        if(++i < pushKeys.length) {
                            sendKeys(i);
                        } else {
                            resolv();
                        }
                    }).catch(function(err) {
                        console.log(err);
                    });
                } catch(err) {
                    reject(err);
                }
            };
            sendKeys(0);
        });
    });
    CliCommandSendKey.prototype.setMakeReleaseDurations = function(
            durationMake, durationRelease)
    {
        this._durationMake = durationMake;
        this._durationRelease = durationRelease;
    };
    module.exports = new CliCommandSendKey();
}());

