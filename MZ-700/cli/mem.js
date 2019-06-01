(function(){
    "use strict";
    var CliCommand = require("./command");
    var parseAddr = require("../../lib/parse-addr");
    module.exports = new CliCommand("mem", function(mz700, args) {
        var addr = null;
        switch(args[0]) {
            case "set":
                if(args.length < 2) {
                    console.log("Error: no address specified");
                    return false;
                } else {
                    addr = parseAddr(args[1]);
                    var data_list = args.slice(2);
                    data_list.forEach(function(data, i) {
                        mz700.memory.poke(addr + i, parseAddr(data));
                    });
                }
                break;
            case "dump":
                if(args.length < 2) {
                    console.log("Error: no address specified");
                } else {
                    addr = parseAddr(args[1]);
                    var len = 256;
                    var cols = 16;
                    var hexArr = [];
                    var put = function() {
                        var s = hexArr.join("");
                        console.log(s);
                        hexArr = [];
                    }
                    for(var i = 0; i < len; i++) {
                        var data = mz700.memory.peek(addr + i);
                        if(i % cols == 0) {
                            hexArr.push((addr+i).HEX(4));
                            hexArr.push(":");
                        }
                        if(i % cols != 0 && i % (cols / 2) == 0) {
                            hexArr.push(" -");
                        }
                        hexArr.push(" ");
                        hexArr.push(data.HEX(2));
                        if(i % cols == cols - 1) {
                            put();
                        }
                    }
                    if(hexArr.length > 0) {
                        put();
                    }
                }
                break;
            default:
                console.log("Error: Unrecognized command " + args[0]);
                return false;
        }
    });
}());

