'use strict';

// Shared project/facility tab selection. This module never reads storage, moves
// DOM focus, dispatches commands or starts work. The caller owns those actions.
//
// create(ids, initial?)                  initial may be a state or selected array
// reconcile(state, ids)                 remove unavailable ids; preserve focus
// click(state, id, ids, modifiers?)      plain / Ctrl / Meta / Shift click
// toggle(state, id, ids)                explicit accessible toggle, minimum one
// focus(state, id, ids)                 roving focus without changing selection
// serialize(state) / deserialize(json, ids)  caller-owned localStorage payload
// createView(value?) / setView(view, patch)   independent top/side and layout
// serializeView(view) / deserializeView(json) caller-owned display preferences
//
// selectedIds always follows the available ids' displayed order. focusedId may
// be unselected after a toggle; anchorId remains the last non-range click.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DistrictSelection = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const VERSION = 1;
  const MAX_ID_LENGTH = 512;
  const MAX_PERSISTED_LENGTH = 1024 * 1024;

  function isId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH &&
      value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function idsOf(value) {
    return Array.isArray(value) ? Array.from(new Set(value.filter(isId))) : [];
  }

  function stateOf(value) {
    if (Array.isArray(value)) return { selectedIds: value };
    return value && typeof value === 'object' ? value : {};
  }

  function snapshot(selectedIds, focusedId, anchorId) {
    return Object.freeze({ selectedIds: Object.freeze(selectedIds), focusedId, anchorId });
  }

  function reconcile(value, availableIds) {
    const ids = idsOf(availableIds);
    if (!ids.length) return snapshot([], null, null);
    const state = stateOf(value), available = new Set(ids);
    const selected = new Set(idsOf(state.selectedIds));
    const selectedIds = ids.filter((id) => selected.has(id));
    const keptFocus = available.has(state.focusedId) ? state.focusedId : null;
    if (!selectedIds.length) selectedIds.push(keptFocus || ids[0]);
    const focusedId = keptFocus || selectedIds[0];
    const anchorId = available.has(state.anchorId) ? state.anchorId : focusedId;
    return snapshot(selectedIds, focusedId, anchorId);
  }

  function create(availableIds, initial) {
    return reconcile(initial, availableIds);
  }

  function click(value, id, availableIds, modifiers) {
    const ids = idsOf(availableIds);
    const state = reconcile(value, ids);
    if (!ids.includes(id)) return state;
    const keys = modifiers || {};
    const additive = keys.ctrlKey === true || keys.metaKey === true;
    if (keys.shiftKey === true) {
      const anchor = state.anchorId || state.focusedId || id;
      const start = ids.indexOf(anchor), end = ids.indexOf(id);
      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
      const selected = new Set(additive ? state.selectedIds.concat(range) : range);
      return snapshot(ids.filter((item) => selected.has(item)), id, anchor);
    }
    if (additive) {
      const selected = new Set(state.selectedIds);
      if (selected.has(id)) {
        if (selected.size > 1) selected.delete(id);
      } else selected.add(id);
      return snapshot(ids.filter((item) => selected.has(item)), id, id);
    }
    return snapshot([id], id, id);
  }

  function toggle(state, id, availableIds) {
    return click(state, id, availableIds, { ctrlKey: true });
  }

  function focus(value, id, availableIds) {
    const ids = idsOf(availableIds);
    const state = reconcile(value, ids);
    return ids.includes(id) ? snapshot(state.selectedIds.slice(), id, state.anchorId) : state;
  }

  function serialize(value) {
    const state = stateOf(value);
    const selectedIds = idsOf(state.selectedIds);
    const focusedId = isId(state.focusedId) ? state.focusedId : selectedIds[0] || null;
    const anchorId = isId(state.anchorId) ? state.anchorId : focusedId;
    // Intentionally whitelist only selection ids, never the caller's project
    // records, connection descriptors, tokens or other surrounding state.
    return JSON.stringify({ version: VERSION, selectedIds, focusedId, anchorId });
  }

  function deserialize(json, availableIds) {
    let state;
    if (typeof json === 'string' && json.length <= MAX_PERSISTED_LENGTH) {
      try {
        const decoded = JSON.parse(json);
        if (decoded && typeof decoded === 'object' && !Array.isArray(decoded) && decoded.version === VERSION) state = decoded;
      } catch { /* A damaged/old local value starts from the available options. */ }
    }
    return reconcile(state, availableIds);
  }

  function createView(value) {
    const view = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.freeze({
      navigation: view.navigation === 'side' ? 'side' : 'top',
      // Keep the deployed workbench's split value. Tiled is its plain-language
      // alias, not a separate mode which could lose an existing preference.
      layout: view.layout === 'split' || view.layout === 'tiled' ? 'split' : 'overview',
    });
  }

  function setView(value, patch) {
    const current = createView(value);
    const change = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
    return createView({
      navigation: ['top', 'side'].includes(change.navigation) ? change.navigation : current.navigation,
      layout: ['overview', 'split', 'tiled'].includes(change.layout) ? change.layout : current.layout,
    });
  }

  function serializeView(value) {
    const view = createView(value);
    return JSON.stringify({ version: VERSION, navigation: view.navigation, layout: view.layout });
  }

  function deserializeView(json) {
    if (typeof json === 'string' && json.length <= MAX_PERSISTED_LENGTH) {
      // Support the existing standalone MODE_KEY during caller-owned migration.
      if (json === 'overview' || json === 'split' || json === 'tiled') return createView({ layout: json });
      try {
        const view = JSON.parse(json);
        if (view && typeof view === 'object' && !Array.isArray(view) && view.version === VERSION) return createView(view);
      } catch { /* Invalid display preferences never affect project selection. */ }
    }
    return createView();
  }

  return Object.freeze({ VERSION, create, reconcile, click, toggle, focus, serialize, deserialize,
    createView, setView, serializeView, deserializeView });
});
