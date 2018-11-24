/* global Uint8Array */
require("../lib/context.js");
require("../lib/ex_number.js");
const    TransWorker = require('transworker');
const   Z80_assemble = require("../Z80/assembler.js");
const  MZ_TapeHeader = require('./mz-tape-header.js');
const          MZ700 = require("./mz700.js");
const         MZBeep = require("./mz-beep.js");
const           MMIO = require("./mz-mmio.js");
const MZ700KeyMatrix = require("../MZ-700/mz700-key-matrix.js");
const        mz700cg = require("../lib/mz700-cg.js");
require("../lib/jquery.asmview.js");
require("../lib/jquery.asmlist.js");
require("../lib/jquery.tabview.js");
require("../lib/jquery.Z80-mem.js");
require("../lib/jquery.mz700-scrn.js");

const MZ700EmuBase = function() {
    this.opt = {
        urlPrefix: "",
        screenElement: null,
        mztDroppableElement: null,
        dataRecorderElement: null,
    };
    this.isRunning = false;
    this.scrn = null;
    this.sound = null;
    this.keyAcceptanceState = false;
    this.keystates = {};
};

MZ700EmuBase.prototype.create = async function(opt) {
    opt = opt || {};
    Object.keys(this.opt).forEach(function(key) {
        if(key in opt) {
            this.opt[key] = opt[key];
        }
    }, this);

    // Monoral buzzer sound
    this.sound = new MZBeep();

    // MZ-700 Screen
    if(this.opt.screenElement) {
        $(this.opt.screenElement).mz700scrn("create", {
            CG: new mz700cg(),
        });
        this.scrn = this.opt.screenElement["mz700scrn"];

        // Resume the AudioContext if it is suspended.
        let canvas = $(this.opt.screenElement).find("canvas");
        canvas.click(()=>{ this.allowToPlaySound(); });
        let title = canvas.attr("title");
        let checkSound = () => {
            if(!this.sound.resumed()) {
                canvas.attr("title",
                    "The Audio API is suspended by autoplay policy. " +
                    "To resume the sound, click here or volume controls.");
            } else {
                canvas.attr("title", title);
            }
        };
        this.sound.audio.addEventListener("statechange", event=>{
            event.stopPropagation();
            checkSound();
        });
        checkSound();
    }

    // Accept MZT file to drop to the MZ-700 screen
    if(this.opt.mztDroppableElement &&
        window.File && window.FileReader &&
        window.FileList && window.Blob)
    {
        let el = this.opt.mztDroppableElement;
        el.addEventListener('dragover', function(event) {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
        }, false);
        el.addEventListener('drop', event => {
            event.stopPropagation();
            event.preventDefault();
            let files = event.dataTransfer.files; // FileList object.
            if(files.length > 0) {
                let f = files[0];
                let reader = new FileReader();
                reader.onload = async () => {
                    let tape_data = new Uint8Array(reader.result);
                    await this.setMztData(tape_data);
                };
                reader.readAsArrayBuffer(f);
            }
        }, false);
    }

    // Handle Key events
    let updateKeyStates = (event, state) => {
        let code = event.keyCode;
        if(!(code in this.keystates) || this.keystates[code] != state) {
            this.keystates[code] = state;
            let matrix = MZ700KeyMatrix.Code2Key[code];
            if(matrix != null) {
                let event = new Event("keyStateChanged");
                event.matrix = matrix;
                event.keyState = state;
                window.dispatchEvent(event);
                this.mz700comworker.setKeyState(
                    matrix.strobe, matrix.bit, state, null);
            }
        }
    };

    window.addEventListener("keydown", event => {
        if(this.keyAcceptanceState) {
            event.stopPropagation();
            updateKeyStates(event, true);
            return false;
        }
    });

    window.addEventListener("keyup", async event => {
        if(this.keyAcceptanceState) {
            event.stopPropagation();
            updateKeyStates(event, false);
            return false;
        }
    });

    //
    // Create MZ-700 Worker
    //

    this._mmio = MMIO.create();
    this.mz700comworker = TransWorker.create(
        this.opt.urlPrefix + "js/bundle-mz700-worker.js", MZ700, this, {
            'onExecutionParameterUpdate': param => {
                let event = new Event("emulationSpeedUpdated");
                event.timerInterval = param;
                window.dispatchEvent(event);
            },
            "start": () => {
                this.isRunning = true;
                window.dispatchEvent(new Event("mz700started"));
            },
            "stop": () => {
                this.isRunning = false;
                window.dispatchEvent(new Event("mz700stopped"));
            },
            "onNotifyClockFreq": clockCount => {
                $(".speed-control-slider").attr("title",
                    "Clock: " + (Math.round(100.0 * clockCount / 1000000) / 100) + " MHz");
            },
            'onBreak': () => {
                this.stop();
            },
            'onUpdateScreen': (this.scrn == null) ? () => {} :
                updateData => {
                    for(const addr of Object.keys(updateData)) {
                        const chr = updateData[addr];
                        this.scrn.writeVram(
                                parseInt(addr), chr.attr, chr.dispcode);
                    }
                },
            'onMmioRead': param => {
                this._mmio.read(param.address, param.value);
            },
            'onMmioWrite': param => {
                this._mmio.write(param.address, param.value);
            },
            'onPortRead': ()=>{},
            'onPortWrite': ()=>{},
            'startSound': freq => { this.sound.startSound(freq[0]); },
            'stopSound': () => { this.sound.stopSound(); },
            "onStartDataRecorder": () => {
                window.dispatchEvent(new Event("onStartDataRecorder"));
            },
            "onStopDataRecorder": async ()=>{
                window.dispatchEvent(new Event("onStopDataRecorder"));
            }
        }
    );

    window.addEventListener("mz700started", () => {
        $(".MZ-700").addClass("running");
    });

    window.addEventListener("mz700stopped", () => {
        $(".MZ-700").removeClass("running");
    });

    //
    // Setup PCG-700
    //
    this.PCG700 = require("../lib/PCG-700").create();
    this.PCG700.writeMMIO(0xE010, 0x00);
    this.PCG700.writeMMIO(0xE011, 0x00);
    this.PCG700.writeMMIO(0xE012, 0x18);
    this.mmioMapPeripheral(this.PCG700, [], [0xE010, 0xE011, 0xE012]);
    window.addEventListener("enablePCG700", this.scrn == null ? ()=>{} : () => {
        this.scrn.changeCG(this.PCG700._cg);
        this.scrn.redraw();
    });
    window.addEventListener("disablePCG700", this.scrn == null ? ()=>{} : () => {
        this.scrn.restoreCG();
        this.scrn.redraw();
    });
    window.addEventListener("updatePCG700", this.scrn == null ? ()=>{} : event => {
        this.scrn.redrawChar(event.detail.atb, event.detail.dispCode);
    });

};

