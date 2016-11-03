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

ROADMAP
-------

* v0.1.0 - The key-in events are accepted by window object.
    * v0.1.1 - It can run on the Microsoft Edge.
    * v0.1.4 - Edit this README
    * v0.1.6 - Update screen layouts.
    * v0.1.7 - Some scripts are changed to a node module.
    And on development environment, the packages of grunt, bower and browserify
    are installed.
    * __v0.1.8__ - Add PCG-700 emulation.
    It is mapped to the addresses where from E010H to E012H in memory mapped I/O area.
    Details of the I/O is described at
    [MZ-700 I/O](http://www.maroon.dti.ne.jp/youkan/mz700/mziomap.html)(Japanese)
    or [PCG700 operation](http://www.sharpmz.org/mz-700/pcg700_03.htm).
    But I cannot do the tests enough.
    Because I don't have a binary that use this feature.
* v0.2.0 - A flexisible screen layout with multi columns that contains multi rows.
Both of the column and row are movable, resizable, addable and removable. The pane
can contain one screen object like a screen, a keyboard, a register indicator or a
memory dump.
* v0.3.0 - Simulate key alignment of MZ-700's keyboard for the screeen keyboard.
And the keys will be interactively shown, when the shift or the control keys were
pushed.
* v0.4.0 - Visualize the memory banks to show which is selected.
* v0.5.0 - The running speed can be changed.
* v0.6.0 - Disassemble when stopped at a break point or after step execution.
* v0.7.0 - Create a list of addresses like a distination of jumping instruction.
* v1.0.0 - The emulation of a CMT reading and writing work.

LICENCE
-------

MIT
