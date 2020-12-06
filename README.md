MZ-700 Full JavaScript Emulator
===============================

[![Build Status](https://travis-ci.org/takamin/mz700-js.svg?branch=master)](https://travis-ci.org/takamin/mz700-js)

<a href="https://takamin.github.io/mz700-js/emu.html"
target="_blank" title="Click to run this emulator on the Github page">
<img src="https://github.com/takamin/mz700-js/blob/gh-pages/image/title.png?raw=true"
width="100%" style="max-width:900px"/>
</a>

Description
-----------

This is an emulator of "MZ-700", a Japanese historical 8-bit microcomputer.

This emulator is written by JavaScript.
It works on the modern HTML5 web browser.
I would strongly recommend Google Chrome,
because of the emulation speed and its stability.

MZ-700
------

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

<a href="https://takamin.github.io/MZ-700/"
target="_blank" title="Click to play some free 8 bit game">
<img src="https://takamin.github.io/MZ-700/image/MZ-700.png"
width="100%" style="max-width:900px"/>
</a>

PREREQUISITES and FEATURES
--------------------------

* Node.js 8.10 or later is required.
* This emulator bundles [MZ-NEW MONITOR](http://retropc.net/mz-memories/mz700/) to boot.
* You can drop a MZT-file to the screen to run.
* Z80 assembler and disassembler is available on the Web and also CLI command.
* And, it's a somewhat a crazy feature, the emulator running on the CLI with Node.js is also available.

INSTALLATION
------------

```
$ npm install   # Build
$ npm start     # Start local web server and run the app.
```

Access http://localhost:3000/mz700-js/emu.html with your browser,
if the emulation page does not open.

Or [the emulation page](https://takamin.github.io/mz700-js/emu.html) is available
without local installation.


LICENCE
-------

MIT
