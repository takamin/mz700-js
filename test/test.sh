#!/bin/sh

#Z80 Implemenation statistics
node Z80_imp_stat > Z80_imp_stat.txt
if [ $? -ne 0 ]; then
    echo "Z80 IMPLEMENTATION INCOPLETE." 1>&2
    cat Z80_imp_stat.txt
fi

#NEWMON7
node ../bin/mzdasm -c testdata/NEWMON7.rom | grep '^\s*[^;]' > testdata/NEWMON7._asm_
node ../bin/mzasm testdata/NEWMON7._asm_ -o testdata/NEWMON7.bin
diff -b testdata/NEWMON7.rom testdata/NEWMON7.bin
hexdump -C testdata/NEWMON7.rom > testdata/NEWMON7_rom.hex
hexdump -C testdata/NEWMON7.bin > testdata/NEWMON7_bin.hex
diff -a testdata/NEWMON7_rom.hex testdata/NEWMON7_bin.hex
node ../bin/mzdasm -c testdata/NEWMON7.bin | grep '^\s*[^;]' > testdata/NEWMON7.as2
diff -a testdata/NEWMON7._asm_ testdata/NEWMON7.as2
node ../bin/mzasm ASM/NEWMON7._asm_ -o testdata/NEWMON7.bn2
diff -b testdata/NEWMON7.rom testdata/NEWMON7.bn2
hexdump -C testdata/NEWMON7.bn2 > testdata/NEWMON7_bn2.hex
diff -a testdata/NEWMON7_rom.hex testdata/NEWMON7_bn2.hex

#NEWMON
node ../bin/mzdasm -c testdata/NEWMON.rom | grep '^\s*[^;]' > testdata/NEWMON._asm_
node ../bin/mzasm testdata/NEWMON._asm_ -o testdata/NEWMON.bin
diff -b testdata/NEWMON.rom testdata/NEWMON.bin
hexdump -C testdata/NEWMON.rom > testdata/NEWMON_rom.hex
hexdump -C testdata/NEWMON.bin > testdata/NEWMON_bin.hex
diff -a testdata/NEWMON_rom.hex testdata/NEWMON_bin.hex
node ../bin/mzdasm -c testdata/NEWMON.bin | grep '^\s*[^;]' > testdata/NEWMON.as2
diff -a testdata/NEWMON._asm_ testdata/NEWMON.as2
node ../bin/mzasm ASM/NEWMON._asm_ -o testdata/NEWMON.bn2
diff -b testdata/NEWMON.rom testdata/NEWMON.bn2
hexdump -C testdata/NEWMON.bin > testdata/NEWMON_bn2.hex
diff -a testdata/NEWMON_rom.hex testdata/NEWMON_bn2.hex

#WONDER HOUSE
node ../bin/mzdasm -t testdata/WH_newmon.mzt -o testdata/WH_newmon._asm_
node ../bin/mzasm -t testdata/WH_newmon.mzt testdata/WH_newmon._asm_ -o testdata/WH_newmon.bin
diff -b testdata/WH_newmon.mzt testdata/WH_newmon.bin
hexdump -C testdata/WH_newmon.mzt > testdata/WH_newmon_mzt.hex
hexdump -C testdata/WH_newmon.bin > testdata/WH_newmon_bin.hex
diff -a testdata/WH_newmon_mzt.hex testdata/WH_newmon_bin.hex
node ../bin/mzdasm -t testdata/WH_newmon.bin -o testdata/WH_newmon.as2
diff -a testdata/WH_newmon._asm_ testdata/WH_newmon.as2
node ../bin/mzasm -t testdata/WH_newmon.mzt ASM/WH_newmon._asm_ -o testdata/WH_newmon.bn2
diff -b testdata/WH_newmon.mzt testdata/WH_newmon.bn2
hexdump -C testdata/WH_newmon.bin > testdata/WH_newmon_bn2.hex
diff -a testdata/WH_newmon_mzt.hex testdata/WH_newmon_bn2.hex

#BdHopper
node ../bin/mzdasm -t testdata/BdHopper.mzt -o testdata/BdHopper._asm_
node ../bin/mzasm -t testdata/BdHopper.mzt testdata/BdHopper._asm_ -o testdata/BdHopper.bin
diff -b testdata/BdHopper.mzt testdata/BdHopper.bin
hexdump -C testdata/BdHopper.mzt > testdata/BdHopper_mzt.hex
hexdump -C testdata/BdHopper.bin > testdata/BdHopper_bin.hex
diff -a testdata/BdHopper_mzt.hex testdata/BdHopper_bin.hex
node ../bin/mzdasm -t testdata/BdHopper.bin -o testdata/BdHopper.as2
diff -a testdata/BdHopper._asm_ testdata/BdHopper.as2
node ../bin/mzasm -t testdata/BdHopper.mzt ASM/BdHopper._asm_ -o testdata/BdHopper.bn2
diff -b testdata/BdHopper.mzt testdata/BdHopper.bn2
hexdump -C testdata/BdHopper.bin > testdata/BdHopper_bn2.hex
diff -a testdata/BdHopper_mzt.hex testdata/BdHopper_bn2.hex

# #REFUGEE
# node ../bin/mzdasm -t testdata/REFUGEE.mzt -o testdata/REFUGEE._asm_
# node ../bin/mzasm -t testdata/REFUGEE.mzt testdata/REFUGEE._asm_ -o testdata/REFUGEE.bin
# diff -b testdata/REFUGEE.mzt testdata/REFUGEE.bin
# hexdump -C testdata/REFUGEE.mzt > testdata/REFUGEE_mzt.hex
# hexdump -C testdata/REFUGEE.bin > testdata/REFUGEE_bin.hex
# diff -a testdata/REFUGEE_mzt.hex testdata/REFUGEE_bin.hex
# node ../bin/mzdasm -t testdata/REFUGEE.bin -o testdata/REFUGEE.as2
# diff -a testdata/REFUGEE._asm_ testdata/REFUGEE.as2
# node ../bin/mzasm -t testdata/REFUGEE.mzt  ASM/REFUGEE._asm_ -o testdata/REFUGEE.bn2
# diff -b testdata/REFUGEE.mzt testdata/REFUGEE.bn2
# hexdump -C testdata/REFUGEE.bin > testdata/REFUGEE_bn2.hex
# diff -a testdata/REFUGEE_mzt.hex testdata/REFUGEE_bn2.hex
