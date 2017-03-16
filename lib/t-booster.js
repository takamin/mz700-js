(function() {
    "use strict";
    function TBooster() {}
    TBooster.Param = function(numOfTimer, numOfExecInst, timerInterval) {
        this.numOfTimer = numOfTimer;
        this.numOfExecInst = numOfExecInst;
        this.timerInterval = timerInterval;
    };

    TBooster.Param.prototype.get = function() {
        return {
            numOfTimer: this.numOfTimer,
            numOfExecInst: this.numOfExecInst,
            timerInterval: this.timerInterval
        };
    };
    TBooster.Param.prototype.set = function(param) {
        this.numOfTimer = param.numOfTimer;
        this.numOfExecInst = param.numOfExecInst;
        this.timerInterval = param.timerInterval;
    };
    module.exports = context.exportModule("TBooster", TBooster);
}());
