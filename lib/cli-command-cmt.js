(function(){
    "use strict";
    var fs = require('fs');
    var CliCommand = require("./cli-command");
    var MZ_Tape = require('../MZ-700/mz-tape');
    var MZ_TapeHeader = require('../MZ-700/mz-tape-header');
    //var mzt_readFile = require("./load-mzt-file");

    module.exports = new CliCommand("cmt", function(mz700, args) {
        switch(args[0]) {
            case "set":
                if(args.length < 2) {
                    console.log("Blank CMT is set");
                    mz700.dataRecorder_setCmt([]);
                } else {
                    return new Promise(function(resolv, reject) {
                        var filename = args.slice(1).join(' ');
                        fs.readFile(filename, function(err, bytes) {
                            if(err) {
                                reject(err);
                                return false;
                            } else {
                                var header = new MZ_TapeHeader(bytes, 0);
                                console.log("Set CMT: " +
                                        header.addr_load.HEX(4) + "-" +
                                        (header.addr_load + header.file_size - 1).HEX(4) + "(" +
                                        header.file_size + " bytes), Start with" +
                                        header.addr_exec.HEX(4) + "," +
                                        header.filename);
                                var tape = MZ_Tape.fromBytes(bytes);
                                mz700.dataRecorder_setCmt(tape);
                                resolv();
                            }
                        });
                    });
                }
                break;
            case "eject":
                if(args.length > 1) {
                    console.log("Error: No parameter needed for cmt eject.");
                    return false;
                } else {
                    var bytes = mz700.dataRecorder_ejectCmt();
                    if(bytes == null || bytes.length < 128) {
                        console.log("ejected, but no data was found in cmt.");
                        return;
                    }
                    var header = new MZ_TapeHeader(bytes, 0);
                    console.log("Tape data: " +
                            header.addr_load.HEX(4) + "-" +
                            (header.addr_load + header.file_size - 1).HEX(4) + "(" +
                            header.file_size + " bytes), Start with" +
                            header.addr_exec.HEX(4) + "," +
                            header.filename);
                }
                break;
            case "play":
                if(args.length > 1) {
                    console.log("Error: No parameter needed for cmt play.");
                    return false;
                } else {
                    mz700.dataRecorder_pushPlay();
                }
                break;
            case "rec":
                if(args.length > 1) {
                    console.log("Error: No parameter needed for cmt rec.");
                    return false;
                } else {
                    mz700.dataRecorder_pushRec();
                }
                break;
            case "stop":
                if(args.length > 1) {
                    console.log("Error: No parameter needed for cmt stop.");
                    return false;
                } else {
                    mz700.dataRecorder_pushStop();
                }
                break;
        }
    });
}());
