;======================================================
; filename  :   'testdata/NEWMON.ROM'
; filesize  :   4096 bytes
; load addr :   0000h
; start addr:   0000h
;======================================================
                ORG     0000H           
                JP      004AH           ; 0000H C3 4A 00
$0003H:         JP      07E6H           ; 0003H C3 E6 07
$0006H:         JP      090EH           ; 0006H C3 0E 09
$0009H:         JP      0918H           ; 0009H C3 18 09
$000CH:         JP      0920H           ; 000CH C3 20 09
                JP      007FH           ; 000FH C3 7F 00
$0012H:         JP      0935H           ; 0012H C3 35 09
$0015H:         JP      0981H           ; 0015H C3 81 09
                JP      0999H           ; 0018H C3 99 09
                JP      08BDH           ; 001BH C3 BD 08
$001EH:         JP      0A32H           ; 001EH C3 32 0A
                JP      0436H           ; 0021H C3 36 04
$0024H:         JP      0475H           ; 0024H C3 75 04
$0027H:         JP      04D8H           ; 0027H C3 D8 04
                JP      04F8H           ; 002AH C3 F8 04
$002DH:         JP      0588H           ; 002DH C3 88 05
                JP      01C7H           ; 0030H C3 C7 01
                JP      0308H           ; 0033H C3 08 03
                NOP                     ; 0036H 00
                NOP                     ; 0037H 00
                JP      1038H           ; 0038H C3 38 10
                JP      0358H           ; 003BH C3 58 03
$003EH:         JP      02E5H           ; 003EH C3 E5 02
                JP      02FAH           ; 0041H C3 FA 02
                JP      02ABH           ; 0044H C3 AB 02
                JP      02BEH           ; 0047H C3 BE 02
$004AH:         LD      SP,10F0H        ; 004AH 31 F0 10
                IM1                     ; 004DH ED 56
                CALL    0FC9H           ; 004FH CD C9 0F
                LD      A,16H           ; 0052H 3E 16
                RST     10H             ; 0054H D7
                LD      B,3CH           ; 0055H 06 3C
                LD      HL,1170H        ; 0057H 21 70 11
                CALL    0FD8H           ; 005AH CD D8 0F
                LD      HL,0392H        ; 005DH 21 92 03
                LD      A,C3H           ; 0060H 3E C3
                LD      (1038H),A       ; 0062H 32 38 10
                LD      (1039H),HL      ; 0065H 22 39 10
                LD      HL,0504H        ; 0068H 21 04 05
                LD      (119EH),HL      ; 006BH 22 9E 11
                CALL    02BEH           ; 006EH CD BE 02
                LD      DE,0141H        ; 0071H 11 41 01
                RST     18H             ; 0074H DF
                CALL    0AC0H           ; 0075H CD C0 0A
                JR      0082H;(+10)     ; 0078H 18 08
$007AH:         LD      DE,10F1H        ; 007AH 11 F1 10
                JR      0015H;(-104)    ; 007DH 18 96
$007FH:         JP      0926H           ; 007FH C3 26 09
$0082H:         LD      SP,10F0H        ; 0082H 31 F0 10
                LD      DE,0082H        ; 0085H 11 82 00
                PUSH    DE              ; 0088H D5
                CALL    0009H           ; 0089H CD 09 00
                LD      A,2AH           ; 008CH 3E 2A
$008EH:         RST     10H             ; 008EH D7
                LD      DE,11A3H        ; 008FH 11 A3 11
                CALL    0003H           ; 0092H CD 03 00
                LD      A,(DE)          ; 0095H 1A
                CP      2AH             ; 0096H FE 2A
                JP      NZ,0C54H        ; 0098H C2 54 0C
                INC     DE              ; 009BH 13
                LD      A,(DE)          ; 009CH 1A
                CP      47H             ; 009DH FE 47
                JP      Z,0159H         ; 009FH CA 59 01
                CP      46H             ; 00A2H FE 46
                JP      Z,F600H         ; 00A4H CA 00 F6
                CP      4DH             ; 00A7H FE 4D
                JP      Z,0C0FH         ; 00A9H CA 0F 0C
                CP      53H             ; 00ACH FE 53
                JP      Z,0C82H         ; 00AEH CA 82 0C
                CP      40H             ; 00B1H FE 40
                JP      Z,0E0EH         ; 00B3H CA 0E 0E
                CP      4CH             ; 00B6H FE 4C
                JR      Z,00D9H;(+33)   ; 00B8H 28 1F
                CP      50H             ; 00BAH FE 50
                JR      Z,00F4H;(+56)   ; 00BCH 28 36
                CP      52H             ; 00BEH FE 52
                JP      Z,01AAH         ; 00C0H CA AA 01
                CP      23H             ; 00C3H FE 23
                JP      Z,0212H         ; 00C5H CA 12 02
                JP      0A9BH           ; 00C8H C3 9B 0A
$00CBH:         CALL    00E8H           ; 00CBH CD E8 00
                CALL    002DH           ; 00CEH CD 2D 00
$00D1H:         JR      C,00DDH;(+12)   ; 00D1H 38 0A
                LD      DE,01C4H        ; 00D3H 11 C4 01
                RST     08H             ; 00D6H CF
                RST     18H             ; 00D7H DF
                RET                     ; 00D8H C9
$00D9H:         CALL    00E8H           ; 00D9H CD E8 00
                RST     28H             ; 00DCH EF
$00DDH:         JP      C,0167H         ; 00DDH DA 67 01
                LD      HL,(1106H)      ; 00E0H 2A 06 11
                LD      A,H             ; 00E3H 7C
                CP      12H             ; 00E4H FE 12
                RET     C               ; 00E6H D8
                JP      (HL)            ; 00E7H E9
$00E8H:         CALL    0027H           ; 00E8H CD 27 00
                JR      C,0082H;(-105)  ; 00EBH 38 95
                RST     08H             ; 00EDH CF
                LD      DE,0138H        ; 00EEH 11 38 01
                RST     18H             ; 00F1H DF
                JR      007AH;(-120)    ; 00F2H 18 86
$00F4H:         LD      DE,D000H        ; 00F4H 11 00 D0
                LD      C,19H           ; 00F7H 0E 19
$00F9H:         LD      B,28H           ; 00F9H 06 28
$00FBH:         LD      A,(DE)          ; 00FBH 1A
                CALL    0BCEH           ; 00FCH CD CE 0B
                CALL    010FH           ; 00FFH CD 0F 01
                INC     DE              ; 0102H 13
                DJNZ    00FBH;(-8)      ; 0103H 10 F6
                LD      A,0DH           ; 0105H 3E 0D
                CALL    010FH           ; 0107H CD 0F 01
                DEC     C               ; 010AH 0D
                JR      NZ,00F9H;(-18)  ; 010BH 20 EC
                RET                     ; 010DH C9
                PUSH    DE              ; 010EH D5
$010FH:         PUSH    AF              ; 010FH F5
$0110H:         IN      A,(254)         ; 0110H DB FE
                AND     0DH             ; 0112H E6 0D
                OR      A               ; 0114H B7
                JR      Z,011EH;(+9)    ; 0115H 28 07
                CALL    001EH           ; 0117H CD 1E 00
                JR      Z,0193H;(+121)  ; 011AH 28 77
                JR      0110H;(-12)     ; 011CH 18 F2
$011EH:         POP     AF              ; 011EH F1
                OUT     (255),A         ; 011FH D3 FF
                LD      A,80H           ; 0121H 3E 80
                OUT     (254),A         ; 0123H D3 FE
$0125H:         IN      A,(254)         ; 0125H DB FE
                AND     0DH             ; 0127H E6 0D
                CP      01H             ; 0129H FE 01
                JR      NZ,0125H;(-6)   ; 012BH 20 F8
                XOR     A               ; 012DH AF
                OUT     (254),A         ; 012EH D3 FE
                RET                     ; 0130H C9
                LD      B,(HL)          ; 0131H 46
                LD      C,A             ; 0132H 4F
                LD      D,L             ; 0133H 55
                LD      C,(HL)          ; 0134H 4E
                LD      B,H             ; 0135H 44
                JR      NZ,0145H;(+15)  ; 0136H 20 0D
                LD      C,H             ; 0138H 4C
                LD      C,A             ; 0139H 4F
                LD      B,C             ; 013AH 41
                LD      B,H             ; 013BH 44
                LD      C,C             ; 013CH 49
                LD      C,(HL)          ; 013DH 4E
                LD      B,A             ; 013EH 47
                JR      NZ,014EH;(+15)  ; 013FH 20 0D
                LD      HL,(202AH)      ; 0141H 2A 2A 20
                LD      C,L             ; 0144H 4D
$0145H:         LD      E,D             ; 0145H 5A
                SUB     A,B             ; 0146H 90
                LD      C,L             ; 0147H 4D
                LD      C,A             ; 0148H 4F
                LD      C,(HL)          ; 0149H 4E
                LD      C,C             ; 014AH 49
                LD      D,H             ; 014BH 54
                LD      C,A             ; 014CH 4F
                LD      D,D             ; 014DH 52
$014EH:         JR      NZ,01A6H;(+88)  ; 014EH 20 56
                LD      B,L             ; 0150H 45
                LD      D,D             ; 0151H 52
                INC     (HL)            ; 0152H 34
                LD      L,34H           ; 0153H 2E 34
                JR      NZ,0181H;(+44)  ; 0155H 20 2A
                LD      HL,(130DH)      ; 0157H 2A 0D 13
                LD      A,(DE)          ; 015AH 1A
                CP      4FH             ; 015BH FE 4F
                JR      NZ,0163H;(+6)   ; 015DH 20 04
                INC     DE              ; 015FH 13
                INC     DE              ; 0160H 13
                INC     DE              ; 0161H 13
                INC     DE              ; 0162H 13
$0163H:         CALL    0CC0H           ; 0163H CD C0 0C
                JP      (HL)            ; 0166H E9
$0167H:         CP      02H             ; 0167H FE 02
                RET     Z               ; 0169H C8
                RST     08H             ; 016AH CF
                LD      DE,01B5H        ; 016BH 11 B5 01
                RST     18H             ; 016EH DF
                RET                     ; 016FH C9
$0170H:         LD      A,FFH           ; 0170H 3E FF
$0172H:         LD      (119DH),A       ; 0172H 32 9D 11
                RET                     ; 0175H C9
$0176H:         XOR     A               ; 0176H AF
                JR      0172H;(-5)      ; 0177H 18 F9
                LD      HL,F000H        ; 0179H 21 00 F0
                LD      A,(HL)          ; 017CH 7E
                OR      A               ; 017DH B7
                RET     NZ              ; 017EH C0
                JP      (HL)            ; 017FH E9
                PUSH    BC              ; 0180H C5
$0181H:         PUSH    DE              ; 0181H D5
                PUSH    HL              ; 0182H E5
$0183H:         LD      A,(DE)          ; 0183H 1A
                CP      (HL)            ; 0184H BE
                JR      NZ,0192H;(+13)  ; 0185H 20 0B
                DEC     B               ; 0187H 05
                JR      Z,0192H;(+10)   ; 0188H 28 08
                CP      0DH             ; 018AH FE 0D
                JR      Z,0192H;(+6)    ; 018CH 28 04
                INC     DE              ; 018EH 13
                INC     HL              ; 018FH 23
                JR      0183H;(-13)     ; 0190H 18 F1
$0192H:         POP     HL              ; 0192H E1
$0193H:         POP     DE              ; 0193H D1
                POP     BC              ; 0194H C1
                RET                     ; 0195H C9
$0196H:         PUSH    AF              ; 0196H F5
                JP      0DADH           ; 0197H C3 AD 0D
                LD      A,FFH           ; 019AH 3E FF
                OUT     (224),A         ; 019CH D3 E0
                RET                     ; 019EH C9
$019FH:         LD      DE,0131H        ; 019FH 11 31 01
                RST     18H             ; 01A2H DF
                LD      DE,10F1H        ; 01A3H 11 F1 10
$01A6H:         RST     18H             ; 01A6H DF
                JP      0FE3H           ; 01A7H C3 E3 0F
$01AAH:         CALL    00E8H           ; 01AAH CD E8 00
                CALL    0FE3H           ; 01ADH CD E3 0F
                RST     28H             ; 01B0H EF
                JP      00D1H           ; 01B1H C3 D1 00
                NOP                     ; 01B4H 00
                LD      B,E             ; 01B5H 43
                LD      C,B             ; 01B6H 48
                LD      B,L             ; 01B7H 45
                LD      B,E             ; 01B8H 43
                LD      C,E             ; 01B9H 4B
                LD      D,E             ; 01BAH 53
                LD      D,L             ; 01BBH 55
                LD      C,L             ; 01BCH 4D
                JR      NZ,0204H;(+71)  ; 01BDH 20 45
                LD      D,D             ; 01BFH 52
                LD      D,D             ; 01C0H 52
                LD      C,A             ; 01C1H 4F
                LD      D,D             ; 01C2H 52
                DEC     C               ; 01C3H 0D
                LD      C,A             ; 01C4H 4F
                LD      C,E             ; 01C5H 4B
                DEC     C               ; 01C6H 0D
$01C7H:         PUSH    BC              ; 01C7H C5
                PUSH    DE              ; 01C8H D5
                PUSH    HL              ; 01C9H E5
                LD      A,02H           ; 01CAH 3E 02
                LD      (11A0H),A       ; 01CCH 32 A0 11
                LD      B,01H           ; 01CFH 06 01
$01D1H:         LD      A,(DE)          ; 01D1H 1A
                CP      0DH             ; 01D2H FE 0D
                JR      Z,01D8H;(+4)    ; 01D4H 28 02
                CP      C8H             ; 01D6H FE C8
$01D8H:         JR      Z,0208H;(+48)   ; 01D8H 28 2E
                CP      CFH             ; 01DAH FE CF
                JR      Z,01FCH;(+32)   ; 01DCH 28 1E
                CP      D7H             ; 01DEH FE D7
                JR      Z,0204H;(+36)   ; 01E0H 28 22
                CP      23H             ; 01E2H FE 23
                LD      HL,0271H        ; 01E4H 21 71 02
                JR      NZ,01ECH;(+5)   ; 01E7H 20 03
                LD      L,89H           ; 01E9H 2E 89
                INC     DE              ; 01EBH 13
$01ECH:         CALL    021CH           ; 01ECH CD 1C 02
                JR      C,01D1H;(-30)   ; 01EFH 38 E0
                CALL    02C8H           ; 01F1H CD C8 02
                JR      C,020BH;(+23)   ; 01F4H 38 15
                CALL    02ABH           ; 01F6H CD AB 02
                LD      B,C             ; 01F9H 41
                JR      01D1H;(-41)     ; 01FAH 18 D5
$01FCH:         LD      A,03H           ; 01FCH 3E 03
$01FEH:         LD      (11A0H),A       ; 01FEH 32 A0 11
                INC     DE              ; 0201H 13
                JR      01D1H;(-49)     ; 0202H 18 CD
$0204H:         LD      A,01H           ; 0204H 3E 01
                JR      01FEH;(-8)      ; 0206H 18 F6
$0208H:         CALL    02C8H           ; 0208H CD C8 02
$020BH:         PUSH    AF              ; 020BH F5
                CALL    02BEH           ; 020CH CD BE 02
                POP     AF              ; 020FH F1
                JR      0192H;(-126)    ; 0210H 18 80
$0212H:         INC     DE              ; 0212H 13
                CALL    041FH           ; 0213H CD 1F 04
                RET     C               ; 0216H D8
                CALL    010FH           ; 0217H CD 0F 01
                JR      0212H;(-8)      ; 021AH 18 F6
$021CH:         PUSH    BC              ; 021CH C5
                LD      B,08H           ; 021DH 06 08
                LD      A,(DE)          ; 021FH 1A
$0220H:         CP      (HL)            ; 0220H BE
                JR      Z,022CH;(+11)   ; 0221H 28 09
                INC     HL              ; 0223H 23
                INC     HL              ; 0224H 23
                INC     HL              ; 0225H 23
                DJNZ    0220H;(-6)      ; 0226H 10 F8
                SCF                     ; 0228H 37
                INC     DE              ; 0229H 13
                POP     BC              ; 022AH C1
                RET                     ; 022BH C9
