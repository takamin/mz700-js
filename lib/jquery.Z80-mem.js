(function() {
    var $ = require("jquery");
    var jquery_plugin_class = require("../lib/jquery_plugin_class");
    var Z80_assemble = require("../Z80/assembler.js");
    var easing = require("../lib/easing.js");

    jquery_plugin_class("dumplist");
    var dumplist = function(element) {
        this.element = element;
        this.opt = {
            "readMemory" : null,
            "cols" : 16,
            "rows" : 16,
            "_topAddr" : 0,
            "getRegValue" : function() {}
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
        var $buttons = $("<div/>");
        $container.append($buttons);
        var $row = $("<div/>").addClass("row").addClass("header");
        $container.append($row);

        var $col = $("<span/>").addClass("cell").addClass("header")
            .html("ADDR");
        $row.append($col);
        
        for(var col = 0; col < this.opt.cols; col++) {
            $col = $("<span/>").addClass("cell").addClass("c" + col);
            $col.html('+' + col.HEX(1));
            $row.append($col);
        }
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

        this._topAddr = this.opt._topAddr;
        this.addrCols = [];
        this.dataCells = [];
        this._charViewRows = [];
        for(var row = 0; row < this.opt.rows; row++) {
            $row = $("<div/>")
                .addClass("row").addClass("r" + row);
            $container.append($row);

            $col = $("<span/>").addClass("cell").addClass("header");

            $row.append($col);
            this.addrCols.push($col);

            //
            // Create all columns
            //
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

        //
        // 16ビットレジスタが指すアドレスを表示するボタン
        //
        [
            {"H":"B","L": "C"},
            {"H":"D","L": "E"},
            {"H":"H","L": "L"},
            "PC", "SP", "IX", "IY"
        ].forEach(function(regs) {
            var pair = ((typeof(regs) == "string") ? false : true);
            var name16 = (pair ? regs.H + regs.L : regs);
            var getRegValue = (pair ?
                function(regs, callback) {
                    opt.getReg(regs.H, function(value_h) {
                        opt.getReg(regs.L, function(value_l) {
                            callback(value_h * 256 + value_l);
                        });
                    });
                } :
                function(regs, callback) {
                    opt.getReg(regs, callback);
                });
            $buttons
                .append($("<button/>")
                    .attr("id", "btnShowMem" + name16)
                    .attr("type", "button").css("width", "50px").html(name16)
                    .click(function() {
                        getRegValue(regs, function(value) {
                            $("#txtShowMemAddr").val(value.HEX(4) + "H");
                            this.topAddr(value);
                        }.bind(this));
                    }.bind(this)));
        }, this);

        //
        // 指定アドレスを表示するテキストボックスとボタン
        //
        $buttons
            .append($("<input/>")
                    .attr("id", "txtShowMemAddr").attr("type", "text")
                    .attr("value", "0000h").css("width", "80px")
                    .attr("title",
                        "16進数(最後にhまたはH)の他、プログラム中のラベルも使えます。"
                        + "10進数、8進数(0から始まる数字)もOK"))
            .append($("<button/>")
                .attr("id", "btnShowMemAddr")
                .attr("type", "button").css("width", "80px").html("表示更新")
                .click(function() {
                    var addrToken = $("#txtShowMemAddr").val();
                    var asm = new Z80_assemble();
                    var addr = asm.parseAddress(addrToken);
                    if(addr != null) {
                        this.topAddr(addr);
                    }
                }.bind(this)));
        
        this.redraw();
    };

    dumplist.prototype.setReadMemoryHandler = function(handler) {
        this.readMemory = handler;
        this.redraw();
    }

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
                if(this.readMemory == null) {
                    this.dataCells[cellIndex].html('**');
                } else {
                    this.readMemory(addr,
                            (function(THIS, index, row, col) {
                                return function(value) {
                                    THIS.dataCells[index].html(value.HEX(2));
                                    if(THIS._charViewAscii) {
                                        value = window.mz700scrn.ascii2dispcode[value];
                                    }
                                    THIS._charViewRows[row].mz700scrn(
                                        "writeVram", col, dumplist.charViewAttr, value);

                                    // Change background color of target cell
                                    if(targetIndex == index) {
                                        appealTargetCell();
                                    }
                                };
                            }(this, cellIndex, row, col)));
                }
                addr++;
                cellIndex++;
            }
        }
    };
    dumplist.prototype.updateAt = function(address, value) {
        var cellIndex = address - this._topAddr;
        if(0 <= cellIndex && cellIndex < this.opt.rows * 16) {
            this.dataCells[cellIndex].html(value.HEX(2));
        }
    };
}());
