/* Youyue article workspace. Theme styling adapted from huasheng_editor (MIT).
 * UI, storage, safe template import and site integration are maintained locally.
 * Third-party libraries and complete licenses are shipped beside this module. */
import {installFormatting, renderFormatting, getTextFormat, applyTextFormat, getSubtitleFormat, isSubtitleSelection, applySubtitleFormat, registerFormattingImport} from './formatting.js?v=20261103-4';
import {galleryAtSelection, galleryMarkdown, renderGalleries, registerGalleryImport} from './gallery.js?v=20261107-1';
import {EDITORIAL_LAYOUT, editorialTemplate, decorateEditorialChapters} from './wechat-editorial.js?v=20261107-1';

const $ = id => document.getElementById('pa-' + id);
const BASE = new URL('./', import.meta.url);
const MAX_TEXT = 250000, MAX_DOC = 40 * 1024 * 1024;
const SELECTORS = ['container','h1','h2','h3','h4','h5','h6','p','strong','em','a','ul','ol','li','blockquote','code','pre','pre code','hr','img','table','th','td','tr','thead','tbody','del'];
const PROPERTIES = new Set(('color background background-color font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration text-transform text-indent white-space word-break overflow-wrap word-wrap margin margin-top margin-bottom margin-left margin-right padding padding-top padding-bottom padding-left padding-right border border-top border-bottom border-left border-right border-color border-width border-style border-radius border-collapse border-spacing box-shadow width max-width min-width height max-height display overflow overflow-x list-style-type vertical-align box-sizing').split(' '));
const SAMPLE = `# 把每一次进步，写成值得分享的故事

> 优悦教育 · 新媒体内容工作台
> 这是一篇排版示例，可以直接替换成你的文章。

## 01 先讲清楚，再讲好看

好的内容，从一个具体的问题开始。把读者最关心的事情放在前面，让每一段都有清楚的重点。

**真正值得被看见的，是每一次认真和成长。**

## 02 给内容一点呼吸感

- 用小标题区分不同主题。
- 一段只说清楚一件事，适当留白。
- 重要的词可以加粗，图片之间留出间距。

### 图文可以一起讲故事

点击上方「图片」，或把图片拖进左侧编辑区。上传的图片会随草稿保存在当前浏览器中。

| 内容类型 | 排版建议 |
| --- | --- |
| 教育资讯 | 标题清楚，重点突出 |
| 学员故事 | 图文结合，分段讲述 |
| 活动通知 | 时间、地点、参与方式分开列出 |

---

选择左侧模板，右侧会立即变化。完成后点击「复制到公众号」，再到公众号正文编辑器粘贴。
`;
let md, converter, purifier, db, initPromise, initialized = false;
let templates = {}, customTemplates = {}, images = {}, memory = new Map(), state = {markdown:SAMPLE,theme:'youyue-red',size:'',line:'',mobile:false};
let renderTimer, saveTimer, saveQueue = Promise.resolve(), downloadURL, readersExpanded = false;
const VERTICAL_GALLERY = 'section[data-pa-gallery*=",vertical,"]';
const scripts = new Map();

