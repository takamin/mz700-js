"use strict";
const doLater = require("../do-later.js");
const jquery_plugin_class = require("./jquery_plugin_class");
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
        scrollRows: 1,              // lines scrolled by arrowUp/Dn
        scrollPageRows: null,       // lines scrolled by pgUp/pgDn
        keyRepeatBufferCount: 1,    // Key-repeat buffering count
    };

    this._element = element;
    this._items = [];
    this._visible_row_count = null;
    this._top_row_index = null;
    this._header_container = null;
    this._container = null;
    this._keyRepeatCount = 0;

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

    // The scroll paging size default is same as the row count.
    if(this._opt.scrollPageRows == null) {
        this._opt.scrollPageRows = this._opt.rowCount;
    }

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
        .css("height", "calc(100% - 22px)")
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
        event.stopPropagation();
        scrollee.style.top = scroller.scrollTop + "px";
        if(h_scrollee) {
            h_scrollee.style.left = (-scroller.scrollLeft) + "px";
        }
        doLater(() => {
            let index = Math.round(scroller.scrollTop / this._opt.rowHeight);
            if(this._listTopIndex(index)) {
                $(this._element).trigger("scroll");
                this.createList();
            }
        }, 30);
    }, false);

    this.setupKeyEventListener();
};

// The key code converted when the control key pressed.
const eventCodePromotedByCtrlKey = {
    /* [Ctrl] + */ "ArrowUp":   /* is to */ "Home",
    /* [Ctrl] + */ "ArrowDown": /* is to */ "End",
};

// The key code converted when the shift key pressed.
const eventCodePromotedByShiftKey = {
    /* [Shift] + */ "ArrowUp":   /* is to */ "PageUp",
    /* [Shift] + */ "ArrowDown": /* is to */ "PageDown",
    /* [Shift] + */ "PageUp":    /* is to */ "Home",
    /* [Shift] + */ "PageDown":  /* is to */ "End",
};

/**
 * Retrieve key code from the key event.
 *
 * @param {KeyboardEvent} event
 * The key event.
 *
 * @returns {string} key code that might be promoted by the event's state.
 */
function getEventCode() {
    let code = event.code;
    if(event.ctrlKey && code in eventCodePromotedByCtrlKey) {
        code = eventCodePromotedByCtrlKey[code];
    } else if(event.shiftKey && code in eventCodePromotedByShiftKey) {
        code = eventCodePromotedByShiftKey[code];
    }
    return code;
}

/**
 * Invoke the scroll handler specified by the event and may close the
 * key-repeat.
 *
 * @param {KeyboardEvent} event
 * The key event.
 *
 * @returns {undefined}
 */
vscrlist.prototype.flashBufferedKeys = function() {
    this.scrollByKeyCode(getEventCode(event), this._keyRepeatCount);
    this._keyRepeatCount = 0;
};

/**
 * Count up the event until it will over the threshold,
 * and then, scroll the list and clear the counter.
 *
 * @param {KeyboardEvent} event
 * The key event.
 *
 * @returns {undefined}
 */
vscrlist.prototype.countKeyRepeat = function() {
    this._keyRepeatCount++;
    if(this._keyRepeatCount >= this._opt.keyRepeatBufferCount) {
        this.flashBufferedKeys(event);
    }
};

/**
 * Setup key event listener to scroll by the keys of
 * arrow, page up, page down, home and end.
 *
 * @returns {undefined}
 */
