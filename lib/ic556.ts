"use strict";
import FlipFlopCounter from "../lib/flip-flop-counter";

//
// IC BJ 556
//
export default class IC556 extends FlipFlopCounter {
    _reset: boolean;
    constructor(freq:number) {
        super(freq);
        this._reset = false;
    }

    count():boolean {
        if(this._reset) {
            return FlipFlopCounter.prototype.count.call(this);
        }
        return false;
    }

    loadReset(value:boolean):void {
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
    }
}
module.exports = IC556;
