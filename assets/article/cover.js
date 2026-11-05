import {loadCoverFont} from './cover-fonts.js?v=20261104-7';

const WIDTH = 1296;
const HEIGHT = 382;
const SQUARE_X = 914;
const SQUARE_SIZE = 382;
const DEFAULT_TITLE = '少科院2+4调整';
const DEFAULT_TOP = '2+4';
const DEFAULT_BOTTOM = '调整';
const MAIN_TITLE = {x:42, y:181, width:642, height:88, size:112, center:false, blur:4};
const SHORT_TEXT = {x:1105, y:208.5, width:300, height:256, lineHeight:114, blur:3};
const get = name => document.getElementById('pa-cover-' + name);
let initialization;

function loadImage(name, width, height) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error('封面素材加载超时，请重新打开封面生成。')), 12000);
    image.onload = () => {
      clearTimeout(timer);
      if (image.naturalWidth !== width || image.naturalHeight !== height) {
        reject(new Error('封面素材尺寸不符，请检查更新包中的图片。'));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('封面素材读取失败，请确认封面图片已完整上传。'));
    };
    image.src = new URL('cover/' + name, import.meta.url).href;
  });
}

function measureLine(ctx, title, height, font) {
  ctx.font = `${font.weight} 100px "${font.family}"`;
  const metrics = ctx.measureText(title);
  const left = metrics.actualBoundingBoxLeft ?? 0;
  const right = metrics.actualBoundingBoxRight ?? metrics.width;
  const ascent = metrics.actualBoundingBoxAscent ?? 80;
  const descent = metrics.actualBoundingBoxDescent ?? 20;
  const scale = height / Math.max(1, ascent + descent);
  return {title, left, right, ascent, descent, scale, width:(left + right) * scale, height};
}

function drawLine(ctx, line, x, y, center, blur, font) {
  ctx.save();
  ctx.font = `${font.weight} 100px "${font.family}"`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(111, 16, 37, .46)';
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.shadowBlur = blur;
  ctx.translate(x, y);
  ctx.scale(line.scale, line.scale);
  ctx.fillText(line.title, center ? (line.left - line.right) / 2 : line.left, (line.ascent - line.descent) / 2);
  ctx.restore();
}

function drawMainTitle(ctx, title, scale, font) {
  if (!title) return;
  const line = measureLine(ctx, title, Math.min(148, MAIN_TITLE.height * scale / 100), font);
  const fit = Math.min(1, MAIN_TITLE.width / Math.max(1, line.width));
  line.scale *= fit;
  drawLine(ctx, line, MAIN_TITLE.x, MAIN_TITLE.y, false, MAIN_TITLE.blur, font);
}

function drawShortLines(ctx, top, bottom, topScale, bottomScale, gap, font) {
  const lines = [
    top && measureLine(ctx, top, SHORT_TEXT.lineHeight * topScale / 100, font),
    bottom && measureLine(ctx, bottom, SHORT_TEXT.lineHeight * bottomScale / 100, font)
  ].filter(Boolean);
  if (!lines.length) return;
  const spacing = lines.length === 2 ? gap : 0;
  const textHeight = lines.reduce((sum, line) => sum + line.height, 0);
  // Fit the two lines together, so identical scale values retain identical glyph
  // heights instead of silently using different per-line height limits.
  const fit = Math.min(1, (SHORT_TEXT.height - spacing) / textHeight, ...lines.map(line => SHORT_TEXT.width / Math.max(1, line.width)));
  let y = SHORT_TEXT.y - (textHeight * fit + spacing) / 2;
  for (const line of lines) {
    line.scale *= fit;
    drawLine(ctx, line, SHORT_TEXT.x, y + line.height * fit / 2, true, SHORT_TEXT.blur, font);
    y += line.height * fit + spacing;
  }
}

function copyRegion(ctx, image, x, y, width, height) {
  ctx.drawImage(image, x, y, width, height, x, y, width, height);
}

function readControl(field) {
  return Math.min(Number(field.max), Math.max(Number(field.min), Number(field.value)));
}

function makeCoverRenderer(canvas, assets) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器无法绘制封面图片。');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return ({title, top, bottom, titleScale = 100, topScale = 100, bottomScale = 100, gap = 18}, font) => {
    const originalWeight = font.weight === 900;
    const defaultTitle = originalWeight && title === DEFAULT_TITLE && titleScale === 100;
    const defaultRight = originalWeight && top === DEFAULT_TOP && bottom === DEFAULT_BOTTOM && topScale === 100 && bottomScale === 100 && gap === 18;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // The supplied result is kept pixel-for-pixel for unchanged sections.
    if (defaultTitle && defaultRight) {
      ctx.drawImage(assets.example, 0, 0);
      return;
    }
    copyRegion(ctx, defaultTitle ? assets.example : assets.background, 0, 0, SQUARE_X, HEIGHT);
    if (!defaultTitle) drawMainTitle(ctx, title, titleScale, font);

    if (defaultRight) {
      copyRegion(ctx, assets.example, SQUARE_X, 0, SQUARE_SIZE, HEIGHT);
      return;
    }
    ctx.drawImage(assets.rightBackground, SQUARE_X, 0);
    drawShortLines(ctx, top, bottom, topScale, bottomScale, gap, font);
  };
}

