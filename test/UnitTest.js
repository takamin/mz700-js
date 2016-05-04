var pass = 0;
var fail = 0;
module.exports = {
    reset: function() {
        pass = 0;
        fail = 0;
    },
    report: function(name, result, detail) {
        if(result) {
            //console.info("PASS:" + name);
            pass++;
        } else {
            if(detail == null) {
                detail = "";
            } else {
                detail = ", but " + detail;
            }
            console.info("**** FAIL:" + name + detail);
            fail++;
        }
    },
    reportResult: function() {
        console.info(
                "Test result: " +
                ((fail==0)?"PASS":"FAIL") + ", " +
                "pass " + pass + " / " +
                "total " + (pass + fail) + ", " +
                "pass ratio " + (100 * pass / (pass + fail)) + " %");
        return (fail == 0);
    },
    test: function(module) {
        this.reset();
        console.info("* " + module.name);
        if("test" in module) {
            module.test();
        }
        if("test_set" in module) {
            module.test_set.forEach((function (unit_test) { return function(testitem) {
                var result = testitem.test();
                if(result === true) {
                    unit_test.report(testitem.name, true);
                } else if(result === false) {
                    unit_test.report(testitem.name, false, "");
                }
            };}(this)));
        }
        this.reportResult();
        console.info("");
    }
};
