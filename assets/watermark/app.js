import { RepairEngine } from './repair-engine.js';

const root = document.getElementById('watermarkView');
const $ = id => document.getElementById('wm-' + id);
const ui = Object.fromEntries(['fileInput','uploadCard','sampleList','sampleCount','imageTitle','documentWarning','paintBtn','eraseBtn','brushSize','brushValue','undoBtn','clearMaskBtn','canvasArea','emptyState','canvasWrap','imageCanvas','maskCanvas','canvasCaption','dropCover','imageMeta','maskMeta','runBtn','cancelBtn','compareBtn','resetResultBtn','downloadBtn','progressPanel','progressIcon','statusText','statusDetail','elapsedTime','loadProgress','exportFallback','saveLink','exportDownload'].map(id => [id, $(id)]));
ui.exportLink = ui.saveLink;
const ctx = ui.imageCanvas.getContext('2d', { willReadFrequently: true });
const maskCtx = ui.maskCanvas.getContext('2d', { willReadFrequently: true });
const MAX_EDGE = 2048, MAX_FILE = 20 * 1024 * 1024, MAX_PIXELS = 32_000_000;
const state = { source: null, sourceURL: null, filename: '', sample: null, width: 0, height: 0, originalWork: null, current: null, committedMask: null, history: [], mode: 'paint', comparing: false, maskVisible: true, drawing: false, lastPoint: null, busy: false, phase: '', hasResult: false, operation: 0, engine: null, timer: null, started: 0, exportURL: null, samples: [], editedPixels: 0 };
function refreshSharedControls(){
  ui.uploadCard.classList.toggle('is-disabled',state.busy);ui.fileInput.disabled=state.busy;
  ui.sampleList.querySelectorAll('button').forEach(button=>{button.disabled=state.busy;});
}
function renderSamples(){
  ui.sampleList.replaceChildren();ui.sampleCount.textContent=`${state.samples.length} 张`;
  state.samples.forEach((sample,index)=>{
    const button=document.createElement('button');button.type='button';button.className='sample-button';button.dataset.sampleId=String(sample.id);
    const active=String(state.sample?.id)===String(sample.id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.disabled=state.busy;
    const number=document.createElement('span');number.className='sample-number';number.textContent=String(index+1).padStart(2,'0');
    const copy=document.createElement('span'),title=document.createElement('strong'),kind=document.createElement('small');title.textContent=sample.title;
    kind.textContent=sample.kind==='document'||String(sample.id)==='06'?'整页重复水印 · 文字可能受损':'边角水印 · 本机处理';copy.append(title,kind);button.append(number,copy);
    button.addEventListener('click',()=>{if(state.busy)return;importImage(new URL('samples/'+sample.file,import.meta.url).href,sample.file,sample);});ui.sampleList.appendChild(button);
  });
}

function setStatus(stage, text, detail = '') {
  ui.progressPanel.dataset.stage = stage;
  ui.statusText.textContent = text;
  ui.statusDetail.textContent = detail;
  ui.progressIcon.textContent = stage === 'done' ? '✓' : stage === 'error' ? '!' : state.busy ? '◌' : '○';
  ui.progressPanel.classList.toggle('is-busy', state.busy);
}
function setBusy(value, phase = '') {
  state.busy = value; state.phase = phase;
  ui.progressPanel.classList.toggle('is-busy', value);
  ui.cancelBtn.hidden = !value || phase !== 'repairing';
  ui.runBtn.hidden = value && phase === 'repairing';
  refreshSharedControls();
  refreshControls();
}
function refreshControls() {
  const loaded = !!state.current;
  [ui.paintBtn,ui.eraseBtn,ui.brushSize].forEach(b => { b.disabled = !loaded || state.busy; });
  ui.runBtn.disabled = !loaded || !state.editedPixels || state.busy;
  ui.undoBtn.disabled = !state.history.length || state.busy;
  ui.clearMaskBtn.disabled = !state.editedPixels || state.busy;
  ui.compareBtn.disabled = !state.hasResult || state.busy;
  ui.resetResultBtn.disabled = !state.hasResult || state.busy;
  ui.downloadBtn.disabled = !state.hasResult || state.busy;
}
function startTimer() {
  stopTimer(); state.started = performance.now();
  state.timer = setInterval(() => { ui.elapsedTime.textContent = `${((performance.now() - state.started) / 1000).toFixed(1)} 秒`; }, 100);
}
function stopTimer() { if (state.timer) clearInterval(state.timer); state.timer = null; }
function revokeExport() {
  if (state.exportURL?.startsWith('blob:')) URL.revokeObjectURL(state.exportURL);
  state.exportURL = null; ui.exportFallback.hidden = true;
  ui.exportLink.removeAttribute('href'); ui.exportDownload.removeAttribute('href');
}
function releaseImage(image) { if (image && typeof image.close === 'function') image.close(); else if (image instanceof HTMLImageElement) image.removeAttribute('src'); }
function resetImageState() {
  stopTimer(); revokeExport(); releaseImage(state.source);
  if (state.sourceURL) URL.revokeObjectURL(state.sourceURL);
  state.sourceURL = null; state.source = null; state.originalWork = null; state.current = null;
  state.committedMask = null; state.history = []; state.hasResult = false;
  state.editedPixels = 0; state.comparing = false; state.maskVisible = true;
}
function decodeImage(url, timeoutMs = url.startsWith('blob:') ? 60000 : 30000) {
  return new Promise((resolve, reject) => {
    const image = new Image(); let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timer); image.onload = image.onerror = null;
      if (error) { releaseImage(image); reject(error); } else resolve(image);
    };
    const timer = setTimeout(() => finish(new Error(`图片读取超过 ${timeoutMs / 1000} 秒，已停止等待。请检查本地预览服务或重新选择图片。`)), timeoutMs);
    image.onload = () => finish(image.naturalWidth && image.naturalHeight ? null : new Error('图片尺寸无效，请重新选择图片。'));
    image.onerror = () => finish(new Error('图片无法读取，请使用完整的 PNG、JPG 或 WebP 文件。'));
    image.src = url;
  });
}
function render() {
  if (!state.current) return;
  ctx.putImageData(state.comparing ? state.originalWork : state.current, 0, 0);
  ui.canvasWrap.classList.toggle('comparing', state.comparing);
  ui.maskCanvas.style.opacity = state.maskVisible ? '.46' : '0';
  ui.canvasCaption.textContent = state.comparing ? '原始图片' : state.hasResult && !state.maskVisible ? '修复结果 · 按住按钮查看原图' : '红色为修复区域';
  ui.compareBtn.setAttribute('aria-pressed', String(state.comparing));
}
function fitCanvas() {
  if (!state.width || root.hidden || !ui.canvasArea.clientWidth) return;
  const available = ui.canvasArea.clientWidth - (innerWidth <= 760 ? 24 : 46);
  const maxHeight = innerWidth <= 760 ? 600 : 690;
  const scale = Math.min(available / state.width, maxHeight / state.height, 1);
  ui.canvasWrap.style.width = Math.max(1, Math.round(state.width * scale)) + 'px';
  ui.canvasWrap.style.height = Math.max(1, Math.round(state.height * scale)) + 'px';
}
function getMaskBytes() {
  const rgba = maskCtx.getImageData(0, 0, state.width, state.height).data;
  const bytes = new Uint8Array(state.width * state.height);
  for (let i = 0; i < bytes.length; i++) bytes[i] = rgba[i * 4 + 3] > 0 ? 255 : 0;
  return bytes;
}
function putMaskBytes(bytes) {
  const image = maskCtx.createImageData(state.width, state.height);
  for (let i = 0; i < bytes.length; i++) { image.data[i*4] = 231; image.data[i*4+1] = 37; image.data[i*4+2] = 53; image.data[i*4+3] = bytes[i] ? 255 : 0; }
  maskCtx.putImageData(image, 0, 0);
}
function updateMaskMeta() {
  if (!state.current) return;
  const mask = getMaskBytes(); let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
  state.editedPixels = count;
  const percent = (count / mask.length * 100).toFixed(2);
  ui.maskMeta.textContent = count ? `已涂选 ${percent}% · ${count.toLocaleString()} 像素` : '未涂选区域';
  ui.maskMeta.dataset.pixels = String(count); refreshControls();
}
function pushMaskHistory() { state.history.push(getMaskBytes()); if (state.history.length > 8) state.history.shift(); }
function selectMode(mode) {
  state.mode = mode;
  ui.paintBtn.classList.toggle('active', mode === 'paint'); ui.eraseBtn.classList.toggle('active', mode === 'erase');
  ui.paintBtn.setAttribute('aria-pressed', String(mode === 'paint')); ui.eraseBtn.setAttribute('aria-pressed', String(mode === 'erase'));
  state.maskVisible = true; render();
}

