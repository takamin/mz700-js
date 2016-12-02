(function() {
    var extensionOf = function(filename) {
        "use strict";
        var pat = /^.*\./;
        if(pat.test(filename)) {
            return "." + filename.replace(pat, "");
        }
        return "";
    };
    module.exports = {
        extensionOf : extensionOf,
        exchangeExtension : function(filename, ext) {
            "use strict";
            if(!/^\./.test(ext)) {
                ext = '.' + ext;
            }
            var old_ext_len = extensionOf(filename).length;
            var len = filename.length - old_ext_len;
            var path_body = filename.substring(0, len);
            return path_body + ext;
        }
    };
}());
