// A separate family for each original font avoids incorrect weight metadata in
// older Alibaba OTF files and keeps Canvas measurement and drawing consistent.
const FONT_FILES = {
  300: {family: 'YouyueCoverAlibabaLight', file: 'light.otf', label: '细体 Light'},
  400: {family: 'YouyueCoverAlibabaRegular', file: 'regular.otf', label: '常规 Regular'},
  500: {family: 'YouyueCoverAlibabaMedium', file: 'medium.otf', label: '中等 Medium'},
  700: {family: 'YouyueCoverAlibabaBold', file: 'bold-horizontal.woff2', label: '粗体 Bold'},
  900: {family: 'YouyueCoverAlibabaHeavy', file: 'heavy.otf', label: '特粗 Heavy'}
};

const fontLoads = new Map();

export function loadCoverFont(weight = 900) {
  const numericWeight = Number(weight);
  const font = FONT_FILES[numericWeight];
  if (!font) return Promise.reject(new Error('请选择可用的封面字体粗细。'));
  if (fontLoads.has(numericWeight)) return fontLoads.get(numericWeight);
  if (typeof FontFace !== 'function' || !document.fonts?.add) {
    return Promise.reject(new Error('当前浏览器无法加载封面字体，请更新浏览器后重试。'));
  }

  const url = new URL('cover/fonts/' + font.file, import.meta.url).href;
  const promise = new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error(font.label + '字体加载超时，请检查网络后重试。'));
    }, 20000);
    let face;
    try {
      face = new FontFace(font.family, 'url(' + JSON.stringify(url) + ')', {
        weight: String(numericWeight),
        style: 'normal'
      });
      face.load().then(loadedFace => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          document.fonts.add(loadedFace);
          resolve({family: font.family, weight: numericWeight, label: font.label});
        } catch {
          reject(new Error(font.label + '字体注册失败，请重新打开封面生成。'));
        }
      }, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(font.label + '字体读取失败，请确认本次更新的字体文件已完整上传。'));
      });
    } catch {
      settled = true;
      clearTimeout(timer);
      reject(new Error(font.label + '字体无法使用，请重新打开封面生成。'));
    }
  }).catch(error => {
    fontLoads.delete(numericWeight);
    throw error;
  });
  fontLoads.set(numericWeight, promise);
  return promise;
}
