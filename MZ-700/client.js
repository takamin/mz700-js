window.jQuery = require("jquery");
(function($) {
    require("jquery-ui");
    var MZ700Js = require("./index.js");
    var dock_n_liquid = require("dock-n-liquid");
    var BBox = require("b-box");

    var container = $(".MZ-700-body");
    var screen = container.find(".screen");

    var resizeScreen = function() {

        console.log("resizeScreen");
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
    var dockPanelKb = $("#dock-panel-keyboard");
    var mz700js = MZ700Js.create({
        "urlPrefix" : "../",
        "onKeyboardPanelOpen": function() {
            dockPanelKb.css("height", "250px");
            liquidRoot.layout();
            resizeScreen();
        },
        "onKeyboardPanelClose": function() {
            dockPanelKb.css("height", "50px");
            liquidRoot.layout();
            resizeScreen();
        }
    });
    var fullscreenButton = $("<button/>")
        .attr("id","fullscreenButton");
    var onFullscreenButtonClick = function() {
        if(document.fullscreenElement == null) {
            liquidRootElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    var onFullscreenChange = function() {
        console.log("fullscreenchange");
        if(document.fullscreenElement == null) {
            $("#dock-panel-header").show();
            $("#dock-panel-keyboard").show();
            $("#dock-panel-bottom").show();
            $("#dock-panel-right").show();
            fullscreenButton.html("Fullscreen");
        } else {
            $("#dock-panel-header").hide();
            $("#dock-panel-keyboard").hide();
            $("#dock-panel-bottom").hide();
            $("#dock-panel-right").hide();
            fullscreenButton.html("Exit Fullscreen");
        }
        liquidRoot.layout();
        resizeScreen();
        liquidRoot.layout();
        resizeScreen();
    };
    fullscreenButton.click(onFullscreenButtonClick);
    $("#dock-panel-scrn-ctrl").append(fullscreenButton);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    onFullscreenChange();

    mz700js.reset();
    screen.find("canvas").css("height", "calc(100% - 1px)");
    dock_n_liquid.init(resizeScreen);
    dock_n_liquid.select($(".MZ-700").get(0)).layout();
    resizeScreen();

}(window.jQuery));
