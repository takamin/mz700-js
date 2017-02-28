//
// Codes for Worker context.
// Override the methods in Worker context
//
if("importScripts" in this) {
    importScripts(
            '../lib/transworker/transworker.js',
            '../lib/ex_number.js',
            '../Z80/memory.js',
            '../Z80/register.js',
            '../Z80/assembler.js',
            '../Z80/emulator.js',
            'emulator.js',
            'memory.js',
            'monitor-rom.js',
            'mztape.js');

    (function() {
        var transworker = new TransWorker();
        var mz700 = new MZ700();
        transworker.create(mz700);
        mz700.setTransworker(transworker);
    }());
}
