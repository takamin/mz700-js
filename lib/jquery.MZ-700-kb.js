jquery_plugin_class("mz700keyboard");
function mz700keyboard(element) {
    this.element = element;
    $(this.element).addClass("mz700keymatrix")
}
mz700keyboard.keys = [
    // strobe 0
    /* bit0 */{ key:"CR", alt:"[enter]" },
    /* bit1 */{ key:":", alt:"" },
    /* bit2 */{ key:";", alt:"" },
    /* bit3 */{ key:"&nbsp;", alt:"" },
    /* bit4 */{ key:"英数", alt:"[F10]/[home]" },
    /* bit5 */{ key:"=", alt:"[backspace]" },
    /* bit6 */{ key:"GRAPH", alt:"[F12]/[pg dn]" },
    /* bit7 */{ key:"カナ", alt:"[F11]/[pg up]" },
    // strobe 1
    /* bit0 */{ key:"&nbsp;", alt:"" },
    /* bit1 */{ key:"&nbsp;", alt:"" },
    /* bit2 */{ key:"&nbsp;", alt:"" },
    /* bit3 */{ key:")", alt:"]" },
    /* bit4 */{ key:"(", alt:"[" },
    /* bit5 */{ key:"@", alt:"" },
    /* bit6 */{ key:"Z", alt:"" },
    /* bit7 */{ key:"Y", alt:"" },
    // strobe 2
    /* bit0 */{ key:"X", alt:"" },
    /* bit1 */{ key:"W", alt:"" },
    /* bit2 */{ key:"V", alt:"" },
    /* bit3 */{ key:"U", alt:"" },
    /* bit4 */{ key:"T", alt:"" },
    /* bit5 */{ key:"S", alt:"" },
    /* bit6 */{ key:"R", alt:"" },
    /* bit7 */{ key:"Q", alt:"" },
    // strobe 3
    /* bit0 */{ key:"P", alt:"" },
    /* bit1 */{ key:"O", alt:"" },
    /* bit2 */{ key:"N", alt:"" },
    /* bit3 */{ key:"M", alt:"" },
    /* bit4 */{ key:"L", alt:"" },
    /* bit5 */{ key:"K", alt:"" },
    /* bit6 */{ key:"J", alt:"" },
    /* bit7 */{ key:"I", alt:"" },
    // strobe 4
    /* bit0 */{ key:"H", alt:"" },
    /* bit1 */{ key:"G", alt:"" },
    /* bit2 */{ key:"F", alt:"" },
    /* bit3 */{ key:"E", alt:"" },
    /* bit4 */{ key:"D", alt:"" },
    /* bit5 */{ key:"C", alt:"" },
    /* bit6 */{ key:"B", alt:"" },
    /* bit7 */{ key:"A", alt:"" },
    // strobe 5
    /* bit0 */{ key:"8", alt:"" },
    /* bit1 */{ key:"7", alt:"" },
    /* bit2 */{ key:"6", alt:"" },
    /* bit3 */{ key:"5", alt:"" },
    /* bit4 */{ key:"4", alt:"" },
    /* bit5 */{ key:"3", alt:"" },
    /* bit6 */{ key:"2", alt:"" },
    /* bit7 */{ key:"1", alt:"" },
    // strobe 6
    /* bit0 */{ key:".", alt:"" },
    /* bit1 */{ key:",", alt:"" },
    /* bit2 */{ key:"9", alt:"" },
    /* bit3 */{ key:"0", alt:"" },
    /* bit4 */{ key:"SP", alt:"" },
    /* bit5 */{ key:"-", alt:"" },
    /* bit6 */{ key:"+", alt:"^" },
    /* bit7 */{ key:"*", alt:"メインキーボード上段右端[\\/|]" },
    // strobe 7
    /* bit0 */{ key:"/", alt:"" },
    /* bit1 */{ key:"?", alt:"メインキーボード下段右端[\\/_](バックスラッシュ)" },
    /* bit2 */{ key:"←", alt:"" },
    /* bit3 */{ key:"→", alt:"" },
    /* bit4 */{ key:"↓", alt:"" },
    /* bit5 */{ key:"↑", alt:"" },
    /* bit6 */{ key:"DEL", alt:"[delete]" },
    /* bit7 */{ key:"INS", alt:"[insert]" },
    // strobe 8
    /* bit0 */{ key:"SHIFT", alt:"[shift]" },
    /* bit1 */{ key:"(BS?)", alt:"" },
    /* bit2 */{ key:"&nbsp;", alt:"" },
    /* bit3 */{ key:"(→?)", alt:"" },
    /* bit4 */{ key:"(CR?)", alt:"" },
    /* bit5 */{ key:"(SHIFT?)", alt:"" },
    /* bit6 */{ key:"CTRL", alt:"[ctrl]" },
    /* bit7 */{ key:"BREAK", alt:"[esc]/[end]/[pause/break]" },
    // strobe 9
    /* bit0 */{ key:"(HOME?)", alt:"" },
    /* bit1 */{ key:"(SP?)", alt:"" },
    /* bit2 */{ key:"(↓?)&nbsp;", alt:"" },
    /* bit3 */{ key:"F5", alt:"" },
    /* bit4 */{ key:"F4", alt:"" },
    /* bit5 */{ key:"F3", alt:"" },
    /* bit6 */{ key:"F2", alt:"" },
    /* bit7 */{ key:"F1", alt:"" }
];

