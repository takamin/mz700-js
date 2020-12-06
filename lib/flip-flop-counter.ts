"use strict";
import EventDispatcher from "./event-dispatcher";

/**
 * FlipFlopCounter
 */
export default class FlipFlopCounter extends EventDispatcher {
    _out:boolean;
    _counter:number;
    _counterMax:number;

    constructor(count:number) {
        super();
        this.declareEvent("change");

        this.initialize();
        this._counterMax = count;
    }

    initialize():void {
        this._out = false;
        this._counter = 0;
    }

    readOutput():boolean {
        return this._out;
    }

    count():boolean {
        this._counter++;
        if(this._counter >= this._counterMax / 2) {
            this._out = !this._out;
            this._counter = 0;
            this.fireEvent("change");
            return true;
        }
        return false;
    }
}
module.exports = FlipFlopCounter;
