"use strict";

/* tslint:disable: no-string-literal no-console */

/**
 * The beep-sound emulator for Sharp MZ-Serias.
 * @constructor
 */
export default class MZBeep {
    /**
     * Minimum frequency
     * @type {number}
     */
    static FREQ_MIN:number = -24000;

    /**
     * Maximum frequency
     * @type {number}
     */
    static FREQ_MAX:number = 24000;

    attackTime:number = 0.010;
    decayTime:number = 0.010;
    sustainLebel:number = 0.8;
    releaseTime:number = 0.050;

    audio = null;
    totalGain = null;
    totalGainNode = null;
    gain:number = 0;
    poly:number = 128;
    indexOsc:number = 0;
    oscNodes:OscillatorNode[] = null;
    oscGainNodes:GainNode[] = null;

    constructor() {
        window.AudioContext = window.AudioContext || window["webkitAudioContext"];
        const audioContext = (window.AudioContext ? new AudioContext() : null);

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
            this.setGain = ()=>{ /* empty */ };
            this.startSound = ()=>{ /* empty */ };
            this.stopSound = ()=>{ /* empty */ };
        }
    }

    allowToPlaySound():void {
        if(!this.resumed()) {
            this.resume();
        }
    };

    /**
     * Check the audio API is resumed (available).
     * @returns {boolean} true if the API is resumed and available,
     * otherwise false.
     */
    resumed():boolean {
        return this.audio.state === "running";
    };

    /**
     * Resume the Audio API that was blocked by its platform.
     * @async
     * @returns {Promise<undefined>} that will be resolved.
     */
    async resume() {
        await this.audio.resume();
    };

    /**
     * Set beep gain.
     * @param {number} gain The beep sound gain.
     * @returns {undefined}
     */
    setGain(gain:number):void {
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
    }

    /**
     * Start the oscillator beeping with the frequency.
     * @param {number} freq The frequency.
     * @returns {undefined}
     */
    startSound(freq:number):void {
        const indexOsc = this.indexOsc;
        let oscGainNode = this.oscGainNodes[indexOsc];
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

        const lastOscNode = this.oscNodes[indexOsc];
        if(lastOscNode != null) {
            lastOscNode.stop();
            lastOscNode.disconnect();
        }
        this.oscNodes[indexOsc] = this.audio.createOscillator();
        const oscNode = this.oscNodes[indexOsc];
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
        oscNode.start = oscNode.start || oscNode["noteOn"];
        oscNode.connect(oscGainNode);
        oscNode.start();

    }

    /**
     * Stop the oscillator beeping.
     * @param {number} freq The frequency.
     * @returns {undefined}
     */
    stopSound():void {
        const indexOsc = this.indexOsc;
        const oscGainNode = this.oscGainNodes[indexOsc];
        if(oscGainNode != null) {
            oscGainNode.gain.linearRampToValueAtTime(
                    0.0, this.audio.currentTime + this.releaseTime);
        }
        this.indexOsc = (indexOsc + 1) % this.poly;
    }
}

module.exports = MZBeep;
