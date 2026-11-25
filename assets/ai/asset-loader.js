/* 优悦教育静态资源多源加速 + 浏览器永久本地缓存加载器
   同时支持主页面 (window) 与 Web Worker (portrait-worker / repair-worker)。
   所有文件仅从静态源读取并缓存在本机浏览器，不上传任何用户图片或数据。 */
(function (root) {
  'use strict';

  // =========================================================================
  // 【国内云加速预留配置位】
  // 如后续开通阿里云 OSS / 腾讯云 COS / 自建国内 CDN，把存放本仓库文件的根目录
  // 填到下方即可立即切为 100% 国内直连（注意末尾保留斜杠 /，并开启 CORS 跨域）：
  // 示例：var CUSTOM_CDN_BASE = 'https://your-bucket.oss-cn-guangzhou.aliyuncs.com/youyue-namecard/';
  // 留空 '' 时，默认自动使用多路免费 CDN（fastly / gcore / cdn.jsdelivr）+ 源站兜底。
  // =========================================================================
  var CUSTOM_CDN_BASE = '';

  var CACHE_NAME = 'youyue-static-assets-v1';
  var JSDELIVR_REPO = 'Linge77/youyue-namecard@main';
  var JSDELIVR_MIRRORS = [
    { label: '加速节点 1', base: 'https://fastly.jsdelivr.net/gh/' + JSDELIVR_REPO + '/' },
    { label: '加速节点 2', base: 'https://gcore.jsdelivr.net/gh/' + JSDELIVR_REPO + '/' },
    { label: '加速节点 3', base: 'https://cdn.jsdelivr.net/gh/' + JSDELIVR_REPO + '/' }
  ];

  var preferredBase = '';

  function normalizeBase(url) {
    if (!url || typeof url !== 'string') return '';
    var trimmed = url.trim();
    if (!trimmed) return '';
    return trimmed.endsWith('/') ? trimmed : (trimmed + '/');
  }

  function detectSiteBase() {
    var href = (typeof location !== 'undefined' && location.href) ? location.href : '';
    if (!href) return '';
    var idx = href.indexOf('/assets/');
    if (idx >= 0) return href.slice(0, idx + 1);
    try {
      return new URL('./', href).href;
    } catch (_) {
      return '';
    }
  }

  function isLocalOrDomesticHost() {
    if (typeof location === 'undefined' || !location.hostname) return true;
    var host = location.hostname.toLowerCase();
    if (location.protocol === 'file:') return true;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return true;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return true;
    // 如果将来整站迁到国内静态托管/自定义域名，非 github.io 域名默认优先走同源
    if (!host.endsWith('.github.io') && host !== 'github.io') return true;
    return false;
  }

  function getConfiguredCustomBase() {
    var runtime = normalizeBase(root.YOUYUE_ASSET_CDN_BASE || '');
    if (runtime) return runtime;
    try {
      if (typeof localStorage !== 'undefined') {
        var saved = normalizeBase(localStorage.getItem('youyue_asset_cdn_base') || '');
        if (saved) return saved;
      }
    } catch (_) {}
    return normalizeBase(CUSTOM_CDN_BASE);
  }

  function normalizeRelativePath(relPath) {
    return String(relPath || '').replace(/^\/+/, '');
  }

  function getMirrors() {
    var siteBase = detectSiteBase();
    var customBase = getConfiguredCustomBase();
    var list = [];
    var seen = Object.create(null);

    function add(label, base) {
      var normalized = normalizeBase(base);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      list.push({ label: label, base: normalized });
    }

    if (customBase) add('国内直连节点', customBase);

    if (isLocalOrDomesticHost()) {
      add('本站源站', siteBase);
      for (var i = 0; i < JSDELIVR_MIRRORS.length; i++) {
        add(JSDELIVR_MIRRORS[i].label, JSDELIVR_MIRRORS[i].base);
      }
    } else {
      for (var j = 0; j < JSDELIVR_MIRRORS.length; j++) {
        add(JSDELIVR_MIRRORS[j].label, JSDELIVR_MIRRORS[j].base);
      }
      add('源站兜底', siteBase);
    }

    // 把本会话已验证连通最快的节点提前到首位
    if (preferredBase && list.length > 1) {
      var idx = list.findIndex(function (item) { return item.base === preferredBase; });
      if (idx > 0) {
        var winner = list.splice(idx, 1)[0];
        list.unshift(winner);
      }
    }

    return list;
  }

  function buildCacheKey(relPath, cacheTag) {
    var siteBase = detectSiteBase() || 'https://youyue-local.invalid/';
    var clean = normalizeRelativePath(relPath);
    var suffix = cacheTag ? ('?tag=' + encodeURIComponent(String(cacheTag))) : '';
    try {
      return new URL(clean + suffix, siteBase).href;
    } catch (_) {
      return siteBase + clean + suffix;
    }
  }

  async function openAssetCache() {
    try {
      if (typeof caches !== 'undefined' && caches && typeof caches.open === 'function') {
        return await caches.open(CACHE_NAME);
      }
    } catch (_) {}
    return null;
  }

  async function readFromCache(cacheKey, expectedSize) {
    var cache = await openAssetCache();
    if (!cache) return null;
    try {
      var match = await cache.match(cacheKey);
      if (!match) return null;
      var buf = await match.arrayBuffer();
      if (expectedSize && buf.byteLength !== expectedSize) {
        await cache.delete(cacheKey).catch(function () {});
        return null;
      }
      return {
        bytes: new Uint8Array(buf),
        contentType: match.headers.get('Content-Type') || 'application/octet-stream'
      };
    } catch (_) {
      return null;
    }
  }

  async function writeToCache(cacheKey, bytes, contentType) {
    var cache = await openAssetCache();
    if (!cache) return;
    try {
      var headers = {
        'Content-Type': contentType || 'application/octet-stream',
        'X-Youyue-Cached-At': String(Date.now()),
        'X-Youyue-Bytes': String(bytes.byteLength)
      };
      // 复制独立副本存入缓存，避免调用方后续转移 buffer 导致问题
      var copy = bytes.slice();
      await cache.put(cacheKey, new Response(copy, { status: 200, headers: headers }));
    } catch (_) {}
  }

  async function deleteFromCache(cacheKey) {
    var cache = await openAssetCache();
    if (!cache) return;
    try {
      await cache.delete(cacheKey);
    } catch (_) {}
  }

  async function fetchSingleAttempt(url, options) {
    var connectTimeoutMs = options.connectTimeoutMs || 9000;
    var stallTimeoutMs = options.stallTimeoutMs || 16000;
    var expectedSize = options.expectedSize || 0;
    var onProgress = options.onProgress;
    var label = options.label || '';

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var connectTimer = 0;
    var stallTimer = 0;
    var abortedReason = '';

    function abortWith(reason) {
      abortedReason = reason;
      if (controller) {
        try { controller.abort(); } catch (_) {}
      }
    }

    function resetStallTimer() {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(function () {
        abortWith('传输停滞超时');
      }, stallTimeoutMs);
    }

    try {
      connectTimer = setTimeout(function () {
        abortWith('节点连接超时');
      }, connectTimeoutMs);

      var fetchInit = {
        mode: 'cors',
        credentials: 'omit',
        cache: 'default'
      };
      // 同源地址使用 same-origin 以避免局部预览或代理环境跨域限制
      if (typeof location !== 'undefined' && url.indexOf(location.origin) === 0) {
        fetchInit.mode = 'same-origin';
        fetchInit.credentials = 'same-origin';
      }
      if (controller) fetchInit.signal = controller.signal;

      var response = await fetch(url, fetchInit);
      clearTimeout(connectTimer);
      connectTimer = 0;

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      var contentType = response.headers.get('Content-Type') || 'application/octet-stream';
      var headerLen = Number(response.headers.get('Content-Length')) || 0;
      var total = expectedSize || headerLen;

      if (response.body && typeof response.body.getReader === 'function') {
        var reader = response.body.getReader();
        var chunks = [];
        var received = 0;
        resetStallTimer();
        while (true) {
          var step = await reader.read();
          if (step.done) break;
          resetStallTimer();
          var value = step.value;
          if (value && value.byteLength) {
            chunks.push(value);
            received += value.byteLength;
            if (expectedSize && received > expectedSize) {
              try { await reader.cancel(); } catch (_) {}
              throw new Error('文件体积超出预期');
            }
            if (onProgress) onProgress(received, total || received, label, false);
          }
        }
        if (stallTimer) { clearTimeout(stallTimer); stallTimer = 0; }
        if (expectedSize && received !== expectedSize) {
          throw new Error('文件下载不完整（' + received + '/' + expectedSize + '）');
        }
        var merged = new Uint8Array(received);
        var offset = 0;
        for (var i = 0; i < chunks.length; i++) {
          merged.set(chunks[i], offset);
          offset += chunks[i].byteLength;
        }
        return { bytes: merged, contentType: contentType };
      }

      resetStallTimer();
      var buffer = await response.arrayBuffer();
      if (stallTimer) { clearTimeout(stallTimer); stallTimer = 0; }
      var bytes = new Uint8Array(buffer);
      if (expectedSize && bytes.byteLength !== expectedSize) {
        throw new Error('文件下载不完整（' + bytes.byteLength + '/' + expectedSize + '）');
      }
      if (onProgress) onProgress(bytes.byteLength, total || bytes.byteLength, label, false);
      return { bytes: bytes, contentType: contentType };
    } catch (error) {
      if (abortedReason) throw new Error(abortedReason);
      throw error;
    } finally {
      if (connectTimer) clearTimeout(connectTimer);
      if (stallTimer) clearTimeout(stallTimer);
    }
  }

  async function fetchBytes(relPath, options) {
    options = options || {};
    var cleanPath = normalizeRelativePath(relPath);
    var expectedSize = options.expectedSize || 0;
    var useCache = options.cache !== false;
    var cacheKey = buildCacheKey(cleanPath, options.cacheTag || (expectedSize ? ('sz-' + expectedSize) : ''));

    if (useCache) {
      var cached = await readFromCache(cacheKey, expectedSize);
      if (cached) {
        if (options.onProgress) {
          options.onProgress(cached.bytes.byteLength, expectedSize || cached.bytes.byteLength, '本机缓存', true);
        }
        return { bytes: cached.bytes, contentType: cached.contentType, fromCache: true, sourceLabel: '本机缓存' };
      }
    }

    var mirrors = getMirrors();
    var lastError = null;

    for (var i = 0; i < mirrors.length; i++) {
      var mirror = mirrors[i];
      var url = mirror.base + cleanPath;
      try {
        var result = await fetchSingleAttempt(url, {
          connectTimeoutMs: options.connectTimeoutMs || (mirror.label === '源站兜底' ? 14000 : 9000),
          stallTimeoutMs: options.stallTimeoutMs || 16000,
          expectedSize: expectedSize,
          label: mirror.label,
          onProgress: options.onProgress
        });
        preferredBase = mirror.base;
        if (useCache) {
          await writeToCache(cacheKey, result.bytes, options.contentType || result.contentType);
        }
        return { bytes: result.bytes, contentType: result.contentType, fromCache: false, sourceLabel: mirror.label };
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error('资源加载失败（' + cleanPath + '）：' + (lastError && lastError.message ? lastError.message : '网络不可用'));
  }

  async function fetchJson(relPath, options) {
    var result = await fetchBytes(relPath, Object.assign({ cache: false, connectTimeoutMs: 8000, stallTimeoutMs: 10000 }, options || {}));
    var text = new TextDecoder('utf-8').decode(result.bytes);
    return JSON.parse(text);
  }

  async function fetchBlobUrl(relPath, options) {
    var result = await fetchBytes(relPath, options || {});
    var blob = new Blob([result.bytes], { type: (options && options.contentType) || result.contentType || 'application/octet-stream' });
    return { url: URL.createObjectURL(blob), fromCache: result.fromCache, sourceLabel: result.sourceLabel };
  }

  async function sha256Hex(bytes) {
    if (typeof crypto === 'undefined' || !crypto || !crypto.subtle) return '';
    var digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), function (v) {
      return v.toString(16).padStart(2, '0');
    }).join('');
  }

  async function fetchChunked(baseDir, manifest, options) {
    options = options || {};
    var cleanDir = normalizeRelativePath(baseDir);
    if (cleanDir && !cleanDir.endsWith('/')) cleanDir += '/';

    if (!manifest || !Array.isArray(manifest.parts) || !manifest.parts.length || !Number.isInteger(manifest.size) || manifest.size <= 0) {
      throw new Error('模型清单格式无效。');
    }

    var totalSize = manifest.size;
    var model = new Uint8Array(totalSize);
    var completedBytes = 0;
    var allFromCache = true;
    var usedKeys = [];

    for (var i = 0; i < manifest.parts.length; i++) {
      var part = manifest.parts[i];
      if (!part || !part.file || !/^[a-zA-Z0-9_.-]+$/.test(part.file) || !Number.isInteger(part.size) || part.size <= 0) {
        throw new Error('模型分片信息无效。');
      }
      var partPath = cleanDir + part.file;
      var partTag = 'sz-' + part.size + (manifest.sha256 ? ('-' + manifest.sha256.slice(0, 8)) : '');
      usedKeys.push(buildCacheKey(partPath, partTag));

      var partResult = await fetchBytes(partPath, {
        expectedSize: part.size,
        cacheTag: partTag,
        connectTimeoutMs: options.connectTimeoutMs || 9000,
        stallTimeoutMs: options.stallTimeoutMs || 18000,
        onProgress: function (partReceived, partTotal, label, fromCache) {
          if (options.onProgress) {
            options.onProgress(completedBytes + partReceived, totalSize, label, fromCache, i + 1, manifest.parts.length);
          }
        }
      });

      if (!partResult.fromCache) allFromCache = false;
      if (completedBytes + partResult.bytes.byteLength > totalSize) {
        throw new Error('模型分片总大小异常。');
      }
      model.set(partResult.bytes, completedBytes);
      completedBytes += partResult.bytes.byteLength;
    }

    if (completedBytes !== totalSize) {
      throw new Error('模型文件未拼接完整。');
    }

    if (manifest.sha256) {
      var actualHash = await sha256Hex(model);
      if (actualHash && actualHash !== manifest.sha256) {
        for (var k = 0; k < usedKeys.length; k++) {
          await deleteFromCache(usedKeys[k]);
        }
        throw new Error('模型完整性校验失败，已自动清理损坏缓存，请点击重试。');
      }
    }

    return { bytes: model, fromCache: allFromCache };
  }

  async function clearCache() {
    try {
      if (typeof caches !== 'undefined' && caches && typeof caches.delete === 'function') {
        await caches.delete(CACHE_NAME);
      }
    } catch (_) {}
  }

  root.YouyueAssetLoader = {
    CACHE_NAME: CACHE_NAME,
    getMirrors: getMirrors,
    fetchBytes: fetchBytes,
    fetchJson: fetchJson,
    fetchBlobUrl: fetchBlobUrl,
    fetchChunked: fetchChunked,
    clearCache: clearCache
  };
})(typeof self !== 'undefined' ? self : window);
