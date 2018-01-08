"use strict";
var id = 0;
function requestJsonp(url) {
    var s = document.createElement("SCRIPT");
    s.setAttribute("id", "jsonp" + id);
    s.setAttribute("src", url);
    s.setAttribute("onload", "removeJsonp(" + id + ");");
    document.body.appendChild(s);
    id++;
}
if(!("removeJsonp" in window)) {
    window.removeJsonp = function(id) {
        var e = document.getElementById("jsonp" + id);
        document.body.removeChild(e);
    };
}
module.exports = requestJsonp;
