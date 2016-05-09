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

use npm

```
$ npm install mz700-js
```

Or clone from GitHub

RUN A CLIENT SIDE EMULATION ON THE BROWSER
------------------------------------------

Go to the directory where this module was installed,
And start a local web server.

```
$ npm start

> mz700-js@0.0.0 start <absolute/path/to/this/module>
> node ./bin/www
```

Then, the client emulation page is being served as an URL
[http://localhost:3000/MZ-700/client.html](http://localhost:3000/MZ-700/client.html).
The page will be opened in automatically with your main browser.
Ofcource, you can use another one instead in manually.

The browser requires the features of HTML5.
But, it __does not work with the Microsoft Edge__.


LICENCE
-------

MIT
