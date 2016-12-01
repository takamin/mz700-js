var globalContext = null;
(function(gctx) {
    var globalContextName = gctx.constructor.name;
    if(!globalContextName) {
        // Browser is NOT webkit, perhaps IE11
        if(gctx == "[object Window]") {
            globalContextName = "Window";
        } else if(gctx == "[object WorkerGlobalScope]") {
            globalContextName = "WebWorker";
        }
    } else if( (globalContextName == "DedicatedWorkerGlobalScope")
            || (globalContextName == "WorkerGlobalScope"))
    {
        globalContextName = "WebWorker";
    }
}(this));
