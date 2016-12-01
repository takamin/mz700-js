Z80_assemble = function(asm_source) {
    if(asm_source == undefined) {
        return;
    }

    //
    // Assemble
    //
    this.list = [];
    this.label2value = {};
    this.address = 0;

    var source_lines = asm_source.split(/\r{0,1}\n/);
    for(var i = 0; i < source_lines.length; i++) {
        var assembled_code = new Z80LineAssembler(
                source_lines[i],
                this.address,
                this.label2value);
        this.address = assembled_code.getNextAddress();
        this.list.push(assembled_code);
    }

    //
    // Resolve address symbols
    //
    for(var i = 0; i < this.list.length; i++) {
        this.list[i].resolveAddress(this.label2value);
    }

    //
    // Create machine code array
    //

    // address min-max
    var min_addr = null;
    var max_addr = null;
    this.list.forEach(function(line) {
        if("address" in line && "bytecode" in line && line.bytecode.length > 0) {
            if(min_addr == null || line.address < min_addr) {
                min_addr = line.address;
            }
            if(max_addr == null || line.address + line.bytecode.length - 1 > max_addr) {
                max_addr = line.address + line.bytecode.length - 1;
            }
        }
    });
    this.min_addr = min_addr;
    this.buffer = new Array(max_addr - min_addr + 1);
    this.list.forEach(function(line) {
        if("address" in line && "bytecode" in line && line.bytecode.length > 0) {
            Array.prototype.splice.apply(this.buffer,
                [line.address - min_addr, line.bytecode.length].concat(line.bytecode));
        }
    }, this);
};

Z80_assemble.prototype.parseAddress = function(addrToken) {
    var bytes = Z80LineAssembler.parseNumLiteralPair(addrToken);
    if(bytes == null) {
        return null;
    }
    var H = bytes[1]; if(typeof(H) == 'function') { H = H(this.label2value); }
    var L = bytes[0]; if(typeof(L) == 'function') { L = L(this.label2value); }
    var addr = Z80.pair(H,L);
    return addr;
};

Z80LineAssembler = function(source, address, dictionary) {
    this.address = address;
    this.bytecode = [];
    this.label = null;
    this.mnemonic = null;
    this.operand = [];
    this.comment = null;

    var tokens = Z80LineAssembler.tokenize(source);

    var found_label = -1;
    var found_comment = -1;
    for(var j = 0; j < tokens.length; j++) {
        switch(tokens[j]) {
            case ':':
                if(found_label < 0 && found_comment < 0) {
                    found_label = j;
                }
                break;
            case ';':
                if(found_comment < 0) {
                    found_comment = j;
                }
                break;
        }
    }
    if(found_label >= 0) {
        this.label = tokens.slice(0, found_label).join('');
        tokens.splice(0, found_label + 1);
        found_comment -= (found_label + 1);
    }
    if(found_comment >= 0) {
        this.comment = tokens.slice(found_comment).join('');
        tokens.splice(found_comment);
    }
    if(tokens.length > 0) {
        this.mnemonic = tokens[0];
        this.operand = tokens.slice(1).join('');
    }
    if(tokens.length > 0) {
        try {
            this.bytecode = this.assembleMnemonic(tokens, this.label, dictionary);
        } catch(e) {
            this.comment += "*** ASSEMBLE ERROR - " + e;
        }
    }
};

Z80LineAssembler.prototype.getNextAddress = function()
{
    var address = this.address;
    if(this.bytecode != null) {
        address += this.bytecode.length;
    }
    return address;
};

Z80LineAssembler.prototype.resolveAddress = function(dictionary)
{
    for(var j = 0; j < this.bytecode.length; j++) {
        if(typeof(this.bytecode[j]) == 'function') {
            this.bytecode[j] = this.bytecode[j](dictionary);
        }
    }
};

