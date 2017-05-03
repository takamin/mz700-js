window.jQuery = require("jquery");
(function($) {
    require("jquery-ui");
    var MZ700Js = require("./index.js");
    var dock_n_liquid = require("dock-n-liquid");
    var BBox = require("b-box");

    var container = $(".MZ-700-body");
    var screen = container.find(".screen");

    var resizeScreen = function() {
        console.log("MZ-700-body resized");

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

    var liquidRoot = dock_n_liquid.select($("#liquid-panel-MZ-700").get(0));
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
    mz700js.reset();

    screen.find("canvas").css("height", "calc(100% - 1px)");
    dock_n_liquid.init(resizeScreen);
    dock_n_liquid.select($(".MZ-700").get(0)).layout();
    resizeScreen();

}(window.jQuery));
