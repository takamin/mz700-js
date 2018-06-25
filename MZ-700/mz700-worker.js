//
// Codes for Worker context.
// Override the methods in Worker context
//
(function(g) {
    "use strict";
    require("../lib/context.js");
    if(!g.context.webWorker) {
        throw new Error("This script must run on WebWorker context.");
    }
    var TransWorker = require('transworker');
    var MZ700 = require('./mz700.js');

    var transworker = new TransWorker();
    transworker.create(new MZ700({
        onExecutionParameterUpdate: function(param) {
            try {
                transworker.postNotify(
                    "onExecutionParameterUpdate", param);
            } catch(ex) {
                console.error(ex);
            }
        },
        started: function() { transworker.postNotify("start"); },
        stopped: function() { transworker.postNotify("stop"); },
        notifyClockFreq: function(clockCount) {
            transworker.postNotify(
                    "onNotifyClockFreq", [ clockCount ]);
        },
        onBreak: function() {
            transworker.postNotify("onBreak");
        },
        onUpdateScreen: function(screenUpdateData) {
            transworker.postNotify(
                "onUpdateScreen", screenUpdateData);
        },
        onMmioRead: function(address, value){
            transworker.postNotify(
                    "onMmioRead", { address: address, value: value });
        },
        onMmioWrite: function(address, value){
            transworker.postNotify(
                    "onMmioWrite", { address: address, value: value });
        },
        onPortRead: function(port, value){
            transworker.postNotify(
                    "onPortRead", { port: port, value: value });
        },
        onPortWrite: function(port, value){
            transworker.postNotify(
                    "onPortWrite", { port: port, value: value });
        },
        startSound: function(freq){
            transworker.postNotify("startSound",[ freq ]);
        },
        stopSound: function(){
            transworker.postNotify("stopSound");
        },
        onStartDataRecorder: function(){
            transworker.postNotify("onStartDataRecorder");
        },
        onStopDataRecorder: function(){
            transworker.postNotify("onStopDataRecorder");
        }
    }));
}(Function("return this;")()));
