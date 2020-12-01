"use strict";

class mzkey {
    strobe;
    bit;
    face;
    code;
    strcode;
    constructor(strobe, bit, face?, code?, strcode?) {
        this.strobe = strobe;
        this.bit = bit;
        this.face = face || "&nbsp;";
        this.code = code || [];
        this.strcode = strcode || face;
    }
}

//
// MZ-700 Key Matrix
//
export default class MZ700KeyMatrix {
    keymap;
    constructor() {
        this.keymap = new Array(10);
        for (var i = 0; i < this.keymap.length; i++) {
            this.keymap[i] = 0xff;
        }
    }
    getKeyData(strobe) {
        var keydata = 0xff;
        strobe &= 0x0f;
        if (strobe < this.keymap.length) {
            keydata = this.keymap[strobe];
        }
        return keydata;
    }
    setKeyMatrixState(strobe, bit, state) {
        if (state) {
            // clear bit
            this.keymap[strobe] &= ((~(1 << bit)) & 0xff);
        } else {
            // set bit
            this.keymap[strobe] |= ((1 << bit) & 0xff);
        }
    }
    static KeyCodes = {
        "Escape"    : 27,
        "F1"  : 112, "F2"  : 113, "F3"  : 114, "F4"  : 115, "F5"  : 116,
        "F6"  : 117, "F7"  : 118, "F8"  : 119, "F9"  : 120, "F10" : 121,
        "F11" : 122, "F12" : 123,

        "Numlock" : 44,
        "ScrollLock" : 145,
        "Pause" : 19,

        "D0" : 48, "D1" : 49, "D2" : 50, "D3" : 51, "D4" : 52,
        "D5" : 53, "D6" : 54, "D7" : 55, "D8" : 56, "D9" : 57,

        "A" : 65, "B" : 66, "C" : 67, "D" : 68, "E" : 69, "F" : 70, "G" : 71,
        "H" : 72, "I" : 73, "J" : 74, "K" : 75, "L" : 76, "M" : 77, "N" : 78,
        "O" : 79, "P" : 80, "Q" : 81, "R" : 82, "S" : 83, "T" : 84, "U" : 85,
        "V" : 86, "W" : 87, "X" : 88, "Y" : 89, "Z" : 90,

        "Subtract"  : 109,
        "Caret"     : 107,
        "Atmark"    : 192,
        "Yen"       : 106,
        "Colon"     : 186,
        "SemiColon" : 187,
        "Comma"     : 188,
        "Decimal"   : 190,
        "Divide"    : 111,
        "Backslash" : 226,
        "OpenBrackets"  : 219,
        "CloseBrackets" : 221,

        "Shift"     : 16,
        "Control"   : 17,
        "Alternate" : 18,
        "Enter"     : 13,
        "Tab"       : 9,
        "Space"     : 32,
        "Backspace" : 8,

        "Insert"    : 45,
        "Delete"    : 46,
        "Home"      : 36,
        "End"       : 35,
        "PageUp"    : 33,
        "PageDown"  : 34,

        "Left"  : 37,
        "Up"    : 38,
        "Right" : 39,
        "Down"  : 40,

        "NumPad0" : 96,
        "NumPad1" : 97,
        "NumPad2" : 98,
        "NumPad3" : 99,
        "NumPad4" : 100,
        "NumPad5" : 101,
        "NumPad6" : 102,
        "NumPad7" : 103,
        "NumPad8" : 104,
        "NumPad9" : 105,

        "NumPadDivide"      : 191,
        "NumPadMultiply"    : 220,
        "NumPadSubtract"    : 189,
        "NumPadPlus"        : 222,
        "NumPadDecimal"     : 110,

        "Hankaku"   : 243,
        "Zenkaku"   : 244
    };
    static Keys = [
        new mzkey(0,0,"CR",     [MZ700KeyMatrix.KeyCodes.Enter]),
        new mzkey(0,1,":",      [MZ700KeyMatrix.KeyCodes.Colon]),
        new mzkey(0,2,";",      [MZ700KeyMatrix.KeyCodes.SemiColon]),
        new mzkey(0,3),
        new mzkey(0,4,"英数",   [MZ700KeyMatrix.KeyCodes.F10, MZ700KeyMatrix.KeyCodes.End], "ALNUM"),
        new mzkey(0,5,"=",      [MZ700KeyMatrix.KeyCodes.Backspace]),
        new mzkey(0,6,"GRAPH",  [MZ700KeyMatrix.KeyCodes.F12, MZ700KeyMatrix.KeyCodes.PageDown, MZ700KeyMatrix.KeyCodes.Alternate], "GRAPH"),
        new mzkey(0,7,"カナ",   [MZ700KeyMatrix.KeyCodes.F11, MZ700KeyMatrix.KeyCodes.PageUp], "KANA"),
        new mzkey(1,0),
        new mzkey(1,1),
        new mzkey(1,2),
        new mzkey(1,3,")",      [MZ700KeyMatrix.KeyCodes.CloseBrackets]),
        new mzkey(1,4,"(",      [MZ700KeyMatrix.KeyCodes.OpenBrackets]),
        new mzkey(1,5,"@",      [MZ700KeyMatrix.KeyCodes.Atmark]),
        new mzkey(1,6,"Z",      [MZ700KeyMatrix.KeyCodes.Z]),
        new mzkey(1,7,"Y",      [MZ700KeyMatrix.KeyCodes.Y]),
        new mzkey(2,0,"X",      [MZ700KeyMatrix.KeyCodes.X]),
        new mzkey(2,1,"W",      [MZ700KeyMatrix.KeyCodes.W]),
        new mzkey(2,2,"V",      [MZ700KeyMatrix.KeyCodes.V]),
        new mzkey(2,3,"U",      [MZ700KeyMatrix.KeyCodes.U]),
        new mzkey(2,4,"T",      [MZ700KeyMatrix.KeyCodes.T]),
        new mzkey(2,5,"S",      [MZ700KeyMatrix.KeyCodes.S]),
        new mzkey(2,6,"R",      [MZ700KeyMatrix.KeyCodes.R]),
        new mzkey(2,7,"Q",      [MZ700KeyMatrix.KeyCodes.Q]),
        new mzkey(3,0,"P",      [MZ700KeyMatrix.KeyCodes.P]),
        new mzkey(3,1,"O",      [MZ700KeyMatrix.KeyCodes.O]),
        new mzkey(3,2,"N",      [MZ700KeyMatrix.KeyCodes.N]),
        new mzkey(3,3,"M",      [MZ700KeyMatrix.KeyCodes.M]),
        new mzkey(3,4,"L",      [MZ700KeyMatrix.KeyCodes.L]),
        new mzkey(3,5,"K",      [MZ700KeyMatrix.KeyCodes.K]),
        new mzkey(3,6,"J",      [MZ700KeyMatrix.KeyCodes.J]),
        new mzkey(3,7,"I",      [MZ700KeyMatrix.KeyCodes.I]),
        new mzkey(4,0,"H",      [MZ700KeyMatrix.KeyCodes.H]),
        new mzkey(4,1,"G",      [MZ700KeyMatrix.KeyCodes.G]),
        new mzkey(4,2,"F",      [MZ700KeyMatrix.KeyCodes.F]),
        new mzkey(4,3,"E",      [MZ700KeyMatrix.KeyCodes.E]),
        new mzkey(4,4,"D",      [MZ700KeyMatrix.KeyCodes.D]),
        new mzkey(4,5,"C",      [MZ700KeyMatrix.KeyCodes.C]),
        new mzkey(4,6,"B",      [MZ700KeyMatrix.KeyCodes.B]),
        new mzkey(4,7,"A",      [MZ700KeyMatrix.KeyCodes.A]),
        new mzkey(5,0,"8",      [MZ700KeyMatrix.KeyCodes.D8, MZ700KeyMatrix.KeyCodes.NumPad8]),
        new mzkey(5,1,"7",      [MZ700KeyMatrix.KeyCodes.D7, MZ700KeyMatrix.KeyCodes.NumPad7]),
        new mzkey(5,2,"6",      [MZ700KeyMatrix.KeyCodes.D6, MZ700KeyMatrix.KeyCodes.NumPad6]),
        new mzkey(5,3,"5",      [MZ700KeyMatrix.KeyCodes.D5, MZ700KeyMatrix.KeyCodes.NumPad5]),
        new mzkey(5,4,"4",      [MZ700KeyMatrix.KeyCodes.D4, MZ700KeyMatrix.KeyCodes.NumPad4]),
        new mzkey(5,5,"3",      [MZ700KeyMatrix.KeyCodes.D3, MZ700KeyMatrix.KeyCodes.NumPad3]),
        new mzkey(5,6,"2",      [MZ700KeyMatrix.KeyCodes.D2, MZ700KeyMatrix.KeyCodes.NumPad2]),
        new mzkey(5,7,"1",      [MZ700KeyMatrix.KeyCodes.D1, MZ700KeyMatrix.KeyCodes.NumPad1]),
        new mzkey(6,0,".",      [MZ700KeyMatrix.KeyCodes.Decimal, 110]),
        new mzkey(6,1,",",      [MZ700KeyMatrix.KeyCodes.Comma]),
        new mzkey(6,2,"9",      [MZ700KeyMatrix.KeyCodes.D9, MZ700KeyMatrix.KeyCodes.NumPad9]),
        new mzkey(6,3,"0",      [MZ700KeyMatrix.KeyCodes.D0, MZ700KeyMatrix.KeyCodes.NumPad0]),
        new mzkey(6,4,"SPC",    [MZ700KeyMatrix.KeyCodes.Space], " "),
        new mzkey(6,5,"-",      [MZ700KeyMatrix.KeyCodes.Subtract, MZ700KeyMatrix.KeyCodes.NumPadSubtract]),
        new mzkey(6,6,"+",      [MZ700KeyMatrix.KeyCodes.Caret, MZ700KeyMatrix.KeyCodes.NumPadPlus]),
        new mzkey(6,7,"*",      [MZ700KeyMatrix.KeyCodes.Yen, MZ700KeyMatrix.KeyCodes.NumPadMultiply]),
        new mzkey(7,0,"/",      [MZ700KeyMatrix.KeyCodes.Divide, MZ700KeyMatrix.KeyCodes.NumPadDivide]),
        new mzkey(7,1,"?",      [MZ700KeyMatrix.KeyCodes.Backslash]),
        new mzkey(7,2,"←",     [MZ700KeyMatrix.KeyCodes.Left], "LEFT"),
        new mzkey(7,3,"→",     [MZ700KeyMatrix.KeyCodes.Right], "RIGHT"),
        new mzkey(7,4,"↓",     [MZ700KeyMatrix.KeyCodes.Down], "DOWN"),
        new mzkey(7,5,"↑",     [MZ700KeyMatrix.KeyCodes.Up], "UP"),
        new mzkey(7,6,"DEL",    [MZ700KeyMatrix.KeyCodes.Delete]),
        new mzkey(7,7,"INS",    [MZ700KeyMatrix.KeyCodes.Insert]),
        new mzkey(8,0,"SHIFT",  [MZ700KeyMatrix.KeyCodes.Shift]),
        new mzkey(8,1,"(BS)"),
        new mzkey(8,2),
        new mzkey(8,3,"(→)",   [MZ700KeyMatrix.KeyCodes.Tab]),
        new mzkey(8,4,"(CR)"),
        new mzkey(8,5,"(SHIFT)"),
        new mzkey(8,6,"CTRL",   [MZ700KeyMatrix.KeyCodes.Control]),
        new mzkey(8,7,"BREAK",  [MZ700KeyMatrix.KeyCodes.Escape,MZ700KeyMatrix.KeyCodes.Pause]),
        new mzkey(9,0,"HOME",   [MZ700KeyMatrix.KeyCodes.Home]),
        new mzkey(9,1,"(SPC)"),
        new mzkey(9,2,"(↓)"),
        new mzkey(9,3,"F5",     [MZ700KeyMatrix.KeyCodes.F5]),
        new mzkey(9,4,"F4",     [MZ700KeyMatrix.KeyCodes.F4]),
        new mzkey(9,5,"F3",     [MZ700KeyMatrix.KeyCodes.F3]),
        new mzkey(9,6,"F2",     [MZ700KeyMatrix.KeyCodes.F2]),
        new mzkey(9,7,"F1",     [MZ700KeyMatrix.KeyCodes.F1])
    ];
    static KeyNames = (function(obj) {
        Object.keys(MZ700KeyMatrix.KeyCodes).forEach(function(name) {
            var code = MZ700KeyMatrix.KeyCodes[name];
            obj[code] = name;
        });
        return obj;
    }({}));
    static Code2Key = (function() {
        var code2key = new Array(256);
        MZ700KeyMatrix.Keys.forEach(function(key) {
            key.code.forEach(function(code) {
                code2key[code] = key;
            });
        });
        return code2key;
    })();
    static Str2Key = (function() {
        var s2key = {};
        MZ700KeyMatrix.Keys.forEach(function(key) {
            s2key[key.strcode] = key;
        });
        return s2key;
    })();
}

module.exports = MZ700KeyMatrix;