mz700keyboard.prototype.create = function(opt) {
    // input keys sample implementation
    this.keyCodeMapAddress = new Array(256);
    for(var i = 0; i < this.keyCodeMapAddress.length; i++) {
        this.keyCodeMapAddress[i] = null;
    }
    this.keyCodeMapAddress[13]  = {strobe:0, bit:0 };// CR - Enter
    this.keyCodeMapAddress[186] = {strobe:0, bit:1 };// :
    this.keyCodeMapAddress[187] = {strobe:0, bit:2 };// ;
    this.keyCodeMapAddress[36]  = {strobe:0, bit:4 };// 英数 - home
    this.keyCodeMapAddress[8]   = {strobe:0, bit:5 };// = - backspace
    this.keyCodeMapAddress[34]  = {strobe:0, bit:6 };// GRPH - pg dn
    this.keyCodeMapAddress[33]  = {strobe:0, bit:7 };// カナ - pg up
    this.keyCodeMapAddress[121] = {strobe:0, bit:4 };// 英数 - F10
    this.keyCodeMapAddress[122] = {strobe:0, bit:7 };// カナ - F11
    this.keyCodeMapAddress[123] = {strobe:0, bit:6 };// GRPH - F12


    this.keyCodeMapAddress[221] = {strobe:1, bit:3 };// ) - ]
    this.keyCodeMapAddress[219] = {strobe:1, bit:4 };// ( - [
    this.keyCodeMapAddress[192] = {strobe:1, bit:5 };// @
    this.keyCodeMapAddress[90]  = {strobe:1, bit:6 };// Z
    this.keyCodeMapAddress[89]  = {strobe:1, bit:7 };// Y

    this.keyCodeMapAddress[88] = {strobe:2, bit:0 };// X
    this.keyCodeMapAddress[87] = {strobe:2, bit:1 };// W
    this.keyCodeMapAddress[86] = {strobe:2, bit:2 };// V
    this.keyCodeMapAddress[85] = {strobe:2, bit:3 };// U
    this.keyCodeMapAddress[84] = {strobe:2, bit:4 };// T
    this.keyCodeMapAddress[83] = {strobe:2, bit:5 };// S
    this.keyCodeMapAddress[82] = {strobe:2, bit:6 };// R
    this.keyCodeMapAddress[81] = {strobe:2, bit:7 };// Q

    this.keyCodeMapAddress[80] = {strobe:3, bit:0 };// P
    this.keyCodeMapAddress[79] = {strobe:3, bit:1 };// O
    this.keyCodeMapAddress[78] = {strobe:3, bit:2 };// N
    this.keyCodeMapAddress[77] = {strobe:3, bit:3 };// M
    this.keyCodeMapAddress[76] = {strobe:3, bit:4 };// L
    this.keyCodeMapAddress[75] = {strobe:3, bit:5 };// K
    this.keyCodeMapAddress[74] = {strobe:3, bit:6 };// J
    this.keyCodeMapAddress[73] = {strobe:3, bit:7 };// I

    this.keyCodeMapAddress[72] = {strobe:4, bit:0 };// H
    this.keyCodeMapAddress[71] = {strobe:4, bit:1 };// G
    this.keyCodeMapAddress[70] = {strobe:4, bit:2 };// F
    this.keyCodeMapAddress[69] = {strobe:4, bit:3 };// E
    this.keyCodeMapAddress[68] = {strobe:4, bit:4 };// D
    this.keyCodeMapAddress[67] = {strobe:4, bit:5 };// C
    this.keyCodeMapAddress[66] = {strobe:4, bit:6 };// B
    this.keyCodeMapAddress[65] = {strobe:4, bit:7 };// A

    this.keyCodeMapAddress[56] = {strobe:5, bit:0 };// 8
    this.keyCodeMapAddress[55] = {strobe:5, bit:1 };// 7
    this.keyCodeMapAddress[54] = {strobe:5, bit:2 };// 6
    this.keyCodeMapAddress[53] = {strobe:5, bit:3 };// 5
    this.keyCodeMapAddress[52] = {strobe:5, bit:4 };// 4
    this.keyCodeMapAddress[51] = {strobe:5, bit:5 };// 3
    this.keyCodeMapAddress[50] = {strobe:5, bit:6 };// 2
    this.keyCodeMapAddress[49] = {strobe:5, bit:7 };// 1
    this.keyCodeMapAddress[104] = {strobe:5, bit:0 };// 8 on tenkey
    this.keyCodeMapAddress[103] = {strobe:5, bit:1 };// 7 on tenkey
    this.keyCodeMapAddress[102] = {strobe:5, bit:2 };// 6 on tenkey
    this.keyCodeMapAddress[101] = {strobe:5, bit:3 };// 5 on tenkey
    this.keyCodeMapAddress[100] = {strobe:5, bit:4 };// 4 on tenkey
    this.keyCodeMapAddress[99]  = {strobe:5, bit:5 };// 3 on tenkey
    this.keyCodeMapAddress[98]  = {strobe:5, bit:6 };// 2 on tenkey
    this.keyCodeMapAddress[97]  = {strobe:5, bit:7 };// 1 on tenkey

    this.keyCodeMapAddress[190] = {strobe:6, bit:0 };// .
    this.keyCodeMapAddress[110] = {strobe:6, bit:0 };// . on tenkey
    this.keyCodeMapAddress[188] = {strobe:6, bit:1 };// ,
    this.keyCodeMapAddress[57]  = {strobe:6, bit:2 };// 9
    this.keyCodeMapAddress[48]  = {strobe:6, bit:3 };// 0
    this.keyCodeMapAddress[105] = {strobe:6, bit:2 };// 9 on tenkey
    this.keyCodeMapAddress[96]  = {strobe:6, bit:3 };// 0 on tenkey
    this.keyCodeMapAddress[32]  = {strobe:6, bit:4 };// [spc]
    this.keyCodeMapAddress[109] = {strobe:6, bit:5 };// - on ten key
    this.keyCodeMapAddress[107] = {strobe:6, bit:6 };// + on ten key
    this.keyCodeMapAddress[106] = {strobe:6, bit:7 };// * on ten key
    this.keyCodeMapAddress[189] = {strobe:6, bit:5 };// -
    this.keyCodeMapAddress[222] = {strobe:6, bit:6 };// + ^
    this.keyCodeMapAddress[220] = {strobe:6, bit:7 };// * \/|

    this.keyCodeMapAddress[111] = {strobe:7, bit:0 };// / - / on ten key
    this.keyCodeMapAddress[191] = {strobe:7, bit:0 };// / - /
    this.keyCodeMapAddress[226] = {strobe:7, bit:1 };// ? - \/_
    this.keyCodeMapAddress[37]  = {strobe:7, bit:2 };// ←
    this.keyCodeMapAddress[39]  = {strobe:7, bit:3 };// →
    this.keyCodeMapAddress[40]  = {strobe:7, bit:4 };// ↓
    this.keyCodeMapAddress[38]  = {strobe:7, bit:5 };// ↑
    this.keyCodeMapAddress[46]  = {strobe:7, bit:6 };// DEL - delete
    this.keyCodeMapAddress[45]  = {strobe:7, bit:7 };// INS - insert

    this.keyCodeMapAddress[16] = {strobe:8, bit:0 };// SHIFT - Shift
    this.keyCodeMapAddress[17] = {strobe:8, bit:6 };// Ctrl - Ctrl
    this.keyCodeMapAddress[19] = {strobe:8, bit:7 };// BREAK - break / pause
    this.keyCodeMapAddress[27]  = {strobe:8, bit:7 };// BREAK - esc
    this.keyCodeMapAddress[35]  = {strobe:8, bit:7 };// BREAK - end

    this.keyCodeMapAddress[116] = {strobe:9, bit:3 };// F5
    this.keyCodeMapAddress[115] = {strobe:9, bit:4 };// F4
    this.keyCodeMapAddress[114] = {strobe:9, bit:5 };// F3
    this.keyCodeMapAddress[113] = {strobe:9, bit:6 };// F2
    this.keyCodeMapAddress[112] = {strobe:9, bit:7 };// F1

    var $container = $(this.element);
    for(var bit = 7; bit >= 0; bit--) {
        for(var strobe = 0; strobe < 10; strobe++) {
            var index = strobe * 8 + bit;
            var $key = $("<span/>").addClass("button")
                .addClass("matrix-" + strobe + "-" + bit)
                .html(mz700keyboard.keys[index].key)
                .mousedown(function(s,b, obj) { return function() {
                    opt.onStateChange(s, b, true);
                    obj.setState(s, b, true);
                }}(strobe, bit, this))
                .mouseup(function(s,b, obj) { return function() {
                    opt.onStateChange(s, b, false);
                    obj.setState(s, b, false);
                }}(strobe, bit, this));
            $container.append($key);
        }
        $container.append($("<br/>"));
    }
};
mz700keyboard.prototype.getMatPos =  function(code, state) {
    return this.keyCodeMapAddress[code];
}
mz700keyboard.prototype.setState = function(strobe, bit, state) {
    var $key = $(this.element).find(".matrix-" + strobe + "-" + bit);
    if(state) {
        $key.addClass("push");
    } else {
        $key.removeClass("push");
    }
};
