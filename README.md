Full JavaScript MZ-700 Emulator
===============================

This is a MZ-700 emulator running on the web browser written by JavaScript.

At first, the New Monitor Program is running.

You can drop the MZT-file to its screen to run the program.

The MZ-700 was a Japanese 8-bit personal computer that was produced by SHARP from 1982.

a lot of people were saying,

__There is no impossible things for MZ-700.__


INSTALLATION
------------

use npm.

If you just want to run the emulator, you would use -g option for npm.

```
$ npm install -g mz700-js
```

RUN A CLIENT SIDE EMULATION ON THE BROWSER
------------------------------------------

When this module was installed to local,
Go to its installed directory like ./node\_modules/mz700.js, and start a local web server.

```
$ npm start

> mz700-js@0.0.0 start <absolute/path/to/this/module>
> node ./bin/www
```

Then, the client emulation page is being served as an URL
[http://localhost:3000/MZ-700/client.html](http://localhost:3000/MZ-700/client.html).
The page will be opened in automatically with your main browser.
Of course, you can use another one instead in manually.

The browser requires the features of HTML5.
But, it __does not work with the Microsoft Edge__.


If you installed this to global, you can run the emulator by command 'mz700-js'.

ROADMAP
-------

* v0.1.0 - The key-in events are accepted by window object.
* v0.2.0 - Improve the key-alignment like a keyboard rather than the key-matrix.
* v0.3.0 - The screen objects are aligned smarter.
* v1.0.0 - The emulation of a CMT reading and writing work.
* The running speed can be changed.
* Visualize the memory bank to show which is selected.
* Disassemble when stopped at a break point or after step execution.
* Create a list of addresses like a distination of jumping instruction.

LICENCE
-------

MIT
