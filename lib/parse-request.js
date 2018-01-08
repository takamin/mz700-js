"use strict"
function parseRequest() {
    var request = { uri: "", path: "", queryString: "", parameters: {} };
    request.uri = window.location.href;
    request.path = request.uri.replace(/\?.*$/, "");
    if(request.uri.match(/\?/)) {
        request.queryString = request.uri.replace(/^[^\?]*\?/, "");
        if(request.queryString !== "") {
            request.parameters = {};
            request.queryString.split(/\&/).forEach(function(s) {
                var kv = s.split(/=/, 2);
                request.parameters[kv[0]] = decodeURIComponent(kv[1]);
            });
        }
    }
    return request;
}
module.exports = parseRequest;
