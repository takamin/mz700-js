"use strict";
var CliCommand = require("./command");
var mztReadFile = require("./mzt-read-file");
var MZ_TapeHeader = require('../../js/lib/mz-tape-header.js');
var { HEX } = require("../../js/lib/number-util");

module.exports = new CliCommand("cmt", (mz700, args) => {
    switch(args[0]) {
        case "set":
            if(args.length < 2) {
                console.log("Blank CMT is set");
                mz700.setCassetteTape([]);
            } else {
                var filename = args.slice(1).join(' ');
                return mztReadFile(filename).then(function(mzt_list) {
                    var setCMT = false;
                    if(mzt_list != null && mzt_list.length > 0) {
                        mzt_list.forEach(function(mzt, i) {
                            console.log("[" + (i + 1) + "/" + mzt_list.length + "] " +
                                HEX(mzt.header.addrLoad, 4) + "h --- " +
                                HEX(mzt.header.addrLoad + mzt.header.fileSize - 1, 4) + "h " +
                                "(" + mzt.header.fileSize + " bytes), " +
                                HEX(mzt.header.addrExec, 4) + "h, " + mzt.header.filename);
                            if(!setCMT) {
                                var bytes = mzt.header.buffer.concat(mzt.body.buffer);
                                mz700.setCassetteTape(bytes);
                                setCMT = true;
                            }
                        });
                    }
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
                        HEX(header.addrLoad, 4) + "-" +
                        HEX(header.addrLoad + header.fileSize - 1, 4) + "(" +
                        header.fileSize + " bytes), Start with" +
                        HEX(header.addrExec, 4) + "," +
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
