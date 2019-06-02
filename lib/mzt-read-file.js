"use strict";
const fs = require('fs');
const MZ_Tape = require("./mz-tape.js");
module.exports = function (filename) {
    return new Promise(function(resolve, reject) {
        if(!filename) {
            resolve(null);
            return;
        }
        console.log("Loading " + filename + " ... ");
        fs.readFile(filename, function(err, data) {
            if(err) {
                reject(err);
            } else {
                const mzt_list = MZ_Tape.parseMZT(data);
                if(mzt_list == null || !Array.isArray(mzt_list) || mzt_list.length == 0) {
                    reject("Error could not read " + filename);
                }
                resolve(mzt_list);
            }
        });
    });
};