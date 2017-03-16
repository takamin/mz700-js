(function() {
    "use strict";
    //
    // FlipFlopCounter
    //
    function FlipFlopCounter(freq) {
        this.initialize();
        this.setFrequency(freq);
    };

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
            return true;
        }
        return false;
    };

    module.exports = context.exportModule("FlipFlopCounter", FlipFlopCounter);
}());
