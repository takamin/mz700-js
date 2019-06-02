"use strict";

/**
 * The beep-sound emulator for Sharp MZ-Serias.
 * @constructor
 * @param {AudioContext} audioContext The audio context instance.
 */
function MZBeep(audioContext) {

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

    if(audioContext) {
        this.audio = audioContext;
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

}

/**
 * Minimum frequency
 * @type {number}
 */
MZBeep.FREQ_MIN = -24000;

/**
 * Maximum frequency
 * @type {number}
 */
MZBeep.FREQ_MAX = 24000;

MZBeep.prototype.allowToPlaySound = function() {
    if(!this.resumed()) {
        this.resume();
    }
};

/**
 * Check the audio API is resumed (available).
 * @returns {boolean} true if the API is resumed and available,
 * otherwise false.
 */
MZBeep.prototype.resumed = function() {
    return this.audio.state === "running";
};

/**
 * Resume the Audio API that was blocked by its platform.
 * @async
 * @returns {Promise<undefined>} that will be resolved.
 */
MZBeep.prototype.resume = async function() {
    await this.audio.resume();
};

/**
 * Set beep gain.
 * @param {number} gain The beep sound gain.
 * @returns {undefined}
 */
MZBeep.prototype.setGain = function(gain) {
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

/**
 * Start the oscillator beeping with the frequency.
 * @param {number} freq The frequency.
 * @returns {undefined}
 */
MZBeep.prototype.startSound = function(freq) {
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
        if(freq < MZBeep.FREQ_MIN) {
            freq = MZBeep.FREQ_MIN;
        } else if(freq > MZBeep.FREQ_MAX) {
            freq = MZBeep.FREQ_MAX;
        }
        oscNode.frequency.setValueAtTime(
                freq, this.audio.currentTime);
    }
    oscNode.start = oscNode.start || oscNode.noteOn;
    oscNode.connect(oscGainNode);
    oscNode.start();

};

/**
 * Stop the oscillator beeping.
 * @param {number} freq The frequency.
 * @returns {undefined}
 */
MZBeep.prototype.stopSound = function() {
    var indexOsc = this.indexOsc;
    var oscGainNode = this.oscGainNodes[indexOsc];
    if(oscGainNode != null) {
        oscGainNode.gain.linearRampToValueAtTime(
                0.0, this.audio.currentTime + this.releaseTime);
    }
    this.indexOsc = (indexOsc + 1) % this.poly;
};

module.exports = MZBeep;
