"use strict"

class MZ_DataRecorder {

    static RDATA_TOP_BLANK_LEN = 1;
    static RDATA_CYCLE_HI_LONG = 1500;
    static RDATA_CYCLE_HI_SHORT = 700;
    static RDATA_CYCLE_LO = 700;

    _m_on:boolean = false;
    _play:boolean = false;
    _rec:boolean = false;
    _motor:boolean = false;
    _wdata = null;
    _twdata = null;
    _rbit = null;
    _trdata = null;
    _cmt = null;
    _pos:number = 0;
    _motorCallback:Function = null;
    _readTopBlank:number = 0;

    constructor(motorCallback:Function) {
        this._motorCallback = motorCallback;
    }
    isCmtSet() {
        return (this._cmt != null);
    }
    /**
     * Retrieves magnetic data, if a tape is set.
     * @returns {Buffer|null} pseudo magnetic data.
     */
    getCmt() {
        return this._cmt;
    }
    setCmt(cmt) {
        var m = this.motor();
        if (m) {
            this.stop();
        }
        this._cmt = cmt;
        this._pos = 0;
        this._twdata = null;
        this._rbit = null;
        this._trdata = null;
        this._readTopBlank = 0;
    }
    play() {
        var m = this.motor();
        if (this._cmt != null) {
            this._play = true;
        }
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
    }
    rec() {
        var m = this.motor();
        if (this._cmt != null) {
            this._play = true;
            this._rec = true;
        }
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
    }
    stop() {
        var m = this.motor();
        this._play = false;
        this._rec = false;
        if (m && !this.motor()) {
            this._motorCallback(false);
        }
    }
    ejectCmt() {
        this.stop();
        var cmt = this._cmt;
        this._cmt = null;
        this._pos = 0;
        this._twdata = null;
        this._rbit = null;
        this._trdata = null;
        this._readTopBlank = 0;
        return cmt;
    }
    m_on(state) {
        var m = this.motor();
        if (!this._m_on && state) {
            this._motor = !this._motor;
        }
        this._m_on = state;
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
        if (m && !this.motor()) {
            this._motorCallback(false);
        }
    }
    motor() {
        return this._cmt != null && this._play && this._motor;
    }
    wdata(wdata, tick) {
        if (this.motor() && this._rec) {
            if (this._wdata != wdata) {
                this._wdata = wdata;
                if (wdata) {
                    this._twdata = tick;
                }
                else {
                    if (this._twdata == null) {
                        this._twdata = tick;
                    }
                    var bit = (tick - this._twdata > 1400);
                    if (this._pos < this._cmt.length) {
                        this._cmt[this._pos] = bit;
                        this._pos++;
                    }
                    else {
                        this._cmt.push(bit);
                        this._pos = this._cmt.length;
                    }
                }
            }
        }
    }
    rdata(tick) {
        if (this.motor()) {
            if (this._pos < this._cmt.length) {
                // Simulate blank reagion at the top of CMT
                if (this._pos == 0) {
                    if (this._readTopBlank <
                        MZ_DataRecorder.RDATA_TOP_BLANK_LEN) {
                        ++this._readTopBlank;
                        return false;
                    }
                }
                // Stop motor at the end of tape
                if (this._pos >= this._cmt.length) {
                    console.log("MZ_DataRecorder stopped at the end of CMT.");
                    this.stop();
                    return false;
                }
                // Retrieve next bit
                if (this._rbit == null) {
                    this._rbit = this._cmt[this._pos];
                    this._pos++;
                    this._trdata = tick;
                }
                // reading bit 0
                //
                //     _|~~~~~~~|_______
                //
                //     H: 700 cycle
                //     L: 700 cycle
                //
                // reading bit 1:
                //
                //     _|~~~~~~~~~~~~~~~|_______
                //
                //     H: 1500 cycle
                //     L: 700  cycle
                //
                var ticks_high = (this._rbit ?
                    MZ_DataRecorder.RDATA_CYCLE_HI_LONG :
                    MZ_DataRecorder.RDATA_CYCLE_HI_SHORT);
                var ticks = tick - this._trdata;
                if (ticks >= ticks_high + MZ_DataRecorder.RDATA_CYCLE_LO) {
                    this._rbit = null;
                }
                var signal = (ticks < ticks_high);
                return signal;
            }
        }
        return null;
    }
}

module.exports = MZ_DataRecorder;
