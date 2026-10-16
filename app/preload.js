'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (arg) => ipcRenderer.invoke(ch, arg);

contextBridge.exposeInMainWorld('bus', {
  snapshot: call('bus:snapshot'),
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
});
