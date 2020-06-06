CHANGES
=======

* v1.4.\*
    * An assembly source file is available to run by dropping to the screen.
* v1.3.\*
    * Asynchronous problems on UI-widget is fixed.
* v1.2.\*
    * The emulation speed can be controlled by the slider.
    * Fix some bugs.
* v1.1.\*
    * The emulation speed stability is increased.
    * Fix some bugs.
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


