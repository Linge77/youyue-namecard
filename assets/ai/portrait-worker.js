/* Portrait matting: MODNet (Apache-2.0) with ONNX Runtime Web 1.20.1 (MIT).
   Static assets are accelerated across multi-CDN mirrors and persisted in browser Cache API.
   All inference runs locally in the browser. No employee image is uploaded. */
let sessionPromise;

const WASM_PATH = 'assets/ai/ort-wasm-simd-threaded.wasm';
const WASM_SIZE = 11246032;
const WASM_CACHE_TAG = 'ort-1.20.1-sz-11246032';
const MODEL_MANIFEST_PATH = 'assets/ai/modnet-manifest.json';
const MODEL_LEGACY_PATH = 'assets/ai/modnet.onnx';
const MODEL_SIZE = 25888640;

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

async function loadModel(id) {
  if (!sessionPromise) sessionPromise = (async () => {
    importScripts('asset-loader.js?v=20261125-cdn1', 'ort.min.js');
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = new URL('./', self.location.href).href;
    ort.env.logLevel = 'error';

    const loader = self.YouyueAssetLoader;
    let lastReportAt = 0;

    // 1. 加载 11.2 MB WebAssembly 推理引擎（优先本机永久缓存，其次多路加速节点）
    const wasmResult = await loader.fetchBytes(WASM_PATH, {
      expectedSize: WASM_SIZE,
      cacheTag: WASM_CACHE_TAG,
      contentType: 'application/wasm',
      onProgress: (received, total, label, fromCache) => {
        const now = performance.now();
        if (!fromCache && received < total && now - lastReportAt < 180) return;
        lastReportAt = now;
        const pct = Math.max(4, Math.min(24, Math.round((received / (total || WASM_SIZE)) * 24)));
        const msg = fromCache
          ? '已命中本机缓存，正在读取抠像引擎…'
          : '正在加载抠像引擎（' + label + ' · ' + formatMB(received) + '/' + formatMB(total || WASM_SIZE) + ' MB）…';
        self.postMessage({ id, type: 'progress', progress: pct, message: msg });
      }
    });
    // 传入纯 ArrayBuffer，让 ORT 直接从内存实例化 WASM，不再重新请求外网 .wasm
    const wasmBuf = (wasmResult.bytes.byteOffset === 0 && wasmResult.bytes.byteLength === wasmResult.bytes.buffer.byteLength)
      ? wasmResult.bytes.buffer
      : wasmResult.bytes.slice().buffer;
    ort.env.wasm.wasmBinary = wasmBuf;

    // 2. 加载 MODNet 人像模型（优先 4×6.5MB 分片多源加速 + 分片级永久缓存，旧部署自动回退 modnet.onnx）
    let modelBytes;
    let modelFromCache = false;
    let manifest = null;
    try {
      manifest = await loader.fetchJson(MODEL_MANIFEST_PATH);
    } catch (_) {
      manifest = null;
    }

    if (manifest && Array.isArray(manifest.parts) && manifest.parts.length) {
      const assembled = await loader.fetchChunked('assets/ai/', manifest, {
        onProgress: (received, total, label, fromCache, partIdx, partCount) => {
          const now = performance.now();
          if (!fromCache && received < total && now - lastReportAt < 180) return;
          lastReportAt = now;
          const pct = Math.max(25, Math.min(72, 24 + Math.round((received / (total || MODEL_SIZE)) * 48)));
          const msg = fromCache
            ? '已命中本机缓存（' + partIdx + '/' + partCount + '），秒速读取模型…'
            : '正在加载人像模型（分片 ' + partIdx + '/' + partCount + ' · ' + label + ' · ' + formatMB(received) + '/' + formatMB(total || MODEL_SIZE) + ' MB）…';
          self.postMessage({ id, type: 'progress', progress: pct, message: msg });
        }
      });
      modelBytes = assembled.bytes;
      modelFromCache = assembled.fromCache;
    } else {
      const legacy = await loader.fetchBytes(MODEL_LEGACY_PATH, {
        expectedSize: MODEL_SIZE,
        cacheTag: 'modnet-legacy-25888640',
        onProgress: (received, total, label, fromCache) => {
          const now = performance.now();
          if (!fromCache && received < total && now - lastReportAt < 180) return;
          lastReportAt = now;
          const pct = Math.max(25, Math.min(72, 24 + Math.round((received / (total || MODEL_SIZE)) * 48)));
          const msg = fromCache
            ? '已命中本机缓存，秒速读取模型…'
            : '正在加载本地人像模型（' + label + ' · ' + formatMB(received) + '/' + formatMB(total || MODEL_SIZE) + ' MB）…';
          self.postMessage({ id, type: 'progress', progress: pct, message: msg });
        }
      });
      modelBytes = legacy.bytes;
      modelFromCache = legacy.fromCache;
    }

    const initMsg = (wasmResult.fromCache && modelFromCache)
      ? '已命中本机永久缓存，正在初始化抠像引擎…'
      : '模型已缓存至本机（下次免下载），正在初始化抠像引擎…';
    self.postMessage({ id, type: 'progress', progress: 76, message: initMsg });
    return await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
  })().catch(error => {
    sessionPromise = undefined;
    throw error;
  });
  return sessionPromise;
}

self.onmessage = async ({ data }) => {
  const { id, width, height, pixels } = data;
  try {
    const session = await loadModel(id);
    self.postMessage({ id, type: 'progress', progress: 86, message: '正在识别人像与发丝边缘…' });
    const tensor = new ort.Tensor('float32', pixels, [1, 3, height, width]);
    const started = performance.now();
    const result = await session.run({ [session.inputNames[0]]: tensor });
    const output = result[session.outputNames[0]];
    const mask = new Float32Array(output.data);
    self.postMessage(
      { id, type: 'result', mask, inferenceMs: performance.now() - started, width: output.dims[3], height: output.dims[2] },
      [mask.buffer]
    );
    tensor.dispose();
    Object.values(result).forEach(t => t.dispose());
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error.message || String(error) });
  }
};
