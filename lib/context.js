(function(global) {
    var context = null;
    if("context" in global) {
        context = global["context"];
    } else {
        context = {
            webMain : false,
            webWorker: false,
            nodeJs: false,
            ie11: false,
            requirable: false
        };
        try {
            if(require) {
                context.requirable = true;
            }
        } catch(ex) { }
    }
    var globalContextName = global.constructor.name;
    if(!globalContextName) {
        context.ie11 = true;
        if(global == "[object Window]") {
            context.webMain = true;
        } else if(global == "[object WorkerGlobalScope]") {
            context.webWorker = true;
        }
    } else {
        if("window" in global) {
            context.webMain = true;
        } else if(
            (globalContextName == "DedicatedWorkerGlobalScope")
         || (globalContextName == "WorkerGlobalScope"))
        {
            context.webWorker = true;
        } else {
            context.nodeJs = true;
        }
    }
    //console.log(JSON.stringify(context, null, "    "));
    if(context.nodeJs) {
        module.exports = context;
    } else {
        if(context.webWorker) {
            global.module = { exports: null };
            global.require = function(module) {
                //console.log("Stub require(" + module + ") called from WebWorder context");
            };
        }
    }
    context.exportModule = function(name, obj) {
        if(!context.requirable) {
            if(name in global && obj !== global[name]) {
                console.log(
                    "context.exports: " + name +
                    " is already exported.");
                console.log(
                    "predecessor: " +
                    JSON.stringify(global[name]));
                console.log(
                    "override with: " +
                    JSON.stringify(obj));
            }
            global[name] = obj;
        }
        return obj;
    };
    global.getModule = function (name) {
        if(!("context" in global) || context.nodeJs || context.requirable) {
            return false;
        }
        if(!(name in global) || !global[name]) {
            throw new Error(["module ", name, "not found"].join(" "));
        }
        return global[name];
    }
    global.context = context;
}(Function("return this;")()));
