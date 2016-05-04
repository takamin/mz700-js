<?php
$newmon_hdl = fopen('./NEWMON.ROM', 'rb');
$newmon_bin = fread($newmon_hdl, 4096);
fclose($newmon_hdl);
$newmon_out = fopen('NEWMON.ROM.js', 'wt');
writeBinToJsArray($newmon_out, 'NEWMON', $newmon_bin);
fclose($newmon_out);

$newmon7_hdl= fopen('./NEWMON7.ROM', 'rb');
$newmon7_bin = fread($newmon7_hdl, 4096);
fclose($newmon7_hdl);
$newmon7_out = fopen('NEWMON7.ROM.js', 'wt');
writeBinToJSArray($newmon7_out, 'NEWMON7', $newmon7_bin);
fclose($newmon7_out);


function writeBinToJsArray($handle, $varname, $binstr) {
    $js = "var " . $varname . " = [";
    $i = 0;
    for($i = 0; $i < 4096; $i++) {
        if($i % 16 == 0) {
            $js .= "\n    ";
        }
        //$code = bin2hex(ord($binstr{$i}));
        $code = bin2hex($binstr{$i});
        if(strlen($code) < 2) $code = '0' . $code;
        $js .= "0x" . $code;
        if($i < 4096 - 1) {
            $js .= ',';
        }

    }
    $js .= "];\n";
    echo $js;
    fwrite($handle, $js);
}
