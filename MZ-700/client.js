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
    var MZ700Js = require("./index.js");
    var dock_n_liquid = require("dock-n-liquid");
    var BBox = require("b-box");

    var container = $(".MZ-700-body");
    var screen = container.find(".screen");

    var resizeScreen = function() {
        var bboxContainer = new BBox(container.get(0));
        var bboxScreen = new BBox(screen.get(0));
        var containerSize = bboxContainer.getSize();
        containerSize._h -= bboxScreen.px("border-top-width");
        containerSize._h -= bboxScreen.px("border-bottom-width");

        var orgSize = new BBox.Size(320,200);
        var innerSize = containerSize.getMaxInscribedSize(orgSize);
        var margin = new BBox.Size(
                (containerSize._w - innerSize._w) / 2,
                (containerSize._h - innerSize._h) / 2);
        screen
            .css("margin-left", margin._w + "px")
            .css("margin-top", margin._h + "px")
            .css("width", innerSize._w + "px")
            .css("height", innerSize._h + "px");

    };

    var liquidRootElement = $("#liquid-panel-MZ-700").get(0);
    var liquidRoot = dock_n_liquid.select(liquidRootElement);

    // Dock'n'Liquid panels
    var dockPanelHeader = $("#dock-panel-header");
    var dockPanelKb = $("#dock-panel-keyboard");
    var dockPanelRight = $("#dock-panel-right");
    var dockPanelBottom = $("#dock-panel-bottom");

    var onKeyboardPanelOpen = function() {
        dockPanelKb.css("height", "270px");
        liquidRoot.layout();
        resizeScreen();
    };
    var onKeyboardPanelClose = function() {
        dockPanelKb.css("height", "50px");
        liquidRoot.layout();
        resizeScreen();
    };

    // Remove software keybord for PC
    if(deviceType == "pc") {
        dockPanelKb.hide();
        onKeyboardPanelOpen = function() {};
        onKeyboardPanelClose = function() {};
    }

    // Remove right panel for mobile
    if(deviceType == "mobile") {
        dockPanelRight.remove();
    }

    var mz700js = MZ700Js.create({
        "urlPrefix" : "../",
        "onKeyboardPanelOpen": onKeyboardPanelOpen,
        "onKeyboardPanelClose": onKeyboardPanelClose
    });
    var fullscreenButton = $("<button/>")
        .attr("id","fullscreenButton");
    var fullscreenElement = document.getElementById("fullscrn-MZ-700");
    var onFullscreenButtonClick = function() {
        if(document.fullscreenElement === fullscreenElement) {
            dock_n_liquid.exitFullscreen().then(function() {
                resizeScreen();
            });
        } else {
            dock_n_liquid.requestFullscreen(fullscreenElement).then(function() {
                resizeScreen();
                mz700js.acceptKey(true);
            });
        }
    }
    var onFullscreenChange = function() {
        if(document.fullscreenElement == null) {
            dockPanelHeader.show();
            if(deviceType != "pc") {
                dockPanelKb.show();
            }
            dockPanelBottom.show();
            dockPanelRight.show();
            fullscreenButton.html("Fullscreen");
        } else {
            dockPanelHeader.hide();
            if(deviceType != "pc") {
                dockPanelKb.hide();
            }
            dockPanelBottom.hide();
            dockPanelRight.hide();
            fullscreenButton.html("Exit Fullscreen");
        }
        liquidRoot.layout();
        resizeScreen();
        liquidRoot.layout();
        resizeScreen();
    };
    fullscreenButton.click(onFullscreenButtonClick);
    $(".ctrl-panel").append(fullscreenButton);
    window.addEventListener("fullscreenchange", onFullscreenChange);
    onFullscreenChange();

    mz700js.reset();
    screen.find("canvas").css("height", "calc(100% - 1px)");
    dock_n_liquid.init(resizeScreen);
    dock_n_liquid.select($(".MZ-700").get(0)).layout();
    window.addEventListener(
            "resize", function() {
                resizeScreen(); });
    resizeScreen();

}(window.jQuery));
