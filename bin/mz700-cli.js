#!/usr/bin/env node
(function() {
    "use strict";

    const NumberUtil = require("../lib/number-util.js");
    var getPackageJson = require("../lib/get-package-json");
    var npmInfo = getPackageJson(__dirname + "/..");
    var Getopt = require('node-getopt');
    var getopt = new Getopt([
            ['c',   'set-cmt=FILENAME',  'set MZT file as cassette magnetic tape'],
            ['h',   'help',     'display this help'],
            ['v',   'version',  'show version']
            ]);
    var cli = getopt.parseSystem();
    var argv = require("hash-arg").get(["input_filename"], cli.argv);
    var description = "The Cli-Version MZ-700 Emulator. -- " + npmInfo.name + "@" + npmInfo.version;
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

    const mzMMIO = new MZMMIO();
    const mz700 = new MZ700({
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

    mz700.setExecutionParameter(MZ700.DEFAULT_TIMER_INTERVAL);
    cliCommandSendKey.setMakeReleaseDurations(200,50);

    var memsetMZ = function(addr, buf, size) {
        for(var i = 0; i < size; i++) {
            mz700.memory.poke(addr + i, buf[i]);
        }
    };

    const pcg700 = new PCG700();
    pcg700.setupMMIO(mzMMIO);
    mz700.memory.poke(0xE010, 0x00);
    mz700.memory.poke(0xE011, 0x00);
    mz700.memory.poke(0xE012, 0x18);

    (new Promise(function(resolv, reject) {
        if(cli.options["set-cmt"]) {
            var filename = cli.options["set-cmt"];
            cliCommandCmt.func.call(
                cliCommandCmt, mz700, ["set", filename]
            ).then(function(){
                resolv();
            }).catch(function(err){
                reject(err);
            });
        } else {
            resolv();
        }
    })).then(function() {
        readline.on("line", function(line) {
            commands.executeCommandline(line, mz700, line);
        });
        //Input file
        if(!argv.input_filename) {
            commands.runCli();
        } else {
            mztReadFile(argv.input_filename).then(function(mzt_list) {
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
            }).catch(function(err) {
                console.log(err);
            });
        }
    }).catch(function(err) {
        console.log(err);
    });
}());
