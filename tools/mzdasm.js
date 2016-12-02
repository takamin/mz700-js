#!/usr/bin/env node
require('../lib/ex_number.js');
require('../Z80/emulator.js');
require('../Z80/register.js');
require('../Z80/assembler.js');
require('../Z80/memory.js');
require('../MZ-700/emulator.js');
require('../MZ-700/mztape.js');
var fnut = require("../lib/fnuts.js");
var fs = require('fs');
var getopt = require('node-getopt').create([
        ['m',   'map=ARG',  'map file to resolve addresses'],
        ['t',   'input-mzt', 'input file is mz-tape file'],
        ['o',   'output-file=ARG',  'filename to output'],
        ['h',   'help',     'display this help'],
        ['v',   'version',  'show version']
        ]).bindHelp().parseSystem();
if(getopt.options.version) {
    console.log("Z80 disassembler v0.1");
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
            "; filesize  :   " + buf.length + " bytes",
            ";======================================================"
            );
        dasmlist = Z80.dasm(buf);
    }
    var dasmlines = Z80.dasmlines(dasmlist);
    for(var i = 0; i < dasmlines.length; i++) {
        outbuf.push(dasmlines[i]);
    }
    fs.writeFileSync(output_filename, outbuf.join("\n") + "\n");
});
