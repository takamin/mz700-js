"use strict";
const mz700charcode = require("../mz700-charcode.js");
const NumberUtil = require("../number-util.js");
var jquery_plugin_class = require("./jquery_plugin_class");

// Use "vscrlist" jQuery plugin
require("./jquery.vscrlist.js");

// Load jQuery plug-in Z80AddressSpecifier
require("./jquery.Z80-addr-spec.js");

jquery_plugin_class("dumplist");

/**
 * Hex dump list with MZ-700 characters.
 * @constructor
 *
 * @param {HTMLElement} element
 * A root element for this widget.
 */
var dumplist = function(element) {
    this.element = element;
    this.opt = {
        "mz700js": null,
        "cols" : 16,
        "rows" : 16,
        "_topAddr" : 0,
    };
    this._charViewAscii = true;
    this._topAddr = 0;
    this._topLeftAddr = 0;
    this.addrCols = [];
    this.dataCells = [];
    this._charViewRows = [];
    this._hexadumpRows = [];
};

window.dumplist = dumplist;

dumplist.charViewForeColor = 0;
dumplist.charViewBackColor = 7;
dumplist.charViewAttr =
    (dumplist.charViewForeColor << 4) |
    dumplist.charViewBackColor;
dumplist.mz700CharSizePx = 10;

/**
 * Create
 *
 * @param {object} opt
 * An option parameter for this widget.
 *
 * @returns {undefined}
 */
dumplist.prototype.init = function(opt) {
    if(opt) {
        Object.keys(this.opt).forEach(function(key) {
            if(key in opt) { this.opt[key] = opt[key]; }
        }, this);
    }
    this._mz700js = this.opt.mz700js;

    var $root = $("<div/>");
    $root.insertBefore($(this.element));
    $(this.element).appendTo($root);

    var $container = $(this.element);
    $container.addClass("dumplist");
    $container.empty();

    // Create header row
    let $headerRow = $("<div/>").addClass("row").addClass("header");

    //Create row header column in header row
    var $col = $("<span/>").addClass("cell").addClass("header")
        .html("ADDR");
    $headerRow.append($col);
    
    // Create each columns in header row
    for(var col = 0; col < this.opt.cols; col++) {
        $col = $("<span/>").addClass("cell").addClass("c" + col);
        $col.html('+' + NumberUtil.HEX(col, 1));
        $headerRow.append($col);
    }

    // Create a character view controls in header row
    let changeCharViewToAscii = showAscii => {
        if(this._charViewAscii != showAscii) {
            this._charViewAscii = showAscii;
            this.redraw();
        }
    };
    const textNode = text => document.createTextNode(text);
    $headerRow.append($("<span/>").addClass("char-selector")
        .append(
            $("<label/>").append(
                $("<input/>")
                    .attr("type", "radio")
                    .attr("name","charViewCode")
                    .attr("checked", true)
                    .click(()=>changeCharViewToAscii(true))
            ).append(textNode("ASCII CODE"))
        ).append(textNode(" / "))
        .append(
            $("<label/>").append(
                $("<input/>")
                    .attr("type", "radio")
                    .attr("name","charViewCode")
                    .click(()=>changeCharViewToAscii(false))
            ).append(textNode("DISP.CODE"))
        )
    );

    // Create data rows
    for(var row = 0; row < this.opt.rows; row++) {

        // Create data row
        let $row = $("<div/>")
            .addClass("row").addClass("r" + row);

        $col = $("<span/>").addClass("cell").addClass("header");

        $row.append($col);
        this.addrCols.push($col);

        // Create all columns in data row
        for(col = 0; col < this.opt.cols; col++) {
            $col = $("<span/>")
                .addClass("cell").addClass("c" + col);
            this.dataCells.push($col);
            $row.append($col);
        }
        const charViewRow = $("<span/>").addClass("mz700chars").mz700scrn("create", {
            cols: this.opt.cols, rows:1,
            color: dumplist.charViewForeColor,
            backgroundColor: dumplist.charViewBackColor,
            width: (this.opt.cols * dumplist.mz700CharSizePx) + "px",
            alt:"", title:""
        }).mz700scrn("clear") .mz700scrn("setupRendering")
            .css("width", this.opt.cols * dumplist.mz700CharSizePx)
            .css("height", dumplist.mz700CharSizePx);
        $row.append(charViewRow);
        this._charViewRows.push(charViewRow);
        this._hexadumpRows.push($row);
    }

    // Create vscrlist's items
    let itemCount = 0x10000 / this.opt.cols;
    let listItems = new Array(itemCount);
    for(let i = 0; i < itemCount; i++) {
        listItems[i] = {
            startAddr: i * this.opt.cols,
        };
    }

    // Create vscrlist widget
    this._hexdump = $("<div/>").vscrlist("create", {
        rowHeight: 16, rowCount: this.opt.rows,
        keyRepeatBufferCount: 8,
        headerRow: $headerRow,
        createRow: index => {
            if(!this._hexdump || index < 0 || listItems.length <= index) {
                return;
            }
            let topItemIndex = this._hexdump.vscrlist("listTopIndex");
            let row = index - topItemIndex;

            let $row = this._hexadumpRows[row];
            let cellIndex = row * this.opt.cols;
            let addr = listItems[index].startAddr;
            this.addrCols[row].html( NumberUtil.HEX(addr, 4) );

            this._mz700js.readMemory(addr, addr + this.opt.cols).then(
                memblock => memblock.forEach( (value, col) => {
                    this.dataCells[cellIndex].html( NumberUtil.HEX(value, 2) );
                    if(this._charViewAscii) {
                        value = mz700charcode.ascii2dispcode[value];
                    }
                    this._charViewRows[row].mz700scrn(
                        "writeVram", col, dumplist.charViewAttr, value);
                    cellIndex++;
                })
            );
            return $row.get(0);
        }
    }).vscrlist("items", listItems)
    .on("scroll", () => {
        let topItemIndex = this._hexdump.vscrlist("listTopIndex");
        this._topLeftAddr = listItems[topItemIndex].startAddr;
    });
    $container.append(this._hexdump);
    this._hexdump.append(this._hexadumpRows).css("height", "280px");

    setTimeout(() => {
        this.topAddr(this.opt._topAddr);
    }, 0);
};

