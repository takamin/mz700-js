function MZ700_Sound() {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    if(window.AudioContext) {
        this.audio = { ctx: new AudioContext(), osc: null };
    } else {
        console.warn("NO AudioContext API supported by this browser.");
        this.setGain = function(){};
        this.startSound = function(){};
        this.stopSound = function(){};
    }
}
MZ700_Sound.prototype.setGain = function(gain) {
    if(gain < 0) {
        gain = 0;
    }
    if(gain > 1.0) {
        gain = 1.0;
    }
    this.gain = gain;
    if(this.gainNode) {
        this.gainNode.gain.value = this.gain;
    }
}
MZ700_Sound.prototype.startSound = function(freq) {
    if(this.audio.osc != null) {
        if(this.audio.osc.frequency.value == freq) {
            return;
        }
        this.audio.osc.stop();
        this.audio.osc.disconnect();
    }
    this.audio.osc = this.audio.ctx.createOscillator();
    this.audio.osc.start = this.audio.osc.start || this.audio.osc.noteOn;
    this.audio.osc.frequency.value = freq;
    this.gainNode = this.audio.ctx.createGain();
    this.gainNode.gain.setValueAtTime(this.gain* 0.0, this.audio.ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(this.gain * 0.7, this.audio.ctx.currentTime + 0.005);
    this.gainNode.gain.linearRampToValueAtTime(this.gain * 1.0, this.audio.ctx.currentTime + 0.010);
    this.gainNode.gain.linearRampToValueAtTime(this.gain * 0.5, this.audio.ctx.currentTime + 0.090);
    this.audio.osc.connect(this.gainNode);
    this.gainNode.connect(this.audio.ctx.destination);
    this.audio.startTime = (new Date()).getTime();
    this.audio.osc.start();
};
MZ700_Sound.prototype.stopSound = function() {
    if(this.audio.osc != null) {
        if((new Date()).getTime() - this.audio.startTime >= 10) {
            this.audio.osc.stop();
            this.audio.osc.disconnect();
        } else {
            window.setTimeout(
                (function(osc) {
                    return function() {
                        osc.stop();
                        osc.disconnect();
                    };
                }(this.audio.osc)),
                100);
        }
        //this.audio.osc = null;
    }
};
