#!/bin/sh

#Z80 Implemenation statistics
node z80_imp_stat > z80_imp_stat.txt
if [ $? -ne 0 ]; then
    echo "Z80 IMPLEMENTATION INCOPLETE." 1>&2
    cat z80_imp_stat.txt
fi

#test jsZ80
node test.js

#NEWMON7
node ../tools/mzdasm testdata/NEWMON7.ROM -o testdata/NEWMON7.asm
node ../tools/mzasm testdata/NEWMON7.asm -o testdata/NEWMON7.BIN
diff -b testdata/NEWMON7.ROM testdata/NEWMON7.BIN
hexdump -C testdata/NEWMON7.ROM > testdata/NEWMON7_ROM.hex
hexdump -C testdata/NEWMON7.bin > testdata/NEWMON7_bin.hex
diff -a testdata/NEWMON7_ROM.hex testdata/NEWMON7_bin.hex
node ../tools/mzdasm testdata/NEWMON7.BIN -o testdata/NEWMON7.as2
diff -a testdata/NEWMON7.asm testdata/NEWMON7.as2
node ../tools/mzasm ASM/NEWMON7.asm -o testdata/NEWMON7.BN2
diff -b testdata/NEWMON7.ROM testdata/NEWMON7.BN2
hexdump -C testdata/NEWMON7.BN2 > testdata/NEWMON7_BN2.hex
diff -a testdata/NEWMON7_ROM.hex testdata/NEWMON7_BN2.hex

#NEWMON
node ../tools/mzdasm testdata/NEWMON.ROM -o testdata/NEWMON.asm
node ../tools/mzasm testdata/NEWMON.asm -o testdata/NEWMON.BIN
diff -b testdata/NEWMON.ROM testdata/NEWMON.BIN
hexdump -C testdata/NEWMON.ROM > testdata/NEWMON_ROM.hex
hexdump -C testdata/NEWMON.bin > testdata/NEWMON_bin.hex
diff -a testdata/NEWMON_ROM.hex testdata/NEWMON_bin.hex
node ../tools/mzdasm testdata/NEWMON.BIN -o testdata/NEWMON.as2
diff -a testdata/NEWMON.asm testdata/NEWMON.as2
node ../tools/mzasm ASM/NEWMON.asm -o testdata/NEWMON.BN2
diff -b testdata/NEWMON.ROM testdata/NEWMON.BN2
hexdump -C testdata/NEWMON.BIN > testdata/NEWMON_BN2.hex
diff -a testdata/NEWMON_ROM.hex testdata/NEWMON_BN2.hex

#WONDER HOUSE
node ../tools/mzdasm -t testdata/WH_newmon.mzt -o testdata/WH_newmon.asm
node ../tools/mzasm -t testdata/WH_newmon.mzt testdata/WH_newmon.asm -o testdata/WH_newmon.bin
diff -b testdata/WH_newmon.mzt testdata/WH_newmon.bin
hexdump -C testdata/WH_newmon.mzt > testdata/Wh_newmon_mzt.hex
hexdump -C testdata/WH_newmon.bin > testdata/Wh_newmon_bin.hex
diff -a testdata/WH_newmon_mzt.hex testdata/WH_newmon_bin.hex
node ../tools/mzdasm -t testdata/WH_newmon.bin -o testdata/WH_newmon.as2
diff -a testdata/WH_newmon.asm testdata/WH_newmon.as2
node ../tools/mzasm -t testdata/WH_newmon.mzt ASM/WH_newmon.asm -o testdata/WH_newmon.BN2
diff -b testdata/WH_newmon.mzt testdata/WH_newmon.BN2
hexdump -C testdata/WH_newmon.bin > testdata/Wh_newmon_bn2.hex
diff -a testdata/WH_newmon_mzt.hex testdata/WH_newmon_bn2.hex

#BdHopper
node ../tools/mzdasm -t testdata/BdHopper.mzt -o testdata/BdHopper.asm
node ../tools/mzasm -t testdata/BdHopper.mzt testdata/BdHopper.asm -o testdata/BdHopper.bin
diff -b testdata/BdHopper.mzt testdata/BdHopper.bin
hexdump -C testdata/BdHopper.mzt > testdata/BdHopper_mzt.hex
hexdump -C testdata/BdHopper.bin > testdata/BdHopper_bin.hex
diff -a testdata/BdHopper_mzt.hex testdata/BdHopper_bin.hex
node ../tools/mzdasm -t testdata/BdHopper.bin -o testdata/BdHopper.as2
diff -a testdata/BdHopper.asm testdata/BdHopper.as2
node ../tools/mzasm -t testdata/BdHopper.mzt ASM/BdHopper.asm -o testdata/BdHopper.BN2
diff -b testdata/BdHopper.mzt testdata/BdHopper.BN2
hexdump -C testdata/BdHopper.bin > testdata/BdHopper_bn2.hex
diff -a testdata/BdHopper_mzt.hex testdata/BdHopper_bn2.hex

# #REFUGEE
# node ../tools/mzdasm -t testdata/REFUGEE.mzt -o testdata/REFUGEE.asm
# node ../tools/mzasm -t testdata/REFUGEE.mzt testdata/REFUGEE.asm -o testdata/REFUGEE.bin
# diff -b testdata/REFUGEE.mzt testdata/REFUGEE.bin
# hexdump -C testdata/REFUGEE.mzt > testdata/REFUGEE_mzt.hex
# hexdump -C testdata/REFUGEE.bin > testdata/REFUGEE_bin.hex
# diff -a testdata/REFUGEE_mzt.hex testdata/REFUGEE_bin.hex
# node ../tools/mzdasm -t testdata/REFUGEE.bin -o testdata/REFUGEE.as2
# diff -a testdata/REFUGEE.asm testdata/REFUGEE.as2
# node ../tools/mzasm -t testdata/REFUGEE.mzt  ASM/REFUGEE.asm -o testdata/REFUGEE.BN2
# diff -b testdata/REFUGEE.mzt testdata/REFUGEE.BN2
# hexdump -C testdata/REFUGEE.bin > testdata/REFUGEE_bn2.hex
# diff -a testdata/REFUGEE_mzt.hex testdata/REFUGEE_bn2.hex
