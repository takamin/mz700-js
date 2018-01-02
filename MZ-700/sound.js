(function() {
    var FREQ_MIN = -24000;
    var FREQ_MAX = 24000;
    var MZ700_Sound = function() {

        this.attackTime = 0.010;
        this.decayTime = 0.010;
        this.sustainLebel = 0.8;
        this.releaseTime = 0.050;

        this.audio = null;
        this.totalGain = null;
        this.gain = 0;
        this.poly = 128;
        this.indexOsc = 0;
        this.oscNodes = new Array(this.poly);
        this.oscGainNodes = new Array(this.poly);

        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        if(window.AudioContext) {
            this.audio = new AudioContext();
            this.totalGainNode = this.audio.createGain();
            this.totalGainNode.gain.setValueAtTime(this.gain, this.audio.currentTime);
            this.totalGainNode.connect(this.audio.destination);
        } else {

            console.warn("NO AudioContext API supported by this browser.");
            this.setGain = function(){};
            this.startSound = function(){};
            this.stopSound = function(){};

        }
    };
    MZ700_Sound.prototype.setGain = function(gain) {
        if(gain < 0) {
            gain = 0;
        }
        if(gain > 1.0) {
            gain = 1.0;
        }
        this.gain = gain;
        if(this.totalGainNode) {
            this.totalGainNode.gain.setValueAtTime(this.gain, this.audio.currentTime);
        }
    };
    MZ700_Sound.prototype.startSound = function(freq) {
        if(this.oscGainNodes[this.indexOsc] != null) {
            this.oscGainNodes[this.indexOsc].gain.linearRampToValueAtTime(0.0, this.audio.currentTime + this.releaseTime);
            this.oscGainNodes[this.indexOsc].disconnect();
            this.oscGainNodes[this.indexOsc] = null;
            if(this.oscNodes[this.indexOsc] != null) {
                this.oscNodes[this.indexOsc].stop();
                this.oscNodes[this.indexOsc].disconnect();
                this.oscNodes[this.indexOsc] = null;
            }
        }
        this.oscNodes[this.indexOsc] = this.audio.createOscillator();
        this.oscNodes[this.indexOsc].type = "square";
        if(isFinite(freq)) {
            if(freq < FREQ_MIN) {
                freq = FREQ_MIN;
            } else if(freq > FREQ_MAX) {
                freq = FREQ_MAX;
            }
            this.oscNodes[this.indexOsc].frequency.setValueAtTime(
                    freq, this.audio.currentTime);
        }
        this.oscNodes[this.indexOsc].start = this.oscNodes[this.indexOsc].start || this.oscNodes[this.indexOsc].noteOn;

        this.oscGainNodes[this.indexOsc] = this.audio.createGain();
        this.oscGainNodes[this.indexOsc].gain.setValueAtTime(0.0, this.audio.currentTime);
        this.oscGainNodes[this.indexOsc].gain.linearRampToValueAtTime(1.0, this.audio.currentTime + this.attackTime);
        this.oscGainNodes[this.indexOsc].gain.linearRampToValueAtTime(this.sustainLebel, this.audio.currentTime + this.attackTime + this.decayTime);
        this.oscGainNodes[this.indexOsc].connect(this.totalGainNode);

        this.oscNodes[this.indexOsc].connect(this.oscGainNodes[this.indexOsc]);
        this.oscNodes[this.indexOsc].start();

    };
    MZ700_Sound.prototype.stopSound = function() {
        if(this.oscGainNodes[this.indexOsc] != null) {
            this.oscGainNodes[this.indexOsc].gain.linearRampToValueAtTime(0.0, this.audio.currentTime + this.releaseTime);
        }
        this.indexOsc = (this.indexOsc + 1) % this.poly;
    };
    module.exports = MZ700_Sound;
}());
