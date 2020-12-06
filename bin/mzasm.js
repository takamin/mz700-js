#!/usr/bin/env node
const NumberUtil = require("../js/lib/number-util.js");
var Z80_assemble = require('../js/Z80/assembler');
var MZ_TapeHeader = require('../js/lib/mz-tape-header');
var changeExt = require('../js/lib/change-ext.js');
var fs = require('fs');
var getPackageJson = require("./lib/get-package-json");
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
        "Usage: mzasm [OPTION] filename [filename ...]\n" +
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

var args = require("hash-arg").get(["input_filenames:string[]"], cli.argv);
if(cli.argv.length < 1) {
    console.error('error: no input file');
    process.exit(-1);
}

// Determine the output filename
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
    let input_filename = args.input_filenames[0];
    output_filename = changeExt(input_filename, ext);
}

// Determine filename of address map
var fnMap = null;
if('map' in cli.options) {
    fnMap = cli.options['map'];
} else {
    fnMap = changeExt(output_filename, ".map");
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
(async function() {
    let sources = [];
    await Promise.all(args.input_filenames.map( input_filename => {
        return new Promise( (resolve, reject) => {
            fs.readFile(input_filename, 'utf-8', function(err, data) {
                if(err) {
                    reject(err);
                } else {
                    sources.push(data);
                    resolve(data);
                }
            });
        });
    }));

    //
    // Assemble
    //
    let asm = Z80_assemble.assemble(sources);

    //
    // Set binary size to MZT Header
    //
    var mzt_header_buf = [];
    if(mzt_header != null) {
        if(mzt_header.addrLoad == 0) {
            mzt_header.setAddrLoad(asm.minAddr);
        }
        if(mzt_header.addrExec == 0) {
            mzt_header.setAddrExec(asm.minAddr);
        }
        mzt_header.setFilesize(asm.buffer.length);
        mzt_header_buf = mzt_header.buffer;
    }

    //
    // Write out
    //
    fs.writeFileSync(
        output_filename,
        Buffer.from(mzt_header_buf.concat(asm.buffer)));

    //
    // Output address map
    //
    let map = Z80_assemble.hashMapArray(asm.label2value).map(function(item) {
        return [item.label, ":\t", NumberUtil.HEX(item.address, 4), "H"].join('');
    }).join("\n");
    if(map.length > 0) {
        fs.writeFileSync(fnMap, map);
    }
}());
