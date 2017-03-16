var pass = 0;
var fail = 0;
var chai = require("chai");
var assert = chai.assert;
module.exports = {
    report: function(name, result, detail) {
        it(name, function() {
            assert(result, detail);
        });
    },
    test: function(module) {
        describe(module.name, function(){
            if("test" in module) {
                module.test();
            }
            if("test_set" in module) {
                module.test_set.forEach(function(testitem) {
                    var result = testitem.test();
                    if(result === true) {
                        this.report(testitem.name, true);
                    } else if(result === false) {
                        this.report(testitem.name, false, "");
                    }
                }, this);
            }
        }.bind(this));
    }
};
