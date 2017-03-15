var MZ_DataRecorder = function(motorCallback) {
    this._m_on = false;
    this._play = false;
    this._rec = false;
    this._motor = false;
    this._wdata = null;
    this._twdata = null;
    this._rbit = null;
    this._trdata = null;
    this._cmt = null;
    this._pos = 0;
    this._motorCallback = motorCallback;
    this._readTopBlank = 0;
};

MZ_DataRecorder.RDATA_TOP_BLANK_LEN = 1;
MZ_DataRecorder.RDATA_CYCLE_HI_LONG = 1500;
MZ_DataRecorder.RDATA_CYCLE_HI_SHORT = 700;
MZ_DataRecorder.RDATA_CYCLE_LO = 700;

MZ_DataRecorder.prototype.isCmtSet = function() {
    return (this._cmt != null);
};

MZ_DataRecorder.prototype.setCmt = function(cmt) {
    var m = this.motor();
    if(m) {
        this.stop();
    }
    this._cmt = cmt;
    this._pos = 0;
    this._twdata = null;
    this._rbit = null;
    this._trdata = null;
    this._readTopBlank = 0;
};

MZ_DataRecorder.prototype.play = function() {
    var m = this.motor();
    if(this._cmt != null) {
        this._play = true;
    }
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
};

MZ_DataRecorder.prototype.rec = function() {
    var m = this.motor();
    if(this._cmt != null) {
        this._play = true;
        this._rec = true;
    }
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
};

MZ_DataRecorder.prototype.stop = function() {
    var m = this.motor();
    this._play = false;
    this._rec = false;
    if(m && !this.motor()) {
        this._motorCallback(false);
    }
};

MZ_DataRecorder.prototype.ejectCmt = function() {
    this.stop();
    var cmt = this._cmt;
    this._cmt = null;
    this._pos = 0;
    this._twdata = null;
    this._rbit = null;
    this._trdata = null;
    this._readTopBlank = 0;
    return cmt;
};

MZ_DataRecorder.prototype.m_on = function(state) {
    var m = this.motor();
    if(!this._m_on && state) {
        this._motor = !this._motor;
    }
    this._m_on = state;
    if(!m && this.motor()) {
        this._motorCallback(true);
    }
    if(m && !this.motor()) {
        this._motorCallback(false);
    }
};

MZ_DataRecorder.prototype.motor = function() {
    return this._cmt != null && this._play && this._motor;
};

MZ_DataRecorder.prototype.wdata = function(wdata, tick) {
    if(this.motor() && this._rec) {
        if(this._wdata != wdata) {
            this._wdata = wdata;
            if(wdata) {
                this._twdata = tick;
            } else {
                if(this._twdata == null) {
                    this._twdata = tick;
                }
                var bit = (tick - this._twdata > 1400);
                if(this._pos < this._cmt.length) {
                    this._cmt[this._pos] = bit;
                    this._pos++;
                } else {
                    this._cmt.push(bit);
                    this._pos = this._cmt.length;
                }
            }
        }
    }
};

MZ_DataRecorder.prototype.rdata = function(tick) {
    if(this.motor()) {
        if(this._pos < this._cmt.length) {

            // Simulate blank reagion at the top of CMT
            if(this._pos == 0) {
                if(this._readTopBlank <
                        MZ_DataRecorder.RDATA_TOP_BLANK_LEN)
                {
                    ++this._readTopBlank;
                    return false;
                }
            }

            // Stop motor at the end of tape
            if(this._pos >= this._cmt.length) {
                console.log("MZ_DataRecorder stopped at the end of CMT.");
                this.stop();
                return false;
            }

            // Retrieve next bit
            if(this._rbit == null) {
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
            if(ticks >= ticks_high + MZ_DataRecorder.RDATA_CYCLE_LO) {
                this._rbit = null;
            }
            var signal = (ticks < ticks_high);
            return signal;
        }
    }
    return null;
};

module.exports = MZ_DataRecorder;
