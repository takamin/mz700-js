"use strict";
//
// FlipFlopCounter
//
export default class FlipFlopCounter {
    _handlers:object;
    _out:boolean;
    _counter:number;
    _counter_max:number;

    constructor(count:number) {
        this.initialize();
        this._counter_max = count;
        this._handlers = {
            change: []
        };
    }

    initialize() {
        this._out = false;
        this._counter = 0;
    }

    readOutput():boolean {
        return this._out;
    }

    count():boolean {
        this._counter++;
        if(this._counter >= this._counter_max / 2) {
            this._out = !this._out;
            this._counter = 0;
            this.fireEvent("change");
            return true;
        }
        return false;
    }

    addEventListener(evt:string, handler:Function) {
        this._handlers[evt].push(handler);
    };

    fireEvent(evt:string) {
        this._handlers[evt].forEach(function(handler) {
            handler();
        });
    }
}
module.exports = FlipFlopCounter;
