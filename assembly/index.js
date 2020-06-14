"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateZ80 = exports.add = void 0;
const Z80_1 = __importDefault(require("../Z80/Z80"));
function add(a, b) {
    return a + b;
}
exports.add = add;
function CreateZ80() {
    return new Z80_1.default({});
}
exports.CreateZ80 = CreateZ80;
//# sourceMappingURL=index.js.map