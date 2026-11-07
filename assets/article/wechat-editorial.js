// The v2 visual style from the local wechat-article-layout skill.
export const EDITORIAL_LAYOUT = 'wechat-editorial-v2';
const RED = '#A41F29';
const INK = '#48423F';
const RULE = '#DFD0C9';
const FONT = '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';

export const editorialTemplate = {
  name: '优悦红色编辑风',
  description: '个人技能模板 · 红色刊头、编号章节、白底正文',
  layout: EDITORIAL_LAYOUT,
  styles: {
    container: `width:100%;max-width:640px;margin:0 auto;padding:24px 24px 36px;background-color:#FFFFFF;color:${INK};font-family:${FONT};font-size:15px;line-height:2.05;`,
    h1: `margin:0 0 28px;padding:27px 24px;background-color:${RED};color:#FFFFFF;font-size:32px;line-height:1.6;font-weight:700;letter-spacing:1px;`,
    h2: `margin:40px 0 24px;padding:0 0 19px;border-bottom:1px solid ${RULE};font-size:24px;line-height:1.8;font-weight:650;letter-spacing:.5px;color:#302825;`,
    h3: `margin:28px 0 15px;padding-left:12px;border-left:3px solid ${RED};font-size:17px;line-height:1.85;font-weight:600;color:${RED};`,
    h4: 'margin:28px 0 15px;font-size:18px;line-height:1.85;font-weight:600;color:#302825;',
    p: `margin:0 0 20px;font-size:15px;line-height:2.05;letter-spacing:.4px;font-weight:400;color:${INK};`,
    strong: `font-weight:500;color:${RED};`,
    a: `color:${RED};text-decoration:underline;`,
    ul: 'margin:0 0 20px;padding-left:23px;list-style-type:disc;',
    ol: 'margin:0 0 20px;padding-left:23px;list-style-type:decimal;',
    li: `margin:0 0 6px;font-size:15px;line-height:2.05;color:${INK};`,
    blockquote: `margin:22px 0;padding:8px 14px;border-left:3px solid ${RED};color:${INK};`,
    img: 'display:block;width:auto;max-width:100%;height:auto;margin:20px auto;',
    th: `padding:8px;border:1px solid ${RULE};background-color:${RED};color:#FFFFFF;text-align:left;`,
    td: `padding:8px;border:1px solid ${RULE};color:${INK};`,
    hr: `margin:28px 0;border:0;border-top:1px solid ${RULE};`
  }
};

export function decorateEditorialChapters(root) {
  const doc = root.ownerDocument;
  for (const heading of root.querySelectorAll('h2')) {
    // A chapter number is optional and comes from the text the author entered.
    const prefix = /^\d{1,2}[\s\u3000]+(?=\S)/.exec(heading.textContent)?.[0];
    if (prefix) {
      const walker = doc.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      let remaining = prefix.length;
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (text.length < remaining) {
          remaining -= text.length;
          continue;
        }
        const range = doc.createRange();
        range.setStart(heading, 0);
        range.setEnd(text, remaining);
        const number = doc.createElement('span');
        number.style.cssText = `display:block;margin:0 0 12px;font-family:Georgia,serif;font-size:42px;line-height:1.1;font-weight:400;color:${RED};`;
        number.append(range.extractContents());
        heading.prepend(number);
        break;
      }
    }
    const rule = doc.createElement('span');
    rule.setAttribute('aria-hidden', 'true');
    rule.style.cssText = `display:block;width:40px;height:3px;margin-top:15px;background-color:${RED};font-size:1px;line-height:3px;`;
    rule.textContent = '\u00a0';
    heading.append(rule);
  }
}