$022CH:         INC     HL              ; 022CH 23
                PUSH    DE              ; 022DH D5
                LD      E,(HL)          ; 022EH 5E
                INC     HL              ; 022FH 23
                LD      D,(HL)          ; 0230H 56
                EX      DE,HL           ; 0231H EB
                LD      A,H             ; 0232H 7C
                OR      A               ; 0233H B7
                JR      Z,023FH;(+11)   ; 0234H 28 09
                LD      A,(11A0H)       ; 0236H 3A A0 11
$0239H:         DEC     A               ; 0239H 3D
                JR      Z,023FH;(+5)    ; 023AH 28 03
                ADD     HL,HL           ; 023CH 29
                JR      0239H;(-4)      ; 023DH 18 FA
$023FH:         LD      (11A1H),HL      ; 023FH 22 A1 11
                LD      A,02H           ; 0242H 3E 02
                LD      (11A0H),A       ; 0244H 32 A0 11
                POP     DE              ; 0247H D1
                INC     DE              ; 0248H 13
                LD      A,(DE)          ; 0249H 1A
                LD      B,A             ; 024AH 47
                AND     F0H             ; 024BH E6 F0
                CP      30H             ; 024DH FE 30
                JR      Z,0256H;(+7)    ; 024FH 28 05
                LD      A,(119FH)       ; 0251H 3A 9F 11
                JR      025DH;(+9)      ; 0254H 18 07
$0256H:         INC     DE              ; 0256H 13
                LD      A,B             ; 0257H 78
                AND     0FH             ; 0258H E6 0F
                LD      (119FH),A       ; 025AH 32 9F 11
$025DH:         LD      C,A             ; 025DH 4F
                LD      B,00H           ; 025EH 06 00
                LD      HL,02A1H        ; 0260H 21 A1 02
                ADD     HL,BC           ; 0263H 09
                LD      C,(HL)          ; 0264H 4E
                LD      A,(119EH)       ; 0265H 3A 9E 11
                LD      B,A             ; 0268H 47
                XOR     A               ; 0269H AF
$026AH:         ADD     A,C             ; 026AH 81
                DJNZ    026AH;(-1)      ; 026BH 10 FD
                POP     BC              ; 026DH C1
                LD      C,A             ; 026EH 4F
                XOR     A               ; 026FH AF
                RET                     ; 0270H C9
                LD      B,E             ; 0271H 43
                LD      (HL),A          ; 0272H 77
                RLCA                    ; 0273H 07
                LD      B,H             ; 0274H 44
                AND     A               ; 0275H A7
                LD      B,45H           ; 0276H 06 45
                DEFB    EDh; *** FAIL TO DISASSEMBLE WITH 05; 0278H ED
                DEC     B               ; 0279H 05
                LD      B,(HL)          ; 027AH 46
                SBC     A,B             ; 027BH 98
                DEC     B               ; 027CH 05
                LD      B,A             ; 027DH 47
                CALL    M,4104H         ; 027EH FC 04 41
                LD      (HL),C          ; 0281H 71
                INC     B               ; 0282H 04
                LD      B,D             ; 0283H 42
                PUSH    AF              ; 0284H F5
                INC     BC              ; 0285H 03
                LD      D,D             ; 0286H 52
                NOP                     ; 0287H 00
                NOP                     ; 0288H 00
                LD      B,E             ; 0289H 43
                INC     C               ; 028AH 0C
                RLCA                    ; 028BH 07
                LD      B,H             ; 028CH 44
                LD      B,A             ; 028DH 47
                LD      B,45H           ; 028EH 06 45
                SBC     A,B             ; 0290H 98
                DEC     B               ; 0291H 05
                LD      B,(HL)          ; 0292H 46
                LD      C,B             ; 0293H 48
                DEC     B               ; 0294H 05
                LD      B,A             ; 0295H 47
                OR      H               ; 0296H B4
                INC     B               ; 0297H 04
                LD      B,C             ; 0298H 41
                LD      SP,4204H        ; 0299H 31 04 42
                CP      E               ; 029CH BB
                INC     BC              ; 029DH 03
                LD      D,D             ; 029EH 52
                NOP                     ; 029FH 00
                NOP                     ; 02A0H 00
                LD      BC,0302H        ; 02A1H 01 02 03
                INC     B               ; 02A4H 04
                LD      B,08H           ; 02A5H 06 08
                INC     C               ; 02A7H 0C
                DJNZ    02C2H;(+26)     ; 02A8H 10 18
                JR      NZ,02D6H;(+44)  ; 02AAH 20 2A
                AND     C               ; 02ACH A1
                LD      DE,B77CH        ; 02ADH 11 7C B7
                JR      Z,02BEH;(+14)   ; 02B0H 28 0C
                PUSH    DE              ; 02B2H D5
                EX      DE,HL           ; 02B3H EB
                LD      HL,E004H        ; 02B4H 21 04 E0
                LD      (HL),E          ; 02B7H 73
                LD      (HL),D          ; 02B8H 72
                LD      A,01H           ; 02B9H 3E 01
                POP     DE              ; 02BBH D1
                JR      02C4H;(+8)      ; 02BCH 18 06
$02BEH:         LD      A,34H           ; 02BEH 3E 34
                LD      (E007H),A       ; 02C0H 32 07 E0
                XOR     A               ; 02C3H AF
$02C4H:         LD      (E008H),A       ; 02C4H 32 08 E0
                RET                     ; 02C7H C9
$02C8H:         LD      HL,E000H        ; 02C8H 21 00 E0
                LD      (HL),F9H        ; 02CBH 36 F9
                INC     HL              ; 02CDH 23
                LD      A,(HL)          ; 02CEH 7E
                AND     08H             ; 02CFH E6 08
                JR      NZ,02D5H;(+4)   ; 02D1H 20 02
                SCF                     ; 02D3H 37
                RET                     ; 02D4H C9
$02D5H:         LD      A,(E008H)       ; 02D5H 3A 08 E0
                RRCA                    ; 02D8H 0F
                JR      C,02D5H;(-4)    ; 02D9H 38 FA
$02DBH:         LD      A,(E008H)       ; 02DBH 3A 08 E0
                RRCA                    ; 02DEH 0F
                JR      NC,02DBH;(-4)   ; 02DFH 30 FA
                DJNZ    02D5H;(-12)     ; 02E1H 10 F2
                XOR     A               ; 02E3H AF
                RET                     ; 02E4H C9
$02E5H:         PUSH    BC              ; 02E5H C5
                PUSH    HL              ; 02E6H E5
                LD      HL,0471H        ; 02E7H 21 71 04
                CALL    02AEH           ; 02EAH CD AE 02
                LD      B,32H           ; 02EDH 06 32
$02EFH:         XOR     A               ; 02EFH AF
                CALL    075BH           ; 02F0H CD 5B 07
                DJNZ    02EFH;(-4)      ; 02F3H 10 FA
                POP     HL              ; 02F5H E1
                POP     BC              ; 02F6H C1
                JP      02BEH           ; 02F7H C3 BE 02
$02FAH:         PUSH    AF              ; 02FAH F5
                PUSH    BC              ; 02FBH C5
                AND     0FH             ; 02FCH E6 0F
                LD      B,A             ; 02FEH 47
                LD      A,08H           ; 02FFH 3E 08
                SUB     A,B             ; 0301H 90
                LD      (119EH),A       ; 0302H 32 9E 11
                POP     BC              ; 0305H C1
                POP     AF              ; 0306H F1
                RET                     ; 0307H C9
$0308H:         DI                      ; 0308H F3
                PUSH    BC              ; 0309H C5
                PUSH    DE              ; 030AH D5
                PUSH    HL              ; 030BH E5
                LD      (119BH),A       ; 030CH 32 9B 11
                LD      A,F0H           ; 030FH 3E F0
                LD      (119CH),A       ; 0311H 32 9C 11
                LD      HL,A8C0H        ; 0314H 21 C0 A8
                XOR     A               ; 0317H AF
                SBC     HL,DE           ; 0318H ED 52
$031AH:         PUSH    HL              ; 031AH E5
                INC     HL              ; 031BH 23
                EX      DE,HL           ; 031CH EB
                LD      A,74H           ; 031DH 3E 74
                LD      (E007H),A       ; 031FH 32 07 E0
                LD      A,B0H           ; 0322H 3E B0
                LD      (E007H),A       ; 0324H 32 07 E0
                LD      HL,E006H        ; 0327H 21 06 E0
                LD      (HL),E          ; 032AH 73
                LD      (HL),D          ; 032BH 72
                DEC     HL              ; 032CH 2B
                LD      (HL),0AH        ; 032DH 36 0A
                LD      (HL),00H        ; 032FH 36 00
                LD      A,80H           ; 0331H 3E 80
                LD      (E007H),A       ; 0333H 32 07 E0
                INC     HL              ; 0336H 23
$0337H:         LD      C,(HL)          ; 0337H 4E
                LD      A,(HL)          ; 0338H 7E
                CP      D               ; 0339H BA
                JR      NZ,0337H;(-3)   ; 033AH 20 FB
                LD      A,C             ; 033CH 79
                CP      E               ; 033DH BB
                JR      NZ,0337H;(-7)   ; 033EH 20 F7
                DEC     HL              ; 0340H 2B
                NOP                     ; 0341H 00
                NOP                     ; 0342H 00
                NOP                     ; 0343H 00
                LD      (HL),12H        ; 0344H 36 12
                LD      (HL),7AH        ; 0346H 36 7A
                INC     HL              ; 0348H 23
                POP     DE              ; 0349H D1
$034AH:         LD      C,(HL)          ; 034AH 4E
                LD      A,(HL)          ; 034BH 7E
                CP      D               ; 034CH BA
                JR      NZ,034AH;(-3)   ; 034DH 20 FB
                LD      A,C             ; 034FH 79
                CP      E               ; 0350H BB
                JR      NZ,034AH;(-7)   ; 0351H 20 F7
                POP     HL              ; 0353H E1
                POP     DE              ; 0354H D1
                POP     BC              ; 0355H C1
                EI                      ; 0356H FB
                RET                     ; 0357H C9
$0358H:         PUSH    HL              ; 0358H E5
                LD      A,80H           ; 0359H 3E 80
                LD      (E007H),A       ; 035BH 32 07 E0
                LD      HL,E006H        ; 035EH 21 06 E0
                DI                      ; 0361H F3
                LD      E,(HL)          ; 0362H 5E
                LD      D,(HL)          ; 0363H 56
                EI                      ; 0364H FB
                LD      A,E             ; 0365H 7B
                OR      D               ; 0366H B2
                JP      Z,0379H         ; 0367H CA 79 03
                XOR     A               ; 036AH AF
                LD      HL,A8C0H        ; 036BH 21 C0 A8
                SBC     HL,DE           ; 036EH ED 52
                JP      C,0383H         ; 0370H DA 83 03
                EX      DE,HL           ; 0373H EB
                LD      A,(119BH)       ; 0374H 3A 9B 11
                POP     HL              ; 0377H E1
                RET                     ; 0378H C9
$0379H:         LD      DE,A8C0H        ; 0379H 11 C0 A8
$037CH:         LD      A,(119BH)       ; 037CH 3A 9B 11
                XOR     01H             ; 037FH EE 01
                POP     HL              ; 0381H E1
                RET                     ; 0382H C9
$0383H:         DI                      ; 0383H F3
                LD      HL,E006H        ; 0384H 21 06 E0
                LD      A,(HL)          ; 0387H 7E
                CPL                     ; 0388H 2F
                LD      E,A             ; 0389H 5F
                LD      A,(HL)          ; 038AH 7E
                CPL                     ; 038BH 2F
                LD      D,A             ; 038CH 57
                EI                      ; 038DH FB
                INC     DE              ; 038EH 13
                JP      037CH           ; 038FH C3 7C 03
                PUSH    AF              ; 0392H F5
                PUSH    BC              ; 0393H C5
                PUSH    DE              ; 0394H D5
                PUSH    HL              ; 0395H E5
                LD      A,(119BH)       ; 0396H 3A 9B 11
                XOR     01H             ; 0399H EE 01
                LD      (119BH),A       ; 039BH 32 9B 11
                LD      A,80H           ; 039EH 3E 80
                LD      (E007H),A       ; 03A0H 32 07 E0
                LD      HL,E006H        ; 03A3H 21 06 E0
                LD      E,(HL)          ; 03A6H 5E
                LD      D,(HL)          ; 03A7H 56
                LD      HL,A8C0H        ; 03A8H 21 C0 A8
                ADD     HL,DE           ; 03ABH 19
                DEC     HL              ; 03ACH 2B
                DEC     HL              ; 03ADH 2B
                EX      DE,HL           ; 03AEH EB
                LD      HL,E006H        ; 03AFH 21 06 E0
                LD      (HL),E          ; 03B2H 73
                LD      (HL),D          ; 03B3H 72
                POP     HL              ; 03B4H E1
                POP     DE              ; 03B5H D1
                POP     BC              ; 03B6H C1
                POP     AF              ; 03B7H F1
                EI                      ; 03B8H FB
                RET                     ; 03B9H C9
$03BAH:         LD      A,H             ; 03BAH 7C
                CALL    03C3H           ; 03BBH CD C3 03
                LD      A,L             ; 03BEH 7D
                CALL    03C3H           ; 03BFH CD C3 03
                RET                     ; 03C2H C9
$03C3H:         PUSH    AF              ; 03C3H F5
                AND     F0H             ; 03C4H E6 F0
                RRCA                    ; 03C6H 0F
                RRCA                    ; 03C7H 0F
                RRCA                    ; 03C8H 0F
                RRCA                    ; 03C9H 0F
                CALL    03DAH           ; 03CAH CD DA 03
                CALL    0012H           ; 03CDH CD 12 00
                POP     AF              ; 03D0H F1
                AND     0FH             ; 03D1H E6 0F
                CALL    03DAH           ; 03D3H CD DA 03
                RST     10H             ; 03D6H D7
                LD      A,20H           ; 03D7H 3E 20
                RET                     ; 03D9H C9
$03DAH:         PUSH    DE              ; 03DAH D5
                PUSH    HL              ; 03DBH E5
                LD      HL,03E9H        ; 03DCH 21 E9 03
                AND     0FH             ; 03DFH E6 0F
                LD      E,A             ; 03E1H 5F
                LD      D,00H           ; 03E2H 16 00
                ADD     HL,DE           ; 03E4H 19
                LD      A,(HL)          ; 03E5H 7E
                POP     HL              ; 03E6H E1
                POP     DE              ; 03E7H D1
                RET                     ; 03E8H C9
                JR      NC,041CH;(+51)  ; 03E9H 30 31
                LD      (3433H),A       ; 03EBH 32 33 34
                DEC     (HL)            ; 03EEH 35
                LD      (HL),37H        ; 03EFH 36 37
                JR      C,042CH;(+59)   ; 03F1H 38 39
                LD      B,C             ; 03F3H 41
                LD      B,D             ; 03F4H 42
                LD      B,E             ; 03F5H 43
                LD      B,H             ; 03F6H 44
                LD      B,L             ; 03F7H 45
                LD      B,(HL)          ; 03F8H 46
$03F9H:         PUSH    BC              ; 03F9H C5
                PUSH    HL              ; 03FAH E5
                LD      BC,1000H        ; 03FBH 01 00 10
                LD      HL,03E9H        ; 03FEH 21 E9 03
$0401H:         CP      (HL)            ; 0401H BE
                JR      NZ,0407H;(+5)   ; 0402H 20 03
                LD      A,C             ; 0404H 79
                JR      040DH;(+8)      ; 0405H 18 06
$0407H:         INC     HL              ; 0407H 23
                INC     C               ; 0408H 0C
                DEC     B               ; 0409H 05
                JR      NZ,0401H;(-9)   ; 040AH 20 F5
                SCF                     ; 040CH 37
