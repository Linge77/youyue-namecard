/* 滑动图组以 fenced Markdown 保存，让文字编辑、草稿和模板切换共享同一份文章。 */
const HEADER = /^yy-gallery width=(\d{1,3}) height=(\d{1,3})(?: direction=vertical frameHeight=(\d{1,3}))?$/;
const TITLE = /^滑动图组（(\d{1,3})% · (\d{1,3})px(?: · 竖向(\d{1,3})px)?）$/;
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^\s]+)\)$/;
const RASTER = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i;

function normalizeOptions(options = {}) {
  const width = Math.round(Number(options.width) || 85);
  const height = Math.round(Number(options.height) || 0);
  const frameHeight = Math.round(Number(options.frameHeight) || 440);
  return {
    width: Math.max(45, Math.min(100, width)),
    height: height > 0 ? Math.max(100, Math.min(640, height)) : 0,
    direction: options.direction === 'vertical' ? 'vertical' : 'horizontal',
    frameHeight: Math.max(200, Math.min(800, frameHeight))
  };
}

function isSafeImage(src) {
  return typeof src === 'string' && (RASTER.test(src) || /^https?:\/\/[^\s<>"'`]+$/i.test(src));
}

function isImageReference(src) {
  return typeof src === 'string' && (/^yyimg:\/\/[a-z0-9-]{1,80}$/i.test(src) || isSafeImage(src));
}

export function galleryMarkdown(items, options) {
  const { width, height, direction, frameHeight } = normalizeOptions(options);
  const lines = items.filter(item => isImageReference(item.src)).map(item => {
    const alt = String(item.alt || '').replace(/[\[\]\\\n\r]/g, '').slice(0, 200);
    return `![${alt}](${item.src})`;
  });
  if (lines.length < (direction === 'vertical' ? 1 : 2)) {
    throw new Error(direction === 'vertical' ? '纵向滚动至少需要一张图片。' : '横向滑动至少需要两张图片。');
  }
  const vertical = direction === 'vertical' ? ` direction=vertical frameHeight=${frameHeight}` : '';
  return ['```yy-gallery', `yy-gallery width=${width} height=${height}${vertical}`, ...lines, '```'].join('\n');
}

function optionsFromMatch([, width, height, frameHeight]) {
  return normalizeOptions({ width, height, direction: frameHeight ? 'vertical' : 'horizontal', frameHeight });
}

function parseBody(body) {
  const [header, ...lines] = body.trim().split(/\r?\n/);
  const dimensions = HEADER.exec(header);
  if (!dimensions) return null;
  const options = optionsFromMatch(dimensions);
  if (lines.length < (options.direction === 'vertical' ? 1 : 2)) return null;
  const items = [];
  for (const line of lines) {
    const match = IMAGE_LINE.exec(line.trim());
    if (!match || !isImageReference(match[2])) return null;
    items.push({ src: match[2], alt: match[1] });
  }
  return { items, options };
}

export function galleryAtSelection(input) {
  const blocks = /^```yy-gallery[ \t]*\r?\n([\s\S]*?)^```[ \t]*(?=\r?$)/gm;
  for (const match of input.value.matchAll(blocks)) {
    const start = match.index;
    const end = start + match[0].length;
    if (input.selectionStart < start || input.selectionEnd > end) continue;
    const gallery = parseBody(match[1]);
    if (gallery) return { start, end, ...gallery };
  }
  return null;
}

function makeGallery(doc, gallery, resolveImage, { editorial, expanded }) {
  const { width, height, direction, frameHeight } = gallery.options;
  const vertical = direction === 'vertical';
  const reader = editorial && vertical;
  const open = expanded && vertical;
  const section = doc.createElement('section');
  section.title = `滑动图组（${width}% · ${height}px${vertical ? ` · 竖向${frameHeight}px` : ''}）`;
  section.setAttribute('data-pa-gallery', `${width},${height}${vertical ? `,vertical,${frameHeight}` : ''}`);
  section.style.cssText = reader
    ? 'margin:25px 0 29px;max-width:100%;box-sizing:border-box;border:1px solid #d8b7b2;background-color:#fff;'
    : 'margin:22px 0;padding:9px;max-width:100%;box-sizing:border-box;border:1px solid #dddde2;border-radius:9px;';
  if (reader) {
    const heading = doc.createElement('p');
    heading.textContent = '资料查阅';
    heading.style.cssText = 'margin:0;padding:13px 15px;background-color:#a41f29;color:#fff;font-size:14px;line-height:1.8;font-weight:600;';
    section.append(heading);
  }

  const scroller = doc.createElement('section');
  let scrollStyle = 'overflow-x:auto;overflow-y:hidden;white-space:nowrap;padding:2px 0 8px;scroll-snap-type:x proximity;';
  if (vertical) scrollStyle = open
    ? 'height:auto;overflow:visible;white-space:normal;'
    : `height:${frameHeight}px;overflow-x:hidden;overflow-y:auto;white-space:normal;`;
  const scrollHint = reader ? '上下滑动查阅完整内容' : vertical ? '上下滑动查看更多图片' : '左右滑动查看更多图片';
  if (!open) {
    scroller.tabIndex = 0;
    scroller.setAttribute('aria-label', `滑动图组，${scrollHint}`);
  }
  scroller.style.cssText = `display:block;max-width:100%;box-sizing:border-box;-webkit-overflow-scrolling:touch;${scrollStyle}${reader ? 'padding:10px 8px;background-color:#fff;' : ''}`;

  gallery.items.forEach((item, index) => {
    const card = doc.createElement('section');
    const gap = index + 1 < gallery.items.length ? (vertical ? 'margin-bottom:10px;' : 'margin-right:10px;') : '';
    card.style.cssText = vertical
      ? `display:block;width:100%;max-width:100%;box-sizing:border-box;${gap}`
      : `display:inline-block;width:${width}%;max-width:100%;vertical-align:top;white-space:normal;scroll-snap-align:start;box-sizing:border-box;${gap}`;
    const src = resolveImage(item.src);
    const missing = () => {
      const note = doc.createElement('span');
      note.textContent = '〔图片未加载〕';
      note.style.cssText = 'display:block;background-color:#f5f5f5;color:#666;text-align:center;padding:20px 8px;font-size:14px;';
      card.replaceChildren(note);
    };
    if (isSafeImage(src)) {
      const img = doc.createElement('img');
      img.alt = item.alt;
      img.referrerPolicy = 'no-referrer';
      img.style.cssText = `display:block;width:100%;max-width:100%;margin:0;border-radius:6px;${!vertical && height ? `height:${height}px;object-fit:contain;background-color:#f5f5f5;` : 'height:auto;'}`;
      img.addEventListener('error', missing, { once: true });
      img.src = src;
      card.append(img);
    } else missing();
    scroller.append(card);
  });

  section.append(scroller);
  if (!open) {
    const hint = doc.createElement('p');
    hint.textContent = scrollHint;
    hint.style.cssText = reader
      ? 'margin:0;padding:9px 12px;border-top:1px solid #dfd0c9;text-align:center;font-size:11px;line-height:1.8;color:#806b62;'
      : 'margin:3px 0 0;text-align:center;font-size:12px;line-height:1.5;color:#737886;';
    section.append(hint);
  }
  return section;
}

export function renderGalleries(root, resolveImage, { editorial = false, expanded = false } = {}) {
  for (const code of root.querySelectorAll('pre > code.language-yy-gallery')) {
    const gallery = parseBody(code.textContent);
    if (gallery) code.parentElement.replaceWith(makeGallery(root.ownerDocument, gallery, resolveImage, { editorial, expanded }));
  }
}

export function registerGalleryImport(converter) {
  converter.addRule('youyueGallery', {
    filter(node) {
      const dimensions = node.nodeName === 'SECTION' && TITLE.exec(node.getAttribute('title') || '');
      return Boolean(dimensions) &&
        [...node.querySelectorAll('img')].filter(img => isImageReference(img.getAttribute('src'))).length >= (dimensions[3] ? 1 : 2);
    },
    replacement(_content, node) {
      const options = optionsFromMatch(TITLE.exec(node.getAttribute('title')));
      const items = [...node.querySelectorAll('img')].map(img => ({ src: img.getAttribute('src'), alt: img.alt }));
      return '\n\n' + galleryMarkdown(items, options) + '\n\n';
    }
  });
}