MZ700EmuBase.prototype.setEmuTimerInterval = function(timerInterval) {
    this.mz700comworker.setExecutionParameter(timerInterval, ()=>{});
};

MZ700EmuBase.prototype.mmioMapPeripheral = function(peripheral, mapToRead, mapToWrite) {
    this._mmio.entry(peripheral, mapToRead, mapToWrite);
    this.mz700comworker.mmioMapToRead(mapToRead, function(){});
    this.mz700comworker.mmioMapToWrite(mapToWrite, function(){});
};

MZ700EmuBase.prototype.reset = async function() {
    await this.stop();
    await new Promise( resolve => {
        this.mz700comworker.reset( () => {
            resolve();
        });
    });
    let bytes = await this.getCassetteTape();
    this.createCmtDownloadLink(bytes);
    await this.start(null);
};

MZ700EmuBase.prototype.start = function(addr) {
    return new Promise( async (resolve, reject) => {
        try {
            if(addr == null) {
                this.mz700comworker.start(() => {
                    resolve();
                });
            } else {
                await this.setPC(addr);
                this.mz700comworker.start(() => {
                    resolve();
                });
            }
        } catch(err) {
            reject(err);
        }
    });
};

MZ700EmuBase.prototype.stop = function() {
    return new Promise( (resolve, reject) => {
        this.mz700comworker.stop(() => {
            try {
                resolve();
            } catch(err) {
                reject(err);
            }
        });
    });
};

MZ700EmuBase.prototype.getRegister = function () {
    return new Promise( (resolve, reject) => {
        try {
            this.mz700comworker.getRegister(reg => {
                resolve(reg);
            });
        } catch(err) {
            reject(err);
        }
    });
};

/**
 *
 * Download and Run a MZT file that is placed on server.
 *
 * 1. Download MZT file from server as byte array.
 * 2. Load to the memory.
 * 3. Run.
 *
 * This is ASYNC function.
 *
 * @param {string} name MZT file's body name on the server
 * @returns {undefined}
 */
MZ700EmuBase.prototype.runServerMZT = async function (name) {
    await this.stop();
    $.getJSON("mzt/" + name + ".json", async tape_data => {
        await this.setMztData(tape_data);
    });
};

/**
 *
 * Load a MZT to the memory, and prepare to run.
 *
 * 1. Parse MZT's header area.
 * 2. Disassemble the MZT' body binary to assemble list.
 * 3. Assemble it back to the memory located by its header area.
 * 4. A program counter will be set to its execution address.
 *
 * @param {object} tape_data MZT tape data as byte array
 * @returns {undefined}
 */