async function initializeCover() {
  const canvas = get('canvas');
  const mainField = get('title');
  const topField = get('short-top');
  const bottomField = get('short-bottom');
  const download = get('download');
  const status = get('status');
  const reset = get('reset');
  const weightField = get('weight');
  const fontStatus = get('font-status');
  const fontRetry = get('font-retry');
  const mainScale = get('title-scale');
  const topScale = get('top-scale');
  const bottomScale = get('bottom-scale');
  const lineGap = get('line-gap');
  const controls = [mainScale, topScale, bottomScale, lineGap];
  const fields = [mainField, topField, bottomField, ...controls];
  function updateControlLabels() {
    for (const field of controls) {
      get(field.id.replace('pa-cover-', '') + '-value').textContent = field.value + (field === lineGap ? ' px' : '%');
    }
  }
  const saveFallback = get('save-fallback');
  const saveLink = get('save-link');
  const saveImage = get('save-image');
  download.disabled = true;
  status.textContent = '正在加载封面素材…';
  let assets;
  try {
    const [background, example, rightBackground] = await Promise.all([
      loadImage('background.png', WIDTH, HEIGHT),
      loadImage('example.png', WIDTH, HEIGHT),
      loadImage('right-background.png', SQUARE_SIZE, SQUARE_SIZE)
    ]);
    assets = {background, example, rightBackground};
  } catch (error) {
    status.textContent = error.message;
    throw error;
  }

  const paint = makeCoverRenderer(canvas, assets);
  const values = () => ({
    title: mainField.value.trim(),
    top: topField.value.trim(),
    bottom: bottomField.value.trim(),
    titleScale: readControl(mainScale),
    topScale: readControl(topScale),
    bottomScale: readControl(bottomScale),
    gap: readControl(lineGap)
  });
  let frame = 0;
  let activeFont = null;
  let fontRequest = 0;
  const fontIsReady = () => activeFont && activeFont.weight === Number(weightField.value);

  function render() {
    frame = 0;
    if (fontIsReady()) paint(values(), activeFont);
  }
  function queueRender() {
    updateControlLabels();
    if (saveFallback && !saveFallback.hidden) {
      saveFallback.hidden = true;
      saveFallback.open = false;
      saveLink?.removeAttribute('href');
      saveImage?.removeAttribute('src');
      status.textContent = '预览已更新，可重新下载 PNG。';
    }
    if (!frame) frame = requestAnimationFrame(render);
  }
  async function selectFont() {
    const request = ++fontRequest;
    const weight = Number(weightField.value);
    download.disabled = true;
    canvas.setAttribute('aria-busy', 'true');
    fontRetry.hidden = true;
    fontStatus.textContent = '正在加载所选字重，首次加载可能需要几秒…';
    if (saveFallback) {
      saveFallback.hidden = true;
      saveFallback.open = false;
    }
    try {
      const font = await loadCoverFont(weight);
      if (request !== fontRequest) return;
      activeFont = font;
      render();
      download.disabled = false;
      fontStatus.textContent = '已就绪 · 阿里巴巴普惠体 ' + font.label;
    } catch (error) {
      if (request !== fontRequest) return;
      fontStatus.textContent = error.message;
      fontRetry.hidden = false;
    } finally {
      if (request === fontRequest) canvas.setAttribute('aria-busy', 'false');
    }
  }
  weightField.addEventListener('change', selectFont);
  fontRetry.addEventListener('click', selectFont);
  for (const input of fields) input.addEventListener('input', queueRender);
  for (const button of document.querySelectorAll('[data-cover-step]')) {
    button.addEventListener('click', () => {
      const field = get(button.dataset.coverStep);
      field.value = String(Math.min(Number(field.max), Math.max(Number(field.min), Number(field.value) + Number(button.dataset.step))));
      queueRender();
    });
  }
  reset?.addEventListener('click', () => {
    mainField.value = DEFAULT_TITLE;
    topField.value = DEFAULT_TOP;
    bottomField.value = DEFAULT_BOTTOM;
    for (const field of controls) field.value = field.defaultValue;
    weightField.value = '900';
    selectFont();
    queueRender();
    status.textContent = '已恢复示例标题。';
  });
  download.addEventListener('click', () => {
    if (!fontIsReady() || download.disabled) return;
    if (frame) cancelAnimationFrame(frame);
    render();
    try {
      const name = values().title.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '').trim() || '新媒体';
      const link = document.createElement('a');
      link.download = name + '_封面_1296×382.png';
      link.href = canvas.toDataURL('image/png');
      if (saveFallback && saveLink && saveImage) {
        saveLink.download = link.download;
        saveLink.href = link.href;
        saveImage.src = link.href;
        saveFallback.hidden = false;
        saveFallback.open = true;
      }
      document.body.append(link);
      try {
        link.click();
      } catch (error) {
        if (!saveFallback || saveFallback.hidden) throw error;
      } finally {
        link.remove();
      }
      status.textContent = 'PNG 已生成，尺寸为 1296 × 382 px。';
    } catch {
      status.textContent = '图片导出失败，请刷新后重试。';
    }
  });
  status.textContent = '编辑文字即可更新预览。';
  await selectFont();
}

export function activateCover() {
  if (!initialization) {
    initialization = initializeCover().catch(error => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