async function importImage(url, filename, sample = null, ownedURL = false) {
  if (state.busy) { if (ownedURL) URL.revokeObjectURL(url); return; }
  const operation = ++state.operation;
  setBusy(true, 'image-loading'); setStatus('loading', '正在读取图片…', '图片在本机解码，不会上传到图像服务。');
  let image, sampleMask = null, scratch = null;
  try {
    image = await decodeImage(url);
    if (image.naturalWidth * image.naturalHeight > MAX_PIXELS || image.naturalWidth > 16000 || image.naturalHeight > 16000) throw new Error('图片过大。请先缩小至 3200 万像素以内，最长边不超过 16000 px。');
    if (sample?.maskFile) sampleMask = await decodeImage(new URL('samples/' + sample.maskFile, import.meta.url).href);
    if (operation !== state.operation) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale)), height = Math.max(1, Math.round(image.naturalHeight * scale));
    // Prepare both sources before replacing the current result. Failed image or
    // mask requests leave the previous image and its export available.
    scratch = document.createElement('canvas'); scratch.width = width; scratch.height = height;
    const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
    if (!scratchCtx) throw new Error('浏览器无法准备图片画布，请缩小图片后重试。');
    scratchCtx.drawImage(image, 0, 0, width, height);
    const preparedOriginal = scratchCtx.getImageData(0, 0, width, height);
    const preparedCurrent = new ImageData(new Uint8ClampedArray(preparedOriginal.data), width, height);
    const preparedMask = new Uint8Array(width * height);
    if (sampleMask) {
      scratchCtx.clearRect(0, 0, width, height); scratchCtx.imageSmoothingEnabled = false;
      scratchCtx.drawImage(sampleMask, 0, 0, width, height);
      const data = scratchCtx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < preparedMask.length; i++) preparedMask[i] = data[i*4] >= 128 && data[i*4+3] >= 128 ? 255 : 0;
    }
    scratch.width = scratch.height = 1;
    resetImageState();
    state.source = image; state.sourceURL = ownedURL ? url : null; state.filename = filename; state.sample = sample;
    state.width = width; state.height = height;
    ui.imageCanvas.width = ui.maskCanvas.width = state.width; ui.imageCanvas.height = ui.maskCanvas.height = state.height;
    state.originalWork = preparedOriginal; state.current = preparedCurrent;
    state.committedMask = new Uint8Array(state.width * state.height);
    putMaskBytes(preparedMask);
    ui.imageTitle.textContent = sample?.title || filename;
    ui.documentWarning.hidden = sample?.kind !== 'document' && String(sample?.id) !== '06';
    ui.imageMeta.textContent = `原图 ${image.naturalWidth} × ${image.naturalHeight} px` + (scale < 1 ? ` · 处理 ${state.width} × ${state.height} px · 导出原尺寸` : ' · 原尺寸处理与导出');
    ui.imageMeta.dataset.originalWidth = String(image.naturalWidth); ui.imageMeta.dataset.originalHeight = String(image.naturalHeight);
    ui.imageMeta.dataset.workingWidth = String(state.width); ui.imageMeta.dataset.workingHeight = String(state.height);
    ui.canvasWrap.hidden = false; ui.emptyState.hidden = true; ui.elapsedTime.textContent = '';
    ui.sampleList.querySelectorAll('button').forEach(b => { const active = b.dataset.sampleId === String(sample?.id); b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    fitCanvas(); render(); updateMaskMeta();
    setStatus('ready', sampleMask ? '样张与预选区域已就绪' : '图片已就绪，请涂选要修复的位置', sample?.description || '用红色画笔覆盖目标区域，可随时擦除、撤销或清空。');
  } catch (error) {
    if (ownedURL && state.sourceURL !== url) URL.revokeObjectURL(url);
    setStatus('error', '图片读取失败', error?.message || String(error));
  } finally {
    if (scratch) scratch.width = scratch.height = 1;
    releaseImage(sampleMask);
    if (image !== state.source) releaseImage(image);
    if (ownedURL && state.sourceURL !== url) URL.revokeObjectURL(url);
    if (operation === state.operation) { setBusy(false); refreshControls(); }
  }
}
function importFile(file) {
  if (!file || state.busy) return;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { setStatus('error', '暂不支持此文件格式', '请选择 PNG、JPG 或 WebP 图片。'); return; }
  if (file.size > MAX_FILE) { setStatus('error', '文件超过 20 MB', '请先减小文件大小后重试，原图不会被修改。'); return; }
  importImage(URL.createObjectURL(file), file.name, null, true);
}