$040DH:         POP     HL              ; 040DH E1
                POP     BC              ; 040EH C1
                RET                     ; 040FH C9
$0410H:         PUSH    DE              ; 0410H D5
                CALL    041FH           ; 0411H CD 1F 04
                JR      C,041DH;(+9)    ; 0414H 38 07
                LD      H,A             ; 0416H 67
                CALL    041FH           ; 0417H CD 1F 04
                JR      C,041DH;(+3)    ; 041AH 38 01
$041CH:         LD      L,A             ; 041CH 6F
$041DH:         POP     DE              ; 041DH D1
                RET                     ; 041EH C9
$041FH:         PUSH    BC              ; 041FH C5
                LD      A,(DE)          ; 0420H 1A
                INC     DE              ; 0421H 13
                JP      06F1H           ; 0422H C3 F1 06
$0425H:         JR      C,0434H;(+15)   ; 0425H 38 0D
                RLCA                    ; 0427H 07
                RLCA                    ; 0428H 07
                RLCA                    ; 0429H 07
                RLCA                    ; 042AH 07
                LD      C,A             ; 042BH 4F
$042CH:         LD      A,(DE)          ; 042CH 1A
                INC     DE              ; 042DH 13
                CALL    03F9H           ; 042EH CD F9 03
                JR      C,0434H;(+3)    ; 0431H 38 01
                OR      C               ; 0433H B1
$0434H:         POP     BC              ; 0434H C1
                RET                     ; 0435H C9
$0436H:         DI                      ; 0436H F3
                PUSH    DE              ; 0437H D5
                PUSH    BC              ; 0438H C5
                PUSH    HL              ; 0439H E5
                LD      D,D7H           ; 043AH 16 D7
                LD      E,CCH           ; 043CH 1E CC
                LD      HL,10F0H        ; 043EH 21 F0 10
                LD      BC,0080H        ; 0441H 01 80 00
$0444H:         CALL    0733H           ; 0444H CD 33 07
                CALL    06B2H           ; 0447H CD B2 06
                JP      C,0563H         ; 044AH DA 63 05
                LD      A,E             ; 044DH 7B
                CP      CCH             ; 044EH FE CC
                JR      NZ,0463H;(+19)  ; 0450H 20 11
                CALL    0009H           ; 0452H CD 09 00
                PUSH    DE              ; 0455H D5
                LD      DE,046CH        ; 0456H 11 6C 04
                CALL    0015H           ; 0459H CD 15 00
                LD      DE,10F1H        ; 045CH 11 F1 10
                CALL    0015H           ; 045FH CD 15 00
                POP     DE              ; 0462H D1
$0463H:         CALL    07B8H           ; 0463H CD B8 07
                CALL    048DH           ; 0466H CD 8D 04
                JP      0563H           ; 0469H C3 63 05
                LD      D,A             ; 046CH 57
                LD      D,D             ; 046DH 52
                LD      C,C             ; 046EH 49
                LD      D,H             ; 046FH 54
                LD      C,C             ; 0470H 49
                LD      C,(HL)          ; 0471H 4E
                LD      B,A             ; 0472H 47
                JR      NZ,0482H;(+15)  ; 0473H 20 0D
$0475H:         DI                      ; 0475H F3
                PUSH    DE              ; 0476H D5
                PUSH    BC              ; 0477H C5
                PUSH    HL              ; 0478H E5
                LD      D,D7H           ; 0479H 16 D7
                LD      E,53H           ; 047BH 1E 53
                LD      HL,(1102H)      ; 047DH 2A 02 11
                PUSH    HL              ; 0480H E5
                POP     BC              ; 0481H C1
$0482H:         LD      HL,(1104H)      ; 0482H 2A 04 11
                LD      A,B             ; 0485H 78
                OR      C               ; 0486H B1
                JP      Z,04D4H         ; 0487H CA D4 04
                JP      0444H           ; 048AH C3 44 04
$048DH:         PUSH    DE              ; 048DH D5
                PUSH    BC              ; 048EH C5
                PUSH    HL              ; 048FH E5
                LD      A,(1037H)       ; 0490H 3A 37 10
                LD      D,A             ; 0493H 57
                LD      A,F9H           ; 0494H 3E F9
                LD      (E000H),A       ; 0496H 32 00 E0
$0499H:         LD      A,(HL)          ; 0499H 7E
                CALL    07A5H           ; 049AH CD A5 07
                LD      A,(E001H)       ; 049DH 3A 01 E0
                AND     08H             ; 04A0H E6 08
                JR      NZ,04A7H;(+5)   ; 04A2H 20 03
                SCF                     ; 04A4H 37
                JR      04D4H;(+47)     ; 04A5H 18 2D
$04A7H:         INC     HL              ; 04A7H 23
                DEC     BC              ; 04A8H 0B
                LD      A,B             ; 04A9H 78
                OR      C               ; 04AAH B1
                JP      NZ,0499H        ; 04ABH C2 99 04
                LD      HL,(1197H)      ; 04AEH 2A 97 11
                LD      A,H             ; 04B1H 7C
                CALL    07A5H           ; 04B2H CD A5 07
                LD      A,L             ; 04B5H 7D
                CALL    07A5H           ; 04B6H CD A5 07
                CALL    0780H           ; 04B9H CD 80 07
                DEC     D               ; 04BCH 15
                JP      NZ,04C4H        ; 04BDH C2 C4 04
                OR      A               ; 04C0H B7
                JP      04D4H           ; 04C1H C3 D4 04
$04C4H:         LD      B,00H           ; 04C4H 06 00
$04C6H:         CALL    0767H           ; 04C6H CD 67 07
                DEC     B               ; 04C9H 05
                JP      NZ,04C6H        ; 04CAH C2 C6 04
                POP     HL              ; 04CDH E1
                POP     BC              ; 04CEH C1
                PUSH    BC              ; 04CFH C5
                PUSH    HL              ; 04D0H E5
                JP      0499H           ; 04D1H C3 99 04
$04D4H:         POP     HL              ; 04D4H E1
                POP     BC              ; 04D5H C1
                POP     DE              ; 04D6H D1
                RET                     ; 04D7H C9
$04D8H:         DI                      ; 04D8H F3
                PUSH    DE              ; 04D9H D5
                PUSH    BC              ; 04DAH C5
                PUSH    HL              ; 04DBH E5
                LD      D,D2H           ; 04DCH 16 D2
                LD      E,CCH           ; 04DEH 1E CC
                LD      BC,0080H        ; 04E0H 01 80 00
                LD      HL,10F0H        ; 04E3H 21 F0 10
$04E6H:         CALL    06B2H           ; 04E6H CD B2 06
                JP      C,0582H         ; 04E9H DA 82 05
                CALL    065EH           ; 04ECH CD 5E 06
                JP      C,0582H         ; 04EFH DA 82 05
                CALL    0510H           ; 04F2H CD 10 05
                JP      0563H           ; 04F5H C3 63 05
$04F8H:         DI                      ; 04F8H F3
                PUSH    DE              ; 04F9H D5
                PUSH    BC              ; 04FAH C5
                PUSH    HL              ; 04FBH E5
                LD      D,D2H           ; 04FCH 16 D2
                LD      E,53H           ; 04FEH 1E 53
                LD      HL,(1102H)      ; 0500H 2A 02 11
                PUSH    HL              ; 0503H E5
                POP     BC              ; 0504H C1
                LD      HL,(1104H)      ; 0505H 2A 04 11
                LD      A,B             ; 0508H 78
                OR      C               ; 0509H B1
                JP      Z,0563H         ; 050AH CA 63 05
                JP      04E6H           ; 050DH C3 E6 04
$0510H:         PUSH    DE              ; 0510H D5
                PUSH    BC              ; 0511H C5
                PUSH    HL              ; 0512H E5
                LD      HL,(1036H)      ; 0513H 2A 36 10
$0516H:         LD      BC,E001H        ; 0516H 01 01 E0
                LD      DE,E002H        ; 0519H 11 02 E0
$051CH:         CALL    0601H           ; 051CH CD 01 06
                JR      C,0582H;(+99)   ; 051FH 38 61
                CALL    0655H           ; 0521H CD 55 06
                LD      A,(DE)          ; 0524H 1A
                AND     20H             ; 0525H E6 20
                JR      Z,051CH;(-11)   ; 0527H 28 F3
                LD      D,H             ; 0529H 54
                LD      HL,0000H        ; 052AH 21 00 00
                LD      (1197H),HL      ; 052DH 22 97 11
                POP     HL              ; 0530H E1
                POP     BC              ; 0531H C1
                PUSH    BC              ; 0532H C5
                PUSH    HL              ; 0533H E5
$0534H:         CALL    0624H           ; 0534H CD 24 06
                JR      C,0582H;(+75)   ; 0537H 38 49
                LD      (HL),A          ; 0539H 77
                INC     HL              ; 053AH 23
                DEC     BC              ; 053BH 0B
                LD      A,B             ; 053CH 78
                OR      C               ; 053DH B1
                JR      NZ,0534H;(-10)  ; 053EH 20 F4
                LD      HL,(1197H)      ; 0540H 2A 97 11
                CALL    0624H           ; 0543H CD 24 06
                JR      C,0582H;(+60)   ; 0546H 38 3A
                LD      E,A             ; 0548H 5F
                CALL    0624H           ; 0549H CD 24 06
                JR      C,0582H;(+54)   ; 054CH 38 34
                CP      L               ; 054EH BD
                JR      NZ,0574H;(+37)  ; 054FH 20 23
                LD      A,E             ; 0551H 7B
                CP      H               ; 0552H BC
                JR      NZ,0574H;(+33)  ; 0553H 20 1F
                JR      0562H;(+13)     ; 0555H 18 0B
$0557H:         LD      A,01H           ; 0557H 3E 01
$0559H:         LD      (1037H),A       ; 0559H 32 37 10
                RET                     ; 055CH C9
$055DH:         LD      A,02H           ; 055DH 3E 02
                JR      0559H;(-6)      ; 055FH 18 F8
                NOP                     ; 0561H 00
$0562H:         XOR     A               ; 0562H AF
$0563H:         POP     HL              ; 0563H E1
                POP     BC              ; 0564H C1
                POP     DE              ; 0565H D1
                CALL    0700H           ; 0566H CD 00 07
                PUSH    AF              ; 0569H F5
                LD      A,(119CH)       ; 056AH 3A 9C 11
                CP      F0H             ; 056DH FE F0
                JR      NZ,0572H;(+3)   ; 056FH 20 01
                EI                      ; 0571H FB
$0572H:         POP     AF              ; 0572H F1
                RET                     ; 0573H C9
$0574H:         DEC     D               ; 0574H 15
                JP      Z,057CH         ; 0575H CA 7C 05
                LD      H,D             ; 0578H 62
                JP      0516H           ; 0579H C3 16 05
$057CH:         LD      A,01H           ; 057CH 3E 01
                SCF                     ; 057EH 37
                JP      0563H           ; 057FH C3 63 05
$0582H:         LD      A,02H           ; 0582H 3E 02
                SCF                     ; 0584H 37
                JP      0563H           ; 0585H C3 63 05
$0588H:         DI                      ; 0588H F3
                PUSH    DE              ; 0589H D5
                PUSH    BC              ; 058AH C5
                PUSH    HL              ; 058BH E5
                LD      HL,(1102H)      ; 058CH 2A 02 11
                PUSH    HL              ; 058FH E5
                POP     BC              ; 0590H C1
                LD      HL,(1104H)      ; 0591H 2A 04 11
                LD      D,D2H           ; 0594H 16 D2
                LD      E,53H           ; 0596H 1E 53
                LD      A,B             ; 0598H 78
                OR      C               ; 0599H B1
                JP      Z,0563H         ; 059AH CA 63 05
                CALL    0733H           ; 059DH CD 33 07
                CALL    06B2H           ; 05A0H CD B2 06
                JP      C,0582H         ; 05A3H DA 82 05
                CALL    065EH           ; 05A6H CD 5E 06
                JP      C,0582H         ; 05A9H DA 82 05
                CALL    05B2H           ; 05ACH CD B2 05
                JP      0563H           ; 05AFH C3 63 05
$05B2H:         PUSH    DE              ; 05B2H D5
                PUSH    BC              ; 05B3H C5
                PUSH    HL              ; 05B4H E5
                LD      HL,(1036H)      ; 05B5H 2A 36 10
$05B8H:         LD      BC,E001H        ; 05B8H 01 01 E0
                LD      DE,E002H        ; 05BBH 11 02 E0
$05BEH:         CALL    0601H           ; 05BEH CD 01 06
                JR      C,0582H;(-63)   ; 05C1H 38 BF
                CALL    0655H           ; 05C3H CD 55 06
                LD      A,(DE)          ; 05C6H 1A
                AND     20H             ; 05C7H E6 20
                JR      Z,05BEH;(-11)   ; 05C9H 28 F3
                LD      D,H             ; 05CBH 54
                POP     HL              ; 05CCH E1
                POP     BC              ; 05CDH C1
                PUSH    BC              ; 05CEH C5
                PUSH    HL              ; 05CFH E5
$05D0H:         CALL    0624H           ; 05D0H CD 24 06
                JR      C,0582H;(-81)   ; 05D3H 38 AD
                CP      (HL)            ; 05D5H BE
                JR      NZ,057CH;(-90)  ; 05D6H 20 A4
                INC     HL              ; 05D8H 23
                DEC     BC              ; 05D9H 0B
                LD      A,B             ; 05DAH 78
                OR      C               ; 05DBH B1
                JR      NZ,05D0H;(-12)  ; 05DCH 20 F2
                LD      HL,(1199H)      ; 05DEH 2A 99 11
                CALL    0624H           ; 05E1H CD 24 06
                CP      H               ; 05E4H BC
                JR      NZ,057CH;(-105) ; 05E5H 20 95
                CALL    0624H           ; 05E7H CD 24 06
                CP      L               ; 05EAH BD
                JR      NZ,057CH;(-111) ; 05EBH 20 8F
                DEC     D               ; 05EDH 15
                JP      Z,0562H         ; 05EEH CA 62 05
                LD      H,D             ; 05F1H 62
                JP      05B8H           ; 05F2H C3 B8 05
$05F5H:         LD      A,B             ; 05F5H 78
                LD      B,C0H           ; 05F6H 06 C0
                ADD     A,B             ; 05F8H 80
                JR      NC,05FDH;(+4)   ; 05F9H 30 02
                SUB     A,40H           ; 05FBH D6 40
$05FDH:         LD      B,A             ; 05FDH 47
                JP      083AH           ; 05FEH C3 3A 08
$0601H:         LD      A,F9H           ; 0601H 3E F9
                LD      (E000H),A       ; 0603H 32 00 E0
                NOP                     ; 0606H 00
$0607H:         LD      A,(BC)          ; 0607H 0A
                AND     08H             ; 0608H E6 08
                JP      NZ,060FH        ; 060AH C2 0F 06
                SCF                     ; 060DH 37
                RET                     ; 060EH C9
$060FH:         LD      A,(DE)          ; 060FH 1A
                AND     20H             ; 0610H E6 20
                JP      NZ,0607H        ; 0612H C2 07 06
$0615H:         LD      A,(BC)          ; 0615H 0A
                AND     08H             ; 0616H E6 08
                JP      NZ,061DH        ; 0618H C2 1D 06
                SCF                     ; 061BH 37
                RET                     ; 061CH C9
$061DH:         LD      A,(DE)          ; 061DH 1A
                AND     20H             ; 061EH E6 20
                JP      Z,0615H         ; 0620H CA 15 06
                RET                     ; 0623H C9
$0624H:         PUSH    BC              ; 0624H C5
                PUSH    DE              ; 0625H D5
                PUSH    HL              ; 0626H E5
                LD      HL,0800H        ; 0627H 21 00 08
                LD      BC,E001H        ; 062AH 01 01 E0
                LD      DE,E002H        ; 062DH 11 02 E0
