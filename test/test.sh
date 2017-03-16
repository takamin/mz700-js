#!/bin/sh

#Z80 Implemenation statistics
node z80_imp_stat > z80_imp_stat.txt
if [ $? -ne 0 ]; then
    echo "Z80 IMPLEMENTATION INCOPLETE." 1>&2
    cat z80_imp_stat.txt
fi

#NEWMON7
node ../tools/mzdasm -c testdata/NEWMON7.ROM | grep '^\s*[^;]' > testdata/NEWMON7._asm_
node ../tools/mzasm testdata/NEWMON7._asm_ -o testdata/NEWMON7.BIN
diff -b testdata/NEWMON7.ROM testdata/NEWMON7.BIN
hexdump -C testdata/NEWMON7.ROM > testdata/NEWMON7_ROM.hex
hexdump -C testdata/NEWMON7.bin > testdata/NEWMON7_bin.hex
diff -a testdata/NEWMON7_ROM.hex testdata/NEWMON7_bin.hex
node ../tools/mzdasm -c testdata/NEWMON7.BIN | grep '^\s*[^;]' > testdata/NEWMON7.as2
diff -a testdata/NEWMON7._asm_ testdata/NEWMON7.as2
node ../tools/mzasm ASM/NEWMON7._asm_ -o testdata/NEWMON7.BN2
diff -b testdata/NEWMON7.ROM testdata/NEWMON7.BN2
hexdump -C testdata/NEWMON7.BN2 > testdata/NEWMON7_BN2.hex
diff -a testdata/NEWMON7_ROM.hex testdata/NEWMON7_BN2.hex

#NEWMON
node ../tools/mzdasm -c testdata/NEWMON.ROM | grep '^\s*[^;]' > testdata/NEWMON._asm_
node ../tools/mzasm testdata/NEWMON._asm_ -o testdata/NEWMON.BIN
diff -b testdata/NEWMON.ROM testdata/NEWMON.BIN
hexdump -C testdata/NEWMON.ROM > testdata/NEWMON_ROM.hex
hexdump -C testdata/NEWMON.bin > testdata/NEWMON_bin.hex
diff -a testdata/NEWMON_ROM.hex testdata/NEWMON_bin.hex
node ../tools/mzdasm -c testdata/NEWMON.BIN | grep '^\s*[^;]' > testdata/NEWMON.as2
diff -a testdata/NEWMON._asm_ testdata/NEWMON.as2
node ../tools/mzasm ASM/NEWMON._asm_ -o testdata/NEWMON.BN2
diff -b testdata/NEWMON.ROM testdata/NEWMON.BN2
hexdump -C testdata/NEWMON.BIN > testdata/NEWMON_BN2.hex
diff -a testdata/NEWMON_ROM.hex testdata/NEWMON_BN2.hex

#WONDER HOUSE
node ../tools/mzdasm -t testdata/WH_newmon.mzt -o testdata/WH_newmon._asm_
node ../tools/mzasm -t testdata/WH_newmon.mzt testdata/WH_newmon._asm_ -o testdata/WH_newmon.bin
diff -b testdata/WH_newmon.mzt testdata/WH_newmon.bin
hexdump -C testdata/WH_newmon.mzt > testdata/Wh_newmon_mzt.hex
hexdump -C testdata/WH_newmon.bin > testdata/Wh_newmon_bin.hex
diff -a testdata/WH_newmon_mzt.hex testdata/WH_newmon_bin.hex
node ../tools/mzdasm -t testdata/WH_newmon.bin -o testdata/WH_newmon.as2
diff -a testdata/WH_newmon._asm_ testdata/WH_newmon.as2
node ../tools/mzasm -t testdata/WH_newmon.mzt ASM/WH_newmon._asm_ -o testdata/WH_newmon.BN2
diff -b testdata/WH_newmon.mzt testdata/WH_newmon.BN2
hexdump -C testdata/WH_newmon.bin > testdata/Wh_newmon_bn2.hex
diff -a testdata/WH_newmon_mzt.hex testdata/WH_newmon_bn2.hex

#BdHopper
node ../tools/mzdasm -t testdata/BdHopper.mzt -o testdata/BdHopper._asm_
node ../tools/mzasm -t testdata/BdHopper.mzt testdata/BdHopper._asm_ -o testdata/BdHopper.bin
diff -b testdata/BdHopper.mzt testdata/BdHopper.bin
hexdump -C testdata/BdHopper.mzt > testdata/BdHopper_mzt.hex
hexdump -C testdata/BdHopper.bin > testdata/BdHopper_bin.hex
diff -a testdata/BdHopper_mzt.hex testdata/BdHopper_bin.hex
node ../tools/mzdasm -t testdata/BdHopper.bin -o testdata/BdHopper.as2
diff -a testdata/BdHopper._asm_ testdata/BdHopper.as2
node ../tools/mzasm -t testdata/BdHopper.mzt ASM/BdHopper._asm_ -o testdata/BdHopper.BN2
diff -b testdata/BdHopper.mzt testdata/BdHopper.BN2
hexdump -C testdata/BdHopper.bin > testdata/BdHopper_bn2.hex
diff -a testdata/BdHopper_mzt.hex testdata/BdHopper_bn2.hex

# #REFUGEE
# node ../tools/mzdasm -t testdata/REFUGEE.mzt -o testdata/REFUGEE._asm_
# node ../tools/mzasm -t testdata/REFUGEE.mzt testdata/REFUGEE._asm_ -o testdata/REFUGEE.bin
# diff -b testdata/REFUGEE.mzt testdata/REFUGEE.bin
# hexdump -C testdata/REFUGEE.mzt > testdata/REFUGEE_mzt.hex
# hexdump -C testdata/REFUGEE.bin > testdata/REFUGEE_bin.hex
# diff -a testdata/REFUGEE_mzt.hex testdata/REFUGEE_bin.hex
# node ../tools/mzdasm -t testdata/REFUGEE.bin -o testdata/REFUGEE.as2
# diff -a testdata/REFUGEE._asm_ testdata/REFUGEE.as2
# node ../tools/mzasm -t testdata/REFUGEE.mzt  ASM/REFUGEE._asm_ -o testdata/REFUGEE.BN2
# diff -b testdata/REFUGEE.mzt testdata/REFUGEE.BN2
# hexdump -C testdata/REFUGEE.bin > testdata/REFUGEE_bn2.hex
# diff -a testdata/REFUGEE_mzt.hex testdata/REFUGEE_bn2.hex
