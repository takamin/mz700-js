(function() {
    "use strict";
    module.exports = context.exportModule("Z80BinUtil", {
        pair: function(h,l) { return (0xff & h) * 256 + (0xff & l); },
        hibyte: function(nn) { return (0xff & Math.floor(nn / 256)); },
        lobyte: function(nn) { return nn % 256; },
        getSignedByte: function(e) {
            e &= 0xff;
            if(e & 0x80) {
                e = ((~e) & 0xff) + 1;
                return -e;
            }
            return e;
        }
    });
}());
