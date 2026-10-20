'use strict';
// A GPU composition study only. This never starts Agent Bus or dispatches work.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { _electron } = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.join(__dirname, 'frames/06-management.png');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-storyboard-gpu-'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let app;
(async () => {
  try {
    const originalSource = fs.readFileSync(path.join(root, 'app/district-3d/world-entry.js'), 'utf8');
    const studySource = originalSource.replace('new THREE.FogExp2(0x14253e, .0105)', "new THREE.FogExp2(0x14253e, diagnostics.view === 'management' ? .0035 : .0105)");
    assert.notEqual(studySource, originalSource, 'The composition-only fog adjustment must be explicit');
    const bundled = await require(path.join(root, 'node_modules/esbuild')).build({ absWorkingDir: root,
      stdin: { contents: studySource, resolveDir: path.join(root, 'app/district-3d'), sourcefile: 'storyboard-camera-study.js' },
      bundle: true, platform: 'browser', format: 'iife', target: 'chrome144', write: false });
    fs.writeFileSync(path.join(scratch, 'world.js'), bundled.outputFiles[0].contents);
    fs.copyFileSync(path.join(root, 'app/district-attract-world.css'), path.join(scratch, 'world.css'));
    fs.writeFileSync(path.join(scratch, 'preload.cjs'), `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('bus',{districtReadAsset:name=>ipcRenderer.invoke('asset',name)});`);
    fs.writeFileSync(path.join(scratch, 'main.cjs'), `const {app,BrowserWindow,ipcMain,screen}=require('electron');const path=require('node:path');app.setPath('userData',path.join(__dirname,'user-data'));app.whenReady().then(()=>{const d=screen.getAllDisplays().find(x=>String(x.id)==='3242010503');if(!d)throw Error('4K monitor unavailable');const w=new BrowserWindow({x:d.workArea.x+48,y:d.workArea.y+24,width:1440,height:816,show:false,backgroundColor:'#06101e',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true}});ipcMain.handle('asset',(event,name)=>{if(event.sender!==w.webContents||event.senderFrame!==w.webContents.mainFrame)throw Error('Owner only');return require(${JSON.stringify(path.join(root, 'app/district/assets.js'))}).readDistrictAsset(name)});w.once('ready-to-show',()=>w.showInactive());w.loadFile(path.join(__dirname,'viewer.html'));});app.on('window-all-closed',()=>app.quit());`);
    fs.writeFileSync(path.join(scratch, 'viewer.html'), `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'"><link rel="stylesheet" href="world.css"><link rel="stylesheet" href="viewer.css"></head><body><div id="world"></div><div class="study">P01 / GPU CAMERA COMPOSITION STUDY<br><small>Same district · illustrative crew positions · gameplay integration remains WIP</small></div><div id="labels"></div><script src="world.js"></script><script src="viewer.js"></script></body></html>`);
    fs.writeFileSync(path.join(scratch, 'viewer.css'), `html,body,#world{width:100%;height:100%;margin:0;overflow:hidden;background:#06101e}body{font-family:Segoe UI,sans-serif}.study{position:absolute;left:26px;top:20px;color:#ffdc9c;font-size:14px;font-weight:700;letter-spacing:.12em;line-height:1.8}.study small{font-size:11px;font-weight:400;letter-spacing:.02em;color:#d0dfeb}.label{position:absolute;transform:translate(-50%,-115%);padding:6px 10px;background:#091728dc;border:1px solid #507688;border-radius:5px;color:#e5fbff;font-size:12px;white-space:nowrap;box-shadow:0 4px 12px #0005}`);
    fs.writeFileSync(path.join(scratch, 'viewer.js'), `window.study=DistrictAttractWorld.mount({container:document.querySelector('#world'),view:'management'});study.setWorkers([{id:'demo-research',facility:'research',phase:'research',basis:'reported',state:'working',stale:false},{id:'demo-build',facility:'build',phase:'edit',basis:'observed',state:'working',stale:false},{id:'demo-test',facility:'test',phase:'test',basis:'observed',state:'testing',stale:false},{id:'demo-review',facility:'review',phase:'review',basis:'reported',state:'working',stale:false}]);window.placeLabels=()=>{const layout=study.getLayout();document.querySelector('#labels').replaceChildren();for(const [id,name]of Object.entries({research:'Research Observatory',build:'Construction Forge',test:'Verification Lab',review:'Review Archive',preview:'Preview Gateway'})){const p=study.projectPoint(layout.facilityDetails[id].pin);const n=document.createElement('div');n.className='label';n.textContent=name;n.style.left=p.x+'px';n.style.top=p.y+'px';document.querySelector('#labels').append(n);}};`);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ executablePath: require(path.join(root, 'node_modules/electron')), args: [path.join(scratch, 'main.cjs')], env });
    const page = await app.firstWindow(); const errors = []; page.on('pageerror', error => errors.push(String(error)));
    await page.waitForFunction(() => {const d=window.study?.getDiagnostics(); return d?.ready && d.worldAsset==='loaded' && d.hostAsset==='loaded' && d.renderedFrames>2;}, null, { timeout: 30000 });
    const diagnostic = await page.evaluate(() => {placeLabels(); return study.getDiagnostics();});
    assert.match(diagnostic.gpu.renderer, /NVIDIA|AMD|Radeon|Intel|Apple/i); assert.doesNotMatch(diagnostic.gpu.renderer, /swiftshader|llvmpipe|software/i);
    assert.equal(diagnostic.view, 'management'); assert.equal(diagnostic.camera.type, 'orthographic'); assert.deepEqual(errors, []);
    const bounds = await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].getBounds()); assert.ok(bounds.x < 0 && bounds.x+bounds.width <= 0);
    await page.screenshot({ path: output, scale: 'css' });
    const firstFrame = await page.evaluate(() => {study.setView('cinematic');study.setBeat('crew');study.setEngaged(true);document.querySelector('#labels').hidden=true;document.querySelector('.study').innerHTML='S03 / LOW CAMERA COMPOSITION STUDY<br><small>Same district · illustrative crew activity · production direction, no jobs dispatched</small>';return study.getDiagnostics().renderedFrames;});
    await page.waitForFunction(previous => study.getDiagnostics().renderedFrames > previous + 150, firstFrame, {timeout:15000});
    const lowOutput = path.join(__dirname, 'frames/03-reveal.png');
    await page.screenshot({path:lowOutput,scale:'css'});
    const evidence = { at: new Date().toISOString(), purpose: 'Storyboarding camera/geometry composition only; illustrative crew, no Agent Bus runtime or work commands',
      output, sha256: hash(output), lowOutput, lowSha256:hash(lowOutput), scratch, bounds, diagnostic, errors,
      studyOnlyAdjustments: { managementFogDensity: .0035, cinematicFogDensity: .0105, reason: 'Preserve readable foreground materials at the farther overhead camera; no product source or bundle modified',
        temporarySourceSha256: crypto.createHash('sha256').update(studySource).digest('hex') },
      inputs: Object.fromEntries(['app/district-3d/world-entry.js','app/assets/district-v2/district-world.glb','app/assets/district-v2/district-host.glb'].map(file => [file,hash(path.join(root,file))])) };
    fs.writeFileSync(path.join(__dirname, 'reference-provenance.json'), JSON.stringify(evidence,null,2)+'\n');
    console.log(JSON.stringify({passed:true,output,gpu:diagnostic.gpu,view:diagnostic.view}));
  } finally { if(app)await app.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
