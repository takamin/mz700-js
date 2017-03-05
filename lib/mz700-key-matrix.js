(function() {
    var KeyCodes = {
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
    var mzkey = function(strobe, bit, face, code, strcode) {
        this.strobe = strobe;
        this.bit = bit;
        this.face = face || "&nbsp;";
        this.code = code || [];
        this.strcode = strcode || face;
    }
    var Keys = [
        new mzkey(0,0,"CR",     [KeyCodes.Enter]),
        new mzkey(0,1,":",      [KeyCodes.Colon]),
        new mzkey(0,2,";",      [KeyCodes.SemiColon]),
        new mzkey(0,3),
        new mzkey(0,4,"英数",   [KeyCodes.F10, KeyCodes.End], "ALNUM"),
        new mzkey(0,5,"=",      [KeyCodes.Backspace]),
        new mzkey(0,6,"GRAPH",  [KeyCodes.F12, KeyCodes.PageDown, KeyCodes.Altername], "GRAPH"),
        new mzkey(0,7,"カナ",   [KeyCodes.F11, KeyCodes.PageUp], "KANA"),
        new mzkey(1,0),
        new mzkey(1,1),
        new mzkey(1,2),
        new mzkey(1,3,")",      [KeyCodes.CloseBrackets]),
        new mzkey(1,4,"(",      [KeyCodes.OpenBrackets]),
        new mzkey(1,5,"@",      [KeyCodes.Atmark]),
        new mzkey(1,6,"Z",      [KeyCodes.Z]),
        new mzkey(1,7,"Y",      [KeyCodes.Y]),
        new mzkey(2,0,"X",      [KeyCodes.X]),
        new mzkey(2,1,"W",      [KeyCodes.W]),
        new mzkey(2,2,"V",      [KeyCodes.V]),
        new mzkey(2,3,"U",      [KeyCodes.U]),
        new mzkey(2,4,"T",      [KeyCodes.T]),
        new mzkey(2,5,"S",      [KeyCodes.S]),
        new mzkey(2,6,"R",      [KeyCodes.R]),
        new mzkey(2,7,"Q",      [KeyCodes.Q]),
        new mzkey(3,0,"P",      [KeyCodes.P]),
        new mzkey(3,1,"O",      [KeyCodes.O]),
        new mzkey(3,2,"N",      [KeyCodes.N]),
        new mzkey(3,3,"M",      [KeyCodes.M]),
        new mzkey(3,4,"L",      [KeyCodes.L]),
        new mzkey(3,5,"K",      [KeyCodes.K]),
        new mzkey(3,6,"J",      [KeyCodes.J]),
        new mzkey(3,7,"I",      [KeyCodes.I]),
        new mzkey(4,0,"H",      [KeyCodes.H]),
        new mzkey(4,1,"G",      [KeyCodes.G]),
        new mzkey(4,2,"F",      [KeyCodes.F]),
        new mzkey(4,3,"E",      [KeyCodes.E]),
        new mzkey(4,4,"D",      [KeyCodes.D]),
        new mzkey(4,5,"C",      [KeyCodes.C]),
        new mzkey(4,6,"B",      [KeyCodes.B]),
        new mzkey(4,7,"A",      [KeyCodes.A]),
        new mzkey(5,0,"8",      [KeyCodes.D8, KeyCodes.NumPad8]),
        new mzkey(5,1,"7",      [KeyCodes.D7, KeyCodes.NumPad7]),
        new mzkey(5,2,"6",      [KeyCodes.D6, KeyCodes.NumPad6]),
        new mzkey(5,3,"5",      [KeyCodes.D5, KeyCodes.NumPad5]),
        new mzkey(5,4,"4",      [KeyCodes.D4, KeyCodes.NumPad4]),
        new mzkey(5,5,"3",      [KeyCodes.D3, KeyCodes.NumPad3]),
        new mzkey(5,6,"2",      [KeyCodes.D2, KeyCodes.NumPad2]),
        new mzkey(5,7,"1",      [KeyCodes.D1, KeyCodes.NumPad1]),
        new mzkey(6,0,".",      [KeyCodes.Decimal, 110]),
        new mzkey(6,1,",",      [KeyCodes.Comma]),
        new mzkey(6,2,"9",      [KeyCodes.D9, KeyCodes.NumPad9]),
        new mzkey(6,3,"0",      [KeyCodes.D0, KeyCodes.NumPad0]),
        new mzkey(6,4,"SPC",    [KeyCodes.Space], " "),
        new mzkey(6,5,"-",      [KeyCodes.Subtract, KeyCodes.NumPadSubtract]),
        new mzkey(6,6,"+",      [KeyCodes.Caret, KeyCodes.NumPadPlus]),
        new mzkey(6,7,"*",      [KeyCodes.Yen, KeyCodes.NumPadMultiply]),
        new mzkey(7,0,"/",      [KeyCodes.Divide, KeyCodes.NumPadDivide]),
        new mzkey(7,1,"?",      [KeyCodes.Backslash]),
        new mzkey(7,2,"←",     [KeyCodes.Left], "LEFT"),
        new mzkey(7,3,"→",     [KeyCodes.Right], "RIGHT"),
        new mzkey(7,4,"↓",     [KeyCodes.Down], "DOWN"),
        new mzkey(7,5,"↑",     [KeyCodes.Up], "UP"),
        new mzkey(7,6,"DEL",    [KeyCodes.Delete]),
        new mzkey(7,7,"INS",    [KeyCodes.Insert]),
        new mzkey(8,0,"SHIFT",  [KeyCodes.Shift]),
        new mzkey(8,1,"(BS)"),
        new mzkey(8,2),
        new mzkey(8,3,"(→)",   [KeyCodes.Tab]),
        new mzkey(8,4,"(CR)"),
        new mzkey(8,5,"(SHIFT)"),
        new mzkey(8,6,"CTRL",   [KeyCodes.Control]),
        new mzkey(8,7,"BREAK",  [KeyCodes.Escape,KeyCodes.Pause]),
        new mzkey(9,0,"HOME",   [KeyCodes.Home]),
        new mzkey(9,1,"(SPC)"),
        new mzkey(9,2,"(↓)"),
        new mzkey(9,3,"F5",     [KeyCodes.F5]),
        new mzkey(9,4,"F4",     [KeyCodes.F4]),
        new mzkey(9,5,"F3",     [KeyCodes.F3]),
        new mzkey(9,6,"F2",     [KeyCodes.F2]),
        new mzkey(9,7,"F1",     [KeyCodes.F1])
    ];
    var KeyNames = (function(obj) {
        Object.keys(KeyCodes).forEach(function(name) {
            var code = KeyCodes[name];
            obj[code] = name;
        });
        return obj;
    }({}));
    var Code2Key = (function() {
        var code2key = new Array(256);
        Keys.forEach(function(key) {
            key.code.forEach(function(code) {
                code2key[code] = key;
            });
        });
        return code2key;
    })();
    var Str2Key = (function() {
        var s2key = {};
        Keys.forEach(function(key) {
            s2key[key.strcode] = key;
        });
        return s2key;
    })();
    module.exports = {
        KeyCodes: KeyCodes,
        KeyNames: KeyNames,
        Keys: Keys,
        Code2Key: Code2Key,
        Str2Key: Str2Key
    };
}());
