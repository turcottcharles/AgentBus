'use strict';
(() => {
  const el = (id) => document.getElementById(id);
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const names = ['JavaScript syntax', 'Python syntax and local messaging', 'Hub messaging and read receipts', 'File bytes and integrity hash', 'HTTP authentication and RPC', 'Owner approval and keyring overwrite guards'];
  const map = { selected: '@smoke-runner', workers: [], jobs: [], jobId: null, zoom: 1, x: 0, y: 0, fit: 1, busy: false, key: '', polling: false };
  const world = el('mapWorld'), viewport = el('mapViewport'), test = el('testBuilding');
  let testWorld = null, watchingTest = false, sceneUnavailable = false;
  function selectedJob() { return map.jobs.find(j=>j.id===map.jobId)||map.jobs[0]||null; }
  function syncTestScene(options={}) {
    if(!watchingTest)return;
    const job=selectedJob();
    testWorld?.setTestRun(job,{...options,unavailable:sceneUnavailable});
    const steps=job?.steps||[], passed=steps.filter(s=>s.state==='passed').length;
    el('testSceneTitle').textContent=sceneUnavailable?'Status unavailable':job?`${passed}/6 checks · ${job.state.replaceAll('_',' ')}`:'Ready for an assignment';
    el('testSceneDetail').textContent=sceneUnavailable?'The last refresh failed. Work effects are paused until status returns.':job?.detail||'Your helper is ready. Assign a worker to Test.';
    el('testSceneScope').textContent=job?`Run #${job.id} · ${label(job.agent)} · ${job.root} · ${job.sha?.slice(0,12)||'unversioned'}`:'No work is running in this scene.';
  }
  function watchTest(enabled,options={}) {
    watchingTest=enabled;
    el('testScene').hidden=!enabled;el('watchTest').setAttribute('aria-pressed',String(enabled));el('watchTest').textContent=enabled?'Back to map':'Watch Test lab';
    if(enabled&&!testWorld){
      try { testWorld=window.DistrictAttractWorld.mount({container:el('testSceneWorld')}); }
      catch(e){el('mapNotice').textContent=`3D scene unavailable: ${e.message}`;watchTest(false);return;}
      const checkGraphics=()=>{
        const d=testWorld?.getDiagnostics();
        if(d?.error){el('mapNotice').textContent=`3D scene unavailable: ${d.error}. The map and real check results remain available.`;if(watchingTest)watchTest(false);}
      };
      el('testSceneWorld').addEventListener('district-world-state',checkGraphics,true);checkGraphics();
      if(!watchingTest)return;
    }
    testWorld?.setPaused(!enabled);if(enabled)syncTestScene(options);
  }
  const label = (id) => ({ '@smoke-runner': 'Smoke runner', '@claude-worker': 'Claude test agent', '@codex-worker': 'Codex test agent' })[id] || id;
  const activeStates = ['assigned', 'starting_agent', 'agent_working', 'running', 'agent_review'];
  const active = () => map.jobs.find((j) => activeStates.includes(j.state));
  const robot = `<svg viewBox="0 0 64 76" aria-hidden="true"><ellipse cx="32" cy="69" rx="23" ry="7" fill="#092136" opacity=".65"/><ellipse cx="32" cy="69" rx="22" ry="7" fill="none" stroke="#82f3e4" stroke-width="2"/><path d="M20 47L17 63Q19 68 26 65L29 53M37 52L40 65Q48 68 49 62L44 46" fill="#899bb6" stroke="#192d48" stroke-width="2"/><path d="M19 35Q32 28 45 36L46 51Q31 59 18 49Z" fill="#e0dbe9" stroke="#263958" stroke-width="2"/><path d="M15 39L10 52L16 55L23 43M47 38L54 49L49 54L41 44" fill="#afbcd1" stroke="#263958" stroke-width="2"/><rect x="25" y="39" width="14" height="9" rx="3" fill="#24ddcd"/><path d="M13 18Q16 3 33 4Q51 5 52 22L49 32Q32 42 15 31Z" fill="#eeeaf2" stroke="#273956" stroke-width="2"/><path d="M18 20Q34 13 47 21L45 29Q32 35 20 29Z" fill="#122d45"/><ellipse cx="26" cy="25" rx="3" ry="4" fill="#67eaff"/><ellipse cx="40" cy="24" rx="3" ry="4" fill="#67eaff"/><path d="M32 3V0" stroke="#8df5f1" stroke-width="3"/></svg>`;
  function transform() { world.style.transform = `translate(${map.x}px, ${map.y}px) scale(${map.fit * map.zoom})`; }
  function fit() {
    map.fit = Math.min(viewport.clientWidth / 1536, viewport.clientHeight / 1024);
    map.zoom = 1; map.x = (viewport.clientWidth - 1536 * map.fit) / 2; map.y = (viewport.clientHeight - 1024 * map.fit) / 2;
    transform();
  }
  function zoom(factor) {
    const old = map.zoom; map.zoom = Math.max(.8, Math.min(3, old * factor));
    const ratio = map.zoom / old;
    map.x = viewport.clientWidth / 2 - (viewport.clientWidth / 2 - map.x) * ratio;
    map.y = viewport.clientHeight / 2 - (viewport.clientHeight / 2 - map.y) * ratio; transform();
  }
  function choose(id) { map.selected = id; renderWorkers(); renderJob(); }
  function renderWorkers() {
    const available = map.workers.some((w) => w.name === map.selected);
    if (!available) map.selected = '@smoke-runner';
    el('workerCount').textContent = `${map.workers.filter((w) => w.available !== false).length} ready`;
    el('workerRoster').innerHTML = map.workers.map((w) => `<button class="workerCard" draggable="${w.available !== false}" ${w.available === false ? 'disabled' : ''} title="${escape(w.detail || '')}" data-agent="${escape(w.name)}" aria-pressed="${w.name === map.selected}"><strong>${escape(label(w.name))}</strong><small>${w.name === '@smoke-runner' ? 'Built-in · no model calls' : w.available === false ? 'CLI not installed' : 'Real agent · starts on assignment'}</small></button>`).join('');
    const recent = map.jobs[0];
    const previous = new Map([...el('mapWorkers').children].map((node) => [node.dataset.agent, node]));
    for (const [i, w] of map.workers.filter((w) => w.available !== false).slice(0, 8).entries()) {
      let node = previous.get(w.name);
      if (!node) {
        node = document.createElement('button'); node.className = 'mapWorker'; node.dataset.agent = w.name;
        node.innerHTML = robot + `<span>${escape(label(w.name))}</span>`; el('mapWorkers').append(node);
      }
      previous.delete(w.name);
      const atTest = recent?.agent === w.name;
      node.style.left = `${atTest ? 74 : 38 + (i % 3) * 11}%`; node.style.top = `${atTest ? 34 : 44 + Math.floor(i / 3) * 9}%`;
      node.classList.toggle('selected', w.name === map.selected);
      node.classList.toggle('working', atTest && !!active());
      node.title = `${label(w.name)} — drag onto Test`; node.setAttribute('aria-label', node.title);
    }
    for (const node of previous.values()) node.remove();
  }
  function renderJob() {
    const job = map.jobs.find((j) => j.id === map.jobId) || map.jobs[0];
    const running = active();
    const selected = map.workers.find((w) => w.name === map.selected);
    el('selectedWorker').innerHTML = `${escape(label(map.selected))}<small>${map.selected === '@smoke-runner' ? 'Local deterministic worker · no model calls' : 'Dedicated agent session · scoped smoke-test tool'}</small>`;
    el('runSmoke').disabled = !!running || map.busy || selected?.available === false;
    el('runSmoke').textContent = running ? 'Test facility occupied' : 'Assign to Test →';
    el('cancelSmoke').hidden = !running;
    const latest = map.jobs[0];
    test.classList.toggle('busy', !!running); test.classList.toggle('passed', latest?.state === 'passed'); test.classList.toggle('failed', latest?.state === 'failed');
    el('testStatus').textContent = running ? running.state === 'running' ? `${running.steps.filter((s) => s.state === 'passed').length}/6 checks · running` : running.state.replaceAll('_', ' ') : latest ? `${latest.state.toUpperCase()} · click to run again` : 'Ready for a worker';
    el('testProgress').hidden = !running;
    el('testProgress').value = running?.steps.filter((s) => s.state === 'passed').length || 0;
    const state = job?.state || 'ready';
    el('jobState').textContent = state.toUpperCase().replace('_', ' '); el('jobState').dataset.state = state;
    el('jobSteps').innerHTML = names.map((name, i) => {
      const step = job?.steps.find((s) => s.name === name);
      const state = step?.state === 'running' && !activeStates.includes(job.state) ? 'stopped' : step?.state || 'pending';
      return `<li data-state="${state}"><b>${state === 'passed' ? '✓' : state === 'failed' ? '!' : state === 'running' ? '↻' : state === 'stopped' ? '−' : i + 1}</b>${escape(name)}</li>`;
    }).join('');
    el('jobSummary').textContent = job?.detail || 'Checks cover syntax, messaging, files, HTTP authentication, and approval guards.';
    el('agentActivity').hidden = !job || !['claude', 'codex'].includes(job.executor);
    el('agentActivity').textContent = job?.agent_detail ? `Agent reports: ${job.agent_detail}` : 'Waiting for the agent to report activity or invoke the test tool…';
    const provenance = job ? [
      ['Run', `#${job.id} · ${new Date(job.created).toLocaleString()}`], ['Assigned worker', label(job.agent)],
      ['Executor', ['claude', 'codex'].includes(job.executor) ? `${job.executor} agent → scoped smoke-test tool` : 'Local smoke runner (no model calls)'],
      ['Agent session', job.session_id || 'Not recorded'], ['Agent exit code', job.agent_exit_code == null ? 'Not recorded / local runner' : String(job.agent_exit_code)],
      ['Checkout', job.root], ['Commit', job.sha],
      ['Working tree', job.dirty ? 'Includes local changes; commit alone does not identify tested files' : 'Clean at assignment'],
      ['Source SHA-256 manifest', Object.entries(job.manifest || {}).map(([file, hash]) => `${file}: ${hash}`).join('\n')],
      ['Command', job.command || 'node app/smoke-worker.js --root <checkout> --python <detected Python>'],
      ['Exit code', job.exit_code == null ? 'Not recorded' : String(job.exit_code)],
      ['Duration', job.finished && job.started ? `${((job.finished - job.started) / 1000).toFixed(1)} seconds` : 'In progress'],
    ] : [];
    el('jobProvenance').innerHTML = provenance.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('');
    el('agentOutput').textContent = job?.agent_output || 'No agent session output for this run.';
    const output = el('jobOutput');
    if (output.textContent !== (job?.output || 'Run a smoke test to collect evidence.')) {
      output.textContent = job?.output || 'Run a smoke test to collect evidence.'; output.scrollTop = output.scrollHeight;
    }
    el('jobHistory').innerHTML = map.jobs.slice(0, 8).map((j) => `<button data-job="${j.id}" aria-pressed="${j.id === job?.id}">#${j.id} · ${escape(j.state)} · ${escape(label(j.agent))}</button>`).join('') || '<span class="executorNote">No runs yet.</span>';
    syncTestScene();
  }
  async function assign(agent) {
    if (map.busy) return;
    map.busy = true; el('mapNotice').textContent = ''; choose(agent);
    try {
      const result = await window.bus.mapRun({ agent, building: 'test' });
      map.jobId = result.id; el('jobEvidence').open = true;
      await poll();
      watchTest(true,{follow:true});
    } catch (e) { el('mapNotice').textContent = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); }
    finally { map.busy = false; renderJob(); }
  }
  async function poll() {
    if (map.polling) return;
    map.polling = true;
    try {
      const jobs = await window.bus.mapJobs();
      sceneUnavailable=false;
      const key = JSON.stringify(jobs);
      if (key !== map.key) { map.jobs = jobs; map.key = key; renderWorkers(); renderJob(); }
      else syncTestScene();
    } catch (e) { sceneUnavailable=true; syncTestScene(); el('mapNotice').textContent = `Cannot read test jobs: ${e.message || e}`; }
    finally { map.polling = false; }
  }
  async function workers() {
    try {
      const slots = await window.bus.mapWorkers();
      const list = slots.map((slot) => ({ ...slot, name: slot.id }));
      if (JSON.stringify(list) !== JSON.stringify(map.workers)) {
        map.workers = list; renderWorkers(); renderJob();
      }
    } catch (e) { el('mapNotice').textContent = e.message || String(e); }
  }
  el('workerRoster').addEventListener('click', (e) => { const card = e.target.closest('[data-agent]'); if (card) choose(card.dataset.agent); });
  el('workerRoster').addEventListener('dragstart', (e) => {
    const card = e.target.closest('[data-agent]'); if (!card) return;
    map.selected = card.dataset.agent; renderJob(); e.dataTransfer.setData('text/plain', card.dataset.agent); e.dataTransfer.effectAllowed = 'move';
  });
  test.addEventListener('dragover', (e) => { e.preventDefault(); test.classList.add('dropTarget'); e.dataTransfer.dropEffect = 'move'; });
  test.addEventListener('dragleave', () => test.classList.remove('dropTarget'));
  test.addEventListener('drop', (e) => {
    e.preventDefault(); test.classList.remove('dropTarget'); const name = e.dataTransfer.getData('text/plain');
    if (map.workers.some((a) => a.name === name && a.available !== false)) assign(name);
  });
  let drag = null, suppressClick = false;
  viewport.addEventListener('pointerdown', (e) => {
    if (watchingTest) return;
    if (e.button !== 0 || e.target.closest('.station')) return;
    const worker = e.target.closest('.mapWorker');
    if (worker) choose(worker.dataset.agent);
    drag = { worker, startX: e.clientX, startY: e.clientY, x: map.x, y: map.y, moved: false };
    viewport.setPointerCapture(e.pointerId); e.preventDefault();
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < 5 && !drag.moved) return;
    drag.moved = true;
    if (drag.worker) {
      const rect = world.getBoundingClientRect(); drag.worker.classList.add('dragging');
      drag.worker.style.left = `${100 * (e.clientX - rect.left) / rect.width}%`;
      drag.worker.style.top = `${100 * (e.clientY - rect.top) / rect.height}%`;
      const b = test.getBoundingClientRect(); test.classList.toggle('dropTarget', e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom);
    } else { map.x = drag.x + e.clientX - drag.startX; map.y = drag.y + e.clientY - drag.startY; transform(); }
  });
  function finishDrag(e, cancelled) {
    if (!drag) return;
    const { worker, moved } = drag; drag = null;
    suppressClick = moved; setTimeout(() => { suppressClick = false; }, 0);
    if (worker) {
      worker.classList.remove('dragging'); const target = test.classList.contains('dropTarget'); test.classList.remove('dropTarget');
      if (moved && target && !cancelled) assign(worker.dataset.agent); else renderWorkers();
    }
  }
  viewport.addEventListener('pointerup', (e) => finishDrag(e, false));
  viewport.addEventListener('pointercancel', (e) => finishDrag(e, true));
  viewport.addEventListener('click', (e) => {
    if (suppressClick) return;
    const worker = e.target.closest('.mapWorker'); if (worker) choose(worker.dataset.agent);
    const station = e.target.closest('[data-building]');
    if (station?.dataset.building === 'test') assign(map.selected);
    else if (station) el('mapNotice').textContent = `${station.dataset.building[0].toUpperCase() + station.dataset.building.slice(1)} is a planned facility. Test runs real work today.`;
  });
  el('runSmoke').addEventListener('click', () => assign(map.selected));
  el('watchTest').addEventListener('click',()=>watchTest(!watchingTest));
  el('cancelSmoke').addEventListener('click', async () => {
    try { const job = active(); if (job) await window.bus.mapCancel(job.id); await poll(); }
    catch (e) { el('mapNotice').textContent = e.message || String(e); }
  });
  el('jobHistory').addEventListener('click', (e) => { const b = e.target.closest('[data-job]'); if (b) { map.jobId = Number(b.dataset.job); renderJob(); } });
  el('mapZoomIn').addEventListener('click', () => zoom(1.2));
  el('mapZoomOut').addEventListener('click', () => zoom(1 / 1.2));
  el('mapReset').addEventListener('click', fit);
  function view(isMap) {
    document.body.classList.toggle('mapView', isMap);
    el('district').hidden = !isMap; el('classicMain').hidden = isMap;
    el('btnMap').setAttribute('aria-pressed', String(isMap)); el('btnClassic').setAttribute('aria-pressed', String(!isMap));
    if (isMap) fit();
  }
  el('btnMap').addEventListener('click', () => view(true)); el('btnClassic').addEventListener('click', () => view(false));
  new ResizeObserver(() => { if (!el('district').hidden) fit(); }).observe(viewport);
  map.workers = [{ name: '@smoke-runner' }]; renderWorkers(); renderJob(); fit(); workers(); poll();
  async function tick() { await poll(); setTimeout(tick, active() ? 350 : 1500); }
  setTimeout(tick, 350); setInterval(workers, 5000);
})();
