"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function parseRequest() {
    const request = { uri: "", path: "", queryString: "", parameters: {} };
    request.uri = window.location.href;
    request.path = request.uri.replace(/\?.*$/, "");
    if (request.uri.match(/\?/)) {
        request.queryString = request.uri.replace(/^[^?]*\?/, "");
        if (request.queryString !== "") {
            request.parameters = {};
            request.queryString.split(/&/).forEach((s) => {
                const kv = s.split(/=/, 2);
                request.parameters[kv[0]] = decodeURIComponent(kv[1]);
            });
        }
    }
    return request;
}
exports.default = parseRequest;
module.exports = parseRequest;
//# sourceMappingURL=parse-request.js.map