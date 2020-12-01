"use strict";
let id = 0;

/* tslint:disable: no-string-literal */

/**
 * Request JSONP.
 * @param {string} callbackName A name of callback function to be called.
 * @param {string} url The URL to request
 * @param {Function} callback A function to callback
 * @returns {Promise} It will be resolved after the :bJSONP function is called.
 */
export default function requestJsonp(callbackName:string, url:string, callback?:(args:any)=>void):Promise<string> {
    return new Promise( (resolve, reject) => {
        window[callbackName] = (...args:any):void => {
            if(callback) {
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
        setTimeout( () => reject(), 30000);
    });
}

if(!("removeJsonp" in window)) {
    window["removeJsonp"] = (jsonpId) => {
        const e = document.getElementById("jsonp" + jsonpId);
        document.body.removeChild(e);
    };
}
module.exports = requestJsonp;