MZ700EmuBase.prototype.setMztData = async function(tape_data) {
    await this.stop();
    await this.setCassetteTape(tape_data);
    if(tape_data != null) {
        let mztape_array = MZ700.parseMZT(tape_data);
        await this.loadCassetteTape();
        this.createCmtDownloadLink(tape_data);
        await this.disassemble(mztape_array);
        await this.start(mztape_array[0].header.addr_exec);
    }
};

MZ700EmuBase.prototype.disassemble = async function(mztape_array) {
    let name = MZ_TapeHeader.get1stFilename(mztape_array) || "(empty)";
    let result = MZ700.disassemble(mztape_array);
    if($(".source-list").length > 0) {
        $(".source-list").asmview("name", "mzt", name);
        this._asmlistMzt.asmlist("text", result.outbuf);
        this._asmlistMzt.asmlist("writeList",
            result.asmlist, await this.getBreakPoints());
    }
};

MZ700EmuBase.prototype.getBreakPoints = function() {
    return new Promise(resolve => {
        this.mz700comworker.getBreakPoints( breakpoints => {
            resolve(breakpoints);
        });
    });
};
MZ700EmuBase.prototype.acceptKey = function(state) {
    this.keyAcceptanceState = state;
    if(this.keyAcceptanceState) {
        window.dispatchEvent(new Event("keyinAcceptanceEnabled"));
    } else {
        window.dispatchEvent(new Event("keyinAcceptanceDisabled"));
    }
};

MZ700EmuBase.prototype.createCmtDownloadLink = function(bytes) {
    if(bytes == null || bytes.length < 128) {
        this.cmtMessageArea.empty().append("(EMPTY)");
        return;
    }
    let header = new MZ_TapeHeader(bytes, 0);
    let byteArr = new Uint8Array(bytes);
    let blob = new Blob([byteArr], {'type': "application/octet-stream"});
    this.cmtMessageArea.empty().html(header.filename).append(
            $("<a/>").addClass("download-link")
                .attr("download", header.filename + ".MZT")
                .attr("type", "application/octet-stream")
                .attr("href", URL.createObjectURL(blob))
                .html("")
                .attr("title",
                    "Download " + header.filename + ".MZT" +
                    " (" + header.file_size + " bytes) " +
                    " ADDR:(" + header.addr_load.HEX(4) + " - " +
                    (header.addr_load + header.file_size - 1).HEX(4) + ") EXEC:" +
                    header.addr_exec.HEX(4))
            );
}

/**
 * Assemble and display the list.
 * @async
 * @param {string} asmsrc
 * The source to be assemble with Z80 assembler.
 * @param {object} asmlist
 * jquery.asmlist object
 * @returns {Promise<object>} as a result of assemble.
 */
MZ700EmuBase.prototype.assemble = async function( asmsrc, asmlist ) {
    let shouldBeResumed = this.isRunning;
    if(shouldBeResumed) {
        await this.stop();
    }
    let assembled = Z80_assemble.assemble([asmsrc]).obj[0];
    await this.writeAsmCode( assembled );
    asmlist.asmlist("writeList",
        assembled.list, await this.getBreakPoints());
    if(shouldBeResumed) {
        await this.start();
    }
    return assembled;
};
MZ700EmuBase.prototype.writeAsmCode = function(assembled) {
    return new Promise(resolve => {
        this.mz700comworker.writeAsmCode( assembled, execAddr => {
            resolve(execAddr);
        });
    });
};
MZ700EmuBase.prototype.setCassetteTape = function(tape_data) {
    return new Promise( resolve => {
        this.mz700comworker.setCassetteTape(tape_data, mztape_array => {
            resolve( mztape_array );
        });
    });
};
MZ700EmuBase.prototype.loadCassetteTape = function() {
    return new Promise( resolve => {
        this.mz700comworker.loadCassetteTape( () => { resolve(); });
    });
};
MZ700EmuBase.prototype.getCassetteTape = function() {
    return new Promise( resolve => {
        this.mz700comworker.getCassetteTape(bytes => {
            resolve(bytes);
        });
    });
};
MZ700EmuBase.prototype.setPC = function(addr) {
    return new Promise(resolve => {
        this.mz700comworker.setPC(addr, ()=>{
            resolve();
        });
    });
};
MZ700EmuBase.prototype.execute = function(steps) {
    return new Promise(resolve => {
        this.mz700comworker.exec(steps, ()=>{
            resolve();
        });
    });
};

MZ700EmuBase.prototype.allowToPlaySound = function() {
    if(!this.sound.resumed()) {
        this.sound.resume();
    }
};

module.exports = MZ700EmuBase;
