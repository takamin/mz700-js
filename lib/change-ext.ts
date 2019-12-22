"use strict";
const path = require("path");
export default function changeExt(filename:string, ext:string):string {
    if(!/^\./.test(ext)) {
        ext = '.' + ext;
    }
    const old_ext:string = path.extname(filename);
    const re = new RegExp(`${old_ext}$`);
    return filename.replace(re, ext);
}
module.exports = changeExt;
