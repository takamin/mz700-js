"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let id = 0;
function requestJsonp(callbackName, url, callback) {
    return new Promise((resolve, reject) => {
        window[callbackName] = (...args) => {
            if (callback) {
                callback.apply(null, args);
            }
            resolve(args[0]);
        };
        const s = document.createElement("SCRIPT");
        s.setAttribute("id", "jsonp" + id);
        s.setAttribute("src", url);
        s.setAttribute("onload", "removeJsonp(" + id + ");");
        document.body.appendChild(s);
        id++;
        setTimeout(() => reject(), 30000);
    });
}
exports.default = requestJsonp;
if (!("removeJsonp" in window)) {
    window["removeJsonp"] = (jsonpId) => {
        const e = document.getElementById("jsonp" + jsonpId);
        document.body.removeChild(e);
    };
}
module.exports = requestJsonp;
//# sourceMappingURL=jsonp.js.map