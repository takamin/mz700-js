#!/usr/bin/env node
"use strict";
const fs = require("fs").promises;
const path = require("path");
const http = require("http");

const Getopt = require('node-getopt');
const HashArg = require("hash-arg");
const {WebSocketServer} = require("transworker");

const MZ700 = require("../MZ-700/mz700.js");
const { HEX } = require("../lib/number-util.js");
const getPackageJson = require("./lib/get-package-json.js");
const mztReadFile = require("./cli-command/mzt-read-file.js");

const startWebServer = require("./lib/start-web-server.js");

const getopt = new Getopt([
    ['c',   'set-cmt=FILENAME',  'set MZT file as cassette magnetic tape'],
    ['h',   'help',     'display this help'],
    ['v',   'version',  'show version']
]);
const npm = getPackageJson(path.join(__dirname, ".."));
const description =
    `The Cli-Version MZ-700 Emulator. -- ${npm.name}@${npm.version}`;
getopt.setHelp([
    "Usage: mz700-cli [OPTION] [MZT-filename]",
    description,
    "",
    "[[OPTIONS]]",
    "",
    "Installation: npm install -g mz700-js",
    "Repository: https://github.com/takamin/mz700-js",
].join("\n"));

async function loadMzt(filename) {
    const mztList = await mztReadFile(filename);
    if(mztList != null && mztList.length > 0) {
        mztList.forEach((mzt, i) => {
            const {addr_load, file_size, addr_exec, filename} = mzt.header;
            console.log([
                `[${i + 1}/${mztList.length}]`,
                `${HEX(addr_load, 4)}h ---`,
                `${HEX((addr_load + file_size - 1), 4)}h`,
                `(${file_size} bytes),`,
                `${HEX(addr_exec, 4)}h, ${filename}`,
            ].join(" "));
        });
    }
    return mztList;
}

async function mzt2cmt(mztList) {
    const mzt = mztList.shift();
    return mzt.header.buffer.concat(mzt.body.buffer);
}

/**
 * Read NEWMON7.ROM
 * @returns {UintA8Array} A NEWMON7 binary
 */
async function readMzNewmon7Rom() {
    const pathname = path.join(
        __dirname, "../mz_newmon/ROMS/NEWMON7.ROM");
    const buffer = await fs.readFile(pathname);
    return Uint8Array.from(buffer);
}

const {createCanvas} = require("canvas");
const MZ700CanvasRenderer = require('../lib/mz700-canvas-renderer.js');
const MZ700CG = require("../lib/mz700-cg.js");
function createCanvasRenderer() {
    const canvas = createCanvas(320, 200);
    const mz700CanvasRenderer = new MZ700CanvasRenderer();
    mz700CanvasRenderer.create({
        canvas: canvas,
        CG: new MZ700CG(MZ700CG.ROM, 8, 8),
    });
    mz700CanvasRenderer.setupRendering();
    return mz700CanvasRenderer;
}

function createMZ700(transworker) {
    const mz700 = new MZ700();
    const mz700CanvasRenderer = createCanvasRenderer();
    mz700.create({
        started: () =>
            transworker.postNotify("start"),
        stopped: () =>
            transworker.postNotify("stop"),
        onBreak: () =>
            transworker.postNotify("onBreak"),
        onVramUpdate: (index, dispcode, attr) => {
            // transworker.postNotify("onVramUpdate", {index, dispcode, attr});
            mz700CanvasRenderer.writeVram(index, attr, dispcode);
        },
        startSound: freq =>
            transworker.postNotify("startSound", [ freq ]),
        stopSound: () =>
            transworker.postNotify("stopSound"),
        onStartDataRecorder: () =>
            transworker.postNotify("onStartDataRecorder"),
        onStopDataRecorder: () =>
            transworker.postNotify("onStopDataRecorder"),
        onMmioRead: (addr, value) =>
            transworker.postNotify("onMmioRead", {addr, value}),
        onMmioWrite: (addr, value) =>
            transworker.postNotify("onMmioWrite", {addr, value}),
    });
    setInterval(()=>{
        const imageData = mz700CanvasRenderer._ctx.getImageData(0, 0, 320, 200);
        const buffer = Buffer.from(imageData.data).toString("base64");
        transworker.postNotify("onUpdateScrn", buffer);
    }, 1000/24);
    return mz700;
}

function setupPCG700(mz700) {
    mz700.memory.poke(0xE010, 0x00);
    mz700.memory.poke(0xE011, 0x00);
    mz700.memory.poke(0xE012, 0x18);
}

function writeMzt(mz700, mztList) {
    mztList.forEach(mzt => {
        const {addr_load, file_size} = mzt.header;
        const {buffer} = mzt.body;
        for(let i = 0; i < file_size; i++) {
            mz700.memory.poke(addr_load + i, buffer[i]);
        }
    });
}

async function main() {
    const cli = getopt.parseSystem();
    if(cli.options.help) {
        getopt.showHelp();
        return;
    }
    if(cli.options.version) {
        console.log(description);
        return;
    }

    const cmtFname = cli.options["set-cmt"];
    const mztToSetCmt = cmtFname ? await loadMzt(cmtFname) : null;
    const cassetteTape = mztToSetCmt ? mzt2cmt(mztToSetCmt) : null;

    const argv = HashArg.get(["input_filename"], cli.argv);
    const mztFname = argv.input_filename;
    const mztList = mztFname ? await loadMzt(mztFname) : null;

    const newmon7 = await readMzNewmon7Rom();

    console.log(description);

    const server = http.createServer();
    server.listen(5000, "localhost");
    WebSocketServer.listen(server, transworker=>{
        const mz700 = createMZ700(transworker);
        mz700.setMonitorRom(newmon7);
        setupPCG700(mz700);
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
