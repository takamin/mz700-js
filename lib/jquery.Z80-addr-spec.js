"use strict";
const $ = require("jquery");
const Z80_assemble = require("../Z80/assembler.js");
const jquery_plugin_class = require("../lib/jquery_plugin_class");
jquery_plugin_class("Z80AddressSpecifier");

/**
 * Z80 address specification controll panel(jquery plugin)
 * @constructor
 *
 * @param {HTMLElement} element
 * The DOM element to create widget.
 *
 * @param {object|undefined} opt
 * An option for this widget.
 */
function Z80AddressSpecifier(element, opt) {
    this._element = element;
    this._opt = {};
    if(opt) {
        this.create(opt);
    }
}

window.Z80AddressSpecifier = Z80AddressSpecifier;
module.exports = Z80AddressSpecifier;

/**
 * Create this widget.
 *
 * @param {object|undefined} opt
 * An option for this widget.
 *
 * @return {undefined}
 */
Z80AddressSpecifier.prototype.create = function(opt) {

    let $root = $(this._element).css("width", "550px");

    const IDC = "z80-addr-spec";
    if($root.hasClass(IDC)) {
        return;
    }
    $root.addClass(IDC);

    opt = opt || {};
    Object.keys(this._opt).forEach(key=>{
        if(key in opt) {
            this._opt[key] = opt[key];
        }
    });

    const getReg = regName => {
        return new Promise( (resolve, reject) => {
            try {
                $root.trigger("queryregister", [ regName, value => {
                    resolve(value);
                }]);
            } catch(err) {
                reject(err);
            }
        });
    };

    [
        {"H":"B","L": "C"},
        {"H":"D","L": "E"},
        {"H":"H","L": "L"},
        "PC", "SP", "IX", "IY"
    ].forEach(regs => {
        var pair = ((typeof(regs) === "string") ? false : true);
        var name16 = (pair ? regs.H + regs.L : regs);
        var getRegValue = (pair ?
            (regs => {
                let value = 0;
                return getReg(regs.H).then(value_H => {
                    value = value_H * 256;
                    return getReg(regs.L);
                }).then( value_L => {
                    return value + value_L;
                });
            }) : (regs => { return getReg(regs); }));
        $root
            .append($("<button/>")
                .attr("id", "btnShowMem" + name16)
                .attr("type", "button").css("width", "50px").html(name16)
                .click(() => {
                    getRegValue(regs).then(value => {
                        $("#txtShowMemAddr").val(value.HEX(4) + "H");
                        $root.trigger("notifyaddress", value);
                    }).catch(err=> {
                        console.error(err.stack);
                    });
                }));
    });

    $root.append($("<input/>")
            .attr("id", "txtShowMemAddr").attr("type", "text")
            .attr("value", "0000h").css("width", "80px")
            .attr("title",
                "16進数(最後にhまたはH)の他、プログラム中のラベルも使えます。"
                + "10進数、8進数(0から始まる数字)もOK"))
        .append($("<button/>")
            .attr("id", "btnShowMemAddr")
            .attr("type", "button").css("width", "80px").html("表示更新")
            .click(() => {
                var addrToken = $("#txtShowMemAddr").val();
                var asm = new Z80_assemble();
                var addr = asm.parseAddress(addrToken);
                if(addr != null) {
                    $root.trigger("notifyaddress", addr);
                }
            }));
};
