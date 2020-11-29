"use strict";

/**
 * A base class which dispatches events.
 */
export default class EventDispatcher {

    _handlers:object;

    /**
     * @constructor
     */
    constructor() {
        this._handlers = {};
    }

    /**
     * @param eventName {string} An event name.
     */
    declareEvent(eventName:string):void {
        this._handlers[eventName] = [];
    }

    /**
     * @param eventName An event name
     * @param handler An event handler
     */
    addEventListener(eventName:string, handler:()=>void):void {
        this._handlers[eventName].push(handler);
    }

    /**
     * @param eventName event name
     */
    fireEvent(eventName:string):void {
        this._handlers[eventName].forEach(handler => handler());
    }
}
