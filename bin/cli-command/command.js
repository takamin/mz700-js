"use strict";
function CliCommand(name, func) {
    this.name = name;
    this.func = func;
    this._commandEngine = null;

    this.tasklist = [];
    this._commands = {};
}
CliCommand.prototype.create = function(name, func) {
    this.name = name;
    this.func = func;
    return this;
};
CliCommand.prototype.install = function(command) {
    if(Array.isArray(command)) {
        command.forEach(item => {
            this.install(item);
        });
    } else {
        command.installTo(this);
    }
    return command;
};
CliCommand.prototype.installTo = function(commandTable) {
    console.log("cli command " + this.name);
    commandTable._commands[this.name] = this;
    this._commandEngine = commandTable;
};
CliCommand.prototype.putPrompt = function(ok) {
    if(ok) {
        console.log("OK.");
        console.log("");
    }
    process.stdout.write('command > ');
};
CliCommand.prototype.executeCommandline = function(line, mz700) {
    var commandTokens = line.split(/\s/);
    if(commandTokens[0] == '') {
        this.putPrompt(false);
        return;
    }
    var command = this.searchCommand(commandTokens);
    this.executeCommand(command, mz700, line);
};
CliCommand.prototype.searchCommand = function(commandline) {
    var _commands = this._commands;
    var running = true;
    while(running) {
        const [ command, ...args ] = commandline;
        if(!command) {
            this.putPrompt(false);
            return { entry: null, func: null, args: null };
        }
        if(command in _commands) {
            var def = _commands[command];
            if(def.constructor.name == "CliCommand" ||
                    "func" in def &&
                    typeof(def.func) == "function")
            {
                return { entry: def, func: def.func, args: args };
            } else if(typeof(def) == 'function') {
                return { entry: null, func: def, args: args };
            } else if(typeof(def) == 'object') {
                _commands = def;
                commandline = args;
            } else {
                running = false;
            }
        } else {
            running = false;
        }
    }
    return null;
};
CliCommand.prototype.executeCommand = function(command, mz700, commandline) {
    if(command != null && command.func != null) {
        this.tasklist.push(() => command.func.call(
            command.entry, mz700, command.args));
    } else {
        this.tasklist.push(() => {
            console.log("Error: Unrecognized command: ", commandline);
            return false;
        });
    }
};
CliCommand.prototype.executeSubCommand = function(args, mz700) {
    var command = this.searchCommand(args);
    if(command != null) {
        command.entry = this;
    }
    this._commandEngine.executeCommand(
        command, mz700,
        this.name+ " " + args.join(' '));

    return false;
};
CliCommand.prototype.runCli = function() {
    const procCommandLine = async () => {
        if(this.tasklist.length > 0) {
            while(this.tasklist.length > 0) {
                const task = this.tasklist.shift();
                const promise = task();
                if(promise && promise.constructor === Promise) {
                    try {
                        await promise;
                    } catch(err) {
                        console.log(err);
                    }
                }
            }
            this.putPrompt(true);
        }
        setTimeout(procCommandLine, 50);
    }
    this.putPrompt(true);
    procCommandLine();
};
module.exports = CliCommand;
