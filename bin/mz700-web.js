#!/usr/bin/env node
"use strict";
let opt = { cwd: require("path").join(__dirname, "..") };
require("child_process").exec("npm start", opt, (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
}).on("exit", (code, signal) => {
    console.log(`HttpServer Exit ${code} ${signal}`);
});
if (process.platform === 'win32') {
    require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    }).on('SIGINT', function () {
        process.emit('SIGINT');
    });
}
function exit() {
    console.log('http-server stopped.');
    process.exit();
}
process.on('SIGINT', exit);
process.on('SIGTERM', exit);
