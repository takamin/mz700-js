var MZ_DataRecorder = function(motorCallback) {
    this._m_on = false;
    this._play = false;
    this._rec = false;
    this._motor = false;
    this._wdata = null;
    this._rbit = null;
    this._twdata = 0;
    this._trdata = 0;
    this._cmt = null;
    this._pos = 0;
    this._motorCallback = motorCallback;
};

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
            if(this._rbit == null) {
                var bit = 0;
                if(this._pos < this._cmt.length) {
                    bit = this._cmt[this._pos];
                    this._pos++;
                }
                this._rbit = bit;
            }
            var rdata = this._rbit;
            if(this._trdata == null) {
                this._trdata = tick;
            }
            var ticks = tick - this._trdata;
            if(this._rbit) {
                if(ticks > 1500) {
                    this._rbit = null;
                    this._trdata = null;
                }
            } else {
                if(ticks > 700) {
                    this._rbit = null;
                    this._trdata = null;
                }
            }
            return rdata;
        }
    }
    return null;
};

module.exports = MZ_DataRecorder;
