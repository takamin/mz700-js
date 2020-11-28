#!/usr/bin/env node
"use strict";
const fs = require("fs").promises;
const path = require("path");
const http = require("http");

const Getopt = require('node-getopt');
const HashArg = require("hash-arg");
const {WebSocketServer} = require("transworker");
const {createCanvas} = require("canvas");

const MZ700 = require("../MZ-700/mz700.js");
const MZ700CanvasRenderer = require('../lib/mz700-canvas-renderer.js');
const MZ700CG = require("../lib/mz700-cg.js");
const PCG700 = require("../lib/PCG-700.js");

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

async function loadMzt(filename) {
    const mztList = await mztReadFile(filename);
    if(mztList != null && mztList.length > 0) {
        mztList.forEach((mzt, i) => {
            const {addrLoad, fileSize, addrExec, filename} = mzt.header;
            console.log([
                `[${i + 1}/${mztList.length}]`,
                `${HEX(addrLoad, 4)}h ---`,
                `${HEX((addrLoad + fileSize - 1), 4)}h`,
                `(${fileSize} bytes),`,
                `${HEX(addrExec, 4)}h, ${filename}`,
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

function setupPCG700(mz700) {
    mz700.memory.poke(0xE010, 0x00);
    mz700.memory.poke(0xE011, 0x00);
    mz700.memory.poke(0xE012, 0x18);
}

function createMZ700(transworker) {
    const mz700 = new MZ700();
    const mz700CanvasRenderer = createCanvasRenderer();
    const pcg700 = new PCG700(mz700CanvasRenderer);
    const onMmioWrite = mmio => {
        const {addr, value} = mmio;
        switch(addr) {
        case 0xE010:
            pcg700.setPattern(value & 0xff);
            break;
        case 0xE011:
            pcg700.setAddrLo(value & 0xff);
            break;
        case 0xE012:
            pcg700.setAddrHi(value & PCG700.ADDR);
            pcg700.setCopy(value & PCG700.COPY);
            pcg700.setWE(value & PCG700.WE);
            pcg700.setSSW(value & PCG700.SSW);
            break;
        }
    };
    let vramUpdated = true;
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
            vramUpdated = true;
        },
        startSound: freq =>
            transworker.postNotify("startSound", [ freq ]),
        stopSound: () =>
            transworker.postNotify("stopSound"),
        onStartDataRecorder: () =>
            transworker.postNotify("onStartDataRecorder"),
        onStopDataRecorder: () =>
            transworker.postNotify("onStopDataRecorder"),
        onMmioRead: () => {},
        onMmioWrite: (addr, value) =>
            onMmioWrite({addr, value}),
    });
    setInterval(()=>{
        if(vramUpdated) {
            const imageData = mz700CanvasRenderer._ctx.getImageData(0, 0, 320, 200);
            const buffer = Buffer.from(imageData.data).toString("base64");
            transworker.postNotify("onUpdateScrn", buffer);
            vramUpdated = false;
        }
    }, 1000/24);
    return mz700;
}

function writeMzt(mz700, mztList) {
    mztList.forEach(mzt => {
        const {addrLoad, fileSize} = mzt.header;
        const {buffer} = mzt.body;
        for(let i = 0; i < fileSize; i++) {
            mz700.memory.poke(addrLoad + i, buffer[i]);
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
        setupPCG700(mz700);
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
