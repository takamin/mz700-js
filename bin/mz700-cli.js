#!/usr/bin/env node
(function() {
    "use strict";

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

    var readline = require("linebyline")(process.stdin);
    require("../lib/context.js");
    require("../lib/ex_number.js");
    var MZ700 = require("../MZ-700/MZ-700.js");
    var mztReadFile = require("../lib/mzt-read-file");

    var CliCommand = require("../lib/cli/command.js");
    var commands = new CliCommand();
    commands.install([
        require("../lib/cli/exit.js"),
        require("../lib/cli/register.js"),
        require("../lib/cli/run.js"),
        require("../lib/cli/stop.js"),
        require("../lib/cli/step.js"),
        require("../lib/cli/jump.js"),
        require("../lib/cli/breakpoint.js"),
        require("../lib/cli/mem.js")
    ]);
    var cliCommandSendKey = require("../lib/cli/sendkey.js");
    var cliCommandVram = require("../lib/cli/vram.js");
    var cliCommandCmt = require("../lib/cli/cmt.js");
    commands.install([
        cliCommandSendKey,
        cliCommandVram,
        cliCommandCmt
    ]);

    commands.install(require("../lib/cli/conf.js"));

    var mz700 = new MZ700({
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
            //console.log("MMIO read addr", address.HEX(4) + "H", value.HEX(2) + "H");
            mmio.read(address, value);
        },
        'onMmioWrite': function(address, value) {
            //console.log("MMIO write addr", address.HEX(4) + "H", value.HEX(2) + "H");
            mmio.write(address, value);
        },
        "onPortRead": function(/*port, value*/){
            //console.log("IN ", port.HEX(2) + "H", value.HEX(2) + "H");
        },
        "onPortWrite": function(port, value){
            console.log("OUT ", port.HEX(2) + "H", value.HEX(2) + "H");
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

    var mmio = require("../MZ-700/mz-mmio.js").create();
    var mmioMapPeripheral = function(peripheral, mapToRead, mapToWrite) {
        mmio.entry(peripheral, mapToRead, mapToWrite);
        mz700.mmioMapToRead(mapToRead);
        mz700.mmioMapToWrite(mapToWrite);
    };

    var PCG700 = require("../lib/PCG-700").create();
    PCG700.writeMMIO(0xE010, 0x00);
    PCG700.writeMMIO(0xE011, 0x00);
    PCG700.writeMMIO(0xE012, 0x18);
    mmioMapPeripheral(PCG700, [], [0xE010, 0xE011, 0xE012]);

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
                            mzt.header.addr_load.HEX(4) + "h --- " +
                            (mzt.header.addr_load + mzt.header.file_size - 1).HEX(4) + "h " +
                            "(" + mzt.header.file_size + " bytes), " +
                            mzt.header.addr_exec.HEX(4) + "h, " + mzt.header.filename);
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
