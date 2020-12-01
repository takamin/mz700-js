"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MZ_DataRecorder {
    constructor(motorCallback) {
        this._mOn = false;
        this._play = false;
        this._rec = false;
        this._motor = false;
        this._wdata = null;
        this._twdata = null;
        this._rbit = null;
        this._trdata = null;
        this._cmt = null;
        this._pos = 0;
        this._motorCallback = null;
        this._readTopBlank = 0;
        this._motorCallback = motorCallback;
    }
    isCmtSet() {
        return (this._cmt != null);
    }
    getCmt() {
        return this._cmt;
    }
    setCmt(cmt) {
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
    play() {
        const m = this.motor();
        if (this._cmt != null) {
            this._play = true;
        }
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
    }
    rec() {
        const m = this.motor();
        if (this._cmt != null) {
            this._play = true;
            this._rec = true;
        }
        if (!m && this.motor()) {
            this._motorCallback(true);
        }
    }
    stop() {
        const m = this.motor();
        this._play = false;
        this._rec = false;
        if (m && !this.motor()) {
            this._motorCallback(false);
        }
    }
    ejectCmt() {
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
    m_on(state) {
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
    motor() {
        return this._cmt != null && this._play && this._motor;
    }
    wdata(wdata, tick) {
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
    rdata(tick) {
        if (this.motor()) {
            if (this._pos < this._cmt.length) {
                if (this._pos === 0) {
                    if (this._readTopBlank <
                        MZ_DataRecorder.RDATA_TOP_BLANK_LEN) {
                        ++this._readTopBlank;
                        return false;
                    }
                }
                if (this._pos >= this._cmt.length) {
                    console.log("MZ_DataRecorder stopped at the end of CMT.");
                    this.stop();
                    return false;
                }
                if (this._rbit == null) {
                    this._rbit = this._cmt[this._pos];
                    this._pos++;
                    this._trdata = tick;
                }
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
exports.default = MZ_DataRecorder;
MZ_DataRecorder.RDATA_TOP_BLANK_LEN = 1;
MZ_DataRecorder.RDATA_CYCLE_HI_LONG = 1500;
MZ_DataRecorder.RDATA_CYCLE_HI_SHORT = 700;
MZ_DataRecorder.RDATA_CYCLE_LO = 700;
module.exports = MZ_DataRecorder;
//# sourceMappingURL=mz-data-recorder.js.map