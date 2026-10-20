'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { REGIONS, normalize, resolveBounds } = require('../app/district/regions');

const workArea = Object.freeze({ x: -1536, y: -101, width: 1537, height: 825 });
const tiny = { minWidth: 1, minHeight: 1 };
const code = (expected) => (error) => error.code === expected;

function inside(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
}

test('ten labeled immutable presets expose normalized rectangles; custom is not a preset', () => {
  assert.deepEqual(REGIONS.map((region) => region.id), ['full', 'left-third', 'middle-third', 'right-third', 'left-half', 'right-half', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);
  assert.equal(REGIONS.length, 10); assert.equal(REGIONS.some((region) => region.id === 'custom'), false);
  assert(Object.isFrozen(REGIONS));
  for (const region of REGIONS) {
    assert.equal(typeof region.label, 'string'); assert(region.label.length > 0);
    assert(Object.isFrozen(region)); assert(Object.isFrozen(region.bounds));
    assert.deepEqual(normalize(region.id), { region: region.id, bounds: region.bounds });
    assert(inside({ x: 0, y: 0, width: 1, height: 1 }, region.bounds));
  }
  assert.throws(() => { REGIONS[0].bounds.width = 0; }, TypeError);
});

test('normalize defaults only undefined to full and never guesses unknown region ids', () => {
  assert.deepEqual(normalize(), { region: 'full', bounds: { x: 0, y: 0, width: 1, height: 1 } });
  for (const region of [null, '', 'FULL', 'top-left-quarter', 'virtual-monitor-3', {}, 0]) {
    assert.throws(() => normalize(region), code('REGION_INVALID'));
  }
  assert.deepEqual(normalize('left-half', { stale: 'custom draft' }).bounds, { x: 0, y: 0, width: 0.5, height: 1 });
});

test('custom geometry is copied, normalized, whitelisted and never clamped', () => {
  const custom = Object.freeze({ x: 0.125, y: 0.25, width: 0.5, height: 0.5, token: 'omit-me' });
  const result = normalize('custom', custom);
  assert.deepEqual(result, { region: 'custom', bounds: { x: 0.125, y: 0.25, width: 0.5, height: 0.5 } });
  assert.notEqual(result.bounds, custom); assert(Object.isFrozen(result)); assert(Object.isFrozen(result.bounds));
  assert.equal(result.bounds.token, undefined);
  assert.deepEqual(normalize('custom', { x: 0, y: 0, width: 1, height: 1 }).bounds, normalize('full').bounds);
});

test('custom rectangles reject missing, nonfinite, coerced, outside and zero-area values', () => {
  const valid = { x: 0, y: 0, width: 0.5, height: 0.5 };
  for (const custom of [undefined, null, [], {}, { ...valid, x: '0' }, { ...valid, x: NaN },
    { ...valid, y: Infinity }, { ...valid, width: -1 }, { ...valid, width: 0 },
    { ...valid, height: 0 }, { ...valid, x: -0.00001 }, { ...valid, y: -0.01 },
    { ...valid, x: 0.6 }, { ...valid, y: 0.8 }, { ...valid, width: 1.01 }, { ...valid, height: 1.01 },
    { ...valid, x: 0.5, width: 0.5000000000000002 }]) {
    assert.throws(() => normalize('custom', custom), code('REGION_INVALID'), JSON.stringify(custom));
  }
});

test('odd-width thirds share edges and cover the work area exactly with negative origins', () => {
  const [left, middle, right] = ['left-third', 'middle-third', 'right-third'].map((id) => resolveBounds(workArea, id));
  assert.deepEqual(left, { x: -1536, y: -101, width: 512, height: 825 });
  assert.deepEqual(middle, { x: -1024, y: -101, width: 513, height: 825 });
  assert.deepEqual(right, { x: -511, y: -101, width: 512, height: 825 });
  assert.equal(left.x + left.width, middle.x); assert.equal(middle.x + middle.width, right.x);
  assert.equal(left.width + middle.width + right.width, workArea.width);
  assert.equal(right.x + right.width, workArea.x + workArea.width);
});

test('halves and quadrants share horizontal and vertical edges with no gaps or overlap', () => {
  const left = resolveBounds(workArea, 'left-half'), right = resolveBounds(workArea, 'right-half');
  assert.equal(left.x + left.width, right.x); assert.equal(left.width + right.width, workArea.width);
  const topLeft = resolveBounds(workArea, 'top-left'), topRight = resolveBounds(workArea, 'top-right');
  const bottomLeft = resolveBounds(workArea, 'bottom-left'), bottomRight = resolveBounds(workArea, 'bottom-right');
  assert.equal(topLeft.x + topLeft.width, topRight.x); assert.equal(bottomLeft.x + bottomLeft.width, bottomRight.x);
  assert.equal(topLeft.y + topLeft.height, bottomLeft.y); assert.equal(topRight.y + topRight.height, bottomRight.y);
  assert.equal(topLeft.width, bottomLeft.width); assert.equal(topRight.width, bottomRight.width);
  assert.equal(topLeft.height, topRight.height); assert.equal(bottomLeft.height, bottomRight.height);
  assert.equal([topLeft, topRight, bottomLeft, bottomRight].reduce((sum, rect) => sum + rect.width * rect.height, 0), workArea.width * workArea.height);
});

test('custom bounds resolve relative to logical workArea without native-pixel scaling', () => {
  const area = { x: -1536, y: 30, width: 1536, height: 824, scaleFactor: 2.5 };
  const custom = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
  assert.deepEqual(resolveBounds(area, 'custom', custom), { x: -1152, y: 236, width: 768, height: 412 });
  assert.deepEqual(resolveBounds(area, 'full'), { x: -1536, y: 30, width: 1536, height: 824 });
});

test('minimum logical sizes are explicit and collapsed rounded rectangles fail', () => {
  assert.throws(() => resolveBounds({ x: 0, y: 0, width: 600, height: 400 }, 'left-half'), code('REGION_TOO_SMALL'));
  assert.throws(() => resolveBounds({ x: 0, y: 0, width: 1000, height: 300 }, 'top-left'), code('REGION_TOO_SMALL'));
  assert.deepEqual(resolveBounds({ x: 0, y: 0, width: 640, height: 400 }, 'bottom-right'), { x: 320, y: 200, width: 320, height: 200 });
  assert.deepEqual(resolveBounds({ x: 0, y: 0, width: 10, height: 10 }, 'custom', { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, tiny), { x: 1, y: 1, width: 5, height: 5 });
  assert.throws(() => resolveBounds({ x: 0, y: 0, width: 1000, height: 1000 }, 'custom', { x: 0, y: 0, width: 0.00001, height: 0.5 }, { minWidth: 0, minHeight: 0 }), code('REGION_TOO_SMALL'));
});

test('invalid work areas and minimum options reject rather than inventing geometry', () => {
  for (const area of [null, {}, [], { ...workArea, x: Infinity }, { ...workArea, y: '0' },
    { ...workArea, width: 0 }, { ...workArea, height: -1 }, { ...workArea, x: Number.MAX_SAFE_INTEGER },
    { x: 0.2, y: 0.2, width: 0.2, height: 0.2 }]) {
    assert.throws(() => resolveBounds(area, 'full'), code('DISPLAY_INVALID'));
  }
  for (const options of [null, [], { minWidth: -1 }, { minHeight: Infinity }, { minWidth: '320' }, { minWidth: Number.MAX_VALUE }]) {
    assert.throws(() => resolveBounds(workArea, 'full', undefined, options), code('REGION_INVALID'));
  }
});

test('fractional outer areas round inward and remain wholly inside their supplied work area', () => {
  const area = { x: -100.6, y: 0.3, width: 1000.8, height: 700.9 };
  const full = resolveBounds(area, 'full');
  assert.deepEqual(full, { x: -100, y: 1, width: 1000, height: 700 }); assert(inside(area, full));
  const parts = ['left-third', 'middle-third', 'right-third'].map((region) => resolveBounds(area, region));
  assert.equal(parts[0].x + parts[0].width, parts[1].x); assert.equal(parts[1].x + parts[1].width, parts[2].x);
  assert.equal(parts.reduce((sum, rect) => sum + rect.width, 0), full.width);
});

test('preset tiling remains gapless across small odd/even dimensions with independent minimums', () => {
  for (const width of [3, 4, 5, 7, 11, 1001, 1537, 3840]) {
    for (const height of [3, 4, 7, 200, 825, 2161]) {
      const area = { x: -1937, y: -417, width, height };
      const third = ['left-third', 'middle-third', 'right-third'].map((region) => resolveBounds(area, region, undefined, tiny));
      assert.equal(third[0].x + third[0].width, third[1].x); assert.equal(third[1].x + third[1].width, third[2].x);
      assert.equal(third[0].width + third[1].width + third[2].width, width);
      for (const region of REGIONS) {
        const rect = resolveBounds(area, region.id, undefined, tiny);
        assert(inside(area, rect)); assert(Object.values(rect).every(Number.isInteger));
      }
    }
  }
});

test('browser UMD exports identical geometry without reading storage or dispatching work', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'district', 'regions.js'), 'utf8');
  const browser = {};
  Object.defineProperty(browser, 'localStorage', { get() { throw new Error('Geometry cannot access storage.'); } });
  Object.defineProperty(browser, 'bus', { get() { throw new Error('Geometry cannot dispatch work.'); } });
  vm.runInNewContext(source, { window: browser }, { timeout: 1000 });
  assert.deepEqual(Object.keys(browser), ['DistrictRegions']);
  assert.deepEqual(JSON.parse(JSON.stringify(browser.DistrictRegions.REGIONS)), REGIONS);
  const result = browser.DistrictRegions.resolveBounds(workArea, 'bottom-right');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), resolveBounds(workArea, 'bottom-right'));
});

test('tiling check detects planted independent-width rounding and passes restored source', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'district', 'regions.js'), 'utf8');
  const broken = source.replace(
    'const right = area.x + Math.round(area.width * (normalized.x + normalized.width));',
    'const right = left + Math.round(area.width * normalized.width);');
  assert.notEqual(broken, source, 'The planted break must change the actual right-edge calculation.');
  const compile = (text) => {
    const browser = {};
    vm.runInNewContext(text, { window: browser }, { timeout: 1000 });
    return browser.DistrictRegions;
  };
  const check = (geometry) => {
    const [left, middle, right] = ['left-third', 'middle-third', 'right-third'].map((id) => geometry.resolveBounds(workArea, id));
    assert.equal(left.x + left.width, middle.x, 'left and middle edges meet');
    assert.equal(middle.x + middle.width, right.x, 'middle and right edges meet');
    assert.equal(left.width + middle.width + right.width, workArea.width, 'all work-area columns are covered');
  };
  // Change -> compile fresh -> observe named failure -> restore original
  // source -> compile fresh and pass. No on-disk product source is modified.
  assert.throws(() => check(compile(broken)), { message: /middle and right edges meet/ });
  check(compile(source));
});
