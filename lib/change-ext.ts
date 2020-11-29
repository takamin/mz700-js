"use strict";
import path = require("path");
export default function changeExt(filename:string, ext:string):string {
    if(!/^\./.test(ext)) {
        ext = '.' + ext;
    }
    const oldExt:string = path.extname(filename);
    const re = new RegExp(`${oldExt}$`);
    return filename.replace(re, ext);
}
module.exports = changeExt;
