jquery_plugin_class("dumplist");
function dumplist(element) {
    this.element = element;
    this.opt = {
        "readMemory" : null,
        "rows" : 16,
        "_topAddr" : 0,
        "fontFamily" : 'monospace',
        "fontSize" : '4pt',
        "rowHeight" : '14px',
        "colWidth" : '16px',
        "headerWidth" : '30px',
        "getRegValue" : function() {}
    }
}
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
    $container.empty()
        .css('font-family', this.opt.fontFamily)
        .css('font-size', this.opt.fontSize)
        .css("border-bottom","solid 1px gray");
    var $buttons = $("<div/>");
    $container.append($buttons);
    var $row = $("<div/>").addClass("row").addClass("header")
        .css('height', this.opt.rowHeight)
        .css('line-height', this.opt.rowHeight)
        .css("border-bottom","solid 1px gray");
    $container.append($row);

    var $col = $("<span/>")
        .addClass("cell").addClass("header")
        .css('display','inline-block')
        .css('width', this.opt.headerWidth)
        .css('text-align', "center")
        .html("ADDR");
    $row.append($col);
    
    for(var col = 0; col < 16; col++) {
        var $col = $("<span/>")
            .addClass("cell").addClass("c" + col)
            .css('display','inline-block')
            .css('width', this.opt.colWidth)
            .css('text-align', "center");
        $col.html('+' + col.HEX(1));
        $row.append($col);
    }

    this._topAddr = this.opt._topAddr;
    var addr = this._topAddr;
    this.addrCols = [];
    this.dataCells = [];
    for(var row = 0; row < this.opt.rows; row++) {
        var $row = $("<div/>")
            .addClass("row").addClass("r" + row)
            .css('height', this.opt.rowHeight)
            .css('line-height', this.opt.rowHeight);
        $container.append($row);

        var $col = $("<span/>")
            .addClass("cell").addClass("header")
            .css('display','inline-block')
            .css('width', this.opt.headerWidth)
            .css('text-align', "center");

        $row.append($col);
        this.addrCols.push($col);
        for(var col = 0; col < 16; col++) {
            if(this.readMemory == null) {
                var data = '**';
                var $col = $("<span/>")
                    .addClass("cell").addClass("c" + col)
                    .css('display','inline-block')
                    .css('width', this.opt.colWidth)
                    .css('text-align', "center");
                this.dataCells.push($col);
                $row.append($col);
            } else {
                this.readMemory(addr, (function(THIS, row, col) {
                    return function(data) {
                        var $col = $("<span/>")
                            .addClass("cell")
                            .addClass("c" + col)
                            .css('display','inline-block')
                            .css('width', THIS.opt.colWidth)
                            .css('text-align', "center");
                        THIS.dataCells.push($col);
                        row.append($col);
                    };
                }(this, $row, col)));
            }
            addr++;
        }
    }

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
dumplist.prototype.topAddr = function(topAddr) {
    if(topAddr != null) {
        this._topAddr = topAddr;
        this.redraw();
    }
    return this._topAddr;
};

dumplist.prototype.redraw = function(opt) {
    var addr = this._topAddr;
    var cellIndex = 0;
    for(var row = 0; row < this.opt.rows; row++) {
        this.addrCols[row].html(addr.HEX(4));
        for(var col = 0; col < 16; col++) {
            if(this.readMemory == null) {
                this.dataCells[cellIndex].html('**');
            } else {
                this.readMemory(addr,
                        (function(THIS, index) {
                            return function(value) {
                                THIS.dataCells[index].html(value.HEX(2));
                            };
                        }(this, cellIndex)));
            }
            addr++;
            cellIndex++;
        }
    }
}
dumplist.prototype.updateAt = function(address, value) {
    var cellIndex = address - this._topAddr;
    if(0 <= cellIndex && cellIndex < this.opt.rows * 16) {
        this.dataCells[cellIndex].html(value.HEX(2));
    }
}
