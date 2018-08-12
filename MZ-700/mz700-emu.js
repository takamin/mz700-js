const packageJson = require("../package.json");
window.jQuery = require("jquery");
require("jquery-ui");
require("fullscrn");
require("../lib/jquery.ddpanel.js");
require("../lib/jquery.toggle-button.js");
var dock_n_liquid = require("dock-n-liquid");
var BBox = require("b-box");
var MZ700EmuBase = require("./mz700-emu-base.js");
const parseRequest = require("../lib/parse-request");
const requestJsonp = require("../lib/jsonp");


let $ = window.jQuery;

/**
 * class MZ700Js
 * @constructor
 */
var MZ700Js = function() {
    MZ700EmuBase.call(this);

    // identify user agent
    let ua = navigator.userAgent;
    this.deviceType = null;
    if (ua.indexOf('iPhone') >= 0 || ua.indexOf('iPod') >= 0 ||
        ua.indexOf('Android') >= 0 && ua.indexOf('Mobile') >= 0)
    {
        this.deviceType = "mobile";
    } else if (ua.indexOf('iPad') >= 0 || ua.indexOf('Android') >= 0) {
        this.deviceType = "tablet";
    } else {
        this.deviceType = "pc";
    }

    this.container = $(".MZ-700-body");
    this.screen = this.container.find(".screen");
    this.screen.find("canvas").css("height", "calc(100% - 1px)");
    this.uiElement = $("#human-interface");
    this.mouseMoveTimeoutId = null;
    this.fullscreenElement = document.body;

    // Dock'n'Liquid panels
    this.liquidRoot = dock_n_liquid.select($("#liquid-panel-MZ-700").get(0));
    this.dockPanelHeader = $("#dock-panel-header");
    this.dockPanelRight = $("#dock-panel-right");

    this.request = parseRequest();
};

/**
 * MZ700Js extends MZ700EmuBase.
 * @type {MZ700EmuBase}
 */
MZ700Js.prototype = new MZ700EmuBase();

/**
 * Create emulator on the Web.
 * @async
 * @returns {Promise<undefined>} to sync.
 */
MZ700Js.prototype.create = async function() {

    await MZ700EmuBase.prototype.create.call(this, {
        urlPrefix : "./",
        screenElement : document.querySelector(".MZ-700 .screen"),
        mztDroppableElement: document.querySelector(".MZ-700 .cmt-slot"),
        controlPanelElement: document.querySelector(".MZ-700 .ctrl-panel"),
        dataRecorderElement: document.querySelector(".MZ-700 .data-recorder"),
        keyboardElement: document.querySelector(".MZ-700 .keyboard"),
    });

    $(".MZ-700 .ctrl-panel")
        .append(this.createScreenKeyboardButton())
        .append(this.createFullscreenButton());

    await this.createPublicMztLoadingButtons();

    if(this.deviceType !== "pc") {
        this.dockPanelRight.remove();
    }
    this.setupControlPanel();

    let title = [
        packageJson.description,"(",
        packageJson.name,
        "@",packageJson.version,")"
    ].join("");
    $("title").html(title);
    $("h1 .mz700scrn").html(title);
    $("span.mz700scrn").each(function() {
        window.mz700scrn.convert(this);
    });

    dock_n_liquid.init(() => this.resizeScreen() );
    dock_n_liquid.select($(".MZ-700").get(0)).layout();
    window.addEventListener("resize", () => {
        this.liquidRoot.layout();
        this.resizeScreen();
    });
    this.liquidRoot.layout();
    this.resizeScreen();

    await this.reset();

    // Load the MZT file, if specified at QUERY_STRING
    if("mzt" in this.request.parameters) {
        await requestJsonp("loadMZT",
            "https://takamin.github.io/MZ-700/mzt/" + this.request.parameters.mzt + ".js",
            async tape_data => { await this.setMztData(tape_data); });
    }
};

/**
 * Create Screen keyboard button.
 * @returns {ToggleButton} The ToggleButton widget.
 */
MZ700Js.prototype.createScreenKeyboardButton = function() {
    let screenKeyboardButton = $("<button/>")
        .addClass("imaged").attr("id", "btnToggleScreenKeyboard")
        .append($("<img/>")
            .attr("src", `${this.opt.urlPrefix}image/btnKeyboard-off.png`)
            .attr("title", "Keyboard").attr("alt", "Keyboard"))
        .ToggleButton("create", {
            on: button => {
                button.find("img")
                    .attr("src", `${this.opt.urlPrefix}image/btnKeyboard-on.png`);
                $(".keyboard").show();
                this.resizeScreen();
            },
            off: button => {
                button.find("img")
                    .attr("src", `${this.opt.urlPrefix}image/btnKeyboard-off.png`);
                $(".keyboard").hide();
                this.resizeScreen();
            },
        });
    switch(this.deviceType) {
        case "mobile":
            screenKeyboardButton.ToggleButton("on");
            break;
        case "tablet":
            screenKeyboardButton.ToggleButton("off");
            break;
        case "pc":
            screenKeyboardButton.ToggleButton("off");
            break;
    }
    return screenKeyboardButton;
};

/**
 * Create Full screen button.
 * @returns {ToggleButton} The ToggleButton widget.
 */
