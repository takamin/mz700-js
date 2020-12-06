/*
 * jquery.mz700scrn.js - MZ-700 Screen
 *
 * The MZ-700 is an 8-bit personal computer released by Sharp in Nov 15 1982,
 * belong in the company's MZ series.
 *
 * Copyright (c) 2016 Koji Takami
 * Released under the MIT license
 */

/*
The MIT License (MIT)

Copyright (c) 2016 Koji Takami

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
(function() {
    "use strict";
    const mz700scrn = require("../mz700-scrn.js");
    const jquery_plugin_class = require("./jquery_plugin_class");
    jquery_plugin_class("mz700scrn");
    window.mz700scrn = mz700scrn;
}());