$0630H:         CALL    0601H           ; 0630H CD 01 06
                JR      C,0651H;(+30)   ; 0633H 38 1C
                CALL    0655H           ; 0635H CD 55 06
                LD      A,(DE)          ; 0638H 1A
                AND     20H             ; 0639H E6 20
                JR      Z,0647H;(+12)   ; 063BH 28 0A
                PUSH    HL              ; 063DH E5
                LD      HL,(1197H)      ; 063EH 2A 97 11
                INC     HL              ; 0641H 23
                LD      (1197H),HL      ; 0642H 22 97 11
                POP     HL              ; 0645H E1
                SCF                     ; 0646H 37
$0647H:         LD      A,L             ; 0647H 7D
                RLA                     ; 0648H 17
                LD      L,A             ; 0649H 6F
                DEC     H               ; 064AH 25
                JR      NZ,0630H;(-27)  ; 064BH 20 E3
                CALL    0601H           ; 064DH CD 01 06
                LD      A,L             ; 0650H 7D
$0651H:         POP     HL              ; 0651H E1
                POP     DE              ; 0652H D1
                POP     BC              ; 0653H C1
                RET                     ; 0654H C9
$0655H:         LD      A,(1035H)       ; 0655H 3A 35 10
$0658H:         DEC     A               ; 0658H 3D
                JR      NZ,0658H;(-1)   ; 0659H 20 FD
                JR      NZ,065DH;(+2)   ; 065BH 20 00
$065DH:         RET                     ; 065DH C9
$065EH:         PUSH    BC              ; 065EH C5
                PUSH    DE              ; 065FH D5
                PUSH    HL              ; 0660H E5
                LD      HL,2828H        ; 0661H 21 28 28
                LD      A,E             ; 0664H 7B
                CP      CCH             ; 0665H FE CC
                JR      Z,066CH;(+5)    ; 0667H 28 03
                LD      HL,1414H        ; 0669H 21 14 14
$066CH:         LD      (1195H),HL      ; 066CH 22 95 11
                LD      BC,E001H        ; 066FH 01 01 E0
                LD      DE,E002H        ; 0672H 11 02 E0
$0675H:         LD      HL,(1195H)      ; 0675H 2A 95 11
$0678H:         CALL    0601H           ; 0678H CD 01 06
                JR      C,069BH;(+32)   ; 067BH 38 1E
                CALL    0655H           ; 067DH CD 55 06
                LD      A,(DE)          ; 0680H 1A
                AND     20H             ; 0681H E6 20
                JR      Z,0675H;(-14)   ; 0683H 28 F0
                DEC     H               ; 0685H 25
                JR      NZ,0678H;(-14)  ; 0686H 20 F0
$0688H:         CALL    0601H           ; 0688H CD 01 06
                JR      C,069BH;(+16)   ; 068BH 38 0E
                CALL    0655H           ; 068DH CD 55 06
                LD      A,(DE)          ; 0690H 1A
                AND     20H             ; 0691H E6 20
                JR      NZ,0675H;(-30)  ; 0693H 20 E0
                DEC     L               ; 0695H 2D
                JR      NZ,0688H;(-14)  ; 0696H 20 F0
                CALL    0601H           ; 0698H CD 01 06
$069BH:         POP     HL              ; 069BH E1
                POP     DE              ; 069CH D1
                POP     BC              ; 069DH C1
                RET                     ; 069EH C9
$069FH:         JP      NZ,05F5H        ; 069FH C2 F5 05
                LD      A,28H           ; 06A2H 3E 28
                LD      HL,(1171H)      ; 06A4H 2A 71 11
                SUB     A,L             ; 06A7H 95
                LD      B,A             ; 06A8H 47
                CALL    0FB1H           ; 06A9H CD B1 0F
                CALL    0FD8H           ; 06ACH CD D8 0F
                JP      07EEH           ; 06AFH C3 EE 07
$06B2H:         PUSH    BC              ; 06B2H C5
                PUSH    DE              ; 06B3H D5
                PUSH    HL              ; 06B4H E5
                LD      C,0AH           ; 06B5H 0E 0A
$06B7H:         LD      A,(E002H)       ; 06B7H 3A 02 E0
                AND     10H             ; 06BAH E6 10
                JR      Z,06C3H;(+7)    ; 06BCH 28 05
$06BEH:         XOR     A               ; 06BEH AF
$06BFH:         POP     HL              ; 06BFH E1
                POP     DE              ; 06C0H D1
                POP     BC              ; 06C1H C1
                RET                     ; 06C2H C9
$06C3H:         LD      A,06H           ; 06C3H 3E 06
                LD      HL,E003H        ; 06C5H 21 03 E0
                LD      (HL),A          ; 06C8H 77
                INC     A               ; 06C9H 3C
                LD      (HL),A          ; 06CAH 77
                DEC     C               ; 06CBH 0D
                JR      NZ,06B7H;(-21)  ; 06CCH 20 E9
                RST     08H             ; 06CEH CF
                LD      A,D             ; 06CFH 7A
                CP      D7H             ; 06D0H FE D7
                JR      Z,06DAH;(+8)    ; 06D2H 28 06
                LD      DE,0722H        ; 06D4H 11 22 07
                RST     18H             ; 06D7H DF
                JR      06E2H;(+10)     ; 06D8H 18 08
$06DAH:         LD      DE,0729H        ; 06DAH 11 29 07
                RST     18H             ; 06DDH DF
                LD      DE,0724H        ; 06DEH 11 24 07
                RST     18H             ; 06E1H DF
$06E2H:         LD      A,(E002H)       ; 06E2H 3A 02 E0
                AND     10H             ; 06E5H E6 10
                JR      NZ,06BEH;(-41)  ; 06E7H 20 D5
                CALL    0A44H           ; 06E9H CD 44 0A
                JR      NZ,06E2H;(-10)  ; 06ECH 20 F4
                SCF                     ; 06EEH 37
                JR      06BFH;(-48)     ; 06EFH 18 CE
$06F1H:         CP      2FH             ; 06F1H FE 2F
                JR      Z,06FBH;(+8)    ; 06F3H 28 06
                CALL    03F9H           ; 06F5H CD F9 03
                JP      0425H           ; 06F8H C3 25 04
$06FBH:         LD      A,(DE)          ; 06FBH 1A
                INC     DE              ; 06FCH 13
                JP      0434H           ; 06FDH C3 34 04
$0700H:         PUSH    AF              ; 0700H F5
                PUSH    BC              ; 0701H C5
                PUSH    DE              ; 0702H D5
                LD      B,0AH           ; 0703H 06 0A
$0705H:         LD      A,(E002H)       ; 0705H 3A 02 E0
                AND     10H             ; 0708H E6 10
                JR      NZ,0710H;(+6)   ; 070AH 20 04
                POP     DE              ; 070CH D1
                POP     BC              ; 070DH C1
                POP     AF              ; 070EH F1
                RET                     ; 070FH C9
$0710H:         LD      A,06H           ; 0710H 3E 06
                LD      (E003H),A       ; 0712H 32 03 E0
                LD      A,07H           ; 0715H 3E 07
                LD      (E003H),A       ; 0717H 32 03 E0
                DEC     B               ; 071AH 05
                JP      NZ,0705H        ; 071BH C2 05 07
                POP     DE              ; 071EH D1
                POP     BC              ; 071FH C1
                POP     AF              ; 0720H F1
                RET                     ; 0721H C9
                LD      A,A             ; 0722H 7F
                JR      NZ,0775H;(+82)  ; 0723H 20 50
                LD      C,H             ; 0725H 4C
                LD      B,C             ; 0726H 41
                LD      E,C             ; 0727H 59
                DEC     C               ; 0728H 0D
                LD      A,A             ; 0729H 7F
                JR      NZ,077EH;(+84)  ; 072AH 20 52
                LD      B,L             ; 072CH 45
                LD      B,E             ; 072DH 43
                LD      C,A             ; 072EH 4F
                LD      D,D             ; 072FH 52
                LD      B,H             ; 0730H 44
                LD      L,0DH           ; 0731H 2E 0D
$0733H:         PUSH    BC              ; 0733H C5
                PUSH    DE              ; 0734H D5
                PUSH    HL              ; 0735H E5
                LD      DE,0000H        ; 0736H 11 00 00
$0739H:         LD      A,B             ; 0739H 78
                OR      C               ; 073AH B1
                JR      NZ,0748H;(+13)  ; 073BH 20 0B
                EX      DE,HL           ; 073DH EB
                LD      (1197H),HL      ; 073EH 22 97 11
                LD      (1199H),HL      ; 0741H 22 99 11
                POP     HL              ; 0744H E1
                POP     DE              ; 0745H D1
                POP     BC              ; 0746H C1
                RET                     ; 0747H C9
$0748H:         LD      A,(HL)          ; 0748H 7E
                PUSH    HL              ; 0749H E5
                LD      H,08H           ; 074AH 26 08
$074CH:         RLCA                    ; 074CH 07
                JR      NC,0750H;(+3)   ; 074DH 30 01
                INC     DE              ; 074FH 13
$0750H:         DEC     H               ; 0750H 25
                JR      NZ,074CH;(-5)   ; 0751H 20 F9
                POP     HL              ; 0753H E1
                INC     HL              ; 0754H 23
                DEC     BC              ; 0755H 0B
                JR      0739H;(-29)     ; 0756H 18 E1
$0758H:         LD      A,(1036H)       ; 0758H 3A 36 10
$075BH:         DEC     A               ; 075BH 3D
                JR      NZ,075BH;(-1)   ; 075CH 20 FD
                RET                     ; 075EH C9
$075FH:         LD      A,(0037H)       ; 075FH 3A 37 00
$0762H:         JR      0758H;(-10)     ; 0762H 18 F4
                NOP                     ; 0764H 00
                NOP                     ; 0765H 00
                NOP                     ; 0766H 00
$0767H:         PUSH    AF              ; 0767H F5
                LD      A,03H           ; 0768H 3E 03
                LD      (E003H),A       ; 076AH 32 03 E0
                CALL    075FH           ; 076DH CD 5F 07
                LD      A,02H           ; 0770H 3E 02
                LD      (E003H),A       ; 0772H 32 03 E0
$0775H:         CALL    075FH           ; 0775H CD 5F 07
                POP     AF              ; 0778H F1
                RET                     ; 0779H C9
$077AH:         EX      AF,AF'          ; 077AH 08
                JP      09E4H           ; 077BH C3 E4 09
$077EH:         NOP                     ; 077EH 00
                NOP                     ; 077FH 00
$0780H:         PUSH    AF              ; 0780H F5
                LD      A,03H           ; 0781H 3E 03
                LD      (E003H),A       ; 0783H 32 03 E0
                CALL    075FH           ; 0786H CD 5F 07
                CALL    075FH           ; 0789H CD 5F 07
                LD      A,02H           ; 078CH 3E 02
                LD      (E003H),A       ; 078EH 32 03 E0
                CALL    075FH           ; 0791H CD 5F 07
                CALL    0762H           ; 0794H CD 62 07
                POP     AF              ; 0797H F1
                RET                     ; 0798H C9
$0799H:         LD      A,00H           ; 0799H 3E 00
                LD      (1034H),A       ; 079BH 32 34 10
$079EH:         LD      HL,1926H        ; 079EH 21 26 19
                LD      (1035H),HL      ; 07A1H 22 35 10
                RET                     ; 07A4H C9
$07A5H:         PUSH    BC              ; 07A5H C5
                LD      B,08H           ; 07A6H 06 08
                CALL    0780H           ; 07A8H CD 80 07
$07ABH:         RLCA                    ; 07ABH 07
                CALL    C,0780H         ; 07ACH DC 80 07
                CALL    NC,0767H        ; 07AFH D4 67 07
                DEC     B               ; 07B2H 05
                JP      NZ,07ABH        ; 07B3H C2 AB 07
                POP     BC              ; 07B6H C1
                RET                     ; 07B7H C9
$07B8H:         PUSH    BC              ; 07B8H C5
                PUSH    DE              ; 07B9H D5
                LD      A,E             ; 07BAH 7B
                LD      BC,2AF8H        ; 07BBH 01 F8 2A
                LD      DE,2828H        ; 07BEH 11 28 28
                CP      CCH             ; 07C1H FE CC
                JP      Z,07CCH         ; 07C3H CA CC 07
                LD      BC,0ABEH        ; 07C6H 01 BE 0A
                LD      DE,1414H        ; 07C9H 11 14 14
$07CCH:         CALL    0767H           ; 07CCH CD 67 07
                DEC     BC              ; 07CFH 0B
                LD      A,B             ; 07D0H 78
                OR      C               ; 07D1H B1
                JR      NZ,07CCH;(-6)   ; 07D2H 20 F8
$07D4H:         CALL    0780H           ; 07D4H CD 80 07
                DEC     D               ; 07D7H 15
                JR      NZ,07D4H;(-4)   ; 07D8H 20 FA
$07DAH:         CALL    0767H           ; 07DAH CD 67 07
                DEC     E               ; 07DDH 1D
                JR      NZ,07DAH;(-4)   ; 07DEH 20 FA
                CALL    0780H           ; 07E0H CD 80 07
                POP     DE              ; 07E3H D1
                POP     BC              ; 07E4H C1
                RET                     ; 07E5H C9
$07E6H:         PUSH    AF              ; 07E6H F5
                PUSH    BC              ; 07E7H C5
                PUSH    HL              ; 07E8H E5
                PUSH    DE              ; 07E9H D5
                XOR     A               ; 07EAH AF
                LD      (1193H),A       ; 07EBH 32 93 11
$07EEH:         CALL    09B3H           ; 07EEH CD B3 09
                LD      B,A             ; 07F1H 47
                LD      A,(119DH)       ; 07F2H 3A 9D 11
                OR      A               ; 07F5H B7
                CALL    Z,0C6DH         ; 07F6H CC 6D 0C
                LD      A,B             ; 07F9H 78
                AND     F0H             ; 07FAH E6 F0
                CP      C0H             ; 07FCH FE C0
                JR      NZ,0837H;(+57)  ; 07FEH 20 37
                LD      A,B             ; 0800H 78
                CP      CDH             ; 0801H FE CD
                JR      Z,085BH;(+88)   ; 0803H 28 56
                CP      C9H             ; 0805H FE C9
                JR      Z,0826H;(+31)   ; 0807H 28 1D
                CP      CAH             ; 0809H FE CA
                JR      Z,0821H;(+22)   ; 080BH 28 14
                CP      CBH             ; 080DH FE CB
                JP      Z,08B3H         ; 080FH CA B3 08
                CP      C8H             ; 0812H FE C8
                JR      Z,0821H;(+13)   ; 0814H 28 0B
                CP      C7H             ; 0816H FE C7
                JR      Z,0821H;(+9)    ; 0818H 28 07
                LD      A,(1193H)       ; 081AH 3A 93 11
                OR      A               ; 081DH B7
                JR      NZ,083CH;(+30)  ; 081EH 20 1C
                LD      A,B             ; 0820H 78
$0821H:         CALL    0DDCH           ; 0821H CD DC 0D
                JR      07EEH;(-54)     ; 0824H 18 C8
$0826H:         LD      HL,1170H        ; 0826H 21 70 11
                XOR     A               ; 0829H AF
                CP      (HL)            ; 082AH BE
                JR      NZ,082EH;(+3)   ; 082BH 20 01
                INC     A               ; 082DH 3C
$082EH:         LD      (HL),A          ; 082EH 77
                SUB     A,06H           ; 082FH D6 06
                CPL                     ; 0831H 2F
                LD      (E003H),A       ; 0832H 32 03 E0
                JR      07EEH;(-71)     ; 0835H 18 B7
$0837H:         CALL    0A44H           ; 0837H CD 44 0A
$083AH:         JR      Z,08A6H;(+108)  ; 083AH 28 6A
$083CH:         LD      A,B             ; 083CH 78
                CALL    0DA6H           ; 083DH CD A6 0D
                CALL    0DB5H           ; 0840H CD B5 0D
                CP      62H             ; 0843H FE 62
                JR      NZ,07EEH;(-87)  ; 0845H 20 A7
                LD      HL,1193H        ; 0847H 21 93 11
                LD      A,(HL)          ; 084AH 7E
                CPL                     ; 084BH 2F
                LD      (HL),A          ; 084CH 77
                JR      07EEH;(-95)     ; 084DH 18 9F
