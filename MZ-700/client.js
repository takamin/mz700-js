const packageJson = require("../package.json");
window.jQuery = require("jquery");

// identify user agent
var ua = navigator.userAgent;
var deviceType = null;
if (ua.indexOf('iPhone') >= 0 || ua.indexOf('iPod') >= 0 ||
    ua.indexOf('Android') >= 0 && ua.indexOf('Mobile') >= 0)
{
    deviceType = "mobile";
} else if (ua.indexOf('iPad') >= 0 || ua.indexOf('Android') >= 0) {
    deviceType = "tablet";
} else {
    deviceType = "pc";
}

(async function($) {
    require("jquery-ui");
    require("fullscrn");
    require("../lib/jquery.ddpanel.js");
    var MZ700JsBase = require("./index.js");
    var MZ700Js = function() {
        MZ700JsBase.call(this);
    };
    MZ700Js.prototype = new MZ700JsBase();
    MZ700Js.prototype.create = async function(opt) {
        await MZ700JsBase.prototype.create.call(this, opt);
        this.btnToggleScreenKeyboard = $("<button/>")
            .attr("type", "button")
            .attr("class", "toggle imaged")
            .attr("id", "btnToggleScreenKeyboard")
            .append($("<img/>")
                .attr("src", "../image/btnKeyboard-off.png")
                .attr("title", "Keyboard").attr("alt", "Keyboard"))
            .click(() => {
                this.btnToggleScreenKeyboard_click();
            });
        $(".MZ-700 .ctrl-panel")
            .append(this.btnToggleScreenKeyboard);
        $(".dropdownpanel").DropDownPanel("create");
    };
    MZ700Js.prototype.btnToggleScreenKeyboard_click = function() {
        event.stopPropagation();
        if(this.btnToggleScreenKeyboard.hasClass("on")) {
            this.hideScreenKeyboard();
        } else {
            this.showScreenKeyboard();
        }
    };
    MZ700Js.prototype.showScreenKeyboard = function() {
        this.btnToggleScreenKeyboard.addClass("on");
        this.btnToggleScreenKeyboard.removeClass("off");
        this.btnToggleScreenKeyboard.find("img")
            .attr("src", "../image/btnKeyboard-on.png");
        $(".keyboard").show();
        this.resizeScreen();
    };
    MZ700Js.prototype.hideScreenKeyboard = function() {
        this.btnToggleScreenKeyboard.removeClass("on");
        this.btnToggleScreenKeyboard.addClass("off");
        this.btnToggleScreenKeyboard.find("img")
            .attr("src", "../image/btnKeyboard-off.png");
        $(".keyboard").hide();
        this.resizeScreen();
    };

    var dock_n_liquid = require("dock-n-liquid");
    var BBox = require("b-box");

    var container = $(".MZ-700-body");
    var screen = container.find(".screen");
    var phif = $("#physical-interface");

    MZ700Js.prototype.resizeScreen = function() {
        var bboxContainer = new BBox(container.get(0));
        var bboxScreen = new BBox(screen.get(0));
        var containerSize = bboxContainer.getSize();
        containerSize._h -= bboxScreen.px("border-top-width");
        containerSize._h -= bboxScreen.px("border-bottom-width");

        var orgSize = new BBox.Size(320,200);
        var innerSize = containerSize.getMaxInscribedSize(orgSize);
        var margin = new BBox.Size((containerSize._w - innerSize._w) / 2, 0);
        if(margin._w < 0) {
            margin._w = 0;
        }
        screen
            .css("margin-left", margin._w + "px")
            .css("margin-top", margin._h + "px")
            .css("width", innerSize._w + "px")
            .css("height", innerSize._h + "px");

        if(phif.is(":visible")) {
            var phifBBox = new BBox(phif.get(0));
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
            phif.css("margin-left", phifMargin._w + "px")
                .css("margin-top", phifMargin._h + "px");
        }
    };

    var liquidRootElement = $("#liquid-panel-MZ-700").get(0);
    var liquidRoot = dock_n_liquid.select(liquidRootElement);

    // Dock'n'Liquid panels
    var dockPanelHeader = $("#dock-panel-header");
    var dockPanelRight = $("#dock-panel-right");

    // Remove right panel for mobile or tablet
    if(deviceType == "mobile" || deviceType == "tablet") {
        dockPanelRight.remove();
    }

    var mz700js = new MZ700Js();
    await mz700js.create({
        urlPrefix : "../",
        screenElement : document.querySelector(".MZ-700 .screen"),
        mztDroppableElement: document.querySelector(".MZ-700 .cmt-slot"),
        controlPanelElement: document.querySelector(".MZ-700 .ctrl-panel"),
        dataRecorderElement: document.querySelector(".MZ-700 .data-recorder"),
        keyboardElement: document.querySelector(".MZ-700 .keyboard"),
    });

    if(deviceType != "mobile") {
        mz700js.hideScreenKeyboard();
        var mouseMoveTimeoutId = null;
        let hideCtrlPanel = () => {
            phif.removeClass("hover");
            phif.hide();
        };
        let cancelCtrlPanelTimeout = () => {
            if(mouseMoveTimeoutId) {
                clearTimeout(mouseMoveTimeoutId);
                mouseMoveTimeoutId = null;
            }
        };
        var showCtrlPanelFor = function(timeLimit) {
            if(mouseMoveTimeoutId) {
                clearTimeout(mouseMoveTimeoutId);
            } else {
                phif.addClass("hover");
                phif.show(0, function() {
                    mz700js.resizeScreen();
                    mz700js.resizeScreen();
                });
            }
            mouseMoveTimeoutId = setTimeout(function() {
                hideCtrlPanel();
                mouseMoveTimeoutId = null;
            }, timeLimit);
        };
        let TMO_CTRL = (deviceType !== "pc" ? 5000 : 1000);
        if(deviceType !== "pc") {
            let toggle = () => {
                if(phif.css("display") !== "none") {
                    phif.hide(0, function() {
                        mz700js.resizeScreen();
                        mz700js.resizeScreen();
                    });
                } else {
                    phif.show(0, function() {
                        mz700js.resizeScreen();
                        mz700js.resizeScreen();
                    });
                }
            };
            screen.click(function(event) {
                event.stopPropagation();
                toggle();
            });
            phif.click( event => {
                event.stopPropagation();
                toggle();
            });
        } else {
            showCtrlPanelFor(TMO_CTRL);
            screen.mousemove(function(event) {
                event.stopPropagation();
                mz700js.acceptKey(true);
                showCtrlPanelFor(TMO_CTRL);
            });
            phif.mouseenter( event => {
                event.stopPropagation();
                mz700js.acceptKey(true);
                cancelCtrlPanelTimeout();
                phif.show(0, function() {
                    mz700js.resizeScreen();
                    mz700js.resizeScreen();
                });
            });
            container.mouseenter(function() {
                mz700js.acceptKey(true);
            })
            .mouseleave(function() {
                mz700js.acceptKey(false);
                hideCtrlPanel();
                cancelCtrlPanelTimeout();
            });
        }
    } else {
        mz700js.showScreenKeyboard();
    }

    var fullscreenButton = $("<button/>")
        .attr("id","fullscreenButton").addClass("toggle imaged off")
        .append($("<img/>")
            .attr("src", "../image/btnFullscreen-off.png")
            .attr("title", "Fullscreen")
            .attr("alt", "Fullscreen"));
    var fullscreenElement = document.body;
    var onFullscreenButtonClick = function() {
        event.stopPropagation();
        if(document.fullscreenElement === fullscreenElement) {
            document.exitFullscreen().then(function() {
                liquidRoot.layout();
                mz700js.resizeScreen();
            });
        } else {
            fullscreenElement.requestFullscreen().then(function() {
                liquidRoot.layout();
                mz700js.resizeScreen();
                mz700js.acceptKey(true);
            });
        }
    }
    var onFullscreenChange = function() {
        if(document.fullscreenElement == null) {
            dockPanelHeader.show();
            dockPanelRight.show();
            fullscreenButton.removeClass("on").addClass("off")
                .find("img")
                    .attr("src", "../image/btnFullscreen-off.png")
                    .attr("title", "Fullscreen")
                    .attr("alt", "Fullscreen");
        } else {
            dockPanelHeader.hide();
            dockPanelRight.hide();
            fullscreenButton.removeClass("off").addClass("on")
                .find("img")
                    .attr("src", "../image/btnFullscreen-on.png")
                    .attr("title", "Exit Fullscreen")
                    .attr("alt", "Exit Fullscreen");
        }
        liquidRoot.layout();
        mz700js.resizeScreen();
    };
    fullscreenButton.click(onFullscreenButtonClick);
    $(".ctrl-panel").append(fullscreenButton);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    onFullscreenChange();

    screen.find("canvas").css("height", "calc(100% - 1px)");
    dock_n_liquid.init(function() { mz700js.resizeScreen(); });
    dock_n_liquid.select($(".MZ-700").get(0)).layout();
    window.addEventListener(
            "resize", function() {
                liquidRoot.layout();
                mz700js.resizeScreen(); });
    mz700js.resizeScreen();

    //
    // Parse the request URI to get parameters
    //
    var parseRequest = require("../lib/parse-request");
    var request = parseRequest();

    //
    // About to load some informations by JSONP
    //
    var requestJsonp = require("../lib/jsonp");

    //
    // Reset MZ-700 and auto load the MZT file, if specified at QUERY_STRING
    //
    await mz700js.reset();
    if("mzt" in request.parameters) {
        // loadMZT will be invoked by pseudo JSONP.
        window.loadMZT = async tape_data => {
            await mz700js.setMztData(tape_data);
        };
        requestJsonp("https://takamin.github.io/MZ-700/mzt/" + request.parameters.mzt + ".js");
    }

    //
    // Setup buttons to load other MZT
    //
    requestJsonp("https://takamin.github.io/MZ-700/mzt/mzt-list.js");
    window.mztList = function(files) {
        var mztButtons = $("<div/>");
        files.forEach(function(mzt) {
            mztButtons.append(
                $("<button/>").attr("type", "button")
                .css("padding", 0).css("height", "24px")
                .css("border", "solid 0px transparent")
                .css("padding", 0).css("margin", "4px 2px")
                .attr("charSize", "8").attr("padding", "1")
                .attr("color", mzt.mz700_buttonStyle.color)
                .attr("bgColor", mzt.mz700_buttonStyle.bgColor)
                .html(mzt.name)
                .click(function() {
                    window.location.href = request.path + "?mzt=" + mzt.path;
                }));
        });
        $("#physical-interface").append(mztButtons);

        /* Convert text to the MZ-700 style */
        mztButtons.find("button").each(function() {
            window.mz700scrn.convert(this);
        });

        liquidRoot.layout();
        mz700js.resizeScreen();
    };
    $("button.mzt-loder").each(function() {
        $(this).click(function() {
            var name = $(this).attr("name");
            window.location.href = request.path + "?mzt=" + name;
        });
    });

    /* Convert text to the MZ-700 style */
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

}(window.jQuery));
