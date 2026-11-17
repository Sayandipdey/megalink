import { API_URL } from './config.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isUrl = u => /^https?:\/\//i.test((u || '').trim());
const POLL_MS = 8000;
let data = { subjects: [] }, si = 0, sid = null, admin = false, q = '', ready = false;
let busy = 0, lastWrite = 0, lastJson = '', chain = Promise.resolve();

const btn = 'px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800';
const dangerBtn = 'px-2 py-1 rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950';
const field = 'w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900';

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 3500); }
function setStatus(ok, text) { const s = $('#status'); s.textContent = '● ' + text; s.className = 'mr-auto text-xs ' + (ok ? 'text-teal-700 dark:text-teal-400' : 'text-red-600 dark:text-red-400'); }

// ---------- Google Apps Script API ----------
const configured = !API_URL.startsWith('PASTE');

async function pull(force) {
  if (!configured) return;
  if (!force && (busy > 0 || Date.now() - lastWrite < 3000)) return; // don't overwrite fresh local edits
  try {
    const r = await fetch(API_URL, { cache: 'no-store' });
    const txt = await r.text();
    if (busy > 0) return;
    if (ready && txt === lastJson) { setStatus(true, 'Live'); return; }
    const j = JSON.parse(txt);
    lastJson = txt; ready = true;
    data.subjects = (j.subjects || []).sort((a, b) => a.order - b.order);
    setStatus(true, 'Live'); render();
  } catch (e) {
    setStatus(false, 'Offline, retrying');
    if (!ready) $('#view').innerHTML = '<p class="p-6 text-red-700 dark:text-red-300">Could not reach the Google Sheet API. Check the URL in config.js and that the web app is deployed with access set to “Anyone”.</p>';
  }
}

function send(body) {
  busy++;
  chain = chain
    .then(() => fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }))
    .then(r => r.json()).then(j => { if (!j.ok) throw new Error(j.error || 'failed'); })
    .catch(e => toast('Save failed: ' + e.message))
    .finally(() => { busy--; lastWrite = Date.now(); if (!busy) setTimeout(() => pull(true), 600); });
  return chain;
}
const save = (...subs) => send({ action: 'save', subjects: subs.map(({ id, name, order, topics }) => ({ id, name, order, topics })) });
const remove = id => send({ action: 'delete', id });

