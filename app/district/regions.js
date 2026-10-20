'use strict';

// Geometry authority shared by the monitor picker and the Electron host.
// Bounds are fractions of the display's usable workArea, not native pixels.
// No monitor selection, persistence, window mutation or command dispatch here.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DistrictRegions = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function bounds(x, y, width, height) {
    return Object.freeze({ x, y, width, height });
  }

  const REGIONS = Object.freeze([
    { id: 'full', label: 'Full display', bounds: bounds(0, 0, 1, 1) },
    { id: 'left-third', label: 'Left third', bounds: bounds(0, 0, 1 / 3, 1) },
    { id: 'middle-third', label: 'Middle third', bounds: bounds(1 / 3, 0, 1 / 3, 1) },
    { id: 'right-third', label: 'Right third', bounds: bounds(2 / 3, 0, 1 / 3, 1) },
    { id: 'left-half', label: 'Left half', bounds: bounds(0, 0, 1 / 2, 1) },
    { id: 'right-half', label: 'Right half', bounds: bounds(1 / 2, 0, 1 / 2, 1) },
    { id: 'top-left', label: 'Top left quarter', bounds: bounds(0, 0, 1 / 2, 1 / 2) },
    { id: 'top-right', label: 'Top right quarter', bounds: bounds(1 / 2, 0, 1 / 2, 1 / 2) },
    { id: 'bottom-left', label: 'Bottom left quarter', bounds: bounds(0, 1 / 2, 1 / 2, 1 / 2) },
    { id: 'bottom-right', label: 'Bottom right quarter', bounds: bounds(1 / 2, 1 / 2, 1 / 2, 1 / 2) },
  ].map(Object.freeze));
  const BY_ID = new Map(REGIONS.map((region) => [region.id, region]));
  const KEYS = ['x', 'y', 'width', 'height'];

  function failure(code, message) {
    return Object.assign(new RangeError(message), { code });
  }

  function normalize(region = 'full', customBounds) {
    if (region === 'custom') {
      if (!customBounds || typeof customBounds !== 'object' || Array.isArray(customBounds) ||
          !KEYS.every((key) => Number.isFinite(customBounds[key]))) {
        throw failure('REGION_INVALID', 'A custom area needs finite x, y, width and height fractions.');
      }
      const { x, y, width, height } = customBounds;
      if (x < 0 || y < 0 || x > 1 || y > 1 || width <= 0 || height <= 0 ||
          width > 1 || height > 1 || x + width > 1 || y + height > 1) {
        throw failure('REGION_INVALID', 'The custom area must be positive and wholly inside the display work area (0–1).');
      }
      return Object.freeze({ region, bounds: bounds(x, y, width, height) });
    }
    const preset = BY_ID.get(region);
    if (!preset) throw failure('REGION_INVALID', 'Choose a supported display area or a valid custom rectangle.');
    // Retaining a previous custom draft does not change a selected preset.
    return Object.freeze({ region: preset.id, bounds: preset.bounds });
  }

  function workAreaRect(workArea) {
    if (!workArea || typeof workArea !== 'object' || Array.isArray(workArea) ||
        !KEYS.every((key) => Number.isFinite(workArea[key])) || workArea.width <= 0 || workArea.height <= 0) {
      throw failure('DISPLAY_INVALID', 'The display work area needs finite coordinates and positive dimensions.');
    }
    // Electron supplies integer logical coordinates. For another finite source,
    // keep only whole pixels inside its outer edges; never expand outside it.
    const x = Math.ceil(workArea.x), y = Math.ceil(workArea.y);
    const right = Math.floor(workArea.x + workArea.width);
    const bottom = Math.floor(workArea.y + workArea.height);
    const width = right - x, height = bottom - y;
    if (![x, y, right, bottom, width, height].every(Number.isSafeInteger) || width <= 0 || height <= 0) {
      throw failure('DISPLAY_INVALID', 'The display work area has no valid whole-pixel rectangle.');
    }
    return { x, y, width, height };
  }

  function resolveBounds(workArea, region = 'full', customBounds, options = {}) {
    const area = workAreaRect(workArea);
    const normalized = normalize(region, customBounds).bounds;
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw failure('REGION_INVALID', 'Display area minimum sizes must be an options object.');
    }
    const minWidth = options.minWidth === undefined ? 320 : options.minWidth;
    const minHeight = options.minHeight === undefined ? 200 : options.minHeight;
    if (![minWidth, minHeight].every((value) => Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.ceil(value)))) {
      throw failure('REGION_INVALID', 'Display area minimum sizes must be finite nonnegative numbers.');
    }
    // Round shared edges, never independent widths: adjacent thirds/quadrants
    // meet on the exact same integer, including odd-sized or negative displays.
    const left = area.x + Math.round(area.width * normalized.x);
    const top = area.y + Math.round(area.height * normalized.y);
    const right = area.x + Math.round(area.width * (normalized.x + normalized.width));
    const bottom = area.y + Math.round(area.height * (normalized.y + normalized.height));
    const width = right - left, height = bottom - top;
    if (width < 1 || height < 1 || width < minWidth || height < minHeight) {
      throw failure('REGION_TOO_SMALL', `The selected area is ${width}×${height} logical pixels; choose at least ${Math.max(1, Math.ceil(minWidth))}×${Math.max(1, Math.ceil(minHeight))}.`);
    }
    return { x: left, y: top, width, height };
  }

  function displayKey(display) {
    if (!display || display.id == null || !String(display.id).trim() || String(display.id).length > 160 || /[\u0000-\u001f\u007f]/.test(String(display.id)))
      throw failure('DISPLAY_INVALID', 'A physical monitor needs a stable display ID.');
    const screen = workAreaRect(display.bounds), area = workAreaRect(display.workArea);
    if (area.x < screen.x || area.y < screen.y || area.x + area.width > screen.x + screen.width || area.y + area.height > screen.y + screen.height)
      throw failure('DISPLAY_INVALID', 'The usable work area must stay inside its physical monitor.');
    const scale = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0 ? display.scaleFactor : null;
    return JSON.stringify([String(display.id), screen, area, scale]);
  }

  function overlaps(first, second) {
    const a = normalize('custom', first).bounds, b = normalize('custom', second).bounds;
    return Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
      Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
  }

  return Object.freeze({ REGIONS, normalize, resolveBounds, workAreaRect, displayKey, overlaps });
});
