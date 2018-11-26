(function() {
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("soundctrl");
    var soundctrl = function(element) {
        this.element = element;
        $(this.element).addClass("soundctrl");
        this.opt = {
            "sound": null,
            "onChangeVolume": function(/*volume*/) {},
            "onChangeMute": function(/*mute*/) {},
            "urlIconOn": 'images/icon-sound-on.svg',
            "urlIconOff": 'images/icon-sound-off.svg',
            "colOn": 'red',
            "colOff": 'silver',
            "colMute": 'gray',
            "maxVolume": 10,
            "initialVolume": 10,
            "initialMute": false
        };
        this.mute = false;
        this.volume = 10;
    };
    window.soundctrl = soundctrl;
    soundctrl.prototype.create = function(opt) {
        Object.keys(this.opt).forEach(function(key) {
            if(key in opt) {
                this.opt[key] = opt[key];
            }
        }, this);
        this.iconOn = $("<img/>")
            .attr('src', this.opt.urlIconOn)
            .attr("width", "100%")
            .attr("height", "100%");
        this.iconOff = $("<img/>")
            .attr('src', this.opt.urlIconOff)
            .attr("width", "100%")
            .attr("height", "100%");
        if(this.opt.initialMute) {
            this.iconOn.css("display","none");
            this.mute = true;
        } else {
            this.iconOff.css("display","none");
            this.mute = false;
        }
        this.gauges = [];
        var volumeGauge = $("<span/>").addClass("gauge")
                .css("display","inline-block")
                .css("padding-right", this.opt.stepMargin);
        for(var i = 0; i < this.opt.maxVolume; i++) {
            var gauge = $("<span/>").addClass("step")
                .css("display","inline-block")
                .click((function(volume) { return function() {
                    this.opt.sound.allowToPlaySound();
                    this.gaugeOnClick(volume);
                };}(i + 1)).bind(this))
                .css("overflow", "hidden")
                .html(" ");
            this.gauges.push(gauge);
            volumeGauge.append(gauge);
        }
        $(this.element)
            .append($("<button type='button'/>")
                    .addClass("muteButton")
                    .css("padding", "0")
                    .append(this.iconOn)
                    .append(this.iconOff)
                    .click(() => {
                        this.opt.sound.allowToPlaySound();
                        this.muteOnClick();
                    }))
            .append(volumeGauge);
        setTimeout(() => {
            this.setVolume(this.opt.initialVolume);
            this.setMute(this.opt.initialMute);
        }, 1);
    };
    soundctrl.prototype.muteOnClick = function() {
        this.setMute(!this.mute);
    };
    soundctrl.prototype.gaugeOnClick = function(volume) {
        this.setVolume(volume);
    };
    soundctrl.prototype.setMute = function(mute) {
        this.mute = mute;
        this.redrawMuteButton();
        this.opt.onChangeMute(this.mute);
        this.redrawGauge();
        if(this.mute) {
            this.opt.onChangeVolume(0);
            this.opt.sound.setGain(0);
        } else {
            this.opt.onChangeVolume(this.volume);
            this.opt.sound.setGain(this.volume / 10);
        }
    };
    soundctrl.prototype.setVolume = function(volume) {
        if(volume <= 0) {
            this.setMute(true);
            return;
        }
        if(volume >= this.opt.maxVolume) {
            volume = this.opt.maxVolume;
        }
        if(this.mute) {
            this.mute = false;
            this.redrawMuteButton();
            this.opt.onChangeMute(this.mute);
        }
        this.volume = volume;
        this.redrawGauge();
        this.opt.onChangeVolume(this.volume);
        this.opt.sound.setGain(this.volume / 10);
    };
    soundctrl.prototype.redrawMuteButton = function() {
        if(this.mute) {
            this.iconOn.css("display","none");
            this.iconOff.css("display","block");
        } else {
            this.iconOn.css("display","block");
            this.iconOff.css("display","none");
        }
    };
    soundctrl.prototype.redrawGauge = function() {
        for(var i = 0; i < this.opt.maxVolume; i++) {
            var c = this.opt.colMute;
            if(i >= this.volume) {
                c = this.opt.colOff;
            } else if(!this.mute) {
                c = this.opt.colOn;
            }
            this.gauges[i].css('background-color', c);
        }
    };
}());
