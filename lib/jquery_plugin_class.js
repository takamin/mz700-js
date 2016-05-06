function jquery_plugin_class(class_name) {
    jQuery.fn[class_name] = function(method_name) {
        var args = Array.prototype.slice.call(arguments, 1);
        var invoke = function(element) {
            var ctor = window[class_name];
            if(element[class_name] == null) {
                element[class_name] = new ctor(element);
            }
            return ctor.prototype[method_name].apply(
                    element[class_name], args);
        };
        if(this.length == 1) {
            var ret = invoke(this[0], class_name, method_name, args);
            if(ret == undefined) {
                ret = this;
            }
            return ret;
        }
        return $(this).each(function() {
            invoke(this, class_name, method_name, args);
        });
    };
}
