import {loadCoverFont} from './cover-fonts.js?v=20261104-7';

const WIDTH = 1296;
const HEIGHT = 382;
const SQUARE_X = 914;
const SQUARE_SIZE = 382;
const DEFAULT_TITLE = '少科院2+4调整';
const DEFAULT_TOP = '2+4';
const DEFAULT_BOTTOM = '调整';
const MAIN_TITLE = {x:42, y:181, width:642, height:88, size:112, center:false, blur:4};
const SHORT_TOP = {x:1105, y:143, width:300, height:86, size:122, center:true, blur:3};
const SHORT_BOTTOM = {x:1105, y:274, width:300, height:114, size:138, center:true, blur:3};
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

function drawText(ctx, title, area, requestedSize, font) {
  if (!title) return;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let size = requestedSize ?? area.size;
  let left, right, ascent, descent;
  for (;;) {
    ctx.font = `${font.weight} ${size}px "${font.family}"`;
    const metrics = ctx.measureText(title);
    left = metrics.actualBoundingBoxLeft ?? 0;
    right = metrics.actualBoundingBoxRight ?? metrics.width;
    ascent = metrics.actualBoundingBoxAscent ?? size * .8;
    descent = metrics.actualBoundingBoxDescent ?? size * .2;
    const fit = Math.min(1, area.width / Math.max(1, left + right), area.height / Math.max(1, ascent + descent));
    if (fit >= 1 || size <= 1) break;
    size = Math.max(1, Math.floor(size * fit));
  }
  const x = area.center ? area.x + (left - right) / 2 : area.x + left;
  const y = area.y + (ascent - descent) / 2;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(111, 16, 37, .46)';
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.shadowBlur = area.blur;
  ctx.fillText(title, x, y);
  ctx.restore();
}

function copyRegion(ctx, image, x, y, width, height) {
  ctx.drawImage(image, x, y, width, height, x, y, width, height);
}

function readSize(field) {
  if (!field?.value) return null;
  const size = Number(field.value);
  return Number.isFinite(size) ? Math.min(180, Math.max(12, Math.round(size))) : null;
}

function makeCoverRenderer(canvas, assets) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器无法绘制封面图片。');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return ({title, top, bottom, titleSize = null, topSize = null, bottomSize = null}, font) => {
    const originalWeight = font.weight === 900;
    const defaultTitle = originalWeight && title === DEFAULT_TITLE && titleSize === null;
    const defaultTop = originalWeight && top === DEFAULT_TOP && topSize === null;
    const defaultBottom = originalWeight && bottom === DEFAULT_BOTTOM && bottomSize === null;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // The supplied result is kept pixel-for-pixel for unchanged sections.
    if (defaultTitle && defaultTop && defaultBottom) {
      ctx.drawImage(assets.example, 0, 0);
      return;
    }
    copyRegion(ctx, defaultTitle ? assets.example : assets.background, 0, 0, SQUARE_X, HEIGHT);
    if (!defaultTitle) drawText(ctx, title, MAIN_TITLE, titleSize, font);

    if (defaultTop && defaultBottom) {
      copyRegion(ctx, assets.example, SQUARE_X, 0, SQUARE_SIZE, HEIGHT);
      return;
    }
    ctx.drawImage(assets.rightBackground, SQUARE_X, 0);
    if (defaultTop) {
      ctx.drawImage(assets.rightText, 0, 0, 242, 106, 983, 99, 242, 106);
    } else {
      drawText(ctx, top, SHORT_TOP, topSize, font);
    }
    if (defaultBottom) {
      ctx.drawImage(assets.rightText, 0, 106, 242, 138, 983, 205, 242, 138);
    } else {
      drawText(ctx, bottom, SHORT_BOTTOM, bottomSize, font);
    }
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
  const mainSize = get('title-size');
  const topSize = get('short-top-size');
  const bottomSize = get('short-bottom-size');
  const sizeFields = [mainSize, topSize, bottomSize].filter(Boolean);
  const fields = [mainField, topField, bottomField, ...sizeFields];
  const saveFallback = get('save-fallback');
  const saveLink = get('save-link');
  const saveImage = get('save-image');
  download.disabled = true;
  status.textContent = '正在加载封面素材…';
  let assets;
  try {
    const [background, example, rightBackground, rightText] = await Promise.all([
      loadImage('background.png', WIDTH, HEIGHT),
      loadImage('example.png', WIDTH, HEIGHT),
      loadImage('right-background.png', SQUARE_SIZE, SQUARE_SIZE),
      loadImage('right-text.png', 242, 244)
    ]);
    assets = {background, example, rightBackground, rightText};
  } catch (error) {
    status.textContent = error.message;
    throw error;
  }

  const paint = makeCoverRenderer(canvas, assets);
  const values = () => ({
    title: mainField.value.trim(),
    top: topField.value.trim(),
    bottom: bottomField.value.trim(),
    titleSize: readSize(mainSize),
    topSize: readSize(topSize),
    bottomSize: readSize(bottomSize)
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
  reset?.addEventListener('click', () => {
    mainField.value = DEFAULT_TITLE;
    topField.value = DEFAULT_TOP;
    bottomField.value = DEFAULT_BOTTOM;
    for (const field of sizeFields) field.value = '';
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