function point(event) {
  const rect = ui.maskCanvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(state.width, (event.clientX - rect.left) / rect.width * state.width)), y: Math.max(0, Math.min(state.height, (event.clientY - rect.top) / rect.height * state.height)) };
}
function stroke(from, to) {
  maskCtx.save(); maskCtx.globalCompositeOperation = state.mode === 'erase' ? 'destination-out' : 'source-over';
  maskCtx.strokeStyle = '#e72535'; maskCtx.fillStyle = '#e72535'; maskCtx.lineWidth = Number(ui.brushSize.value); maskCtx.lineCap = 'round'; maskCtx.lineJoin = 'round';
  maskCtx.beginPath(); maskCtx.moveTo(from.x, from.y); maskCtx.lineTo(to.x, to.y); maskCtx.stroke();
  maskCtx.beginPath(); maskCtx.arc(to.x, to.y, Number(ui.brushSize.value) / 2, 0, Math.PI * 2); maskCtx.fill(); maskCtx.restore();
}
function endStroke(event) {
  if (!state.drawing) return;
  state.drawing = false; state.lastPoint = null;
  try { if (event?.pointerId != null && ui.maskCanvas.hasPointerCapture(event.pointerId)) ui.maskCanvas.releasePointerCapture(event.pointerId); } catch (_) {}
  updateMaskMeta();
}
ui.maskCanvas.addEventListener('pointerdown', event => {
  if (state.busy || !state.current || event.button !== 0 || state.drawing) return;
  event.preventDefault(); state.comparing = false; pushMaskHistory(); state.maskVisible = true; render();
  state.drawing = true; state.lastPoint = point(event); ui.maskCanvas.setPointerCapture(event.pointerId); stroke(state.lastPoint, state.lastPoint);
});
ui.maskCanvas.addEventListener('pointermove', event => {
  if (!state.drawing || state.busy) return;
  event.preventDefault(); const next = point(event); stroke(state.lastPoint, next); state.lastPoint = next;
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) ui.maskCanvas.addEventListener(type, endStroke);
ui.paintBtn.addEventListener('click', () => selectMode('paint'));
ui.eraseBtn.addEventListener('click', () => selectMode('erase'));
ui.brushSize.addEventListener('input', () => { ui.brushValue.textContent = `${ui.brushSize.value} px`; });
ui.undoBtn.addEventListener('click', () => { if (!state.history.length || state.busy) return; putMaskBytes(state.history.pop()); state.maskVisible = true; render(); updateMaskMeta(); });
ui.clearMaskBtn.addEventListener('click', () => { if (state.busy || !state.current) return; pushMaskHistory(); maskCtx.clearRect(0, 0, state.width, state.height); state.maskVisible = true; render(); updateMaskMeta(); });

function progress(info = {}) {
  if (!state.busy || state.phase !== 'repairing') return;
  const message = info.message || ({ loading:'正在加载本机模型…', downloading:'正在读取模型文件…', initializing:'正在初始化修复引擎…', running:'正在本机推理…', inference:'正在补全涂选区域…' })[info.stage] || '正在本机处理…';
  setStatus(info.stage || 'running', message, '请保持页面打开。较大的涂选范围可能需要更长时间，可随时取消。');
  const hasProgress = Number.isFinite(info.total) && info.total > 0 && Number.isFinite(info.loaded);
  ui.loadProgress.hidden = !hasProgress;
  if (hasProgress) ui.loadProgress.value = Math.min(100, info.loaded / info.total * 100);
}
async function repair() {
  if (state.busy || !state.current || !state.editedPixels) return;
  endStroke(); const op = ++state.operation; const mask = getMaskBytes();
  state.comparing = false; render(); setBusy(true, 'repairing'); startTimer();
  setStatus('loading', '正在准备本机修复…', '首次加载包含模型与 WASM 初始化；此过程不上传图片。');
  try {
    if (!state.engine) state.engine = new RepairEngine({ onProgress: progress });
    const input = new ImageData(new Uint8ClampedArray(state.current.data), state.width, state.height);
    const result = await state.engine.run({ imageData: input, mask, width: state.width, height: state.height }, { onProgress: progress });
    if (op !== state.operation) return;
    const generated = result?.imageData;
    if (!generated || generated.width !== state.width || generated.height !== state.height || generated.data?.length !== state.current.data.length) throw new Error('模型返回了不匹配的图片尺寸，请取消后重试。');
    // The UI enforces preservation even if an engine accidentally modifies outside the mask.
    const next = new Uint8ClampedArray(state.current.data);
    for (let i = 0; i < mask.length; i++) if (mask[i]) { const j = i*4; next[j] = generated.data[j]; next[j+1] = generated.data[j+1]; next[j+2] = generated.data[j+2]; next[j+3] = state.originalWork.data[j+3]; state.committedMask[i] = 255; }
    state.current = new ImageData(next, state.width, state.height); state.hasResult = true; state.maskVisible = false;
    stopTimer(); revokeExport(); render();
    const elapsed = Number.isFinite(result.elapsedMs) ? result.elapsedMs : performance.now() - state.started;
    const inference = Number.isFinite(result.inferenceMs) ? ` · 推理 ${(result.inferenceMs / 1000).toFixed(1)} 秒` : '';
    ui.elapsedTime.textContent = `${(elapsed/1000).toFixed(1)} 秒`;
    ui.progressPanel.dataset.elapsedMs = String(Math.round(elapsed));
    if (Number.isFinite(result.inferenceMs)) ui.progressPanel.dataset.inferenceMs = String(Math.round(result.inferenceMs));
    setStatus('done', '本机修复完成，请对照原图检查', `总计 ${(elapsed/1000).toFixed(1)} 秒${inference}。涂选外保持不变；细节不满意时可恢复原图、缩小涂选后重试。`);
  } catch (error) {
    if (op !== state.operation) return;
    stopTimer(); setStatus('error', '这次修复没有完成', error?.message || '请重试；已保留当前图片与涂选区域。');
  } finally {
    if (op === state.operation) { stopTimer(); ui.loadProgress.hidden = true; setBusy(false); refreshControls(); }
  }
}
ui.runBtn.addEventListener('click', repair);
ui.cancelBtn.addEventListener('click', () => {
  if (!state.busy || state.phase !== 'repairing') return;
  ++state.operation;
  try { state.engine?.cancel(); } catch (_) {}
  stopTimer(); ui.loadProgress.hidden = true; setBusy(false);
  setStatus('cancelled', '已取消处理，图片与涂选已保留', '可以修改涂选区域，再次开始修复。'); render();
});

function compare(value) { if (!state.current || !state.hasResult || state.busy) return; state.comparing = value; render(); }
ui.compareBtn.addEventListener('pointerdown', event => { if (ui.compareBtn.disabled) return; event.preventDefault(); ui.compareBtn.setPointerCapture(event.pointerId); compare(true); });
for (const type of ['pointerup','pointercancel','lostpointercapture','blur']) ui.compareBtn.addEventListener(type, () => compare(false));
ui.compareBtn.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); compare(true); } });
ui.compareBtn.addEventListener('keyup', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); compare(false); } });
window.addEventListener('blur', () => { endStroke(); compare(false); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { endStroke(); compare(false); } });
ui.resetResultBtn.addEventListener('click', () => {
  if (state.busy || !state.originalWork) return;
  state.current = new ImageData(new Uint8ClampedArray(state.originalWork.data), state.width, state.height);
  state.committedMask.fill(0); state.hasResult = false; state.maskVisible = true; state.comparing = false;
  revokeExport(); render(); refreshControls();
  setStatus('ready', '已恢复原始图片', '当前涂选保留，可调整后重新修复。'); ui.elapsedTime.textContent = '';
});

