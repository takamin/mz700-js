"use strict";
const jquery_plugin_class = require("../lib/jquery_plugin_class");
jquery_plugin_class("MZControlPanel");

const BBox = require("b-box");

const { getDeviceType } = require("./user-agent-util.js");
const parseRequest = require("../lib/parse-request");
const requestJsonp = require("../lib/jsonp");

const MZ_TapeHeader = require('../lib/mz-tape-header.js');
const NumberUtil = require("../lib/number-util.js");

function MZControlPanel(element) {
    this._element = element;
    this._mz700jsContainer = $(element);
    this._mz700ScreenElement = $(element).find(".screen").get(0);
    this._mz700js = null;

    this._controlPanel = $("<div/>").attr("id", "control-panel");
    this._keyboard = $("<div/>").addClass("keyboard");
    this._emulationPanel = $("<div/>").addClass("emulation-panel");
    this._dataRecorder = $("<div/>").addClass("data-recorder");

    this._mz700jsContainer
        .append(this._controlPanel
            .append(this._keyboard)
            .append(this._emulationPanel)
            .append(this._dataRecorder));

    this._acceptKey = false;
    this._keyAcceptor = $("<span/>").addClass("key-switcher").html("Key-In");
    this._tidHide = null;
    this._isRunning = false;
    window.addEventListener("mz700started", () => {
        this._isRunning = true;
    });
    window.addEventListener("mz700stopped", () => {
        this._isRunning = false;
    });
}

MZControlPanel.prototype.create = async function(mz700js, mzBeep, baseClock) {
    this._mz700js = mz700js;
    this.createSoftwareKeyboard();
    this._emuSpeedControl = $("<span/>").EmuSpeedControl("create", baseClock);
    this._emuSpeedControl.get(0).addEventListener("clockFactorChange", event => {
        const routeEvent = new Event("clockFactorChange");
        routeEvent.clockFactor = event.clockFactor;
        this._element.dispatchEvent(routeEvent);
    });
    this._emulationPanel
        .append(this._keyAcceptor)
        .append($("<span/>").MZSoundControl("create", mzBeep))
        .append(this.createStartButton())
        .append(this.createResetButton())
        .append(this.createStepInButton())
        .append(this._emuSpeedControl)
        .append(this.createScreenKeyboardButton())
        .append(this.createFullScreenButton());

    switch(getDeviceType()) {
    case "tablet":
        this._controlPanel.click( event => {
            event.stopPropagation();
            this.toggleVisibility();
        });
        break;
    case "pc":
        this._mz700jsContainer.mouseenter(() => {
            this.acceptKey(true);
        }).mouseleave(() => {
            this.acceptKey(false);
            this.hide();
            this.cancelTimer();
        });
        this._controlPanel.mouseenter(event => {
            event.stopPropagation();
            this.acceptKey(true);
            this.cancelTimer();
            this._controlPanel.show(0, () => {
                this.resize();
            });
        });
        this.show();
        break;
    }
    this.createDataRecorderControl();

    const mztButtons = await this.createPublicMztLoadingButtons();
    this._controlPanel.append(mztButtons);
}

MZControlPanel.prototype.clockFactor = function(clockFactor) {
    this._emuSpeedControl.EmuSpeedControl("clockFactor", clockFactor);
};

MZControlPanel.prototype.createSoftwareKeyboard = function() {
    this._keyboard.mz700keyboard("create", {
        onStateChange: (strobe, bit, state) => {
            const event = new Event("KeyStrobeStateChange");
            event.data = { strobe, bit, state };
            this._element.dispatchEvent(event);
        }
    });
    window.addEventListener("keyup", async event => {
        switch(event.keyCode) {
        case 119://F8 - RUN/STOP
            event.stopPropagation();
            if(this._isRunning) {
                this._mz700jsContainer.trigger("stop");
            } else {
                this._mz700jsContainer.trigger("start");
            }
            return;
        case 120://F9 - STEP In
            event.stopPropagation();
            if(this._isRunning) {
                this._mz700jsContainer.trigger("stop");
            } else {
                this._mz700jsContainer.trigger("stepIn");
            }
            return;
        }
    });
};

