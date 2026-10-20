'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (arg) => ipcRenderer.invoke(ch, arg);

contextBridge.exposeInMainWorld('bus', {
  districtSnapshot: call('district:snapshot'),
  districtCommand: call('district:command'),
  districtVoiceStatus: call('district:voice-status'),
  districtVoiceStart: call('district:voice-start'),
  districtVoiceStop: call('district:voice-stop'),
  districtReadAsset: call('district:read-asset'),
  onDistrictWindowVisibility: listener => {
    if (typeof listener !== 'function') throw new TypeError('A visibility listener is required');
    const callback = (_event, value) => { if (typeof value === 'boolean') listener(value); };
    ipcRenderer.on('district:window-visibility', callback);
    return () => ipcRenderer.removeListener('district:window-visibility', callback);
  },
  onDistrictVoice: listener => {
    if (typeof listener !== 'function') throw new TypeError('A speech event listener is required');
    const callback = (_event, value) => listener(value);
    ipcRenderer.on('district:voice-event', callback);
    return () => ipcRenderer.removeListener('district:voice-event', callback);
  },
  mapJobs: call('map:jobs'),
  mapWorkers: call('map:workers'),
  mapRun: call('map:run'),
  mapCancel: call('map:cancel'),
  snapshot: call('bus:snapshot'),
  onBusChange: listener => {
    if (typeof listener !== 'function') throw new TypeError('A message listener is required');
    const callback = () => listener();
    ipcRenderer.on('bus:changed', callback);
    return () => ipcRenderer.removeListener('bus:changed', callback);
  },
  stats: call('bus:stats'),
  send: (to, body) => ipcRenderer.invoke('bus:send', { to, body }),
  forget: call('bus:forget'),
  openFolder: call('bus:openFolder'),
  sendFile: call('file:send'),
  saveFile: call('file:save'),
  revealFile: call('file:reveal'),
  saveProfile: call('profile:save'),
  deleteProfile: call('profile:delete'),
  previewCommand: call('profile:preview'),
  launch: call('session:launch'),
  assignProject: (name, project) => ipcRenderer.invoke('project:assign', { name, project }),
  collapseProject: (project, collapsed) => ipcRenderer.invoke('project:collapse', { project, collapsed }),
  renameProject: (from, to) => ipcRenderer.invoke('project:rename', { from, to }),
  deleteProject: call('project:delete'),
  sessionMenu: call('menu:session'),
  projectMenu: call('menu:project'),
  pickFolder: call('dialog:pickFolder'),
  netInfo: call('net:info'),
  netSet: call('net:set'),
  copy: call('clipboard:write'),
  setupStatus: call('setup:status'),
  setupFix: call('setup:fix'),
  steward: call('steward:state'),
  stewardConfig: call('steward:config'),
  stewardDigest: call('steward:digest'),
  stewardRun: call('steward:run'),
  stewardRuns: call('steward:openRuns'),
  proposals: call('proposal:list'),
  proposal: call('proposal:get'),
  proposalNew: (title, body) => ipcRenderer.invoke('proposal:new', { title, body }),
  proposalNote: (id, body, ask) => ipcRenderer.invoke('proposal:note', { id, body, ask }),
  proposalStatus: (id, status, note) => ipcRenderer.invoke('proposal:status', { id, status, note }),
  proposalBuild: (id, vendor) => ipcRenderer.invoke('proposal:build', { id, vendor }),
  proposalDiff: call('proposal:diff'),
  proposalMerge: call('proposal:merge'),
  proposalDiscard: call('proposal:discard'),
  keyring: call('keyring:list'),
  keyringSave: (original, entry) => ipcRenderer.invoke('keyring:save', { original, entry }),
  keyringDelete: call('keyring:delete'),
});
