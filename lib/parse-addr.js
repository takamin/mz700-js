/* global getModule */
(function(){
    "use strict";
    var Z80_assemble = getModule("Z80_assemble") || require("../Z80/assembler.js");
    var asm = new Z80_assemble();
    module.exports = function(token) {
        return asm.parseAddress(token);
    };
}());