vscrlist.prototype.setupKeyEventListener = function() {

    // Setup to accept keys only the mouse is hovering this element.
    let scroll = this._scroll.get(0);
    scroll.addEventListener("mouseenter", event => {
        event.stopPropagation();
        if(!this._element.classList.contains("listen-key")) {
            document.activeElement.blur();
            this._element.classList.add("listen-key");
        }
    });
    scroll.addEventListener("mouseleave", event => {
        event.stopPropagation();
        if(this._element.classList.contains("listen-key")) {
            if(this._keyRepeatCount > 0) {
                this.flashBufferedKeys(event);
            }
        }
        this._element.classList.remove("listen-key");
    });

    // Handle key down event.
    document.addEventListener("keydown", event => {
        if(this._element.classList.contains("listen-key")) {
            event.stopPropagation();
            if(event.repeat) {
                // The event may buffered until the UI updated.
                this.countKeyRepeat(event);
            } else {
                // Update actually.
                this.scrollByKeyCode(getEventCode(event), 1);
                this._keyRepeatCount = 0;
            }
        }
    });

    // Handle key up event to clear the key-repeat.
    document.addEventListener("keyup", event => {
        if(this._element.classList.contains("listen-key")) {
            event.stopPropagation();
            if(this._keyRepeatCount > 0) {
                this.flashBufferedKeys(event);
            }
        }
    });
};

/**
 * Scroll by key code.
 *
 * @param {string} keycode
 * The key code.
 *
 * @param {number} n
 * relative scroll rows
 *
 * @returns {undefined}
 */
vscrlist.prototype.scrollByKeyCode = function(keycode, n) {
    switch(keycode) {
        case "ArrowUp":
            this.scroll(n * -this._opt.scrollRows);
            break;
        case "ArrowDown":
            this.scroll(n * this._opt.scrollRows);
            break;
        case "PageUp":
            this.scroll(n * -this._opt.scrollPageRows);
            break;
        case "PageDown":
            this.scroll(n * this._opt.scrollPageRows);
            break;
        case "Home":
            this.listTopIndex(0);
            break;
        case "End":
            this.listTopIndex(this._items.length);
            break;
        default:
            break;
    }
};

/**
 * Scroll relative.
 *
 * @param {number} relativeRows
 * The relative rows to scroll.
 *
 * @returns {undefined}
 */
vscrlist.prototype.scroll = function(relativeRows) {
    this.listTopIndex(this._top_row_index + relativeRows);
};

/**
 * Log the key event.
 *
 * @param {KeyboardEvent} event
 * The event to be outputted to the console.
 *
 * @returns {undefined}
 */
vscrlist.prototype.reportKbEvent = function(event) {
    let a = [event.type];
    if(event.ctrlKey) { a.push("[CTRL]+"); }
    if(event.shiftKey) { a.push("[SHIFT]+"); }
    if(event.altKey) { a.push("[ALT]+"); }
    if(event.metaKey) { a.push("[META]+"); }
    if(event.key !== "Unidentified") {
        a.push("[", event.key, "]");
        a.push("(", event.code, ")");
    } else {
        a.push("(Unidentified)");
    }
    if(event.repeat) {
        a.push("+");
    }
    console.log(a.join(""));
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
    this.createList();
    this.syncScrollTop();
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
    if(this._listTopIndex(index)) {
        this.createList();
        this.syncScrollTop();
    }
};

/**
 * Set the top row index.
 *
 * @param {number} index
 * The new index.
 *
 * @returns {boolean} status whether the index was updated.
 */
vscrlist.prototype._listTopIndex = function(index) {
    const max_top_row_index = this._maxTopRowIndex();
    if(index <= 0) {
        index = 0;
    } else if(index >= max_top_row_index) {
        index = max_top_row_index;
    }
    if(this._top_row_index == index) {
        return false;
    }
    this._top_row_index = index;
    return true;
};

/**
 * @returns {number}
 * A max index of items to display at the top row.
 */
vscrlist.prototype._maxTopRowIndex = function() {
    const max_top_row_index = this._items.length - this._visible_row_count;
    if(max_top_row_index < 0) {
        return 0;
    }
    return max_top_row_index;
};

/**
 * Create assemble list.
 * @returns {undefined}
 */
vscrlist.prototype.createList = function() {
    this._row_container.empty();

    let topIndex = this._top_row_index || 0;
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

