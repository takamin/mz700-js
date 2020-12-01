"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const transworker_1 = __importDefault(require("transworker"));
const mz700_1 = __importDefault(require("./mz700"));
const mz700_scrn_1 = __importDefault(require("../lib/mz700-scrn"));
const mz700_web_ui_1 = __importDefault(require("./mz700-web-ui"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const mz700js = yield transworker_1.default.WebSocketClient.createInterface("ws://localhost:5000", mz700_1.default, { syncType: transworker_1.default.SyncTypePromise });
        const mz700screen = document.querySelector("#mz700screen");
        const mz700scrn = new mz700_scrn_1.default(mz700screen);
        const canvas = document.createElement("CANVAS");
        mz700screen.style.display = "none";
        mz700screen.appendChild(canvas);
        mz700scrn.create({ canvas });
        canvas.style.height = "calc(100% - 1px)";
        mz700scrn.setupRendering();
        mz700js.subscribe("onUpdateScrn", canvasData => {
            const buffer = Buffer.from(canvasData, "base64");
            const array = Uint8ClampedArray.from(buffer);
            const imageData = new ImageData(array, 320, 200);
            mz700scrn._ctx.putImageData(imageData, 0, 0);
        });
        yield mz700_web_ui_1.default.createUI(mz700js, mz700screen, canvas);
    });
}
main().catch(err => console.warn(err.stack));
//# sourceMappingURL=mz700-emu-ws.js.map