#!/usr/bin/env node
(function() {
    "use strict";
    var getopt = require('node-getopt').create([
            ['c',   'set-cmt=ARG',  'set cassete magnetic tape'],
            ['h',   'help',     'display this help'],
            ['v',   'version',  'show version']
            ]).bindHelp().parseSystem();
    var argv = require("hash-arg").get(["input_filename"], getopt.argv);

    var readline = require("linebyline")(process.stdin);
    var fnut = require("../lib/fnuts.js");
    require("../lib/context.js");
    require("../lib/ex_number.js");
    var TBooster = require('../lib/t-booster');
    var MZ700 = require("../MZ-700/emulator.js");
    var mztReadFile = require("../lib/mzt-read-file");

    var CliCommand = require("../lib/cli-command.js");
    var commands = new CliCommand();
    commands.install([
        require("../lib/cli-command-exit.js"),
        require("../lib/cli-command-register.js"),
        require("../lib/cli-command-run.js"),
        require("../lib/cli-command-stop.js"),
        require("../lib/cli-command-step.js"),
        require("../lib/cli-command-jump.js"),
        require("../lib/cli-command-breakpoint.js"),
        require("../lib/cli-command-mem.js")
    ]);
    var cliCommandSendKey = require("../lib/cli-command-sendkey.js");
    var cliCommandVram = require("../lib/cli-command-vram.js");
    var cliCommandCmt = require("../lib/cli-command-cmt.js");
    commands.install([
        cliCommandSendKey,
        cliCommandVram,
        cliCommandCmt
    ]);

    commands.install(require("../lib/cli-command-conf.js"));

    var mz700 = new MZ700({
        "onExecutionParameterUpdate" : function() { },
        "onBreak" : function() { },
        "onVramUpdate": function(index, dispcode, attr){
            cliCommandVram.setAt(index, dispcode, attr);
        },
        'onMmioRead': function(address, value) {
            //console.log("MMIO read addr", address.HEX(4) + "H", value.HEX(2) + "H");
            MMIO.read(address, value);
        },
        'onMmioWrite': function(address, value) {
            //console.log("MMIO write addr", address.HEX(4) + "H", value.HEX(2) + "H");
            MMIO.write(address, value);
        },
        "onPortRead": function(port, value){
            //console.log("IN ", port.HEX(2) + "H", value.HEX(2) + "H");
        },
        "onPortWrite": function(port, value){
            console.log("OUT ", port.HEX(2) + "H", value.HEX(2) + "H");
        },
        'startSound': function(freq) {
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

    mz700.setExecutionParameter(
            (new TBooster.Param(200,10,1)).get());
    cliCommandSendKey.setMakeReleaseDurations(200,50);

    var memsetMZ = function(addr, buf, size) {
        for(var i = 0; i < size; i++) {
            mz700.memory.poke(addr + i, buf[i]);
        }
    };

    var MMIO = require("../MZ-700/mmio").create();
    var mmioMapPeripheral = function(peripheral, mapToRead, mapToWrite) {
        MMIO.entry(peripheral, mapToRead, mapToWrite);
        mz700.mmioMapToRead(mapToRead);
        mz700.mmioMapToWrite(mapToWrite);
    };

    var PCG700 = require("../lib/PCG-700").create();
    PCG700.setScreen();
    PCG700.writeMMIO(0xE010, 0x00);
    PCG700.writeMMIO(0xE011, 0x00);
    PCG700.writeMMIO(0xE012, 0x18);
    mmioMapPeripheral(PCG700, [], [0xE010, 0xE011, 0xE012]);

    (new Promise(function(resolv, reject) {
        if(getopt.options["set-cmt"]) {
            var filename = getopt.options["set-cmt"];
            cliCommandCmt.func.call(
                cliCommandCmt, mz700, ["set", filename]
            ).then(function(){
                resolv();
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
