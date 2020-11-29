#!/usr/bin/env node
"use strict";
const startWebServer = require("./lib/start-web-server.js");
startWebServer("..", 3000, "mz700-js/emu.html");
