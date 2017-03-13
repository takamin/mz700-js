(function() {
    var Z80BinUtil = getModule("Z80BinUtil") || require("./bin-util.js");

    //
    // IMem
    //
    var IMem = function() {};

    IMem.prototype.create = function(opt) {
        opt = opt || {};
        this.onPeek = opt.onPeek || function(address, value) {};
        this.onPoke = opt.onPoke || function(address, value) {};
        this.size = opt.size || 0x10000;
        this.startAddr = opt.startAddr || 0;
    };

    //
    // This peekByte is an abstruct called from `peek`.
    //
    // address: address to write value
    //
    IMem.prototype.peekByte = function(address, value) {
        var msg = "Error: peekByte was not overrided and supported in class of this:" + JSON.stringify(this, null, "    ");
        log.error(msg);
        throw new ReferenseError(msg);
    };

    //
    // This pokeByte is an abstruct called from `poke`.
    //
    // address: address to write value
    // value: value to write
    //
    IMem.prototype.pokeByte = function(address, value) {
        var msg = "Error: pokeByte was not overrided and supported in class of this:" + JSON.stringify(this, null, "    ");
        log.error(msg);
        throw new ReferenseError(msg);
    };

    IMem.prototype.clear = function() {
        for(var i = 0; i < this.size; i++) {
            this.pokeByte(0);
        }
    };

    IMem.prototype.peek = function(address) {
        var value = this.peekByte(address);
        var override = this.onPeek.call(this, address, value);
        if(override != null && override != undefined) {
            value = override;
        }
        return value;
    };

    IMem.prototype.poke = function(address, value) {
        this.pokeByte(address, value);
        this.onPoke.call(this, address, this.peekByte(address));
    };

    IMem.prototype.peekPair = function(address) {
        var H = this.peek(address + 1);
        var L = this.peek(address + 0);
        return Z80BinUtil.pair(H,L);
    };

    module.exports = context.exportModule("IMem", IMem);
}());
