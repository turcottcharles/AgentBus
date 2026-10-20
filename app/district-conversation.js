(function () {
  'use strict';
  let mountNumber = 0;
  const MAX_PENDING_VOICE_EVENTS = 32;

  function mount({ container, onCommit, voice, onDraftChange }) {
    if (!container || typeof onCommit !== 'function') throw new TypeError('DistrictConversation requires a container and onCommit.');
    const doc = container.ownerDocument;
    const instance = `district-conversation-${++mountNumber}`;
    const cleanups = [];
    let destroyed = false, disabled = false, pending = false, committing = false, available = false;
    let capture = null, unsubscribe = null;
    let suggestedPrompt = '';
    const make = (tag, className, text, attrs = {}) => {
      const node = doc.createElement(tag);
      node.className = className;
      if (text !== undefined) node.textContent = text;
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
      return node;
    };
    const on = (node, type, fn) => { node.addEventListener(type, fn); cleanups.push(() => node.removeEventListener(type, fn)); };
    const root = make('section', 'dc-conversation', undefined, { 'aria-label': 'Tell your crew what to make' });
    const form = make('form', 'dc-form');
    const label = make('label', 'dc-label');
    label.append(make('span', 'dc-label-text dc-sr-only', 'What would you like to make?'));
    const draft = make('textarea', 'dc-draft', undefined, {
      rows: '1', maxlength: '12000', placeholder: 'Tell us what you want to make…',
      'aria-label': 'Tell us what you want to make', autocomplete: 'off', spellcheck: 'true',
      'aria-describedby': `${instance}-hint ${instance}-voice`,
    });
    label.append(draft);
    const controls = make('div', 'dc-controls');
    const hint = make('span', 'dc-hint', undefined, { id: `${instance}-hint` });
    const inputHint = make('span', '', 'Type your idea. ');
    const voiceHint = make('span', '', voice ? ' Checking speech support.' : ' Speech unavailable.');
    hint.append(inputHint, make('kbd', '', 'Enter'), make('span', '', ' to send · Shift+Enter for a new line.'), voiceHint);
    const speechControls = make('div', 'dc-speech-controls');
    const light = make('span', 'dc-listening-light', '', { 'aria-hidden': 'true' });
    const speak = make('button', 'dc-speak', 'Speak', { type: 'button', 'aria-label': 'Speak', 'aria-pressed': 'false', 'aria-describedby': `${instance}-voice` });
    const cancel = make('button', 'dc-cancel', 'Cancel', { type: 'button', 'aria-label': 'Cancel speech' });
    cancel.hidden = true;
    speechControls.append(light, speak, cancel);
    controls.append(hint, speechControls);
    const status = make('p', 'dc-status', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', tabindex: '0', 'aria-label': 'Request status' });
    status.hidden = true;
    const voiceNote = make('p', 'dc-voice-note dc-sr-only', voice ? 'Checking speech input…' : 'Speech is unavailable here. You can type your idea.', { id: `${instance}-voice` });
    form.append(label, controls);
    root.append(form, status, voiceNote);
    container.append(root);

    function setStatus(message) {
      if (!destroyed) { status.textContent = String(message || '').slice(0, 4000); status.hidden = !status.textContent; }
    }
    function sizeDraft(focused = doc.activeElement === draft) {
      if (!draft.style) return;
      draft.style.height = '48px';
      const needed = draft.scrollHeight || 48;
      const expanded = focused || Boolean(draft.value && (draft.value.includes('\n') || needed > 52));
      draft.style.height = `${expanded ? Math.min(110, Math.max(focused ? 64 : 48, needed)) : 48}px`;
    }
    function update() {
      if (destroyed) return;
      const recording = Boolean(capture);
      // A request may take a while. Drafting the next thought is independent
      // of dispatch, and must not disable the input or interrupt the world.
      draft.disabled = disabled;
      speak.disabled = disabled || pending || committing || !available;
      speak.textContent = recording ? 'Stop speaking' : 'Speak';
      speak.setAttribute('aria-label', recording ? 'Stop speaking' : 'Speak');
      speak.setAttribute('aria-pressed', String(recording));
      speak.title = voiceNote.textContent;
      cancel.hidden = !capture;
      cancel.disabled = disabled;
      root.dataset.listening = String(recording);
      root.dataset.busy = String(committing || pending);
      light.hidden = !recording;
    }
    function stopQuietly() {
      try { Promise.resolve(voice?.stop?.()).catch(() => {}); } catch (_) { /* Capture cleanup cannot break the typed path. */ }
    }
    function cancelCapture(restore = false) {
      const prior = capture;
      if (!prior) return;
      prior.cancelled = true;
      prior.events.length = 0;
      capture = null;
      if (restore) draft.value = prior.before;
      sizeDraft();
      stopQuietly();
      update();
    }
    function commit(source) {
      if (destroyed || disabled) return;
      if (committing || pending) { setStatus('Your previous request is still being sent. You can keep drafting.'); return; }
      const value = draft.value.trim();
      if (!value) { setStatus('Tell us a little about what you want to make.'); return; }
      if (source === 'text') cancelCapture();
      committing = true;
      setStatus('Sending your idea…');
      update();
      Promise.resolve().then(() => { if (!destroyed) return onCommit({ text: value, source }); }).then((receipt) => {
        if (destroyed) return;
        if (receipt?.status === 'rejected') {
          const reason = typeof receipt.error === 'string' ? receipt.error : receipt.error?.message;
          setStatus(reason || 'Your idea could not be sent. Your words are still here.');
        } else if (status.textContent === 'Sending your idea…' || status.textContent === 'Your previous request is still being sent. You can keep drafting.') {
          setStatus('Your idea was sent. Your draft stays here.');
        }
      }, (error) => {
        if (!destroyed) setStatus(error?.message || 'Your idea could not be sent. Your words are still here.');
      }).finally(() => { committing = false; update(); });
    }
    function transcript(text) {
      if (!capture || typeof text !== 'string') return;
      const words = text.trim();
      if (!words) return;
      const prefix = capture.prefix && !/\s$/.test(capture.prefix) ? `${capture.prefix} ` : capture.prefix;
      const suffix = capture.suffix && !/^\s/.test(capture.suffix) ? ` ${capture.suffix}` : capture.suffix;
      draft.value = `${prefix}${words}${suffix}`.slice(0, 12000);
      sizeDraft();
    }
    function receive(event) {
      if (destroyed || !capture || !event || disabled) return;
      if (typeof event.captureId !== 'string' || !event.captureId || event.captureId.length > 256) return;
      if (!['listening', 'partial', 'final', 'error', 'stopped'].includes(event.type)) return;
      if (!capture.nativeId) {
        if (capture.events.length === MAX_PENDING_VOICE_EVENTS) capture.events.shift();
        capture.events.push({ type: event.type, captureId: event.captureId,
          ...(typeof event.text === 'string' ? { text: event.text.slice(0, 12000) } : {}),
          ...(typeof event.message === 'string' ? { message: event.message.slice(0, 2000) } : {}),
        });
        return;
      }
      if (event.captureId !== capture.nativeId) return;
      if (event.type === 'listening') { setStatus('Listening… Say what you want to make.'); update(); }
      else if (event.type === 'partial') { transcript(event.text); setStatus('Listening… Your words are a draft.'); }
      else if (event.type === 'final') {
        if (typeof event.text !== 'string' || !event.text.trim()) {
          capture.events.length = 0; capture = null; setStatus('No words were heard. Try Speak again, or type your idea.'); update(); return;
        }
        transcript(event.text);
        capture.events.length = 0;
        capture = null;
        update();
        commit('voice');
      } else if (event.type === 'error') {
        capture.events.length = 0; capture = null; setStatus(event.message || 'Speech could not finish. You can keep typing.'); update();
      } else if (event.type === 'stopped') {
        capture.events.length = 0; capture = null; setStatus('Speech stopped without a finished phrase. You can keep typing or try Speak again.'); update();
      }
    }
    async function startSpeech() {
      if (destroyed || disabled || pending || committing || !available) return;
      onDraftChange?.();
      if (capture) {
        cancelCapture(); setStatus('Speech stopped. Review your draft, then press Enter.');
        return;
      }
      const start = Number.isFinite(draft.selectionStart) ? draft.selectionStart : draft.value.length;
      const end = Number.isFinite(draft.selectionEnd) ? draft.selectionEnd : start;
      const current = { nativeId: null, events: [], before: draft.value, prefix: draft.value.slice(0, start), suffix: draft.value.slice(end), cancelled: false };
      capture = current;
      setStatus('Starting speech input…'); update();
      try {
        const result = await voice.start();
        if (capture === current) {
          if (typeof result?.captureId !== 'string' || !result.captureId || result.captureId.length > 256) {
            cancelCapture(); setStatus('Speech could not identify this capture. You can type your idea.'); return;
          }
          current.nativeId = result.captureId;
          const queued = current.events.splice(0);
          for (const event of queued) receive(event);
        }
        if ((destroyed || current.cancelled) && !capture) stopQuietly();
      } catch (error) {
        current.events.length = 0;
        if (capture === current) { capture = null; setStatus(error?.message || 'Speech could not start. You can type your idea.'); update(); }
      }
    }
    on(form, 'submit', (event) => event.preventDefault());
    on(draft, 'keydown', (event) => {
      if (event.key === 'ArrowUp' && !draft.value && suggestedPrompt && !disabled && !capture && !event.isComposing) {
        event.preventDefault(); draft.value = suggestedPrompt; sizeDraft(); onDraftChange?.(); return;
      }
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (!event.repeat) commit('text');
    });
    on(root, 'keydown', (event) => {
      if (event.key !== 'Escape' || !capture) return;
      event.preventDefault();
      cancelCapture(true); setStatus('Speech cancelled. Your earlier draft is kept.');
      draft.focus?.();
    });
    on(draft, 'input', () => {
      if (capture) { cancelCapture(); setStatus('Speech stopped. Your typed draft is kept.'); }
      sizeDraft();
      onDraftChange?.();
    });
    on(draft, 'focus', () => sizeDraft(true));
    on(draft, 'blur', () => sizeDraft(false));
    on(speak, 'click', () => { void startSpeech(); });
    on(cancel, 'click', () => { cancelCapture(true); setStatus('Speech cancelled. Your earlier draft is kept.'); });
    update();
    if (voice && typeof voice.status === 'function' && typeof voice.start === 'function' && typeof voice.stop === 'function' && typeof voice.onEvent === 'function') {
      try { unsubscribe = voice.onEvent(receive); } catch (error) { voiceNote.textContent = error?.message || 'Speech is unavailable here. You can type your idea.'; }
      if (unsubscribe) Promise.resolve().then(() => voice.status()).then((result) => {
        if (destroyed) return;
        available = Boolean(result?.available);
        voiceNote.textContent = available ? 'Speech starts only when you choose Speak. A completed phrase is sent once. Stop speaking keeps the words as a draft; Escape cancels speech.' : `${result?.reason || 'Speech is unavailable here.'} You can type your idea.`;
        inputHint.textContent = available ? 'Type or speak. ' : 'Type your idea. ';
        voiceHint.textContent = available ? '' : ' Speech unavailable.';
        update();
      }, (error) => {
        if (!destroyed) { voiceNote.textContent = `${error?.message || 'Speech is unavailable here.'} You can type your idea.`; voiceHint.textContent = ' Speech unavailable.'; update(); }
      });
      else voiceHint.textContent = ' Speech unavailable.';
    } else if (voice) { voiceNote.textContent = 'Speech is unavailable here. You can type your idea.'; voiceHint.textContent = ' Speech unavailable.'; }
    return Object.freeze({
      setDisabled(value) { disabled = Boolean(value); if (disabled) cancelCapture(); update(); },
      setPending(value) { pending = Boolean(value); if (pending) cancelCapture(); update(); },
      setStatus,
      setSuggestion(value) { suggestedPrompt = typeof value === 'string' ? value.slice(0, 12000) : ''; },
      setDraft(value) { if (!destroyed) { cancelCapture(); draft.value = String(value || '').slice(0, 12000); sizeDraft(); draft.focus?.(); onDraftChange?.(); } },
      getDraft() { return draft.value; },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (capture) { capture.events.length = 0; capture = null; stopQuietly(); }
        try { if (typeof unsubscribe === 'function') unsubscribe(); } catch (_) { /* Continue removing owned UI. */ }
        for (const remove of cleanups) { try { remove(); } catch (_) { /* One stale listener cannot keep the panel alive. */ } }
        root.remove();
      },
    });
  }
  window.DistrictConversation = Object.freeze({ mount });
})();
