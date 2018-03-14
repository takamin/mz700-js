(function() {
    "use strict";

    require("../node_modules/codemirror/mode/z80/z80");
    var CodeMirror = require("codemirror");

    var $ = require("jquery");
    require("./jquery.tabview.js");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    jquery_plugin_class("asmlist");

    /**
     * asmlist jquery plug-in.
     * @constructor
     * @param {Element} element The DOM element
     */
    var asmlist = function(element) {
        this._root = $(element);
        this._asmList = this._root.find(".assemble_list");
        this._opts = ("opts" in element ? element.opts : {
            onAssemble: function() { },
            onSetBreakPoint: function(/*addr, size, state*/) { }
        });
    };

    // Export to Window
    window.asmlist = asmlist;

    /**
     * Create plug-in object.
     * @param {object} opts The options for this instance.
     * @returns {undefined}
     */
    asmlist.prototype.create = function(opts) {
        if(!this._root.hasClass("asmlist")) {
            Object.keys(this._opts).forEach(function(key) {
                if(key in opts) {
                    this._opts[key] = opts[key];
                }
            }, this);
            this._asmList = $("<div/>").addClass("assemble_list");
            this._root.addClass("asmlist").tabview("create")
                .tabview("add", { index: "asm", caption: "Assemble List" },
                    $("<div/>").addClass("tabAsmList")
                        .append($("<div/>").addClass("y-scroll-pane")
                        .append(this._asmList))
                        .append("<span>* Click a line, and set break point</span>"),
                    function() {
                        if(this._asmList.children().length == 0) {
                            this._opts.onAssemble(this.text());
                            this._root.tabview("caption", "src", "Source List");
                        }
                    }.bind(this))
                .tabview("add", { index: "src", caption: "Source List"},
                    $("<div/>").addClass("tabSource")
                        .append($("<textarea type='text'/>")), null,
                    function() { this.onSourceTabPageShown(); }.bind(this));

            //
            // Create Z80 Assembler Editor with CodeMirror
            //
            var textarea = this._root.find(".tabSource textarea").get(0);
            this._editor = this.createEditor( textarea, "z80", {
                "change": function(/*editor, changeObj*/) {
                    this._asmList.empty();
                    this._root.tabview("caption", "src", "Source List *");
                }.bind(this)
            });
        }
    };

    /**
     * Initialize the TEXTAREA as an editor of CodeMirror.
     * Its mode is set 'z80' which was loaded at first.
     *
     * @param {HTMLTextAreaElement} textarea
     * A target textarea that converted to CodeMirror editor.
     *
     * @param {string} mode
     * A mode name for the editor to be created.
     *
     * @param {object} eventMap
     * An object which has event names as key and its handler as value.
     *
     * @see [CodeMirror: User Manual](http://codemirror.net/doc/manual.html)
     *
     * @returns {CodeMirror} returns the created CodeMirror editor object.
     */
    asmlist.prototype.createEditor = function(textarea, mode, eventMap) {
        var editor = CodeMirror.fromTextArea(textarea, { mode: mode });
        Object.keys(eventMap).forEach(function(e) {
            editor.on(e, eventMap[e]);
        });
        return editor;
    };

    /**
     * Invoked after the page was shown.
     * Refresh and set focus while the editor was hidden.
     *
     * @returns {undefined}
     */
    asmlist.prototype.onSourceTabPageShown = function() {
        this._editor.refresh();
        this._editor.focus();
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
            return this._editor.getValue();
        }
        this._editor.setValue(text);
        this._editor.markClean();
        if(assemble == null || assemble) {
            this._asmList.empty();
            this._opts.onAssemble(text);
        }
        this._root.tabview("caption", "src", "Source List");
    };

    /**
     * Get assemmbled list jquery object containing all rows.
     * @returns {jQueryObject} Assembled list
     */
    asmlist.prototype.list = function() {
        return this._asmList;
    };

    /**
     * Write assembled list
     * @param {object[]} asm_list An array of assembled row object.
     * @param {object} breakpoints The breakpoint object mapping breakpoint status by address.
     * @returns {undefined}
     */
    asmlist.prototype.writeList = function(asm_list, breakpoints) {
        this._asmList.empty();
        asm_list.forEach(function(asm_line, index) {
            var addr = asm_line.address;
            var size = asm_line.bytecode.length;
            var $row = this.createAsmRow(asm_line, index + 1);
            $row.addClass("pc" + addr.HEX(4));

            if(size > 0) {
                $row.click(function() {
                    var row = $(".pc" + addr.HEX(4));
                    if(row.hasClass('breakPoint')) {
                        row.removeClass('breakPoint');
                        this._opts.onSetBreakPoint(addr, size, false);
                    } else {
                        row.addClass('breakPoint');
                        this._opts.onSetBreakPoint(addr, size, true);
                    }
                }.bind(this));
            }

            // Set breakpoint class
            if(breakpoints[addr] && asm_line.bytecode.length > 0) {
                $row.addClass('breakPoint');
            }

            this._asmList.append($row);
        }, this);
    };

    /**
     * Create assembled row
     * @param {jqueryObject} $row The row.
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
     * Set current program counter address and
     * show that line to the center of list with a style.
     * @param {number} addr The address to show center.
     * @returns {undefined}
     */
    asmlist.prototype.setCurrentAddr = function(addr) {
        var $target = this._asmList.children('.pc' + addr.HEX(4));
        if($target.length <= 0) {
            return;
        }
        var $base = this._asmList;
        var $scrl_wnd = $base.parent();
        var wnd_height = parseInt($scrl_wnd.css("height"));
        var wnd_scrl = $scrl_wnd.scrollTop();
        var scrl_to = $target.offset().top - $base.offset().top;
        if(scrl_to < wnd_scrl + 0.1 * wnd_height
                  || wnd_scrl + 0.9 * wnd_height < scrl_to)
        {
            $scrl_wnd.animate({
                scrollTop : scrl_to - 0.2 * wnd_height
            }, 'fast');
        }
        $target.addClass("current");
    };

    /**
     * Clear the current program counter line style.
     * @returns {undefined}
     */
    asmlist.prototype.clearCurrentAddr = function() {
        this._asmList.find(".current").removeClass("current");
    };

    module.exports = asmlist;
}());
