(function(){
    "use strict";
    var CliCommand = require("../lib/cli-command");
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

    var dispcodeCharset = [
        "・ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯ" +
        "ＰＱＲＳＴＵＶＷＸＹＺ┼└┘├┴" +
        "０１２３４５６７８９－＝；／．，" +
        "─│└┘─│─│─│─│─│─│" +
        "→全＼■◆←森●○？○┌┐＼／：" +
        "↑＜［心］＠／＞│＼網＼┌┐┤┬" +
        "π！”＃＄％＆’（）＋＊／×└┘" +
        "─│┌┐─│／＼─│─│─│─│" +
        "↓チコソシイハキクニマノリモミラ" +
        "セタストカナヒテサンツロケ「アヤ" +
        "ワヌフアウエオヤユヨホヘレメルネ" +
        "ム」ィュヲ、ゥョ゜．ェッ゛。ォ－" +
        "↓↓↑→←ＨＣ盤車画人＜＞Ｖ∵ツ" +
        "日月火水木金土生年時分秒円￥㍀～" +
        "─│┼～々雨〆叶札ＫＫ＞─││網" +
        "　田田田田田田田田田田田田田田田",

        "・ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏ" +
        "ｐｑｒｓｔｕｖｗｘｙｚ┼└┘├┴" +
        "０１２３４５６７８９－＝；／．，" +
        "─│└┘─│─│─│─│─│─│" +
        "→全＼■◆←森●○？○┌┐＼／：" +
        "↑＜［心］＠／＞│＼網＼┌┐┤┬" +
        "π！”＃＄％＆’（）＋＊／×└┘" +
        "─│┌┐─│／＼─│─│─│─│" +
        "↓ちこそしいはきくにまのりもみら" +
        "せたすとかなひてさんつろけ「あや" +
        "わぬふあうえおやゆよほへれめるね" +
        "む」ぃゅを、ぅょ゜．ぇっ゛。ぉ－" +
        "↓↓↑→←ＨＣ盤車画人＜＞Ｖ∵ツ" +
        "日月火水木金土生年時分秒円￥㍀～" +
        "─│┼～々雨〆叶札ＫＫ＞─││網" +
        " 田田田田田田田田田田田田田田田"
        ];
    dispcodeCharset[0] = dispcodeCharset[0].split("");
    dispcodeCharset[1] = dispcodeCharset[1].split("");
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
}());
