'use strict';
const fs = require('node:fs');
const path = require('node:path');
const canonical = fs.readFileSync(path.join(__dirname, '../STORYBOARD.json'), 'utf8').trimEnd();
JSON.parse(canonical);
fs.writeFileSync(path.join(__dirname, '../storyboard-data.js'), '/* Generated from STORYBOARD.json. Edit the canonical JSON, then regenerate this data. */\nwindow.STORYBOARD_DATA = ' + canonical + ';\n');
console.log('Storyboard data regenerated from the exact canonical JSON payload.');
