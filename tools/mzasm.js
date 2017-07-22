#!/usr/bin/env node
require("../lib/context.js");
require("../lib/ex_number.js");
var Z80_assemble = require('../Z80/assembler');
var MZ_TapeHeader = require('../MZ-700/mz-tape-header');
var fnut = require('../lib/fnuts.js');
var fs = require('fs');
var getPackageJson = require("../lib/get-package-json");
var npmInfo = getPackageJson(__dirname + "/..");
var Getopt = require('node-getopt');
var getopt = new Getopt([
        ['m',   'map=FILENAME',  'output map file name'],
        ['z',   'output-MZT-header', 'output MZT header'],
        ['a',   'loading-address=ADDR', 'set loading address'],
        ['e',   'execution-address=ADDR', 'set execution address'],
        ['t',   'reuse-mzt-header=FILENAME', "reuse the MZT header."],
        ['o',   'output-file=FILENAME',  'filename to output'],
        ['h',   'help',     'display this help'],
        ['v',   'version',  'show version']
        ]);
var cli = getopt.parseSystem();
var description = "A simple Z80 assembler -- " + npmInfo.name + "@" + npmInfo.version;
getopt.setHelp(
        "Usage: mzasm [OPTION] filename\n" +
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
    var ext = null;
    if('reuse-mzt-header' in cli.options
    || 'output-MZT-header' in cli.options)
    {
        ext = ".mzt";
    } else {
        ext = ".bin";
    }
    output_filename = fnut.exchangeExtension(
            input_filename, ext);
}

// Determine filename of address map
var fnMap = null;
if('map' in cli.options) {
    fnMap = cli.options['map'];
} else {
    fnMap = fnut.exchangeExtension(
            input_filename, ".map");
}

//
// MZT-Header
//
var mzt_header = null;
if('reuse-mzt-header' in cli.options) {

    //
    // Load MZT-Header from other MZT-File.
    //
    var mzt_filebuf = fs.readFileSync(cli.options['reuse-mzt-header']);
    mzt_header = new MZ_TapeHeader(mzt_filebuf, 0);

} else if('output-MZT-header' in cli.options) {

    //
    // Create MZT-Header from the informations specified in command line options 
    //
    var load_addr = 0;
    var exec_addr = 0;
    if('loading-address' in cli.options) {
        load_addr = parseInt(cli.options['loading-address'], 0);
        exec_addr = load_addr;
    }
    if('execution-address' in cli.options) {
        exec_addr = parseInt(cli.options['execution-address'], 0);
    }
    mzt_header = MZ_TapeHeader.createNew();
    mzt_header.setFilename(output_filename);
    mzt_header.setAddrLoad(load_addr);
    mzt_header.setAddrExec(exec_addr);
}

fs.readFile(input_filename, 'utf-8', function(err, data) {
    if(err) {
        throw err;
    }

    //
    // Assemble
    //
    var asm = new Z80_assemble(data);

    //
    // Set binary size to MZT Header
    //
    var mzt_header_buf = new Array();
    if(mzt_header != null) {
        if(mzt_header.addr_load == 0) {
            mzt_header.setAddrLoad(asm.min_addr);
        }
        if(mzt_header.addr_exec == 0) {
            mzt_header.setAddrExec(asm.min_addr);
        }
        mzt_header.setFilesize(asm.buffer.length);
        mzt_header_buf = mzt_header.buffer;
    }

    //
    // Write out
    //
    fs.writeFileSync(
        output_filename,
        new Buffer(mzt_header_buf.concat(asm.buffer)));

    //
    // Output address map
    //
    var map = asm.getMap().map(function(item) {
        return [item.label, ":\t", item.address.HEX(4), "H"].join('');
    }).join("\n");
    if(map.length > 0) {
        fs.writeFileSync(fnMap, map);
    }
});
