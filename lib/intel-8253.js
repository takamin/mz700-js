(function() {
    "use strict";
    //
    // Intel 8253 Programmable Interval Timer
    //
    function Intel8253() {
        this.counter = [
            new Intel8253Counter("#0"),
            new Intel8253Counter("#1"),
            new Intel8253Counter("#2") ];
    };

    Intel8253.prototype.setCtrlWord = function(ctrlword) {
        var index = (ctrlword & 0xc0) >> 6;
        this.counter[index].setCtrlWord(ctrlword & 0x3f);
    };

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
    function Intel8253Counter(name) {
        this._name = name;
        this.RL = 3;
        this.MODE = 3;
        this.BCD = 0;
        this.value = 0xffff;
        this.counter = 0xffff;
        this._written = true;
        this._read = true;
        this.out = true;
        this.gate = false;
        this._handlers = {
            timeup: []
        };
    };

    Intel8253Counter.prototype.setCtrlWord = function(ctrlword) {
        this.RL = (ctrlword & 0x30) >> 4;
        this.MODE = (ctrlword & 0x0e) >> 1;
        this.BCD = ((ctrlword & 0x01) != 0);
        this.value = 0;
        this.counter = 0;
        this._written = true;
        this._read = true;
        this.out = false;
        this.gate = false;
    };

    Intel8253Counter.prototype.load = function(value) {
        this.counter = 0;
        var set_comp = false;
        switch(this.RL) {
            case 0: //Counter latching operation
                break;
            case 1: //Read/load LSB only
                this.value = (value & 0x00ff);
                this.counter = this.value;
                this.out = false;
                set_comp = true;
                break;
            case 2: //Read/load MSB only
                this.value = (value & 0x00ff) << 8;
                this.counter = this.value;
                set_comp = true;
                break;
            case 3: //Read/load LSB first, then MSB
                if(this._written) {
                    this._written = false;
                    this.value = (this.value & 0xff00) | (value & 0x00ff);
                    this.counter = this.value;
                    set_comp = false;
                } else {
                    this._written = true;
                    this.value = (this.value & 0x00ff) | ((value & 0x00ff) << 8);
                    this.counter = this.value;
                    this.out = false;
                    set_comp = true;
                }
                break;
        }
        if(set_comp) {
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
        return set_comp;
    };

    Intel8253Counter.prototype.read = function() {
        switch(this.RL) {
            case 0: //Counter latching operation
                break;
            case 1: //Read/load LSB only
                return (this.counter & 0x00ff);
                break;
            case 2: //Read/load MSB only
                return ((this.counter >> 8) & 0x00ff);
                break;
            case 3: //Read/load LSB first, then MSB
                if(this._read) {
                    this._read = false;
                    return (this.counter & 0x00ff);
                } else {
                    this._read = true;
                    return ((this.counter >> 8) & 0x00ff);
                }
                break;
        }
    };

    // TODO: 未使用？
    Intel8253Counter.prototype.setGate = function(gate) {
        this.gate = gate;
    };

    Intel8253Counter.prototype.count = function(count) {
        var prevOut = this.out;
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
    };
    Intel8253Counter.prototype.addEventListener = function(evt, handler) {
        this._handlers[evt].push(handler);
    };
    Intel8253Counter.prototype.fireEvent = function(evt) {
        this._handlers[evt].forEach(function(handler) {
            handler();
        });
    };
    module.exports = context.exportModule("Intel8253", Intel8253);
}());
