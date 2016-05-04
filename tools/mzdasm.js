getopt = require('node-getopt').create([
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
var fs = require('fs');
eval(fs.readFileSync('../lib/ex_number.js')+'');
eval(fs.readFileSync('../Z80/emulator.js')+'');
eval(fs.readFileSync('../Z80/register.js')+'');
eval(fs.readFileSync('../Z80/assembler.js')+'');
eval(fs.readFileSync('../Z80/memory.js')+'');
eval(fs.readFileSync('../MZ-700/emulator.js')+'');
eval(fs.readFileSync('../MZ-700/mztape.js')+'');
if(getopt.argv.length < 1) {
    console.error('error: no input file');
    return -1;
}
var input_filename = getopt.argv[0];
var input_mzt = getopt.options['input-mzt'] || /\.mzt$/i.test(input_filename);
fs.readFile(input_filename, function(err, data) {
    if(err) {
        throw err;
    }
    var outbuf = "";
    var buf = new Buffer(data);
    var dasmlist = [];
    if(input_mzt) {
        var mzts = MZ700.parseMZT(buf); 
        for(var i = 0; i < mzts.length; i++) {
            var mzt = mzts[i];
            outbuf += ";======================================================\n"
            outbuf += "; attribute :   " + mzt.header.attr.HEX(2) + "H\n";
            outbuf += "; filename  :   '" + mzt.header.filename + "'\n";
            outbuf += "; filesize  :   " + mzt.header.file_size + " bytes\n";
            outbuf += "; load addr :   " + mzt.header.addr_load.HEX(4) + "H\n";
            outbuf += "; start addr:   " + mzt.header.addr_exec.HEX(4) + "H\n";
            outbuf += ";======================================================\n"
            var lines = Z80.dasm(
                mzt.body.buffer, 0, mzt.header.file_size, mzt.header.addr_load);
            for(var j = 0; j < lines.length; j++) {
                dasmlist.push(lines[j]);
            }
        }
    } else {
        outbuf += ";======================================================\n"
        outbuf += "; filename  :   '" + input_filename + "'\n";
        outbuf += "; filesize  :   " + buf.length + " bytes\n";
        outbuf += "; load addr :   0000h\n";
        outbuf += "; start addr:   0000h\n";
        outbuf += ";======================================================\n";
        dasmlist = Z80.dasm(buf);
    }
    Z80.processAddressReference(dasmlist);
    var dasmlines = Z80.dasmlines(dasmlist);
    for(var i = 0; i < dasmlines.length; i++) {
        outbuf += dasmlines[i] + "\n";
    }
    if('output-file' in getopt.options) {
        fs.writeFileSync(getopt.options['output-file'], outbuf);
    } else {
        console.info(outbuf);
    }
});
