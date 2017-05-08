(function() {
    "use strict";
    //
    // FlipFlopCounter
    //
    function FlipFlopCounter(freq) {
        this.initialize();
        this.setFrequency(freq);
        this._handlers = {
            change: []
        };
    }

    FlipFlopCounter.SPEED_FACTOR = 1.5;
    FlipFlopCounter.CPU_CLOCK = 4.0 * 1000 * 1000;
    FlipFlopCounter.MNEMONIC_AVE_CYCLE = 6;
    FlipFlopCounter.prototype.initialize = function() {
        this._out = false;
        this._counter = 0;
    };

    FlipFlopCounter.prototype.setFrequency = function(freq) {
        this._counter_max =
            FlipFlopCounter.CPU_CLOCK /
            FlipFlopCounter.MNEMONIC_AVE_CYCLE /
            freq;
    };

    FlipFlopCounter.prototype.readOutput = function() {
        return this._out;
    };

    FlipFlopCounter.prototype.count = function() {
        this._counter += FlipFlopCounter.SPEED_FACTOR;
        if(this._counter >= this._counter_max / 2) {
            this._out = !this._out;
            this._counter = 0;
            this.fireEvent("change");
            return true;
        }
        return false;
    };

    FlipFlopCounter.prototype.addEventListener = function(evt, handler) {
        this._handlers[evt].push(handler);
    };

    FlipFlopCounter.prototype.fireEvent = function(evt) {
        this._handlers[evt].forEach(function(handler) {
            handler();
        });
    };
    module.exports = context.exportModule("FlipFlopCounter", FlipFlopCounter);
}());
