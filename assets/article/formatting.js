// Store formatting as narrowly defined Markdown tokens so drafts need no extra fields.
const TEXT_CLOSE = '{{/文字}}';
const TEXT_START = /^\{\{文字:([\d]*),(#[\da-f]{6})?\}\}/i;
const TEXT_RANGE = /\{\{文字:([\d]*),(#[\da-f]{6})?\}\}([^\r\n]*?)\{\{\/文字\}\}/gi;
const SUBTITLE_START = /^\{\{副标题:(\d+),(\d+),(\d+),(\d+),(left|center|right)\}\}[ \t]+/;
const SUBTITLE_DEFAULT = {size: 20, width: 100, paddingY: 10, paddingX: 16, align: 'left'};

function inRange(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

function textOptions(size, color) {
  return {
    size: inRange(size, 10, 72) ? String(Number(size)) : '',
    color: /^#[\da-f]{6}$/i.test(color || '') ? color.toLowerCase() : ''
  };
}

function subtitleOptions(size, width, paddingY, paddingX, align) {
  if (!inRange(size, 12, 64) || !inRange(width, 20, 100) ||
      !inRange(paddingY, 0, 40) || !inRange(paddingX, 0, 56) ||
      !['left', 'center', 'right'].includes(align)) return null;
  return {size: Number(size), width: Number(width), paddingY: Number(paddingY), paddingX: Number(paddingX), align};
}

function subtitleValues(options) {
  return [options.size, options.width, options.paddingY, options.paddingX, options.align];
}

export function installFormatting(markdown) {
  markdown.inline.ruler.before('emphasis', 'pa_text_format', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 123) return false;
    const match = TEXT_START.exec(state.src.slice(state.pos, state.posMax));
    if (!match) return false;

    const innerStart = state.pos + match[0].length;
    const innerEnd = state.src.indexOf(TEXT_CLOSE, innerStart);
    if (innerEnd <= innerStart || innerEnd + TEXT_CLOSE.length > state.posMax) return false;
    const content = state.src.slice(innerStart, innerEnd);
    if (/[\r\n]/.test(content) || content.includes('{{文字:')) return false;
    const options = textOptions(match[1], match[2]);
    if (!options.size && !options.color) return false;

    if (!silent) {
      const opening = state.push('pa_text_open', 'span', 1);
      opening.attrSet('data-pa-text', [options.size, options.color].join(','));
      const children = [];
      state.md.inline.parse(content, state.md, state.env, children);
      for (const token of children) {
        token.level += state.level;
        state.tokens.push(token);
        state.tokens_meta.push(null);
      }
      state.push('pa_text_close', 'span', -1);
    }
    state.pos = innerEnd + TEXT_CLOSE.length;
    return true;
  });

  markdown.core.ruler.before('inline', 'pa_subtitle_format', state => {
    state.tokens.forEach((opening, index) => {
      if (opening.type !== 'heading_open' || opening.tag !== 'h2') return;
      const inline = state.tokens[index + 1];
      const match = SUBTITLE_START.exec(inline.content);
      const options = match && subtitleOptions(...match.slice(1));
      if (!options) return;
      inline.content = inline.content.slice(match[0].length);
      opening.attrSet('data-pa-subtitle', subtitleValues(options).join(','));
    });
  });
}

export function renderFormatting(root) {
  for (const node of root.querySelectorAll('h2[data-pa-subtitle]')) {
    const options = subtitleOptions(...node.getAttribute('data-pa-subtitle').split(','));
    if (!options) continue;
    node.style.setProperty('display', 'block');
    node.style.setProperty('box-sizing', 'border-box');
    node.style.setProperty('width', options.width + '%');
    node.style.setProperty('max-width', '100%');
    node.style.setProperty('min-width', '0');
    node.style.setProperty('font-size', options.size + 'px');
    node.style.setProperty('padding', options.paddingY + 'px ' + options.paddingX + 'px');
    node.style.setProperty('margin-left', options.align === 'left' ? '0' : 'auto');
    node.style.setProperty('margin-right', options.align === 'right' ? '0' : 'auto');
  }
  for (const node of root.querySelectorAll('span[data-pa-text]')) {
    const options = textOptions(...node.getAttribute('data-pa-text').split(','));
    if (options.size) {
      node.style.setProperty('font-size', options.size + 'px', 'important');
      node.querySelectorAll('*').forEach(child => child.style.setProperty('font-size', 'inherit', 'important'));
    }
    if (options.color) {
      node.style.setProperty('color', options.color, 'important');
      node.querySelectorAll('*').forEach(child => child.style.setProperty('color', 'inherit', 'important'));
    }
  }
}

function currentLine(input) {
  const {value, selectionStart, selectionEnd} = input;
  const start = selectionStart === 0 ? 0 : value.lastIndexOf('\n', selectionStart - 1) + 1;
  const newline = value.indexOf('\n', selectionStart);
  const end = newline < 0 ? value.length : newline;
  return {start, end, value: value.slice(start, end), single: selectionEnd <= end};
}

function textRuns(line) {
  if (!line.single) return [];
  return [...line.value.matchAll(TEXT_RANGE)].map(match => {
    const start = line.start + match.index;
    const end = start + match[0].length;
    const contentEnd = end - TEXT_CLOSE.length;
    const contentStart = contentEnd - match[3].length;
    return {start, end, contentStart, contentEnd, content: match[3], options: textOptions(match[1], match[2])};
  });
}

function selectedTextRun(input, runs = textRuns(currentLine(input))) {
  return runs.find(run => (input.selectionStart >= run.contentStart && input.selectionEnd <= run.contentEnd) ||
    (input.selectionStart === run.start && input.selectionEnd === run.end));
}

function replaceAndSelect(input, start, end, replacement, contentStart, length) {
  input.setRangeText(replacement, start, end, 'end');
  input.setSelectionRange(start + contentStart, start + contentStart + length);
}

export function getTextFormat(input) {
  return selectedTextRun(input)?.options || {size: '', color: ''};
}

export function applyTextFormat(input, settings) {
  const options = textOptions(settings.size, settings.color);
  const line = currentLine(input);
  const runs = textRuns(line);
  const existing = selectedTextRun(input, runs);
  if (isCodeLine(input, line)) throw new Error('请在代码块或滑动图组外选择文字。');
  if (!existing && runs.some(run => input.selectionStart < run.end && input.selectionEnd > run.start)) {
    throw new Error('所选文字跨过了已有样式的边界，请在一段文字内调整。');
  }
  const start = existing?.start ?? input.selectionStart;
  const end = existing?.end ?? input.selectionEnd;
  if (existing && input.selectionStart !== input.selectionEnd &&
      input.selectionStart >= existing.contentStart && input.selectionEnd <= existing.contentEnd &&
      (input.selectionStart > existing.contentStart || input.selectionEnd < existing.contentEnd)) {
    if (/[*_`~\[\]<>\\]/.test(existing.content)) throw new Error('这段文字含有 Markdown 格式，请选中整段后调整。');
    const left = input.value.slice(existing.contentStart, input.selectionStart);
    const selection = input.value.slice(input.selectionStart, input.selectionEnd);
    const right = input.value.slice(input.selectionEnd, existing.contentEnd);
    if (!selection.trim()) throw new Error('请选中文字再调整样式。');
    const wrap = (text, style) => text && (style.size || style.color) ? textMarker(style) + text + TEXT_CLOSE : text;
    const prefix = wrap(left, existing.options);
    replaceAndSelect(input, start, end, prefix + wrap(selection, options) + wrap(right, existing.options),
      prefix.length + (options.size || options.color ? textMarker(options).length : 0), selection.length);
    return;
  }
  const content = existing?.content ?? input.value.slice(start, end);
  if (!content.trim()) throw new Error('请先在编辑区选中要调整的文字。');
  if (/[\r\n]/.test(content)) throw new Error('请选择同一行内的文字。整篇字号可在预览上方调整。');
  if (content.includes('{{文字:') || content.includes(TEXT_CLOSE) || content.includes('{{副标题:')) {
    throw new Error('请选择普通文字，或把光标放进一段已设置样式的文字。');
  }
  // Selection within a Markdown heading keeps the heading marker outside the span.
  const heading = /^(#{1,6}[ \t]+)(?=\S)/.exec(content);
  const prefix = heading?.[1] || '';
  const body = content.slice(prefix.length);
  if (!options.size && !options.color) {
    if (!existing) throw new Error('请设置字号或文字颜色。');
    replaceAndSelect(input, start, end, content, prefix.length, body.length);
    return;
  }
  const opening = textMarker(options);
  replaceAndSelect(input, start, end, prefix + opening + body + TEXT_CLOSE, prefix.length + opening.length, body.length);
}

function textMarker({size, color}) {
  return '{{文字:' + size + ',' + color + '}}';
}

export function isSubtitleSelection(input) {
  const line = currentLine(input);
  return line.single && /^ {0,3}##[ \t]+\S/.test(line.value) && !isCodeLine(input, line);
}

export function getSubtitleFormat(input) {
  const line = currentLine(input);
  const heading = /^ {0,3}##[ \t]+(.+)$/.exec(line.value);
  const match = heading && SUBTITLE_START.exec(heading[1]);
  const options = match && subtitleOptions(...match.slice(1));
  return options || {...SUBTITLE_DEFAULT};
}

function isCodeLine(input, line) {
  if (/^(?: {4}|\t| {0,3}(?:`{3,}|~{3,}))/.test(line.value)) return true;
  let fence = null;
  for (const previous of input.value.slice(0, line.start).split('\n')) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(previous);
    if (!match) continue;
    if (!fence) {
      fence = match[1];
    } else if (match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) {
      fence = null;
    }
  }
  return !!fence;
}

export function applySubtitleFormat(input, settings) {
  const options = subtitleOptions(...subtitleValues(settings));
  if (!options) throw new Error('请检查副标题的字号、宽度、内边距和对齐位置。');

  const line = currentLine(input);
  if (!line.single) throw new Error('请选中一行文字，或把光标放在已有小标题里。');
  if (isCodeLine(input, line)) throw new Error('请在代码块或滑动图组外添加副标题。');
  const marker = '## {{副标题:' + subtitleValues(options).join(',') + '}} ';
  const heading = /^ {0,3}##[ \t]+(.*)$/.exec(line.value);
  if (heading) {
    const source = heading[1].replace(SUBTITLE_START, '');
    const content = source.trim() || '副标题';
    const contentStart = line.end - source.trimStart().length;
    const offset = position => Math.max(0, Math.min(content.length, position - contentStart));
    const start = offset(input.selectionStart), end = offset(input.selectionEnd);
    replaceAndSelect(input, line.start, line.end, marker + content, marker.length + start, end - start);
    return;
  }

  const selected = input.value.slice(input.selectionStart, input.selectionEnd).trim();
  const hasText = !!line.value.trim();
  const nextLine = input.value.slice(line.end + 1).split('\n', 1)[0];
  if (/^ {0,3}(?:>|\||!\[|[-+*][ \t]|\d{1,9}[.)][ \t])/.test(line.value) ||
      /^ {0,3}(?:=+|-+)[ \t]*$/.test(nextLine)) {
    throw new Error('请选中一行普通正文，或在空行插入副标题。');
  }
  if (selected) {
    const content = line.value.trim().replace(/^#{1,6}[ \t]+/, '');
    replaceAndSelect(input, line.start, line.end, marker + content, marker.length, content.length);
    return;
  }

  const content = '副标题';
  const start = hasText ? line.end : line.start;
  const end = line.end;
  const prefix = start === 0 ? '' : '\n\n';
  const suffix = end === input.value.length ? '' : '\n\n';
  replaceAndSelect(input, start, end, prefix + marker + content + suffix, prefix.length + marker.length, content.length);
}

export function registerFormattingImport(converter) {
  converter.addRule('paText', {
    filter: node => node.nodeName === 'SPAN' && node.hasAttribute('data-pa-text'),
    replacement(content, node) {
      const options = textOptions(...node.getAttribute('data-pa-text').split(','));
      if (!options.size && !options.color) return content;
      return '{{文字:' + options.size + ',' + options.color + '}}' + content.replace(/[\r\n]+/g, ' ') + TEXT_CLOSE;
    }
  });
  converter.addRule('paSubtitle', {
    filter: node => node.nodeName === 'H2' && node.hasAttribute('data-pa-subtitle'),
    replacement(content, node) {
      const options = subtitleOptions(...node.getAttribute('data-pa-subtitle').split(','));
      const marker = options ? '{{副标题:' + subtitleValues(options).join(',') + '}} ' : '';
      return '\n\n## ' + marker + content.replace(/[\r\n]+/g, ' ') + '\n\n';
    }
  });
}