$084FH:         CP      D7H             ; 084FH FE D7
                JP      Z,0F42H         ; 0851H CA 42 0F
                CP      D5H             ; 0854H FE D5
                CP      DCH             ; 0856H FE DC
                JP      069FH           ; 0858H C3 9F 06
$085BH:         LD      HL,(1171H)      ; 085BH 2A 71 11
                LD      E,H             ; 085EH 5C
                LD      D,00H           ; 085FH 16 00
                LD      HL,1173H        ; 0861H 21 73 11
                ADD     HL,DE           ; 0864H 19
                EX      DE,HL           ; 0865H EB
                LD      A,(DE)          ; 0866H 1A
                OR      A               ; 0867H B7
                LD      BC,0028H        ; 0868H 01 28 00
                LD      HL,(1171H)      ; 086BH 2A 71 11
                JP      NZ,087AH        ; 086EH C2 7A 08
                INC     DE              ; 0871H 13
                LD      A,(DE)          ; 0872H 1A
                OR      A               ; 0873H B7
                JP      Z,087DH         ; 0874H CA 7D 08
                JP      087BH           ; 0877H C3 7B 08
$087AH:         DEC     H               ; 087AH 25
$087BH:         LD      C,50H           ; 087BH 0E 50
$087DH:         LD      L,00H           ; 087DH 2E 00
                CALL    0FB4H           ; 087FH CD B4 0F
                POP     DE              ; 0882H D1
                PUSH    DE              ; 0883H D5
                PUSH    BC              ; 0884H C5
                CALL    0DA6H           ; 0885H CD A6 0D
                LDIR                    ; 0888H ED B0
                POP     BC              ; 088AH C1
                POP     HL              ; 088BH E1
                PUSH    HL              ; 088CH E5
                LD      B,C             ; 088DH 41
$088EH:         LD      A,(HL)          ; 088EH 7E
                CALL    0BCEH           ; 088FH CD CE 0B
                LD      (HL),A          ; 0892H 77
                INC     HL              ; 0893H 23
                DJNZ    088EH;(-6)      ; 0894H 10 F8
$0896H:         LD      (HL),0DH        ; 0896H 36 0D
                DEC     HL              ; 0898H 2B
                LD      A,(HL)          ; 0899H 7E
                CP      20H             ; 089AH FE 20
                JR      Z,0896H;(-6)    ; 089CH 28 F8
$089EH:         CALL    0006H           ; 089EH CD 06 00
                POP     DE              ; 08A1H D1
                POP     HL              ; 08A2H E1
                POP     BC              ; 08A3H C1
                POP     AF              ; 08A4H F1
                RET                     ; 08A5H C9
$08A6H:         LD      A,B             ; 08A6H 78
                CP      D1H             ; 08A7H FE D1
                JP      Z,0DF6H         ; 08A9H CA F6 0D
                CP      D3H             ; 08ACH FE D3
                JP      Z,0E29H         ; 08AEH CA 29 0E
                JR      084FH;(-98)     ; 08B1H 18 9C
$08B3H:         POP     HL              ; 08B3H E1
                PUSH    HL              ; 08B4H E5
                LD      (HL),1BH        ; 08B5H 36 1B
                INC     HL              ; 08B7H 23
                LD      (HL),0DH        ; 08B8H 36 0D
                JR      089EH;(-28)     ; 08BAH 18 E2
                NOP                     ; 08BCH 00
$08BDH:         CALL    08CAH           ; 08BDH CD CA 08
                CP      F0H             ; 08C0H FE F0
                JR      NZ,08C6H;(+4)   ; 08C2H 20 02
                XOR     A               ; 08C4H AF
                RET                     ; 08C5H C9
$08C6H:         CALL    0BCEH           ; 08C6H CD CE 0B
                RET                     ; 08C9H C9
$08CAH:         PUSH    BC              ; 08CAH C5
                PUSH    DE              ; 08CBH D5
                PUSH    HL              ; 08CCH E5
                CALL    0A50H           ; 08CDH CD 50 0A
                LD      A,B             ; 08D0H 78
                RLCA                    ; 08D1H 07
                JR      C,08DAH;(+8)    ; 08D2H 38 06
                LD      A,F0H           ; 08D4H 3E F0
$08D6H:         POP     HL              ; 08D6H E1
                POP     DE              ; 08D7H D1
                POP     BC              ; 08D8H C1
                RET                     ; 08D9H C9
$08DAH:         RLCA                    ; 08DAH 07
                JP      NC,08ECH        ; 08DBH D2 EC 08
                LD      B,00H           ; 08DEH 06 00
                LD      HL,0008H        ; 08E0H 21 08 00
                ADD     HL,BC           ; 08E3H 09
$08E4H:         LD      DE,0AC9H        ; 08E4H 11 C9 0A
                ADD     HL,DE           ; 08E7H 19
                LD      A,(HL)          ; 08E8H 7E
                JP      08D6H           ; 08E9H C3 D6 08
$08ECH:         LD      A,(1170H)       ; 08ECH 3A 70 11
                OR      A               ; 08EFH B7
                JP      NZ,08FDH        ; 08F0H C2 FD 08
                LD      B,00H           ; 08F3H 06 00
                LD      HL,0AC9H        ; 08F5H 21 C9 0A
                ADD     HL,BC           ; 08F8H 09
                LD      A,(HL)          ; 08F9H 7E
                JP      08D6H           ; 08FAH C3 D6 08
$08FDH:         LD      A,C             ; 08FDH 79
                AND     F0H             ; 08FEH E6 F0
                RRCA                    ; 0900H 0F
                LD      B,A             ; 0901H 47
                LD      A,C             ; 0902H 79
                AND     0FH             ; 0903H E6 0F
                ADD     A,B             ; 0905H 80
                ADD     A,A0H           ; 0906H C6 A0
                LD      L,A             ; 0908H 6F
                LD      H,00H           ; 0909H 26 00
                JP      08E4H           ; 090BH C3 E4 08
$090EH:         XOR     A               ; 090EH AF
                LD      (1194H),A       ; 090FH 32 94 11
                LD      A,CDH           ; 0912H 3E CD
                CALL    0DDCH           ; 0914H CD DC 0D
                RET                     ; 0917H C9
$0918H:         LD      A,(1194H)       ; 0918H 3A 94 11
                OR      A               ; 091BH B7
                RET     Z               ; 091CH C8
                JP      0006H           ; 091DH C3 06 00
$0920H:         LD      A,20H           ; 0920H 3E 20
                CALL    0935H           ; 0922H CD 35 09
                RET                     ; 0925H C9
$0926H:         CALL    000CH           ; 0926H CD 0C 00
                LD      A,(1194H)       ; 0929H 3A 94 11
                OR      A               ; 092CH B7
                RET     Z               ; 092DH C8
$092EH:         SUB     A,0AH           ; 092EH D6 0A
                JR      C,0926H;(-10)   ; 0930H 38 F4
                JR      NZ,092EH;(-4)   ; 0932H 20 FA
                RET                     ; 0934H C9
$0935H:         CP      0DH             ; 0935H FE 0D
                JP      Z,090EH         ; 0937H CA 0E 09
                PUSH    BC              ; 093AH C5
                LD      C,A             ; 093BH 4F
                LD      B,A             ; 093CH 47
                CALL    0196H           ; 093DH CD 96 01
                CALL    0946H           ; 0940H CD 46 09
                LD      A,B             ; 0943H 78
                POP     BC              ; 0944H C1
                RET                     ; 0945H C9
$0946H:         LD      A,C             ; 0946H 79
                CALL    0BB9H           ; 0947H CD B9 0B
                LD      C,A             ; 094AH 4F
                AND     F0H             ; 094BH E6 F0
                CP      F0H             ; 094DH FE F0
                RET     Z               ; 094FH C8
                CP      C0H             ; 0950H FE C0
                LD      A,C             ; 0952H 79
                JP      NZ,0970H        ; 0953H C2 70 09
                CP      C7H             ; 0956H FE C7
                JP      NC,0970H        ; 0958H D2 70 09
                CALL    0DDCH           ; 095BH CD DC 0D
                CP      C3H             ; 095EH FE C3
                JP      Z,0973H         ; 0960H CA 73 09
                CP      C5H             ; 0963H FE C5
                JP      Z,096BH         ; 0965H CA 6B 09
                CP      C6H             ; 0968H FE C6
                RET     NZ              ; 096AH C0
$096BH:         XOR     A               ; 096BH AF
                LD      (1194H),A       ; 096CH 32 94 11
                RET                     ; 096FH C9
$0970H:         CALL    0DB5H           ; 0970H CD B5 0D
$0973H:         LD      A,(1194H)       ; 0973H 3A 94 11
                INC     A               ; 0976H 3C
                CP      50H             ; 0977H FE 50
                JR      C,097DH;(+4)    ; 0979H 38 02
                SUB     A,50H           ; 097BH D6 50
$097DH:         LD      (1194H),A       ; 097DH 32 94 11
                RET                     ; 0980H C9
$0981H:         PUSH    AF              ; 0981H F5
                PUSH    BC              ; 0982H C5
                PUSH    DE              ; 0983H D5
$0984H:         LD      B,05H           ; 0984H 06 05
                CALL    0196H           ; 0986H CD 96 01
$0989H:         LD      A,(DE)          ; 0989H 1A
                CP      0DH             ; 098AH FE 0D
                JP      Z,0FDFH         ; 098CH CA DF 0F
                LD      C,A             ; 098FH 4F
                CALL    0946H           ; 0990H CD 46 09
                INC     DE              ; 0993H 13
                DJNZ    0989H;(-11)     ; 0994H 10 F3
                JP      0984H           ; 0996H C3 84 09
$0999H:         PUSH    AF              ; 0999H F5
                PUSH    BC              ; 099AH C5
                PUSH    DE              ; 099BH D5
$099CH:         LD      B,05H           ; 099CH 06 05
                CALL    0196H           ; 099EH CD 96 01
$09A1H:         LD      A,(DE)          ; 09A1H 1A
                CP      0DH             ; 09A2H FE 0D
                JP      Z,0FDFH         ; 09A4H CA DF 0F
                CALL    0BB9H           ; 09A7H CD B9 0B
                CALL    0970H           ; 09AAH CD 70 09
                INC     DE              ; 09ADH 13
                DJNZ    09A1H;(-13)     ; 09AEH 10 F1
                JP      099CH           ; 09B0H C3 9C 09
$09B3H:         PUSH    BC              ; 09B3H C5
                PUSH    DE              ; 09B4H D5
                PUSH    HL              ; 09B5H E5
                CALL    0FB1H           ; 09B6H CD B1 0F
                CALL    0DA6H           ; 09B9H CD A6 0D
                LD      A,(HL)          ; 09BCH 7E
                LD      (118EH),A       ; 09BDH 32 8E 11
                LD      (118FH),HL      ; 09C0H 22 8F 11
                LD      HL,1192H        ; 09C3H 21 92 11
                LD      (HL),EFH        ; 09C6H 36 EF
                XOR     A               ; 09C8H AF
                LD      (E000H),A       ; 09C9H 32 00 E0
                LD      (1191H),A       ; 09CCH 32 91 11
                CPL                     ; 09CFH 2F
                LD      (E000H),A       ; 09D0H 32 00 E0
$09D3H:         LD      D,14H           ; 09D3H 16 14
$09D5H:         CALL    09FFH           ; 09D5H CD FF 09
                CALL    0A50H           ; 09D8H CD 50 0A
                LD      A,B             ; 09DBH 78
                RLCA                    ; 09DCH 07
                JP      C,0BE6H         ; 09DDH DA E6 0B
$09E0H:         DEC     D               ; 09E0H 15
                JP      NZ,09D5H        ; 09E1H C2 D5 09
$09E4H:         CALL    09FFH           ; 09E4H CD FF 09
$09E7H:         CALL    08CAH           ; 09E7H CD CA 08
                CP      F0H             ; 09EAH FE F0
                JP      Z,077AH         ; 09ECH CA 7A 07
                PUSH    AF              ; 09EFH F5
                CALL    0DA6H           ; 09F0H CD A6 0D
                LD      A,(118EH)       ; 09F3H 3A 8E 11
                LD      HL,(118FH)      ; 09F6H 2A 8F 11
                LD      (HL),A          ; 09F9H 77
                POP     AF              ; 09FAH F1
                POP     HL              ; 09FBH E1
                POP     DE              ; 09FCH D1
                POP     BC              ; 09FDH C1
                RET                     ; 09FEH C9
$09FFH:         PUSH    AF              ; 09FFH F5
                PUSH    HL              ; 0A00H E5
                LD      A,(E002H)       ; 0A01H 3A 02 E0
                RLCA                    ; 0A04H 07
                RLCA                    ; 0A05H 07
                JP      C,0A25H         ; 0A06H DA 25 0A
                LD      A,(1191H)       ; 0A09H 3A 91 11
                RRCA                    ; 0A0CH 0F
                JP      C,0A22H         ; 0A0DH DA 22 0A
                LD      A,(1192H)       ; 0A10H 3A 92 11
$0A13H:         LD      HL,(118FH)      ; 0A13H 2A 8F 11
                CALL    0DA6H           ; 0A16H CD A6 0D
                LD      (HL),A          ; 0A19H 77
                LD      A,(1191H)       ; 0A1AH 3A 91 11
                XOR     01H             ; 0A1DH EE 01
                LD      (1191H),A       ; 0A1FH 32 91 11
$0A22H:         POP     HL              ; 0A22H E1
                POP     AF              ; 0A23H F1
                RET                     ; 0A24H C9
$0A25H:         LD      A,(1191H)       ; 0A25H 3A 91 11
                RRCA                    ; 0A28H 0F
                JP      NC,0A22H        ; 0A29H D2 22 0A
                LD      A,(118EH)       ; 0A2CH 3A 8E 11
                JP      0A13H           ; 0A2FH C3 13 0A
$0A32H:         LD      A,F8H           ; 0A32H 3E F8
                LD      (E000H),A       ; 0A34H 32 00 E0
                NOP                     ; 0A37H 00
                LD      A,(E001H)       ; 0A38H 3A 01 E0
                CPL                     ; 0A3BH 2F
                AND     21H             ; 0A3CH E6 21
                JP      NZ,0A44H        ; 0A3EH C2 44 0A
                ADD     A,01H           ; 0A41H C6 01
                RET                     ; 0A43H C9
$0A44H:         LD      A,F9H           ; 0A44H 3E F9
                LD      (E000H),A       ; 0A46H 32 00 E0
                NOP                     ; 0A49H 00
                LD      A,(E001H)       ; 0A4AH 3A 01 E0
                AND     08H             ; 0A4DH E6 08
                RET                     ; 0A4FH C9
$0A50H:         PUSH    DE              ; 0A50H D5
                PUSH    HL              ; 0A51H E5
                LD      B,FAH           ; 0A52H 06 FA
                LD      D,00H           ; 0A54H 16 00
$0A56H:         DEC     B               ; 0A56H 05
                LD      A,B             ; 0A57H 78
                LD      (E000H),A       ; 0A58H 32 00 E0
                CP      EFH             ; 0A5BH FE EF
                JR      NZ,0A63H;(+6)   ; 0A5DH 20 04
                LD      B,D             ; 0A5FH 42
                POP     HL              ; 0A60H E1
                POP     DE              ; 0A61H D1
                RET                     ; 0A62H C9
$0A63H:         CP      F8H             ; 0A63H FE F8
                JR      Z,0A86H;(+33)   ; 0A65H 28 1F
                LD      A,(E001H)       ; 0A67H 3A 01 E0
                CPL                     ; 0A6AH 2F
                OR      A               ; 0A6BH B7
                JR      Z,0A56H;(-22)   ; 0A6CH 28 E8
$0A6EH:         LD      E,A             ; 0A6EH 5F
                SET     7,D             ; 0A6FH CB FA
                LD      A,B             ; 0A71H 78
                AND     0FH             ; 0A72H E6 0F
                RLCA                    ; 0A74H 07
                RLCA                    ; 0A75H 07
                RLCA                    ; 0A76H 07
                RLCA                    ; 0A77H 07
                LD      C,A             ; 0A78H 4F
                LD      A,08H           ; 0A79H 3E 08
