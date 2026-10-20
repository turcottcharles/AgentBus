'use strict';
(() => {
  function mount({ container, demo = true } = {}) {
    if (!container || typeof container.append !== 'function') throw new Error('Neon Rally needs a container.');
    const document = container.ownerDocument;
    const shell = document.createElement('section');
    shell.className = 'district-attract-demo';
    shell.dataset.theme = 'electric';
    shell.dataset.state = 'ready';
    shell.setAttribute('aria-label', demo ? 'Neon Rally playable scoreboard demo' : 'Neon Rally scoreboard');
    if (!demo) shell.setAttribute('role', 'main');
    const make = (tag, className, text, parent) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      if (parent) parent.append(node);
      return node;
    };
    const top = make('header', 'nr-top', undefined, shell);
    make('span', 'nr-edition', 'TINY PARTY CONSOLE', top);
    if (demo) make('span', 'nr-demo-label', 'DEMO · PLAYABLE', top);
    const title = make('div', 'nr-title', undefined, shell);
    make('span', 'nr-title-neon', 'NEON', title);
    make(demo ? 'h2' : 'h1', 'nr-title-rally', 'RALLY', title);
    make('span', 'nr-title-star', '✦', title).setAttribute('aria-hidden', 'true');
    const board = make('div', 'nr-board', undefined, shell);
    const scoreNodes = [];
    const addButtons = [];
    const teams = [ { id: 'comets', name: 'COMETS', symbol: '✳', number: '01' }, { id: 'bolts', name: 'BOLTS', symbol: 'ϟ', number: '02' } ];
    for (const team of teams) {
      const panel = make('section', `nr-team nr-team-${team.id}`, undefined, board);
      panel.setAttribute('aria-label', team.name + ' team');
      const heading = make('div', 'nr-team-heading', undefined, panel);
      make('span', 'nr-team-symbol', team.symbol, heading).setAttribute('aria-hidden', 'true');
      make('h3', 'nr-team-name', team.name, heading);
      make('span', 'nr-player-number', team.number, heading);
      const score = make('output', 'nr-score', '00', panel);
      score.dataset.testid = `neon-score-${team.id}`;
      score.setAttribute('aria-label', team.name + ' score');
      scoreNodes.push(score);
      const button = make('button', 'nr-score-button', undefined, panel);
      button.type = 'button';
      button.dataset.testid = `neon-add-${team.id}`;
      button.setAttribute('aria-label', 'Add one point to ' + team.name);
      make('span', 'nr-button-plus', '+', button).setAttribute('aria-hidden', 'true');
      make('span', '', 'SCORE', button);
      addButtons.push(button);
    }
    const versus = make('span', 'nr-versus', 'VS', board);
    versus.setAttribute('aria-hidden', 'true');
    const bottom = make('div', 'nr-bottom', undefined, shell);
    const status = make('p', 'nr-status', 'TIE GAME · YOUR MOVE', bottom);
    status.dataset.testid = 'neon-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const controls = make('div', 'nr-controls', undefined, bottom);
    const themeLabel = make('label', 'nr-theme-label', 'COLORWAY', controls);
    const theme = make('select', 'nr-theme', undefined, themeLabel);
    theme.dataset.testid = 'neon-theme';
    theme.setAttribute('aria-label', 'Color theme');
    for (const [value, label] of [['electric', 'ELECTRIC'], ['sunset', 'SUNSET'], ['lagoon', 'LAGOON']]) {
      const option = make('option', '', label, theme);
      option.value = value;
    }
    theme.value = 'electric';
    const resetButton = make('button', 'nr-reset', '↺ RESET', controls);
    resetButton.type = 'button';
    resetButton.dataset.testid = 'neon-reset';
    make('div', 'nr-console-grip', undefined, shell).setAttribute('aria-hidden', 'true');
    container.append(shell);

    let scores = [0, 0];
    let destroyed = false;
    let playing = false;
    let hasPlayed = false;
    let automated = false;
    const timers = new Set();
    const listeners = [];
    const listen = (node, type, handler) => { node.addEventListener(type, handler); listeners.push([node, type, handler]); };
    function pause() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      playing = false;
      if (!destroyed) shell.dataset.state = 'paused';
    }
    function render() {
      scores.forEach((score, index) => { scoreNodes[index].textContent = String(score).padStart(2, '0'); });
      const difference = Math.abs(scores[0] - scores[1]);
      status.textContent = difference === 0 ? 'TIE GAME · YOUR MOVE' : `${scores[0] > scores[1] ? 'COMETS' : 'BOLTS'} LEAD BY ${difference}`;
      shell.dataset.leader = difference === 0 ? 'tie' : scores[0] > scores[1] ? 'comets' : 'bolts';
    }
    function manualInteraction() {
      if (!automated && !destroyed) { pause(); shell.dataset.state = 'manual'; }
    }
    addButtons.forEach((button, index) => listen(button, 'click', () => {
      if (destroyed) return;
      manualInteraction();
      scores[index] = Math.min(99, scores[index] + 1);
      render();
    }));
    listen(theme, 'change', () => {
      if (destroyed) return;
      manualInteraction();
      if (['electric', 'sunset', 'lagoon'].includes(theme.value)) shell.dataset.theme = theme.value;
    });
    function reset() {
      if (destroyed) return;
      pause();
      hasPlayed = false;
      scores = [0, 0];
      theme.value = 'electric';
      shell.dataset.theme = 'electric';
      shell.dataset.state = 'ready';
      render();
    }
    listen(resetButton, 'click', reset);
    // A human touch immediately takes over. Only our short, synchronous event
    // dispatch is exempt; play() never sends a product command or provider call.
    listen(shell, 'pointerdown', manualInteraction);
    listen(shell, 'keydown', manualInteraction);
    function dispatch(action) {
      automated = true;
      try { action(); } finally { automated = false; }
    }
    function schedule(delay, action) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!playing || destroyed) return;
        dispatch(action);
      }, delay);
      timers.add(timer);
    }
    function play() {
      if (destroyed || playing || hasPlayed) return;
      dispatch(() => resetButton.click());
      hasPlayed = true;
      playing = true;
      shell.dataset.state = 'playing';
      const point = (team) => () => addButtons[team].click();
      [[550, 0], [1150, 1], [1750, 0], [2350, 0], [3350, 1], [3950, 1], [4550, 0], [5650, 0], [6250, 1], [6950, 0]].forEach(([delay, team]) => schedule(delay, point(team)));
      schedule(2850, () => { theme.value = 'sunset'; theme.dispatchEvent(new Event('change', { bubbles: true })); });
      schedule(5100, () => { theme.value = 'lagoon'; theme.dispatchEvent(new Event('change', { bubbles: true })); });
      schedule(7900, () => { playing = false; shell.dataset.state = 'complete'; });
    }
    function destroy() {
      if (destroyed) return;
      pause();
      destroyed = true;
      for (const [node, type, handler] of listeners) node.removeEventListener(type, handler);
      listeners.length = 0;
      shell.remove();
    }
    render();
    return Object.freeze({ play, pause, reset, destroy });
  }
  window.DistrictAttractDemo = Object.freeze({ mount });
  // The owned starter copies this exact component. Standalone pages mount the
  // same working app, without the showcase label or any automatic score changes.
  if (typeof document !== 'undefined') {
    const mountStandalone = () => {
      const container = document.querySelector('[data-neon-rally-app]');
      if (container && !container.querySelector('.district-attract-demo')) mount({ container, demo: false });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountStandalone, { once: true });
    else mountStandalone();
  }
})();
