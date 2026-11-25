/* MI-GAN-512 Places2 official ONNX pipeline (MIT).
   ORT Web 1.20.1 (MIT). Static assets are accelerated via multi-CDN mirrors and
   persisted in browser Cache API. All image processing stays strictly local. */
let sessionPromise;
let busy = false;

const WASM_PATH = 'assets/ai/ort-wasm-simd-threaded.wasm';
const WASM_SIZE = 11246032;
const WASM_CACHE_TAG = 'ort-1.20.1-sz-11246032';
const MODEL_DIR = 'assets/watermark/assets/ai/';
const MODEL_MANIFEST_PATH = 'assets/watermark/assets/ai/migan-manifest.json';
const MODEL_SIZE = 28079181;
const MODEL_SHA256 = '6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b';

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function progress(id, stage, message, loaded, total) {
  self.postMessage({ id, type: 'progress', stage, message, loaded, total });
}

async function loadSession(id) {
  if (!sessionPromise) sessionPromise = (async () => {
    importScripts('../../../ai/asset-loader.js?v=20261125-cdn1', 'ort.min.js');
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = new URL('./', self.location.href).href;
    ort.env.logLevel = 'error';

    const loader = self.YouyueAssetLoader;
    const combinedTotal = WASM_SIZE + MODEL_SIZE;
    let lastReportAt = 0;

    progress(id, 'loading', '正在准备本机修复引擎与模型…', 0, combinedTotal);

    // 1. 复用与抠图共享的 11.2 MB WASM 推理引擎永久缓存
    const wasmResult = await loader.fetchBytes(WASM_PATH, {
      expectedSize: WASM_SIZE,
      cacheTag: WASM_CACHE_TAG,
      contentType: 'application/wasm',
      onProgress: (received, total, label, fromCache) => {
        const now = performance.now();
        if (!fromCache && received < total && now - lastReportAt < 180) return;
        lastReportAt = now;
        const msg = fromCache
          ? '已命中本机缓存，正在读取修复引擎…'
          : '正在加载修复引擎（' + label + ' · ' + formatMB(received) + '/' + formatMB(total || WASM_SIZE) + ' MB）…';
        progress(id, 'loading', msg, received, combinedTotal);
      }
    });
    const wasmBuf = (wasmResult.bytes.byteOffset === 0 && wasmResult.bytes.byteLength === wasmResult.bytes.buffer.byteLength)
      ? wasmResult.bytes.buffer
      : wasmResult.bytes.slice().buffer;
    ort.env.wasm.wasmBinary = wasmBuf;

    // 2. 加载 MI-GAN 分片模型（多源 CDN + 分片永久缓存 + SHA-256 校验）
    const descriptor = await loader.fetchJson(MODEL_MANIFEST_PATH);
    if (
      descriptor.size !== MODEL_SIZE ||
      !Array.isArray(descriptor.parts) ||
      descriptor.parts.length < 1 ||
      descriptor.parts.length > 8 ||
      descriptor.parts.some(p => !p || !/^[a-zA-Z0-9_.-]+$/.test(p.file) || !Number.isInteger(p.size) || p.size <= 0) ||
      descriptor.parts.reduce((n, p) => n + p.size, 0) !== MODEL_SIZE
    ) {
      throw new Error('修复模型清单无效。');
    }
    descriptor.sha256 = MODEL_SHA256;

    const assembled = await loader.fetchChunked(MODEL_DIR, descriptor, {
      onProgress: (received, total, label, fromCache, partIdx, partCount) => {
        const now = performance.now();
        if (!fromCache && received < total && now - lastReportAt < 180) return;
        lastReportAt = now;
        const msg = fromCache
          ? '已命中本机缓存（' + partIdx + '/' + partCount + '），秒速读取修复模型…'
          : '正在加载修复模型（分片 ' + partIdx + '/' + partCount + ' · ' + label + ' · ' + formatMB(received) + '/' + formatMB(total || MODEL_SIZE) + ' MB）…';
        progress(id, 'loading', msg, WASM_SIZE + received, combinedTotal);
      }
    });

    const initMsg = (wasmResult.fromCache && assembled.fromCache)
      ? '已命中本机永久缓存，正在初始化修复引擎…'
      : '修复模型已缓存至本机（下次免下载），正在初始化引擎…';
    progress(id, 'initializing', initMsg);
    return await ort.InferenceSession.create(assembled.bytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
  })().catch(e => {
    sessionPromise = null;
    throw e;
  });
  return await sessionPromise;
}

self.onmessage = async ({ data }) => {
  const { id, width, height } = data;
  if (busy) { self.postMessage({ id, type: 'error', message: '修复引擎正在处理另一个任务。' }); return; }
  busy = true; let imageTensor, maskTensor, outputs;
  try {
    const session = await loadSession(id), rgba = new Uint8ClampedArray(data.pixels), selection = new Uint8Array(data.mask), length = width * height;
    const rgb = new Uint8Array(length * 3), keep = new Uint8Array(length);
    for (let i = 0; i < length; i++) { rgb[i] = rgba[i * 4]; rgb[length + i] = rgba[i * 4 + 1]; rgb[length * 2 + i] = rgba[i * 4 + 2]; keep[i] = selection[i] > 127 ? 0 : 255; }
    imageTensor = new ort.Tensor('uint8', rgb, [1, 3, height, width]); maskTensor = new ort.Tensor('uint8', keep, [1, 1, height, width]);
    progress(id, 'running', '正在本机修复涂选区域…');
    const start = performance.now();
    outputs = await session.run({ image: imageTensor, mask: maskTensor });
    const inferenceMs = performance.now() - start, output = outputs.result || outputs[session.outputNames[0]];
    if (output.type !== 'uint8' || output.dims[2] !== height || output.dims[3] !== width) throw new Error('模型输出尺寸不匹配。');
    const result = output.data;
    // Enforce exact untouched pixels outside the user's binary selection.
    for (let i = 0; i < length; i++) if (selection[i] > 127) { rgba[i * 4] = result[i]; rgba[i * 4 + 1] = result[length + i]; rgba[i * 4 + 2] = result[length * 2 + i]; }
    progress(id, 'complete', '本机修复完成');
    self.postMessage({ id, type: 'result', width, height, pixels: rgba.buffer, inferenceMs }, [rgba.buffer]);
  } catch (e) { self.postMessage({ id, type: 'error', message: e?.message || String(e) }); }
  finally { imageTensor?.dispose(); maskTensor?.dispose(); if (outputs) Object.values(outputs).forEach(t => t.dispose()); busy = false; }
};
