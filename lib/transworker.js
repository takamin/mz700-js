//
// TransWorker - Worker transporter
//
// Copyright (c) 2016 Koji Takami(vzg03566@gmail.com)
// Released under the MIT license
// http://opensource.org/licenses/mit-license.php
//

//
// DESCRIPTION
//
// This class implementation is different for either main
// or sub thread.
//
// The main thread version of this class is loaded from
// html script tag, and it performs as a wrapper for the
// client-class object running in sub thread.
//
// To instantiate in the main thread, this class can be
// used directly.
//
// The constructor receives an url for a Web Worker script
// and a client-class constructor.
//
// In the script, a class derived from this class of a
// sub-thread version must be declared.
//
// It creates the Web Worker object and declare wrapper
// functions dynamically by reading the client-class
// declarations.
//
// The wrapper function translates the method invocation
// with all its parameters to a JSON object, and posts
// to the Web Worker instance created by this class
// instance of sub-thread version.
//
// The return value of the client-class method will be
// returned as a parameter of the callback function that
// is included in parameter of wrapper invocation.
//
(function(globalContext) {
    var globalContextName = globalContext.constructor.name;
    if(!globalContextName) {
        // Browser is NOT webkit, perhaps IE11
        if(globalContext == "[object Window]") {
            globalContextName = "Window";
        } else if(globalContext == "[object WorkerGlobalScope]") {
            globalContextName = "DedicatedWorkerGlobalScope";
        }
    }
    TransWorker = function(){}
    TransWorker.context = globalContextName;
    if(TransWorker.context == 'Window') {
        //
        // Create for UI-thread
        //
        // param:
        //      urlDerivedWorker
        //          url to Worker process.
        //          It must be a sub-class of
        //          worker-side TransWorker.
        //      clientCtor
        //          client-class constructor
        //      thisObject
        //          this object for callback function
        //      notifyHandlers
        //          notify handlers hash:
        //              key: name of notify,
        //              value: function object
        //
        TransWorker.create = function(
                urlDerivedWorker, clientCtor,
                thisObject, notifyHandlers)
        {
            var transworker = new TransWorker();
            transworker.create(
                urlDerivedWorker, clientCtor,
                thisObject, notifyHandlers);
            return transworker;
        };
        TransWorker.prototype.create = function(
                urlDerivedWorker, clientCtor,
                thisObject, notifyHandlers)
        {
            // Load dedicated worker
            this.worker = new Worker(urlDerivedWorker);

            // Create prototype entries same to the client
            this.createWrappers(Object.keys(clientCtor.prototype));

            // Receive message from worker thread
            this.callbacks = {};
            this.queryId = 0;
            this.onNotify = {};
            this.worker.onmessage = (function(wkr) {
                return function(e) {
                    try {
                        switch(e.data.type) {
                        case 'response':
                            wkr.callbacks[e.data.queryId].apply(
                                    thisObject, e.data.param);
                            delete wkr.callbacks[e.data.queryId];
                            break;
                        case 'notify':
                            wkr.onNotify[e.data.name](
                                    e.data.param);
                            break;
                        }
                    } catch(ex) {
                        console.warn("*** exception: ", ex);
                    }
                };
            }(this));

            // Entry the handlers to receive notifies
            notifyHandlers = notifyHandlers || {};
            Object.keys(notifyHandlers).forEach(function (key) {
                this.onNotify[key] = function() {
                    notifyHandlers[key].apply(
                            thisObject, arguments);
                };
            }, this);

        };

        // Create wrapper methods to send message to the worker
        TransWorker.prototype.createWrappers = function(
                method_names)
        {
            method_names.forEach(function(m) {
                TransWorker.prototype[m] = this.wrapper(m);
            }, this);
        }

        // Create client method wrapper
        TransWorker.prototype.wrapper = function(
                method)
        {
            return function() {
                var callback = function(){};
                var param = [];
                if(arguments.length > 0) {
                    callback = Array.prototype.slice.call(
                            arguments, -1)[0] || function(){};
                    param = Array.prototype.slice.call(
                            arguments, 0, arguments.length - 1);
                }
                var queryId = this.queryId++;
                this.callbacks[queryId] = callback;
                this.worker.postMessage({
                    method: method,
                    param: param,
                    queryId: queryId });
            };
        }
    } else if(TransWorker.context == 'DedicatedWorkerGlobalScope'
            || TransWorker.context == 'WorkerGlobalScope')
    {
        TransWorker.runClient = function(client) {
            var transworker = new TransWorker();
            if(typeof(client) == 'function') {
                client = new client();
            }
            transworker.create(client);
        }
        //
        // Create Worker side TransWorker instance.
        // (designed to be invoked from sub-class constructor)
        //
        // parameter:
        //      client  client-class instance
        //
        TransWorker.prototype.create = function(client) {
            this.worker = globalContext;
            this.client = client;
            (function(wkr) {

                // Override subclas methods by this context
                Object.keys(wkr.constructor.prototype)
                .forEach(function(m) {
                    wkr.client[m] = function() {
                        wkr.constructor.prototype[m].apply(
                            wkr, arguments);
                    };
                });

                // On receive a message, invoke the client
                // method and post back its value.
                wkr.worker.onmessage = function(e) {
                    try {
                        //return the value to UI-thread
                        wkr.worker.postMessage({
                            type:'response',
                            queryId: e.data.queryId,
                            method: e.data.method,
                            param: [
                                wkr.client[e.data.method]
                                .apply(
                                    wkr.client,
                                    e.data.param)
                            ]
                        });
                    } catch(ex) {
                        console.warn("*** exception: ", ex,
                            "in method", e.data.method, "params:",
                            JSON.stringify(e.data.param));
                    }
                };
            }(this));
        };

        // Notify to the UI-thread version TransWorker instance
        // from derived class instance.
        TransWorker.prototype.postNotify = function(
                name, param)
        {
            this.worker.postMessage({
                type:'notify',
                name: name,
                param: param
            });
        };
    }
}(this));
