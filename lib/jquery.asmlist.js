"use strict";

const $ = require("jquery");
const jquery_plugin_class = require("../lib/jquery_plugin_class");

require("./jquery.tabview.js");
require("./jquery.asmeditor.js");

jquery_plugin_class("asmlist");

/**
 * asmlist jquery plug-in.
 * @constructor
 * @param {Element} element The DOM element
 */
function asmlist(element) {
    this._root = $(element);
    this._listContainer = this._root.find(".assemble_list");
    this._asm_list = [];
    this._currentAddr = null;
    this._breakpoints = {};
    this._listTopIndex = 0;
    this._listRows = 25;
    this._root.get(0).addEventListener("wheel", e => {
        let prevIndex = this._listTopIndex;
        if(e.deltaY < 0) {
            this.listTopIndex(this._listTopIndex - 3);
            this.createList();
            this.showCurrentAddr();
        } else if(e.deltaY > 0) {
            this.listTopIndex(this._listTopIndex + 3);
            this.createList();
            this.showCurrentAddr();
        }
        if(prevIndex != this._listTopIndex) {
            e.cancelBubble = true;
        } else {
            e.cancelBubble = false;
        }
    });
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
        this._listContainer = $("<div/>").addClass("assemble_list");
        this._root.addClass("asmlist").tabview("create");

        // Create Assembled list (Debuggable)
        var asmSourceDebugger = $("<div/>").addClass("tabAsmList")
            .append($("<div/>").addClass("y-scroll-pane")
            .append(this._listContainer))
            .append("<span>* Click a line, and set break point</span>");
        this._root
            .tabview("add", "asm", asmSourceDebugger)
            .tabview("caption", "asm", "debug")
                .on("selected", () => {
                    if(this._listContainer.children().length == 0) {
                        this._root.trigger("assemble", this.text());
                        this._root.tabview("caption", "src", "edit");
                    }
                });

        // Create Assembly source editor
        this._asmeditor = $("<div/>").asmeditor("create")
                .on("change", (/*e*/) => {
                    this._listContainer.empty();
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
 * Set assembly source text to textarea.
 *
 * @param {string} text (optional) The assembly source.
 * @param {boolean} assemble (optional) Assemble the source or not.
 * @returns {undefined|string} Returns text if the text parameter is not specified.
 */
asmlist.prototype.text = function(text, assemble) {
    if(text == null) {
        return this._asmeditor.asmeditor("text");
    }
    this._asmeditor.asmeditor("text", text);
    if(assemble == null || assemble) {
        this._listContainer.empty();
        this._root.trigger("assemble", text);
    }
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
    this._listTopIndex = 0;
    this.createList();
    this.showCurrentAddr();
};

/**
 * Create assemble list.
 * @returns {undefined}
 */
asmlist.prototype.createList = function() {
    this._listContainer.empty();
    for(let i = 0; i < this._listRows; i++) {
        let index = this._listTopIndex + i;
        if(index > this._asm_list.length) {
            break;
        }
        let asm_line = this._asm_list[index];
        var addr = asm_line.address;
        var size = asm_line.bytecode.length;
        var $row = this.createAsmRow(asm_line, index + 1);
        $row.addClass("pc" + addr.HEX(4));

        if(size > 0) {
            $row.click( ((addr, size) => {
                return () => {
                    let row = $(".pc" + addr.HEX(4));
                    if(row.hasClass('breakPoint')) {
                        this._root.trigger("setbreak", [addr, size, false]);
                        this._breakpoints[addr] = false;
                        this.updateBreakpoints();
                    } else {
                        this._root.trigger("setbreak", [addr, size, true]);
                        this._breakpoints[addr] = true;
                        this.updateBreakpoints();
                    }
                };
            })(addr, size));
        }

        this._listContainer.append($row);
    }
    this.updateBreakpoints();
};

/**
 * Create assembled row
 * @param {object} asm_line An Assembled line object.
 * @param {number} rownum A row number.
 * @returns {undefined}
 */
asmlist.prototype.createAsmRow = function(asm_line, rownum) {

    var $row = $("<div/>").addClass('row');
    var addr = asm_line.address;

    // attributes column
    $row.append($('<span class="colRowAttr"></span>'));

    // line number
    $row.append($('<span class="colLineNumber">' + rownum + '</span>'));

    // address
    $row.append($('<span class="colAddress" style="">' + addr.HEX(4) + '</span>'));

    // code
    $row.append($('<span class="colMachineCode">' + asm_line.bytecode.map(
                function(c){return c.HEX(2);}).join("") + '</span>'));

    // label
    if(asm_line.label != null) {
        $row.append($('<span class="colLabel"/>')
                .html(asm_line.label+':'));
    }

    // mnemonic
    if(asm_line.mnemonic != null) {
        if(asm_line.label == null) {
            $row.append($('<span class="colLabel"> </span>'));
        }
        $row.append($('<span class="colMnemonic"/>').html(asm_line.mnemonic));
        $row.append($('<span class="colOperand"/>').html(asm_line.operand));
    }
    // comment
    $row.append($('<span class="colComment"/>')
                .html((asm_line.comment == null ? ' ' : asm_line.comment)));

    return $row;
};

/**
 * Update row's breakpoint styles.
 * @returns {undefined}
 */
asmlist.prototype.updateBreakpoints = function() {
    let bpAddr = [];
    for(let i = 0; i < this._listRows; i++) {
        let index = this._listTopIndex + i;
        if(index < this._asm_list.length) {
            let addr = this._asm_list[index].address;
            if(this._breakpoints[addr]) {
                bpAddr.push(addr);
            }
        }
    }
    let selector = bpAddr.map(addr=>{ return ".pc" + addr.HEX(4); }).join(",");
    this._listContainer.children().removeClass('breakPoint');
    this._listContainer.find(selector).addClass('breakPoint');
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
        return this._listTopIndex;
    }
    if(index < 0) {
        index = 0;
    } else if(index > this._asm_list.length - this._listRows) {
        index  = this._asm_list.length - this._listRows;
    }
    this._listTopIndex = index;
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
    this.listTopIndex( index - Math.floor(this._listRows / 2) );
    this.createList();
    this.showCurrentAddr();
};

/**
 * Set current address style.
 * @returns {undefined}
 */
asmlist.prototype.showCurrentAddr = function() {
    if(this._currentAddr == null) {
        return;
    }
    this._listContainer.children('.pc' + this._currentAddr.HEX(4)).addClass("current");
};

/**
 * Clear the current program counter line style.
 * @returns {undefined}
 */
asmlist.prototype.clearCurrentAddr = function() {
    this._currentAddr = null;
    this._listContainer.find(".current").removeClass("current");
};
