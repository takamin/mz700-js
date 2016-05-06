jquery_plugin_class("Z80RegView");
function Z80RegView(element) {
    this.element = element;
}
Z80RegView.prototype.init = function(opt) {
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
            .append($("<div/>").addClass("register wide")
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
            .append($("<div/>").addClass("register wide")
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
};
Z80RegView.prototype.update = function(reg) {
    this.elemB.innerHTML = reg.B.HEX(2);
    this.elemC.innerHTML = reg.C.HEX(2);
    this.elemD.innerHTML = reg.D.HEX(2);
    this.elemE.innerHTML = reg.E.HEX(2);
    this.elemH.innerHTML = reg.H.HEX(2);
    this.elemL.innerHTML = reg.L.HEX(2);
    this.elemA.innerHTML = reg.A.HEX(2);

    this.elemFS.innerHTML = (reg.F & 0x80) ? 1:0;
    this.elemFZ.innerHTML = (reg.F & 0x40) ? 1:0;
    this.elemF5.innerHTML = (reg.F & 0x20) ? 1:0;
    this.elemFH.innerHTML = (reg.F & 0x10) ? 1:0;
    this.elemF1.innerHTML = (reg.F & 0x08) ? 1:0;
    this.elemFP.innerHTML = (reg.F & 0x04) ? 1:0;
    this.elemFN.innerHTML = (reg.F & 0x02) ? 1:0;
    this.elemFC.innerHTML = (reg.F & 0x01) ? 1:0;

    this.elemPC.innerHTML = reg.PC.HEX(4);
    this.elemSP.innerHTML = reg.SP.HEX(4);
    this.elemIX.innerHTML = reg.IX.HEX(4);
    this.elemIY.innerHTML = reg.IY.HEX(4);
    this.elemI.innerHTML = reg.I.HEX(2);
    this.elemR.innerHTML = reg.R.HEX(2);
};
Z80RegView.prototype.update_ = function(reg_) {
    this.elemB_.innerHTML = reg_.B.HEX(2);
    this.elemC_.innerHTML = reg_.C.HEX(2);
    this.elemD_.innerHTML = reg_.D.HEX(2);
    this.elemE_.innerHTML = reg_.E.HEX(2);
    this.elemH_.innerHTML = reg_.H.HEX(2);
    this.elemL_.innerHTML = reg_.L.HEX(2);
    this.elemA_.innerHTML = reg_.A.HEX(2);

    this.elemFS_.innerHTML = (reg_.F & 0x80) ? 1:0;
    this.elemFZ_.innerHTML = (reg_.F & 0x40) ? 1:0;
    this.elemF5_.innerHTML = (reg_.F & 0x20) ? 1:0;
    this.elemFH_.innerHTML = (reg_.F & 0x10) ? 1:0;
    this.elemF1_.innerHTML = (reg_.F & 0x08) ? 1:0;
    this.elemFP_.innerHTML = (reg_.F & 0x04) ? 1:0;
    this.elemFN_.innerHTML = (reg_.F & 0x02) ? 1:0;
    this.elemFC_.innerHTML = (reg_.F & 0x01) ? 1:0;
    this.elemR_.innerHTML = reg_.R.HEX(2);
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
