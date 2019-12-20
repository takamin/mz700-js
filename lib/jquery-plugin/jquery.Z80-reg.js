(function() {
    const NumberUtil = require("../number-util.js");
    var jquery_plugin_class = require("./jquery_plugin_class");
    jquery_plugin_class("Z80RegView");
    var Z80RegView = function(element) {
        this.element = element;
    };
    window.Z80RegView = Z80RegView;
    Z80RegView.prototype.init = function(mz700js) {
        var createRegValue = function(initHtml) {
            return $("<div/>")
                .addClass("reg-value")
                .html(initHtml);
        }
        this.$B = createRegValue("--");
        this.$C = createRegValue("--");
        this.$D = createRegValue("--");
        this.$E = createRegValue("--");
        this.$H = createRegValue("--");
        this.$L = createRegValue("--");
        this.$A = createRegValue("--");

        this.$FS = createRegValue("-");
        this.$FZ = createRegValue("-");
        this.$F5 = createRegValue("-");
        this.$FH = createRegValue("-");
        this.$F1 = createRegValue("-");
        this.$FP = createRegValue("-");
        this.$FN = createRegValue("-");
        this.$FC = createRegValue("-");

        this.$PC = createRegValue("----");
        this.$SP = createRegValue("----");
        this.$IX = createRegValue("----");
        this.$IY = createRegValue("----");

        this.$IFF1 = createRegValue("-");
        this.$IFF2 = createRegValue("-");
        this.$HALT = createRegValue("-");
        this.$IM = createRegValue("-");
        this.$I = createRegValue("--");
        this.$R = createRegValue("--");
        
        this.$B_ = createRegValue("--");
        this.$C_ = createRegValue("--");
        this.$D_ = createRegValue("--");
        this.$E_ = createRegValue("--");
        this.$H_ = createRegValue("--");
        this.$L_ = createRegValue("--");
        this.$A_ = createRegValue("--");
        
        this.$FS_ = createRegValue("-");
        this.$FZ_ = createRegValue("-");
        this.$F5_ = createRegValue("-");
        this.$FH_ = createRegValue("-");
        this.$F1_ = createRegValue("-");
        this.$FP_ = createRegValue("-");
        this.$FN_ = createRegValue("-");
        this.$FC_ = createRegValue("-");

        this.$R_ = createRegValue("-");

        $(this.element).empty()
            .addClass("Z80RegView")
            .append($("<div/>").addClass("row")
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("B"))
                    .append(this.$B))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("C"))
                    .append(this.$C))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("D"))
                    .append(this.$D))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("E"))
                    .append(this.$E))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("H"))
                    .append(this.$H))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("L"))
                    .append(this.$L))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("A"))
                    .append(this.$A))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("S"))
                    .append(this.$FS))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("Z"))
                    .append(this.$FZ))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("-"))
                    .append(this.$F5))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("H"))
                    .append(this.$FH))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("-"))
                    .append(this.$F1))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("P/V"))
                    .append(this.$FP))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("N"))
                    .append(this.$FN))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("C"))
                    .append(this.$FC))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("PC"))
                    .append(this.$PC))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("SP"))
                    .append(this.$SP))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IX"))
                    .append(this.$IX))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IY"))
                    .append(this.$IY))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("I"))
                    .append(this.$I)))
            .append($("<div/>").addClass("row")
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("B'"))
                    .append(this.$B_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("C'"))
                    .append(this.$C_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("D'"))
                    .append(this.$D_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("E'"))
                    .append(this.$E_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("H'"))
                    .append(this.$H_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("L'"))
                    .append(this.$L_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("A'"))
                    .append(this.$A_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("S'"))
                    .append(this.$FS_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("Z'"))
                    .append(this.$FZ_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("-"))
                    .append(this.$F5_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("H'"))
                    .append(this.$FH_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("-"))
                    .append(this.$F1_))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("P/V'"))
                    .append(this.$FP_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("N'"))
                    .append(this.$FN_))
                .append($("<div/>").addClass("register narrow")
                    .append($("<div/>").addClass("name").html("C'"))
                    .append(this.$FC_))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IFF1"))
                    .append(this.$IFF1))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IFF2"))
                    .append(this.$IFF2))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("HALT"))
                    .append(this.$HALT))
                .append($("<div/>").addClass("register wide")
                    .append($("<div/>").addClass("name").html("IM"))
                    .append(this.$IM))
                .append($("<div/>").addClass("register")
                    .append($("<div/>").addClass("name").html("R"))
                    .append(this.$R)));

        this.elemB = this.$B.get(0);
        this.elemC = this.$C.get(0);
        this.elemD = this.$D.get(0);
        this.elemE = this.$E.get(0);
        this.elemH = this.$H.get(0);
        this.elemL = this.$L.get(0);
        this.elemA = this.$A.get(0);

        this.elemFS = this.$FS.get(0);
        this.elemFZ = this.$FZ.get(0);
        this.elemF5 = this.$F5.get(0);
        this.elemFH = this.$FH.get(0);
        this.elemF1 = this.$F1.get(0);
        this.elemFP = this.$FP.get(0);
        this.elemFN = this.$FN.get(0);
        this.elemFC = this.$FC.get(0);
        this.elemPC = this.$PC.get(0);
        this.elemSP = this.$SP.get(0);
        this.elemIX = this.$IX.get(0);
        this.elemIY = this.$IY.get(0);

        this.elemIFF1 = this.$IFF1.get(0);
        this.elemIFF2 = this.$IFF2.get(0);
        this.elemHALT = this.$HALT.get(0);
        this.elemIM = this.$IM.get(0);
        this.elemI = this.$I.get(0);
        this.elemR = this.$R.get(0);

        this.elemB_ = this.$B_.get(0);
        this.elemC_ = this.$C_.get(0);
        this.elemD_ = this.$D_.get(0);
        this.elemE_ = this.$E_.get(0);
        this.elemH_ = this.$H_.get(0);
        this.elemL_ = this.$L_.get(0);
        this.elemA_ = this.$A_.get(0);

        this.elemFS_ = this.$FS_.get(0);
        this.elemFZ_ = this.$FZ_.get(0);
        this.elemF5_ = this.$F5_.get(0);
        this.elemFH_ = this.$FH_.get(0);
        this.elemF1_ = this.$F1_.get(0);
        this.elemFP_ = this.$FP_.get(0);
        this.elemFN_ = this.$FN_.get(0);
        this.elemFC_ = this.$FC_.get(0);

        this.elemR_ = this.$R_.get(0);

        this._mz700js = mz700js;
        this.reg_upd_tid = null;

        this._visibility = false;
        this.visibility(true);

        this._isRunning = false;
        mz700js.subscribe("start", () => {
            if(!this._isRunning) {
                this._isRunning = true;
                if(this._visibility) {
                    this.autoUpdate(true);
                }
            }
        });
        mz700js.subscribe("stop", async () => {
            if(this._isRunning) {
                this._isRunning = false;
                if(this._visibility) {
                    this.autoUpdate(false);
                    const reg = await mz700js.getRegister();
                    await this.updateRegister(reg);
                }
            }
        });
    };

    Z80RegView.prototype.visibility = function (status) {
        if(this._visibility != status) {
            this._visibility = status;
            if(this._isRunning) {
                if(this._visibility) {
                    this.autoUpdate(true);
                } else {
                    this.autoUpdate(false);
                }
            }
        }
    };
    Z80RegView.prototype.autoUpdate = function (status) {
        if(status) {
            if(!this.reg_upd_tid) {
                this.reg_upd_tid = setInterval(async ()=>{
                    const reg = await this._mz700js.getRegister();
                    this.updateRegister(reg);
                }, 50);
            }
        } else {
            if(this.reg_upd_tid) {
                clearInterval(this.reg_upd_tid);
                this.reg_upd_tid = null;
            }
        }
    };

    Z80RegView.prototype.updateRegister = async function (reg) {
        this.update(reg);
        this.update_(reg._);
        this.IFF1(reg.IFF1);
        this.IFF2(reg.IFF2);
        this.IM(reg.IM);
        this.HALT(reg.HALT);
    };

    Z80RegView.prototype.update = function(reg) {
        this.elemB.innerHTML = NumberUtil.HEX(reg.B, 2);
        this.elemC.innerHTML = NumberUtil.HEX(reg.C, 2);
        this.elemD.innerHTML = NumberUtil.HEX(reg.D, 2);
        this.elemE.innerHTML = NumberUtil.HEX(reg.E, 2);
        this.elemH.innerHTML = NumberUtil.HEX(reg.H, 2);
        this.elemL.innerHTML = NumberUtil.HEX(reg.L, 2);
        this.elemA.innerHTML = NumberUtil.HEX(reg.A, 2);

        this.elemFS.innerHTML = (reg.F & 0x80) ? 1:0;
        this.elemFZ.innerHTML = (reg.F & 0x40) ? 1:0;
        this.elemF5.innerHTML = (reg.F & 0x20) ? 1:0;
        this.elemFH.innerHTML = (reg.F & 0x10) ? 1:0;
        this.elemF1.innerHTML = (reg.F & 0x08) ? 1:0;
        this.elemFP.innerHTML = (reg.F & 0x04) ? 1:0;
        this.elemFN.innerHTML = (reg.F & 0x02) ? 1:0;
        this.elemFC.innerHTML = (reg.F & 0x01) ? 1:0;

        this.elemPC.innerHTML = NumberUtil.HEX(reg.PC, 4);
        this.elemSP.innerHTML = NumberUtil.HEX(reg.SP, 4);
        this.elemIX.innerHTML = NumberUtil.HEX(reg.IX, 4);
        this.elemIY.innerHTML = NumberUtil.HEX(reg.IY, 4);
        this.elemI.innerHTML = NumberUtil.HEX(reg.I, 2);
        this.elemR.innerHTML = NumberUtil.HEX(reg.R, 2);
    };
    Z80RegView.prototype.update_ = function(reg_) {
        this.elemB_.innerHTML = NumberUtil.HEX(reg_.B, 2);
        this.elemC_.innerHTML = NumberUtil.HEX(reg_.C, 2);
        this.elemD_.innerHTML = NumberUtil.HEX(reg_.D, 2);
        this.elemE_.innerHTML = NumberUtil.HEX(reg_.E, 2);
        this.elemH_.innerHTML = NumberUtil.HEX(reg_.H, 2);
        this.elemL_.innerHTML = NumberUtil.HEX(reg_.L, 2);
        this.elemA_.innerHTML = NumberUtil.HEX(reg_.A, 2);

        this.elemFS_.innerHTML = (reg_.F & 0x80) ? 1:0;
        this.elemFZ_.innerHTML = (reg_.F & 0x40) ? 1:0;
        this.elemF5_.innerHTML = (reg_.F & 0x20) ? 1:0;
        this.elemFH_.innerHTML = (reg_.F & 0x10) ? 1:0;
        this.elemF1_.innerHTML = (reg_.F & 0x08) ? 1:0;
        this.elemFP_.innerHTML = (reg_.F & 0x04) ? 1:0;
        this.elemFN_.innerHTML = (reg_.F & 0x02) ? 1:0;
        this.elemFC_.innerHTML = (reg_.F & 0x01) ? 1:0;
        this.elemR_.innerHTML = NumberUtil.HEX(reg_.R, 2);
    };
    Z80RegView.prototype.IFF1 = function(iff1) {
        this.elemIFF1.innerHTML = iff1;
    };
    Z80RegView.prototype.IFF2 = function(iff2) {
        this.elemIFF2.innerHTML = iff2;
    };
    Z80RegView.prototype.IM = function(im) {
        this.elemIM.innerHTML = im;
    };
    Z80RegView.prototype.HALT = function(halt) {
        this.elemHALT.innerHTML = halt;
    };
}());
