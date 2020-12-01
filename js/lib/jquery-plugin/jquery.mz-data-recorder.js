"use strict";
const MZ_TapeHeader = require('../mz-tape-header.js');
const NumberUtil = require("../number-util.js");

const jquery_plugin_class = require("./jquery_plugin_class");
jquery_plugin_class("MZDataRecorder");

class MZDataRecorder {
    constructor(element) {
        this._dataRecorder = $(element).addClass("data-recorder");
        this.cmtMessageArea = $("<span/>").addClass("cmt-message").html("(EMPTY)");
        this.opts = {
            mz700js: null,
            onRecPushed: ()=>{},
            onPlayPushed: ()=>{},
            onStopPushed: ()=>{},
            onEjectPushed: ()=>{},
        }
        this._mz700js = null;
    }
    create(opts) {
        opts = opts || {};
        Object.keys(this.opts).forEach(key => {
            if(key in opts) {
                this.opts[key] = opts[key];
            }
        });

        this._mz700js = this.opts.mz700js;

        const btnCmtRec = $("<button/>").attr("type", "button").addClass("rec")
            .html("<span style='color:red'>●</span> RECPLAY").click( () => {
                this.cmtMessageArea.empty().html("Recording ...");
                this.opts.onRecPushed();
            });
        const btnCmtPlay = $("<button/>").attr("type", "button").addClass("play")
            .html("<span class='cmtPlayImage'>▼</span> PLAY").click( () => {
                this.opts.onPlayPushed();
            });
        const btnCmtStop = $("<button/>").attr("type", "button").addClass("stop")
            .html("<span>■</span> STOP").click( () => {
                this.opts.onStopPushed();
            });
        const btnCmtEject = $("<button/>").attr("type", "button").addClass("eject")
            .html("<span>▲</span>EJECT").click(async () => {
                await this.opts.onEjectPushed();
                await this.updateCmtSlot();
            });
        this._dataRecorder
            .html("CMT: ")
            .attr("title", "Drop MZT file here to load with 'L' command")
            .append(this.cmtMessageArea)
            .append(btnCmtRec)
            .append(btnCmtPlay)
            .append(btnCmtStop)
            .append(btnCmtEject);
    }
    start() {
        this._dataRecorder.find("button.rec").prop("disabled", true);
        this._dataRecorder.find("button.play").prop("disabled", true);
        this._dataRecorder.find("button.stop").prop("disabled", false);
    }
    async stop() {
        await this.updateCmtSlot();
        this._dataRecorder.find("button.rec").prop("disabled", false);
        this._dataRecorder.find("button.play").prop("disabled", false);
        this._dataRecorder.find("button.stop").prop("disabled", true);
    }
    async updateCmtSlot() {
        const bytes = await this._mz700js.getCassetteTape();
        this.createCmtDownloadLink(bytes);
    }
    createCmtDownloadLink(bytes) {
        if(bytes == null || bytes.length < 128) {
            this.cmtMessageArea.empty().append("(EMPTY)");
            return;
        }
        const header = new MZ_TapeHeader(bytes, 0);
        const byteArr = new Uint8Array(bytes);
        const blob = new Blob([byteArr], {'type': "application/octet-stream"});
        this.cmtMessageArea.empty().html(header.filename).append(
                $("<a/>").addClass("download-link")
                    .attr("download", header.filename + ".MZT")
                    .attr("type", "application/octet-stream")
                    .attr("href", URL.createObjectURL(blob))
                    .html("")
                    .attr("title",
                        "Download " + header.filename + ".MZT" +
                        " (" + header.fileSize + " bytes) " +
                        " ADDR:(" + NumberUtil.HEX(header.addrLoad, 4) + " - " +
                        NumberUtil.HEX(header.addrLoad + header.fileSize - 1, 4) + ") EXEC:" +
                        NumberUtil.HEX(header.addrExec, 4))
                );
    }
}
window.MZDataRecorder = MZDataRecorder;
module.exports = MZDataRecorder;
