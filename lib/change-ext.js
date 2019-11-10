"use strict";
const path = require("path");
function changeExt(filename, ext) {
    if(!/^\./.test(ext)) {
        ext = '.' + ext;
    }
    const old_ext = path.extname(filename);
    const re = new RegExp(`${old_ext}$`);
    return filename.replace(re, ext);
}
module.exports = changeExt;
