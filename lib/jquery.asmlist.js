"use strict";

const $ = require("jquery");
const jquery_plugin_class = require("../lib/jquery_plugin_class");

require("./jquery.tabview.js");
require("./jquery.asmeditor.js");

jquery_plugin_class("asmlist");

let ASMLIST_ROW_COUNT = 20;
let ASMLIST_ROW_HEIGHT = 13;

/**
 * asmlist jquery plug-in.
 * @constructor
 * @param {Element} element The DOM element
 */
function asmlist(element) {
    this._root = $(element);
    this._asm_list = [];
    this._currentAddr = null;
    this._breakpoints = {};

    this._list_row_container = null;
    this._list_visible_row_count = ASMLIST_ROW_COUNT;
    this._list_top_row_index = 0;
}

// Exports
window.asmlist = asmlist;
module.exports = asmlist;

/**
 * Create plug-in object.
 * @returns {undefined}
 */
asmlist.prototype.create = function() {
    if(!this._root.hasClass("asmlist")) {
        this._root.addClass("asmlist").tabview("create");
        this._list_row_container = $("<div/>")
            .addClass("assemble_list")
            .css("position", "relative");
        this._scroll = $("<div/>")
            .append(this._list_row_container);
        this._scroller = $("<div/>")
            .css("height", "100%")
            .css("overflow", "scroll")
            .append(this._scroll);

        // Handle scroll event, and redraw assemble list.
        let scrollee = this._list_row_container.get(0);
        let scroller = this._scroller.get(0);
        scroller.addEventListener("scroll", event => {
            event.cancelBubble = true;
            scrollee.style.top = scroller.scrollTop + "px";
            let currIndex = this.listTopIndex();
            let nextIndex =
                Math.round(scroller.scrollTop / ASMLIST_ROW_HEIGHT);
            if(nextIndex != currIndex) {
                this.listTopIndex(nextIndex);
                this.createList();
            }
        }, false);


        // Create Assembled list (Debuggable)
        this._root
            .tabview("add", "asm",
                $("<div/>").addClass("tabAsmList").append(this._scroller))
            .tabview("caption", "asm", "debug")
                .on("selected", () => {
                    if(this._list_row_container.children().length == 0) {
                        this._root.trigger("assemble", this.text());
                        this._root.tabview("caption", "src", "edit");
                    }
                });

        // Create Assembly source editor
        this._asmeditor = $("<div/>").asmeditor("create")
                .on("change", (/*e*/) => {
                    this._list_row_container.empty();
                    this._root.tabview("caption", "src", "edit *");
                });
        this._root
            .tabview("add", "src", this._asmeditor)
            .tabview("caption", "src", "edit")
            .on("activated", () => {
                    this._asmeditor.asmeditor("refresh");
                });
    }
};

/**
 * Synchronize scroll top of the list.
 * @returns {undefined}
 */
asmlist.prototype.syncScrollTop = function() {
    let scrollee = this._list_row_container.get(0);
    let scroller = this._scroller.get(0);
    let scrollTop = this.listTopIndex() * ASMLIST_ROW_HEIGHT;
    scroller.scrollTop = scrollTop;
    scrollee.style.top = scrollTop + "px";
};

/**
 * Set assembly source text to textarea.
 *
 * @param {string} text (optional) The assembly source.
 * @returns {undefined|string} Returns text if the text parameter is not specified.
 */
asmlist.prototype.text = function(text) {
    if(text == null) {
        return this._asmeditor.asmeditor("text");
    }
    this._asmeditor.asmeditor("text", text);
    this._root.tabview("caption", "src", "edit");
};

/**
 * Write assembled list
 * @param {object[]} asm_list An array of assembled row object.
 * @param {object} breakpoints The breakpoint object mapping breakpoint status by address.
 * @returns {undefined}
 */
asmlist.prototype.writeList = function(asm_list, breakpoints) {
    this._asm_list = asm_list;
    this._breakpoints = breakpoints;

    this._scroll.css("height",
        (this._asm_list.length * ASMLIST_ROW_HEIGHT) + "px");
    this.listTopIndex(0);
    this.createList();
    this.syncScrollTop();
};

/**
 * AsmRow class.
 * DOM element as row of assemble list.
 * @constructor
 *
 * @param {object} asm_line An Assembled line object.
 * @param {number} rownum A row number.
 * @param {boolean} bp_state breakpoint status
 * @param {function} setbreak_handler A handler for setbreak event
 */
