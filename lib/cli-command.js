(function() {
    "use strict";
    function CliCommand(name, func) {
        this.name = name;
        this.func = func;
    }
    CliCommand.prototype.create = function(name, func) {
        this.name = name;
        this.func = func;
        return this;
    };
    CliCommand.prototype.installTo = function(commandTable) {
        commandTable[this.name] = this;
    };
    module.exports = CliCommand;
}());