Z80LineAssembler.tokenize = function(line) {
    var LEX_IDLE=0;
    var LEX_WHITESPACE=1;
    var LEX_NUMBER=2;
    var LEX_IDENT=3;
    var LEX_CHAR=4;
    var currstat = LEX_IDLE;
    var L = line.length;
    var i = 0;
    var toks = [];
    var tok = '';
    line = line.toUpperCase();
    while(i < L) {
        var ch = line.charAt(i);
        switch(currstat) {
            case LEX_IDLE:
                if(/\s/.test(ch)) {
                    i++;
                } else {
                    if(ch == '-' || ch =='+') {
                        tok += ch;
                        i++;
                        currstat = LEX_NUMBER;
                    } else if(/[0-9]/.test(ch)) {
                        currstat = LEX_NUMBER;
                    }
                    else if(/[A-Z_\?\.\*#!\$]/.test(ch)) {
                        tok += ch;
                        i++;
                        currstat = LEX_IDENT;
                    }
                    else if(ch == "'") {
                        tok += ch;
                        i++;
                        currstat = LEX_CHAR;
                    }
                    else if( ch == '(' || ch == ')' || ch == ',' || ch == '+' || ch == ':') {
                        toks.push(ch);
                        i++;
                    }
                    else if( ch == ';') {
                        toks.push(ch);
                        i++;
                        var comment = line.substr(i);
                        toks.push(comment);
                        i += comment.length;
                        tok = '';
                    }
                    else {
                        throw 'unrecognized char ' + ch + ' at column ' + i;
                    }
                }
                break;
            case LEX_NUMBER:
                if(/[0-9A-F]/.test(ch)) {
                    tok += ch;
                    i++;
                } else if(ch == 'H') {
                    tok += ch;
                    i++;
                    toks.push(tok);
                    tok = '';
                    currstat = LEX_IDLE;
                } else {
                    toks.push(tok);
                    tok = '';
                    currstat = LEX_IDLE;
                }
                break;
            case LEX_IDENT:
                if(/[A-Z_0-9\?\.\*#!\$']/.test(ch)) {
                    tok += ch;
                    i++;
                } else {
                    toks.push(tok);
                    tok = '';
                    currstat = LEX_IDLE;
                }
                break;
            case LEX_CHAR:
                if(ch == "\\") {
                    ++i;
                    if(i < L) {
                        ch = line.charAt(i);
                        tok += ch;
                        i++;
                    }
                } else if(ch != "'") {
                    tok += ch;
                    i++;
                } else {
                    tok += ch;
                    i++;
                    toks.push(tok);
                    tok = '';
                    currstat = LEX_IDLE;
                }
                break;
            default:
                throw 'unrecognized status ';
                break;

        } 
    }
    if(tok != '') {
        toks.push(tok);
    }
    return toks;
};

Z80LineAssembler.prototype.assembleMnemonic = function(toks, label, dictionary) {
    //
    // Pseudo Instruction
    //
    if(match_token(toks,['ORG', null])) {
        this.address = Z80LineAssembler._parseNumLiteral(toks[1]);
        return [];
    }
    if(match_token(toks,['ENT'])) {
        dictionary[label] = this.address;
        return [];
    }
    if(match_token(toks,['EQU', null])) {
        if(label == null || label == "") {
            throw "empty label for EQU";
        }
        dictionary[label] = Z80LineAssembler._parseNumLiteral(toks[1]);
        return [];
    }
    if(match_token(toks,['DEFB', null])) {
        return [Z80LineAssembler.parseNumLiteral(toks[1])];
    }
    if(match_token(toks,['DEFW', null])) {
        return Z80LineAssembler.parseNumLiteralPair(toks[1]);
    }
    if(match_token(toks,['DEFS', null])) {
        var n = Z80LineAssembler._parseNumLiteral(toks[1]);
        if(n < 0) {
            throw "negative DEFS number " + tok[1];
        }
        return (function(a,i,n,v) { for(; i < n; i++) { a.push(v);}; return a;}([],0,n,v));
    }
	//=================================================================================
	//
	// 8bit load group
	//
	//=================================================================================
    if(match_token(toks,['LD', 'A', ',', 'I'])) { return [0355, 0127]; }
    if(match_token(toks,['LD', 'A', ',', 'R'])) { return [0355, 0137]; }
    if(match_token(toks,['LD', 'I', ',', 'A'])) { return [0355, 0107]; }
    if(match_token(toks,['LD', 'R', ',', 'A'])) { return [0355, 0117]; }
    if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', /^[BCDEHLA]$/])) {
        var dst_r = get8bitRegId(toks[1]);
        var src_r = get8bitRegId(toks[3]);
        return [0100 | (dst_r << 3) | (src_r) << 0];
    }
    if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', null])) {
        var r = get8bitRegId(toks[1]);
        var n = Z80LineAssembler.parseNumLiteral(toks[3]);
        return [0006 | (r << 3), n];
    }
    if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(','HL',')'])) {
        var r = get8bitRegId(toks[1]);
        return [0106 | (r << 3)];
    }
    if(match_token(toks,['LD', '(','HL',')', ',', /^[BCDEHLA]$/])) {
        var r = get8bitRegId(toks[5]);
        return [0160 | r];
    }
    if(match_token(toks,['LD', '(','HL',')', ',', null])) {
        var n = Z80LineAssembler.parseNumLiteral(toks[5]);
        return [0066, n];
    }
    if(match_token(toks,['LD', 'A', ',', '(', /^(BC|DE)$/, ')'])) {
        var dd = get16bitRegId_dd(toks[4]);
        return [0012 | (dd << 4)];
    }
    if(match_token(toks,['LD', 'A', ',', '(', null, ')'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
        return [0072, n[0], n[1]];
    }
    if(match_token(toks,['LD', '(', /^(BC|DE)$/, ')', ',', 'A'])) {
        var dd = get16bitRegId_dd(toks[2]);
        return [0002 | (dd << 4)];
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'A'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
        return [0062, n[0], n[1]];
    }
	//=================================================================================
	//
	// 16bit load group
	//
	//=================================================================================
    if(match_token(toks,['LD', 'SP', ',', 'HL'])) { return [0371]; }
    if(match_token(toks,['LD', 'SP', ',', 'IX'])) { return [0xDD, 0xF9]; }
    if(match_token(toks,['LD', 'SP', ',', 'IY'])) { return [0xfd, 0xF9]; }
    if(match_token(toks,['LD', /^(BC|DE|HL|SP)$/, ',', null])) {
        var dd = get16bitRegId_dd(toks[1]);
        var n = Z80LineAssembler.parseNumLiteralPair(toks[3]);
        return [0001 | (dd << 4), n[0], n[1]];
    }
    if(match_token(toks,['LD', 'HL', ',', '(', null, ')'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
        return [0052, n[0], n[1]];
    }
    if(match_token(toks,['LD', 'BC', ',', '(', null, ')'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
        return [0355, 0113, n[0], n[1]];
    }
    if(match_token(toks,['LD', 'DE', ',', '(', null, ')'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
        return [0355, 0133, n[0], n[1]];
    }
    if(match_token(toks,['LD', 'SP', ',', '(', null, ')'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[4]);
        return [0355, 0173, n[0], n[1]];
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'HL'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
        return [0042, n[0], n[1]];
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'BC'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
        return [0355, 0103, n[0], n[1]];
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'DE'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
        return [0355, 0123, n[0], n[1]];
    }
    if(match_token(toks,['LD', '(', null, ')', ',', 'SP'])) {
        var n = Z80LineAssembler.parseNumLiteralPair(toks[2]);
        return [0355, 0163, n[0], n[1]];
    }
    if(match_token(toks,['PUSH', /^(BC|DE|HL|AF)$/])) {
        var qq = get16bitRegId_qq(toks[1]);
        return [0305 | (qq << 4)];
    }
    if(match_token(toks,['POP', /^(BC|DE|HL|AF)$/])) {
        var qq = get16bitRegId_qq(toks[1]);
        return [0301 | (qq << 4)];
    }
	//=================================================================================
    //
    // エクスチェンジグループ、ブロック転送および、サーチグループ
    //
	//=================================================================================
    if(match_token(toks,['EX', 'DE', ',', 'HL'])) { return [0xEB]; }
    if(match_token(toks,['EX', 'AF', ',', "AF'"])) { return [0x08]; }
    if(match_token(toks,['EXX'])) { return [0xD9]; }
    if(match_token(toks,['EX', '(', 'SP', ')', ',', 'HL'])) { return [0xE3]; }
    if(match_token(toks,['LDI']))   { return [0355,0240]; }
    if(match_token(toks,['LDIR']))  { return [0355,0260]; }
    if(match_token(toks,['LDD']))   { return [0355,0250]; }
    if(match_token(toks,['LDDR']))  { return [0355,0270]; }
    if(match_token(toks,['CPI']))   { return [0355,0241]; }
    if(match_token(toks,['CPIR']))  { return [0355,0261]; }
    if(match_token(toks,['CPD']))   { return [0355,0251]; }
    if(match_token(toks,['CPDR']))  { return [0355,0271]; }
    
    //=================================================================================
    // 一般目的の演算、及びCPUコントロールグループ
    //=================================================================================
    if(match_token(toks,['DAA']))   { return [0047]; }
    if(match_token(toks,['CPL']))   { return [0057]; }
    if(match_token(toks,['NEG']))   { return [0355,0104]; }
    if(match_token(toks,['CCF']))   { return [0077]; }
    if(match_token(toks,['SCF']))   { return [0067]; }
    if(match_token(toks,['NOP']))   { return [0000]; }
    if(match_token(toks,['HALT']))  { return [0166]; }
    if(match_token(toks,['DI']))    { return [0363]; }
    if(match_token(toks,['EI']))    { return [0373]; }
    if(match_token(toks,['IM0']))   { return [0355,0106]; }
    if(match_token(toks,['IM1']))   { return [0355,0126]; }
    if(match_token(toks,['IM2']))   { return [0355,0136]; }
    if(match_token(toks,['IM','0']))   { return [0355,0106]; }
    if(match_token(toks,['IM','1']))   { return [0355,0126]; }
    if(match_token(toks,['IM','2']))   { return [0355,0136]; }

    //=================================================================================
    // 16ビット演算グループ
    //=================================================================================
    if(match_token(toks,[/^(ADD|ADC|SBC)$/, 'HL', ',', /^(BC|DE|HL|SP)$/]))   {
        var ss = 0;
        switch(toks[3]) {
            case 'BC': ss = 0; break;
            case 'DE': ss = 1; break;
            case 'HL': ss = 2; break;
            case 'SP': ss = 3; break;
        }
        switch(toks[0]) {
            case 'ADD': return [0011 | (ss << 4)];
            case 'ADC': return [0355, 0112 | (ss << 4)];
            case 'SBC': return [0355, 0102 | (ss << 4)];
        }
        return [];
    }
    if(match_token(toks,['ADD', 'IX', ',', /^(BC|DE|IX|SP)$/]))   {
        switch(toks[3]) {
            case 'BC': return [0335, 0011]; break;
            case 'DE': return [0335, 0031]; break;
            case 'IX': return [0335, 0051]; break;
            case 'SP': return [0335, 0071]; break;
        }
        return [];
    }
    if(match_token(toks,['ADD', 'IY', ',', /^(BC|DE|IY|SP)$/]))   {
        switch(toks[3]) {
            case 'BC': return [0375, 0011]; break;
            case 'DE': return [0375, 0031]; break;
            case 'IY': return [0375, 0051]; break;
            case 'SP': return [0375, 0071]; break;
        }
        return [];
    }
    if(match_token(toks,[/^(INC|DEC)$/, /^(BC|DE|HL|SP|IX|IY)$/]))   {
        switch(toks[0]) {
            case 'INC':
                switch(toks[1]) {
                    case 'BC': return [0003];
                    case 'DE': return [0023];
                    case 'HL': return [0043];
                    case 'SP': return [0063];
                    case 'IX': return [0335,0043];
                    case 'IY': return [0375,0043];
                }
            case 'DEC':
                switch(toks[1]) {
                    case 'BC': return [0013];
                    case 'DE': return [0033];
                    case 'HL': return [0053];
                    case 'SP': return [0073];
                    case 'IX': return [0335,0053];
                    case 'IY': return [0375,0053];
                }
        }
        return [];
    }

    //=================================================================================
    // ローテイト・シフトグループ
    //=================================================================================
    if(match_token(toks,['RLCA']))  { return [0007]; }
    if(match_token(toks,['RLA']))   { return [0027]; }
    if(match_token(toks,['RRCA']))  { return [0017]; }
    if(match_token(toks,['RRA']))   { return [0037]; }

    if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,/^[BCDEHLA]$/])) {
        switch(toks[0]) {
            case 'RLC': return [0313, 0000 | get8bitRegId(toks[1])];
            case 'RL':  return [0313, 0020 | get8bitRegId(toks[1])];
            case 'RRC': return [0313, 0010 | get8bitRegId(toks[1])];
            case 'RR':  return [0313, 0030 | get8bitRegId(toks[1])];
            case 'SLA': return [0313, 0040 | get8bitRegId(toks[1])];
            case 'SRA': return [0313, 0050 | get8bitRegId(toks[1])];
            case 'SRL': return [0313, 0070 | get8bitRegId(toks[1])];
        }
        return [];
    }
    if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(','HL',')']))  {
        switch(toks[0]) {
            case 'RLC': return [0313, 0006];
            case 'RL':  return [0313, 0026];
            case 'RRC': return [0313, 0016];
            case 'RR':  return [0313, 0036];
            case 'SLA': return [0313, 0046];
            case 'SRA': return [0313, 0056];
            case 'SRL': return [0313, 0076];
        }
        return [];
    }
    if(match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(',/^(IX|IY)$/,'+',null, ')'])
    || match_token(toks,[/^(RLC|RL|RRC|RR|SLA|SRA|SRL)$/,'(',/^(IX|IY)$/,/^\+.*/, ')']))  {
        var index_d = ((toks[3] == '+') ? 4 : 3);
        var prefix = 0;
        switch(toks[2]) {
            case 'IX': prefix = 0335; break;
            case 'IY': prefix = 0375; break;
        }
        var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
        switch(toks[0]) {
            case 'RLC': return [prefix, 0313, d, 0006];
            case 'RL':  return [prefix, 0313, d, 0026];
            case 'RRC': return [prefix, 0313, d, 0016];
            case 'RR':  return [prefix, 0313, d, 0036];
            case 'SLA': return [prefix, 0313, d, 0046];
            case 'SRA': return [prefix, 0313, d, 0056];
            case 'SRL': return [prefix, 0313, d, 0076];
        }
        return [];
    }
    if(match_token(toks,['RLD']))  { return [0355, 0157]; }
    if(match_token(toks,['RRD']))  { return [0355, 0147]; }

    //=================================================================================
    // ビットセット・リセット及びテストグループ
    //=================================================================================

    if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', /^[BCDEHLA]$/])) {
        switch(toks[0]) {
            case 'BIT': return [0313, 0100 | (toks[1] << 3) | get8bitRegId(toks[3])];
            case 'SET': return [0313, 0300 | (toks[1] << 3) | get8bitRegId(toks[3])];
            case 'RES': return [0313, 0200 | (toks[1] << 3) | get8bitRegId(toks[3])];
        }
        return [];
    }
    if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(','HL',')']))  {
        switch(toks[0]) {
            case 'BIT': return [0313, 0106 | (toks[1] << 3)];
            case 'SET': return [0313, 0306 | (toks[1] << 3)];
            case 'RES': return [0313, 0206 | (toks[1] << 3)];
        }
        return [];
    }
    if(match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(',/^(IX|IY)$/,'+',null,')'])
    || match_token(toks,[/^(BIT|SET|RES)$/, /^[0-7]$/, ',', '(',/^(IX|IY)$/,/^\+.*$/,')'])) {
        var index_d = ((toks[5] == '+') ? 6 : 5);
        var prefix = 0;
        switch(toks[4]) {
            case 'IX': prefix = 0335; break;
            case 'IY': prefix = 0375; break;
        }
        var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
        switch(toks[0]) {
            case 'BIT': return [prefix, 0313, d, 0106 | (toks[1] << 3)];
            case 'SET': return [prefix, 0313, d, 0306 | (toks[1] << 3)];
            case 'RES': return [prefix, 0313, d, 0206 | (toks[1] << 3)];
        }
        return [];
    }

    //=================================================================================
    // ジャンプグループ
    //=================================================================================

    if(match_token(toks,['JP', null]))  {
        var nn = Z80LineAssembler.parseNumLiteralPair(toks[1]);
        return [0303, nn[0], nn[1]];
    }
    if(match_token(toks,['JP', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',',  null]))  {
        var nn = Z80LineAssembler.parseNumLiteralPair(toks[3]);
        switch(toks[1]) {
            case 'NZ':  return [0302, nn[0], nn[1]];
            case 'Z':   return [0312, nn[0], nn[1]];
            case 'NC':  return [0322, nn[0], nn[1]];
            case 'C':   return [0332, nn[0], nn[1]];
            case 'PO':  return [0342, nn[0], nn[1]];
            case 'PE':  return [0352, nn[0], nn[1]];
            case 'P':   return [0362, nn[0], nn[1]];
            case 'M':   return [0372, nn[0], nn[1]];
        }
        return [];
    }
    if(match_token(toks,['JR', null]))  {
        var e = Z80LineAssembler.parseRelAddr(toks[1], this.address + 2);
        return [0030, e];
    }
    if(match_token(toks,['JR', /^(NZ|Z|NC|C)$/, ',',  null]))  {
        var e = Z80LineAssembler.parseRelAddr(toks[3], this.address + 2);
        switch(toks[1]) {
            case 'NZ':  return [0040, e];
            case 'Z':   return [0050, e];
            case 'NC':  return [0060, e];
            case 'C':   return [0070, e];
        }
        return [];
    }
    if(match_token(toks,['JP', '(', /^(HL|IX|IY)$/, ')']))  {
        switch(toks[2]) {
            case 'HL':  return [0351];
            case 'IX':  return [0335, 0351];
            case 'IY':  return [0375, 0351];
        }
        return [];
    }
    if(match_token(toks,['DJNZ', null]))  {
        var e = Z80LineAssembler.parseRelAddr(toks[1], this.address + 2);
        return [0020, e];
    }

    //=================================================================================
    // コールリターングループ
    //=================================================================================

    if(match_token(toks,['CALL', null]))  {
        var nn = Z80LineAssembler.parseNumLiteralPair(toks[1]);
        return [0315, nn[0], nn[1]];
    }
    if(match_token(toks,['CALL', /^(NZ|Z|NC|C|PO|PE|P|M)$/, ',',  null]))  {
        var nn = Z80LineAssembler.parseNumLiteralPair(toks[3]);
        switch(toks[1]) {
            case 'NZ':  return [0304, nn[0], nn[1]];
            case 'Z':   return [0314, nn[0], nn[1]];
            case 'NC':  return [0324, nn[0], nn[1]];
            case 'C':   return [0334, nn[0], nn[1]];
            case 'PO':  return [0344, nn[0], nn[1]];
            case 'PE':  return [0354, nn[0], nn[1]];
            case 'P':   return [0364, nn[0], nn[1]];
            case 'M':   return [0374, nn[0], nn[1]];
        }
        return [];
    }
    if(match_token(toks,['RET']))  { return [0311]; }
    if(match_token(toks,['RET', /^(NZ|Z|NC|C|PO|PE|P|M)$/]))  {
        switch(toks[1]) {
            case 'NZ':  return [0300];
            case 'Z':   return [0310];
            case 'NC':  return [0320];
            case 'C':   return [0330];
            case 'PO':  return [0340];
            case 'PE':  return [0350];
            case 'P':   return [0360];
            case 'M':   return [0370];
        }
        return [];
    }
    if(match_token(toks,['RETI']))  { return [0355, 0115]; }
    if(match_token(toks,['RETN']))  { return [0355, 0105]; }
    if(match_token(toks,['RST', /^(00H|08H|10H|18H|20H|28H|30H|38H)$/]))  {
        switch(toks[1]) {
            case '00H':  return [0307];
            case '08H':  return [0317];
            case '10H':  return [0327];
            case '18H':  return [0337];
            case '20H':  return [0347];
            case '28H':  return [0357];
            case '30H':  return [0367];
            case '38H':  return [0377];
        }
        return [];
    }

    //=================================================================================
    // 入力・出力グループ
    //=================================================================================
    if(match_token(toks,['IN', /^[BCDEHLA]$/, ',', '(','C',')']))  {
        var r = get8bitRegId(toks[1]);
        return [0355, 0100 | (r << 3)];
    }
    if(match_token(toks,['IN', 'A', ',', '(', null, ')']))  {
        var n = Z80LineAssembler.parseNumLiteral(toks[4]);
        return [0333, n];
    }
    if(match_token(toks,['OUT', '(','C',')', ',', /^[BCDEHLA]$/]))  {
        var r = get8bitRegId(toks[5]);
        return [0355, 0101 | (r << 3)];
    }
    if(match_token(toks,['OUT', '(', null, ')', ',', 'A']))  {
        var n = Z80LineAssembler.parseNumLiteral(toks[2]);
        return [0323, n];
    }
    if(match_token(toks,['INI']))   { return [0355, 0242]; }
    if(match_token(toks,['INIR']))  { return [0355, 0262]; }
    if(match_token(toks,['IND']))   { return [0355, 0252]; }
    if(match_token(toks,['INDR']))  { return [0355, 0272]; }
    if(match_token(toks,['OUTI']))  { return [0355, 0243]; }
    if(match_token(toks,['OTIR']))  { return [0355, 0263]; }
    if(match_token(toks,['OUTD']))  { return [0355, 0253]; }
    if(match_token(toks,['OTDR']))  { return [0355, 0273]; }

	//=================================================================================
	//
    // IX/IY
    //
	//=================================================================================
    if(match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, '+', null, ')'])
    || match_token(toks,['LD', /^[BCDEHLA]$/, ',', '(', /^(IX|IY)$/, null, ')'])) {
        var index_d = ((toks[5] == '+') ? 6 : 5);
        var r = get8bitRegId(toks[1]);
        var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
        var subope = getSubopeIXIY(toks[4]);
        return [subope, 0106 | (r << 3), d];
    }
    if(match_token(toks,['LD', '(', /^(IX|IY)$/, '+', null, ')', ',', /^[BCDEHLA]$/])
    || match_token(toks,['LD', '(', /^(IX|IY)$/, /^\+.*$/, ')', ',', /^[BCDEHLA]$/])) {
        var index_d = ((toks[3] == '+') ? 4 : 3);
        var index_r = ((toks[3] == '+') ? 7 : 6);
        var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
        var r = get8bitRegId(toks[index_r]);
        var subope = getSubopeIXIY(toks[2]);
        return [subope, 0160 | r, d];
    }
    if(match_token(toks,['LD', '(', /^(IX|IY)$/, '+', null, ')', ',', null])
    || match_token(toks,['LD', '(', /^(IX|IY)$/, /^\+.*$/, ')', ',', null])) {
        var index_d = ((toks[3] == '+') ? 4 : 3);
        var index_n = ((toks[3] == '+') ? 7 : 6);
        var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
        var n = Z80LineAssembler.parseNumLiteral(toks[index_n]);
        var subope = getSubopeIXIY(toks[2]);
        return [subope, 0x36, d, n];
    }
    if(match_token(toks,['LD', /^(IX|IY)$/, ',', null])) {
        var nn = Z80LineAssembler.parseNumLiteralPair(toks[3]);
        var subope = getSubopeIXIY(toks[1]);
        return [subope, 0x21, nn[0], nn[1]];
    }
    if(match_token(toks,['LD', /^(IX|IY)$/, ',', '(', null, ')'])) {
        var nn = Z80LineAssembler.parseNumLiteralPair(toks[4]);
        var subope = getSubopeIXIY(toks[1]);
        return [subope, 0x2A, nn[0], nn[1]];
    }
    if(match_token(toks,['PUSH', /^(IX|IY)$/])) {
        var subope = getSubopeIXIY(toks[1]);
        return [subope, 0xE5];
    }
    if(match_token(toks,['POP', /^(IX|IY)$/])) {
        var subope = getSubopeIXIY(toks[1]);
        return [subope, 0xE1];
    }
    if(match_token(toks,['EX', '(','SP',')', ',', /^(IX|IY)$/])) {
        var subope = getSubopeIXIY(toks[5]);
        return [subope, 0xE3];
    }

    //=================================================================================
    // 8ビット演算
    //=================================================================================
    if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', /^[BCDEHLA]$/])) {
        var subseq = getArithmeticSubOpecode(toks[0]);
        var r = get8bitRegId(toks[3]);
        return [0200 | (subseq << 3) | r];
    }
    if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', null])) {
        var subseq = getArithmeticSubOpecode(toks[0]);
        var n = Z80LineAssembler.parseNumLiteral(toks[3]);
        return [0306 | (subseq << 3), n];
    }
    if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', 'HL', ')'])) {
        var subseq = getArithmeticSubOpecode(toks[0]);
        return [0206 | (subseq << 3)];
    }
    if(match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, '+', null,  ')'])
    || match_token(toks,[/^(ADD|ADC|SUB|SBC)$/, 'A', ',', '(', /^(IX|IY)$/, /^\+.*/,  ')'])) {
        var index_d = ((toks[5] == '+') ? 6 : 5);
        var subseq = getArithmeticSubOpecode(toks[0]);
        var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
        var subope = getSubopeIXIY(toks[4]);
        return [subope, 0206 | (subseq << 3), d];
    }
    if(match_token(toks,[/^(AND|OR|XOR|CP)$/, /^[BCDEHLA]$/])) {
        var subseq = getArithmeticSubOpecode(toks[0]);
        var r = get8bitRegId(toks[1]);
        return [0200 | (subseq << 3) | r];
    }
    if(match_token(toks,[/^(AND|OR|XOR|CP)$/, null])) {
        var subseq = getArithmeticSubOpecode(toks[0]);
        var n = Z80LineAssembler.parseNumLiteral(toks[1]);
        return [0306 | (subseq << 3), n];
    }
    if(match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', 'HL', ')'])) {
        var subseq = getArithmeticSubOpecode(toks[0]);
        return [0206 | (subseq << 3)];
    }
    if(match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, '+', null,  ')'])
    || match_token(toks,[/^(AND|OR|XOR|CP)$/, '(', /^(IX|IY)$/, /^\+.*$/,  ')'])) {
        var index_d = ((toks[3] == '+') ? 4 : 3);
        var subseq = getArithmeticSubOpecode(toks[0]);
        var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
        var subope = getSubopeIXIY(toks[2]);
        return [subope, 0206 | (subseq << 3), d];
    }
    if(match_token(toks,[/^(INC|DEC)$/, /^[BCDEHLA]$/])) {
        var r = get8bitRegId(toks[1]);
        switch(toks[0]) {
            case 'INC': return [0004 | (r << 3)]; break;
            case 'DEC': return [0005 | (r << 3)]; break;
        }
    }
    if(match_token(toks,[/^(INC|DEC)$/, '(', 'HL', ')'])) {
        switch(toks[0]) {
            case 'INC': return [0064]; break;
            case 'DEC': return [0065]; break;
        }
    }
    if(match_token(toks,[/^(INC|DEC)$/, '(', /^(IX|IY)$/, '+', null,  ')'])
    || match_token(toks,[/^(INC|DEC)$/, '(', /^(IX|IY)$/, /^\+.*$/,  ')'])) {
        var subope = getSubopeIXIY(toks[2]);
        var index_d = ((toks[3] == '+') ? 4 : 3);
        var d = Z80LineAssembler.parseNumLiteral(toks[index_d]);
        switch(toks[0]) {
            case 'INC': return [subope, 0064, d]; break;
            case 'DEC': return [subope, 0065, d]; break;
        }
    }
    console.warn("**** ERROR: CANNOT ASSEMBLE:" + toks.join(" / "));
    return [];
};

