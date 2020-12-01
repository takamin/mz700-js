"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
class MZBeep {
    constructor() {
        this.attackTime = 0.010;
        this.decayTime = 0.010;
        this.sustainLebel = 0.8;
        this.releaseTime = 0.050;
        this.audio = null;
        this.totalGain = null;
        this.totalGainNode = null;
        this.gain = 0;
        this.poly = 128;
        this.indexOsc = 0;
        this.oscNodes = null;
        this.oscGainNodes = null;
        window.AudioContext = window.AudioContext || window["webkitAudioContext"];
        const audioContext = (window.AudioContext ? new AudioContext() : null);
        this.oscNodes = new Array(this.poly);
        this.oscGainNodes = new Array(this.poly);
        if (audioContext) {
            this.audio = audioContext;
            this.totalGainNode = this.audio.createGain();
            this.totalGainNode.gain.setValueAtTime(this.gain, this.audio.currentTime);
            this.totalGainNode.connect(this.audio.destination);
        }
        else {
            console.warn("NO AudioContext API supported by this browser.");
            this.setGain = () => { };
            this.startSound = () => { };
            this.stopSound = () => { };
        }
    }
    allowToPlaySound() {
        if (!this.resumed()) {
            this.resume();
        }
    }
    ;
    resumed() {
        return this.audio.state === "running";
    }
    ;
    resume() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.audio.resume();
        });
    }
    ;
    setGain(gain) {
        if (gain < 0) {
            gain = 0;
        }
        if (gain > 1.0) {
            gain = 1.0;
        }
        this.gain = gain;
        if (this.totalGainNode) {
            this.totalGainNode.gain.setValueAtTime(this.gain, this.audio.currentTime);
        }
    }
    startSound(freq) {
        const indexOsc = this.indexOsc;
        let oscGainNode = this.oscGainNodes[indexOsc];
        if (oscGainNode != null) {
            oscGainNode.gain.linearRampToValueAtTime(0.0, this.audio.currentTime + this.releaseTime);
            oscGainNode.disconnect();
        }
        this.oscGainNodes[indexOsc] = this.audio.createGain();
        oscGainNode = this.oscGainNodes[indexOsc];
        oscGainNode.gain.setValueAtTime(0.0, this.audio.currentTime);
        oscGainNode.gain.linearRampToValueAtTime(1.0, this.audio.currentTime + this.attackTime);
        oscGainNode.gain.linearRampToValueAtTime(this.sustainLebel, this.audio.currentTime + this.attackTime + this.decayTime);
        oscGainNode.connect(this.totalGainNode);
        const lastOscNode = this.oscNodes[indexOsc];
        if (lastOscNode != null) {
            lastOscNode.stop();
            lastOscNode.disconnect();
        }
        this.oscNodes[indexOsc] = this.audio.createOscillator();
        const oscNode = this.oscNodes[indexOsc];
        oscNode.type = "square";
        if (isFinite(freq)) {
            if (freq < MZBeep.FREQ_MIN) {
                freq = MZBeep.FREQ_MIN;
            }
            else if (freq > MZBeep.FREQ_MAX) {
                freq = MZBeep.FREQ_MAX;
            }
            oscNode.frequency.setValueAtTime(freq, this.audio.currentTime);
        }
        oscNode.start = oscNode.start || oscNode["noteOn"];
        oscNode.connect(oscGainNode);
        oscNode.start();
    }
    stopSound() {
        const indexOsc = this.indexOsc;
        const oscGainNode = this.oscGainNodes[indexOsc];
        if (oscGainNode != null) {
            oscGainNode.gain.linearRampToValueAtTime(0.0, this.audio.currentTime + this.releaseTime);
        }
        this.indexOsc = (indexOsc + 1) % this.poly;
    }
}
exports.default = MZBeep;
MZBeep.FREQ_MIN = -24000;
MZBeep.FREQ_MAX = 24000;
module.exports = MZBeep;
//# sourceMappingURL=mz-beep.js.map