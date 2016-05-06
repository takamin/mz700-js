ORG 1200H
TESTCPIR:   ENT
            LD HL,1400H
            LD BC,0010H
            LD A, 0FH
            CPIR
            LD A, 10H
            CP L
            JR Z,HLINCMATCH
            LD A, 0EH           ;=='N'
            JR SHOWRESULT
HLINCMATCH: ENT
            LD A, 19H           ;=='Y'
SHOWRESULT: ENT
            LD (D000H), A
            HALT
ORG 1400H
SEARCH:     ENT
            DEFB 00H
            DEFB 01H
            DEFB 02H
            DEFB 03H
            DEFB 04H
            DEFB 05H
            DEFB 06H
            DEFB 07H
            DEFB 08H
            DEFB 09H
            DEFB 0AH
            DEFB 0BH
            DEFB 0CH
            DEFB 0DH
            DEFB 0EH
            DEFB 0FH
