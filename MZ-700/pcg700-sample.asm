        ORG     1200H
        ;===========================================
        ;
        ; CHANGE THE CURSOR PATTERN WITH PCG-700
        ;
        ;===========================================
PCGSMPL:ENT
        CALL    ENPCG       ;ENABLE PCG-700
        LD      B,00H       ;PCG PAGE 0
        LD      C,EFH       ;DISPLAY CODE OF CURSOR
        LD      HL,CGPAT    ;TOP ADDRESS OF PATTERN DATA
        CALL    SETPCG      ;WRITE PATTERN
        RST     00H         ;RESET
        NOP
        NOP
        ;===========================================
        ;
        ; RESTORE BUILT-IN CURSOR PATTERN
        ;
        ;===========================================
RSTRPCG:ENT
        CALL    DIPCG       ;ENABLE PCG-700
        RST     00H         ;RESET
        ;
        ;
        ;
        ;===========================================
        ;CURSOR PATTERN DATA
        ;===========================================
CGPAT:  ENT
        DEFB    88H         ;10001000
        DEFB    D8H         ;11011000
        DEFB    A8H         ;10101000
        DEFB    88H         ;10001000
        DEFB    1FH         ;00011111
        DEFB    06H         ;00000110
        DEFB    0CH         ;00001100
        DEFB    1FH         ;00011111
        ;
        ;
        ;
        ;===========================================
        ; ENABLE PCG-700
        ;===========================================
ENPCG:  ENT
        PUSH    HL
        LD      HL, E012H
        LD      (HL), 10H
        POP     HL
        RET
        ;
        ;
        ;
        ;===========================================
        ; DISABLE PCG-700
        ;===========================================
DIPCG:  ENT
        PUSH    HL
        LD      HL, E012H
        LD      (HL), 18H
        POP     HL
        RET
        ;
        ;
        ;
        ;===========================================
        ; SETPCG
        ;
        ; B: SELECT CGRAM PAGE 0 or 1
        ;    0       : PAGE 0
        ;    NOT 0   : PAGE 1
        ; C: DISPLAY CODE (80H - FFH)
        ; HL: TOP ADDRESS OF 8 BYTES CHAR PATTERN
        ;===========================================
SETPCG: ENT
        PUSH    AF
        PUSH    BC
        PUSH    DE
        
        ;IF B!=0 THEN SEPADR
        LD      A,B
        OR      A
        JR      NZ,SEPADR

        ;OFFSET C FOR PAGE0
        LD      A,C         
        SUB     A,80H
        LD      C,A

SEPADR: ENT
        ; D: UPPER ADDRESS 00H - 07H
        ; E: LOWER ADDRESS 00H - FFH
        LD      D,00H
        LD      E,C
        LD      C,03H
SFTADR: ENT
        SLA     E
        RL      D
        DEC     C
        JR      NZ,SFTADR

        LD      B,08H       ;TRANSFER LOOP COUNT

        ;
        ;PATTERN TRANSFER LOOP
        ;
WRPAT:  ENT

        LD      A,(HL)      ;LOAD PATTERN
        PUSH    HL          ;SAVE PATTERN ADDRESS
        LD      HL,E010H    ;SET PATTERN TO PCG-700
        LD      (HL),A
        LD      HL,E011H    ;SET LOWER ADDRESS TO PCG
        LD      (HL),E

        LD      HL,E012H    ;SET UPPER ADDRESS AND
        LD      A,10H       ;WRITE PATTERN TO PCG-700
        OR      D
        LD      (HL),A      ;WE=1,ADR=D
        LD      (HL),D      ;WE=0,ADR=D

        POP     HL          ;RESTORE PATTERN ADDRSS
        INC     HL          ;SRC ADDR
        INC     E           ;DST ADDR
        DEC     B           ;LOOP COUNTER
        JR      NZ,WRPAT    ;UNTIL ZERO

        POP     DE
        POP     BC
        POP     AF
        RET
