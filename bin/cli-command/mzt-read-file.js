"use strict";
const fs = require('fs');
const MZ_Tape = require("../../lib/mz-tape.js");
module.exports = function (filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if(err) {
                reject(err);
            } else {
                console.log("Loading " + filename + " ... ");
                const mzt_list = MZ_Tape.parseMZT(data);
                if(mzt_list == null || !Array.isArray(mzt_list) || mzt_list.length == 0) {
                    reject(new Error(`No MZT header read.`));
                } else {
                    resolve(mzt_list);
                }
            }
        });
    });
};
