"use strict";

/**
 * A base class which dispatches events.
 */
export default class EventDispatcher {

    _handlers = {};

    /**
     * @constructor
     */
    constructor() {
        this._handlers = {};
    }

    /**
     * @param {string} eventName An event name.
     * @returns {undefined}
     */
    declareEvent(eventName:string):void {
        this._handlers[eventName] = [];
    }

    /**
     * @param {string} eventName An event name
     * @param {Function} handler An event handler
     * @returns {undefined}
     */
    addEventListener(eventName:string, handler:()=>void):void {
        this._handlers[eventName].push(handler);
    }

    /**
     * @param {string} eventName event name
     * @returns {undefined}
     */
    fireEvent(eventName:string):void {
        this._handlers[eventName].forEach(handler => handler());
    }
}