function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('is-error', error); }
function loadScript(name) {
  if (scripts.has(name)) return scripts.get(name);
  const promise = new Promise((resolve,reject) => {
    const el = document.createElement('script'); el.src = new URL('vendor/'+name,BASE).href;
    const timer = setTimeout(() => {el.remove(); scripts.delete(name); reject(new Error('组件加载超时，请重试。'));},20000);
    el.onload = () => {clearTimeout(timer); resolve();};
    el.onerror = () => {clearTimeout(timer); el.remove(); scripts.delete(name); reject(new Error('组件加载失败，请确认 assets/article 已完整上传。'));};
    document.head.appendChild(el);
  }); scripts.set(name,promise); return promise;
}
async function openStore() {
  try {
    db = await new Promise((resolve,reject) => {
      let timedOut = false;
      const timer = setTimeout(() => {timedOut=true;reject(new Error('存储超时'));},4000);
      const request = indexedDB.open('YouyueArticleStudio',1);
      request.onupgradeneeded = () => request.result.createObjectStore('documents',{keyPath:'id'});
      request.onerror = () => {clearTimeout(timer); reject(request.error);};
      request.onsuccess = () => {clearTimeout(timer); if(timedOut)request.result.close(); else resolve(request.result);};
      request.onblocked = () => {clearTimeout(timer);reject(new Error('存储被占用'));};
    });
    db.onversionchange = () => {db.close(); db=null;};
  } catch { db=null; status('浏览器存储不可用，当前编辑仍可使用。请及时导出文章备份。',true); }
}
function storeGet(id) {
  if(!db) return Promise.resolve(memory.get(id));
  return new Promise((resolve,reject) => {const r=db.transaction('documents').objectStore('documents').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
function storePut(record) {
  memory.set(record.id,record);
  if(!db) return Promise.resolve(false);
  return new Promise((resolve,reject) => {const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(record);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
function storeAll() {
  if(!db) return Promise.resolve([...memory.values()]);
  return new Promise((resolve,reject) => {const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
function cleanCSS(value) {
  if(typeof value!=='string'||value.length>6000) return '';
  // Templates are declarations only: no URLs, injected rules, selectors or scripts.
  const safe=value.replace(/\/\*[\s\S]*?\*\//g,'').split(';').filter(part => {
    const colon=part.indexOf(':'); if(colon<1)return false;
    const key=part.slice(0,colon).trim().toLowerCase(), val=part.slice(colon+1);
    return PROPERTIES.has(key) && !/[{}<>\\@]/.test(val) && !/(?:url|expression|var|attr)\s*\(|javascript|data:|https?:|\/\//i.test(val);
  }).join(';');
  return safe;
}
function validateTemplate(input, strict = true) {
  if(!input || typeof input!=='object' || Array.isArray(input) || typeof input.name!=='string' || !input.name.trim() || input.name.length>50 || !input.styles || typeof input.styles!=='object')throw new Error('模板格式不正确，请使用本工具导出的 .json 模板。');
  if(strict && (input.schema!=='youyue-article-template'||input.version!==1))throw new Error('这不是受支持的排版模板，请使用版本 1 的优悦模板文件。');
  const styles={}; SELECTORS.forEach(key=>{if(Object.hasOwn(input.styles,key))styles[key]=cleanCSS(input.styles[key]);});
  if(!styles.container || !styles.h2)throw new Error('模板缺少正文或小标题样式。');
  const description = typeof input.description === 'string' ? input.description.slice(0,120) : '';
  const template = {name:input.name.trim(),styles,description};
  if (input.layout === EDITORIAL_LAYOUT) template.layout = EDITORIAL_LAYOUT;
  return template;
}
function buildTemplates(source) {
  for(const [key,value] of Object.entries(source))templates[key]=validateTemplate(value,false);
  const baseline=templates['wechat-default'].styles;
  const red={name:'优悦红金',description:'教育资讯 · 品牌推荐',styles:{...baseline,
    container:'padding:26px 22px 32px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.9;color:#444;background-color:#fffdf8;word-wrap:break-word;',
    h1:'font-size:29px;line-height:1.45;font-weight:700;color:#262122;margin:4px 0 24px;',
    h2:'font-size:20px;line-height:1.6;font-weight:700;color:#fff;background-color:#cf2435;border-radius:12px 0 12px 0;border:1px solid #cf2435;box-shadow:4px 4px 0 #dfbd75;padding:10px 16px;margin:32px 4px 22px 0;',
    h3:'font-size:18px;line-height:1.6;font-weight:700;color:#b51d2b;margin:24px 0 14px;',
    p:'font-size:15px;line-height:1.9;font-weight:400;color:#444;margin:16px 0;',
    strong:'font-weight:500;color:#c62435;',a:'color:#bc2637;text-decoration:underline;',
    blockquote:'margin:20px 0;padding:10px 16px;border-left:3px solid #dcb970;background-color:#f8f1e5;color:#766551;',
    img:'display:block;width:auto;max-width:100%;height:auto;margin:22px auto;border-radius:6px;',
    th:'background-color:#f6e9da;color:#553b2e;border:1px solid #e7d6c1;padding:10px;text-align:left;',
    td:'border:1px solid #e7d6c1;padding:10px;color:#444;',
    hr:'border:0;border-top:1px solid #dfbd75;margin:30px 0;'
  }};
  const editorial = validateTemplate({...editorialTemplate, styles:{...baseline, ...editorialTemplate.styles}}, false);
  templates={[EDITORIAL_LAYOUT]:editorial,'youyue-red':red,...templates};
}
function usesEditorialLayout() {
  return templates[state.theme]?.layout === EDITORIAL_LAYOUT;
}
const RASTER=/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i;
function safeImage(src) { return RASTER.test(src)||/^https?:\/\//i.test(src); }
function sanitizeHTML(html) {
  return purifier.sanitize(html,{ALLOWED_TAGS:['section','div','h1','h2','h3','h4','h5','h6','p','strong','b','em','i','a','ul','ol','li','blockquote','code','pre','hr','img','table','thead','tbody','th','td','tr','del','s','br','span','figure','figcaption','sup','sub'],ALLOWED_ATTR:['href','src','alt','title','start','colspan','rowspan','align','class','data-pa-text','data-pa-subtitle','data-pa-gallery'],ALLOW_DATA_ATTR:false});
}
function setupParser() {
  purifier=window.DOMPurify;
  md=window.markdownit({html:false,breaks:true,linkify:true,typographer:false});
  installFormatting(md);
  const validator=md.validateLink;
  md.validateLink=url=>/^yyimg:\/\/[a-z0-9-]+$/i.test(url)||validator(url);
  const original=md.renderer.rules.image;
  md.renderer.rules.image=(tokens,index,options,env,self)=>{
    const token=tokens[index];let src=token.attrGet('src')||'';
    if(src.startsWith('yyimg://'))src=images[src.slice(8)]?.data||'';
    if(!safeImage(src))return '<p>〔图片不可用，请重新插入〕</p>';
    token.attrSet('src',src);
    return original(tokens,index,options,env,self);
  };
  converter=new window.TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
  registerFormattingImport(converter);
  registerGalleryImport(converter);
  converter.addRule('table',{filter:'table',replacement:(_content,node)=>{
    const rows=[...node.querySelectorAll('tr')].map(row=>[...row.children].map(c=>c.textContent.replace(/\s+/g,' ').trim().replace(/\|/g,'\\|')));
    if(!rows.length)return '';
    const width=Math.max(...rows.map(r=>r.length)),lines=rows.map(r=>'| '+Array.from({length:width},(_,i)=>r[i]||'').join(' | ')+' |');
    lines.splice(1,0,'| '+Array(width).fill('---').join(' | ')+' |');return '\n\n'+lines.join('\n')+'\n\n';
  }});
}
function renderDocument({markdown = state.markdown, expanded = false} = {}) {
  if (markdown.length > MAX_TEXT) throw new Error('文章超过 25 万字符，请拆成多篇后排版。');
  const theme=templates[state.theme]||templates['youyue-red'];
  const editorial = usesEditorialLayout();
  const root=document.createElement('section');root.innerHTML=sanitizeHTML(md.render(markdown));
  for(const selector of SELECTORS) {
    if(selector==='container')continue;
    root.querySelectorAll(selector).forEach(node=>{if(theme.styles[selector])node.setAttribute('style',theme.styles[selector]);});
  }
  root.setAttribute('style',theme.styles.container+';box-sizing:border-box;overflow-wrap:anywhere;');
  if (!editorial) root.style.maxWidth = '100%';
  if (editorial && root.firstElementChild?.tagName === 'H1') {
    root.style.paddingTop = '0';
    root.firstElementChild.style.marginLeft = '-24px';
    root.firstElementChild.style.marginRight = '-24px';
  }
  root.querySelectorAll('p,li').forEach(node=>{
    if(state.size)node.style.setProperty('font-size',state.size+'px','important');
    if(state.line)node.style.setProperty('line-height',state.line,'important');
  });
  root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(node=>{
    node.querySelectorAll('*').forEach(child=>{child.style.setProperty('color','inherit','important');child.style.setProperty('background','transparent','important');});
  });
  root.querySelectorAll('pre code').forEach(node=>{node.style.cssText='font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.7;white-space:pre-wrap;color:inherit;background:transparent;padding:0;';});
  root.querySelectorAll('pre').forEach(node=>{node.style.whiteSpace='pre-wrap';if(!node.style.color)node.style.color='#dedee5';});
  root.querySelectorAll('a').forEach(node=>{if(!/^https?:\/\//i.test(node.getAttribute('href')||''))node.removeAttribute('href');else{node.target='_blank';node.rel='noopener noreferrer';}});
  root.querySelectorAll('img').forEach(node=>{
    if(!safeImage(node.getAttribute('src')||'')){node.replaceWith(document.createTextNode('〔图片不可用〕'));return;}
    node.style.setProperty('max-width','100%','important');node.style.setProperty('height','auto','important');node.style.removeProperty('max-height');node.referrerPolicy='no-referrer';
    node.addEventListener('error',()=>status('有图片未能加载。外部图片可能限制访问，可以下载后重新上传。',true),{once:true});
  });
  // Consecutive image-only paragraphs become a table, which survives rich-text paste.
  let group=[];
  function flushImages() {
    if(group.length<2){group=[];return;}
    const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;margin:20px 0;table-layout:fixed;';
    const body=document.createElement('tbody');table.append(body);const cols=group.length===2?2:3;
    group.forEach((p,index)=>{if(index%cols===0)body.append(document.createElement('tr'));const cell=document.createElement('td');cell.style.cssText='padding:3px;vertical-align:top;border:none;';const img=p.querySelector('img').cloneNode(true);img.style.cssText='display:block;width:100%;height:auto;margin:0;max-width:100%;';cell.append(img);body.lastElementChild.append(cell);});
    group[0].before(table);group.forEach(p=>p.remove());group=[];
  }
  if (!editorial) {
    [...root.children].forEach(p=>{if(p.tagName==='P'&&p.querySelectorAll('img').length===1&&!p.textContent.trim())group.push(p);else flushImages();});flushImages();
  }
  if(root.firstElementChild)root.firstElementChild.style.setProperty('margin-top','0','important');
  root.querySelectorAll('table').forEach(table=>{table.style.maxWidth='100%';table.style.wordBreak='break-word';});
  renderFormatting(root);
  if (editorial) decorateEditorialChapters(root);
  renderGalleries(root,src=>src.startsWith('yyimg://')?images[src.slice(8)]?.data||'':src,{editorial,expanded:editorial && expanded});
  return root;
}
function showReaderImage(img) {
  const body = dialog('原尺寸查看');
  const scroller = document.createElement('div');
  scroller.style.cssText = 'overflow:auto;max-height:62vh;';
  const original = document.createElement('img');
  original.src = img.src;
  original.alt = img.alt;
  original.referrerPolicy = 'no-referrer';
  original.style.cssText = 'display:block;width:auto;height:auto;max-width:none;';
  scroller.append(original);
  body.append(scroller);
}
function mountReaderToggle() {
  let toggle = $('reader-expand');
  if (!toggle) {
    // A browser can keep the previous homepage while loading the latest script.
    const toolbar = $('article-panel')?.querySelector('.pa-preview-options');
    if (!toolbar) return;
    toggle = document.createElement('button');
    toggle.id = 'pa-reader-expand';
    toggle.type = 'button';
    toggle.className = 'pa-text-button';
    toggle.textContent = '展开全部资料';
    toggle.hidden = true;
    toggle.setAttribute('aria-pressed', 'false');
    toolbar.append(toggle);
  }
  toggle.onclick = () => {
    readersExpanded = !readersExpanded;
    render();
  };
}
function render() {
  clearTimeout(renderTimer);
  const toggle = $('reader-expand');
  try {
    state.markdown=$('input').value;
    const article = renderDocument({expanded:readersExpanded});
    const readers = usesEditorialLayout() ? [...article.querySelectorAll(VERTICAL_GALLERY)] : [];
    if (toggle) {
      toggle.hidden = !readers.length;
      toggle.textContent = readersExpanded ? '恢复滚动框' : '展开全部资料';
      toggle.setAttribute('aria-pressed', String(readersExpanded));
    }
    for (const reader of readers) {
      for (const img of reader.querySelectorAll('img')) {
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', '原尺寸查看' + (img.alt ? ' · ' + img.alt : '图片'));
        img.style.cursor = 'zoom-in';
        img.onclick = () => showReaderImage(img);
        img.onkeydown = event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showReaderImage(img);
          }
        };
      }
    }
    const paper=$('paper');paper.replaceChildren(article);paper.classList.toggle('is-mobile',state.mobile);
    $('count').textContent=state.markdown.replace(/\s/g,'').length.toLocaleString()+' 字符';
    $('active-theme').textContent=templates[state.theme]?.name||'优悦红金';
    $('copy').disabled=!state.markdown.trim();
  } catch (error) {
    $('copy').disabled = true;
    if (toggle) toggle.hidden = true;
    status(error.message || '排版未能完成，请检查文章。', true);
  }
}
function update() {clearTimeout(renderTimer);renderTimer=setTimeout(render,160);queueSave();}
function queueSave() {clearTimeout(saveTimer);$('save-state').textContent='正在保存…';saveTimer=setTimeout(()=>saveCurrent(),700);}
function documentRecord() {
  const markdown=$('input').value;
  const used={};for(const [id,img] of Object.entries(images))if(markdown.includes('yyimg://'+id))used[id]=img;
  return {schema:'youyue-article',version:1,markdown,theme:state.theme,size:state.size,line:state.line,mobile:state.mobile,images:used,template:templateFile(state.theme),updatedAt:Date.now()};
}
function saveCurrent() {
  clearTimeout(saveTimer);const record={...documentRecord(),id:'current'};
  saveQueue=saveQueue.catch(()=>{}).then(()=>storePut(record)).then(persisted=>{$('save-state').textContent=persisted?'已自动保存到本机':'暂存在内存，请导出备份';}).catch(()=>{$('save-state').textContent='保存失败，请导出备份';status('本机存储空间不足或不可用，请导出「文章备份」保存当前内容。',true);});
  return saveQueue;
}
function templateFile(id) {
  const template = templates[id] || templates['youyue-red'];
  return {schema:'youyue-article-template',version:1,...template};
}
function renderTemplates() {
  const list=$('template-list');list.replaceChildren();const query=$('search').value.trim().toLowerCase();
  for(const [id,t] of Object.entries(templates)){
    if(query&&!t.name.toLowerCase().includes(query))continue;
    const b=document.createElement('button');b.type='button';b.className='pa-template-card';b.setAttribute('aria-pressed',String(id===state.theme));b.setAttribute('aria-label','应用模板：'+t.name);
    const sample=document.createElement('span');sample.className='pa-template-sample';
    const probe=document.createElement('div');probe.style.cssText=t.styles.container;sample.style.backgroundColor=probe.style.backgroundColor||'#fff';sample.style.color=probe.style.color||'#444';
    const heading=document.createElement('strong');heading.textContent='让内容更有层次';const hprobe=document.createElement('div');hprobe.style.cssText=t.styles[t.layout === EDITORIAL_LAYOUT ? 'h1' : 'h2'];
    heading.style.color=hprobe.style.color||probe.style.color||'#333';heading.style.backgroundColor=hprobe.style.backgroundColor;heading.style.borderLeft=hprobe.style.borderLeft;heading.style.borderBottom=hprobe.style.borderBottom;heading.style.borderRadius=hprobe.style.borderRadius;heading.style.padding='2px 5px';
    sample.append(heading);for(let i=0;i<2;i++){const line=document.createElement('i');line.className='pa-sample-line';sample.append(line);}
    const label=document.createElement('span');label.className='pa-template-name';const text=document.createElement('span');text.textContent=t.name;label.append(text);
    if(id===EDITORIAL_LAYOUT||id==='youyue-red'||customTemplates[id]){const tag=document.createElement('small');tag.textContent=id===EDITORIAL_LAYOUT?'Skill v2':id==='youyue-red'?'推荐':'自定义';label.append(tag);}
    b.append(sample,label);b.addEventListener('click',()=>{if(state.theme!==id)readersExpanded=false;state.theme=id;renderTemplates();render();queueSave();});list.append(b);
  }
  $('template-count').textContent=Object.keys(templates).length+' 款';
  if(!list.childElementCount){const p=document.createElement('p');p.textContent='没有找到对应模板';p.style.fontSize='12px';list.append(p);}
}
function dialog(title) {$('dialog-title').textContent=title;$('dialog-body').replaceChildren();$('dialog').showModal();return $('dialog-body');}
function paragraph(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);return p;}
function action(parent,text,handler){const b=document.createElement('button');b.type='button';b.className='pa-btn';b.textContent=text;b.onclick=handler;parent.append(b);return b;}
function componentForm(titleText, instructions, saveLabel) {
  const body = dialog(titleText);
  paragraph(body, instructions);
  const form = document.createElement('form');
  form.className = 'pa-component-form';
  body.append(form);
  const field = (labelText, input, wide = false) => {
    const label = document.createElement('label');
    if (wide) label.className = 'pa-field-wide';
    label.append(labelText, input);
    form.append(label);
    return input;
  };
  const select = (label, options, value) => {
    const input = document.createElement('select');
    for (const [key, name] of options) input.add(new Option(name, key));
    input.value = value;
    return field(label, input);
  };
  const number = (label, value, min, max, placeholder = '') => {
    const input = document.createElement('input');
    Object.assign(input, {type: 'number', value, min, max, step: 1, placeholder});
    return field(label, input);
  };
  const onSubmit = handler => {
    const error = document.createElement('p');
    error.className = 'pa-form-error pa-field-wide';
    error.setAttribute('role', 'alert');
    const actions = document.createElement('div');
    actions.className = 'pa-component-actions';
    const submit = document.createElement('button');
    submit.className = 'pa-btn pa-primary';
    submit.textContent = saveLabel;
    actions.append(submit);
    form.append(error, actions);
    form.onsubmit = async event => {
      event.preventDefault();
      submit.disabled = true;
      error.textContent = '';
      try {
        await handler();
        $('dialog').close();
        $('input').focus();
        render();
        queueSave();
      } catch (e) {
        error.textContent = e.message;
      } finally {
        submit.disabled = false;
      }
    };
  };
  return {field, select, number, onSubmit};
}
function articleSelection(input) {
  const {selectionStart, selectionEnd} = input;
  return () => input.setSelectionRange(selectionStart, selectionEnd);
}
const subtitleFields = {
  size: 'subtitle-size',
  width: 'subtitle-width',
  paddingY: 'subtitle-padding-y',
  paddingX: 'subtitle-padding-x',
  align: 'subtitle-align'
};
const defaultFormattingHint = '选中文字调字号和颜色。光标放进小标题可调副标题框。';

function formattingFeedback(message = defaultFormattingHint, error = false) {
  $('format-feedback').textContent = message;
  $('format-feedback').classList.toggle('is-error', error);
}

function syncInlineFormatting() {
  const input = $('input');
  const text = getTextFormat(input);
  const hasStyle = Boolean(text.size || text.color);
  const canStyleText = input.selectionStart !== input.selectionEnd || hasStyle;
  $('text-size').disabled = $('text-color').disabled = $('text-red').disabled = !canStyleText;
  $('text-clear').disabled = !hasStyle;
  $('text-size').value = text.size;
  $('text-color').value = text.color || '#303038';

  const isSubtitle = isSubtitleSelection(input);
  const subtitle = isSubtitle ? getSubtitleFormat(input) : null;
  for (const [key, id] of Object.entries(subtitleFields)) {
    $(id).disabled = !isSubtitle;
    $(id).value = subtitle?.[key] ?? '';
  }
}

function bindInlineFormatting() {
  const input = $('input');
  for (const event of ['select', 'focus', 'keyup', 'pointerup', 'input']) {
    input.addEventListener(event, () => {
      if (document.activeElement === input) syncInlineFormatting();
    });
  }

  const apply = (change, message) => {
    try {
      change();
      render();
      queueSave();
      formattingFeedback(message);
    } catch (error) {
      formattingFeedback(error.message, true);
    }
    syncInlineFormatting();
  };
  const changeText = patch => {
    const current = getTextFormat(input);
    const next = {...current, ...patch};
    if (next.size === current.size && next.color === current.color) return;
    apply(() => applyTextFormat(input, next), '文字样式已更新');
  };
  const bindField = (control, change) => {
    const commit = () => {
      if (control.type === 'number' && !control.validity.valid) {
        const range = `${control.min}–${control.max}`;
        syncInlineFormatting();
        formattingFeedback(`请输入 ${range} 之间的整数。`, true);
        return;
      }
      change(control.value);
    };
    control.addEventListener('change', commit);
    if (control.type === 'number') {
      control.addEventListener('input', () => {
        if (control.value && control.validity.valid) change(control.value);
      });
      control.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); commit(); }
      });
    }
  };
  bindField($('text-size'), size => changeText({size}));
  bindField($('text-color'), color => changeText({color}));
  $('text-red').onclick = () => changeText({color:'#cf2435'});
  $('text-clear').onclick = () => changeText({size:'', color:''});

  for (const [key, id] of Object.entries(subtitleFields)) {
    const field = $(id);
    if (field.type === 'number') field.required = true;
    bindField(field, value => {
      if (!isSubtitleSelection(input)) return;
      const current = getSubtitleFormat(input);
      if (String(current[key]) === value) return;
      apply(() => applySubtitleFormat(input, {...current, [key]: value}), '副标题框已更新');
    });
  }
  syncInlineFormatting();
}
function showGallery() {
  const input = $('input');
  const restore = articleSelection(input);
  const current = galleryAtSelection(input);
  const {number, select, field, onSubmit} = componentForm('滑动图组', current ? '可以调整方向和尺寸，也可以重新选择图片替换图组。' : '横向滑动适合两张以上图片。纵向滚动支持单张长图或多页资料，图片保持原比例。', current ? '更新滑动图组' : '插入滑动图组');
  const file = document.createElement('input');
  Object.assign(file, {type:'file', accept:'image/png,image/jpeg,image/webp,image/gif', multiple:true});
  field(current ? '替换图片（可选）' : '选择图片', file, true);
  const direction = select('滚动方向', [['horizontal','横向滑动'],['vertical','纵向滚动']], current?.options.direction ?? (usesEditorialLayout() ? 'vertical' : 'horizontal'));
  const width = number('每张图宽度（%）', current?.options.width ?? 85, 45, 100);
  const height = number('图片高度（px）', current?.options.height || '', 100, 640, '留空按原比例');
  const frameHeight = number('滚动框高度（px）', current?.options.frameHeight ?? 440, 200, 800);
  const updateFields = () => {
    const vertical = direction.value === 'vertical';
    for (const [control, visible] of [[width, !vertical], [height, !vertical], [frameHeight, vertical]]) {
      control.disabled = !visible;
      control.parentElement.hidden = !visible;
    }
  };
  direction.onchange = updateFields;
  updateFields();
  onSubmit(async () => {
    if (direction.value === 'horizontal' && !width.value) throw new Error('请填写每张图的宽度。');
    if (direction.value === 'vertical' && !frameHeight.value) throw new Error('请填写滚动框的高度。');
    const options = {direction: direction.value, width: Number(width.value), height: Number(height.value), frameHeight: Number(frameHeight.value)};
    restore();
    if (file.files.length || !current) {
      await insertImages(file.files, options, current);
    } else {
      input.setRangeText(galleryMarkdown(current.items, options), current.start, current.end, 'start');
      status('已更新滑动图组尺寸。');
    }
  });
}
function download(data,type,name) {
  if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(new Blob([data],{type}));
  const a=document.createElement('a');a.href=downloadURL;a.download=name;a.className='pa-download-link';a.textContent='没有开始下载？点击保存 '+name;
  const body=dialog('导出已准备好');paragraph(body,'请保存这份文件；文章备份包含图片和当前模板，可在另一台电脑导入继续编辑。');body.append(a);a.click();
}
function title() {return ($('input').value.split('\n').find(s=>s.trim())||'未命名文章').replace(/^#+\s*/,'').replace(/[<>:"/\\|?*]/g,'').slice(0,60);}
async function saveHistory() {
  try {
    const rec={...documentRecord(),id:'draft-'+Date.now(),title:title()};
    const persisted=await storePut(rec);await saveCurrent();status(persisted?'已保存一份草稿，可在「草稿箱」找回。':'草稿暂存在内存，关闭网页前请导出备份。',!persisted);
  }catch{status('草稿保存失败，请导出文章备份。',true);}
}
async function showHistory() {
  try {
    const rows=(await storeAll()).filter(r=>r.id.startsWith('draft-')).sort((a,b)=>b.updatedAt-a.updatedAt);
    const body=dialog('草稿箱');paragraph(body,'草稿保存在当前浏览器。打开历史文章前，会自动保留当前内容的一份快照。');
    if(!rows.length)paragraph(body,'还没有保存的草稿，点击「保存草稿」即可收藏当前版本。');
    rows.forEach(rec=>{const button=document.createElement('button');button.type='button';button.className='pa-history-item';const h=document.createElement('strong');h.textContent=rec.title||'未命名文章';const t=document.createElement('small');t.textContent=new Date(rec.updatedAt).toLocaleString('zh-CN')+' · '+(rec.template?.name||'排版模板');button.append(h,t);button.onclick=async()=>{await saveHistory();applyDocument(rec);$('dialog').close();status('已打开历史草稿。');};body.append(button);});
  }catch{status('草稿箱暂时无法读取，请先导出当前文章。',true);}
}
function validateDocument(input) {
  if(!input||input.schema!=='youyue-article'||input.version!==1||typeof input.markdown!=='string'||input.markdown.length>MAX_TEXT)throw new Error('文章备份格式不正确，或文字过长。');
  const imgs={};for(const [key,img] of Object.entries(input.images||{})){
    if(!/^[a-z0-9-]{1,80}$/i.test(key)||!img||typeof img.data!=='string'||!RASTER.test(img.data))throw new Error('文章备份含有不支持的图片。');
    imgs[key]={data:img.data,name:typeof img.name==='string'?img.name.slice(0,100):'图片'};
  }
  if(JSON.stringify(imgs).length>MAX_DOC)throw new Error('文章图片过多，请分篇导入。');
  if(input.template)validateTemplate(input.template);
  return {...input,images:imgs};
}
function applyDocument(input) {
  const doc=validateDocument(input);images=doc.images;
  let theme=doc.theme;
  if(doc.template&&!templates[theme]){theme='imported-'+Date.now();templates[theme]=validateTemplate(doc.template);customTemplates[theme]=templates[theme];persistTemplates();}
  readersExpanded = false;
  state={markdown:doc.markdown,theme:templates[theme]?theme:'youyue-red',size:['14','15','16','17','18'].includes(doc.size)?doc.size:'',line:['1.6','1.8','2','2.2'].includes(doc.line)?doc.line:'',mobile:!!doc.mobile};
  $('input').value=state.markdown;$('size').value=state.size;$('line').value=state.line;$('mobile').checked=state.mobile;renderTemplates();render();syncInlineFormatting();queueSave();
}
function persistTemplates() {return storePut({id:'templates',values:customTemplates}).catch(()=>status('模板暂时只能在本次打开中使用，请导出模板备份。',true));}
async function importTemplate(file) {
  if(!file)return;
  try {
    if(file.size>200000)throw new Error('模板应小于 200 KB，请选择 .json 模板文件。');
    const template=validateTemplate(JSON.parse(await file.text()));
    const same=Object.keys(customTemplates).find(id=>JSON.stringify(customTemplates[id])===JSON.stringify(template));
    const id=same||'custom-'+Date.now();templates[id]=template;customTemplates[id]=template;state.theme=id;
    await persistTemplates();renderTemplates();render();queueSave();status('已导入并应用「'+template.name+'」。');
  }catch(e){status(e instanceof SyntaxError?'文件不是有效的 JSON 模板。':e.message,true);}finally{$('template-file').value='';}
}
function replaceRange(text) {const input=$('input'),start=input.selectionStart,end=input.selectionEnd;input.setRangeText(text,start,end,'end');input.focus();update();}
function format(kind) {
  const input=$('input'),selection=input.value.slice(input.selectionStart,input.selectionEnd),map={h1:'# '+(selection||'文章标题'),h2:'## '+(selection||'小标题'),bold:'**'+(selection||'重点文字')+'**',quote:'> '+(selection||'引用内容').replace(/\n/g,'\n> '),list:'- '+(selection||'列表内容').replace(/\n/g,'\n- '),link:'['+(selection||'链接文字')+'](https://example.com)',hr:'---'};
  const start=input.selectionStart;
  const block=['h1','h2','quote','list','hr'].includes(kind);replaceRange((block?'\n\n':'')+map[kind]+(block?'\n\n':''));
  if(kind==='bold')input.setSelectionRange(start+2,start+map.bold.length-2);
  if(kind==='h2')input.setSelectionRange(start+5,start+2+map.h2.length);
  syncInlineFormatting();
}
function readData(file) {return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('图片读取失败'));r.readAsDataURL(file);});}
async function insertImages(files, galleryOptions = null, currentGallery = null) {
  const list=[...files].filter(f=>/^image\/(png|jpeg|webp|gif)$/.test(f.type));
  const start=$('input').selectionStart,end=$('input').selectionEnd,version=$('input').value;const pending=[];
  try {
    if(!list.length)throw new Error('请选择 PNG、JPG、WebP 或 GIF 图片。');
    if (galleryOptions) {
      const vertical = galleryOptions.direction === 'vertical';
      if (list.length < (vertical ? 1 : 2) || list.length !== files.length) {
        throw new Error(vertical ? '请为纵向图组选择至少一张支持格式的图片。' : '请为横向图组选择至少两张支持格式的图片。');
      }
    }
    if(list.some(f=>f.size>12*1024*1024))throw new Error('单张图片请控制在 12 MB 内。');
    let total=JSON.stringify(documentRecord().images).length;
    for(const f of list){const data=await readData(f);total+=data.length;if(total>MAX_DOC)throw new Error('当前文章图片已较多，请拆分文章，或缩小图片后再插入。');if(!RASTER.test(data))throw new Error('不支持这张图片的编码格式。');const id='img-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);pending.push([id,{data,name:f.name}]);}
    if(galleryOptions && $('input').value!==version)throw new Error('文章已更改，请重新插入图组。');
    const block=galleryOptions?galleryMarkdown(pending.map(([id,img])=>({src:'yyimg://'+id,alt:img.name})),galleryOptions):'';
    for(const [id,img] of pending)images[id]=img;
    if(galleryOptions) {
      const input=$('input');
      const nextLine=version.indexOf('\n',end);
      const position=currentGallery?.start ?? (nextLine<0?version.length:nextLine);
      const prefix=currentGallery||position===0?'':'\n\n';
      const suffix=currentGallery?'':'\n\n';
      input.setRangeText(prefix+block+suffix,position,currentGallery?.end ?? position,'start');
      const cursor=position+prefix.length+'\x60\x60\x60yy-gallery\n'.length;
      input.setSelectionRange(cursor,cursor);
      status(galleryOptions.direction==='vertical'?'图组已更新，可在预览框内上下滚动。':'图组已更新，可在预览中左右滑动。');
      return;
    }
    const text='\n\n'+pending.map(([id,img])=>'!['+img.name.replace(/[\[\]\\\n\r]/g,'')+'](yyimg://'+id+')').join('\n\n')+'\n\n';
    if($('input').value===version){$('input').setSelectionRange(start,end);replaceRange(text);}else replaceRange(text);
    render();queueSave();status('已插入 '+pending.length+' 张图片。图片保存在本机；发布前请核对公众号中的显示。');
  }catch(e){if(galleryOptions)throw e;status(e.message,true);}finally{$('image-file').value='';}
}
function extractMarkdownImages(markdown, imageMap) {
  return markdown.replace(/\(data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+\)/gi, match => {
    const id='img-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
    imageMap[id]={data:match.slice(1,-1),name:'导入图片'};
    return '(yyimg://'+id+')';
  });
}
function htmlToMarkdown(html, imageMap = images) {
  const holder=document.createElement('div');holder.innerHTML=sanitizeHTML(html);
  holder.querySelectorAll('img').forEach(img=>{
    const src=img.getAttribute('src')||'';
    if(RASTER.test(src)){const id='img-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);imageMap[id]={data:src,name:img.alt||'粘贴图片'};img.setAttribute('src','yyimg://'+id);}
    else if(!/^https?:\/\//i.test(src)){img.replaceWith(document.createTextNode('〔请重新上传这张图片〕'));}
  });
  return converter.turndown(holder);
}
async function importFile(file) {
  if(!file)return;
  try {
    if(file.size>MAX_DOC)throw new Error('文件超过 40 MB，请缩小图片或拆分文章。');
    const text=await file.text();let doc;
    if(/\.json$/i.test(file.name))doc=validateDocument(JSON.parse(text));
    else {
      const importedImages={};
      const markdown=/\.html?$/i.test(file.name)?htmlToMarkdown(text,importedImages):extractMarkdownImages(text,importedImages);
      if(markdown.length>MAX_TEXT)throw new Error('文章超过 25 万字符，请拆分后导入。');
      doc=validateDocument({...documentRecord(),markdown,images:importedImages});
    }
    if($('input').value.trim()){await storePut({...documentRecord(),id:'draft-'+Date.now(),title:title()});}
    applyDocument(doc);status('已导入文章，导入前的内容保留在草稿箱。');
  }catch(e){status(e instanceof SyntaxError?'无法识别文章备份格式。':e.message,true);}finally{$('file').value='';}
}
function articleForExport(expanded = false) {
  return renderDocument({markdown:$('input').value,expanded});
}
function fallbackCopy(html) {
  const holder=document.createElement('div');holder.contentEditable='true';holder.style.cssText='position:fixed;left:0;top:0;max-height:1px;opacity:.01;overflow:hidden;';holder.innerHTML=html;document.body.append(holder);
  const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(holder);selection.removeAllRanges();selection.addRange(range);let result=false;try{result=document.execCommand('copy');}catch{}selection.removeAllRanges();holder.remove();return result;
}
function copied() {status('已复制排版内容。请粘贴到公众号正文，并核对图片、表格与标题样式。');saveCurrent();}
function copyArticle() {
  if (!$('input').value.trim()) return;
  let article;
  try { article = articleForExport(); } catch(e) { status(e.message,true); return; }
  const html = article.outerHTML;
  const fail=()=>{if(fallbackCopy(html))copied();else {const body=dialog('手动复制排版');paragraph(body,'浏览器未允许自动复制。下方已选中排版内容，请按 ⌘C（Windows 按 Ctrl+C），然后到公众号粘贴。');const region=document.createElement('div');region.className='pa-paper';region.innerHTML=html;region.tabIndex=0;body.append(region);const range=document.createRange();range.selectNodeContents(region);const s=getSelection();s.removeAllRanges();s.addRange(range);}};
  // No asynchronous preparation before write(): Safari requires user activation.
  if(navigator.clipboard?.write && window.ClipboardItem){
    try{const item=new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([article.textContent],{type:'text/plain'})});navigator.clipboard.write([item]).then(copied,fail);}catch{fail();}
  }else fail();
}
function showExport() {
  const body=dialog('导出文章');paragraph(body,'选择文章备份可完整保留图片、文字与模板，下次通过「导入文章」继续修改。');
  action(body,'文章备份（含图片）',()=>download(JSON.stringify(documentRecord()),'application/json',title()+'.article.json'));
  const exportHTML = (expanded = false) => {
    try {
      const html = '<!DOCTYPE html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>公众号排版文章</title><body style="margin:0 auto;max-width:740px;">'
        + articleForExport(expanded).outerHTML + '</body></html>';
      download(html,'text/html;charset=utf-8',title()+(expanded?'_资料展开版':'')+'.html');
    } catch(e) { status(e.message,true); }
  };
  action(body,'排版 HTML',()=>exportHTML());
  if (usesEditorialLayout() && $('paper').querySelector(VERTICAL_GALLERY)) {
    action(body,'排版 HTML（资料展开版）',()=>exportHTML(true));
  }
  action(body,'Markdown（含图片）',()=>{let text=$('input').value;for(const [id,img] of Object.entries(images))text=text.split('yyimg://'+id).join(img.data);download(text,'text/markdown;charset=utf-8',title()+'.md');});
}
function bind() {
  $('input').addEventListener('input',update);
  $('search').addEventListener('input',renderTemplates);
  document.querySelectorAll('[data-pa-format]').forEach(b=>b.onclick=()=>format(b.dataset.paFormat));
  $('size').onchange=()=>{state.size=$('size').value;render();queueSave();};$('line').onchange=()=>{state.line=$('line').value;render();queueSave();};$('mobile').onchange=()=>{state.mobile=$('mobile').checked;render();queueSave();};
  $('import').onclick=()=>$('file').click();$('file').onchange=()=>importFile($('file').files[0]);
  $('import-template').onclick=()=>$('template-file').click();$('template-file').onchange=()=>importTemplate($('template-file').files[0]);
  $('export-template').onclick=()=>download(JSON.stringify(templateFile(state.theme),null,2),'application/json',templates[state.theme].name+'.template.json');
  $('image').onclick=()=>$('image-file').click();$('image-file').onchange=()=>insertImages($('image-file').files);
  bindInlineFormatting();
  $('gallery').onclick=showGallery;
  $('input').addEventListener('dragover',e=>{e.preventDefault();});$('input').addEventListener('drop',e=>{if(e.dataTransfer.files.length){e.preventDefault();insertImages(e.dataTransfer.files);}});
  $('input').addEventListener('paste',e=>{
    const data=e.clipboardData;if(!data)return;
    const files=[...data.files].filter(f=>f.type.startsWith('image/'));if(files.length){e.preventDefault();insertImages(files);return;}
    const html=data.getData('text/html');if(html){e.preventDefault();try{if(html.length>MAX_DOC)throw new Error('粘贴内容过大，请分段粘贴。');const text=htmlToMarkdown(html);if(text.length+$('input').value.length>MAX_TEXT)throw new Error('文字过长，请分篇排版。');replaceRange(text);status('已将粘贴内容转换为可编辑文章。');}catch(error){status(error.message,true);}}
  });
  $('save').onclick=saveHistory;$('history').onclick=showHistory;$('copy').onclick=copyArticle;$('export').onclick=showExport;
  $('dialog-close').onclick=()=>$('dialog').close();$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveCurrent();});
}
async function initialize() {
  await Promise.all([loadScript('markdown-it.min.js'),loadScript('purify.min.js'),loadScript('turndown.js')]);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  let source;try{const response=await fetch(new URL('upstream-themes.json',BASE),{signal:controller.signal});if(!response.ok)throw new Error('模板加载失败，请确认更新文件已上传。');source=await response.json();}finally{clearTimeout(timeout);}
  buildTemplates(source);setupParser();await openStore();
  mountReaderToggle();
  const savedTemplates=await storeGet('templates').catch(()=>null);
  if(savedTemplates?.values)for(const [id,t] of Object.entries(savedTemplates.values)){try{if(/^custom-|^imported-/.test(id)){customTemplates[id]=validateTemplate(t,false);templates[id]=customTemplates[id];}}catch{}}
  $('input').value=state.markdown;
  const saved=await storeGet('current').catch(()=>null);
  if(saved){try{applyDocument(saved);}catch{status('旧草稿格式无法读取，已打开示例。可以从备份文件恢复。',true);}}
  renderTemplates();render();bind();initialized=true;
  $('loading').hidden=true;$('retry').hidden=true;$('ready').hidden=false;
}
async function activateArticle() {
  if(initialized)return;
  if(!initPromise)initPromise=initialize().catch(e=>{initPromise=null;$('loading').hidden=false;$('loading').textContent=e.name==='AbortError'?'排版资源加载超时，请重试。':e.message;$('retry').hidden=false;throw e;});
  return initPromise;
}
let currentMediaWorkspace = 'article';
let mediaTabsBound = false;
let coverModulePromise;

function selectMediaWorkspace(workspace) {
  const showCover = workspace === 'cover';
  currentMediaWorkspace = workspace;
  $('article-panel').hidden = showCover;
  $('cover-panel').hidden = !showCover;
  $('article-tab').setAttribute('aria-pressed', String(!showCover));
  $('cover-tab').setAttribute('aria-pressed', String(showCover));
  if (!showCover) return activateArticle();
  if (!coverModulePromise) {
    coverModulePromise = import('./cover.js?v=20261104-8').catch(error => {
      coverModulePromise = undefined;
      throw error;
    });
  }
  return coverModulePromise.then(module => module.activateCover()).catch(error => {
    $('cover-status').textContent = error.message || '封面素材加载失败，请再次点击「图文封面生成」重试。';
  });
}

export function activate() {
  if (!mediaTabsBound) {
    $('article-tab').onclick = () => selectMediaWorkspace('article').catch(() => {});
    $('cover-tab').onclick = () => selectMediaWorkspace('cover');
    mediaTabsBound = true;
  }
  return selectMediaWorkspace(currentMediaWorkspace);
}
export function suspend(){if(initialized){render();saveCurrent();if($('dialog').open)$('dialog').close();}}
export function dispose(){if(initialized)saveCurrent();if(downloadURL)URL.revokeObjectURL(downloadURL);}
