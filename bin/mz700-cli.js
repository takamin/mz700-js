#!/usr/bin/env node
"use strict";
const path = require("path");
const Getopt = require('node-getopt');
const HashArg = require("hash-arg");
const readline = require("linebyline")(process.stdin);

const MZ700 = require("../js/MZ-700/mz700.js");
const PCG700 = require("../js/lib/PCG-700");
const getPackageJson = require("./lib/get-package-json");
const {
    readMzNewmon7Rom,
    loadMzt,
    loadCmt,
    writeMzt,
} = require("./lib/mz-files");

const CliCommand = require("./cli-command/command.js");
const cliCommandSendKey = require("./cli-command/sendkey.js");
const cliCommandVram = require("./cli-command/vram.js");
const commands = new CliCommand();
commands.install([
    require("./cli-command/exit.js"),
    require("./cli-command/register.js"),
    require("./cli-command/run.js"),
    require("./cli-command/stop.js"),
    require("./cli-command/step.js"),
    require("./cli-command/jump.js"),
    require("./cli-command/breakpoint.js"),
    require("./cli-command/mem.js"),
    cliCommandSendKey,
    cliCommandVram,
    require("./cli-command/cmt.js"),
    require("./cli-command/conf.js")
]);
cliCommandSendKey.setMakeReleaseDurations(200,50);

const getopt = new Getopt([
    ['c',   'set-cmt=FILENAME',  'set MZT file as cassette magnetic tape'],
    ['h',   'help',     'display this help'],
    ['v',   'version',  'show version']
    ]);
const npm = getPackageJson(path.join(__dirname, ".."));
const description = "The Cli-Version MZ-700 Emulator. -- " + npm.name + "@" + npm.version;
getopt.setHelp(
    "Usage: mz700-cli [OPTION] [MZT-filename]\n" +
    description + "\n" +
    "\n" +
    "[[OPTIONS]]\n" +
    "\n" +
    "Installation: npm install -g mz700-js\n" +
    "Repository: https://github.com/takamin/mz700-js");

const cli = getopt.parseSystem();
if(cli.options.help) {
    getopt.showHelp();
    return;
}
if(cli.options.version) {
    console.log(description);
    return;
}
console.log(description);

const argv = HashArg.get(["input_filename"], cli.argv);

MZ700.prototype.subscribe = function(notify, handler) {
    console.log(`subscribe ${notify} = ${handler}`);
};

function createMZ700() {
    const mz700 = new MZ700();
    mz700.create({
        "started": ()=> { /* empty */ },
        "stopped": ()=> { /* empty */ },
        "onBreak" : ()=> { /* empty */ },
        "onVramUpdate": (index, dispcode, attr)=>{
            cliCommandVram.setAt(index, dispcode, attr);
        },
        'startSound': ()=> { /* empty */ },
        'stopSound': ()=> { /* empty */ },
        "onStartDataRecorder": ()=>{ /* empty */ },
        "onStopDataRecorder": ()=>{ /* empty */ }
    });
    return mz700;
}

async function main() {
    const fnCmt = cli.options["set-cmt"];
    const fnLoad = argv.input_filename;
    const [newmon7, cassetteTape, mztList] = await Promise.all([
        readMzNewmon7Rom(),
        fnCmt ? loadCmt(fnCmt) : null,
        fnLoad ? loadMzt(fnLoad) : null,
    ]);

    const mz700 = createMZ700();
    const pcg700 = new PCG700();
    mz700.attachPCG700(pcg700);

    mz700.setMonitorRom(newmon7);
    if(cassetteTape) {
        mz700.setCassetteTape(cassetteTape);
    }
    if(mztList) {
        writeMzt(mz700, mztList);
    }

    readline.on("line", line => {
        commands.executeCommandline(line, mz700, line);
    });
    commands.runCli();
}
main().catch(err => console.error(`Error: ${err.stack}`));
