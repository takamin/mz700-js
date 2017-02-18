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
        var screenUpdateData = {};
        var vramTxTid = null;

        //
        // Override to notify a message to mainthread
        //
        var original_run = MZ700.prototype.run;
        MZ700.prototype.run = function() {
            try {
                original_run.call(this);
            } catch(ex) {
                console.log("MZ700.run exception:", ex);
                this.stop();
                transworker.postNotify("break");
            }
        };
        var mz700 = new MZ700({
            onVramUpdate: function(index, dispcode, attr) {
                screenUpdateData[index] = {
                    dispcode: dispcode, attr: attr
                };
                if(vramTxTid == null) {
                    vramTxTid = setTimeout(function() {
                        transworker.postNotify(
                            'updateScreen',
                            screenUpdateData);
                        screenUpdateData = {};
                        vramTxTid = null;
                    }, 100);
                }
            },
            onMmioRead: function(address, value) {
                transworker.postNotify(
                        'onMmioRead',
                        { address: address, value: value }
                );
            },
            onMmioWrite: function(address, value) {
                transworker.postNotify(
                        'onMmioWrite',
                        { address: address, value: value }
                );
            },
            onPortRead: function(port, value) {
                transworker.postNotify(
                        'onPortRead',
                        { port: port, value: value }
                );
            },
            onPortWrite: function(port, value) {
                transworker.postNotify(
                        'onPortWrite',
                        { port: port, value: value }
                );
            },
            startSound: function(freq) {
                transworker.postNotify('startSound',[ freq ]);
            },
            stopSound: function() {
                transworker.postNotify('stopSound');
            },
            onStartDataRecorder: function(state) {
                transworker.postNotify('onStartDataRecorder');
            },
            onStopDataRecorder: function(state) {
                transworker.postNotify('onStopDataRecorder');
            }
        });
        transworker.create(mz700);
    }());
}