MZControlPanel.prototype.createDataRecorderControl = function() {
    this.cmtMessageArea = $("<span/>").addClass("cmt-message").html("(EMPTY)");
    const btnCmtRec = $("<button/>").attr("type", "button").addClass("rec")
        .html("<span style='color:red'>●</span> RECPLAY").click( () => {
            this.cmtMessageArea.empty().html("Recording ...");
            this._element.dispatchEvent(new Event("DataRecorderRec"));
        });
    const btnCmtPlay = $("<button/>").attr("type", "button").addClass("play")
        .html("<span class='cmtPlayImage'>▼</span> PLAY").click( () => {
            this._element.dispatchEvent(new Event("DataRecorderPlay"));
        });
    const btnCmtStop = $("<button/>").attr("type", "button").addClass("stop")
        .html("<span>■</span> STOP").click( () => {
            this._element.dispatchEvent(new Event("DataRecorderStop"));
        });
    const btnCmtEject = $("<button/>").attr("type", "button").addClass("eject")
        .html("<span>▲</span>EJECT").click( () => {
            this._element.dispatchEvent(new Event("DataRecorderEject"));
        });
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        let el = this._dataRecorder.get(0);
        el.addEventListener('dragover', event => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
        }, false);
        el.addEventListener('drop', event => {
            event.stopPropagation();
            event.preventDefault();
            let files = event.dataTransfer.files; // FileList object.
            if(files.length > 0) {
                let f = files[0];
                let reader = new FileReader();
                reader.onload = () => {
                    const tapeData = new Uint8Array(reader.result);
                    const setTapeEvent = new Event("DataRecorderSetTape");
                    setTapeEvent.tapeData = tapeData;
                    this._element.dispatchEvent(setTapeEvent);
                };
                reader.readAsArrayBuffer(f);
            }
        }, false);
    }
    this._dataRecorder
        .html("CMT: ")
        .attr("title", "Drop MZT file here to load with 'L' command")
        .append(this.cmtMessageArea)
        .append(btnCmtRec)
        .append(btnCmtPlay)
        .append(btnCmtStop)
        .append(btnCmtEject);

};

MZControlPanel.prototype.startDataRecorder = function() {
    this._dataRecorder.find("button.rec").prop("disabled", true);
    this._dataRecorder.find("button.play").prop("disabled", true);
    this._dataRecorder.find("button.stop").prop("disabled", false);
};

MZControlPanel.prototype.stopDataRecorder = async function() {
    await this.updateCmtSlot();
    this._dataRecorder.find("button.rec").prop("disabled", false);
    this._dataRecorder.find("button.play").prop("disabled", false);
    this._dataRecorder.find("button.stop").prop("disabled", true);
};

MZControlPanel.prototype.updateCmtSlot = async function() {
    const bytes = await this._mz700js.getCassetteTape();
    this.createCmtDownloadLink(bytes);
};

MZControlPanel.prototype.createCmtDownloadLink = function(bytes) {
    if(bytes == null || bytes.length < 128) {
        this.cmtMessageArea.empty().append("(EMPTY)");
        return;
    }
    let header = new MZ_TapeHeader(bytes, 0);
    let byteArr = new Uint8Array(bytes);
    let blob = new Blob([byteArr], {'type': "application/octet-stream"});
    this.cmtMessageArea.empty().html(header.filename).append(
            $("<a/>").addClass("download-link")
                .attr("download", header.filename + ".MZT")
                .attr("type", "application/octet-stream")
                .attr("href", URL.createObjectURL(blob))
                .html("")
                .attr("title",
                    "Download " + header.filename + ".MZT" +
                    " (" + header.file_size + " bytes) " +
                    " ADDR:(" + NumberUtil.HEX(header.addr_load, 4) + " - " +
                    NumberUtil.HEX(header.addr_load + header.file_size - 1, 4) + ") EXEC:" +
                    NumberUtil.HEX(header.addr_exec, 4))
            );
};

/**
 * Create the buttons to download and run the public MZT binary.
 * @returns {Promise<undefined>} The promise to synchronize
 */
MZControlPanel.prototype.createPublicMztLoadingButtons = function() {
    const request = parseRequest();
    return new Promise( resolve => {
        requestJsonp("mztList",
            "https://takamin.github.io/MZ-700/mzt/mzt-list.js",
            files => {
                const mztButtons = $("<div/>");
                files.forEach(mzt => {
                    mztButtons.append(
                        $("<button/>").attr("type", "button")
                        .css("padding", 0).css("height", "24px")
                        .css("border", "solid 0px transparent")
                        .css("padding", 0).css("margin", "4px 2px")
                        .append($("<span/>").addClass("mz700scrn")
                            .attr("charSize", "8").attr("padding", "1")
                            .attr("color", mzt.mz700_buttonStyle.color)
                            .attr("bgColor", mzt.mz700_buttonStyle.bgColor)
                            .html(mzt.name))
                        .click(() => {
                            window.location.href =
                                request.path + "?mzt=" + mzt.path;
                        }));
                });
                resolve(mztButtons);
            });
    });
};

