'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const NAMES = new Set(['district-world.glb', 'district-host.glb']);
const MAX_BYTES = 24 * 1024 * 1024;

// This is an asset reader, never a caller-selected file or network capability.
async function readDistrictAsset(name) {
  if (!NAMES.has(name)) throw new Error('Unknown district asset');
  const filename = path.join(__dirname, '..', 'assets', 'district-v2', name);
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 20 || stat.size > MAX_BYTES) throw new Error('Invalid district asset size or type');
  const bytes = await fs.readFile(filename);
  if (bytes.length !== stat.size || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid district GLB');
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || jsonLength < 2 || jsonLength > bytes.length - 20) throw new Error('Invalid district GLB metadata');
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  if ([...(document.buffers || []), ...(document.images || [])].some(item => item.uri !== undefined)) throw new Error('District assets must contain embedded resources');
  return { base64: bytes.toString('base64') };
}
module.exports = { readDistrictAsset };
