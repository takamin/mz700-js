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
            this.totalGainNode.gain.setValueAtTime(
                    this.gain, this.audio.currentTime);
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
            this.totalGainNode.gain.setValueAtTime(
                    this.gain, this.audio.currentTime);
        }
    };
    MZ700_Sound.prototype.startSound = function(freq) {
        var indexOsc = this.indexOsc;
        var oscGainNode = this.oscGainNodes[indexOsc];
        if(oscGainNode != null) {
            oscGainNode.gain.linearRampToValueAtTime(
                    0.0, this.audio.currentTime + this.releaseTime);
            oscGainNode.disconnect();
        }
        this.oscGainNodes[indexOsc] = this.audio.createGain();
        oscGainNode = this.oscGainNodes[indexOsc];
        oscGainNode.gain.setValueAtTime(0.0, this.audio.currentTime);
        oscGainNode.gain.linearRampToValueAtTime(
                1.0, this.audio.currentTime + this.attackTime);
        oscGainNode.gain.linearRampToValueAtTime(
                this.sustainLebel,
                this.audio.currentTime + this.attackTime + this.decayTime);
        oscGainNode.connect(this.totalGainNode);

        var oscNode = this.oscNodes[indexOsc];
        if(oscNode != null) {
            oscNode.stop();
            oscNode.disconnect();
        }
        this.oscNodes[indexOsc] = this.audio.createOscillator();
        oscNode = this.oscNodes[indexOsc];
        oscNode.type = "square";
        if(isFinite(freq)) {
            if(freq < FREQ_MIN) {
                freq = FREQ_MIN;
            } else if(freq > FREQ_MAX) {
                freq = FREQ_MAX;
            }
            oscNode.frequency.setValueAtTime(
                    freq, this.audio.currentTime);
        }
        oscNode.start = oscNode.start || oscNode.noteOn;
        oscNode.connect(oscGainNode);
        oscNode.start();

    };
    MZ700_Sound.prototype.stopSound = function() {
        var indexOsc = this.indexOsc;
        var oscGainNode = this.oscGainNodes[indexOsc];
        if(oscGainNode != null) {
            oscGainNode.gain.linearRampToValueAtTime(
                    0.0, this.audio.currentTime + this.releaseTime);
        }
        this.indexOsc = (indexOsc + 1) % this.poly;
    };
    module.exports = MZ700_Sound;
}());