MZControlPanel.prototype.acceptKey = function(state) {
    if(state == null) {
        return this._acceptKey;
    }
    this._acceptKey = state;
    if(this._acceptKey) {
        this._keyAcceptor.addClass("on");
    } else {
        this._keyAcceptor.removeClass("on");
    }
};

/**
 * Show the panel to operate MZ-700.
 * @returns {undefined}
 */
MZControlPanel.prototype.show = function() {
    if(this._tidHide) {
        clearTimeout(this._tidHide);
    } else {
        this._controlPanel.addClass("hover");
        this._controlPanel.show(0, () => {
            this.resize();
        });
    }
    this._tidHide = setTimeout(() => {
        this.hide();
        this._tidHide = null;
    }, 1000);
};

/**
 * Hide the panel to operate MZ-700.
 * @returns {undefined}
 */
MZControlPanel.prototype.hide = function() {
    this._controlPanel.removeClass("hover");
    this._controlPanel.hide();
};

/**
 * Cancel the timeout timer of control panel showing.
 * @returns {undefined}
 */
MZControlPanel.prototype.cancelTimer = function() {
    if(this._tidHide) {
        clearTimeout(this._tidHide);
        this._tidHide = null;
    }
};

MZControlPanel.prototype.resize = function() {
    var bboxContainer = new BBox(this._mz700jsContainer.get(0));
    var bboxScreen = new BBox(this._mz700ScreenElement);
    var containerSize = bboxContainer.getSize();
    containerSize._h -= bboxScreen.px("border-top-width");
    containerSize._h -= bboxScreen.px("border-bottom-width");
    var orgSize = new BBox.Size(320,200);
    var innerSize = containerSize.getMaxInscribedSize(orgSize);

    if(this._controlPanel.is(":visible")) {
        var phifBBox = new BBox(this._controlPanel.get(0));
        var phifSize = phifBBox.getSize();
        var phifMargin = new BBox.Size(
                (containerSize._w - phifSize._w) / 2,
                innerSize._h - phifSize._h);
        if(phifMargin._w < 0) {
            phifMargin._w = 0;
        }
        if(phifMargin._h < 0) {
            phifMargin._h = 0;
        }
        this._controlPanel.css("margin-left", phifMargin._w + "px")
            .css("margin-top", phifMargin._h + "px");
    }
};

/**
 * Toggle the control panel visibility.
 * @returns {undefined}
 */
MZControlPanel.prototype.toggleVisibility = function() {
    if(this._controlPanel.css("display") !== "none") {
        this._controlPanel.hide(0, () => {
            this.resize();
        });
    } else {
        this._controlPanel.show(0, () => {
            this.resize();
        });
    }
};

//
// Run/Stop Button
//
MZControlPanel.prototype.createStartButton = function() {
    let btnStart = $("<button/>")
        .attr("type", "button")
        .attr("title", "[F8]")
        .addClass("imaged")
        .click(() => {
            if(this._isRunning) {
                this._mz700jsContainer.trigger("stop");
            } else {
                this._mz700jsContainer.trigger("start");
            }
        });
    let img = $("<img/>");
    btnStart.append(img);
    let setImg = relURL => {
        img.attr("src", `./${relURL}`);
    };
    let setAlt = caption => {
        img.attr("title", caption).attr("alt", caption);
    };
    btnStart.hover( () => {
        setImg(this._isRunning ?
            "image/btnStop-on.png" :
            "image/btnRun-on.png");
    }, () => {
        setImg(this._isRunning ?
            "image/btnStop-off.png" :
            "image/btnRun-off.png");
    });
    window.addEventListener("mz700started", () => {
        setImg("image/btnStop-off.png");
        setAlt("Stop");
    });
    window.addEventListener("mz700stopped", () => {
        setImg("image/btnRun-off.png");
        setAlt("Run");
    });
    setImg("image/btnRun-off.png");
    setAlt("Run");
    return btnStart;
};

