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

(function($) {
    require("jquery-ui");
    require("fullscrn");
    require("../lib/jquery.ddpanel.js");
    var MZ700JsBase = require("./index.js");
    var MZ700Js = function() {
        MZ700JsBase.call(this);
    };
    MZ700Js.prototype = new MZ700JsBase();
    MZ700Js.prototype.create = function(opt) {
        MZ700JsBase.prototype.create.call(this, opt);
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
    var keyboard = $(".keyboard");

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
    mz700js.create({ "urlPrefix" : "../" });

    if(deviceType != "mobile") {
        mz700js.hideScreenKeyboard();
        var mouseMoveTimeoutId = null;
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
                phif.removeClass("hover");
                phif.hide();
                mouseMoveTimeoutId = null;
            }, timeLimit);
        };
        showCtrlPanelFor(5000);
        screen.mousemove(function() {
            showCtrlPanelFor(5000);
        });
        keyboard.mousemove(function() {
            showCtrlPanelFor(5000);
        });
        phif.mousemove(function() {
            showCtrlPanelFor(5000);
        });
        container.mouseenter(function() {
            mz700js.acceptKey(true);
        })
        .mouseleave(function() {
            mz700js.acceptKey(false);
        });
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
    mz700js.reset(function() {
        if("mzt" in request.parameters) {
            window.loadMZT = function(tape_data) {
                mz700js.stop(function() {
                    mz700js.setMztData(tape_data, function(mztape_array) {
                        mz700js.start(mztape_array[0].header.addr_exec);
                    });
                });
            };
            requestJsonp("https://takamin.github.io/MZ-700/mzt/" + request.parameters.mzt + ".js");
        }
    });

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

}(window.jQuery));
