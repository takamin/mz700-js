#!/usr/bin/env node
require("../lib/context.js");
require('../lib/ex_number.js');
var Z80 = require("../Z80/emulator.js");
var Z80BinUtil = require("../Z80/bin-util.js");
var Z80LineAssembler = require('../Z80/z80-line-assembler');
var MZ700 = require('../MZ-700/emulator.js');
var fnut = require("../lib/fnuts.js");
var fs = require('fs');
var getopt = require('node-getopt').create([
        ['m',   'map=ARG',  'map file to resolve addresses'],
        ['t',   'input-mzt', 'input file is mz-tape file'],
        ['o',   'output-file=ARG',  'filename to output'],
        ['l',   'load-to=ARG',  'address to load'],
        ['c',   'to-console',  'print result to console'],
        ['h',   'help',     'display this help'],
        ['v',   'version',  'show version']
        ]).bindHelp().parseSystem();

var getPackageJson = require("../lib/get-package-json");
var npmInfo = getPackageJson(__dirname + "/..");
if(getopt.options.version) {
    console.log("Z80 disassembler for MZ-700 v" + npmInfo.version);
    return;
}

var args = require("hash-arg").get(["input_filename"], getopt.argv);
if(getopt.argv.length < 1) {
    console.error('error: no input file');
    return -1;
}

var input_filename = args.input_filename;
var input_mzt = getopt.options['input-mzt'] ||
    fnut.extensionOf(input_filename).toLowerCase() == ".mzt";
var output_filename = getopt.options['output-file'] ||
    fnut.exchangeExtension(input_filename, ".asm");
var addr_load = (function(addr_tok) {
    if(addr_tok) {
        var a = Z80LineAssembler.parseNumLiteralPair(addr_tok);
        if(typeof(a[0]) === 'number') {
            return Z80BinUtil.pair(a[1], a[0]);
        }
    }
    return 0;
}(getopt.options['load-to']));
fs.readFile(input_filename, function(err, data) {
    if(err) {
        throw err;
    }
    var outbuf = [];
    var buf = new Buffer(data);
    var dasmlist = [];
    if(input_mzt) {
        var mzts = MZ700.parseMZT(buf); 
        for(var i = 0; i < mzts.length; i++) {
            var mzt = mzts[i];
            outbuf.push(mzt.header.getHeadline());
            dasmlist = Z80.dasm(
                mzt.body.buffer, 0,
                mzt.header.file_size,
                mzt.header.addr_load);
        }
    } else {
        outbuf.push(
            ";======================================================",
            "; filename  :   '" + input_filename + "'",
            "; loadaddr  :   " + addr_load.HEX(4) + "H",
            "; filesize  :   " + buf.length + " bytes / " +
                                 buf.length.HEX(4) + "H bytes",
            ";======================================================"
            );
        dasmlist = Z80.dasm(buf, 0, buf.length, addr_load);
    }
    var dasmlines = Z80.dasmlines(dasmlist);
    for(var i = 0; i < dasmlines.length; i++) {
        outbuf.push(dasmlines[i]);
    }
    if(getopt.options['to-console']) {
        console.log(
                outbuf.join("\n") + "\n");
    } else {
        fs.writeFileSync(
                output_filename,
                outbuf.join("\n") + "\n");
    }
});