$0A7BH:         DEC     A               ; 0A7BH 3D
                JR      Z,0A82H;(+6)    ; 0A7CH 28 04
                RLC     E               ; 0A7EH CB 03
                JR      NC,0A7BH;(-5)   ; 0A80H 30 F9
$0A82H:         ADD     A,C             ; 0A82H 81
                LD      C,A             ; 0A83H 4F
                JR      0A56H;(-46)     ; 0A84H 18 D0
$0A86H:         LD      A,(E001H)       ; 0A86H 3A 01 E0
                CPL                     ; 0A89H 2F
                LD      E,A             ; 0A8AH 5F
                AND     21H             ; 0A8BH E6 21
                JR      Z,0A91H;(+4)    ; 0A8DH 28 02
                SET     6,D             ; 0A8FH CB F2
$0A91H:         LD      A,E             ; 0A91H 7B
                AND     DEH             ; 0A92H E6 DE
                JR      Z,0A56H;(-62)   ; 0A94H 28 C0
                JR      0A6EH;(-40)     ; 0A96H 18 D6
                CALL    003EH           ; 0A98H CD 3E 00
$0A9BH:         CP      56H             ; 0A9BH FE 56
                JP      Z,00CBH         ; 0A9DH CA CB 00
                CP      43H             ; 0AA0H FE 43
                RET     NZ              ; 0AA2H C0
                INC     DE              ; 0AA3H 13
                LD      A,(DE)          ; 0AA4H 1A
                CP      41H             ; 0AA5H FE 41
                JP      Z,079EH         ; 0AA7H CA 9E 07
                CP      31H             ; 0AAAH FE 31
                JP      Z,0557H         ; 0AACH CA 57 05
                CP      32H             ; 0AAFH FE 32
                JP      Z,055DH         ; 0AB1H CA 5D 05
                CP      42H             ; 0AB4H FE 42
                JP      NZ,0CB8H        ; 0AB6H C2 B8 0C
                LD      HL,0D14H        ; 0AB9H 21 14 0D
                LD      (1035H),HL      ; 0ABCH 22 35 10
                RET                     ; 0ABFH C9
$0AC0H:         CALL    0799H           ; 0AC0H CD 99 07
                CALL    0557H           ; 0AC3H CD 57 05
                JP      0176H           ; 0AC6H C3 76 01
                LD      HL,2523H        ; 0AC9H 21 23 25
                DAA                     ; 0ACCH 27
                ADD     HL,HL           ; 0ACDH 29
                LD      HL,(1F1DH)      ; 0ACEH 2A 1D 1F
                LD      H,C             ; 0AD1H 61
                LD      H,E             ; 0AD2H 63
                LD      H,L             ; 0AD3H 65
                LD      H,A             ; 0AD4H 67
                LD      L,C             ; 0AD5H 69
                LD      L,D             ; 0AD6H 6A
                LD      E,L             ; 0AD7H 5D
                LD      E,A             ; 0AD8H 5F
                LD      (2624H),HL      ; 0AD9H 22 24 26
                JR      Z,0AFEH;(+34)   ; 0ADCH 28 20
                INC     E               ; 0ADEH 1C
                LD      E,D1H           ; 0ADFH 1E D1
                LD      H,D             ; 0AE1H 62
                LD      H,H             ; 0AE2H 64
                LD      H,(HL)          ; 0AE3H 66
                LD      L,B             ; 0AE4H 68
                LD      H,B             ; 0AE5H 60
                LD      E,H             ; 0AE6H 5C
                LD      E,(HL)          ; 0AE7H 5E
                RET     NC              ; 0AE8H D0
                LD      DE,1405H        ; 0AE9H 11 05 14
                DEC     D               ; 0AECH 15
                RRCA                    ; 0AEDH 0F
                DEC     HL              ; 0AEEH 2B
                LD      SP,5133H        ; 0AEFH 31 33 51
                LD      B,L             ; 0AF2H 45
                LD      D,H             ; 0AF3H 54
                LD      D,L             ; 0AF4H 55
                LD      C,A             ; 0AF5H 4F
                LD      L,E             ; 0AF6H 6B
                LD      (HL),C          ; 0AF7H 71
                LD      (HL),E          ; 0AF8H 73
                RLA                     ; 0AF9H 17
                LD      (DE),A          ; 0AFAH 12
                ADD     HL,DE           ; 0AFBH 19
                ADD     HL,BC           ; 0AFCH 09
                DJNZ    0B2FH;(+50)     ; 0AFDH 10 30
                LD      (57D3H),A       ; 0AFFH 32 D3 57
                LD      D,D             ; 0B02H 52
                LD      E,C             ; 0B03H 59
                LD      C,C             ; 0B04H 49
                LD      D,B             ; 0B05H 50
                LD      (HL),B          ; 0B06H 70
                LD      (HL),D          ; 0B07H 72
                JP      NC,0401H        ; 0B08H D2 01 04
                RLCA                    ; 0B0BH 07
                LD      A,(BC)          ; 0B0CH 0A
                INC     C               ; 0B0DH 0C
                DEC     DE              ; 0B0EH 1B
                DEC     (HL)            ; 0B0FH 35
                SCF                     ; 0B10H 37
                LD      B,C             ; 0B11H 41
                LD      B,H             ; 0B12H 44
                LD      B,A             ; 0B13H 47
                LD      C,D             ; 0B14H 4A
                LD      C,H             ; 0B15H 4C
                LD      E,E             ; 0B16H 5B
                LD      (HL),L          ; 0B17H 75
                LD      (HL),A          ; 0B18H 77
                INC     DE              ; 0B19H 13
                LD      B,08H           ; 0B1AH 06 08
                DEC     BC              ; 0B1CH 0B
                INC     L               ; 0B1DH 2C
                INC     (HL)            ; 0B1EH 34
                LD      (HL),D5H        ; 0B1FH 36 D5
                LD      D,E             ; 0B21H 53
                LD      B,(HL)          ; 0B22H 46
                LD      C,B             ; 0B23H 48
                LD      C,E             ; 0B24H 4B
                LD      L,H             ; 0B25H 6C
                LD      (HL),H          ; 0B26H 74
                HALT                    ; 0B27H 76
                CALL    NC,031AH        ; 0B28H D4 1A 03
                LD      (BC),A          ; 0B2BH 02
                DEC     C               ; 0B2CH 0D
                LD      L,C9H           ; 0B2DH 2E C9
$0B2FH:         ADD     HL,SP           ; 0B2FH 39
                DEC     SP              ; 0B30H 3B
                LD      E,D             ; 0B31H 5A
                LD      B,E             ; 0B32H 43
                LD      B,D             ; 0B33H 42
                LD      C,L             ; 0B34H 4D
                LD      L,(HL)          ; 0B35H 6E
                JP      Z,7B79H         ; 0B36H CA 79 7B
                JR      0B51H;(+24)     ; 0B39H 18 16
                LD      C,2FH           ; 0B3BH 0E 2F
                DEC     L               ; 0B3DH 2D
                JR      C,0B7AH;(+60)   ; 0B3EH 38 3A
                RST     10H             ; 0B40H D7
                LD      E,B             ; 0B41H 58
                LD      D,(HL)          ; 0B42H 56
                LD      C,(HL)          ; 0B43H 4E
                LD      L,A             ; 0B44H 6F
                LD      L,L             ; 0B45H 6D
                LD      A,B             ; 0B46H 78
                LD      A,D             ; 0B47H 7A
                SUB     A,F0H           ; 0B48H D6 F0
                RST     00H             ; 0B4AH C7
                RET     P               ; 0B4BH F0
                JP      F0CDH           ; 0B4CH C3 CD F0
                DEC     A               ; 0B4FH 3D
                CCF                     ; 0B50H 3F
$0B51H:         RET     P               ; 0B51H F0
                RET     Z               ; 0B52H C8
                RET     P               ; 0B53H F0
                CALL    NZ,F0CDH        ; 0B54H C4 CD F0
                LD      A,L             ; 0B57H 7D
                LD      A,A             ; 0B58H 7F
                PUSH    BC              ; 0B59H C5
                NOP                     ; 0B5AH 00
                POP     BC              ; 0B5BH C1
                RET     P               ; 0B5CH F0
                RET     P               ; 0B5DH F0
                INC     A               ; 0B5EH 3C
                LD      A,DCH           ; 0B5FH 3E DC
                ADD     A,00H           ; 0B61H C6 00
                JP      NZ,F0CBH        ; 0B63H C2 CB F0
                LD      A,H             ; 0B66H 7C
                LD      A,(HL)          ; 0B67H 7E
                RET     C               ; 0B68H D8
                AND     C               ; 0B69H A1
                AND     E               ; 0B6AH A3
                AND     L               ; 0B6BH A5
                AND     A               ; 0B6CH A7
                XOR     C               ; 0B6DH A9
                XOR     D               ; 0B6EH AA
                SBC     A,L             ; 0B6FH 9D
                SBC     A,A             ; 0B70H 9F
                AND     D               ; 0B71H A2
                AND     H               ; 0B72H A4
                AND     (HL)            ; 0B73H A6
                XOR     B               ; 0B74H A8
                AND     B               ; 0B75H A0
                SBC     A,H             ; 0B76H 9C
                SBC     A,(HL)          ; 0B77H 9E
                DEFB    DDh; *** FAIL TO DISASSEMBLE WITH 91; 0B78H DD
                SUB     A,C             ; 0B79H 91
$0B7AH:         ADD     A,L             ; 0B7AH 85
                SUB     A,H             ; 0B7BH 94
                SUB     A,L             ; 0B7CH 95
                ADC     A,A             ; 0B7DH 8F
                XOR     E               ; 0B7EH AB
                OR      C               ; 0B7FH B1
                OR      E               ; 0B80H B3
                SUB     A,A             ; 0B81H 97
                SUB     A,D             ; 0B82H 92
                SBC     A,C             ; 0B83H 99
                ADC     A,C             ; 0B84H 89
                SUB     A,B             ; 0B85H 90
                OR      B               ; 0B86H B0
                OR      D               ; 0B87H B2
                SBC     A,81H           ; 0B88H DE 81
                ADD     A,H             ; 0B8AH 84
                ADD     A,A             ; 0B8BH 87
                ADC     A,D             ; 0B8CH 8A
                ADC     A,H             ; 0B8DH 8C
                SBC     A,E             ; 0B8EH 9B
                OR      L               ; 0B8FH B5
                OR      A               ; 0B90H B7
                SUB     A,E             ; 0B91H 93
                ADD     A,(HL)          ; 0B92H 86
                ADC     A,B             ; 0B93H 88
                ADC     A,E             ; 0B94H 8B
                XOR     H               ; 0B95H AC
                OR      H               ; 0B96H B4
                OR      (HL)            ; 0B97H B6
                EXX                     ; 0B98H D9
                SBC     A,D             ; 0B99H 9A
                ADD     A,E             ; 0B9AH 83
                ADD     A,D             ; 0B9BH 82
                ADC     A,L             ; 0B9CH 8D
                XOR     (HL)            ; 0B9DH AE
                RET                     ; 0B9EH C9
                CP      C               ; 0B9FH B9
                CP      E               ; 0BA0H BB
                SBC     A,B             ; 0BA1H 98
                SUB     A,(HL)          ; 0BA2H 96
                ADC     A,(HL)          ; 0BA3H 8E
                XOR     A               ; 0BA4H AF
                XOR     L               ; 0BA5H AD
                CP      B               ; 0BA6H B8
                CP      D               ; 0BA7H BA
                JP      C,C7F0H         ; 0BA8H DA F0 C7
                RET     P               ; 0BABH F0
                JP      F0CDH           ; 0BACH C3 CD F0
                CP      L               ; 0BAFH BD
                CP      A               ; 0BB0H BF
                PUSH    BC              ; 0BB1H C5
                NOP                     ; 0BB2H 00
                POP     BC              ; 0BB3H C1
                RET     P               ; 0BB4H F0
                RET     P               ; 0BB5H F0
                CP      H               ; 0BB6H BC
                CP      (HL)            ; 0BB7H BE
                IN      A,(197)         ; 0BB8H DB C5
                PUSH    HL              ; 0BBAH E5
                CP      17H             ; 0BBBH FE 17
                JR      C,0BDBH;(+30)   ; 0BBDH 38 1C
                LD      HL,0CC6H        ; 0BBFH 21 C6 0C
                LD      BC,00E0H        ; 0BC2H 01 E0 00
                CPIR                    ; 0BC5H ED B1
                JR      NZ,0BE3H;(+28)  ; 0BC7H 20 1A
                LD      A,DFH           ; 0BC9H 3E DF
                SUB     A,C             ; 0BCBH 91
                JR      0BD8H;(+12)     ; 0BCCH 18 0A
$0BCEH:         PUSH    BC              ; 0BCEH C5
                PUSH    HL              ; 0BCFH E5
                LD      HL,0CC6H        ; 0BD0H 21 C6 0C
                LD      C,A             ; 0BD3H 4F
                LD      B,00H           ; 0BD4H 06 00
                ADD     HL,BC           ; 0BD6H 09
                LD      A,(HL)          ; 0BD7H 7E
$0BD8H:         POP     HL              ; 0BD8H E1
                POP     BC              ; 0BD9H C1
                RET                     ; 0BDAH C9
$0BDBH:         CP      11H             ; 0BDBH FE 11
                JR      C,0BE3H;(+6)    ; 0BDDH 38 04
                ADD     A,B0H           ; 0BDFH C6 B0
                JR      0BD8H;(-9)      ; 0BE1H 18 F5
$0BE3H:         XOR     A               ; 0BE3H AF
                JR      0BD8H;(-12)     ; 0BE4H 18 F2
$0BE6H:         LD      A,(1034H)       ; 0BE6H 3A 34 10
                OR      A               ; 0BE9H B7
                JP      NZ,09D3H        ; 0BEAH C2 D3 09
                LD      A,C             ; 0BEDH 79
                EX      AF,AF'          ; 0BEEH 08
                CP      C               ; 0BEFH B9
                JP      Z,09E0H         ; 0BF0H CA E0 09
                LD      B,04H           ; 0BF3H 06 04
                CALL    08CAH           ; 0BF5H CD CA 08
                AND     3FH             ; 0BF8H E6 3F
                LD      D,A             ; 0BFAH 57
$0BFBH:         CALL    09FFH           ; 0BFBH CD FF 09
                CALL    08CAH           ; 0BFEH CD CA 08
                AND     3FH             ; 0C01H E6 3F
                CP      D               ; 0C03H BA
                JP      NZ,09E7H        ; 0C04H C2 E7 09
                DEC     BC              ; 0C07H 0B
                LD      A,B             ; 0C08H 78
                OR      C               ; 0C09H B1
                JP      Z,09E4H         ; 0C0AH CA E4 09
                JR      0BFBH;(-18)     ; 0C0DH 18 EC
$0C0FH:         INC     DE              ; 0C0FH 13
                CALL    0410H           ; 0C10H CD 10 04
$0C13H:         LD      B,10H           ; 0C13H 06 10
$0C15H:         CALL    0C30H           ; 0C15H CD 30 0C
                CALL    08CAH           ; 0C18H CD CA 08
                OR      A               ; 0C1BH B7
                JR      Z,0C23H;(+7)    ; 0C1CH 28 05
                CP      CBH             ; 0C1EH FE CB
                RET     Z               ; 0C20H C8
                DJNZ    0C15H;(-12)     ; 0C21H 10 F2
$0C23H:         CALL    09B3H           ; 0C23H CD B3 09
                CP      CDH             ; 0C26H FE CD
                JR      Z,0C13H;(-21)   ; 0C28H 28 E9
                OR      A               ; 0C2AH B7
                RET     NZ              ; 0C2BH C0
                LD      B,01H           ; 0C2CH 06 01
                JR      0C15H;(-25)     ; 0C2EH 18 E5
