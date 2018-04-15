"use stringify";
var $ = require("jquery");
var jquery_plugin_class = require("../lib/jquery_plugin_class");
var easing = require("../lib/easing.js");

// Load jQuery plug-in Z80AddressSpecifier
require("../lib/jquery.Z80-addr-spec.js");

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
        "cols" : 16,
        "rows" : 16,
        "_topAddr" : 0,
    };
    this._charViewAscii = true;
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
    var $root = $("<div/>");
    $root.insertBefore($(this.element));
    $(this.element).appendTo($root);

    var $container = $(this.element);
    $container.addClass("dumplist");
    $container.empty();

    // Create header row
    var $row = $("<div/>").addClass("row").addClass("header");
    $container.append($row);

    //Create row header column in header row
    var $col = $("<span/>").addClass("cell").addClass("header")
        .html("ADDR");
    $row.append($col);
    
    // Create each columns in header row
    for(var col = 0; col < this.opt.cols; col++) {
        $col = $("<span/>").addClass("cell").addClass("c" + col);
        $col.html('+' + col.HEX(1));
        $row.append($col);
    }

    // Create a character view controls in header row
    let changeCharViewToAscii = showAscii => {
        if(this._charViewAscii != showAscii) {
            this._charViewAscii = showAscii;
            this.redraw();
        }
    };
    $row.append($("<span/>").addClass("char-selector")
        .append(
            $("<input/>").attr("type", "radio").attr("name","charViewCode")
            .click(()=>{ changeCharViewToAscii(true); })
            .attr("checked", true))
        .append($("<label/>").html("ASCII CODE"))
        .append($("<span/>").html("/"))
        .append(
            $("<input/>").attr("type", "radio").attr("name","charViewCode")
            .click(()=>{ changeCharViewToAscii(false); }))
        .append($("<label/>").html("DISP.CODE")));

    // Create data rows
    this._topAddr = this.opt._topAddr;
    this.addrCols = [];
    this.dataCells = [];
    this._charViewRows = [];
    for(var row = 0; row < this.opt.rows; row++) {

        // Create data row
        $row = $("<div/>")
            .addClass("row").addClass("r" + row);
        $container.append($row);

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
        let charViewRow = $("<span/>").addClass("mz700chars").mz700scrn("create", {
            cols: this.opt.cols, rows:1,
            color: dumplist.charViewForeColor,
            backgroundColor: dumplist.charViewBackColor,
            width: (this.opt.cols * dumplist.mz700CharSizePx) + "px",
            alt:"", title:""
        }).mz700scrn("clear")
            .css("width", this.opt.cols * dumplist.mz700CharSizePx)
            .css("height", dumplist.mz700CharSizePx);
        $row.append(charViewRow);
        this._charViewRows.push(charViewRow);
    }

    // Set up event listeners
    this.setupEventListener($container.get(0));

    setTimeout(() => { this.redraw(); }, 0);
};

/**
 * Setup event listener.
 * @param {HTMLElement} dispatcher the event dispatcher
 * @returns {undefined}
 */
dumplist.prototype.setupEventListener = function(dispatcher) {

    // Scroll by mouse wheel.
    dispatcher.addEventListener("wheel", e => {
        let prevIndex = this._topAddr;
        let topColMod = this._topAddr % this.opt.cols;

        if(e.deltaY < 0) {
            // Scroll up
            let addr = this._topAddr - this.opt.cols;
            if(addr < 0) {
                addr = topColMod;
            }
            this.topAddr(addr);
        } else if(e.deltaY > 0) {
            // Scroll down
            let addr = this._topAddr + this.opt.cols;
            if(addr >= 65536) {
                addr = (65536 - this.opt.cols) + topColMod;
            }
            this.topAddr(addr);
        }
        if(prevIndex != this.__topAddr) {
            e.cancelBubble = true;
        } else {
            e.cancelBubble = false;
        }
    });
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
    $("#txtShowMemAddr").val(this._topAddr.HEX(4) + "H");
    this.redraw();
};

/**
 * Redraw dumplist.
 *
 * @returns {undefined}
 */
dumplist.prototype.redraw = function() {

    // Calculate address at top-left
    var addr = this._topAddr - (this._topAddr % this.opt.cols) - 7 * this.opt.cols;
    let ulim = 65536 - this.opt.cols * this.opt.rows;
    if(addr > ulim) { addr = ulim; }
    if(addr < 0) { addr = 0; }

    // Change background color of target cell
    let targetIndex = this._topAddr - addr;
    let targetCell = this.dataCells[targetIndex];
    let rgb = (r,g,b) => "rgb(" + [r,g,b].join(",") + ")";
    let easingHandle = null;
    let appealTargetCell = () => {
        if(easingHandle != null) {
            easing.cancel(easingHandle);
        }
        easing(0, 255, 3000, value => {
            targetCell.css("background-color",
                rgb(255, 255, Math.floor(value)));
        });
    };

    var cellIndex = 0;
    for(var row = 0; row < this.opt.rows; row++) {
        this.addrCols[row].html(addr.HEX(4));
        for(var col = 0; col < this.opt.cols; col++) {
            $(this.element).trigger("querymemory", [addr,
                (((index, row, col) => {
                    return value => {
                        this.dataCells[index].html(value.HEX(2));
                        if(this._charViewAscii) {
                            value = window.mz700scrn.ascii2dispcode[value];
                        }
                        this._charViewRows[row].mz700scrn(
                            "writeVram", col, dumplist.charViewAttr, value);

                        // Change background color of target cell
                        if(targetIndex == index) {
                            appealTargetCell();
                        }
                    };
                })(cellIndex, row, col))]
            );
            addr++;
            cellIndex++;
        }
    }
};
