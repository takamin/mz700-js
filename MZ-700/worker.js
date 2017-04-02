//
// Codes for Worker context.
// Override the methods in Worker context
//
if("importScripts" in this) {
    importScripts(
            '../node_modules/transworker/transworker.js',
            '../node_modules/fractional-timer/fractional-timer.js',
            '../lib/context.js',
            '../lib/ex_number.js',
            '../lib/ft-param.js',
            '../lib/flip-flop-counter.js',
            '../lib/ic556.js',
            '../lib/intel-8253.js',
            '../Z80/bin-util.js',
            '../Z80/imem.js',
            '../Z80/memory-block.js',
            '../Z80/memory-bank.js',
            '../Z80/register.js',
            '../Z80/z80-line-assembler.js',
            '../Z80/assembler.js',
            '../Z80/emulator.js',
            'monitor-rom.js',
            'memory.js',
            'mz700-key-matrix.js',
            'mz-tape-header.js',
            'mz-tape.js',
            'mz-data-recorder.js',
            'emulator.js');

    TransWorker.create(MZ700);
}