function getSubopeIXIY(tok) {
    var subope = 0;
    switch(tok) {
        case 'IX': subope = 0335; break;
        case 'IY': subope = 0375; break;
    }
    return subope;
};

function getArithmeticSubOpecode(opecode) {
    var subseq = 0;
    switch(opecode) {
        case 'ADD': subseq = 0; break;
        case 'ADC': subseq = 1; break;
        case 'SUB': subseq = 2; break;
        case 'SBC': subseq = 3; break;
        case 'AND': subseq = 4; break;
        case 'OR': subseq = 6; break;
        case 'XOR': subseq = 5; break;
        case 'CP': subseq = 7; break;
    }
    return subseq;
};

function get16bitRegId_dd(name) {
    var r = null;
    switch(name) {
        case 'BC': r = 0; break;
        case 'DE': r = 1; break;
        case 'HL': r = 2; break;
        case 'SP': r = 3; break;
        default: break;
    }
    return r;
};

function get16bitRegId_qq(name) {
    var r = null;
    switch(name) {
        case 'BC': r = 0; break;
        case 'DE': r = 1; break;
        case 'HL': r = 2; break;
        case 'AF': r = 3; break;
        default: break;
    }
    return r;
};

function get8bitRegId(name) {
    var r = null;
    switch(name) {
        case 'B': r = 0; break;
        case 'C': r = 1; break;
        case 'D': r = 2; break;
        case 'E': r = 3; break;
        case 'H': r = 4; break;
        case 'L': r = 5; break;
        case 'A': r = 7; break;
        default: break;
    }
    return r;
};

