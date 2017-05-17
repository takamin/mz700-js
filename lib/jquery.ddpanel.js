(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    var plugin_name = "DropDownPanel";
    jquery_plugin_class(plugin_name);
    var DropDownPanel = function(e) {
        this.opt = {
            "caption" : null,
            "onOpen" : function() {},
            "onClose" : function() {}
        };
        if($(e).hasClass(plugin_name)) {
            this.root = $(e);
            this.heading = this.root.find(".heading");
            this.content = this.root.find(".content");
        } else {
            this.root = $("<div/>").insertBefore($(e));
            if(!$(e).hasClass("close") && !$(e).hasClass("open")) {
                this.root.addClass("close");
            } else if($(e).hasClass("close")) {
                this.root.addClass("close");
            } else if($(e).hasClass("open")) {
                this.root.addClass("open");
            }
            this.heading = $("<div/>").addClass("heading");
            this.content = $("<div/>").addClass("content");
            this.root
                .append(this.heading)
                .append(this.content);
            $(e).appendTo(this.content);
        }
        this.root.addClass(plugin_name);
    };
    window.DropDownPanel = DropDownPanel;

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
            this._close();
        } else {
            this._open();
        }
        if(this.opt.caption) {
            this.heading.html(this.opt.caption);
        }
        var caption = $("<span/>").addClass("caption").html(this.heading.html());
        this.heading.empty().append(caption)
            .append($("<span/>").addClass("button").html("▼")
                .click(function() {
                    if(this.root.hasClass("close")) {
                        this._open();
                    } else {
                        this._close();
                    }
                }.bind(this)));
    };
    DropDownPanel.prototype.open = function() {
        if(!this.root.hasClass("open")) {
            this._open();
        }
    };
    DropDownPanel.prototype.close = function() {
        if(!this.root.hasClass("close")) {
            this._close();
        }
    };
    DropDownPanel.prototype._open = function() {
        this.root.addClass("open");
        this.root.removeClass("close");
        this.opt.onOpen.call(this);
        this.root.find(".content").show(100);
    };
    DropDownPanel.prototype._close = function() {
        this.root.removeClass("open");
        this.root.addClass("close");
        this.opt.onClose.call(this);
        this.root.find(".content").hide(100);
    };
}());
