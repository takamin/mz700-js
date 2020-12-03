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
        const mz700js = transworker_1.default.createInterface("./js/mz700-worker.min.js", mz700_1.default, { syncType: transworker_1.default.SyncTypePromise });
        const mz700screen = document.querySelector("#mz700screen");
        const mz700scrn = new mz700_scrn_1.default(mz700screen);
        const canvas = document.createElement("CANVAS");
        mz700screen.style.display = "none";
        mz700screen.appendChild(canvas);
        mz700scrn.create({ canvas });
        canvas.style.height = "calc(100% - 1px)";
        mz700scrn.setupRendering();
        const mz700screen2 = document.createElement("DIV");
        const mz700scrn2 = new mz700_scrn_1.default(mz700screen2);
        const canvas2 = document.createElement("CANVAS");
        mz700screen2.style.display = "none";
        mz700screen2.appendChild(canvas2);
        mz700scrn2.create({ canvas: canvas2 });
        mz700js.transferObject("offscreenCanvas", canvas2.transferControlToOffscreen());
        mz700js.subscribe("onUpdateScrn", (imageData) => {
            mz700scrn._ctx.putImageData(imageData, 0, 0);
        });
        const addThisBox = $("<div/>").css("height", "48px").css("line-height", "48px")
            .append($("<div/>").css("box-sizing", "border-box").css("text-align", "right")
            .addClass("addthis_inline_share_toolbox"));
        const addThisScript = $("<script/>").attr("type", "text/javascript")
            .attr("src", "//s7.addthis.com/js/300/addthis_widget.js#pubid=ra-596c4b9e47c8c585");
        addThisBox.insertBefore($(".emulation-panel"));
        $(document.body).append(addThisScript);
        yield mz700_web_ui_1.default.createUI(mz700js, mz700screen, canvas);
    });
}
main().catch(err => console.warn(err.stack));
//# sourceMappingURL=mz700-emu.js.map