MZ700Js.prototype.createFullscreenButton = function() {
    let onclick = () => {
        if(document.fullscreenElement === this.fullscreenElement) {
            document.exitFullscreen().then(() => {
                this.liquidRoot.layout();
                this.resizeScreen();
            });
        } else {
            this.fullscreenElement.requestFullscreen().then(() => {
                this.liquidRoot.layout();
                this.resizeScreen();
                this.acceptKey(true);
            });
        }
    };
    let fullscreenButton = $("<button/>")
        .attr("id", "fullscreenButton").addClass("imaged off")
        .append($("<img/>")
            .attr("src", `${this.opt.urlPrefix}image/btnFullscreen-off.png`)
            .attr("title", "Fullscreen")
            .attr("alt", "Fullscreen"))
        .ToggleButton("create", { autoState: false, on: onclick, off: onclick, });

    document.addEventListener("fullscreenchange", () => {
        if(document.fullscreenElement == null) {
            this.dockPanelHeader.show();
            this.dockPanelRight.show();
            fullscreenButton.ToggleButton("setOff")
                .find("img")
                    .attr("src", `${this.opt.urlPrefix}image/btnFullscreen-off.png`)
                    .attr("title", "Fullscreen")
                    .attr("alt", "Fullscreen");
        } else {
            this.dockPanelHeader.hide();
            this.dockPanelRight.hide();
            fullscreenButton.ToggleButton("setOn")
                .find("img")
                    .attr("src", `${this.opt.urlPrefix}image/btnFullscreen-on.png`)
                    .attr("title", "Exit Fullscreen")
                    .attr("alt", "Exit Fullscreen");
        }
        this.liquidRoot.layout();
        this.resizeScreen();
    });
    return fullscreenButton;
};

/**
 * Create the buttons to download and run the public MZT binary.
 * @async
 * @returns {Promise<undefined>} The promise to synchronize
 */
MZ700Js.prototype.createPublicMztLoadingButtons = async function() {
    await requestJsonp("mztList",
        "https://takamin.github.io/MZ-700/mzt/mzt-list.js",
        files => {
            var mztButtons = $("<div/>");
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
                            this.request.path + "?mzt=" + mzt.path;
                    }));
            });
            $("#human-interface").append(mztButtons);
        });
};

/**
 * Setup screen apearance and behavior by each device type.
 * @returns {undefined}
 */
MZ700Js.prototype.setupControlPanel = function() {

    switch(this.deviceType) {
        case "tablet":
            this.screen.click(event => {
                event.stopPropagation();
                this.toggleCtrlPanel();
            });
            this.uiElement.click( event => {
                event.stopPropagation();
                this.toggleCtrlPanel();
            });
            break;
        case "pc":
            this.showCtrlPanel();
            this.screen.mousemove(event => {
                event.stopPropagation();
                this.acceptKey(true);
                this.showCtrlPanel();
            });
            this.uiElement.mouseenter(event => {
                event.stopPropagation();
                this.acceptKey(true);
                this.cancelCtrlPanelTimeout();
                this.uiElement.show(0, () => {
                    this.resizeScreen();
                    this.resizeScreen();
                });
            });
            this.container.mouseenter(() => {
                this.acceptKey(true);
            }).mouseleave(() => {
                this.acceptKey(false);
                this.hideCtrlPanel();
                this.cancelCtrlPanelTimeout();
            });
            break;
    }
};

/**
 * Show the panel to operate MZ-700.
 * @returns {undefined}
 */
MZ700Js.prototype.showCtrlPanel = function() {
    if(this.mouseMoveTimeoutId) {
        clearTimeout(this.mouseMoveTimeoutId);
    } else {
        this.uiElement.addClass("hover");
        this.uiElement.show(0, () => {
            this.resizeScreen();
            this.resizeScreen();
        });
    }
    this.mouseMoveTimeoutId = setTimeout(() => {
        this.hideCtrlPanel();
        this.mouseMoveTimeoutId = null;
    }, 1000);
};

/**
 * Hide the panel to operate MZ-700.
 * @returns {undefined}
 */
MZ700Js.prototype.hideCtrlPanel = function() {
    this.uiElement.removeClass("hover");
    this.uiElement.hide();
};

/**
 * Cancel the timeout timer of control panel showing.
 * @returns {undefined}
 */
MZ700Js.prototype.cancelCtrlPanelTimeout = function() {
    if(this.mouseMoveTimeoutId) {
        clearTimeout(this.mouseMoveTimeoutId);
        this.mouseMoveTimeoutId = null;
    }
};

/**
 * Toggle the control panel visibility.
 * @returns {undefined}
 */
MZ700Js.prototype.toggleCtrlPanel = function() {
    if(this.uiElement.css("display") !== "none") {
        this.uiElement.hide(0, () => {
            this.resizeScreen();
            this.resizeScreen();
        });
    } else {
        this.uiElement.show(0, () => {
            this.resizeScreen();
            this.resizeScreen();
        });
    }
};

/**
 * Resize the MZ-700 Screen.
 * @returns {undefined}
 */
MZ700Js.prototype.resizeScreen = function() {
    var bboxContainer = new BBox(this.container.get(0));
    var bboxScreen = new BBox(this.screen.get(0));
    var containerSize = bboxContainer.getSize();
    containerSize._h -= bboxScreen.px("border-top-width");
    containerSize._h -= bboxScreen.px("border-bottom-width");

    var orgSize = new BBox.Size(320,200);
    var innerSize = containerSize.getMaxInscribedSize(orgSize);
    var margin = new BBox.Size((containerSize._w - innerSize._w) / 2, 0);
    if(margin._w < 0) {
        margin._w = 0;
    }
    this.screen
        .css("margin-left", margin._w + "px")
        .css("margin-top", margin._h + "px")
        .css("width", innerSize._w + "px")
        .css("height", innerSize._h + "px");

    if(this.uiElement.is(":visible")) {
        var phifBBox = new BBox(this.uiElement.get(0));
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
        this.uiElement.css("margin-left", phifMargin._w + "px")
            .css("margin-top", phifMargin._h + "px");
    }
};

(new MZ700Js()).create();
