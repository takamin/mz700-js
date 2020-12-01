"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Z80BinUtil {
    static pair(h, l) {
        return ((0xff & h) << 8) + (0xff & l);
    }
    static hibyte(nn) {
        return (nn >> 8) & 0xff;
    }
    static lobyte(nn) {
        return nn & 0xff;
    }
    static getSignedByte(e) {
        e = e & 0xff;
        if (e & 0x80) {
            e = ((~e) & 0xff) + 1;
            return -e;
        }
        return e;
    }
}
exports.default = Z80BinUtil;
module.exports = Z80BinUtil;
//# sourceMappingURL=bin-util.js.map