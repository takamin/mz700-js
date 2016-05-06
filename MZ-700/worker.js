//
// Codes for Worker context.
// Override the methods in Worker context
//
if("importScripts" in this) {
    importScripts(
            '../lib/transworker.js',
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
        var vram = {};
        var vramTxTid = null;

        //
        // Override to notify a message to mainthread
        //
        MZ700.prototype.run = function() {
            try {
                for(var i = 0; i < this.NUM_OF_EXEC_OPCODE; i++) {
                    this.z80.exec();
                    this.clock();
                }
            } catch(ex) {
                console.log("MZ700.run exception:", ex);
                this.stop();
                transworker.postNotify("break");
            }
        };
        var mz700 = new MZ700({
            onVramUpdate: function(index, dispcode, attr) {
                vram[index] = {
                    dispcode: dispcode, attr: attr
                };
                if(vramTxTid == null) {
                    vramTxTid = setTimeout(function() {
                        transworker.postNotify(
                            'onVramUpdateAll',
                            vram);
                        vram = {};
                        vramTxTid = null;
                    }, 100);
                }
            },
            startSound: function(freq) {
                transworker.postNotify('startSound',[ freq ]);
            },
            stopSound: function() {
                transworker.postNotify('stopSound');
            }
        });
        transworker.create(mz700);
    }());
}
