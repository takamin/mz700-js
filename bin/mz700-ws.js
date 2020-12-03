#!/usr/bin/env node
/* tslint:disable:no-console */
"use strict";
const path = require("path");
const http = require("http");
const Getopt = require('node-getopt');
const HashArg = require("hash-arg");
const {WebSocketServer} = require("transworker");
const {createCanvas} = require("canvas");

const MZ700 = require("../js/MZ-700/mz700.js");
const MZ700CanvasRenderer = require('../js/lib/mz700-canvas-renderer.js');
const MZ700CG = require("../js/lib/mz700-cg.js");
const PCG700 = require("../js/lib/PCG-700.js");
const getPackageJson = require("./lib/get-package-json.js");
const startWebServer = require("./lib/start-web-server.js");
const {
    readMzNewmon7Rom,
    loadMzt,
    loadCmt,
    writeMzt,
} = require("./lib/mz-files");

const getopt = new Getopt([
    ['c',   'set-cmt=FILENAME',  'set MZT file as cassette magnetic tape'],
    ['h',   'help',     'display this help'],
    ['v',   'version',  'show version']
]);
const npm = getPackageJson(path.join(__dirname, ".."));
const description =
    `The WebSocket-Version MZ-700 Emulator. -- ${npm.name}@${npm.version}`;
getopt.setHelp([
    "Usage: mz700-cli [OPTION] [MZT-filename]",
    description,
    "",
    "[[OPTIONS]]",
    "",
    "Installation: npm install -g mz700-js",
    "Repository: https://github.com/takamin/mz700-js",
].join("\n"));

const cli = getopt.parseSystem();
if(cli.options.help) {
    getopt.showHelp();
    return;
}
if(cli.options.version) {
    console.log(description);
    return;
}
console.log(description);

const argv = HashArg.get(["input_filename"], cli.argv);

function createCanvasRenderer() {
    const canvas = createCanvas(320, 200);
    const mz700CanvasRenderer = new MZ700CanvasRenderer();
    mz700CanvasRenderer.create({
        canvas: canvas,
        CG: new MZ700CG(MZ700CG.ROM, 8, 8),
    });
    return mz700CanvasRenderer;
}

function createMZ700(transworker, mz700CanvasRenderer) {
    const mz700 = new MZ700();
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
        startSound: freq => transworker.postNotify("startSound", [ freq ]),
        stopSound: () => transworker.postNotify("stopSound"),
        onStartDataRecorder: () => transworker.postNotify("onStartDataRecorder"),
        onStopDataRecorder: () => transworker.postNotify("onStopDataRecorder"),
    });

    setInterval(()=>{
        if(vramUpdated) {
            const imageData = mz700CanvasRenderer.getImageData();
            const buffer = Buffer.from(imageData.data).toString("base64");
            transworker.postNotify("onUpdateScrn", buffer);
            vramUpdated = false;
        }
    }, 1000/24);
    return mz700;
}

async function main() {
    const fnCmt = cli.options["set-cmt"];
    const fnLoad = argv.input_filename;
    const [newmon7, cassetteTape, mztList] = await Promise.all([
        readMzNewmon7Rom(),
        fnCmt ? await loadCmt(fnCmt) : null,
        fnLoad ? await loadMzt(fnLoad) : null,
    ]);
    const server = http.createServer();
    server.listen(5000, "localhost");
    WebSocketServer.listen(server, transworker=>{
        const mz700CanvasRenderer = createCanvasRenderer();
        mz700CanvasRenderer.setupRendering();
        const mz700 = createMZ700(transworker, mz700CanvasRenderer);
        const pcg700 = new PCG700(mz700CanvasRenderer);
        mz700.attachPCG700(pcg700);

        mz700.setMonitorRom(newmon7);
        if(cassetteTape) {
            mz700.setCassetteTape(cassetteTape);
        }
        if(mztList) {
            writeMzt(mz700, mztList);
        }
        return mz700;
    });
    startWebServer("..", 3000, "mz700-js/emu-ws.html");
}
main().catch(err => console.error(`Error: ${err.stack}`));
