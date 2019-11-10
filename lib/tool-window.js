"use strict";

function ToolWindow() { }

ToolWindow.create = (wndBase) => {
    wndBase.find(".toolwnd").each(function() {
        const wnd = $(this);
        const updateWnd = () => {
            if(wnd.hasClass("open")) {
                wnd.find(".content").show(100);
            } else {
                wnd.find(".content").hide(100);
            }
        };
        const title = $("<div/>").addClass("titlebar")
            .append($("<span/>").addClass("title").html(wnd.attr("title")))
            .append($("<span/>").addClass("buttons")
                .append($("<button/>").attr("type","button")
                    .html("■").attr("title", "Open/Close")
                    .click(()=>{
                        if(wnd.hasClass("open")) {
                            wnd.removeClass("open");
                        } else {
                            wnd.addClass("open");
                        }
                        updateWnd();
                    })));
        const content = $("<div/>").addClass("content")
            .append(wnd.children());
        wnd.append(title).append(content);
        updateWnd();
    });
};
module.exports = ToolWindow;
