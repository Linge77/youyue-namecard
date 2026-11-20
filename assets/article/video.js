/* Youyue Media Studio: Video watermark-free extraction panel */

// 默认使用已部署好的 Vercel 云端解析服务，全员打开网页即可直接使用：
const DEFAULT_CLOUD_API_BASE = 'https://youyue-video-api.vercel.app';
const STORAGE_KEY = 'youyue_video_api_base';

const get = name => document.getElementById('pa-video-' + name);

let bound = false;
let currentVideoUrl = '';

function isLocalHost() {
  const host = window.location.hostname;
  return window.location.protocol === 'file:' || host === '127.0.0.1' || host === 'localhost';
}

function getApiBase() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  } catch (e) {}
  if (DEFAULT_CLOUD_API_BASE) return DEFAULT_CLOUD_API_BASE.replace(/\/+$/, '');
  if (isLocalHost()) return 'http://127.0.0.1:8000';
  return 'http://127.0.0.1:8000';
}

function setApiBase(val) {
  const clean = (val || '').trim().replace(/\/+$/, '');
  try {
    if (clean) window.localStorage.setItem(STORAGE_KEY, clean);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function showStatus(msg, type = 'info') {
  const el = get('status');
  if (!el) return;
  el.hidden = false;
  el.className = 'pa-video-alert' + (type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : '');
  el.textContent = msg;
}

function hideStatus() {
  const el = get('status');
  if (el) el.hidden = true;
}

function setLoading(loading) {
  const btn = get('submit');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span>⏳</span> 正在解析提取中…'
    : '<span>⚡</span> 一键解析提取';
}

function resetPreview() {
  const player = get('player');
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.removeAttribute('poster');
    player.load();
  }
  const empty = get('empty');
  const videoWrap = get('player-wrap');
  const gallery = get('gallery');
  const actions = get('actions');
  const meta = get('meta');
  const titleEl = get('result-title');

  if (empty) empty.hidden = false;
  if (videoWrap) videoWrap.hidden = true;
  if (gallery) {
    gallery.hidden = true;
    gallery.innerHTML = '';
  }
  if (actions) actions.hidden = true;
  if (meta) meta.textContent = '等待解析';
  if (titleEl) {
    titleEl.hidden = true;
    titleEl.textContent = '';
  }
  currentVideoUrl = '';
}

function renderResult(data, apiBase) {
  const empty = get('empty');
  const videoWrap = get('player-wrap');
  const player = get('player');
  const gallery = get('gallery');
  const actions = get('actions');
  const meta = get('meta');
  const titleEl = get('result-title');
  const downloadBtn = get('download');
  const copyBtn = get('copy-url');

  if (empty) empty.hidden = true;
  if (meta) {
    const authorText = data.author ? ` · ${data.author}` : '';
    meta.textContent = `${data.platform_name || '视频'}${authorText}`;
  }
  if (titleEl) {
    titleEl.hidden = false;
    titleEl.textContent = data.title || '无标题作品';
  }

  if (data.tip) {
    showStatus(data.tip, 'info');
  } else {
    showStatus('解析成功！可直接在右侧预览或下载无水印原文件。', 'success');
  }

  currentVideoUrl = data.video_url || '';

  if (data.is_video && data.video_url) {
    if (gallery) gallery.hidden = true;
    if (videoWrap) videoWrap.hidden = false;
    if (player) {
      player.src = data.video_url;
      if (data.cover_url) player.poster = data.cover_url;
      player.load();
    }
    if (actions) actions.hidden = false;
    if (downloadBtn) {
      const dlUrl = data.download_url ? `${apiBase}${data.download_url}` : data.video_url;
      downloadBtn.href = dlUrl;
      downloadBtn.hidden = false;
    }
    if (copyBtn) copyBtn.hidden = false;
  } else if (data.images && data.images.length > 0) {
    if (videoWrap) videoWrap.hidden = true;
    if (player) {
      player.pause();
      player.removeAttribute('src');
    }
    if (gallery) {
      gallery.hidden = false;
      gallery.innerHTML = '';
      data.images.forEach((imgUrl, index) => {
        const card = document.createElement('div');
        card.className = 'pa-video-gallery-item';
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = `图集第 ${index + 1} 张`;
        img.loading = 'lazy';
        const link = document.createElement('a');
        link.href = imgUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '查看原图';
        card.appendChild(img);
        card.appendChild(link);
        gallery.appendChild(card);
      });
    }
    if (actions) actions.hidden = true;
  }
}

async function handleExtract() {
  const input = get('input');
  const content = input ? input.value.trim() : '';
  if (!content) {
    showStatus('请先在输入框中粘贴抖音或小红书的分享文案 / 链接。', 'error');
    if (input) input.focus();
    return;
  }

  hideStatus();
  setLoading(true);
  const apiBase = getApiBase();

  try {
    const response = await fetch(`${apiBase}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      resetPreview();
      const extraTip = data.tip ? `\n\n${data.tip}` : '';
      showStatus((data.error_msg || data.detail || '解析失败，请检查链接是否有效。') + extraTip, 'error');
      return;
    }

    renderResult(data, apiBase);
  } catch (err) {
    resetPreview();
    showStatus(`连接解析服务失败：${err.message}\n当前解析接口（${apiBase}）暂时无法连通，请检查网络连接或在下方「解析服务接口设置」中确认接口地址。`, 'error');
  } finally {
    setLoading(false);
  }
}

function bindEvents() {
  if (bound) return;
  bound = true;

  const input = get('input');
  const pasteBtn = get('paste');
  const clearBtn = get('clear');
  const submitBtn = get('submit');
  const copyBtn = get('copy-url');
  const apiInput = get('api-input');
  const apiSave = get('api-save');
  const apiReset = get('api-reset');

  if (apiInput) {
    apiInput.value = getApiBase();
  }

  if (apiSave) {
    apiSave.addEventListener('click', () => {
      const val = apiInput ? apiInput.value : '';
      setApiBase(val);
      if (apiInput) apiInput.value = getApiBase();
      showStatus(`解析服务地址已保存为：${getApiBase()}`, 'success');
    });
  }

  if (apiReset) {
    apiReset.addEventListener('click', () => {
      setApiBase('');
      if (apiInput) apiInput.value = getApiBase();
      showStatus(`已恢复默认解析服务地址：${getApiBase()}`, 'info');
    });
  }

  if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && input) {
          input.value = text;
          showStatus('已从剪贴板粘贴内容，点击下方按钮即可解析。', 'info');
        } else {
          showStatus('剪贴板中暂无文本内容。', 'info');
        }
      } catch (e) {
        showStatus('浏览器未授予剪贴板读取权限，请在输入框内按 Ctrl+V / Command+V 手动粘贴。', 'error');
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) {
        input.value = '';
        input.focus();
      }
      hideStatus();
      resetPreview();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', handleExtract);
  }

  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleExtract();
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!currentVideoUrl) return;
      try {
        await navigator.clipboard.writeText(currentVideoUrl);
        showStatus('无水印视频直链已复制到剪贴板！', 'success');
      } catch (e) {
        const temp = document.createElement('input');
        temp.value = currentVideoUrl;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showStatus('无水印视频直链已复制到剪贴板！', 'success');
      }
    });
  }
}

export function activateVideo() {
  bindEvents();
  return Promise.resolve();
}
