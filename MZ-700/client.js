window.jQuery = require("jquery");
(function($) {
    require("jquery-ui");
    var MZ700Js = require("./index.js");
    $(function() {
        var mz700js = MZ700Js.create({"urlPrefix" : "../" });
        mz700js.reset(function() {
            mz700js.start();
        });
        $(".resizer").resizable({ aspectRatio: true }).css("width", "685px");
        $(".operation-panels").draggable().css("width", "680px");
        $(".operation-panels").css("position", "absolute");
        $(".MZ-700 > div").css("margin-right", "2px");
        $(".MZ-700").append($("<br clear='all'/>"));
        $(".MZ-700-text").each(function() {
            mz700scrn.convert(this);
        });
    });
}(window.jQuery));
