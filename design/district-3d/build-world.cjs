'use strict';
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '../..');
esbuild.build({
  absWorkingDir: root,
  entryPoints: ['app/district-3d/world-entry.js'],
  outfile: 'app/district-attract-world.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['chrome144'],
  minify: true,
  legalComments: 'eof',
  metafile: true,
  banner: { js: '/* Agent Bus original district renderer. Three.js MIT: vendor/THREE-LICENSE.txt */' },
}).then(result => {
  fs.writeFileSync(path.join(__dirname, 'bundle-metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n');
  console.log('District world bundled locally.');
}).catch(error => { console.error(error.message); process.exitCode = 1; });
