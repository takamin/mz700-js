"use strict"

/* tslint:disable: class-name no-console */

export default class MZ_DataRecorder {

    static RDATA_TOP_BLANK_LEN = 1;
    static RDATA_CYCLE_HI_LONG = 1500;
    static RDATA_CYCLE_HI_SHORT = 700;
    static RDATA_CYCLE_LO = 700;

    _mOn = false;
    _play = false;
    _rec = false;
    _motor = false;
    _wdata:boolean = null;
    _twdata:number = null;
    _rbit:boolean = null;
    _trdata:number = null;
    _cmt:boolean[] = null;
    _pos = 0;
    _motorCallback:(driveState:boolean)=>void = null;
    _readTopBlank = 0;

    constructor(motorCallback:(driveState:boolean)=>void) {
        this._motorCallback = motorCallback;
    }
    isCmtSet():boolean {
        return (this._cmt != null);
    }
    /**
     * Retrieves magnetic data, if a tape is set.
     * @returns {Buffer|null} pseudo magnetic data.
     */
    getCmt():boolean[] {
        return this._cmt;
    }
    setCmt(cmt:boolean[]):void {
        const m = this.motor();
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
    play():void {
        const m = this.motor();
        if (this._cmt != null) {
            this._play = true;
        }
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
    }
    rec():void {
        const m = this.motor();
        if (this._cmt != null) {
            this._play = true;
            this._rec = true;
        }
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
    }
    stop():void {
        const m = this.motor();
        this._play = false;
        this._rec = false;
        if (m && !this.motor()) {
            this._motorCallback(false);
        }
    }
    ejectCmt():boolean[] {
        this.stop();
        const cmt = this._cmt;
        this._cmt = null;
        this._pos = 0;
        this._twdata = null;
        this._rbit = null;
        this._trdata = null;
        this._readTopBlank = 0;
        return cmt;
    }
    m_on(state:boolean):void {
        const m = this.motor();
        if (!this._mOn && state) {
            this._motor = !this._motor;
        }
        this._mOn = state;
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
        if (m && !this.motor()) {
            this._motorCallback(false);
        }
    }
    motor():boolean {
        return this._cmt != null && this._play && this._motor;
    }
    wdata(wdata:boolean, tick:number):void {
        if (this.motor() && this._rec) {
            if (this._wdata !== wdata) {
                this._wdata = wdata;
                if (wdata) {
                    this._twdata = tick;
                }
                else {
                    if (this._twdata == null) {
                        this._twdata = tick;
                    }
                    const bit = (tick - this._twdata > 1400);
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
    rdata(tick:number):boolean|null {
        if (this.motor()) {
            if (this._pos < this._cmt.length) {
                // Simulate blank reagion at the top of CMT
                if (this._pos === 0) {
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
                const ticksHigh = (this._rbit ?
                    MZ_DataRecorder.RDATA_CYCLE_HI_LONG :
                    MZ_DataRecorder.RDATA_CYCLE_HI_SHORT);
                const ticks = tick - this._trdata;
                if (ticks >= ticksHigh + MZ_DataRecorder.RDATA_CYCLE_LO) {
                    this._rbit = null;
                }
                const signal = (ticks < ticksHigh);
                return signal;
            }
        }
        return null;
    }
}

module.exports = MZ_DataRecorder;
