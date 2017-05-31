/* global Promise */
(function(){
    "use strict";
    var CliCommand = require("../lib/cli-command");
    var mztReadFile = require("../lib/mzt-read-file");
    var MZ_TapeHeader = require('../MZ-700/mz-tape-header');

    module.exports = new CliCommand("cmt", function(mz700, args) {
        switch(args[0]) {
            case "set":
                if(args.length < 2) {
                    console.log("Blank CMT is set");
                    mz700.setCassetteTape([]);
                } else {
                    return new Promise(function(resolv, reject) {
                        var filename = args.slice(1).join(' ');
                        mztReadFile(filename).then(function(mzt_list) {
                            var setCMT = false;
                            if(mzt_list != null && mzt_list.length > 0) {
                                mzt_list.forEach(function(mzt, i) {
                                    console.log("[" + (i + 1) + "/" + mzt_list.length + "] " +
                                        mzt.header.addr_load.HEX(4) + "h --- " +
                                        (mzt.header.addr_load + mzt.header.file_size - 1).HEX(4) + "h " +
                                        "(" + mzt.header.file_size + " bytes), " +
                                        mzt.header.addr_exec.HEX(4) + "h, " + mzt.header.filename);
                                    if(!setCMT) {
                                        try {
                                            var bytes = mzt.header.buffer.concat(mzt.body.buffer);
                                            mz700.setCassetteTape(bytes);
                                            setCMT = true;
                                        } catch(err) {
                                            console.log(err.message);
                                            console.log(err.stack);
                                            reject(err);
                                        }
                                    }
                                });
                            }
                            resolv();
                        }).catch(function(err) {
                            console.log(err.message);
                            console.log(err.stack);
                            reject(err);
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
