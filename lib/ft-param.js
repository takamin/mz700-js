(function() {
    "use strict";
    function FTParam(numOfTimer, numOfExecInst, timerInterval) {
        this.numOfTimer = numOfTimer;
        this.numOfExecInst = numOfExecInst;
        this.timerInterval = timerInterval;
    };

    FTParam.prototype.get = function() {
        return {
            numOfTimer: this.numOfTimer,
            numOfExecInst: this.numOfExecInst,
            timerInterval: this.timerInterval
        };
    };

    FTParam.prototype.set = function(param) {
        this.numOfTimer = param.numOfTimer;
        this.numOfExecInst = param.numOfExecInst;
        this.timerInterval = param.timerInterval;
    };

    module.exports = context.exportModule("FTParam", FTParam);
}());
