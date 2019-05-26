"use strict";
//
// FlipFlopCounter
//
export default class FlipFlopCounter {
    static SPEED_FACTOR:number = 1.5;
    static CPU_CLOCK:number = 4.0 * 1000 * 1000;
    static MNEMONIC_AVE_CYCLE:number = 6;
    _handlers:object;
    _out:boolean;
    _counter:number;
    _counter_max:number;

    constructor(freq:number) {
        this.initialize();
        this.setFrequency(freq);
        this._handlers = {
            change: []
        };
    }

    initialize() {
        this._out = false;
        this._counter = 0;
    }

    setFrequency(freq:number) {
        this._counter_max =
            FlipFlopCounter.CPU_CLOCK /
            FlipFlopCounter.MNEMONIC_AVE_CYCLE /
            freq;
    }

    readOutput():boolean {
        return this._out;
    }

    count():boolean {
        this._counter += FlipFlopCounter.SPEED_FACTOR;
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