//
// Reset Button
//
MZControlPanel.prototype.createResetButton = function() {
    const btnReset = $("<button/>").attr("type", "button")
        .addClass("imaged").append(
            $("<img/>").attr("title", "Reset").attr("alt", "Reset"))
        .click(() => this._mz700jsContainer.trigger("reset"));

    const btnReset_hover = () => {
        btnReset.find("img")
            .attr("src", "./image/btnReset-on.png");
    };

    const btnReset_notHover = () => {
        btnReset.find("img")
            .attr("src", "./image/btnReset-off.png");
    };

    btnReset.hover(btnReset_hover, btnReset_notHover);
    btnReset_notHover();
    return btnReset;
};

//
// Step-In Button
//
MZControlPanel.prototype.createStepInButton = function() {
    const btnStep = $("<button/>").attr("type", "button")
        .attr("title", "[F9]").addClass("imaged")
        .click( () => this._mz700jsContainer.trigger("stepIn") );
    const img = $("<img/>")
        .attr("title", "Step-In")
        .attr("alt", "Step-In");
    btnStep.append(img);
    const setImg = relURL => {
        img.attr("src", `./${relURL}`);
    };
    btnStep.hover(() => {
        if(!this._isRunning) {
            btnStep.prop('disabled', '');
            setImg("image/btnStepIn-on.png");
        }
    }, () => {
        if(!this._isRunning) {
            btnStep.prop('disabled', '');
            setImg("image/btnStepIn-off.png");
        }
    });
    window.addEventListener("mz700started", () => {
        btnStep.prop('disabled', 'disabled')
        setImg("image/btnStepIn-disabled.png");
    });
    window.addEventListener("mz700stopped", () => {
        btnStep.prop('disabled', '');
        setImg("image/btnStepIn-off.png");
    });
    setImg("image/btnStepIn-off.png");
    return btnStep;
};

/**
 * Create Screen keyboard button.
 * @returns {ToggleButton} The ToggleButton widget.
 */
MZControlPanel.prototype.createScreenKeyboardButton = function() {
    const button = $("<button/>")
        .addClass("imaged").attr("id", "btnToggleScreenKeyboard")
        .append($("<img/>")
            .attr("src", "./image/btnKeyboard-off.png")
            .attr("title", "Keyboard").attr("alt", "Keyboard"))
        .ToggleButton("create", {
            on: button => {
                button.find("img")
                    .attr("src", "./image/btnKeyboard-on.png");
                $(".keyboard").show();
                this.resize();
            },
            off: button => {
                button.find("img")
                    .attr("src", "./image/btnKeyboard-off.png");
                $(".keyboard").hide();
                this.resize();
            },
        });
    switch(getDeviceType()) {
        case "mobile":
            button.ToggleButton("on");
            break;
        case "tablet":
            button.ToggleButton("off");
            break;
        case "pc":
            button.ToggleButton("off");
            break;
    }
    return button;
};

/**
 * Create Full screen button.
 * @returns {ToggleButton} The ToggleButton widget.
 */
MZControlPanel.prototype.createFullScreenButton = function() {
    const onclick = () => {
        if(document.fullscreenElement === document.body) {
            document.exitFullscreen();
        } else {
            document.body.requestFullscreen().then(() => {
                this.acceptKey(true);
            });
        }
    };
    const button = $("<button/>")
        .attr("id", "fullscreenButton").addClass("imaged off")
        .append($("<img/>")
            .attr("src", "./image/btnFullscreen-off.png")
            .attr("title", "Fullscreen")
            .attr("alt", "Fullscreen"))
        .ToggleButton("create", {
            autoState: false,
            on: onclick,
            off: onclick,
        });

    document.addEventListener("fullscreenchange", () => {
        if(document.fullscreenElement == null) {
            button.ToggleButton("setOff")
                .find("img")
                    .attr("src", "./image/btnFullscreen-off.png")
                    .attr("title", "Fullscreen")
                    .attr("alt", "Fullscreen");
        } else {
            button.ToggleButton("setOn")
                .find("img")
                    .attr("src", "./image/btnFullscreen-on.png")
                    .attr("title", "Exit Fullscreen")
                    .attr("alt", "Exit Fullscreen");
        }
    });
    return button;
};

// Handle Key events
MZControlPanel.prototype.updateKeyStates = function(strobe, bit, state) {
    this._keyboard.mz700keyboard("setState", strobe, bit, state);
};

window.MZControlPanel = MZControlPanel;
module.exports = MZControlPanel;
