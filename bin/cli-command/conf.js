"use strict";
var CliCommand = require("./command");
function CliCommandConf() {
    this._sendKey = null;
    this._commands = {
        "key" : {
            "duration": {
                "make": function(mz700, args) {
                    if(args.length == 0) {
                        console.log("conf key duration make: " +
                                this._sendKey._durationMake +
                                " [ms]");
                    } else {
                        this._sendKey._durationMake =
                            parseInt(args[0]);
                    }
                },
                "release": function(mz700, args) {
                    if(args.length == 0) {
                        console.log("conf key duration release: " +
                                this._sendKey._durationRelease +
                                " [ms]");
                    } else {
                        this._sendKey._durationRelease =
                            parseInt(args[0]);
                    }
                }
            }
        }
    };
}
CliCommandConf.prototype = new CliCommand("conf",
    function(mz700, args) {
        return this.executeSubCommand(args, mz700, args);
    }
);
CliCommandConf.prototype.installTo = function(table) {
    this._sendKey = table._commands.key;
    CliCommand.prototype.installTo.call(this, table);
};
module.exports = new CliCommandConf();
