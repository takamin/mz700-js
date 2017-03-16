#!/usr/bin/env node
require("../lib/ex_number.js");
var MZ_TapeHeader = require('../MZ-700/mz-tape-header.js');
var fnut = require('../lib/fnuts.js');
var fs = require('fs');
var getopt = require('node-getopt').create([
        ['a',   'loading-address=ARG', 'set loading address'],
        ['e',   'execution-address=ARG', 'set execution address'],
        ['o',   'output-file=ARG',  'filename to output'],
        ['h',   'help',     'display this help'],
        ['v',   'version',  'show version']
        ]).bindHelp().parseSystem();

var getPackageJson = require("../lib/get-package-json");
var npmInfo = getPackageJson(__dirname + "/..");
if(getopt.options.version) {
    console.log("bin2mzt v" + npmInfo.version);
    return;
}

var args = require("hash-arg").get(["input_filename"], getopt.argv);
if(getopt.argv.length < 1) {
    console.error('error: no input file');
    return -1;
}
var input_filename = args.input_filename;
var output_filename = null;
if('output-file' in getopt.options) {
    output_filename = getopt.options['output-file'];
} else {
    output_filename = fnut.exchangeExtension(input_filename, ".mzt");
}

//
// MZT-Header
//
var mzt_header = MZ_TapeHeader.createNew();
var load_addr = 0;
var exec_addr = 0;
if('loading-address' in getopt.options) {
    load_addr = parseInt(getopt.options['loading-address'], 0);
    exec_addr = load_addr;
}
if('execution-address' in getopt.options) {
    exec_addr = parseInt(getopt.options['execution-address'], 0);
}
fs.readFile(input_filename, function(err, data) {
    if(err) {
        throw err;
    }
    var buffer = new Buffer(data, 'binary');
    mzt_header.setFilename(output_filename);
    mzt_header.setAddrLoad(load_addr);
    mzt_header.setAddrExec(exec_addr);
    mzt_header.setFilesize(buffer.length);
    fs.writeFileSync(output_filename,
        Buffer.concat([new Buffer(mzt_header.buffer), buffer]));
});