if (!configured) {
  setStatus(false, 'Not configured');
  $('#view').innerHTML = '<p class="p-6 text-red-700 dark:text-red-300">Open <code>config.js</code> and paste your Apps Script web app URL.</p>';
} else {
  pull(true);
  setInterval(() => { if (!document.hidden) pull(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(true); });
}

// ---------- Render ----------
function render() {
  const k = data.subjects.findIndex(s => s.id === sid);
  si = k >= 0 ? k : Math.max(0, Math.min(si, data.subjects.length - 1));
  sid = data.subjects[si]?.id ?? null;
  renderNav(); renderTable();
  $('#adminBar').classList.toggle('hidden', !admin);
  $('#addTopicWrap').classList.toggle('hidden', !admin || !!q || !data.subjects.length);
  $('#modeBtn').textContent = admin ? 'Switch to Student Mode' : 'Switch to Admin Mode';
}

function renderNav() {
  const on = 'bg-teal-700 text-white border-teal-700', off = 'border-transparent hover:bg-slate-200 dark:hover:bg-slate-800';
  $('#tabs').innerHTML = data.subjects.map((s, i) => `<button data-s="${i}" class="shrink-0 px-3 py-1.5 text-sm rounded-md border ${i === si && !q ? on : off}">${esc(s.name)}</button>`).join('')
    + (admin ? `<button data-add class="shrink-0 px-3 py-1.5 text-sm rounded-md border border-dashed border-teal-700 text-teal-800 dark:text-teal-300">+ Add Subject</button>` : '');
  $('#subjectSel').innerHTML = data.subjects.map((s, i) => `<option value="${i}" ${i === si ? 'selected' : ''}>${esc(s.name)}</option>`).join('') + (admin ? '<option value="add">+ Add Subject</option>' : '');
  const tools = $('#subjectTools');
  tools.classList.toggle('hidden', !admin || !data.subjects.length); tools.classList.toggle('flex', admin && !!data.subjects.length);
  tools.innerHTML = `<span class="self-center text-slate-500">Subject:</span>
    <button data-act="rename" class="${btn}">Rename</button><button data-act="left" class="${btn}">Move left</button><button data-act="right" class="${btn}">Move right</button><button data-act="delsub" class="${dangerBtn}">Delete subject</button>`;
}

function pills(links) {
  if (!links.length) return '<span class="text-slate-400 text-sm">No links yet</span>';
  return links.map(l => isUrl(l.url)
    ? `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" class="inline-block px-2.5 py-0.5 text-sm rounded-full border border-teal-700 text-teal-800 dark:text-teal-300 dark:border-teal-500 hover:bg-teal-700 hover:text-white dark:hover:bg-teal-600 dark:hover:text-white">${esc(l.label)}</a>`
    : `<span title="No link added yet" class="inline-block px-2.5 py-0.5 text-sm rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-400">${esc(l.label)}</span>`).join(' ');
}

function renderTable() {
  if (!ready) return;
  if (!data.subjects.length) { $('#view').innerHTML = '<p class="p-6 text-slate-500">No subjects yet. Switch to Admin Mode, then add a subject or click “Upload data.json to Sheet”.</p>'; return; }
  const term = q.trim().toLowerCase();
  const scope = term ? data.subjects.map((s, i) => [s, i]) : [[data.subjects[si], si]];
  let rows = '', n = 0;
  scope.forEach(([s, sIdx]) => {
    let lastGroup = null;
    s.topics.forEach((t, ti) => {
      const links = t.links || [];
      if (term && !(t.name + ' ' + (t.group || '') + ' ' + links.map(l => l.label).join(' ')).toLowerCase().includes(term)) return;
      n++;
      const g = term ? s.name : (t.group || '');
      if (g && g !== lastGroup) rows += `<tr class="bg-slate-100 dark:bg-slate-800"><td colspan="3" class="px-4 py-2 text-sm font-semibold">${esc(g)}</td></tr>`;
      lastGroup = g;
      rows += `<tr class="border-t border-slate-200 dark:border-slate-800 align-top hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="px-4 py-3 min-w-[12rem]">${esc(t.name)}${t.optional ? ' <span class="ml-1 text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-slate-500">Optional</span>' : ''}</td>
        <td class="px-4 py-3"><div class="flex flex-wrap gap-1.5">${pills(links)}</div></td>
        ${admin ? `<td class="px-4 py-3 whitespace-nowrap text-sm" data-s="${sIdx}" data-t="${ti}"><button data-act="up" class="${btn}" aria-label="Move up">↑</button> <button data-act="down" class="${btn}" aria-label="Move down">↓</button> <button data-act="edit" class="${btn}">Edit</button> <button data-act="del" class="${dangerBtn}">Delete</button></td>` : ''}
      </tr>`;
    });
  });
  if (!n) rows = `<tr><td colspan="3" class="px-4 py-8 text-center text-slate-500">${term ? 'No topics match your search.' : 'No topics yet.'}</td></tr>`;
  $('#view').innerHTML = `<table class="w-full text-left"><thead><tr class="border-b border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400"><th class="px-4 py-2 font-medium">Topic</th><th class="px-4 py-2 font-medium">Study material</th>${admin ? '<th class="px-4 py-2 font-medium">Actions</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------- Subjects ----------
function addSubject() {
  const name = (prompt('New subject name:') || '').trim(); if (!name) return;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'subject';
  const s = { id: 's-' + slug + '-' + Math.random().toString(36).slice(2, 6), name, order: Math.max(-1, ...data.subjects.map(x => x.order)) + 1, topics: [] };
  data.subjects.push(s); sid = s.id; save(s); render();
}

// ---------- Topic modal ----------
function openTopic(sIdx, tIdx) {
  const subj = data.subjects[sIdx];
  const t = tIdx == null ? { name: '', group: '', optional: false, links: [{ label: 'Lecture 1', url: '' }] } : JSON.parse(JSON.stringify(subj.topics[tIdx]));
  const m = $('#modal');
  const linkRow = l => `<div class="lrow flex gap-2 mb-2"><input class="l-label ${field} w-1/3" placeholder="Label" value="${esc(l.label)}"><input class="l-url ${field}" placeholder="https://mega.nz/..." value="${esc(l.url)}"><button type="button" class="l-del ${dangerBtn}" aria-label="Remove link">✕</button></div>`;
  m.innerHTML = `<div class="w-full max-w-xl mt-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-5">
    <h2 class="font-semibold mb-4">${tIdx == null ? 'Add topic' : 'Edit topic'}</h2>
    <label class="block text-sm mb-1">Topic name</label><input id="f-name" class="${field} mb-3" value="${esc(t.name)}">
    <label class="block text-sm mb-1">Group heading (optional)</label><input id="f-group" class="${field} mb-3" value="${esc(t.group)}">
    <label class="flex items-center gap-2 text-sm mb-4"><input id="f-opt" type="checkbox" ${t.optional ? 'checked' : ''}> Mark as optional</label>
    <div class="text-sm mb-1">PDF links</div><div id="f-links">${(t.links || []).map(linkRow).join('')}</div>
    <button type="button" id="f-addlink" class="${btn} text-sm mb-5">+ Add PDF Extra</button>
    <div class="flex justify-end gap-2"><button type="button" id="f-cancel" class="${btn}">Cancel</button><button type="button" id="f-save" class="px-3 py-1 rounded bg-teal-700 text-white hover:bg-teal-800">Save topic</button></div></div>`;
  m.classList.remove('hidden'); m.classList.add('flex'); $('#f-name').focus();
  const close = () => { m.classList.add('hidden'); m.classList.remove('flex'); m.innerHTML = ''; };
  m.onclick = e => {
    if (e.target === m || e.target.id === 'f-cancel') close();
    else if (e.target.id === 'f-addlink') $('#f-links').insertAdjacentHTML('beforeend', linkRow({ label: 'Extra PDF', url: '' }));
    else if (e.target.classList.contains('l-del')) e.target.closest('.lrow').remove();
    else if (e.target.id === 'f-save') {
      const name = $('#f-name').value.trim(); if (!name) { $('#f-name').focus(); return; }
      const links = [...m.querySelectorAll('.lrow')].map(r => ({ label: r.querySelector('.l-label').value.trim() || 'PDF', url: r.querySelector('.l-url').value.trim() }));
      const nt = { name, group: $('#f-group').value.trim(), optional: $('#f-opt').checked, links };
      const live = data.subjects.find(s => s.id === subj.id);
      if (!live) { close(); toast('That subject was deleted.'); return; }
      if (tIdx == null) live.topics.push(nt); else live.topics[tIdx] = nt;
      close(); save(live); render();
    }
  };
}

// ---------- Backup / seed ----------
const exportJson = () => JSON.stringify({ subjects: data.subjects.map(({ order, ...s }) => s) }, null, 2) + '\n';

async function seed() {
  try {
    const r = await fetch('data.json', { cache: 'no-store' }); if (!r.ok) throw new Error('data.json not found next to index.html');
    const j = await r.json();
    if (!confirm(`Upload ${j.subjects.length} subjects from data.json? Subjects with the same id will be overwritten.`)) return;
    await send({ action: 'save', subjects: j.subjects.map((s, i) => ({ id: s.id, name: s.name, order: i, topics: s.topics || [] })) });
    toast('Uploaded to the Google Sheet.');
  } catch (e) { toast('Upload failed: ' + e.message); }
}

// ---------- Events ----------
$('#modeBtn').onclick = () => { admin = !admin; render(); };
$('#themeBtn').onclick = () => { const d = document.documentElement.classList.toggle('dark'); try { localStorage.setItem('theme', d ? 'dark' : 'light'); } catch (e) {} $('#themeBtn').textContent = d ? 'Light' : 'Dark'; };
$('#themeBtn').textContent = document.documentElement.classList.contains('dark') ? 'Light' : 'Dark';
$('#search').oninput = e => { q = e.target.value; render(); };
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-add')) return addSubject(); sid = data.subjects[+b.dataset.s].id; $('#search').value = ''; q = ''; render(); };
$('#subjectSel').onchange = e => { if (e.target.value === 'add') { addSubject(); } else { sid = data.subjects[+e.target.value].id; q = ''; $('#search').value = ''; render(); } };
$('#addTopicBtn').onclick = () => openTopic(si, null);
$('#seedBtn').onclick = seed;
$('#subjectTools').onclick = e => {
  const a = e.target.closest('button')?.dataset.act, s = data.subjects, cur = s[si]; if (!a || !cur) return;
  if (a === 'rename') { const n = (prompt('Rename subject:', cur.name) || '').trim(); if (n) { cur.name = n; save(cur); } }
  else if ((a === 'left' && si > 0) || (a === 'right' && si < s.length - 1)) {
    const p = s[a === 'left' ? si - 1 : si + 1]; [p.order, cur.order] = [cur.order, p.order]; s.sort((x, y) => x.order - y.order); save(p, cur);
  }
  else if (a === 'delsub' && confirm(`Delete "${cur.name}" and all its topics?`)) { s.splice(si, 1); remove(cur.id); }
  render();
};
$('#view').onclick = e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const td = b.closest('td'), sIdx = +td.dataset.s, tIdx = +td.dataset.t, subj = data.subjects[sIdx], list = subj.topics;
  if (b.dataset.act === 'edit') return openTopic(sIdx, tIdx);
  if (b.dataset.act === 'del' && confirm(`Delete "${list[tIdx].name}"?`)) list.splice(tIdx, 1);
  else if (b.dataset.act === 'up' && tIdx > 0) [list[tIdx - 1], list[tIdx]] = [list[tIdx], list[tIdx - 1]];
  else if (b.dataset.act === 'down' && tIdx < list.length - 1) [list[tIdx + 1], list[tIdx]] = [list[tIdx], list[tIdx + 1]];
  else return;
  save(subj); render();
};
$('#dlBtn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' })); a.download = 'data.json'; a.click(); URL.revokeObjectURL(a.href); toast('Backup downloaded.'); };
