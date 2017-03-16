(function(){
    "use strict";
    var FlipFlopCounter = getModule("FlipFlopCounter") || require('../lib/flip-flop-counter');
    //
    // IC BJ 556
    //
    function IC556(freq) {
        this._reset = false;
        this.initialize();
        this.setFrequency(freq);
    };

    IC556.prototype = new FlipFlopCounter();

    IC556.prototype.count = function() {
        if(this._reset) {
            return FlipFlopCounter.prototype.count.call(this);
        }
        return false;
    };

    IC556.prototype.loadReset = function(value) {
        if(!value) {
            if(this._reset) {
                this._reset = false;
                this.initialize();
            }
        } else {
            if(!this._reset) {
                this._reset = true;
            }
        }
    };

    module.exports = context.exportModule("IC556", IC556);
}());
