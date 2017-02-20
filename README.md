Full JavaScript MZ-700 Emulator
===============================

This is a MZ-700 emulator running on the web browser written by JavaScript.

Initially, the New Monitor Program is running.

You can drop a MZT-file to the screen to run.

The MZ-700 is a Japanese 8-bit personal computer produced by SHARP in Nov.15,1982.
It is powered by Z80A CPU 3.58MHz, and represents eight colors and various characters,
but no graphics and monoral beep sound.
It also equipped built-in cassette tape player/recorder and 4 color plotter printer.  

So, A lot of people were saying,

__There is no impossible things for MZ-700.__


INSTALLATION
------------

If you just want to run the emulator, you would use -g option for npm.

```
$ npm install -g mz700-js
```

Or, You can clone from [GitHub](https://github.com/takamin/mz700-js) or download a zip.

RUN A CLIENT SIDE EMULATION ON THE BROWSER
------------------------------------------

If you installed by npm global, you can use `mz700-js` command on your shell,

```
$ mz700-js

> mz700-js@0.0.0 start <absolute/path/to/this/module>
> node ./bin/www
```

When the git repository was cloned, Go to its directory, and then use `npm start`

```
$ npm start

> mz700-js@0.0.0 start <absolute/path/to/this/module>
> node ./bin/www
```

Then, the client emulation page is being served as an URL
[http://localhost:3000/MZ-700/client.html](http://localhost:3000/MZ-700/client.html).
The page will be opened in automatically with your main browser.
Of course, you can use another one instead in manually.

Available Browsers
------------------

* Google Chrome
* Mozzilla Firefox
* Microsoft Internet explorer 11 (but no sound and slow)
* Microsoft Edge (but slow)

CHANGES
-------

* v0.1.0 - The key-in events are accepted by window object.
    * v0.1.1 - It can run on the Microsoft Edge.
    * v0.1.4 - Edit this README
    * v0.1.6 - Update screen layouts.
    * v0.1.7 - Some scripts are changed to a node module.
    And on development environment, the packages of grunt, bower and browserify
    are installed.
    * v0.1.8 - Add PCG-700 emulation.
    It is mapped to the addresses where from E010H to E012H in memory mapped I/O area.
    Details of the I/O is described at
    [MZ-700 I/O](http://www.maroon.dti.ne.jp/youkan/mz700/mziomap.html)(Japanese)
    or [PCG700 operation](http://www.sharpmz.org/mz-700/pcg700_03.htm).
    But I cannot do the tests enough.
    Because I don't have a binary that use this feature.
    * v0.1.9 - 'S' command is available on monitor.
    Type `*S1200,1260,1200,PCG-CURSOR-MZ[CR]` and click `RECPLAY` button, and
    you can download a MZT file named `PCG-CURSOR-MZ.MZT`.
    * v0.1.10 - cycles and disassembling-features are added completely.
    * v0.1.11 - The assembling and disassembling commands named
    `mzasm` and `mzdas` is available.
    * v0.1.12 - Update grunt's bundles.
    * v0.1.13 -
    (1) Some undefined instructions of Z80 (not all, only what the 'XEVIOUS for 700'
    might be using) are available to execute, assemble and dis-assemble.
    (2) The bug that the emulator stops after each 'OUT' instruction executed was fixed.
    (3) The binary named `bin2mzt` is added. This will insert the MZ-Tape-Header to the raw binary file.
    (4) For disassembler `mzdas`, the option to offset the address is available.
    * v0.1.14 - (1) Fix installing problem. (2) On reset, the screen will be cleared.
    * __v0.1.15__ - (1) On reset, CPU will run automatically.
    (2) On the Chrome, the emulation speed can be controlled with three sliders.
    But this feature might not work on the other browser.
    (3) Run, Stop and Step can be controlled from keys.
        * [Ctrl]+[F8]: run/continue
        * [Ctrl]+[F9]: stop/break
        * [Ctrl]+[F11]: step

WANT TO DO
----------

* Visualize the memory banks to show which is selected.
* <s>Change the running speed.</s> - __Done__
* Disassemble around the break point or the program counter.
* With disassembling, create a list of addresses that are distinations of jumping instruction.
* Emulate plotter printer of MZ-731.
* Emulate MZ-1500. PSG and PCG.

LICENCE
-------

MIT