function match_token(toks, pattern) {
    if(toks.length != pattern.length) {
        return false;
    }
    for (var i = 0; i < toks.length; i++) {
        if(pattern[i] != null) {
            if(typeof(pattern[i]) == 'string') {
                if(toks[i] != pattern[i]) {
                    return false;
                }
            } else if(typeof(pattern[i]) == 'object') {
                if(pattern[i].constructor.name == 'RegExp') {
                    if(!pattern[i].test(toks[i])) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
};

Z80LineAssembler.parseNumLiteral = function(tok) {
    var n = Z80LineAssembler._parseNumLiteral(tok);
    if(typeof(n) == 'number') {
        if(n < -128 || 256 <= n) {
            throw 'operand ' + tok + ' out of range';
        }
        return n & 0xff;
    }
    return function(dictionary) {
        return Z80LineAssembler.dereferLowByte(tok, dictionary);
    };
};

Z80LineAssembler.parseNumLiteralPair = function(tok) {
    var n = Z80LineAssembler._parseNumLiteral(tok);
    if(typeof(n) == 'number') {
        if(n < -32768 || 65535 < n) {
            throw 'operand ' + tok + ' out of range';
        }
        return [n & 0xff, (n >> 8) & 0xff];
    }
    return [
        function(dictionary){ return Z80LineAssembler.dereferLowByte(tok, dictionary); },
        function(dictionary){ return Z80LineAssembler.dereferHighByte(tok, dictionary); }
    ];
};

Z80LineAssembler.parseRelAddr = function(tok, fromAddr) {
    var n = Z80LineAssembler._parseNumLiteral(tok);
    if(typeof(n) == 'number') {
        var c0 = tok.charAt(0);
        if(c0 != '+' && c0 != '-') {
            n = n - fromAddr + 2;
        }
        n -= 2;
        if(n < -128 || 256 <= n) {
            throw 'operand ' + tok + ' out of range';
        }
        return n & 0xff;
    }
    return function(dictionary) {
        return (Z80LineAssembler.derefer(tok, dictionary) - fromAddr) & 0xff;
    };
};

Z80LineAssembler.dereferLowByte = function(label, dictionary) {
    return Z80LineAssembler.derefer(label, dictionary) & 0xff;
};

Z80LineAssembler.dereferHighByte = function(label, dictionary) {
    return (Z80LineAssembler.derefer(label, dictionary) >> 8) & 0xff;
};

Z80LineAssembler.derefer = function(label, dictionary) {
    if(label in dictionary) {
        return dictionary[label];
    }
    return 0;
};

Z80LineAssembler._parseNumLiteral = function(tok) {
    if(/^[\+\-]?[0-9]+$/.test(tok) || /^[\+\-]?[0-9A-F]+H$/i.test(tok)) {
        var n = 0;
        var s = (/^\-/.test(tok) ? -1:1);
        if(/[hH]$/.test(tok)) {
            var matches = tok.match(/^[\+\-]?([0-9a-fA-F]+)[hH]$/);
            n = parseInt(matches[1], 16);
        } else if(/^[\+\-]?0/.test(tok)) {
            var matches = tok.match(/^[\+\-]?([0-7]+)$/);
            n = parseInt(matches[1], 8);
        } else {
            var matches = tok.match(/^[\+\-]?([0-9]+)$/);
            n = parseInt(matches[1], 10);
        }
        return s * n;
    }
    return tok;
};