$0C30H:         PUSH    BC              ; 0C30H C5
                CALL    03BAH           ; 0C31H CD BA 03
                LD      B,08H           ; 0C34H 06 08
                PUSH    BC              ; 0C36H C5
                PUSH    HL              ; 0C37H E5
                XOR     A               ; 0C38H AF
                RST     10H             ; 0C39H D7
$0C3AH:         LD      A,(HL)          ; 0C3AH 7E
                CALL    03C3H           ; 0C3BH CD C3 03
                INC     HL              ; 0C3EH 23
                XOR     A               ; 0C3FH AF
                RST     10H             ; 0C40H D7
                DJNZ    0C3AH;(-7)      ; 0C41H 10 F7
                RST     10H             ; 0C43H D7
                POP     HL              ; 0C44H E1
                POP     BC              ; 0C45H C1
$0C46H:         LD      A,(HL)          ; 0C46H 7E
                CALL    0BB9H           ; 0C47H CD B9 0B
                CALL    0DB5H           ; 0C4AH CD B5 0D
                INC     HL              ; 0C4DH 23
                DJNZ    0C46H;(-8)      ; 0C4EH 10 F6
                POP     BC              ; 0C50H C1
                JP      0006H           ; 0C51H C3 06 00
$0C54H:         CALL    0CC0H           ; 0C54H CD C0 0C
                LD      E,A8H           ; 0C57H 1E A8
$0C59H:         CALL    041FH           ; 0C59H CD 1F 04
                JR      C,0C63H;(+7)    ; 0C5CH 38 05
                LD      (HL),A          ; 0C5EH 77
                INC     DE              ; 0C5FH 13
                INC     HL              ; 0C60H 23
                JR      0C59H;(-8)      ; 0C61H 18 F6
$0C63H:         LD      A,A9H           ; 0C63H 3E A9
                CP      E               ; 0C65H BB
                RET     NC              ; 0C66H D0
                CALL    03BAH           ; 0C67H CD BA 03
                JP      008EH           ; 0C6AH C3 8E 00
$0C6DH:         PUSH    BC              ; 0C6DH C5
                PUSH    HL              ; 0C6EH E5
                LD      HL,(1036H)      ; 0C6FH 2A 36 10
                LD      A,L             ; 0C72H 7D
                CP      10H             ; 0C73H FE 10
                JR      C,0C7AH;(+5)    ; 0C75H 38 03
                LD      L,50H           ; 0C77H 2E 50
                INC     H               ; 0C79H 24
$0C7AH:         CALL    02AEH           ; 0C7AH CD AE 02
                LD      B,07H           ; 0C7DH 06 07
                JP      02EFH           ; 0C7FH C3 EF 02
$0C82H:         INC     DE              ; 0C82H 13
                LD      A,(DE)          ; 0C83H 1A
                CP      53H             ; 0C84H FE 53
                JP      Z,0170H         ; 0C86H CA 70 01
                CP      47H             ; 0C89H FE 47
                JP      Z,0176H         ; 0C8BH CA 76 01
                CALL    0CC0H           ; 0C8EH CD C0 0C
                LD      (1104H),HL      ; 0C91H 22 04 11
                PUSH    HL              ; 0C94H E5
                LD      E,AAH           ; 0C95H 1E AA
                CALL    0410H           ; 0C97H CD 10 04
                POP     DE              ; 0C9AH D1
                SBC     HL,DE           ; 0C9BH ED 52
                INC     HL              ; 0C9DH 23
                LD      (1102H),HL      ; 0C9EH 22 02 11
                LD      DE,11AFH        ; 0CA1H 11 AF 11
                CALL    0CC0H           ; 0CA4H CD C0 0C
                LD      (1106H),HL      ; 0CA7H 22 06 11
                LD      DE,10F1H        ; 0CAAH 11 F1 10
                LD      HL,11B4H        ; 0CADH 21 B4 11
                LD      BC,0010H        ; 0CB0H 01 10 00
                LDIR                    ; 0CB3H ED B0
                LD      A,0DH           ; 0CB5H 3E 0D
                LD      (DE),A          ; 0CB7H 12
$0CB8H:         CALL    019FH           ; 0CB8H CD 9F 01
                RST     20H             ; 0CBBH E7
                JP      NC,0024H        ; 0CBCH D2 24 00
                RET                     ; 0CBFH C9
$0CC0H:         CALL    0410H           ; 0CC0H CD 10 04
                RET     NC              ; 0CC3H D0
                POP     DE              ; 0CC4H D1
                RET                     ; 0CC5H C9
                JR      NZ,0D09H;(+67)  ; 0CC6H 20 41
                LD      B,D             ; 0CC8H 42
                LD      B,E             ; 0CC9H 43
                LD      B,H             ; 0CCAH 44
                LD      B,L             ; 0CCBH 45
                LD      B,(HL)          ; 0CCCH 46
                LD      B,A             ; 0CCDH 47
                LD      C,B             ; 0CCEH 48
                LD      C,C             ; 0CCFH 49
                LD      C,D             ; 0CD0H 4A
                LD      C,E             ; 0CD1H 4B
                LD      C,H             ; 0CD2H 4C
                LD      C,L             ; 0CD3H 4D
                LD      C,(HL)          ; 0CD4H 4E
                LD      C,A             ; 0CD5H 4F
                LD      D,B             ; 0CD6H 50
                LD      D,C             ; 0CD7H 51
                LD      D,D             ; 0CD8H 52
                LD      D,E             ; 0CD9H 53
                LD      D,H             ; 0CDAH 54
                LD      D,L             ; 0CDBH 55
                LD      D,(HL)          ; 0CDCH 56
                LD      D,A             ; 0CDDH 57
                LD      E,B             ; 0CDEH 58
                LD      E,C             ; 0CDFH 59
                LD      E,D             ; 0CE0H 5A
                EI                      ; 0CE1H FB
                CALL    CBDDH           ; 0CE2H CD DD CB
                POP     DE              ; 0CE5H D1
                JR      NC,0D19H;(+51)  ; 0CE6H 30 31
                LD      (3433H),A       ; 0CE8H 32 33 34
                DEC     (HL)            ; 0CEBH 35
                LD      (HL),37H        ; 0CECH 36 37
                JR      C,0D29H;(+59)   ; 0CEEH 38 39
                DEC     L               ; 0CF0H 2D
                DEC     A               ; 0CF1H 3D
                DEC     SP              ; 0CF2H 3B
                CPL                     ; 0CF3H 2F
                LD      L,2CH           ; 0CF4H 2E 2C
                PUSH    HL              ; 0CF6H E5
                CALL    P,DAECH         ; 0CF7H F4 EC DA
                EX      (SP),HL         ; 0CFAH E3
                JP      PO,D4D7H        ; 0CFBH E2 D7 D4
                AND     E8H             ; 0CFEH E6 E8
                JP      NZ,C4C1H        ; 0D00H C2 C1 C4
                RST     00H             ; 0D03H C7
                RST     08H             ; 0D04H CF
                JP      Z,E120H         ; 0D05H CA 20 E1
                CP      C8H             ; 0D08H FE C8
                JP      M,F85FH         ; 0D0AH FA 5F F8
                POP     AF              ; 0D0DH F1
                RST     30H             ; 0D0EH F7
                CCF                     ; 0D0FH 3F
                CALL    Z,DCDBH         ; 0D10H CC DB DC
                JP      (HL)            ; 0D13H E9
                PUSH    AF              ; 0D14H F5
                LD      A,(3C5EH)       ; 0D15H 3A 5E 3C
                LD      E,E             ; 0D18H 5B
$0D19H:         DI                      ; 0D19H F3
                LD      E,L             ; 0D1AH 5D
                LD      B,B             ; 0D1BH 40
                RET                     ; 0D1CH C9
                LD      A,FCH           ; 0D1DH 3E FC
                LD      E,H             ; 0D1FH 5C
                ADD     A,DFH           ; 0D20H C6 DF
                RET     NC              ; 0D22H D0
                ADC     A,D3H           ; 0D23H CE D3
                JP      NC,21FFH        ; 0D25H D2 FF 21
                LD      (2423H),HL      ; 0D28H 22 23 24
                DEC     H               ; 0D2BH 25
                LD      H,27H           ; 0D2CH 26 27
                JR      Z,0D59H;(+43)   ; 0D2EH 28 29
                DEC     HL              ; 0D30H 2B
                LD      HL,(F6DEH)      ; 0D31H 2A DE F6
                EX      DE,HL           ; 0D34H EB
                JP      PE,C5C3H        ; 0D35H EA C3 C5
                RST     28H             ; 0D38H EF
                RET     P               ; 0D39H F0
                CALL    PO,EEE7H        ; 0D3AH E4 E7 EE
                DEFB    EDh; *** FAIL TO DISASSEMBLE WITH E0; 0D3DH ED
                RET     PO              ; 0D3EH E0
                DEFB    FDh; *** FAIL TO DISASSEMBLE WITH D8; 0D3FH FD
                RET     C               ; 0D40H D8
                PUSH    DE              ; 0D41H D5
                JP      P,D9F9H         ; 0D42H F2 F9 D9
                SUB     A,20H           ; 0D45H D6 20
                AND     C               ; 0D47H A1
                SBC     A,D             ; 0D48H 9A
                SBC     A,A             ; 0D49H 9F
                SBC     A,H             ; 0D4AH 9C
                SUB     A,D             ; 0D4BH 92
                XOR     D               ; 0D4CH AA
                SUB     A,A             ; 0D4DH 97
                SBC     A,B             ; 0D4EH 98
                AND     (HL)            ; 0D4FH A6
                XOR     A               ; 0D50H AF
                XOR     C               ; 0D51H A9
                CP      B               ; 0D52H B8
                OR      E               ; 0D53H B3
                OR      B               ; 0D54H B0
                OR      A               ; 0D55H B7
                SBC     A,(HL)          ; 0D56H 9E
                AND     B               ; 0D57H A0
                SBC     A,L             ; 0D58H 9D
$0D59H:         AND     H               ; 0D59H A4
                SUB     A,(HL)          ; 0D5AH 96
                AND     L               ; 0D5BH A5
                XOR     E               ; 0D5CH AB
                AND     E               ; 0D5DH A3
                SBC     A,E             ; 0D5EH 9B
                CP      L               ; 0D5FH BD
                AND     D               ; 0D60H A2
                CP      E               ; 0D61H BB
                SBC     A,C             ; 0D62H 99
                ADD     A,D             ; 0D63H 82
                ADD     A,A             ; 0D64H 87
                ADC     A,H             ; 0D65H 8C
                CP      H               ; 0D66H BC
                AND     A               ; 0D67H A7
                XOR     H               ; 0D68H AC
                SUB     A,C             ; 0D69H 91
                SUB     A,E             ; 0D6AH 93
                SUB     A,H             ; 0D6BH 94
                SUB     A,L             ; 0D6CH 95
                OR      H               ; 0D6DH B4
                OR      L               ; 0D6EH B5
                OR      (HL)            ; 0D6FH B6
                XOR     (HL)            ; 0D70H AE
                XOR     L               ; 0D71H AD
                CP      D               ; 0D72H BA
                OR      D               ; 0D73H B2
                CP      C               ; 0D74H B9
                XOR     B               ; 0D75H A8
                OR      C               ; 0D76H B1
                ADD     A,E             ; 0D77H 83
                ADC     A,B             ; 0D78H 88
                ADC     A,L             ; 0D79H 8D
                ADD     A,(HL)          ; 0D7AH 86
                ADD     A,H             ; 0D7BH 84
                ADC     A,C             ; 0D7CH 89
                ADC     A,(HL)          ; 0D7DH 8E
                CP      A               ; 0D7EH BF
                ADD     A,L             ; 0D7FH 85
                ADC     A,D             ; 0D80H 8A
                ADC     A,A             ; 0D81H 8F
                CP      (HL)            ; 0D82H BE
                ADD     A,C             ; 0D83H 81
                ADC     A,E             ; 0D84H 8B
                SUB     A,B             ; 0D85H 90
                LD      A,A             ; 0D86H 7F
                LD      DE,1312H        ; 0D87H 11 12 13
                INC     D               ; 0D8AH 14
                DEC     D               ; 0D8BH 15
                LD      D,60H           ; 0D8CH 16 60
                LD      H,C             ; 0D8EH 61
                LD      H,D             ; 0D8FH 62
                LD      H,E             ; 0D90H 63
                LD      H,H             ; 0D91H 64
                LD      H,L             ; 0D92H 65
                LD      H,(HL)          ; 0D93H 66
                LD      H,A             ; 0D94H 67
                LD      L,B             ; 0D95H 68
                LD      (HL),B          ; 0D96H 70
                LD      (HL),C          ; 0D97H 71
                LD      (HL),D          ; 0D98H 72
                LD      (HL),E          ; 0D99H 73
                LD      (HL),H          ; 0D9AH 74
                LD      (HL),L          ; 0D9BH 75
                HALT                    ; 0D9CH 76
                LD      (HL),A          ; 0D9DH 77
                LD      A,B             ; 0D9EH 78
                LD      A,C             ; 0D9FH 79
                LD      A,D             ; 0DA0H 7A
                LD      A,E             ; 0DA1H 7B
                LD      A,H             ; 0DA2H 7C
                LD      A,L             ; 0DA3H 7D
                LD      A,(HL)          ; 0DA4H 7E
                LD      L,C             ; 0DA5H 69
$0DA6H:         PUSH    AF              ; 0DA6H F5
$0DA7H:         LD      A,(E002H)       ; 0DA7H 3A 02 E0
                RLCA                    ; 0DAAH 07
                JR      NC,0DA7H;(-4)   ; 0DABH 30 FA
$0DADH:         LD      A,(E002H)       ; 0DADH 3A 02 E0
                RLCA                    ; 0DB0H 07
                JR      C,0DADH;(-4)    ; 0DB1H 38 FA
                POP     AF              ; 0DB3H F1
                RET                     ; 0DB4H C9
$0DB5H:         PUSH    AF              ; 0DB5H F5
                PUSH    BC              ; 0DB6H C5
                PUSH    DE              ; 0DB7H D5
                PUSH    HL              ; 0DB8H E5
                LD      B,A             ; 0DB9H 47
                CALL    0FB1H           ; 0DBAH CD B1 0F
                LD      (HL),B          ; 0DBDH 70
                LD      HL,(1171H)      ; 0DBEH 2A 71 11
                LD      A,L             ; 0DC1H 7D
                CP      27H             ; 0DC2H FE 27
                JP      NZ,0E90H        ; 0DC4H C2 90 0E
                LD      E,H             ; 0DC7H 5C
                LD      D,00H           ; 0DC8H 16 00
                LD      HL,1173H        ; 0DCAH 21 73 11
                ADD     HL,DE           ; 0DCDH 19
                LD      A,(HL)          ; 0DCEH 7E
                OR      A               ; 0DCFH B7
                JP      NZ,0E90H        ; 0DD0H C2 90 0E
                INC     HL              ; 0DD3H 23
                LD      (HL),01H        ; 0DD4H 36 01
                INC     HL              ; 0DD6H 23
                LD      (HL),00H        ; 0DD7H 36 00
                JP      0E90H           ; 0DD9H C3 90 0E
$0DDCH:         PUSH    AF              ; 0DDCH F5
                PUSH    BC              ; 0DDDH C5
                PUSH    DE              ; 0DDEH D5
                PUSH    HL              ; 0DDFH E5
                LD      B,A             ; 0DE0H 47
                AND     F0H             ; 0DE1H E6 F0
                CP      C0H             ; 0DE3H FE C0
                JR      NZ,0E66H;(+129) ; 0DE5H 20 7F
                XOR     B               ; 0DE7H A8
                CP      0DH             ; 0DE8H FE 0D
                JP      Z,0F8BH         ; 0DEAH CA 8B 0F
                CP      0BH             ; 0DEDH FE 0B
                JR      NC,0E66H;(+119) ; 0DEFH 30 75
                LD      H,0EH           ; 0DF1H 26 0E
                LD      L,A             ; 0DF3H 6F
                LD      L,(HL)          ; 0DF4H 6E
                JP      (HL)            ; 0DF5H E9