/**
 * Set top address and redraw.
 * @param {undefined|number} topAddr address to show. range: 0 to 65535.
 * @returns {number|undefined} top address
 */
dumplist.prototype.topAddr = function(topAddr) {
    if(topAddr == null) {
        return this._topAddr;
    }
    this._topAddr = topAddr;
    $("#txtShowMemAddr").val( NumberUtil.HEX(this._topAddr, 4) + "H" );

    // Calculate address at top-left
    var addr = this._topAddr - (this._topAddr % this.opt.cols) - 7 * this.opt.cols;
    let ulim = 65536 - this.opt.cols * this.opt.rows;
    if(addr > ulim) { addr = ulim; }
    if(addr < 0) { addr = 0; }
    this._topLeftAddr = addr;
    let topItemIndex = this._topLeftAddr / this.opt.cols;
    this._hexdump.vscrlist("listTopIndex", topItemIndex);
};

/**
 * Redraw dumplist.
 *
 * @returns {undefined}
 */
dumplist.prototype.redraw = function() {

    let addr = this._topLeftAddr;
    this._mz700js.readMemory(addr, addr + this.opt.rows * this.opt.cols).then(
        memblock => {
            let i = 0;
            if(this._charViewAscii) {
                for(let row = 0; row < this.opt.rows; row++) {
                    for(let col = 0; col < this.opt.cols; col++) {
                        this._charViewRows[row].mz700scrn(
                            "writeVram", col, dumplist.charViewAttr,
                            mz700charcode.ascii2dispcode[memblock[i++]]);
                    }
                }
            } else {
                for(let row = 0; row < this.opt.rows; row++) {
                    for(let col = 0; col < this.opt.cols; col++) {
                        this._charViewRows[row].mz700scrn(
                            "writeVram", col, dumplist.charViewAttr,
                            memblock[i++]);
                    }
                }
            }
        }
    );
};

dumplist.prototype.addrSpecifier = function() {
    return $("<div/>").Z80AddressSpecifier("create")
        .on("queryregister", async (event, regName, callback) => {
            const reg = await this._mz700js.getRegister();
            callback(reg[regName]);
        })
        .on("notifyaddress", (event, address) => {
            this.topAddr(address);
        });
};
