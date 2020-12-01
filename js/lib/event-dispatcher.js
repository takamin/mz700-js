"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EventDispatcher {
    constructor() {
        this._handlers = {};
    }
    declareEvent(eventName) {
        this._handlers[eventName] = [];
    }
    addEventListener(eventName, handler) {
        this._handlers[eventName].push(handler);
    }
    fireEvent(eventName) {
        this._handlers[eventName].forEach(handler => handler());
    }
}
exports.default = EventDispatcher;
//# sourceMappingURL=event-dispatcher.js.map