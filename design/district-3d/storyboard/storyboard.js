(function () {
  'use strict';
  const root = document.getElementById('shots');
  if (!root) return;
  const raw = window.STORYBOARD_DATA && typeof window.STORYBOARD_DATA === 'object' ? window.STORYBOARD_DATA : {};
  const source = Array.isArray(raw.beats) ? raw.beats : Array.isArray(raw.shots) ? raw.shots : [];
  // Only sequential-panel editions belong on the active board.
  const hasPanels = source.some((beat) => beat && Array.isArray(beat.panels) && beat.panels.length);
  const data = hasPanels ? raw : {};
  const beats = hasPanels ? source.slice(0, 12) : [];
  const plain = (value, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 2400) : fallback;
  const node = (tag, className, value) => { const result = document.createElement(tag); if (className) result.className = className; if (value !== undefined) result.textContent = plain(value); return result; };
  const setText = (id, value) => { const target = document.getElementById(id); if (target && value !== undefined) target.textContent = plain(value); };
  function imageAsset(value) {
    const path = plain(value).replace(/^\.\//, '').replace(/^storyboard\//, '');
    return /^frames\/[a-z0-9_./-]+\.(png|jpg|jpeg|webp)$/i.test(path) && !path.split('/').includes('..') ? path : '';
  }
  function videoAsset(value) {
    const path = plain(value).replace(/^\.\//, '').replace(/^\.\.\/storyboard\//, '').replace(/^storyboard\//, '');
    return ['flow-animatic.mp4','motion-blockout.mp4','mechanical-opening.mp4'].includes(path) ? path : '';
  }
  function durationOf(record) {
    if (typeof record.duration === 'string' && record.duration) return plain(record.duration);
    if (record.kind === 'player-branch') return 'Player-selected branch · outside the attract loop';
    if (record.timecode) return plain(record.timecode);
    if (Number.isFinite(record.start) && Number.isFinite(record.end)) return record.start + '–' + record.end + ' s';
    return '';
  }
  setText('board-title', data.title);
  if (data.title) document.title = plain(data.title) + ' — Shot board';
  setText('board-subtitle', data.subtitle);
  setText('emotional-goal', data.emotionalGoal);
  setText('board-status', data.status);
  setText('continuity-note', data.primaryRule);
  setText('reference-note', data.referenceNote);
  setText('implementation-state', data.productionRules?.implementationState);
  document.querySelectorAll('.shot-nav a').forEach((link) => {
    const beat = beats.find((record) => record && link.getAttribute('href') === '#shot-' + plain(record.id));
    if (beat) link.textContent = plain(beat.id) + ' / ' + plain(beat.title || beat.name || beat.id);
  });
  if (Array.isArray(data.nonNegotiables)) {
    const list = document.getElementById('production-locks'); list.replaceChildren();
    data.nonNegotiables.forEach((rule) => list.append(node('li', '', rule)));
  }
  const timeline = [];
  const frameBindings = [];
  function addFrameImage(button, record, thumbnail) {
    button.replaceChildren();
    const pending = node('span', 'frame-pending', 'Panel asset in preparation');
    button.append(pending);
    if (record.src) {
      const image = node('img'); image.alt = record.id + ': ' + record.label + '. ' + record.action;
      image.loading = thumbnail ? 'lazy' : 'eager';
      image.addEventListener('load', () => { pending.hidden = true; });
      image.addEventListener('error', () => { image.hidden = true; pending.hidden = false; button.classList.add('is-unavailable'); });
      image.src = record.src; button.append(image);
    }
    return button;
  }
  function frameButton(record, className, thumbnail) {
    const button = node('button', 'frame-link ' + className); button.type = 'button'; button.dataset.panel = record.id;
    button.setAttribute('aria-label', 'Enlarge ' + record.id + ': ' + record.label);
    addFrameImage(button, record, thumbnail); frameBindings.push({button, record}); return button;
  }
  const primaryFields = [['motion', 'Motion'], ['mood', 'Mood'], ['meaning', 'Real-work meaning'], ['transition', 'Transition'], ['interrupt', 'Input / interrupt']];
  function addFields(list, record, fields) {
    fields.forEach(([field, label]) => {
      if (!record[field]) return;
      const row = node('div', field === 'meaning' ? 'wide' : ''); row.dataset.field = field;
      row.append(node('dt', '', label), node('dd', '', record[field])); list.append(row);
    });
  }
  beats.forEach((beat, beatIndex) => {
    if (!beat || typeof beat !== 'object') return;
    const id = plain(beat.id, 'S' + String(beatIndex + 1).padStart(2, '0'));
    let article = [...root.querySelectorAll('.shot')].find((shot) => shot.dataset.shot === id);
    if (!article) { article = node('article', 'shot'); root.append(article); }
    article.replaceChildren(); article.className = 'shot'; article.id = 'shot-' + id; article.dataset.shot = id;
    article.dataset.kind = plain(beat.kind, 'loop');
    if (beat.kind === 'player-branch' || id === 'P01') article.classList.add('is-branch');
    const heading = node('header', 'shot-heading');
    const titleBlock = node('div'); titleBlock.append(node('p', 'shot-emotion', beat.kind === 'player-branch' ? 'LATER PLAYER CHOICE · OUTSIDE THE LOOP' : 'ATTRACT LOOP'));
    titleBlock.append(node('h3', '', beat.title || beat.name || id));
    heading.append(node('span', 'shot-index', id), titleBlock, node('span', 'timecode', durationOf(beat))); article.append(heading);
    const panels = Array.isArray(beat.panels) ? beat.panels.slice(0, 16) : [];
    const strip = node('ol', 'contact-strip'); strip.setAttribute('aria-label', id + ' sequential panels');
    panels.forEach((panel, panelIndex) => {
      if (!panel || typeof panel !== 'object') return;
      const record = {
        id:plain(panel.id, id + '.' + (panelIndex + 1)), shotId:id, shotTitle:plain(beat.title || id),
        label:plain(panel.label || panel.title, 'Panel ' + (panelIndex + 1)), action:plain(panel.action || panel.description),
        time:plain(panel.time ?? panel.timecode, beat.kind === 'player-branch' ? 'Player choice' : ''),
        lens:[panel.lens, panel.angle, panel.camera].map((value) => plain(value)).filter(Boolean).join(' · ') || plain(beat.camera),
        direction:plain(panel.movement || panel.direction || panel.motion || panel.arrow),
        subject:plain(panel.subject || panel.focus),
        newInformation:plain(panel.newInformation),
        blockingMotion:beat.kind==='loop'?plain(panel.motionDescription):'',
        src:imageAsset(panel.frame || panel.image || panel.src), index:timeline.length,
        source:plain(panel.referenceNote || beat.referenceNote || data.panelReference, 'Storyboard composition study · proposed action')
      };
      timeline.push(record);
      const item = node('li', 'panel'); item.dataset.panel = record.id;
      const top = node('div', 'panel-heading'); top.append(node('strong', 'panel-id', record.id), node('span', 'panel-time', record.time));
      const imageButton = frameButton(record, 'panel-frame', false);
      const caption = node('div', 'panel-caption'); caption.append(node('h4', '', record.label), node('p', 'panel-action', record.action));
      if (record.newInformation) caption.append(node('p', 'panel-reveal', 'REVEAL · ' + record.newInformation));
      if (record.subject) caption.append(node('p', 'panel-subject', record.subject));
      if (record.lens) caption.append(node('p', 'panel-lens', record.lens));
      if (record.direction) caption.append(node('p', 'panel-direction', '↗ ' + record.direction));
      if (record.blockingMotion) caption.append(node('p','panel-blocking','MOTION · '+record.blockingMotion));
      if (panelIndex < panels.length - 1) { const arrow = node('span', 'flow-arrow', '→'); arrow.setAttribute('aria-hidden', 'true'); item.append(arrow); }
      item.append(top, imageButton, caption); strip.append(item);
    });
    article.append(strip);
    if (!panels.length) article.append(node('p', 'pending-copy', 'Sequential panels in preparation.'));
    const direction = node('details', 'shot-direction'); direction.append(node('summary', '', 'Shot direction, meaning & continuity'));
    const list = node('dl'); addFields(list, beat, primaryFields); addFields(list, beat, [['camera','Camera'], ['focus','Focus'], ['sound','Sound'], ['copy','On-screen copy']]); direction.append(list); article.append(direction);
    article.append(node('p', 'source-note', beat.referenceNote || 'Storyboard composition studies · proposed action, not implemented gameplay'));
  });
  const ribbon=document.getElementById('contrast-ribbon');
  if(ribbon) for(const [id,label] of [['S01A','NOTICE / extreme close'],['S02C','FOLLOW / courier-height'],['S03D','SOLVE / mechanism detail'],['S04C','REVEAL / spatial wide'],['S05B','INVITE / open hand']]) { const record=timeline.find(p=>p.id===id); if(!record)continue; const figure=node('figure','contrast-sample'); figure.append(frameButton(record,'contrast-frame',false),node('figcaption','',label));ribbon.append(figure); }
  const step = document.getElementById('step-frames'); step.disabled = !timeline.length;
  setText('panel-count', timeline.length ? beats.length + ' shot groups / ' + timeline.length + ' sequential panels' : 'Sequential panels in preparation');

  const angles = data.angles || {};
  const angleBindings = [];
  ['cinematic', 'management'].forEach((name) => {
    const button = document.querySelector('[data-angle="' + name + '"]');
    const description = angles[name] || {};
    const fallback = timeline.find((panel) => name === 'management' ? panel.shotId === 'P01' : panel.shotId !== 'P01');
    const src = imageAsset(description.frame) || fallback?.src;
    if (!src) return;
    const record = {id:name === 'management' ? 'P01 / CAMERA' : 'S01 / CAMERA', label:plain(description.title, name), action:plain(description.note), src, time:name === 'management' ? 'Untimed player branch' : 'Attract loop', lens:'', source:'Camera composition study'};
    button.disabled = false; addFrameImage(button, record, false); angleBindings.push({button,record});
    setText(name + '-title', description.title); setText(name + '-note', description.note);
  });

  const dialog = document.getElementById('lightbox');
  const stage = document.getElementById('lightbox-stage');
  const image = document.getElementById('lightbox-image');
  const video = document.getElementById('lightbox-video');
  const unavailable = document.getElementById('lightbox-unavailable');
  const previous = document.getElementById('previous-frame');
  const next = document.getElementById('next-frame');
  const actual = document.getElementById('actual-size');
  const close = document.getElementById('close-viewer');
  const viewerTimeline = document.getElementById('viewer-timeline');
  let current = 0, mode = 'frame', lastFocus = null, actualSize = false;
  const viewerButtons = timeline.map((record) => {
    const button = node('button', 'viewer-frame'); button.type = 'button'; button.dataset.panel = record.id;
    button.setAttribute('aria-label', record.id + ': ' + record.label);
    button.append(node('span', '', record.id)); button.addEventListener('click', () => openPanel(record.index)); viewerTimeline.append(button); return button;
  });
  function setActual(value) { actualSize = value; stage.classList.toggle('is-actual', value); actual.setAttribute('aria-pressed', String(value)); actual.textContent = value ? 'Fit' : '1:1'; stage.scrollTop = 0; stage.scrollLeft = 0; }
  function show() { lastFocus = document.activeElement; if (!dialog.open) dialog.showModal(); document.body.classList.add('viewer-open'); close.focus(); }
  image.addEventListener('load', () => { if (mode === 'frame') { image.hidden = false; unavailable.hidden = true; } });
  image.addEventListener('error', () => { if (mode === 'frame') { image.hidden = true; unavailable.hidden = false; } });
  function showFrame(record, position) {
    mode = 'frame'; video.pause(); video.hidden = true; image.hidden = !record.src; unavailable.hidden = !!record.src;
    setActual(false); if (record.src) image.src = record.src;
    image.alt = record.id + ': ' + record.label + '. ' + record.action;
    setText('lightbox-title', record.label); setText('lightbox-position', position);
    setText('lightbox-caption', [record.time, record.action, record.newInformation, record.blockingMotion, record.subject, record.lens, record.direction, record.source].filter(Boolean).join(' · '));
    actual.hidden = false; previous.hidden = !timeline.length; next.hidden = !timeline.length; viewerTimeline.hidden = false;
  }
  function openPanel(index) {
    if (!timeline.length) return;
    current = (index + timeline.length) % timeline.length;
    showFrame(timeline[current], timeline[current].id + ' · ' + (current + 1) + ' / ' + timeline.length);
    viewerButtons.forEach((button, i) => { button.setAttribute('aria-current', i === current ? 'true' : 'false'); });
    viewerButtons[current]?.scrollIntoView?.({block:'nearest', inline:'nearest'});
  }
  frameBindings.forEach(({button, record}) => button.addEventListener('click', () => { openPanel(record.index); show(); }));
  angleBindings.forEach(({button, record}) => button.addEventListener('click', () => { showFrame(record, 'SAME WORLD / CAMERA STUDY'); show(); }));
  step.addEventListener('click', () => { openPanel(0); show(); });
  previous.addEventListener('click', () => openPanel(current - 1)); next.addEventListener('click', () => openPanel(current + 1));
  actual.addEventListener('click', () => setActual(!actualSize));
  document.getElementById('full-screen').addEventListener('click', () => { if (!document.fullscreenElement) Promise.resolve(dialog.requestFullscreen?.()).catch(() => {}); else Promise.resolve(document.exitFullscreen?.()).catch(() => {}); });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { video.pause(); document.body.classList.remove('viewer-open'); if (document.fullscreenElement) Promise.resolve(document.exitFullscreen?.()).catch(() => {}); if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true}); });
  dialog.addEventListener('keydown', (event) => { if (mode !== 'frame' || event.altKey || event.ctrlKey || event.metaKey) return; if (event.key === 'ArrowRight') {event.preventDefault(); openPanel(current + 1);} if (event.key === 'ArrowLeft') {event.preventDefault(); openPanel(current - 1);} });
  const play = document.getElementById('play-loop');
  const videoSrc = videoAsset(data.approvedAnimatic || data.animatic?.src);
  const videoReady = (data.animaticReady === true || data.animatic?.ready === true) && !!videoSrc;
  const movingBlockout=data.motionBlockout?.ready===true&&videoSrc==='motion-blockout.mp4';
  play.disabled = !videoReady; play.textContent = videoReady ? (movingBlockout?'▶ Play moving blockout':'▶ Play storyboard animatic') : 'Animatic in preparation';
  play.addEventListener('click', () => {
    if (!videoReady) return;
    mode = 'video'; image.hidden = true; unavailable.hidden = true; video.hidden = false;
    previous.hidden = true; next.hidden = true; actual.hidden = true; viewerTimeline.hidden = true; setActual(false);
    setText('lightbox-title', movingBlockout?'Moving line-art blockout':'Storyboard flow animatic'); setText('lightbox-position', 'PROPOSED SHOT SEQUENCE');
    setText('lightbox-caption', movingBlockout?'Dolly, crane and subject motion through the approved 24-second edit. Illustrative blockout; no live work.':'Storyboard timing and composition study. This playback starts no work.');
    if (video.getAttribute('src') !== videoSrc) video.src = videoSrc;
    show(); video.play().catch(() => {});
  });
  document.getElementById('play-mechanical')?.addEventListener('click', () => {
    mode='video';image.hidden=true;unavailable.hidden=true;video.hidden=false;
    previous.hidden=true;next.hidden=true;actual.hidden=true;viewerTimeline.hidden=true;setActual(false);
    setText('lightbox-title','Mechanical presence, then a person');setText('lightbox-position','M01–M04 · 12 SECOND MOTION STUDY');
    setText('lightbox-caption','Thruster ignition → brief surge → precise hover → warm profile reveal. Original sound and staging; DEMO, no live work.');
    video.src=videoAsset('mechanical-opening.mp4');show();video.play().catch(()=>{});
  });
})();
