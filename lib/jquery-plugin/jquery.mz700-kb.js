(function() {
    var MZ700KeyMatrix = require("../../MZ-700/mz700-key-matrix.js");
    var jquery_plugin_class = require("./jquery_plugin_class");
    jquery_plugin_class("mz700keyboard");
    var mz700keyboard = function(element) {
        this.element = element;
        $(this.element).addClass("mz700keymatrix")
    };
    window.mz700keyboard = mz700keyboard;
    var KeyCodes = MZ700KeyMatrix.KeyCodes;
    var KeyNames = MZ700KeyMatrix.KeyNames;
    mz700keyboard.prototype.create = function(mz700js) {
        this._mz700js = mz700js;
        var $container = $("<div/>").addClass("keyboard-base-panel");
        $(this.element).append($container);

        $container
            .append($("<div/>").addClass("FKEYS")
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Escape]))
                .append($("<span/>").addClass("nk-1-1"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F1]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F2]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F3]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F4]))
                .append($("<span/>").addClass("nk-1-2"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F5]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F6]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F7]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F8]))
                .append($("<span/>").addClass("nk-1-3"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F9]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F10]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F11]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F12])))
            .append($("<div/>")
                .append($("<span/>").addClass("keyContainer-Kanji"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D1]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D2]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D3]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D4]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D5]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D6]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D7]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D8]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D9]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D0]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Subtract]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Caret]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Yen]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Backspace]))
                .append($("<span/>").addClass("nk-2"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Insert]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Home]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.PageUp])))
            .append($("<div/>")
                .append($("<span/>").addClass("keyContainer-Tab"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Q]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.W]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.E]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.R]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.T]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Y]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.U]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.I]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.O]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.P]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Atmark]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.OpenBrackets]))
                .append($("<span/>").addClass("nk-3"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Enter]))
                .append($("<span/>").addClass("nk-2"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Delete]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.End]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.PageDown])))
            .append($("<div/>")
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Control]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.A]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.S]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.D]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.F]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.G]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.H]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.J]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.K]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.L]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.SemiColon]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Colon]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.CloseBrackets]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Enter])))
            .append($("<div/>")
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Shift]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Z]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.X]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.C]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.V]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.B]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.N]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.M]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Comma]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Decimal]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Divide]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Backslash]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Shift]))
                .append($("<span/>").addClass("nk-5-1"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Up])))
            .append($("<div/>")
                .append($("<span/>").addClass("nk-6-1"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Space]))
                .append($("<span/>").addClass("nk-6-2"))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Left]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Down]))
                .append($("<span/>").addClass("keyContainer-" + KeyNames[KeyCodes.Right])));
        MZ700KeyMatrix.Keys.forEach(key => {
            const strobe = key.strobe;
            const bit = key.bit;
            key.code.forEach(code => {
                const $key = $("<span/>").addClass("button")
                    .addClass("matrix-" + strobe + "-" + bit)
                    .html(key.face)
                    .mousedown(() => {
                        this._mz700js.setKeyState(strobe, bit, true);
                        this.setState(strobe, bit, true);
                    })
                    .mouseup(() => {
                        this._mz700js.setKeyState(strobe, bit, false);
                        this.setState(strobe, bit, false);
                    });
                $(".keyContainer-" + KeyNames[code]).append($key);
            });
        });
        $(".keyContainer-F6").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        $(".keyContainer-F7").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        $(".keyContainer-F8").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        $(".keyContainer-F9").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        $(".keyContainer-Kanji").append($("<span/>").addClass("button").addClass("dummy").html("&nbsp;"));
        const onkey = (event, state) => {
            if(this.acceptKey()) {
                event.stopPropagation();
                const matrix = MZ700KeyMatrix.Code2Key[event.keyCode];
                if(matrix != null) {
                    const { strobe, bit } = matrix;
                    mz700js.setKeyState(strobe, bit, state);
                    this.setState(strobe, bit, state);
                }
                return false;
            }
        };
        window.addEventListener("keydown", event => onkey(event, true));
        window.addEventListener("keyup", event => onkey(event, false));
    };
    mz700keyboard.prototype.getMatPos =  function(code) {
        return MZ700KeyMatrix.Code2Key[code];
    }
    mz700keyboard.prototype.setState = function(strobe, bit, state) {
        var $key = $(this.element).find(".matrix-" + strobe + "-" + bit);
        if(state) {
            $key.addClass("push");
        } else {
            $key.removeClass("push");
        }
    };
    mz700keyboard.prototype.acceptKey = function(state) {
        if(state == null) {
            return this._acceptKey;
        }
        this._acceptKey = state;
    };
}());