async function exportPNG() {
  if (!state.hasResult || !state.source || state.busy) return;
  const op = ++state.operation; setBusy(true, 'exporting'); setStatus('exporting', '正在合成原尺寸 PNG…', '仅合成已经修复的区域，其余区域使用原始图片像素。');
  const out = document.createElement('canvas'), patch = document.createElement('canvas'), stencil = document.createElement('canvas');
  const work = document.createElement('canvas'), workMask = document.createElement('canvas');
  let encodedURL = null;
  try {
    out.width = state.source.naturalWidth; out.height = state.source.naturalHeight;
    // Only the final output is original-size. Reusable tiles avoid two extra
    // full-resolution canvases when exporting long document images.
    const tileSize = 1024;
    patch.width = patch.height = stencil.width = stencil.height = tileSize;
    const outCtx = out.getContext('2d'), patchCtx = patch.getContext('2d'), stencilCtx = stencil.getContext('2d');
    if (!outCtx || !patchCtx || !stencilCtx) throw new Error('浏览器无法准备导出画布，请缩小原图后重试。');
    outCtx.drawImage(state.source, 0, 0);
    work.width = workMask.width = state.width; work.height = workMask.height = state.height;
    const workCtx = work.getContext('2d'); workCtx.putImageData(state.current,0,0);
    const maskWorkCtx = workMask.getContext('2d'), alpha = maskWorkCtx.createImageData(state.width, state.height);
    for (let i = 0; i < state.committedMask.length; i++) alpha.data[i*4+3] = state.committedMask[i];
    maskWorkCtx.putImageData(alpha, 0, 0); stencilCtx.imageSmoothingEnabled = false;
    for (let y = 0; y < out.height; y += tileSize) {
      for (let x = 0; x < out.width; x += tileSize) {
        const width = Math.min(tileSize, out.width-x), height = Math.min(tileSize, out.height-y);
        patchCtx.globalCompositeOperation = 'source-over'; patchCtx.clearRect(0,0,tileSize,tileSize); stencilCtx.clearRect(0,0,tileSize,tileSize);
        // Same global transform on every tile: image filtering and nearest
        // mask sampling match a single large canvas, including tile boundaries.
        patchCtx.drawImage(work, -x, -y, out.width, out.height);
        stencilCtx.drawImage(workMask, -x, -y, out.width, out.height);
        patchCtx.globalCompositeOperation = 'destination-in'; patchCtx.drawImage(stencil,0,0);
        outCtx.drawImage(patch,0,0,width,height,x,y,width,height);
      }
      await new Promise(resolve => setTimeout(resolve,0));
      if (op !== state.operation) return;
    }
    work.width = work.height = workMask.width = workMask.height = 1;
    const blob = await new Promise((resolve,reject) => out.toBlob(blob => blob ? resolve(blob) : reject(new Error('浏览器没有生成 PNG。可先缩小原图后重试。')), 'image/png'));
    if (op !== state.operation) return;
    encodedURL = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('PNG 读取失败，请重新导出。')); reader.readAsDataURL(blob); });
    if (op !== state.operation) return;
    revokeExport(); state.exportURL = encodedURL;
    const filename = (state.filename || '图片').replace(/\.[^.]+$/, '') + '_本机修复.png';
    ui.exportLink.href = ui.exportDownload.href = encodedURL; ui.exportDownload.download = filename; ui.exportFallback.hidden = false;
    // Keep a persistent visible link because Safari may block asynchronous automatic downloads.
    // Export is prepared asynchronously. The user explicitly saves through the persistent
    // links below; this avoids Safari activation loss and data-URL navigation in embedded browsers.
    ui.exportFallback.dataset.width = String(out.width); ui.exportFallback.dataset.height = String(out.height);
    setStatus('done', 'PNG 已生成，原尺寸导出', `输出 ${out.width} × ${out.height} px。请点击下方“下载 PNG”保存；也可打开高清图后保存。`);
  } catch (error) {
    if (op === state.operation) setStatus('error', 'PNG 导出未完成', error?.message || String(error));
    if (encodedURL?.startsWith('blob:') && state.exportURL !== encodedURL) URL.revokeObjectURL(encodedURL);
  } finally {
    out.width = out.height = patch.width = patch.height = stencil.width = stencil.height = work.width = work.height = workMask.width = workMask.height = 1;
    if (op === state.operation) { setBusy(false); refreshControls(); }
  }
}
ui.downloadBtn.addEventListener('click', exportPNG);
ui.fileInput.addEventListener('change', () => { const file = ui.fileInput.files?.[0]; ui.fileInput.value = ''; importFile(file); });
let dragDepth = 0;
ui.canvasArea.addEventListener('dragenter', event => { event.preventDefault(); if (!state.busy) { dragDepth++; ui.dropCover.hidden = false; } });
ui.canvasArea.addEventListener('dragover', event => { event.preventDefault(); });
ui.canvasArea.addEventListener('dragleave', event => { event.preventDefault(); dragDepth = Math.max(0,dragDepth-1); if (!dragDepth) ui.dropCover.hidden = true; });
ui.canvasArea.addEventListener('drop', event => { event.preventDefault(); dragDepth=0; ui.dropCover.hidden=true; importFile(event.dataTransfer?.files?.[0]); });
window.addEventListener('resize', fitCanvas);
export function activate() { requestAnimationFrame(fitCanvas); }
export function suspend() { endStroke(); compare(false); }
export function dispose() { ++state.operation; stopTimer(); try { state.engine?.dispose(); } catch (_) {} resetImageState(); }
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  stopTimer(); revokeExport(); try { state.engine?.dispose(); } catch (_) {}
  if (state.sourceURL) URL.revokeObjectURL(state.sourceURL);
});

function initialize() {
  refreshControls();
  if (location.protocol === 'file:') {
    setStatus('error', '请通过本地预览服务打开', '请运行文件夹中的本地预览启动文件，再打开 http://127.0.0.1 地址。');
    return;
  }
  root.querySelector('.sample-heading').hidden = true;
  ui.sampleList.hidden = true;
  setStatus('ready', '去水印工具已就绪，请上传图片', '上传后用画笔覆盖水印，再点击“去除选中水印”。首次处理才加载本机模型。');
}

initialize();
activate();
