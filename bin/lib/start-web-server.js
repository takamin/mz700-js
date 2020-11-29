"use strict";
const path = require("path");
const childProcess = require("child_process");

/**
 * Raise up a http-server and open specific web-page.
 * @param {string} basePath Relative path from this npm root
 * @param {number} port port number to be listened
 * @param {string} url URL to show first
 * @returns {undefined}
 */
function startWebServer(basePath, port, url) {
    const opt = { cwd: path.join(__dirname, "../..") };
    const command = `npm run http-server -- ${basePath} -p ${port} -o ${url}`;
    childProcess.exec(command, opt, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
    });
    if (process.platform === 'win32') {
        require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        }).on('SIGINT', function () {
            process.emit('SIGINT');
        });
    }
}
module.exports = startWebServer;
