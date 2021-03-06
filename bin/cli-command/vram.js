"use strict";
var CliCommand = require("./command");
var ansi = require('ansi-escape-sequences');
var style = {};
var fg = {};
var bg = {};
Object.keys(ansi.style).forEach(function(key) {
    var value = ansi.style[key];
    if(/^bg-/.test(key)) {
        bg[key.substr(3)] = value;
    } else {
        fg[key] = value;
    }
});
Object.keys(fg).forEach(function(key) {
    if( !(key in bg) ) {
        style[key] = fg[key];
        delete fg[key];
    }
});
var BgColor = [
    bg.black, bg.blue, bg.red, bg.magenta,
    bg.green, bg.cyan, bg.yellow, bg.white ];
var FgColor = [
    fg.black, fg.blue, fg.red, fg.magenta,
    fg.green, fg.cyan, fg.yellow, fg.white ];

const WIDE_CHAR = true;
const dispcodeCharset = WIDE_CHAR ? [
    [
        "・","Ａ","Ｂ","Ｃ","Ｄ","Ｅ","Ｆ","Ｇ","Ｈ","Ｉ","Ｊ","Ｋ","Ｌ","Ｍ","Ｎ","Ｏ",
        "Ｐ","Ｑ","Ｒ","Ｓ","Ｔ","Ｕ","Ｖ","Ｗ","Ｘ","Ｙ","Ｚ","┼─","└─","┘ ","├─","┴─",
        "０","１","２","３","４","５","６","７","８","９","－","＝","；","／","．","，",
        "──","│ ","└─","┘ ","──","│ ","──","│ ","──","│ ","──","│ ","──","│ ","──","│ ",
        "─→","全","＼","■ ","◆","←─","森","● ","○ ","？","○ ","┌─","─┐","＼","／","：",
        "↑ ","＜","［","心","］","＠","／","＞","│ ","＼","網","＼","┌─","┐ ","┤ ","┬─",
        "π ","！","” ","＃","＄","％","＆","’ ","（","）","＋","＊","／","× ","└─","┘ ",
        "──","│ ","┌─","┐ ","──","│ ","／","＼","──","│ ","──","│ ","──","│ ","──","│ ",
        "↓ ","チ","コ","ソ","シ","イ","ハ","キ","ク","ニ","マ","ノ","リ","モ","ミ","ラ",
        "セ","タ","ス","ト","カ","ナ","ヒ","テ","サ","ン","ツ","ロ","ケ","「","ア","ヤ",
        "ワ","ヌ","フ","ア","ウ","エ","オ","ヤ","ユ","ヨ","ホ","ヘ","レ","メ","ル","ネ",
        "ム","」","ィ","ュ","ヲ","、","ゥ","ョ","゜","．","ェ","ッ","゛","。","ォ","－",
        "↓ ","↓ ","↑ ","─→","←─","Ｈ","Ｃ","盤","車","画","人","＜","＞","Ｖ","∵","ツ",
        "日","月","火","水","木","金","土","生","年","時","分","秒","円","￥ ","㍀","～",
        "──","│ ","┼─","～","々","雨","〆","叶","札","Ｋ","Ｋ","＞","──","│ ","│ ","網",
        "　","田","田","田","田","田","田","田","田","田","田","田","田","田","田","田",
    ], [
        "・","ａ","ｂ","ｃ","ｄ","ｅ","ｆ","ｇ","ｈ","ｉ","ｊ","ｋ","ｌ","ｍ","ｎ","ｏ",
        "ｐ","ｑ","ｒ","ｓ","ｔ","ｕ","ｖ","ｗ","ｘ","ｙ","ｚ","┼─","└─","┘ ","├─","┴─",
        "０","１","２","３","４","５","６","７","８","９","－","＝","；","／","．","，",
        "──","│ ","└─","┘ ","──","│ ","──","│ ","──","│ ","──","│ ","──","│ ","──","│ ",
        "─→","全","＼","■ ","◆","←─","森","● ","○ ","？","○ ","┌─","─┐","＼","／","：",
        "↑ ","＜","［","心","］","＠","／","＞","│ ","＼","網","＼","┌─","─┐","┤ ","┬─",
        "π ","！","” ","＃","＄","％","＆","’ ","（","）","＋","＊","／","× ","└─","┘ ",
        "──","│ ","┌─","┐ ","──","│ ","／","＼","──","│ ","──","│ ","──","│ ","──","│ ",
        "↓ ","ち","こ","そ","し","い","は","き","く","に","ま","の","り","も","み","ら",
        "せ","た","す","と","か","な","ひ","て","さ","ん","つ","ろ","け","「","あ","や",
        "わ","ぬ","ふ","あ","う","え","お","や","ゆ","よ","ほ","へ","れ","め","る","ね",
        "む","」","ぃ","ゅ","を","、","ぅ","ょ","゜","．","ぇ","っ","゛","。","ぉ","－",
        "↓ ","↓ ","↑ ","─→","←─","Ｈ","Ｃ","盤","車","画","人","＜","＞","Ｖ","∵","ツ",
        "日","月","火","水","木","金","土","生","年","時","分","秒","円","￥ ","㍀","～",
        "──","│ ","┼─","～","々","雨","〆","叶","札","Ｋ","Ｋ","＞","──","│ ","│ ","網",
        "　","田","田","田","田","田","田","田","田","田","田","田","田","田","田","田",
    ],
] : [
    [
        "・","Ａ","Ｂ","Ｃ","Ｄ","Ｅ","Ｆ","Ｇ","Ｈ","Ｉ","Ｊ","Ｋ","Ｌ","Ｍ","Ｎ","Ｏ",
        "Ｐ","Ｑ","Ｒ","Ｓ","Ｔ","Ｕ","Ｖ","Ｗ","Ｘ","Ｙ","Ｚ","┼","└","┘","├","┴",
        "０","１","２","３","４","５","６","７","８","９","－","＝","；","／","．","，",
        "─","│","└","┘","─","│","─","│","─","│","─","│","─","│","─","│",
        "→","全","＼","■","◆","←","森","●","○","？","○","┌","┐","＼","／","：",
        "↑","＜","［","心","］","＠","／","＞","│","＼","網","＼","┌","┐","┤","┬",
        "π","！","”","＃","＄","％","＆","’","（","）","＋","＊","／","×","└","┘",
        "─","│","┌","┐","─","│","／","＼","─","│","─","│","─","│","─","│",
        "↓","チ","コ","ソ","シ","イ","ハ","キ","ク","ニ","マ","ノ","リ","モ","ミ","ラ",
        "セ","タ","ス","ト","カ","ナ","ヒ","テ","サ","ン","ツ","ロ","ケ","「","ア","ヤ",
        "ワ","ヌ","フ","ア","ウ","エ","オ","ヤ","ユ","ヨ","ホ","ヘ","レ","メ","ル","ネ",
        "ム","」","ィ","ュ","ヲ","、","ゥ","ョ","゜","．","ェ","ッ","゛","。","ォ","－",
        "↓","↓","↑","→","←","Ｈ","Ｃ","盤","車","画","人","＜","＞","Ｖ","∵","ツ",
        "日","月","火","水","木","金","土","生","年","時","分","秒","円","￥","㍀","～",
        "─","│","┼","～","々","雨","〆","叶","札","Ｋ","Ｋ","＞","─","│","│","網",
        "　","田","田","田","田","田","田","田","田","田","田","田","田","田","田","田",
    ], [
        "・","ａ","ｂ","ｃ","ｄ","ｅ","ｆ","ｇ","ｈ","ｉ","ｊ","ｋ","ｌ","ｍ","ｎ","ｏ",
        "ｐ","ｑ","ｒ","ｓ","ｔ","ｕ","ｖ","ｗ","ｘ","ｙ","ｚ","┼","└","┘","├","┴",
        "０","１","２","３","４","５","６","７","８","９","－","＝","；","／","．","，",
        "─","│","└","┘","─","│","─","│","─","│","─","│","─","│","─","│",
        "→","全","＼","■","◆","←","森","●","○","？","○","┌","┐","＼","／","：",
        "↑","＜","［","心","］","＠","／","＞","│","＼","網","＼","┌","┐","┤","┬",
        "π","！","”","＃","＄","％","＆","’","（","）","＋","＊","／","×","└","┘",
        "─","│","┌","┐","─","│","／","＼","─","│","─","│","─","│","─","│",
        "↓","ち","こ","そ","し","い","は","き","く","に","ま","の","り","も","み","ら",
        "せ","た","す","と","か","な","ひ","て","さ","ん","つ","ろ","け","「","あ","や",
        "わ","ぬ","ふ","あ","う","え","お","や","ゆ","よ","ほ","へ","れ","め","る","ね",
        "む","」","ぃ","ゅ","を","、","ぅ","ょ","゜","．","ぇ","っ","゛","。","ぉ","－",
        "↓","↓","↑","→","←","Ｈ","Ｃ","盤","車","画","人","＜","＞","Ｖ","∵","ツ",
        "日","月","火","水","木","金","土","生","年","時","分","秒","円","￥","㍀","～",
        "─","│","┼","～","々","雨","〆","叶","札","Ｋ","Ｋ","＞","─","│","│","網",
        " ","田","田","田","田","田","田","田","田","田","田","田","田","田","田","田",
    ],
];
var dispcodeToChar = function(dispcode, attr) {
    return dispcodeCharset[(attr & 0x80) ? 1:0][dispcode];
};

function CliCommandVram() {
    var i;
    this.vramText = new Array(1000);
    this.vramAttr = new Array(1000);
    for(i = 0; i < this.vramText.length; i++) {
        this.vramText[i] = 0;
    }
    for(i = 0; i < this.vramAttr.length; i++) {
        this.vramAttr[i] = 0x71;
    }
}

CliCommandVram.prototype = new CliCommand("vram", function(/* mz700, args */) {
    var index = 0;
    for(var row = 0; row < 25; row++) {
        var line = [];
        for(var col = 0; col < 40; col++) {
            var dispcode = this.vramText[index];
            var attr = this.vramAttr[index];
            var bgcolor = BgColor[(attr >> 0) & 0x07];
            var fgcolor = FgColor[(attr >> 4) & 0x07];
            var c = dispcodeToChar(dispcode, attr);
            line.push(bgcolor);
            line.push(fgcolor);
            line.push(c);
            line.push(style.reset);
            index++;
        }
        console.log(line.join(''));
    }
});
CliCommandVram.prototype.setAt = function(index, dispcode, attr) {
    this.vramText[index] = dispcode;
    this.vramAttr[index] = attr;
};
module.exports = (new CliCommandVram());
