"use strict";
const $ = require("jquery");
const doLater = require("../lib/do-later.js");
const jquery_plugin_class = require("../lib/jquery_plugin_class");
jquery_plugin_class("vscrlist");

/**
 * jquery plug-in.
 * Row oriented list view widget.
 *
 * @constructor
 * @param {Element} element The DOM element
 */
function vscrlist(element) {
    this._opt = {
        rowHeight: 13,
        rowCount: 20,
        headerRow: null,
        createRow: index => {
            return $("<div/>").html(index).get(0);
        },
    };

    this._element = element;
    this._items = [];
    this._visible_row_count = null;
    this._top_row_index = 0;
    this._header_container = null;
    this._container = null;

}

window.vscrlist = vscrlist;
module.exports = vscrlist;

/**
 * Create vscrlist.
 * @param {object} opt
 * The parameters
 * @returns {undefined}
 */
vscrlist.prototype.create = function(opt) {
    opt = opt || {};
    Object.keys(this._opt).forEach( key => {
        if(key in opt) {
            this._opt[key] = opt[key];
        }
    });
    this._visible_row_count = this._opt.rowCount;

    // Data row's Container
    this._row_container = $("<div/>")
        .addClass("scrollee")
        .css("position", "relative");

    // V-Scrollee
    this._scroll = $("<div/>")
        .addClass("scroll")
        .append(this._row_container);

    // Header row
    if(!this._opt.headerRow) {
        this._header_container = null;
        this._scroller = $(this._element);
    } else {
        this._header_container = $("<div/>")
            .css("width", "100%").css("overflow", "hidden")
            .append(this._opt.headerRow.css("position", "relative"));
        this._scroller = $("<div/>");
        this._container = $(this._element)
            .append(this._header_container)
            .append(this._scroller);
    }

    this._scroller.addClass("vscrlist")
        .addClass("scroller")
        .css("height", "100%")
        .css("overflow", "auto")
        .append(this._scroll);

    // Handle scroll event, and redraw assemble list.
    let scrollee = this._row_container.get(0);
    let h_scrollee = null;
    if(this._opt.headerRow) {
        h_scrollee = this._opt.headerRow.get(0);
    }
    let scroller = this._scroller.get(0);
    scroller.addEventListener("scroll", event => {
        event.cancelBubble = true;
        scrollee.style.top = scroller.scrollTop + "px";
        if(h_scrollee) {
            h_scrollee.style.left = (-scroller.scrollLeft) + "px";
        }
        doLater(() => {
            let nextIndex =
                Math.round(scroller.scrollTop / this._opt.rowHeight);
            if(nextIndex != this._top_row_index) {
                this._listTopIndex(nextIndex);
                this.createList();
            }
        }, 10);
    }, false);
};

/**
 * Set or get the list items.
 * @param {Array|undefined} items
 * An array of list items to set.
 * @returns {undefined|Array}
 * Returns list items if the parameter item is null.
 */
vscrlist.prototype.items = function(items) {
    if(items == null) {
        return this._items;
    }
    items = items || [];
    this._items = items;
    this._scroll.css("height", (items.length * this._opt.rowHeight) + "px");
};

/**
 * Check the rows are not rendered or else.
 * @returns {boolean} true if rows are not rendered, otherwise false.
 */
vscrlist.prototype.isEmpty = function() {
    return this._row_container.children().length == 0;
};

/**
 * Remove all visible rows.
 * @returns {undefined}
 */
vscrlist.prototype.empty = function() {
    return this._row_container.empty();
};

/**
 * Select visible rows.
 * @param {string|undefined} selector
 * jQuery selector. To get all rows, do not specify.
 * @returns {jQueryObject} selected rows.
 */
vscrlist.prototype.visibleRows = function(selector) {
    return this._row_container.children(selector);
};

/**
 * Set or get list top index.
 * @param {number|undefined} index
 * Top row index.
 * @returns {undefined|number}
 * returns top row index, if the parameter is not provided.
 */
vscrlist.prototype.listTopIndex = function(index) {
    if(index == null) {
        return this._top_row_index;
    }
    this._listTopIndex(index);
    this.createList();
    this.syncScrollTop();
};

/**
 * Set or get list top index.
 * @param {number|undefined} index
 * Top row index.
 * @returns {undefined|number}
 * returns top row index, if the parameter is not provided.
 */
vscrlist.prototype._listTopIndex = function(index) {
    if(index < 0) {
        index = 0;
    } else if(index > this._items.length - this._visible_row_count) {
        index  = this._items.length - this._visible_row_count;
    }
    this._top_row_index = index;
};

/**
 * Create assemble list.
 * @returns {undefined}
 */
vscrlist.prototype.createList = function() {
    this._row_container.empty();

    let topIndex = this._top_row_index;
    for(let i = 0; i < this._visible_row_count; i++) {
        let index = topIndex + i;
        let row = this._opt.createRow(index);
        if(row) {
            this._row_container.append($(row));
        }
    }
};

/**
 * Synchronize scroll top of the list.
 * @returns {undefined}
 */
vscrlist.prototype.syncScrollTop = function() {
    let scrollee = this._row_container.get(0);
    let scroller = this._scroller.get(0);
    let scrollTop = this._top_row_index * this._opt.rowHeight;
    scroller.scrollTop = scrollTop;
    scrollee.style.top = scrollTop + "px";
};
