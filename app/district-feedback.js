'use strict';
(() => {
  let instanceCount = 0;
  const MAX_INSTRUCTION = 8000;
  const own = (node, tag, className, text) => {
    const child = document.createElement(tag);
    if (className) child.className = className;
    if (text !== undefined) child.textContent = text;
    node.appendChild(child);
    return child;
  };
  const boundedIdentity = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);

  function bindingOf(preview) {
    if (!preview || typeof preview !== 'object') return null;
    for (const key of ['id','projectId', 'runId', 'candidateHash', 'nonce']) {
      if (!boundedIdentity(preview[key])) return null;
    }
    if (typeof preview.url !== 'string' || preview.url.length > 4096) return null;
    let url;
    try { url = new URL(preview.url); } catch { return null; }
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password) return null;
    const value = {
      url: url.href, origin: url.origin, projectId: preview.projectId,
      runId: preview.runId, candidateHash: preview.candidateHash, nonce: preview.nonce, previewId:preview.id||'',
    };
    value.key = JSON.stringify([value.url, value.projectId, value.runId, value.candidateHash, value.nonce,value.previewId]);
    return value;
  }

  function selectionOf(data, binding) {
    if (!data || typeof data !== 'object' || data.type !== 'district:selection') return null;
    for (const key of ['nonce', 'projectId', 'runId', 'candidateHash']) {
      if (data[key] !== binding[key]) return null;
    }
    if (typeof data.selector !== 'string' || !data.selector || data.selector.length > 512) return null;
    if (typeof data.tag !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(data.tag)) return null;
    if (typeof data.text !== 'string' || data.text.length > 500) return null;
    const rect = data.rect;
    if (!rect || typeof rect !== 'object') return null;
    for (const key of ['x', 'y', 'width', 'height']) {
      if (typeof rect[key] !== 'number' || !Number.isFinite(rect[key]) || Math.abs(rect[key]) > 100000) return null;
    }
    if (rect.width < 0 || rect.height < 0) return null;
    return {
      projectId: binding.projectId, runId: binding.runId, candidateHash: binding.candidateHash,
      selector: data.selector, tag: data.tag, text: data.text,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  }

  class DistrictFeedback {
    constructor({ container, onRequestChange } = {}) {
      if (!container || typeof container.appendChild !== 'function') throw new TypeError('DistrictFeedback needs a container.');
      if (typeof onRequestChange !== 'function') throw new TypeError('DistrictFeedback needs an onRequestChange callback.');
      this.onRequestChange = onRequestChange;
      this.binding = null;
      this.selection = null;
      this.stale = false;
      this.instructionDisabled = false;
      this.inspectEnabled = false;
      this.frameReady = false;
      this.frameFailed = false;
      this.pending = false;
      this.destroyed = false;
      this.invalidPreview = false;
      this.verificationId='';this.verificationTimer=null;this.verificationSequence=0;
      const id = `district-feedback-${++instanceCount}`;

      this.root = own(container, 'section', 'dv-feedback');
      this.root.setAttribute('aria-label', 'Actual project preview and change request');
      const header = own(this.root, 'div', 'dv-feedback-header');
      const heading = own(header, 'div', 'dv-feedback-heading');
      own(heading, 'span', 'dv-feedback-eyebrow', 'PROJECT OUTPUT');
      own(heading, 'h3', '', 'See it. Try it. Change it.');
      this.freshness = own(header, 'span', 'dv-feedback-freshness', 'No preview');
      this.freshness.setAttribute('role', 'status');
      this.freshness.setAttribute('aria-live', 'polite');

      this.empty = own(this.root, 'div', 'dv-feedback-empty');
      own(this.empty, 'strong', '', 'Your actual project output appears here.');
      own(this.empty, 'p', '', 'Run the project checks, then start its preview. This panel opens the built files from that candidate.');
      this.frameHost = own(this.root, 'div', 'dv-feedback-frame-host');
      this.frameHost.hidden = true;
      this.iframe = own(this.frameHost, 'iframe', 'dv-feedback-frame');
      this.iframe.title = 'Actual built project output';
      // Local handlers need form events; the preview server's CSP forbids form navigation.
      this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
      this.iframe.setAttribute('referrerpolicy', 'no-referrer');
      this.iframe.setAttribute('loading', 'eager');

      const toolbar = own(this.root, 'div', 'dv-feedback-toolbar');
      this.inspect = own(toolbar, 'button', 'dv-feedback-inspect', 'Select a part to change');
      this.inspect.type = 'button';
      this.inspect.setAttribute('aria-pressed', 'false');
      this.inspect.setAttribute('aria-describedby', `${id}-help`);
      this.reload = own(toolbar, 'button', 'dv-feedback-reload', 'Reload preview');
      this.reload.type = 'button';
      this.help = own(this.root, 'p', 'dv-feedback-help', 'Use the preview normally, or select a part to describe a change. You can always describe a change in words below.');
      this.help.id = `${id}-help`;

      this.provenance = own(this.root, 'details', 'dv-feedback-provenance');
      own(this.provenance, 'summary', '', 'Which output is this?');
      const identity = own(this.provenance, 'dl');
      this.identityValues = {};
      for (const [key, label] of [['projectId', 'Project'], ['runId', 'Build run'], ['candidateHash', 'Candidate hash']]) {
        own(identity, 'dt', '', label);
        this.identityValues[key] = own(identity, 'dd', '', 'Not available');
      }
      own(this.provenance, 'p', '', 'A loaded preview is output to inspect. Check results and review approval are recorded separately.');

      this.selected = own(this.root, 'div', 'dv-feedback-selection');
      this.selected.setAttribute('role', 'status');
      this.selected.setAttribute('aria-live', 'polite');
      this.selected.setAttribute('aria-atomic', 'true');
      this.selectedTitle = own(this.selected, 'strong', '', 'Change the whole output');
      this.selectedSelector = own(this.selected, 'code');
      this.selectedSelector.hidden = true;
      this.selectedText = own(this.selected, 'p', '', 'No part selected. A written change request works without selecting anything.');
      this.clearSelection = own(this.root, 'button', 'dv-feedback-clear', 'Clear selected part');
      this.clearSelection.type = 'button';
      this.clearSelection.hidden = true;

      this.form = own(this.root, 'form', 'dv-feedback-form');
      const label = own(this.form, 'label', '', 'What should change?');
      label.htmlFor = `${id}-instruction`;
      this.input = own(this.form, 'textarea', 'dv-feedback-instruction');
      this.input.id = `${id}-instruction`;
      this.input.rows = 3;
      this.input.maxLength = MAX_INSTRUCTION;
      this.input.placeholder = 'Describe the change and how you will know it works.';
      this.input.setAttribute('aria-describedby', `${id}-request-help ${id}-reason`);
      const requestHelp = own(this.form, 'p', 'dv-feedback-help', 'For example: Make the Add button easier to find. It should still add the item I type.');
      requestHelp.id = `${id}-request-help`;
      this.reason = own(this.form, 'p', 'dv-feedback-reason');
      this.reason.id = `${id}-reason`;
      this.submit = own(this.form, 'button', 'dv-feedback-submit', 'Request this change');
      this.submit.type = 'submit';
      this.requestStatus = own(this.form, 'p', 'dv-feedback-request-status');
      this.requestStatus.setAttribute('role', 'status');
      this.requestStatus.setAttribute('aria-live', 'polite');

      this.onMessage = (event) => this.receive(event);
      this.onLoad = () => {
        if (!this.binding || this.destroyed) return;
        clearTimeout(this.verificationTimer);
        this.frameReady = false;this.inspectEnabled=false;this.selection=null;this.renderSelection();
        this.frameFailed = false;
        this.syncControls();
        this.verificationId=`load-${Date.now()}-${++this.verificationSequence}`;
        this.iframe.contentWindow?.postMessage({type:'district:verify',nonce:this.binding.nonce,requestId:this.verificationId},this.binding.origin);
        this.verificationTimer=setTimeout(()=>{if(!this.destroyed&&!this.frameReady){this.verificationId='';this.frameFailed=true;this.requestStatus.textContent='The built candidate could not be verified. Reload the preview before requesting a change.';this.syncControls();}},5000);
      };
      this.onFrameError = () => {
        if (!this.binding || this.destroyed) return;
        clearTimeout(this.verificationTimer);this.verificationId='';
        this.frameReady = false;
        this.frameFailed = true;
        this.inspectEnabled = false;
        this.requestStatus.textContent = 'The preview could not load. Reload it, or start a new preview from the project.';
        this.syncControls();
      };
      this.onInspect = () => {
        if (!this.binding || !this.frameReady || this.stale) return;
        this.inspectEnabled = !this.inspectEnabled;
        this.syncControls();
        this.sendInspect();
      };
      this.onReload = () => {
        if (!this.binding || this.pending) return;
        clearTimeout(this.verificationTimer);this.verificationId='';
        this.frameReady = false;
        this.frameFailed = false;
        this.inspectEnabled = false;
        this.selection = null;
        this.renderSelection();
        this.syncControls();
        this.iframe.src = this.binding.url;
      };
      this.onClear = () => { this.selection = null; this.renderSelection(); };
      this.onInput = () => { this.requestStatus.textContent = ''; this.syncControls(); };
      this.onSubmit = (event) => { event.preventDefault(); void this.requestChange(); };
      window.addEventListener('message', this.onMessage);
      this.iframe.addEventListener('load', this.onLoad);
      this.iframe.addEventListener('error', this.onFrameError);
      this.inspect.addEventListener('click', this.onInspect);
      this.reload.addEventListener('click', this.onReload);
      this.clearSelection.addEventListener('click', this.onClear);
      this.input.addEventListener('input', this.onInput);
      this.form.addEventListener('submit', this.onSubmit);
      this.syncControls();
    }

    update({ preview = null, stale = false, instructionDisabled = false } = {}) {
      if (this.destroyed) return;
      const next = bindingOf(preview);
      this.invalidPreview = Boolean(preview) && !next;
      const changed = (next?.key || null) !== (this.binding?.key || null);
      if (changed) {
        clearTimeout(this.verificationTimer);this.verificationId='';
        this.inspectEnabled = false;
        this.sendInspect();
        this.binding = next;
        this.selection = null;
        this.frameReady = false;
        this.frameFailed = false;
        this.requestStatus.textContent = '';
        this.renderSelection();
        if (next) this.iframe.src = next.url;
        else this.iframe.removeAttribute('src');
      }
      this.stale = Boolean(stale);
      this.instructionDisabled = Boolean(instructionDisabled);
      if (this.stale && this.inspectEnabled) {
        this.inspectEnabled = false;
        this.sendInspect();
      }
      this.empty.hidden = Boolean(next);
      this.frameHost.hidden = !next;
      this.provenance.hidden = !next;
      for (const [key, node] of Object.entries(this.identityValues)) node.textContent = next?.[key] || 'Not available';
      this.syncControls();
    }

    sendInspect() {
      if (!this.binding || this.destroyed || !this.iframe.contentWindow) return;
      try {
        this.iframe.contentWindow.postMessage({
          type: 'district:inspect', enabled: this.inspectEnabled, nonce: this.binding.nonce,
        }, this.binding.origin);
      } catch { /* A navigating/closed frame cannot authorize any action. */ }
    }

    receive(event) {
      if(!this.destroyed&&this.binding&&event.source===this.iframe.contentWindow&&event.origin===this.binding.origin&&event.data?.type==='district:identity'){
        const data=event.data,b=this.binding;
        if(this.verificationId&&data.requestId===this.verificationId&&data.nonce===b.nonce&&data.previewId===b.previewId&&data.projectId===b.projectId&&data.runId===b.runId&&data.candidateHash===b.candidateHash){clearTimeout(this.verificationTimer);this.frameReady=true;this.frameFailed=false;this.requestStatus.textContent='';this.syncControls();this.sendInspect();}
        return;
      }
      if (this.destroyed || !this.binding || !this.frameReady || !this.inspectEnabled || this.stale) return;
      if (event.source !== this.iframe.contentWindow || event.origin !== this.binding.origin) return;
      const selection = selectionOf(event.data, this.binding);
      if (!selection) return;
      this.selection = selection;
      this.inspectEnabled = false;
      this.sendInspect();
      this.renderSelection();
      this.requestStatus.textContent = 'Part selected. Describe the change, then request it when you are ready.';
      this.syncControls();
    }

    renderSelection() {
      const selected = this.selection;
      this.selectedTitle.textContent = selected ? `Selected part: ${selected.tag}` : 'Change the whole output';
      this.selectedSelector.hidden = !selected;
      this.selectedSelector.textContent = selected?.selector || '';
      this.selectedText.textContent = selected ? (selected.text.trim() || 'This part has no visible text.') : 'No part selected. A written change request works without selecting anything.';
      this.clearSelection.hidden = !selected;
    }

    syncControls() {
      const hasPreview = Boolean(this.binding);
      this.freshness.textContent = this.invalidPreview ? 'Preview unavailable' : !hasPreview ? 'No preview' : this.stale ? 'Older candidate · refresh required' : this.frameFailed ? 'Preview load failed' : !this.frameReady ? 'Opening actual output…' : 'Candidate output';
      this.freshness.dataset.state = this.stale || this.invalidPreview ? 'warning' : hasPreview ? 'ready' : 'empty';
      this.inspect.disabled = !hasPreview || !this.frameReady || this.stale;
      this.inspect.textContent = this.inspectEnabled ? 'Stop selecting' : 'Select a part to change';
      this.inspect.setAttribute('aria-pressed', String(this.inspectEnabled));
      this.reload.disabled = !hasPreview || this.pending;
      this.help.textContent = this.inspectEnabled ? 'Choose a part in the actual output. Its description will appear below. Selection alone does not start work.' : 'Use the preview normally, or select a part to describe a change. You can always describe a change in words below.';
      const instruction = this.input.value.trim();
      let reason = '';
      if (this.invalidPreview) reason = 'The preview binding is invalid. Start a new preview from a completed project build.';
      else if (!hasPreview) reason = 'Start an actual candidate preview before requesting a change here.';
      else if (this.stale) reason = 'This output is older than the current project. Check and open the current candidate before requesting a change.';
      else if (!this.frameReady) reason = this.frameFailed ? 'Reload the preview, or start a new preview from the project.' : 'Wait for the actual candidate preview to open.';
      else if (this.instructionDisabled) reason = 'Change requests are unavailable right now. Choose an available worker and check the current run status.';
      else if (this.pending) reason = 'Handing this request to the district…';
      else if (!instruction) reason = 'Describe what should change before sending the request.';
      else if (instruction.length > MAX_INSTRUCTION) reason = 'Keep the request within 8,000 characters.';
      this.reason.textContent = reason;
      this.submit.disabled = Boolean(reason);
      this.submit.textContent = this.pending ? 'Sending request…' : 'Request this change';
    }

    async requestChange() {
      if (this.destroyed) return;
      this.syncControls();
      if (this.submit.disabled || !this.binding) return;
      const bindingKey = this.binding.key;
      const instruction = this.input.value.trim();
      const selection = this.selection ? {
        ...this.selection, rect: { ...this.selection.rect },
      } : null;
      this.pending = true;
      this.requestStatus.textContent = '';
      this.syncControls();
      try {
        const result = await this.onRequestChange({ instruction, selection });
        if (this.destroyed) return;
        if (result?.status === 'rejected') throw new Error(typeof result.error === 'string' ? result.error : 'The district rejected this change request.');
        if (bindingKey === this.binding?.key) {
          this.requestStatus.textContent = result?.runId ? `Request accepted as run ${String(result.runId).slice(0, 256)}. Follow its checks and updated preview in the district.` : 'Request handed to the district. Follow the run status for its outcome.';
        }
      } catch (error) {
        if (!this.destroyed && bindingKey === this.binding?.key) this.requestStatus.textContent = `Request was not accepted: ${String(error?.message || error || 'Unknown error').slice(0, 1000)} Your instruction is kept.`;
      } finally {
        if (!this.destroyed) { this.pending = false; this.syncControls(); }
      }
    }

    destroy() {
      if (this.destroyed) return;
      this.inspectEnabled = false;
      this.sendInspect();
      this.destroyed = true;
      clearTimeout(this.verificationTimer);this.verificationId='';
      window.removeEventListener('message', this.onMessage);
      this.iframe.removeEventListener('load', this.onLoad);
      this.iframe.removeEventListener('error', this.onFrameError);
      this.inspect.removeEventListener('click', this.onInspect);
      this.reload.removeEventListener('click', this.onReload);
      this.clearSelection.removeEventListener('click', this.onClear);
      this.input.removeEventListener('input', this.onInput);
      this.form.removeEventListener('submit', this.onSubmit);
      this.iframe.removeAttribute('src');
      this.root.remove();
      this.binding = null;
      this.selection = null;
    }
  }

  window.DistrictFeedback = DistrictFeedback;
})();
