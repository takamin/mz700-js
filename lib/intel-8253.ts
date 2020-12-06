"use strict";
import EventDispatcher from "./event-dispatcher";

/* tslint:disable: no-bitwise max-classes-per-file */

//
// Intel 8253 Programmable Interval Timer
//
export default class Intel8253 {
    private _counter: Intel8253Counter[];
    constructor() {
        this._counter = [
            new Intel8253Counter(),
            new Intel8253Counter(),
            new Intel8253Counter() ];
    }
    public setCtrlWord(ctrlword:number):void {
        const index = (ctrlword & 0xc0) >> 6;
        this._counter[index].setCtrlWord(ctrlword & 0x3f);
    }
    public counter(index:number):Intel8253Counter {
        return this._counter[index];
    }
}


//
//   8253 MODE CTRL WORD
//
//       $E007 Memory Mapped I/O
//
//       ---------------------------------
//       b7  b6  b5  b4  b3  b2  b1  b0
//       [ SC ]  [ RL ]  [  MODE  ]  [BCD]
//       ---------------------------------
//
//       SC:     0: Select counter 0
//               1: Select counter 1
//               2: Select counter 2
//               3: Illegal
//
//       RL:     0: Counter latching operation
//               1: Read/load LSB only
//               2: Read/load MSB only
//               3: Read/load LSB first, then MSB
//
//       MODE:   0: Mode 0   Interrupt on terminal count
//               1: Mode 1   Programmable one shot
//               2: Mode 2   Rate Generator
//               3: Mode 3   Square wave rate Generator
//               4: Mode 4   Software triggered strobe
//               5: Mode 5   Hardware triggered strobe
//               6: Mode 2
//               7: Mode 3
//
//       BCD:    0: Binary counter
//               1: BCD counter
//
class Intel8253Counter extends EventDispatcher {
    RL:number;
    MODE:number;
    BCD:number;
    value:number;
    counter = 0xffff;
    _written = true;
    _read = true;
    out = true;
    gate = false;
    constructor() {
        super();
        this.declareEvent("timeup");

        this.RL = 3;
        this.MODE = 3;
        this.BCD = 0;
        this.value = 0xffff;
        this.counter = 0xffff;
        this._written = true;
        this._read = true;
        this.out = true;
        this.gate = false;
    }

    setCtrlWord(ctrlword:number):void {
        this.RL = (ctrlword & 0x30) >> 4;
        this.MODE = (ctrlword & 0x0e) >> 1;
        this.BCD = (ctrlword & 0x01) !== 0 ? 1 : 0;
        this.value = 0;
        this.counter = 0;
        this._written = true;
        this._read = true;
        this.out = false;
        this.gate = false;
    }

    initCount(counter:number, handler:()=>void):void {
        this.value = counter;
        this.counter = counter;
        this.addEventListener("timeup", handler);
    }

    load(value:number):boolean {
        this.counter = 0;
        let setComp = false;
        switch(this.RL) {
            case 0: // Counter latching operation
                break;
            case 1: // Read/load LSB only
                this.value = (value & 0x00ff);
                this.counter = this.value;
                this.out = false;
                setComp = true;
                break;
            case 2: // Read/load MSB only
                this.value = (value & 0x00ff) << 8;
                this.counter = this.value;
                setComp = true;
                break;
            case 3: // Read/load LSB first, then MSB
                if(this._written) {
                    this._written = false;
                    this.value = (this.value & 0xff00) | (value & 0x00ff);
                    this.counter = this.value;
                    setComp = false;
                } else {
                    this._written = true;
                    this.value = (this.value & 0x00ff) | ((value & 0x00ff) << 8);
                    this.counter = this.value;
                    this.out = false;
                    setComp = true;
                }
                break;
        }
        if(setComp) {
            switch(this.MODE) {
                case 0:
                    this.out = false;
                    break;
                case 1:
                    break;
                case 2: case 6:
                    this.out = true;
                    break;
                case 3: case 7:
                    this.out = true;
                    break;
                case 4:
                    break;
                case 5:
                    break;
            }
        }
        return setComp;
    }

    read():number|null {
        switch(this.RL) {
            case 0: // Counter latching operation
                break;
            case 1: // Read/load LSB only
                return (this.counter & 0x00ff);
            case 2: // Read/load MSB only
                return ((this.counter >> 8) & 0x00ff);
            case 3: // Read/load LSB first, then MSB
                if(this._read) {
                    this._read = false;
                    return (this.counter & 0x00ff);
                } else {
                    this._read = true;
                    return ((this.counter >> 8) & 0x00ff);
                }
        }
        return null;
    }

    // TODO: 未使用？
    setGate(gate:boolean):void {
        this.gate = gate;
    }

    count(count:number):void {
        const prevOut = this.out;
        switch(this.MODE) {
            case 0:
                if(this.counter > 0) {
                    this.counter -= count;
                    if(this.counter <= 0) {
                        this.counter = 0;
                        if(!this.out) {
                            this.out = true;
                        }
                    }
                } else {
                    this.counter = this.value;
                }
                break;
            case 1:
                break;
            case 2: case 6:
                this.counter -= count;
                if(this.out && this.counter <= 0) {
                    this.out = false;
                    this.counter = this.value;
                } else if(!this.out) {
                    this.out = true;
                }
                break;
            case 3: case 7:
                this.counter -= count;
                if(this.counter >= this.value / 2) {
                    this.out = true;
                } else if(this.counter > 0) {
                    this.out = false;
                } else {
                    this.out = true;
                    this.counter = this.value;
                }
                break;
            case 4:
                break;
            case 5:
                break;
        }
        if(!prevOut && this.out) {
            this.fireEvent("timeup");
        }
    }
}
module.exports = Intel8253;
