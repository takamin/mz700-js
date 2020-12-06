"use strict";

/**
 * Parse currently request URL.
 * @returns {{uri:string, path:string, queryString:string, parameters:Record<string, unknown>}} The result of parsing.
 */
export default function parseRequest():{uri:string, path:string, queryString:string, parameters:Record<string, unknown>} {
    const request = { uri: "", path: "", queryString: "", parameters: {} };
    request.uri = window.location.href;
    request.path = request.uri.replace(/\?.*$/, "");
    if(request.uri.match(/\?/)) {
        request.queryString = request.uri.replace(/^[^?]*\?/, "");
        if(request.queryString !== "") {
            request.parameters = {};
            request.queryString.split(/&/).forEach((s) => {
                const kv = s.split(/=/, 2);
                request.parameters[kv[0]] = decodeURIComponent(kv[1]);
            });
        }
    }
    return request;
}
module.exports = parseRequest;
