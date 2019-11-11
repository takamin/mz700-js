#!/usr/bin/env node
"use strict";

const NumberUtil = require("../lib/number-util.js");
const getPackageJson = require("../lib/get-package-json");
const npmInfo = getPackageJson(__dirname + "/..");
const Getopt = require('node-getopt');
const getopt = new Getopt([
        ['c',   'set-cmt=FILENAME',  'set MZT file as cassette magnetic tape'],
        ['h',   'help',     'display this help'],
        ['v',   'version',  'show version']
        ]);
const cli = getopt.parseSystem();
const argv = require("hash-arg").get(["input_filename"], cli.argv);
const description = "The Cli-Version MZ-700 Emulator. -- " + npmInfo.name + "@" + npmInfo.version;
getopt.setHelp(
        "Usage: mz700-cli [OPTION] [MZT-filename]\n" +
        description + "\n" +
        "\n" +
        "[[OPTIONS]]\n" +
        "\n" +
        "Installation: npm install -g mz700-js\n" +
        "Repository: https://github.com/takamin/mz700-js");

if(cli.options.help) {
    getopt.showHelp();
    return;
}

if(cli.options.version) {
    console.log(description);
    return;
}


console.log(description);

const readline = require("linebyline")(process.stdin);
const MZ700 = require("../MZ-700/mz700.js");
const MZMMIO = require("../lib/mz-mmio.js");
const PCG700 = require("../lib/PCG-700");
const mztReadFile = require("../lib/mzt-read-file");

function MZ700CLI() {
    MZ700.apply(this, Array.from(arguments));
}
MZ700CLI.prototype = new MZ700;
MZ700CLI.prototype.subscribe = function(notify, handler) {
    console.log(`subscribe ${notify} = ${handler}`);
};
MZ700CLI.prototype.setExecutionParameter = function(interval) {
    console.log(`setExecutionParameter(${interval})`);
}
const CliCommand = require("../MZ-700/cli/command.js");
const commands = new CliCommand();
commands.install([
    require("../MZ-700/cli/exit.js"),
    require("../MZ-700/cli/register.js"),
    require("../MZ-700/cli/run.js"),
    require("../MZ-700/cli/stop.js"),
    require("../MZ-700/cli/step.js"),
    require("../MZ-700/cli/jump.js"),
    require("../MZ-700/cli/breakpoint.js"),
    require("../MZ-700/cli/mem.js")
]);
const cliCommandSendKey = require("../MZ-700/cli/sendkey.js");
const cliCommandVram = require("../MZ-700/cli/vram.js");
const cliCommandCmt = require("../MZ-700/cli/cmt.js");
commands.install([
    cliCommandSendKey,
    cliCommandVram,
    cliCommandCmt
]);

commands.install(require("../MZ-700/cli/conf.js"));

const mz700 = new MZ700CLI({
    "onExecutionParameterUpdate" : function() { },
    "started": function() { },
    "stopped": function() { },
    "notifyClockFreq": function() { },
    "onBreak" : function() { },
    "onUpdateScreen": function(/*updateData*/) { },
    "onVramUpdate": function(index, dispcode, attr){
        cliCommandVram.setAt(index, dispcode, attr);
    },
    'onMmioRead': function(address, value) {
        mzMMIO.read(address, value);
    },
    'onMmioWrite': function(address, value) {
        mzMMIO.write(address, value);
    },
    "onPortRead": function(/*port, value*/){
        //console.log("IN ", NumberUtil.HEX(port, 2) + "H", NumberUtil.HEX(value, 2) + "H");
    },
    "onPortWrite": function(port, value){
        console.log("OUT ", NumberUtil.HEX(port, 2) + "H", NumberUtil.HEX(value, 2) + "H");
    },
    'startSound': function(/*freq*/) {
        //console.log("bz:", freq, "Hz");
    },
    'stopSound': function() {
        //console.log("bz: off");
    },
    "onStartDataRecorder": function(){
        //console.log("MOTOR: ON");
    },
    "onStopDataRecorder": function(){
        //console.log("MOTOR: OFF");
    }
});
const mzMMIO = new MZMMIO(mz700);

mz700.setExecutionParameter(MZ700.DEFAULT_TIMER_INTERVAL);
cliCommandSendKey.setMakeReleaseDurations(200,50);

const memsetMZ = function(addr, buf, size) {
    for(let i = 0; i < size; i++) {
        mz700.memory.poke(addr + i, buf[i]);
    }
};

const pcg700 = new PCG700();
pcg700.setupMMIO(mzMMIO);
mz700.memory.poke(0xE010, 0x00);
mz700.memory.poke(0xE011, 0x00);
mz700.memory.poke(0xE012, 0x18);

(async function() {
    try {
        if(cli.options["set-cmt"]) {
            const filename = cli.options["set-cmt"];
            await cliCommandCmt.func.call(
                cliCommandCmt, mz700, ["set", filename]);
        }
        readline.on("line", function(line) {
            commands.executeCommandline(line, mz700, line);
        });
        //Input file
        if(!argv.input_filename) {
            commands.runCli();
        } else {
            const mzt_list = await mztReadFile(argv.input_filename);
            if(mzt_list != null && mzt_list.length > 0) {
                mzt_list.forEach(function(mzt, i) {
                    console.log("[" + (i + 1) + "/" + mzt_list.length + "] " +
                        NumberUtil.HEX(mzt.header.addr_load, 4) + "h --- " +
                        NumberUtil.HEX((mzt.header.addr_load + mzt.header.file_size - 1), 4) + "h " +
                        "(" + mzt.header.file_size + " bytes), " +
                        NumberUtil.HEX(mzt.header.addr_exec, 4) + "h, " + mzt.header.filename);
                    memsetMZ(
                        mzt.header.addr_load,
                        mzt.body.buffer,
                        mzt.header.file_size);
                });
            }
            commands.runCli();
        }
    } catch(err) {
        console.log(err);
    }
}());
