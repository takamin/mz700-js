#!/usr/bin/env node
require("../lib/ex_number.js");
var MZ_TapeHeader = require('../lib/mz-tape-header.js');
var fnut = require('../lib/fnuts.js');
var fs = require('fs');
var getPackageJson = require("../lib/get-package-json");
var npmInfo = getPackageJson(__dirname + "/..");
var Getopt = require('node-getopt');
var getopt = new Getopt([
        ['a',   'loading-address=ADDR', 'set loading address'],
        ['e',   'execution-address=ADDR', 'set execution address'],
        ['o',   'output-file=FILENAME',  'filename to output'],
        ['h',   'help',     'display this help'],
        ['v',   'version',  'show version']
        ]);
var cli = getopt.parseSystem();
var description = "A MZT header generator. -- " + npmInfo.name + "@" + npmInfo.version;
getopt.setHelp(
        "Usage: bin2mzt [OPTION] filename\n" +
        description + "\n" +
        "\n" +
        "[[OPTIONS]]\n" +
        "\n" +
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
var output_filename = null;
if('output-file' in cli.options) {
    output_filename = cli.options['output-file'];
} else {
    output_filename = fnut.exchangeExtension(input_filename, ".mzt");
}

//
// MZT-Header
//
var mzt_header = MZ_TapeHeader.createNew();
var load_addr = 0;
var exec_addr = 0;
if('loading-address' in cli.options) {
    load_addr = parseInt(cli.options['loading-address'], 0);
    exec_addr = load_addr;
}
if('execution-address' in cli.options) {
    exec_addr = parseInt(cli.options['execution-address'], 0);
}
fs.readFile(input_filename, function(err, data) {
    if(err) {
        throw err;
    }
    const buffer = Buffer.from(data);
    mzt_header.setFilename(output_filename);
    mzt_header.setAddrLoad(load_addr);
    mzt_header.setAddrExec(exec_addr);
    mzt_header.setFilesize(buffer.length);
    fs.writeFileSync(output_filename,
        Buffer.concat([Buffer.from(mzt_header.buffer), buffer]));
});
