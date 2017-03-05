(function(){
    "use strict";
    require("../lib/ex_number.js");
    require("../Z80/memory.js");
    require("../Z80/register.js");
    require("../Z80/assembler.js");
    var asm = new Z80_assemble();
    module.exports = function(token) {
        return asm.parseAddress(token);
    };
}());