$0DF6H:         LD      HL,1034H        ; 0DF6H 21 34 10
$0DF9H:         LD      A,(HL)          ; 0DF9H 7E
                CPL                     ; 0DFAH 2F
                LD      (HL),A          ; 0DFBH 77
                JP      07EEH           ; 0DFCH C3 EE 07
                NOP                     ; 0DFFH 00
                LD      (8474H),A       ; 0E00H 32 74 84
                SUB     A,B             ; 0E03H 90
                XOR     (HL)            ; 0E04H AE
                CP      A               ; 0E05H BF
                PUSH    BC              ; 0E06H C5
                RET     M               ; 0E07H F8
                DEC     BC              ; 0E08H 0B
                POP     HL              ; 0E09H E1
                JP      P,49C3H         ; 0E0AH F2 C3 49
                RRCA                    ; 0E0DH 0F
$0E0EH:         LD      HL,1200H        ; 0E0EH 21 00 12
                LD      BC,00BEH        ; 0E11H 01 BE 00
$0E14H:         CALL    0FD8H           ; 0E14H CD D8 0F
                DEC     C               ; 0E17H 0D
                JR      NZ,0E14H;(-4)   ; 0E18H 20 FA
                LD      DE,0E21H        ; 0E1AH 11 21 0E
                RST     18H             ; 0E1DH DF
                JP      003EH           ; 0E1EH C3 3E 00
                LD      D,D             ; 0E21H 52
                LD      B,C             ; 0E22H 41
                LD      C,L             ; 0E23H 4D
                JR      NZ,0E69H;(+69)  ; 0E24H 20 43
                LD      C,H             ; 0E26H 4C
                LD      D,D             ; 0E27H 52
                DEC     C               ; 0E28H 0D
$0E29H:         LD      HL,119DH        ; 0E29H 21 9D 11
                JR      0DF9H;(-51)     ; 0E2CH 18 CB
                NOP                     ; 0E2EH 00
                JP      087DH           ; 0E2FH C3 7D 08
$0E32H:         CALL    0196H           ; 0E32H CD 96 01
                XOR     A               ; 0E35H AF
                LD      (E003H),A       ; 0E36H 32 03 E0
$0E39H:         LD      BC,03C0H        ; 0E39H 01 C0 03
                LD      DE,D000H        ; 0E3CH 11 00 D0
                LD      HL,D028H        ; 0E3FH 21 28 D0
                LDIR                    ; 0E42H ED B0
                EX      DE,HL           ; 0E44H EB
                LD      B,28H           ; 0E45H 06 28
                CALL    0FD8H           ; 0E47H CD D8 0F
                LD      BC,001AH        ; 0E4AH 01 1A 00
                LD      DE,1173H        ; 0E4DH 11 73 11
                LD      HL,1174H        ; 0E50H 21 74 11
                LDIR                    ; 0E53H ED B0
                LD      (HL),00H        ; 0E55H 36 00
                LD      A,(1173H)       ; 0E57H 3A 73 11
                OR      A               ; 0E5AH B7
                JP      NZ,0E6AH        ; 0E5BH C2 6A 0E
                CALL    0196H           ; 0E5EH CD 96 01
                LD      A,01H           ; 0E61H 3E 01
                LD      (E003H),A       ; 0E63H 32 03 E0
$0E66H:         JP      0FDEH           ; 0E66H C3 DE 0F
$0E69H:         NOP                     ; 0E69H 00
$0E6AH:         LD      HL,(1171H)      ; 0E6AH 2A 71 11
                DEC     H               ; 0E6DH 25
                LD      (1171H),HL      ; 0E6EH 22 71 11
                JP      0E39H           ; 0E71H C3 39 0E
                LD      HL,(1171H)      ; 0E74H 2A 71 11
                LD      A,H             ; 0E77H 7C
                CP      18H             ; 0E78H FE 18
                JP      Z,0E32H         ; 0E7AH CA 32 0E
                INC     H               ; 0E7DH 24
$0E7EH:         LD      (1171H),HL      ; 0E7EH 22 71 11
$0E81H:         JP      0FDEH           ; 0E81H C3 DE 0F
                LD      HL,(1171H)      ; 0E84H 2A 71 11
                LD      A,H             ; 0E87H 7C
                OR      A               ; 0E88H B7
                JP      Z,0FDEH         ; 0E89H CA DE 0F
                DEC     H               ; 0E8CH 25
                JP      0E7EH           ; 0E8DH C3 7E 0E
$0E90H:         LD      HL,(1171H)      ; 0E90H 2A 71 11
                LD      A,L             ; 0E93H 7D
                CP      27H             ; 0E94H FE 27
                JP      NC,0E9DH        ; 0E96H D2 9D 0E
                INC     L               ; 0E99H 2C
                JP      0E7EH           ; 0E9AH C3 7E 0E
$0E9DH:         LD      L,00H           ; 0E9DH 2E 00
                INC     H               ; 0E9FH 24
                LD      A,H             ; 0EA0H 7C
                CP      19H             ; 0EA1H FE 19
                JP      C,0E7EH         ; 0EA3H DA 7E 0E
                LD      H,18H           ; 0EA6H 26 18
                LD      (1171H),HL      ; 0EA8H 22 71 11
                JP      0E32H           ; 0EABH C3 32 0E
$0EAEH:         LD      HL,(1171H)      ; 0EAEH 2A 71 11
                LD      A,L             ; 0EB1H 7D
                OR      A               ; 0EB2H B7
                JR      Z,0EB9H;(+6)    ; 0EB3H 28 04
                DEC     L               ; 0EB5H 2D
                JP      0E7EH           ; 0EB6H C3 7E 0E
$0EB9H:         LD      L,27H           ; 0EB9H 2E 27
                DEC     H               ; 0EBBH 25
                JP      P,0E7EH         ; 0EBCH F2 7E 0E
$0EBFH:         LD      HL,0000H        ; 0EBFH 21 00 00
                JP      0E7EH           ; 0EC2H C3 7E 0E
                CALL    0DA6H           ; 0EC5H CD A6 0D
                LD      C,19H           ; 0EC8H 0E 19
                LD      HL,D000H        ; 0ECAH 21 00 D0
$0ECDH:         LD      B,28H           ; 0ECDH 06 28
                CALL    0FD8H           ; 0ECFH CD D8 0F
                DEC     C               ; 0ED2H 0D
                JP      NZ,0ECDH        ; 0ED3H C2 CD 0E
                LD      HL,1173H        ; 0ED6H 21 73 11
                LD      B,1BH           ; 0ED9H 06 1B
                CALL    0FD8H           ; 0EDBH CD D8 0F
                JP      0EBFH           ; 0EDEH C3 BF 0E
                LD      HL,1170H        ; 0EE1H 21 70 11
                XOR     A               ; 0EE4H AF
                CP      (HL)            ; 0EE5H BE
                JR      0EE9H;(+3)      ; 0EE6H 18 01
$0EE8H:         INC     A               ; 0EE8H 3C
$0EE9H:         LD      (HL),A          ; 0EE9H 77
                SUB     A,06H           ; 0EEAH D6 06
                CPL                     ; 0EECH 2F
                LD      (E003H),A       ; 0EEDH 32 03 E0
                JR      0E81H;(-111)    ; 0EF0H 18 8F
                LD      HL,1170H        ; 0EF2H 21 70 11
                XOR     A               ; 0EF5H AF
                JR      0EE8H;(-14)     ; 0EF6H 18 F0
                LD      HL,(1171H)      ; 0EF8H 2A 71 11
                LD      A,H             ; 0EFBH 7C
                OR      L               ; 0EFCH B5
                JP      Z,0FDEH         ; 0EFDH CA DE 0F
                LD      A,L             ; 0F00H 7D
                OR      A               ; 0F01H B7
                JR      NZ,0F1AH;(+24)  ; 0F02H 20 16
                LD      E,H             ; 0F04H 5C
                LD      D,00H           ; 0F05H 16 00
                LD      HL,1173H        ; 0F07H 21 73 11
                ADD     HL,DE           ; 0F0AH 19
                LD      A,(HL)          ; 0F0BH 7E
                OR      A               ; 0F0CH B7
                JR      NZ,0F1AH;(+13)  ; 0F0DH 20 0B
                CALL    0FB1H           ; 0F0FH CD B1 0F
                CALL    0DA6H           ; 0F12H CD A6 0D
$0F15H:         DEC     HL              ; 0F15H 2B
                LD      (HL),00H        ; 0F16H 36 00
                JR      0EAEH;(-106)    ; 0F18H 18 94
$0F1AH:         LD      HL,(1171H)      ; 0F1AH 2A 71 11
                LD      E,H             ; 0F1DH 5C
                INC     E               ; 0F1EH 1C
                LD      D,00H           ; 0F1FH 16 00
                LD      HL,1173H        ; 0F21H 21 73 11
                ADD     HL,DE           ; 0F24H 19
                LD      A,(HL)          ; 0F25H 7E
                LD      B,A             ; 0F26H 47
                OR      A               ; 0F27H B7
                LD      A,28H           ; 0F28H 3E 28
                JR      Z,0F2EH;(+4)    ; 0F2AH 28 02
                LD      A,50H           ; 0F2CH 3E 50
$0F2EH:         LD      HL,(1171H)      ; 0F2EH 2A 71 11
                SUB     A,L             ; 0F31H 95
                LD      C,A             ; 0F32H 4F
                LD      B,00H           ; 0F33H 06 00
                CALL    0FB1H           ; 0F35H CD B1 0F
                PUSH    HL              ; 0F38H E5
                POP     DE              ; 0F39H D1
                DEC     DE              ; 0F3AH 1B
                CALL    0DA6H           ; 0F3BH CD A6 0D
                LDIR                    ; 0F3EH ED B0
                JR      0F15H;(-43)     ; 0F40H 18 D3
$0F42H:         CALL    00F4H           ; 0F42H CD F4 00
                JP      07EEH           ; 0F45H C3 EE 07
                NOP                     ; 0F48H 00
                LD      HL,(1171H)      ; 0F49H 2A 71 11
                LD      E,H             ; 0F4CH 5C
                INC     E               ; 0F4DH 1C
                LD      D,00H           ; 0F4EH 16 00
                LD      HL,1173H        ; 0F50H 21 73 11
                ADD     HL,DE           ; 0F53H 19
                LD      A,(HL)          ; 0F54H 7E
                OR      A               ; 0F55H B7
                LD      C,00H           ; 0F56H 0E 00
                LD      HL,(1171H)      ; 0F58H 2A 71 11
                LD      L,27H           ; 0F5BH 2E 27
                JR      Z,0F61H;(+4)    ; 0F5DH 28 02
                INC     H               ; 0F5FH 24
                INC     C               ; 0F60H 0C
$0F61H:         CALL    0FB4H           ; 0F61H CD B4 0F
                LD      A,(HL)          ; 0F64H 7E
                OR      A               ; 0F65H B7
                JP      NZ,0FDEH        ; 0F66H C2 DE 0F
                PUSH    HL              ; 0F69H E5
                LD      HL,(1171H)      ; 0F6AH 2A 71 11
                LD      A,27H           ; 0F6DH 3E 27
                SUB     A,L             ; 0F6FH 95
                LD      B,A             ; 0F70H 47
                LD      A,C             ; 0F71H 79
                OR      A               ; 0F72H B7
                JR      Z,0F79H;(+6)    ; 0F73H 28 04
                LD      A,28H           ; 0F75H 3E 28
                ADD     A,B             ; 0F77H 80
                LD      B,A             ; 0F78H 47
$0F79H:         POP     DE              ; 0F79H D1
                PUSH    DE              ; 0F7AH D5
                POP     HL              ; 0F7BH E1
                DEC     HL              ; 0F7CH 2B
                CALL    0DA6H           ; 0F7DH CD A6 0D
$0F80H:         LD      A,(HL)          ; 0F80H 7E
                LD      (DE),A          ; 0F81H 12
                LD      (HL),00H        ; 0F82H 36 00
                DEC     HL              ; 0F84H 2B
                DEC     DE              ; 0F85H 1B
                DJNZ    0F80H;(-6)      ; 0F86H 10 F8
                JP      0FDEH           ; 0F88H C3 DE 0F
$0F8BH:         LD      HL,(1171H)      ; 0F8BH 2A 71 11
                LD      E,H             ; 0F8EH 5C
                INC     E               ; 0F8FH 1C
                LD      D,00H           ; 0F90H 16 00
                LD      HL,1173H        ; 0F92H 21 73 11
                ADD     HL,DE           ; 0F95H 19
                LD      A,(HL)          ; 0F96H 7E
                OR      A               ; 0F97H B7
                LD      HL,(1171H)      ; 0F98H 2A 71 11
                JP      Z,0E9DH         ; 0F9BH CA 9D 0E
                LD      L,00H           ; 0F9EH 2E 00
                LD      A,H             ; 0FA0H 7C
                CP      17H             ; 0FA1H FE 17
                JR      Z,0FAAH;(+7)    ; 0FA3H 28 05
                INC     H               ; 0FA5H 24
                INC     H               ; 0FA6H 24
                JP      0E7EH           ; 0FA7H C3 7E 0E
$0FAAH:         INC     H               ; 0FAAH 24
                LD      (1171H),HL      ; 0FABH 22 71 11
                JP      0E32H           ; 0FAEH C3 32 0E
$0FB1H:         LD      HL,(1171H)      ; 0FB1H 2A 71 11
$0FB4H:         PUSH    BC              ; 0FB4H C5
                PUSH    DE              ; 0FB5H D5
                PUSH    HL              ; 0FB6H E5
                POP     BC              ; 0FB7H C1
                LD      DE,0028H        ; 0FB8H 11 28 00
                LD      HL,CFD8H        ; 0FBBH 21 D8 CF
$0FBEH:         ADD     HL,DE           ; 0FBEH 19
                DEC     B               ; 0FBFH 05
                JP      P,0FBEH         ; 0FC0H F2 BE 0F
                LD      B,00H           ; 0FC3H 06 00
                ADD     HL,BC           ; 0FC5H 09
                POP     DE              ; 0FC6H D1
                POP     BC              ; 0FC7H C1
                RET                     ; 0FC8H C9
$0FC9H:         LD      HL,E003H        ; 0FC9H 21 03 E0
                LD      (HL),8AH        ; 0FCCH 36 8A
                LD      (HL),07H        ; 0FCEH 36 07
                LD      (HL),05H        ; 0FD0H 36 05
                LD      A,01H           ; 0FD2H 3E 01
                LD      (E003H),A       ; 0FD4H 32 03 E0
                RET                     ; 0FD7H C9
$0FD8H:         XOR     A               ; 0FD8H AF
$0FD9H:         LD      (HL),A          ; 0FD9H 77
                INC     HL              ; 0FDAH 23
                DJNZ    0FD9H;(-2)      ; 0FDBH 10 FC
                RET                     ; 0FDDH C9
$0FDEH:         POP     HL              ; 0FDEH E1
$0FDFH:         POP     DE              ; 0FDFH D1
                POP     BC              ; 0FE0H C1
                POP     AF              ; 0FE1H F1
                RET                     ; 0FE2H C9
$0FE3H:         LD      A,3AH           ; 0FE3H 3E 3A
                RST     10H             ; 0FE5H D7
                LD      HL,(1104H)      ; 0FE6H 2A 04 11
                CALL    03BAH           ; 0FE9H CD BA 03
                EX      DE,HL           ; 0FECH EB
                LD      HL,(1102H)      ; 0FEDH 2A 02 11
                ADD     HL,DE           ; 0FF0H 19
                DEC     HL              ; 0FF1H 2B
                CALL    0FF8H           ; 0FF2H CD F8 0F
                LD      HL,(1106H)      ; 0FF5H 2A 06 11
$0FF8H:         LD      A,2DH           ; 0FF8H 3E 2D
                RST     10H             ; 0FFAH D7
                CALL    03BAH           ; 0FFBH CD BA 03
                XOR     A               ; 0FFEH AF
                RST     38H             ; 0FFFH FF
