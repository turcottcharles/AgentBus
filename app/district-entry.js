'use strict';
(() => {
  const container = document.getElementById('districtV2');
  let ui;
  const controls = document.getElementById('districtControlRoom');
  controls.addEventListener('click', () => {
    const open = document.body.classList.toggle('districtControlsOpen');
    controls.setAttribute('aria-expanded', String(open));
    controls.textContent = open ? 'Close controls' : 'Control room';
  });
  function show(mode) {
    ui?.setVisible?.(mode === 'district');
    container.hidden = mode !== 'district';
    document.getElementById('district').hidden = mode !== 'smoke';
    document.getElementById('classicMain').hidden = mode !== 'messages';
    document.body.classList.toggle('districtV2View', mode === 'district');
    document.body.classList.toggle('mapView', mode !== 'messages');
    document.getElementById('btnDistrictV2').setAttribute('aria-pressed', String(mode === 'district'));
    document.getElementById('btnMap').setAttribute('aria-pressed', String(mode === 'smoke'));
    document.getElementById('btnClassic').setAttribute('aria-pressed', String(mode === 'messages'));
    if (mode === 'district') ui?.refresh();
  }
  document.getElementById('btnDistrictV2').addEventListener('click', () => show('district'));
  document.getElementById('btnMap').addEventListener('click', () => show('smoke'));
  document.getElementById('btnClassic').addEventListener('click', () => show('messages'));
  ui = window.DistrictWorkbench.mount({ container, api: { snapshot: () => window.bus.districtSnapshot(),
    voice: { status: () => window.bus.districtVoiceStatus(), start: () => window.bus.districtVoiceStart(),
      stop: () => window.bus.districtVoiceStop(), onEvent: callback => window.bus.onDistrictVoice(callback) },
    tests: {workers:()=>window.bus.mapWorkers(),list:()=>window.bus.mapJobs(),assign:assignment=>window.bus.mapRun(assignment),cancel:id=>window.bus.mapCancel(id)},
    command: command => window.bus.districtCommand(command), openSmoke: () => { document.getElementById('btnMap').click(); } } });
  show('district');
})();
