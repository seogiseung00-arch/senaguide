(() => {
  'use strict';

  const STORE_KEY = 'senaguideUniversalEditsV1';
  const PANEL_ID = 'universalCmsPanel';
  let selected = null;
  let applying = false;
  let scheduled = false;

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  let store = loadStore();

  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { console.warn('Universal editor save failed', e); }
  }

  function escCss(v) {
    if (window.CSS && CSS.escape) return CSS.escape(String(v));
    return String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function routeKey() { return location.hash || '#heroes'; }

  function nthSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `#${escCss(el.id)}`;
    const root = el.closest('#mainContent, #primaryNav, .sidebar, .topbar') || document.body;
    const parts = [];
    let cur = el;
    while (cur && cur !== root && cur !== document.body) {
      let part = cur.tagName.toLowerCase();
      const stableAttrs = [
        'data-guide-id','data-setting-row','data-setting-field','data-setting-option',
        'data-guide-field','data-guide-meta-field','data-coupon-index','data-coupon-field',
        'data-hero','data-hero-field','data-utility-page','data-utility-field','data-route',
        'data-category-filter','data-guide-tab','data-pvp-open'
      ];
      const attrs = stableAttrs.filter(a => cur.hasAttribute(a)).map(a => `[${a}="${escCss(cur.getAttribute(a))}"]`).join('');
      if (attrs) part += attrs;
      else {
        const cls = [...cur.classList].filter(c => !['cms-selected','cms-hover'].includes(c)).slice(0,2);
        if (cls.length) part += '.' + cls.map(escCss).join('.');
        if (cur.parentElement) {
          const same = [...cur.parentElement.children].filter(x => x.tagName === cur.tagName);
          if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur)+1})`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    let prefix = 'body';
    if (root.id) prefix = `#${escCss(root.id)}`;
    else if (root !== document.body && root.classList.length) prefix = '.' + escCss(root.classList[0]);
    return `${prefix} > ${parts.join(' > ')}`;
  }

  function elementKey(el) {
    const guide = el.closest?.('[data-guide-id]');
    if (guide) {
      const gid = guide.dataset.guideId;
      const setting = el.closest?.('[data-setting-row]');
      if (setting?.dataset.settingField) {
        return `guide:${gid}:row:${setting.dataset.settingRow}:field:${setting.dataset.settingField}:opt:${setting.dataset.settingOption || ''}`;
      }
      if (el.dataset.guideField) return `guide:${gid}:field:${el.dataset.guideField}`;
      if (el.dataset.guideMetaField) return `guide:${gid}:meta:${el.dataset.guideMetaField}`;
    }
    if (el.dataset.couponIndex !== undefined && el.dataset.couponField) return `coupon:${el.dataset.couponIndex}:${el.dataset.couponField}`;
    if (el.dataset.heroField && el.dataset.hero) return `hero:${el.dataset.hero}:${el.dataset.heroField}`;
    return `${routeKey()}|${nthSelector(el)}`;
  }

  function resolveKey(key) {
    if (key.startsWith('guide:')) {
      const m = key.match(/^guide:(.*?):row:(\d+):field:([^:]+):opt:(.*)$/);
      if (m) {
        const [,gid,row,field,opt] = m;
        let q = `[data-guide-id="${CSS.escape(gid)}"] [data-setting-row="${row}"][data-setting-field="${CSS.escape(field)}"]`;
        if (opt) q += `[data-setting-option="${CSS.escape(opt)}"]`;
        return document.querySelector(q);
      }
      const f = key.match(/^guide:(.*?):field:(.+)$/);
      if (f) return document.querySelector(`[data-guide-id="${CSS.escape(f[1])}"] [data-guide-field="${CSS.escape(f[2])}"]`);
      const meta = key.match(/^guide:(.*?):meta:(.+)$/);
      if (meta) return document.querySelector(`[data-guide-id="${CSS.escape(meta[1])}"] [data-guide-meta-field="${CSS.escape(meta[2])}"]`);
    }
    if (key.startsWith('coupon:')) {
      const m = key.match(/^coupon:(\d+):(.+)$/);
      if (m) return document.querySelector(`[data-coupon-index="${m[1]}"][data-coupon-field="${CSS.escape(m[2])}"]`);
    }
    if (key.startsWith('hero:')) {
      const m = key.match(/^hero:(.*?):(.+)$/);
      if (m) return document.querySelector(`[data-hero="${CSS.escape(m[1])}"][data-hero-field="${CSS.escape(m[2])}"]`);
    }
    const sep = key.indexOf('|');
    if (sep >= 0) {
      const route = key.slice(0, sep), selector = key.slice(sep + 1);
      if (route !== routeKey()) return null;
      try { return document.querySelector(selector); } catch { return null; }
    }
    return null;
  }

  function applyOne(el, o) {
    if (!el || !o) return;
    if (typeof o.text === 'string' && el.childElementCount === 0 && el.textContent !== o.text) el.textContent = o.text;
    if (o.color) el.style.setProperty('color', o.color, 'important');
    if (o.backgroundColor) el.style.setProperty('background-color', o.backgroundColor, 'important');
    if (o.borderColor) el.style.setProperty('border-color', o.borderColor, 'important');
    if (o.fontSize) el.style.setProperty('font-size', `${o.fontSize}px`, 'important');
    if (o.fontWeight) el.style.setProperty('font-weight', o.fontWeight, 'important');
    if (o.hidden) el.style.setProperty('display', 'none', 'important');
    else if (o.hidden === false) el.style.removeProperty('display');
    if (o.image && el.tagName === 'IMG' && el.src !== o.image) el.src = o.image;
  }

  function applyAll() {
    if (applying) return;
    applying = true;
    try {
      Object.entries(store).forEach(([key,o]) => applyOne(resolveKey(key), o));
    } finally { applying = false; }
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; applyAll(); syncPanel(); });
  }

  function isEditMode() { return document.body.classList.contains('edit-mode'); }

  function panelHtml() {
    return `<aside id="${PANEL_ID}" class="universal-cms-panel hidden" aria-label="전체 편집 도구">
      <div class="cms-panel-head"><strong>전체 편집</strong><button type="button" data-cms-action="collapse">−</button></div>
      <div class="cms-panel-body">
        <div class="cms-help">편집 모드에서 <b>바꾸고 싶은 요소를 클릭</b>하세요. 텍스트·색·크기·이미지를 직접 바꿀 수 있습니다. 기존 편집 버튼을 고르려면 그대로 클릭하고, 버튼 자체를 꾸미려면 Alt+클릭하세요.</div>
        <div class="cms-selected-name" data-cms-selected>선택된 요소 없음</div>
        <label class="cms-row cms-text-row"><span>텍스트</span><textarea data-cms-text rows="3" placeholder="텍스트 요소를 선택하세요"></textarea></label>
        <div class="cms-color-grid">
          <label><span>글자색</span><input data-cms-color="color" type="color"><button type="button" data-cms-clear="color">초기화</button></label>
          <label><span>배경색</span><input data-cms-color="backgroundColor" type="color"><button type="button" data-cms-clear="backgroundColor">초기화</button></label>
          <label><span>테두리</span><input data-cms-color="borderColor" type="color"><button type="button" data-cms-clear="borderColor">초기화</button></label>
        </div>
        <div class="cms-inline-grid">
          <label><span>글자크기</span><input data-cms-size type="number" min="8" max="72" step="1" placeholder="px"></label>
          <label><span>굵기</span><select data-cms-weight><option value="">기본</option><option value="400">400</option><option value="500">500</option><option value="600">600</option><option value="700">700</option><option value="800">800</option><option value="900">900</option></select></label>
        </div>
        <div class="cms-image-tools hidden" data-cms-image-tools><button type="button" data-cms-action="image">이미지 교체</button><button type="button" data-cms-action="image-reset">이미지 초기화</button></div>
        <div class="cms-panel-actions"><button type="button" data-cms-action="hide">요소 숨기기/복원</button><button type="button" class="danger" data-cms-action="reset">선택 요소 초기화</button></div>
        <div class="cms-panel-actions"><button type="button" data-cms-action="export">편집 백업</button><button type="button" data-cms-action="import">편집 불러오기</button></div>
      </div>
    </aside>`;
  }

  function ensurePanel() {
    if (!document.getElementById(PANEL_ID)) document.body.insertAdjacentHTML('beforeend', panelHtml());
    const p = document.getElementById(PANEL_ID);
    p.classList.toggle('hidden', !isEditMode());
    return p;
  }

  function normalizeHex(color) {
    if (!color) return '#000000';
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return '#000000';
    return '#' + [m[1],m[2],m[3]].map(x => Number(x).toString(16).padStart(2,'0')).join('');
  }

  function currentOverride(create=true) {
    if (!selected) return null;
    const key = elementKey(selected);
    if (create && !store[key]) store[key] = {};
    return { key, value: store[key] || null };
  }

  function syncPanel() {
    const p = ensurePanel();
    if (!selected || !document.contains(selected)) selected = null;
    document.querySelectorAll('.cms-selected').forEach(x => x.classList.remove('cms-selected'));
    if (selected) selected.classList.add('cms-selected');
    const name = p.querySelector('[data-cms-selected]');
    const text = p.querySelector('[data-cms-text]');
    const size = p.querySelector('[data-cms-size]');
    const weight = p.querySelector('[data-cms-weight]');
    const imgTools = p.querySelector('[data-cms-image-tools]');
    if (!selected) {
      name.textContent = '선택된 요소 없음'; text.value=''; text.disabled=true; size.value=''; weight.value=''; imgTools.classList.add('hidden'); return;
    }
    name.textContent = `${selected.tagName.toLowerCase()}${selected.classList.length ? ' · ' + [...selected.classList].filter(c=>c!=='cms-selected').slice(0,2).join('.') : ''}`;
    text.disabled = selected.childElementCount > 0 || ['IMG','INPUT','TEXTAREA','SELECT'].includes(selected.tagName);
    text.value = text.disabled ? '' : selected.textContent;
    const cs = getComputedStyle(selected);
    size.value = Math.round(parseFloat(cs.fontSize) || 0) || '';
    weight.value = ['400','500','600','700','800','900'].includes(cs.fontWeight) ? cs.fontWeight : '';
    p.querySelectorAll('[data-cms-color]').forEach(inp => { inp.value = normalizeHex(cs[inp.dataset.cmsColor]); });
    imgTools.classList.toggle('hidden', selected.tagName !== 'IMG');
  }

  function pickElement(target) {
    if (!isEditMode()) return;
    if (target.closest(`#${PANEL_ID}, #saveBar, #imageModal, .global-search-wrap, #editToggle`)) return;
    selected = target.nodeType === 1 ? target : target.parentElement;
    syncPanel();
  }

  document.addEventListener('click', e => {
    if (!isEditMode()) return;
    const p = e.target.closest(`#${PANEL_ID}`);
    if (p) return;
    const target = e.target.closest('img, code, strong, span, p, h1, h2, h3, h4, td, th, article, section, div, button, a');
    if (!target) return;
    if (target.closest('.modal, .save-bar')) return;
    if (e.target.closest('[data-action], [data-route], [data-category-filter], [data-guide-tab], [data-pvp-open], [data-open-image], [data-copy-coupon-index], [data-setting-color]')) {
      if (!e.altKey) return;
    }
    e.preventDefault();
    e.stopPropagation();
    pickElement(target);
  }, true);

  document.addEventListener('input', e => {
    const p = e.target.closest(`#${PANEL_ID}`); if (!p || !selected) return;
    const ov = currentOverride(); if (!ov) return;
    if (e.target.matches('[data-cms-text]') && !e.target.disabled) {
      ov.value.text = e.target.value; selected.textContent = e.target.value;
    } else if (e.target.matches('[data-cms-color]')) {
      ov.value[e.target.dataset.cmsColor] = e.target.value; applyOne(selected, ov.value);
    } else if (e.target.matches('[data-cms-size]')) {
      const n = Number(e.target.value); if (n >= 8 && n <= 72) ov.value.fontSize = n; else delete ov.value.fontSize; applyOne(selected, ov.value);
    } else if (e.target.matches('[data-cms-weight]')) {
      if (e.target.value) ov.value.fontWeight = e.target.value; else delete ov.value.fontWeight; applyOne(selected, ov.value);
    }
    saveStore();
  });

  document.addEventListener('click', e => {
    const p = e.target.closest(`#${PANEL_ID}`); if (!p) return;
    const clear = e.target.closest('[data-cms-clear]');
    if (clear && selected) {
      const ov=currentOverride(); delete ov.value[clear.dataset.cmsClear];
      const cssProp = clear.dataset.cmsClear.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
      selected.style.removeProperty(cssProp); saveStore(); scheduleApply(); return;
    }
    const a = e.target.closest('[data-cms-action]'); if (!a) return;
    const action=a.dataset.cmsAction;
    if (action==='collapse') { p.classList.toggle('collapsed'); a.textContent=p.classList.contains('collapsed')?'＋':'−'; return; }
    if (action==='export') {
      const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='senaguide-page-edits.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000); return;
    }
    if (action==='import') {
      const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=()=>{const file=input.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{store=JSON.parse(r.result)||{};saveStore();scheduleApply();alert('편집 백업을 불러왔습니다.');}catch{alert('올바른 편집 백업 파일이 아닙니다.');}};r.readAsText(file);};input.click();return;
    }
    if (!selected) return;
    const ov=currentOverride();
    if(action==='reset'){ delete store[ov.key]; selected.removeAttribute('style'); saveStore(); selected=null; scheduleApply(); return; }
    if(action==='hide'){ ov.value.hidden = !ov.value.hidden; saveStore(); applyOne(selected,ov.value); return; }
    if(action==='image'){
      if(selected.tagName!=='IMG')return;
      const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>{const file=input.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{ov.value.image=r.result;saveStore();applyOne(selected,ov.value);};r.readAsDataURL(file);};input.click();return;
    }
    if(action==='image-reset'){delete ov.value.image;saveStore();scheduleApply();return;}
  });

  const observer = new MutationObserver(() => scheduleApply());
  observer.observe(document.documentElement, {subtree:true, childList:true});
  window.addEventListener('hashchange', () => { selected=null; scheduleApply(); });
  setInterval(() => ensurePanel(), 500);
  scheduleApply();
})();