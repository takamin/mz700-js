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
        this._root._data = {};
        this._root._lastTabId = 0;
    };

    // Export to Window
    window.tabview = tabview;

    /**
     * Convert the DOM id of source element to
     * id to operate the tab page.
     *
     * @param {string} domId
     * The id attribute that set to source element of DOM.
     *
     * @returns {string} Id to be set TabPage object.
     */
    tabview.tabId = function(domId) {
        return "tabId" + domId;
    };

    /**
     * create tabview's DOM.
     * @returns {undefined}
     */
    tabview.prototype.create = function() {
        if(this._container.length === 0) {
            this._tabs = $("<div/>").addClass("tabs");
            this._container = $("<div/>").addClass("tabPageContainer clearfix");
            this._root.addClass("tabview");
            this._root.append(this._tabs).append(this._container);
        }
    };

    /**
     * Add tab page.
     *
     * @param {string|object} caption
     * A caption for the tab. Or object {id:{string}, caption:{string}}
     *
     * @param {jQueryElement} page A tab-page content.
     * @param {Function} onTabSelected A callback to be invoked before the tab-page is shown.
     * @param {Function} onPageShown A callback to be invoked after the tab-page is shown.
     * @returns {undefined}
     */
    tabview.prototype.add = function(
            caption, page, onTabSelected, onPageShown)
    {
        var index = null;
        if(typeof(caption) === "object") {
            index = caption.index;
            caption = caption.caption;
        } else {
            this._root._lastTabId++;
            index = this._root._lastTabId;
        }
        var tabId = tabview.tabId(index);

        var tab = $("<button type='button'/>").click(function() {
            this._tabs.children("button.tab").removeClass("selected");
            tab.addClass("selected");
            this._container.children().hide();
            if(onTabSelected) {
                onTabSelected();
            }
            page.show(onPageShown);
        }.bind(this)).html(caption);
        tab.addClass("tab").addClass(tabId);
        page.addClass(tabId);

        this._tabs.append(tab);
        this._container.append(page);
        if(this._currentPage == null) {
            this.show(index);
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
        var tabId = tabview.tabId(index);
        var tabPage = this._container.children("." + tabId);
        this._tabs.children("button.tab").removeClass("selected");
        this._container.children().hide();
        this._currentPage = tabPage.get(0);
        this._tabs.children("button." + tabId).addClass("selected");
        tabPage.show();
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
        return $(this._currentPage);
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
            return this._root._data[name];
        } else {
            this._root._data[name] = value;
        }
    };

    /**
     * Set caption to the tab page.
     * @param {string} index The selector of jquery to a select tab page.
     * @param {string} caption (optional) New caption for the tab page.
     * @returns {undefined|string} Returns the caption if the captio parameter is not specified.
     */
    tabview.prototype.caption = function(index, caption) {
        index = tabview.tabId(index);
        if(caption == null) {
            return this._tabs.children("." + index).html();
        }
        this._tabs.children("." + index).html(caption);
    };

    module.exports = tabview;
}());
