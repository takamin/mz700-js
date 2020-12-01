"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
function changeExt(filename, ext) {
    if (!/^\./.test(ext)) {
        ext = '.' + ext;
    }
    const oldExt = path.extname(filename);
    const re = new RegExp(`${oldExt}$`);
    return filename.replace(re, ext);
}
exports.default = changeExt;
module.exports = changeExt;
//# sourceMappingURL=change-ext.js.map