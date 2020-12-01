"use strict";
function doLater(job, duration) {
    if (job in doLater.TID) {
        clearTimeout(doLater.TID[job]);
    }
    doLater.TID[job] = setTimeout(() => {
        delete doLater.TID[job];
        try {
            job.call();
        }
        catch (e) {
            console.error("doLater fail on " + job + "\n" + e.stack);
        }
    }, duration);
}
doLater.TID = {};
module.exports = doLater;
//# sourceMappingURL=do-later.js.map