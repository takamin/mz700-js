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
const TransWorker = require("transworker");
const mz700_1 = __importDefault(require("./mz700"));
const mz700_canvas_renderer_1 = __importDefault(require("../lib/mz700-canvas-renderer"));
const mz700_cg_js_1 = __importDefault(require("../lib/mz700-cg.js"));
const PCG_700_js_1 = __importDefault(require("../lib/PCG-700.js"));
function createMZ700(transworker, mz700CanvasRenderer) {
    const mz700 = new mz700_1.default();
    let vramUpdated = true;
    const onVramUpdate = () => {
        vramUpdated = true;
    };
    mz700.create({
        started: () => transworker.postNotify("start"),
        stopped: () => transworker.postNotify("stop"),
        onBreak: () => transworker.postNotify("onBreak"),
        onVramUpdate: (index, dispcode, attr) => {
            mz700CanvasRenderer.writeVram(index, attr, dispcode);
            onVramUpdate();
        },
        startSound: freq => transworker.postNotify("startSound", [freq]),
        stopSound: () => transworker.postNotify("stopSound"),
        onStartDataRecorder: () => transworker.postNotify("onStartDataRecorder"),
        onStopDataRecorder: () => transworker.postNotify("onStopDataRecorder"),
    });
    transworker.listenTransferableObject("offscreenCanvas", offscreenCanvas => {
        mz700CanvasRenderer.create({
            canvas: offscreenCanvas,
            CG: new mz700_cg_js_1.default(mz700_cg_js_1.default.ROM, 8, 8),
        });
        mz700CanvasRenderer.setupRendering();
        setInterval(() => {
            if (vramUpdated) {
                const imageData = mz700CanvasRenderer.getImageData();
                transworker.postNotify("onUpdateScrn", imageData, [imageData.data.buffer]);
                vramUpdated = false;
            }
        }, 1000 / 24);
    });
    return mz700;
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const transworker = new TransWorker();
        const mz700CanvasRenderer = new mz700_canvas_renderer_1.default();
        const mz700 = createMZ700(transworker, mz700CanvasRenderer);
        const pcg700 = new PCG_700_js_1.default(mz700CanvasRenderer);
        mz700.attachPCG700(pcg700);
        transworker.create(mz700);
    });
}
main().catch(err => console.error(`Error: ${err.stack}`));
//# sourceMappingURL=mz700-worker.js.map