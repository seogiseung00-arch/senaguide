(() => {
  'use strict';

  const SUPABASE_URL = 'https://ivjksexnjwgjjtzxkfdj.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_UYR9AiCRhueqfAnw5McAxQ_0asNFCC5';
  const ADMIN_UID = '3cc96cae-c5ff-44f6-96ef-91fd3eef43b6';
  const SESSION_KEY = 'senaguideSupabaseSessionV1';
  const CMS_KEY = 'senaguideUniversalEditsV1';
  const REMOTE_STAMP_KEY = 'senaguideRemoteStampV1';
  const SYNC_DEBOUNCE_MS = 900;
  const POLL_MS = 8000;

  let session = readJson(localStorage.getItem(SESSION_KEY));
  let suppressLocalWatch = false;
  let pushTimer = 0;
  let lastRemoteUpdatedAt = sessionStorage.getItem(REMOTE_STAMP_KEY) || '';
  let syncBusy = false;

  function readJson(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function toast(message, kind = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast ${kind}`.trim();
    el.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  function headers(token = '') {
    const h = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
    h.Authorization = `Bearer ${token || SUPABASE_KEY}`;
    return h;
  }

  function appStorageKey() {
    const matches = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const m = key.match(/^rebornGuideArchiveStateV(\d+)$/);
      if (m) matches.push([Number(m[1]), key]);
    }
    matches.sort((a, b) => b[0] - a[0]);
    return matches[0]?.[1] || 'rebornGuideArchiveStateV12';
  }

  function localSnapshot() {
    const appKey = appStorageKey();
    const appState = readJson(localStorage.getItem(appKey)) || JSON.parse(JSON.stringify(window.DEFAULT_DATA || {}));
    const universalEdits = readJson(localStorage.getItem(CMS_KEY)) || {};
    return { schema: 1, appState, universalEdits, savedAt: new Date().toISOString() };
  }

  function sessionValid() {
    if (!session?.access_token || !session?.user?.id) return false;
    if (session.user.id !== ADMIN_UID) return false;
    const exp = Number(session.expires_at || 0);
    return !exp || exp * 1000 > Date.now() + 30000;
  }

  async function refreshSession() {
    if (sessionValid()) return true;
    if (!session?.refresh_token) return false;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!res.ok) throw new Error(await res.text());
      const next = await res.json();
      if (next.user?.id !== ADMIN_UID) throw new Error('관리자 계정이 아닙니다.');
      session = next;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      updateStatus();
      return true;
    } catch {
      session = null;
      localStorage.removeItem(SESSION_KEY);
      updateStatus();
      return false;
    }
  }

  async function signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.msg || data?.error_description || data?.message || '로그인에 실패했습니다.');
    if (data.user?.id !== ADMIN_UID) throw new Error('이 계정은 편집 권한이 없습니다.');
    session = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    updateStatus();
    await seedRemoteIfEmpty();
    return true;
  }

  function signOut() {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    updateStatus();
    toast('관리자 로그아웃 완료');
  }

  async function fetchRemote() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_state?id=eq.1&select=data,updated_at`, {
      headers: headers(session?.access_token || '')
    });
    if (!res.ok) throw new Error(`온라인 데이터 읽기 실패 (${res.status})`);
    const rows = await res.json();
    return rows?.[0] || null;
  }

  async function pushRemote(snapshot = localSnapshot()) {
    if (syncBusy) return false;
    if (!(await refreshSession())) return false;
    syncBusy = true;
    updateStatus('saving');
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/site_state?id=eq.1`, {
        method: 'PATCH',
        headers: { ...headers(session.access_token), Prefer: 'return=representation' },
        body: JSON.stringify({ data: snapshot, updated_at: new Date().toISOString(), updated_by: ADMIN_UID })
      });
      const payload = await res.json().catch(() => []);
      if (!res.ok) throw new Error(payload?.message || payload?.hint || `저장 실패 (${res.status})`);
      const updated = payload?.[0]?.updated_at || new Date().toISOString();
      lastRemoteUpdatedAt = updated;
      sessionStorage.setItem(REMOTE_STAMP_KEY, updated);
      updateStatus('saved');
      return true;
    } catch (e) {
      console.error(e);
      updateStatus('error');
      toast(`온라인 저장 실패: ${e.message}`, 'warn');
      return false;
    } finally {
      syncBusy = false;
    }
  }

  async function seedRemoteIfEmpty() {
    try {
      const remote = await fetchRemote();
      const data = remote?.data;
      if (!data || typeof data !== 'object' || !data.appState) {
        const ok = await pushRemote(localSnapshot());
        if (ok) toast('현재 사이트 데이터를 온라인 저장소에 등록했습니다.', 'success');
      }
    } catch (e) { console.error(e); }
  }

  function applyRemote(remote) {
    const data = remote?.data;
    if (!data || typeof data !== 'object' || !data.appState) return false;
    suppressLocalWatch = true;
    try {
      localStorage.setItem(appStorageKey(), JSON.stringify(data.appState));
      localStorage.setItem(CMS_KEY, JSON.stringify(data.universalEdits || {}));
      if (remote.updated_at) {
        lastRemoteUpdatedAt = remote.updated_at;
        sessionStorage.setItem(REMOTE_STAMP_KEY, remote.updated_at);
      }
    } finally { suppressLocalWatch = false; }
    return true;
  }

  async function pullRemote({ reload = true } = {}) {
    try {
      const remote = await fetchRemote();
      if (!remote?.data?.appState) return false;
      if (remote.updated_at && remote.updated_at === lastRemoteUpdatedAt) return false;
      if (document.body.classList.contains('edit-mode')) return false;
      const changed = applyRemote(remote);
      if (changed && reload) location.reload();
      return changed;
    } catch (e) {
      console.warn(e);
      updateStatus('offline');
      return false;
    }
  }

  function schedulePush() {
    if (!sessionValid() && !session?.refresh_token) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushRemote(localSnapshot()), SYNC_DEBOUNCE_MS);
  }

  function installLocalStorageWatcher() {
    const original = Storage.prototype.setItem;
    if (original.__senaCloudWrapped) return;
    const wrapped = function(key, value) {
      const result = original.call(this, key, value);
      if (this === localStorage && !suppressLocalWatch && (/^rebornGuideArchiveStateV\d+$/.test(String(key)) || key === CMS_KEY)) schedulePush();
      return result;
    };
    wrapped.__senaCloudWrapped = true;
    Storage.prototype.setItem = wrapped;
  }

  function injectUi() {
    if (document.getElementById('cloudAuthModal')) return;
    const style = document.createElement('style');
    style.textContent = `
      .cloud-status{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid #34475f;border-radius:999px;background:#0e1826;color:#9fb1c7;font-size:11px;cursor:pointer}.cloud-status-dot{width:7px;height:7px;border-radius:50%;background:#75849a}.cloud-status[data-state="admin"] .cloud-status-dot,.cloud-status[data-state="saved"] .cloud-status-dot{background:#56c596;box-shadow:0 0 8px #56c59666}.cloud-status[data-state="saving"] .cloud-status-dot{background:#e4bb59}.cloud-status[data-state="error"] .cloud-status-dot,.cloud-status[data-state="offline"] .cloud-status-dot{background:#e56d72}.cloud-auth-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(2,7,13,.72);backdrop-filter:blur(8px)}.cloud-auth-modal.hidden{display:none}.cloud-auth-card{width:min(390px,calc(100vw - 30px));background:linear-gradient(180deg,#142235,#0c1420);border:1px solid #66542e;border-radius:14px;box-shadow:0 24px 80px #0009;padding:18px;color:#eef4ff}.cloud-auth-card h3{margin:0 0 6px;color:#f0d17e}.cloud-auth-card p{margin:0 0 14px;color:#9fb1c7;font-size:12px}.cloud-auth-card label{display:grid;gap:5px;margin:10px 0;color:#aebdd0;font-size:12px}.cloud-auth-card input{box-sizing:border-box;width:100%;padding:10px 11px;border-radius:8px;border:1px solid #35475f;background:#09121e;color:#fff;outline:none}.cloud-auth-card input:focus{border-color:#c9a75a}.cloud-auth-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.cloud-auth-actions button{padding:8px 12px;border-radius:8px;border:1px solid #46576f;background:#15243a;color:#eef4ff;cursor:pointer}.cloud-auth-actions .primary{background:#5f4a21;border-color:#b69145;color:#ffe6a4}.cloud-auth-error{min-height:18px;color:#ff9fa4;font-size:12px;margin-top:8px}`;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'cloudAuthModal';
    modal.className = 'cloud-auth-modal hidden';
    modal.innerHTML = `<form class="cloud-auth-card" id="cloudAuthForm"><h3>관리자 로그인</h3><p>로그인 후 편집한 내용은 온라인에 저장되어 같은 링크를 보는 사람에게 공유됩니다.</p><label>이메일<input id="cloudAuthEmail" type="email" autocomplete="username" required></label><label>비밀번호<input id="cloudAuthPassword" type="password" autocomplete="current-password" required></label><div class="cloud-auth-error" id="cloudAuthError"></div><div class="cloud-auth-actions"><button type="button" id="cloudAuthCancel">취소</button><button class="primary" type="submit">로그인</button></div></form>`;
    document.body.appendChild(modal);

    document.getElementById('cloudAuthCancel').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    document.getElementById('cloudAuthForm').addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('cloudAuthError');
      err.textContent = '';
      const btn = e.submitter;
      btn.disabled = true;
      btn.textContent = '로그인 중…';
      try {
        await signIn(document.getElementById('cloudAuthEmail').value.trim(), document.getElementById('cloudAuthPassword').value);
        modal.classList.add('hidden');
        toast('관리자 로그인 완료. 편집 모드를 다시 눌러주세요.', 'success');
      } catch (x) { err.textContent = x.message || '로그인에 실패했습니다.'; }
      finally { btn.disabled = false; btn.textContent = '로그인'; }
    });

    const edit = document.getElementById('editToggle');
    if (edit?.parentElement) {
      const status = document.createElement('button');
      status.type = 'button';
      status.id = 'cloudSyncStatus';
      status.className = 'cloud-status';
      status.innerHTML = '<span class="cloud-status-dot"></span><span class="cloud-status-text">온라인 확인 중</span>';
      status.addEventListener('click', () => {
        if (sessionValid()) { if (confirm('관리자 계정에서 로그아웃할까요?')) signOut(); }
        else openLogin();
      });
      edit.parentElement.insertBefore(status, edit);
    }
    updateStatus();
  }

  function updateStatus(forced = '') {
    const el = document.getElementById('cloudSyncStatus');
    if (!el) return;
    const state = forced || (sessionValid() ? 'admin' : 'viewer');
    const labels = { admin:'관리자 · 온라인', viewer:'보기 · 온라인', saving:'저장 중…', saved:'저장됨', error:'저장 오류', offline:'연결 확인' };
    el.dataset.state = state;
    const label = el.querySelector('.cloud-status-text');
    if (label) label.textContent = labels[state] || '온라인';
  }

  function openLogin() {
    injectUi();
    document.getElementById('cloudAuthModal')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('cloudAuthEmail')?.focus(), 0);
  }

  installLocalStorageWatcher();
  window.SENA_CLOUD_AUTH = { isAdmin: () => sessionValid(), openLogin, signOut };
  window.SENA_CLOUD_SYNC = { save: () => pushRemote(localSnapshot()), pull: () => pullRemote({reload:true}) };

  window.addEventListener('DOMContentLoaded', async () => {
    injectUi();
    await refreshSession();
    await pullRemote({ reload: true });
    updateStatus();
    setInterval(() => { if (!document.hidden) pullRemote({ reload: true }); }, POLL_MS);
  });
})();