function AsmRow(asm_line, rownum, bp_state, setbreak_handler) {
    this._asmline = asm_line;
    let addr = this._asmline.address;
    let addr_hex = addr.HEX(4);
    let size = this._asmline.bytecode.length;
    let $row = $("<div/>").addClass('row').addClass("pc" + addr_hex);

    $row.append($('<span class="colRowAttr"></span>'))
        .append($('<span class="colLineNumber">' + rownum + '</span>'))
        .append($('<span class="colAddress">' + addr_hex + '</span>'))
        .append($('<span class="colMachineCode">' +
            this._asmline.bytecode.map(c=>{return c.HEX(2);}).join("") +
            '</span>'));

    // label
    if(this._asmline.label != null) {
        $row.append($('<span class="colLabel"/>')
                .html(this._asmline.label+':'));
    }

    // mnemonic
    if(this._asmline.mnemonic != null) {
        if(this._asmline.label == null) {
            $row.append($('<span class="colLabel"> </span>'));
        }
        $row.append($('<span class="colMnemonic"/>')
                .html(this._asmline.mnemonic))
            .append($('<span class="colOperand"/>')
                .html(this._asmline.operand));
    }

    // comment
    $row.append($('<span class="colComment"/>')
                .html((this._asmline.comment == null ?
                    ' ' : this._asmline.comment)));

    // breakpoint
    if(size > 0) {
        $row.attr("title",
                "Click to toggle a break point at $" + addr_hex + "H")
        .click(() => {
            let rows = $(".pc" + addr.HEX(4));
            if(rows.hasClass('breakPoint')) {
                $row.trigger("setbreak", [addr, size, false]);
                rows.removeClass('breakPoint');
            } else {
                $row.trigger("setbreak", [addr, size, true]);
                rows.addClass('breakPoint');
            }
        });
    }
    if(bp_state) {
        $row.addClass('breakPoint');
    }
    $row.on("setbreak", setbreak_handler);

    this._dom = $row.get(0);
}

/**
 * jQuery selector to select rows by address.
 * @param {number} addr The address
 * @return {string} jQuery selector
 */
AsmRow.selectorByAddress = function(addr) {
    return ".pc" + addr.HEX(4);
};

/**
 * Create assemble list.
 * @returns {undefined}
 */
asmlist.prototype.createList = function() {
    this._list_row_container.empty();

    let topIndex = this.listTopIndex();
    for(let i = 0; i < this._list_visible_row_count; i++) {
        let index = topIndex + i;
        if(index > this._asm_list.length) {
            break;
        }
        let asm_line = this._asm_list[index];
        let asmrow = new AsmRow(
            asm_line, index + 1,
            this._breakpoints[asm_line.address],
            (event, addr, size, state) => {
                size;
                this._breakpoints[addr] = state;
            });
        this._list_row_container.append($(asmrow._dom));
    }

    if(this._currentAddr != null) {
        this._list_row_container
            .children(AsmRow.selectorByAddress(this._currentAddr))
            .addClass("current");
    }
};

/**
 * Set or get list top index.
 * @param {number|undefined} index
 * Top row index.
 * @returns {undefined|number}
 * returns top row index, if the parameter is not provided.
 */
asmlist.prototype.listTopIndex = function(index) {
    if(index == null) {
        return this._list_top_row_index;
    }
    if(index < 0) {
        index = 0;
    } else if(index > this._asm_list.length - this._list_visible_row_count) {
        index  = this._asm_list.length - this._list_visible_row_count;
    }
    this._list_top_row_index = index;
};

/**
 * Get first row index having the address.
 * @param {number} addr
 * Address to convert.
 * @returns {number}
 * returns row index.
 */
asmlist.prototype.indexOfAddr = function(addr) {
    for(let i = 0; i < this._asm_list.length; i++) {
        if(this._asm_list[i].address == addr) {
            return i;
        }
    }
    return false;
};

/**
 * Get last row index having the address.
 * @param {number} addr
 * Address to convert.
 * @returns {number}
 * returns row index.
 */
asmlist.prototype.lastLineIndexOfAddr = function(addr) {
    let index = this.indexOfAddr(addr);
    let lastIndex = index;
    if(lastIndex !== false) {
        while(index < this._asm_list.length) {
            if(this._asm_list[index].address == addr) {
                lastIndex = index;
                index++;
            } else {
                break;
            }
        }
    }
    return lastIndex;
}

/**
 * Set current program counter address and
 * show that line to the center of list with a style.
 * @param {number} addr The address to show center.
 * @returns {undefined}
 */
asmlist.prototype.setCurrentAddr = function(addr) {
    this._currentAddr = addr;
    let index = this.lastLineIndexOfAddr(this._currentAddr);
    if(index === false) {
        return;
    }
    this.listTopIndex( index - Math.floor(this._list_visible_row_count / 2) );
    this.createList();
    this.syncScrollTop();
};

/**
 * Clear the current program counter line style.
 * @returns {undefined}
 */
asmlist.prototype.clearCurrentAddr = function() {
    this._currentAddr = null;
    this._list_row_container.find(".current").removeClass("current");
};
