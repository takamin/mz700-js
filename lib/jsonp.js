"use strict";
let id = 0;

/**
 * Request JSONP.
 * @param {string} callbackName A name of callback function to be called.
 * @param {string} url The URL to request
 * @param {Function} callback A function to callback
 * @returns {Promise} It will be resolved after the :bJSONP function is called.
 */
function requestJsonp(callbackName, url, callback) {
    return new Promise( (resolve, reject) => {
        window[callbackName] = (...args) => {
            callback.apply(null, args);
            resolve();
        };

        var s = document.createElement("SCRIPT");
        s.setAttribute("id", "jsonp" + id);
        s.setAttribute("src", url);
        s.setAttribute("onload", "removeJsonp(" + id + ");");
        document.body.appendChild(s);
        id++;
        setTimeout( () => reject(), 30000);
    });
}
if(!("removeJsonp" in window)) {
    window.removeJsonp = function(id) {
        var e = document.getElementById("jsonp" + id);
        document.body.removeChild(e);
    };
}
module.exports = requestJsonp;
