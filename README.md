MZ-700 Full JavaScript Emulator
===============================

<a href="https://takamin.github.io/mz700-js/emu.html"
target="_blank" title="Click to run this emulator on the Github page">
<img src="https://github.com/takamin/mz700-js/blob/gh-pages/image/title.png?raw=true"
width="100%" style="max-width:900px"/>
</a>

This is an emulator of "MZ-700", a Japanese historical 8-bit micro computer.

This emulator is written in JavaScript.
It works on the modern HTML5 web browser.
I would strongly recommend Google Chrome,
because of the emulation speed and its stability.

You can visit this [GitHub-page](https://takamin.github.io/mz700-js/emu.html) to run on your web browser.

The MZ-700 is produced by SHARP in Nov.15,1982.
It equipped a Z80A CPU 3.58MHz,
and represents various characters in eight colors
and a monoral beep sound, but no graphics.

There were three models:

* MZ-711 - The base model.
* MZ-721 - A built-in cassette deck is available
* MZ-731 - A cassette deck and 4 color plotter printer were built in.

Many people were saying,

__"MZ-700 Has No LIMIT"__

<a href="http://bicycle.life.coocan.jp/takamints/index.php/MZ-700"
target="_blank" title="Click to play some free 8 bit game">
<img src="http://bicycle.life.coocan.jp/takamints/modules/MZ-700/image/MZ-700.png"
width="100%" style="max-width:900px"/>
</a>

In this emulator:

* Initially and on reset, The MZ-NEW-MONITOR in the BOOT ROM will run.
* You can drop a MZT-file to the screen to run it.

And, this module bundle a tiny assembler and disassember for the Z80.
And more, somewhat a craizy feature, the emulator on the CLI by Node.js is available.

INSTALLATION
------------

If you just want to run the emulator, you would use -g option for npm.

```
$ npm install -g mz700-js
```

Or, You can clone from [GitHub](https://github.com/takamin/mz700-js) or download a zip.

RUN A CLIENT SIDE EMULATION ON THE BROWSER
------------------------------------------

If you install this to global, run `mz700-js` command.
If you clone the git repository, install and start this module like this:

```
$ npm install   # Build
$ npm start     # Start local web server and run the app.
```

The page will be opened with your browser.

Available Browsers
------------------

* Google Chrome
* Mozzilla Firefox
* Microsoft Internet explorer 11 (but no sound and slow)
* Microsoft Edge (but slow)




`mz700-cli` - RUN THE CLI EMULATOR with Node.js
-----------------------------------------------

### COMMAND LINE

```
> mz700-cli [-c <mzt-filename>] [<mzt-filename>]
```

### OPTIONS

* c - Set a MZT file to the data recorder as CMT.

### PARAMETERS

* `<mzt-filename>` - A MZT-filename to be loaded to the memory immedietely.

### COMMANDS

* __`exit`__ - Exit from the emulator.
* __`run`__ - Run MZ-700 emulation.
* __`stop`__ - Stop emulation.
* __`step`__ _`[<num>]`_ - Execute N instructions and stop. num default is 1.
* __`vram`__ - Print VRAM to console.
* __`reg`__ - Print register.
* __`key`__ _`<input-strings>`_ - Convert the string to MZ-700's Key-Matrix, Then push those stroke.
* __`jp`__ _`<addr>`_ - Set the PC of Z80 CPU.
* __`mem set`__ _`<addr> <data> [ <data> ...]`_ - Write data to the memory
* __`mem dump`__ _`<addr>`_ - Print the contents of the memory.
* __`cmt set`__ _`<mzt-filename>`_ - Set CMT to the data recorder.
* __`cmt eject`__ - Eject CMT.
* __`cmt play`__ - Push the PLAY button of the data recorder.
* __`cmt rec`__ - Push the REC button of the data recorder.
* __`cmt stop`__ - Push the STOP button of the data recorder.
* __`bp set`__ _`<addr>`_ - Set break points at the address.
* __`bp rm`__ _`<addr>`_ - Remove the break points set at the address.
* __`bp clear`__ - Clear all break points.
* __`conf key duration make <num>`__ - Set key making duration by millisec.
* __`conf key duration release <num>`__ - Set key releasing duration by millisec.
* __`conf key duration make`__ - Print key making duration.
* __`conf key duration release`__ - Print key releasing duration.

#### Parameters for the commands

* _`<num>`_ : Number.
* _`<addr>`_, _`<data>`_ : Specify the address like `0123h` as hexadecimal or `1024` as decimal
* _`<input-string>`_ : String structured by the keys of the MZ-700 Key-Matrix.

CHANGES
-------

* v1.0.\*
    * An UI-logic was isolated. The emulation is stable for a year.
* v0.9.\*
    * Use CodeMirror for Z80 assemble source editor.
    * Improve disassembling speed.
    * Updating debugger UI ( Use mouse wheel to scroll ).
    * Allow the multi file assembling on the web and CLI assembler.
* v0.8.\*
    * Improving UI experiences.
    * Some emulation codes are now written as Asm.js.
    * Add buttons to load a MZT file. The file is a JavaScript source and is loaded by JSONP.
    * Fix potential security vulnerabilities in package-lock.json.
* v0.7.0 - Change the layout by device type.(But the module was not compiled.)
    * v0.7.1 - Change the layout by device type.
    * v0.7.2 - Fix the bug on v0.7.1: The emulator could not accept key-inputs from
    a physical keyboard when the software keyboard is removed on PC.
    * v0.7.3 - Simplified the sliders that control the emulation speed.
    * v0.7.4 - Improve the UI.
    * v0.7.5 - Optimize the features of MZT loading, assembling and disassembling.
    * v0.7.6 - Tweak UI
    * v0.7.7 - Fixed a bug in the 'mz700-cli' command on speed control parameters.
    * v0.7.8 - Improve the screen keyboard for the mobile and tablet.
        * It might be able to scroll horizontally.
        * It will be opened at startup.
    * v0.7.9 - Do not fold the rows in the right side panels.
    * v0.7.10 - Fix a bug that could not parse an address on memory-dump widget.
    * v0.7.11 - Improves the usability.
        * The screen keyboard and any control buttons are available in fullscreen mode.
        * Tweak the layout styles.
    * v0.7.12 - Clear the assemble result when the source is chaged, and It will reassemble.
    * v0.7.13 - Refactors the disassembler. It generates assembling informations to display.
        And an improvement of the development environment such as jsdoc and ctags was done.
    * v0.7.14 - Currently Implementing the feature of the assemble source editor that
        could edit multiple file with tabbed page. This work is not completed.
    * v0.7.15 - When the MZT is dropped to the screen or CMT panel,
        a disassemble button is shown in the filename area.
        And the MZT is not disassembled in automatic.
        To disassemble it, you need to push that disassemble button.
        And, the tab page styles were applied to the assemble source view.
    * v0.7.16 - Fix a CLI emulation bug that could not start to run.
    * __v0.7.17__ - Fix following Z80 core emulation bugs about the stack pointer.
        And this version seems to be able to run the __"Tiny XEVIOUS for MZ-700"__ (but incompletely).
        * The instruction `LD SP,(nn)` had been loading `nn` to SP.
        * Three instructions of `ADD HL,SP`, `ADC HL,SP` and `SBC HL,SP` had been invoking
        undefined method and stopping with an error.
* v0.6.0 - Some panels are resizable. And truely fullscreen mode is available.
    * v0.6.1 - On fullscreen mode, The input from keyboard is enabled.
    * v0.6.2 - Improve the beep sound and decrease the pop noise.
* v0.5.0 - Add fullscreen feature.
* v0.4.0 - Change and update the development environment. And for mz700scrn plugin, some features are added.
* v0.3.0 - Update web-emulator's screen by the command `mz700-js` or `npm start`
    * v0.3.1 - The grunt task `lint` is available. To run the check, type `grunt lint` on console.
* v0.2.0 (1) The CMT-loading process is available on both web and cli emulators,
but it seems not perfect. (2) The CLI-tools print actual module version with `-v` option.
(3) `npm test` is available.  To run the test, `npm mocha` and `bash` required. On Windows,
Please use MSYS or Git bash of GitHub for Windows. (4) The dependency `--saved` modules in
`package.json` are upgraded.
    * v0.2.6 - Browserifies and uglifies the worker script, and Changes and fixies the version of npm debug to suppress warning on install the packages.
    * v0.2.5 - Manages package. npm jade is changed to pug, the scripts are minified by uglify-js, and a favicon.ico is added.
    * v0.2.4 - Remove the script submodule `transworker`. Use fractional-timer for emulation.
    * v0.2.3 - Publish the script `transworker.js` as a [node module](https://www.npmjs.com/package/transworker).
    * v0.2.2 - Fix the emulation of the Intel 8253 and IC556, and the process for `EI` instruction.
    * v0.2.1 - Fix some bugs on CLI. MZT-loading process and the 'push down' character
    (down arrow and under line) to normal one.
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
    * v0.1.15 - (1) On reset, CPU will run automatically.
    (2) On the Chrome, the emulation speed can be controlled with three sliders.
    But this feature might not work on the other browser.
    (3) Run, Stop and Step can be controlled from keys.
        * [Ctrl]+[F8]: run/continue
        * [Ctrl]+[F9]: stop/break
        * [Ctrl]+[F11]: step
    * v0.1.16 - Add CLI emulator and debugger `mz700-cli`.
    * v0.1.17 - Changed initial keystroke durations of CLI emulator and allow those values to be changed by added `conf` command .

TODO
-----

* Visualize the memory banks to show which is selected.
* Disassemble around the break point or the program counter.
* With disassembling, create a list of addresses that are distinations of jumping instruction.
* Emulate plotter printer of MZ-731.
* Emulate MZ-1500. PSG and PCG.

LICENCE
-------

MIT
