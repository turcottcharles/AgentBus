'use strict';

// Exercise the actual reader in an isolated app-shaped tree; never replace the
// artist's assets or start Electron, a provider, microphone or network request.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAX_BYTES = 24 * 1024 * 1024;
function glb(document = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }) {
  const encoded = Buffer.from(JSON.stringify(document));
  const json = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 0x20);
  encoded.copy(json);
  const bytes = Buffer.alloc(20 + json.length);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(json.length, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  json.copy(bytes, 20);
  return bytes;
}
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-district-assets-'));
  const moduleDirectory = path.join(directory, 'app', 'district');
  const assets = path.join(directory, 'app', 'assets', 'district-v2');
  fs.mkdirSync(moduleDirectory, { recursive: true });
  fs.mkdirSync(assets, { recursive: true });
  const modulePath = path.join(moduleDirectory, 'assets.js');
  fs.copyFileSync(path.join(__dirname, '..', 'app', 'district', 'assets.js'), modulePath);
  const { readDistrictAsset } = require(modulePath);
  t.after(() => {
    delete require.cache[modulePath];
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.match(path.basename(resolved), /^agent-bus-district-assets-/);
    assert.equal(fs.lstatSync(resolved).isSymbolicLink(), false);
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3 });
  });
  const write = (bytes, name = 'district-world.glb') => {
    const filename = path.join(assets, name);
    fs.writeFileSync(filename, bytes);
    return filename;
  };
  return { directory, assets, readDistrictAsset, write };
}

test('district asset reader returns exact local embedded GLB bytes for only the two named assets', async (t) => {
  const f = fixture(t), bytes = glb();
  for (const name of ['district-world.glb', 'district-host.glb']) {
    f.write(bytes, name);
    const result = await f.readDistrictAsset(name);
    assert.deepEqual(Object.keys(result), ['base64']);
    assert.deepEqual(Buffer.from(result.base64, 'base64'), bytes);
  }
});

test('district asset reader rejects paths, URLs, aliases and non-string inputs before reading', async (t) => {
  const f = fixture(t);
  for (const name of [
    '../district-world.glb', '..\\district-world.glb', 'district-v2/district-world.glb',
    '/district-world.glb', 'C:\\secret.glb', 'file:///C:/secret.glb',
    'https://example.invalid/asset.glb', 'data:application/octet-stream;base64,AA==',
    'DISTRICT-WORLD.GLB', 'district-world.glb:secret', 'district-world.glb.',
    'district-world.glb ', 'district-world.glb\0', '', null, undefined, 1,
    {}, ['district-world.glb'], new String('district-world.glb'),
  ]) await assert.rejects(f.readDistrictAsset(name), /Unknown district asset/);
});

test('district assets reject all buffer or image URI forms, including remote, local and embedded data URLs', async (t) => {
  const f = fixture(t);
  for (const collection of ['buffers', 'images']) {
    for (const uri of ['https://example.invalid/secret', 'http://127.0.0.1:1/snapshot',
      'file:///C:/secret', '../secret.bin', 'data:application/octet-stream;base64,AAAA', '', null]) {
      f.write(glb({ asset: { version: '2.0' }, [collection]: [{ uri }] }));
      await assert.rejects(f.readDistrictAsset('district-world.glb'), /embedded resources/);
    }
  }
});

test('district assets fail closed for malformed GLB headers, JSON and declared sizes', async (t) => {
  const f = fixture(t);
  const mutations = [
    bytes => bytes.writeUInt32LE(0, 0),
    bytes => bytes.writeUInt32LE(1, 4),
    bytes => bytes.writeUInt32LE(bytes.length + 4, 8),
    bytes => bytes.writeUInt32LE(0, 16),
    bytes => bytes.writeUInt32LE(1, 12),
    bytes => bytes.writeUInt32LE(bytes.length, 12),
    bytes => { bytes[20] = 0; },
  ];
  for (const mutate of mutations) {
    const bytes = glb(); mutate(bytes); f.write(bytes);
    await assert.rejects(f.readDistrictAsset('district-world.glb'));
  }
  f.write(Buffer.alloc(19));
  await assert.rejects(f.readDistrictAsset('district-world.glb'), /size or type/);
  f.write(glb({ asset: { version: '2.0' }, buffers: {} }));
  await assert.rejects(f.readDistrictAsset('district-world.glb'));
});

test('district asset reader rejects oversized files and directories without returning bytes', async (t) => {
  const f = fixture(t), filename = f.write(glb());
  fs.truncateSync(filename, MAX_BYTES + 1);
  await assert.rejects(f.readDistrictAsset('district-world.glb'), /size or type/);
  fs.mkdirSync(path.join(f.assets, 'district-host.glb'));
  await assert.rejects(f.readDistrictAsset('district-host.glb'), /size or type/);
});

test('district asset reader rejects a named asset replaced by a file symlink', async (t) => {
  const f = fixture(t), outside = path.join(f.directory, 'outside.glb');
  fs.writeFileSync(outside, glb());
  try { fs.symlinkSync(outside, path.join(f.assets, 'district-host.glb'), 'file'); }
  catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') { t.skip('Host cannot create file symlinks'); return; }
    throw error;
  }
  await assert.rejects(f.readDistrictAsset('district-host.glb'), /size or type/);
});

test('browser GLB validation independently rejects external resources, decoder extensions and corrupt chunks', async () => {
  // Importing this module does not mount it or create a context. These checks
  // validate binary metadata only; actual rendering remains a GPU-only gate.
  const { validateEmbeddedGLB } = await import('../app/district-3d/world-entry.js');
  const buffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.equal(validateEmbeddedGLB(buffer(glb())).asset.version, '2.0');
  for (const collection of ['buffers', 'images']) {
    for (const uri of ['https://example.invalid/asset', '../secret.bin', 'file:///C:/secret',
      'data:application/octet-stream;base64,AAAA', null, '']) {
      assert.throws(() => validateEmbeddedGLB(buffer(glb({ asset: { version: '2.0' },
        [collection]: [{ uri }] }))), /External GLB resources/);
    }
  }
  for (const extension of ['KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_meshopt_compression']) {
    assert.throws(() => validateEmbeddedGLB(buffer(glb({ asset: { version: '2.0' },
      extensionsRequired: [extension] }))), /External geometry decoders/);
  }
  assert.throws(() => validateEmbeddedGLB(buffer(glb({ asset: { version: '1.0' } }))), /scene description/);
  const first = glb(), duplicate = Buffer.concat([first, first.subarray(12)]);
  duplicate.writeUInt32LE(duplicate.length, 8);
  assert.throws(() => validateEmbeddedGLB(buffer(duplicate)), /Duplicate GLB JSON/);
  const misaligned = glb(); misaligned.writeUInt32LE(misaligned.readUInt32LE(12) - 1, 12);
  assert.throws(() => validateEmbeddedGLB(buffer(misaligned)), /chunk bounds/);
  const incomplete = Buffer.concat([glb(), Buffer.alloc(4)]);
  incomplete.writeUInt32LE(incomplete.length, 8);
  assert.throws(() => validateEmbeddedGLB(buffer(incomplete)), /Truncated GLB chunk/);
});
