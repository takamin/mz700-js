(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    var plugin_name = "DropDownPanel";
    jquery_plugin_class(plugin_name);
    window.DropDownPanel = function(e) {
        this.opt = {
            "caption" : null,
        }
        if($(e).hasClass(plugin_name)) {
            this.root = $(e);
            this.heading = this.root.find(".heading");
            this.content = this.root.find(".content");
        } else {
            this.root = $("<div/>").insertBefore($(e));
            this.heading = $("<div/>").addClass("heading");
            this.content = $("<div/>").addClass("content");
            this.root
                .append(this.heading)
                .append(this.content);
            $(e).appendTo(this.content);
        }
        this.root.addClass(plugin_name);
    };
    DropDownPanel.prototype.create = function(opt) {
        if(opt) {
            Object.keys(this.opt).forEach(function(key) {
                if(key in opt) { this.opt[key] = opt[key]; }
            }, this);
        }
        if(!this.root.hasClass("close") && !this.root.hasClass("open")) {
            this.root.addClass("close");
        }
        if(this.root.hasClass("close")) {
            this.content.hide();
        } else {
            this.content.show();
        }
        if(this.opt.caption) {
            this.heading.html(this.opt.caption);
        }
        var caption = $("<span/>").addClass("caption").html(this.heading.html());
        this.heading.empty().append(caption)
            .append($("<span/>").addClass("button").html("▼")
                .click(function() {
                    if(this.root.hasClass("close")) {
                        this.root.addClass("open");
                        this.root.removeClass("close");
                        this.root.find(".content").show(100);
                    } else {
                        this.root.removeClass("open");
                        this.root.addClass("close");
                        this.root.find(".content").hide(100);
                    }
                }.bind(this)));
    };
    DropDownPanel.prototype.open = function(opt) {
        if(!this.root.hasClass("open")) {
            this.root.addClass("open");
            this.root.removeClass("close");
            this.root.find(".content").show(100);
        }
    };
    DropDownPanel.prototype.close = function(opt) {
        if(!this.root.hasClass("close")) {
            this.root.removeClass("open");
            this.root.addClass("close");
            this.root.find(".content").hide(100);
        }
    };
}());
