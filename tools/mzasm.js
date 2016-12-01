#!/usr/bin/env node
require("../lib/ex_number.js");
require("../Z80/emulator.js");
require("../Z80/register.js");
require("../Z80/assembler.js");
require('../Z80/memory.js');
require('../MZ-700/emulator.js');
require('../MZ-700/mztape.js');
var fs = require('fs');
var getopt = require('node-getopt').create([
        ['m',   'map=ARG',  'output map file name'],
        ['z',   'output-MZT-header', 'output MZT header'],
        ['a',   'loading-address=ARG', 'set loading address'],
        ['e',   'execution-address=ARG', 'set execution address'],
        ['t',   'reuse-mzt-header=ARG', 'input file is mz-tape file'],
        ['o',   'output-file=ARG',  'filename to output'],
        ['h',   'help',     'display this help'],
        ['v',   'version',  'show version']
        ]).bindHelp().parseSystem();
if(getopt.options.version) {
    console.log("Z80 assembler v0.0");
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
    var filename = input_filename;
    filename = filename.replace(/^.*[\\\/]/, "");
    if('reuse-mzt-header' in getopt.options
    || 'output-MZT-header' in getopt.options)
    {
        ext = ".mzt";
    } else {
        ext = ".bin";
    }
    if(/\.asm$/i.test(filename)) {
        filename = filename.replace(/\.asm$/i, ext);
    } else {
        filename += ext;
    }
    output_filename = filename;
}

var fnMap = null;
if('map' in getopt.options) {
    fnMap = getopt.options['map'];
} else {
    var filename = input_filename;
    filename = filename.replace(/^.*[\\\/]/, "");
    if(/\.[^\.]*$/i.test(filename)) {
        filename = filename.replace(/\.[^\.]*$/i, '.map');
    } else {
        filename += ext;
    }
    fnMap = filename;
}

//
// MZT-Header
//
var mzt_header = null;
if('reuse-mzt-header' in getopt.options) {

    //
    // Load MZT-Header from other MZT-File.
    //
    var mzt_filebuf = fs.readFileSync(getopt.options['reuse-mzt-header']);
    mzt_header = new MZ_TapeHeader(mzt_filebuf, 0);

} else if('output-MZT-header' in getopt.options) {

    //
    // Create MZT-Header from the informations specified in command line options 
    //
    var load_addr = 0;
    var exec_addr = 0;
    if('loading-address' in getopt.options) {
        load_addr = parseInt(getopt.options['loading-address'], 0);
        exec_addr = load_addr;
    }
    if('execution-address' in getopt.options) {
        exec_addr = parseInt(getopt.options['execution-address'], 0);
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
    var mapEntries = Object.keys(asm.label2value).map(function(label) {
        return { "label": label, "address": asm.label2value[label] };
    }).sort(function(a,b){ return a.address - b.address; });
    if(mapEntries.length > 0) {
        var mapInfo = mapEntries.map(function(item) {
            return [item.label, ":\t", item.address.HEX(4), "H"].join('');
        }).join("\n");
        fs.writeFileSync(fnMap, mapInfo);
    }
});
