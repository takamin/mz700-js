"use strict";
const fs = require("fs").promises;
const path = require("path");
const {HEX} = require("../../js/lib/number-util.js");
const mztReadFile = require("../cli-command/mzt-read-file.js");

/**
 * Read NEWMON7.ROM
 * @returns {UintA8Array} A NEWMON7 binary
 */
async function readMzNewmon7Rom() {
    const pathname = path.join(
        __dirname, "../../mz_newmon/ROMS/NEWMON7.ROM");
    const buffer = await fs.readFile(pathname);
    return Uint8Array.from(buffer);
}

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

function mzt2cmt(mztList) {
    const mzt = mztList.shift();
    return mzt.header.buffer.concat(mzt.body.buffer);
}

async function loadCmt(filename) {
    const mztToSetCmt = await loadMzt(filename);
    const cassetteTape = mzt2cmt(mztToSetCmt);
    return cassetteTape;
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

module.exports = {
    readMzNewmon7Rom,
    loadMzt,
    loadCmt,
    writeMzt,
};
