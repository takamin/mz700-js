getopt = require('node-getopt').create([
        ['m',   'map=ARG',  'map file to resolve addresses'],
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
var fs = require('fs');
eval(fs.readFileSync('../../../../../js/ex_number.js')+'');
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

var mzt_name = "";
var mzt_filesize = -1;
var mzt_header = null;
if('reuse-mzt-header' in getopt.options) {
    var mzt_filebuf = fs.readFileSync(getopt.options['reuse-mzt-header']);
    mzt_header = new MZ_TapeHeader(mzt_filebuf, 0);
} else if('output-MZT-header' in getopt.options) {
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

    var asm = new Z80_assemble(data);
    var min_addr = null;
    var max_addr = null;
    asm.list.forEach(function(line) {
        if("address" in line && "bytecode" in line && line.bytecode.length > 0) {
            if(min_addr == null || line.address < min_addr) {
                min_addr = line.address;
            }
            if(max_addr == null || line.address + line.bytecode.length - 1 > max_addr) {
                max_addr = line.address + line.bytecode.length - 1;
            }
        }
    });
    var code_len = max_addr - min_addr + 1;
    var mzt_header_buf = new Array();
    if(mzt_header != null) {
        mzt_header.setFilesize(code_len);
        mzt_header_buf = mzt_header.buffer;
    }
    var outbuf = new Array(mzt_header_buf.length + code_len);
    for(var i = 0; i < outbuf.length; i++) {
        if(i < mzt_header_buf.length) {
            outbuf[i] = mzt_header_buf[i];
        } else {
            outbuf[i] = 0;
        }
    }
    asm.list.forEach(function(line) {
        if("address" in line && "bytecode" in line && line.bytecode.length > 0) {
            for(var i = 0; i < line.bytecode.length; i++) {
                if(mzt_header_buf.length + line.address - min_addr + i < outbuf.length) {
                    outbuf[mzt_header_buf.length + line.address - min_addr + i] = line.bytecode[i];
                }
            }
        }
    });
    fs.writeFileSync(output_filename, new Buffer(outbuf));
});
