(function() {
    "use strict";
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("tabview");

    /**
     * jquery plug-in tabview.
     * @constructor
     * @param {Element} element DOM element to be a tab control.
     */
    var tabview = function(element) {
        this._root = $(element);
        this._tabs = this._root.children(".tabs");
        this._container = this._root.find("tabPageContainer");
        this._currentPage = null;
        this._data = {};
    };

    // Export to Window
    window.tabview = tabview;

    /**
     * create tabview's DOM.
     * @returns {undefined}
     */
    tabview.prototype.create = function() {
        if(this._container.length === 0) {
            this._tabs = $("<div/>").addClass("tabs");
            this._container = $("<div/>").addClass("tabPageContainer clearfix");
            this._root.append(this._tabs).append(this._container);
        }
    };

    /**
     * Add tab page.
     * @param {string} caption A caption for the tab.
     * @param {jQueryElement} page A tab-page content.
     * @param {Function} callback A callback to be invoked before the tab-page is shown.
     * @returns {undefined}
     */
    tabview.prototype.add = function(caption, page, callback) {
        var tab = $("<button type='button'/>").click(function() {
            this._container.children().hide();
            if(callback) {
                callback();
            }
            page.show();
        }.bind(this)).html(caption);
        this._tabs.append(tab);
        this._container.append(page);
        if(this._currentPage == null) {
            this._currentPage = page;
            page.show();
        } else {
            page.hide();
        }
    };

    /**
     * Show specified tab page.
     * @param {number|string} index the page index number or jquery selector for the page.
     * @returns {undefined}
     */
    tabview.prototype.show = function(index) {
        this._container.children().hide();
        var tabPage = null;
        if(typeof(index) == "number") {
            tabPage = $(this._container.children()[index]);
        } else if(typeof(index) == "string") {
            tabPage = this._container.children(index);
        }
        if(tabPage != null) {
            if(tabPage.length >= 1) {
                this._currentPage = tabPage.get(0);
                $(this._currentPage).show();
            }
        }
    };

    /**
     * Set or get the current page index.
     * @param {undefined|number} index The page index to show.
     * @return {number|undefined} Current page index.
     */
    tabview.prototype.index = function(index) {
        if(index == null) {
            index = -1;
            var currentPage = this._currentPage;
            if(currentPage != null) {
                var i = 0;
                this._container.children().each(function() {
                    if(this === currentPage) {
                        index = i;
                        return false;
                    }
                    i++;
                });
            }
            console.log("tabview.index:", index);
            return index;
        } else {
            this.show(index);
        }
    };

    /**
     * Get the current page.
     * @return {number|undefined} Current page index.
     */
    tabview.prototype.currentPage = function() {
        return this._currentPage;
    };

    /**
     * Set or get the user data.
     * @param {string} name data name
     * @param {any|null} value user data
     * @returns {undefined|any} if the value is null, returns the user data.
     *      Otherwise undefined.
     */
    tabview.prototype.data = function(name, value) {
        if(value == null) {
            return this._data[name];
        } else {
            this._data[name] = value;
        }
    };

    tabview.prototype.caption = function(index, caption) {
        if(caption == null) {
            return this._tabs.children(index).html();
        }
        this._tabs.children(index).html(caption);
    };
}());
