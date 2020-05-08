#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { HEX } = require("../lib/number-util.js");
const getPackageJson = require("./lib/get-package-json");
const npmInfo = getPackageJson(path.join(__dirname, ".."));

/**
 * Read NEWMON7.ROM
 * @returns {UintA8Array} A NEWMON7 binary
 */
function readMzNewmon7Rom() {
    const pathname = path.join(
        __dirname, "../mz_newmon/ROMS/NEWMON7.ROM");
    const buffer = fs.readFileSync(pathname);
    return Uint8Array.from(buffer);
}

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

const CliCommand = require("./cli-command/command.js");
const commands = new CliCommand();
commands.install([
    require("./cli-command/exit.js"),
    require("./cli-command/register.js"),
    require("./cli-command/run.js"),
    require("./cli-command/stop.js"),
    require("./cli-command/step.js"),
    require("./cli-command/jump.js"),
    require("./cli-command/breakpoint.js"),
    require("./cli-command/mem.js")
]);
const cliCommandSendKey = require("./cli-command/sendkey.js");
const cliCommandVram = require("./cli-command/vram.js");
const cliCommandCmt = require("./cli-command/cmt.js");
commands.install([
    cliCommandSendKey,
    cliCommandVram,
    cliCommandCmt
]);
cliCommandSendKey.setMakeReleaseDurations(200,50);

commands.install(require("./cli-command/conf.js"));

const MZ700 = require("../MZ-700/mz700.js");
MZ700.prototype.subscribe = function(notify, handler) {
    console.log(`subscribe ${notify} = ${handler}`);
};
const mz700 = new MZ700();
mz700.create({
    "started": ()=> { },
    "stopped": ()=> { },
    "onBreak" : ()=> { },
    "onVramUpdate": (index, dispcode, attr)=>{
        cliCommandVram.setAt(index, dispcode, attr);
    },
    'startSound': (/*freq*/)=> {
        //console.log("bz:", freq, "Hz");
    },
    'stopSound': ()=> {
        //console.log("bz: off");
    },
    "onStartDataRecorder": ()=>{
        //console.log("MOTOR: ON");
    },
    "onStopDataRecorder": ()=>{
        //console.log("MOTOR: OFF");
    }
});
mz700.setMonitorRom(readMzNewmon7Rom());

const PCG700 = require("../lib/PCG-700");
const pcg700 = new PCG700();
mz700.mmio.onWrite(0xE010, value => pcg700.setPattern(value & 0xff));
mz700.mmio.onWrite(0xE011, value => pcg700.setAddrLo(value & 0xff));
mz700.mmio.onWrite(0xE012, value => {
    pcg700.setAddrHi(value & PCG700.ADDR);
    pcg700.setCopy(value & PCG700.COPY);
    pcg700.setWE(value & PCG700.WE);
    pcg700.setSSW(value & PCG700.SSW);
});
mz700.memory.poke(0xE010, 0x00);
mz700.memory.poke(0xE011, 0x00);
mz700.memory.poke(0xE012, 0x18);

const readline = require("linebyline")(process.stdin);
readline.on("line", line => {
    commands.executeCommandline(line, mz700, line);
});

const mztReadFile = require("./cli-command/mzt-read-file");
const mztWriteMem = (mz700, mzt) => {
    const addr = mzt.header.addr_load;
    const buf = mzt.body.buffer;
    const size = mzt.header.file_size;
    for(let i = 0; i < size; i++) {
        mz700.memory.poke(addr + i, buf[i]);
    }
};

(async () => {
    try {
        if(cli.options["set-cmt"]) {
            const filename = cli.options["set-cmt"];
            await cliCommandCmt.func.call(
                cliCommandCmt, mz700, ["set", filename]);
        }
        //Input file
        if(!argv.input_filename) {
            commands.runCli();
        } else {
            const mzt_list = await mztReadFile(argv.input_filename);
            if(mzt_list != null && mzt_list.length > 0) {
                mzt_list.forEach((mzt, i) => {
                    console.log("[" + (i + 1) + "/" + mzt_list.length + "] " +
                        HEX(mzt.header.addr_load, 4) + "h --- " +
                        HEX((mzt.header.addr_load + mzt.header.file_size - 1), 4) + "h " +
                        "(" + mzt.header.file_size + " bytes), " +
                        HEX(mzt.header.addr_exec, 4) + "h, " + mzt.header.filename);
                    mztWriteMem(mz700, mzt);
                });
            }
            commands.runCli();
        }
    } catch(err) {
        console.log(err);
    }
})();
