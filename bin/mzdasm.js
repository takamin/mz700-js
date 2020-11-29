#!/usr/bin/env node
const NumberUtil = require("../lib/number-util.js");
var Z80 = require("../Z80/Z80.js");
var Z80BinUtil = require("../Z80/bin-util.js");
const parseAddress = require("../lib/parse-addr.js");
const MZ_Tape = require("../lib/mz-tape.js");
var changeExt = require("../lib/change-ext.js");
var fs = require('fs');
var path = require("path");
var getPackageJson = require("./lib/get-package-json");
var npmInfo = getPackageJson(__dirname + "/..");
var Getopt = require('node-getopt');
var getopt = new Getopt([
        ['m',   'map=FILENAME',  'map file to resolve addresses'],
        ['t',   'input-mzt', 'input file is mz-tape file'],
        ['o',   'output-file=FILENAME',  'filename to output'],
        ['l',   'load-to=ADDR',  'address to load'],
        ['c',   'to-console',  'print result to console'],
        ['h',   'help',     'display this help'],
        ['v',   'version',  'show version']
        ])
var cli = getopt.parseSystem();
var description = "A simple Z80 dis-assembler. -- " + npmInfo.name + "@" + npmInfo.version;
getopt.setHelp(
        "Usage: mzdas [OPTION] filename\n" +
        description + "\n" +
        "\n" +
        "[[OPTIONS]]\n" +
        "\n" +
        "mz700-js\n" +
        "Installation: npm install -g mz700-js\n" +
        "Repository: https://github.com/takamin/mz700-js");

if(cli.options.help) {
    getopt.showHelp();
    process.exit(0);
}

if(cli.options.version) {
    console.log(description);
    process.exit(0);
}

var args = require("hash-arg").get(["input_filename"], cli.argv);
if(cli.argv.length < 1) {
    console.error('error: no input file');
    process.exit(-1);
}

var input_filename = args.input_filename;
var input_mzt = cli.options['input-mzt'] ||
    path.extname(input_filename).toLowerCase() == ".mzt";
var output_filename = cli.options['output-file'] ||
    changeExt(input_filename, ".asm");
var addrLoad = (function(addr_tok) {
    if(addr_tok) {
        var a = parseAddress.parseNumLiteralPair(addr_tok);
        if(typeof(a[0]) === 'number') {
            return Z80BinUtil.pair(a[1], a[0]);
        }
    }
    return 0;
}(cli.options['load-to']));
fs.readFile(input_filename, function(err, data) {
    if(err) {
        throw err;
    }
    var outbuf = [];
    const buf = Buffer.from(data);
    var dasmlist = [];
    var i;
    if(input_mzt) {
        var mzts = MZ_Tape.parseMZT(buf); 
        for(i = 0; i < mzts.length; i++) {
            var mzt = mzts[i];
            outbuf.push(mzt.header.getHeadline());
            dasmlist = Z80.dasm(
                mzt.body.buffer, 0,
                mzt.header.fileSize,
                mzt.header.addrLoad);
        }
    } else {
        outbuf.push(
            ";======================================================",
            "; filename  :   '" + input_filename + "'",
            "; loadaddr  :   " + NumberUtil.HEX(addrLoad, 4) + "H",
            "; filesize  :   " + buf.length + " bytes / " +
                                 NumberUtil.HEX(buf.length, 4) + "H bytes",
            ";======================================================"
            );
        dasmlist = Z80.dasm(buf, 0, buf.length, addrLoad);
    }
    var dasmlines = Z80.dasmlines(dasmlist);
    for(i = 0; i < dasmlines.length; i++) {
        outbuf.push(dasmlines[i]);
    }
    if(cli.options['to-console']) {
        console.log(
                outbuf.join("\n") + "\n");
    } else {
        fs.writeFileSync(
                output_filename,
                outbuf.join("\n") + "\n");
    }
});
