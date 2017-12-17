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
    var phif = $("#physical-interface");

    var resizeScreen = function() {
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
    };

    var liquidRootElement = $("#liquid-panel-MZ-700").get(0);
    var liquidRoot = dock_n_liquid.select(liquidRootElement);

    // Dock'n'Liquid panels
    var dockPanelHeader = $("#dock-panel-header");
    //var dockPanelKb = $("#dock-panel-keyboard");
    var dockPanelRight = $("#dock-panel-right");

    // Remove right panel for mobile or tablet
    if(deviceType == "mobile" || deviceType == "tablet") {
        dockPanelRight.remove();
    }

    var mz700js = MZ700Js.create({
        "urlPrefix" : "../",
    });

    if(deviceType != "mobile") {
        /*
        if(deviceType == "tablet") {
            phif.css("opacity", 0.8);
        }
        */
        var mouseMoveTimeoutId = null;
        var showCtrlPanelFor = function(timeLimit) {
            if(mouseMoveTimeoutId) {
                clearTimeout(mouseMoveTimeoutId);
            } else {
                phif.addClass("hover");
            }
            mouseMoveTimeoutId = setTimeout(function() {
                phif.removeClass("hover");
                mouseMoveTimeoutId = null;
            }, timeLimit);
        };
        screen.mousemove(function() {
            showCtrlPanelFor(5000);
        });
        container.mouseenter(function() {
            mz700js.acceptKey(true);
        })
        .mouseleave(function() {
            mz700js.acceptKey(false);
        });
    }

    // Close keyboard panel on PC.
    if(deviceType == "pc") {
        //mz700js.kb.DropDownPanel("close");
    } else {
        //// Open on mobile and tablet
        //mz700js.kb.DropDownPanel("open");
    }
    var fullscreenButton = $("<button/>")
        .attr("id","fullscreenButton");
    var fullscreenElement = document.body;
    var onFullscreenButtonClick = function() {
        if(document.fullscreenElement === fullscreenElement) {
            document.exitFullscreen().then(function() {
                liquidRoot.layout();
                resizeScreen();
            });
        } else {
            fullscreenElement.requestFullscreen().then(function() {
                liquidRoot.layout();
                resizeScreen();
                mz700js.acceptKey(true);
            });
        }
    }
    var onFullscreenChange = function() {
        if(document.fullscreenElement == null) {
            dockPanelHeader.show();
            dockPanelRight.show();
            fullscreenButton.html("Fullscreen");
        } else {
            dockPanelHeader.hide();
            dockPanelRight.hide();
            fullscreenButton.html("Exit Fullscreen");
        }
        liquidRoot.layout();
        resizeScreen();
    };
    fullscreenButton.click(onFullscreenButtonClick);
    $(".ctrl-panel").append(fullscreenButton);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    onFullscreenChange();

    mz700js.reset();
    screen.find("canvas").css("height", "calc(100% - 1px)");
    dock_n_liquid.init(resizeScreen);
    dock_n_liquid.select($(".MZ-700").get(0)).layout();
    window.addEventListener(
            "resize", function() {
                liquidRoot.layout();
                resizeScreen(); });
    resizeScreen();

}(window.jQuery));
