const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isUrl = u => /^https?:\/\//i.test((u || '').trim());
let data = { subjects: [] }, si = 0, admin = false, q = '', dirty = false;

const btn = 'px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800';
const dangerBtn = 'px-2 py-1 rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950';
const field = 'w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900';

async function load() {
  try {
    const r = await fetch('data.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch (e) {
    $('#view').innerHTML = `<p class="p-6 text-red-700 dark:text-red-300">Could not load data.json. If you opened index.html straight from disk, run a local server (<code>python -m http.server</code>) or use GitHub Pages.</p>`;
    return;
  }
  render();
}

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 2200); }
function touch() { dirty = true; $('#dirtyMsg').textContent = 'Unsaved changes: copy or download the JSON and commit it to GitHub.'; }

function render() {
  if (si >= data.subjects.length) si = Math.max(0, data.subjects.length - 1);
  renderNav(); renderTable();
  $('#adminBar').classList.toggle('hidden', !admin);
  $('#addTopicWrap').classList.toggle('hidden', !admin || q || !data.subjects.length);
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
  if (!data.subjects.length) { $('#view').innerHTML = '<p class="p-6 text-slate-500">No subjects yet. Switch to Admin Mode and add one.</p>'; return; }
  const term = q.trim().toLowerCase();
  const scope = term ? data.subjects.map((s, i) => [s, i]) : [[data.subjects[si], si]];
  let rows = '', n = 0;
  scope.forEach(([s, sIdx]) => {
    let lastGroup = null;
    s.topics.forEach((t, ti) => {
      if (term && !(t.name + ' ' + (t.group || '') + ' ' + t.links.map(l => l.label).join(' ')).toLowerCase().includes(term)) return;
      n++;
      const g = term ? s.name : (t.group || '');
      if (g && g !== lastGroup) rows += `<tr class="bg-slate-100 dark:bg-slate-800"><td colspan="3" class="px-4 py-2 text-sm font-semibold">${esc(g)}</td></tr>`;
      lastGroup = g;
      rows += `<tr class="border-t border-slate-200 dark:border-slate-800 align-top hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="px-4 py-3 min-w-[12rem]">${esc(t.name)}${t.optional ? ' <span class="ml-1 text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-slate-500">Optional</span>' : ''}</td>
        <td class="px-4 py-3"><div class="flex flex-wrap gap-1.5">${pills(t.links)}</div></td>
        ${admin ? `<td class="px-4 py-3 whitespace-nowrap text-sm" data-s="${sIdx}" data-t="${ti}"><button data-act="up" class="${btn}" aria-label="Move up">↑</button> <button data-act="down" class="${btn}" aria-label="Move down">↓</button> <button data-act="edit" class="${btn}">Edit</button> <button data-act="del" class="${dangerBtn}">Delete</button></td>` : ''}
      </tr>`;
    });
  });
  if (!n) rows = `<tr><td colspan="3" class="px-4 py-8 text-center text-slate-500">${term ? 'No topics match your search.' : 'No topics yet.'}</td></tr>`;
  $('#view').innerHTML = `<table class="w-full text-left"><thead><tr class="border-b border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400"><th class="px-4 py-2 font-medium">Topic</th><th class="px-4 py-2 font-medium">Study material</th>${admin ? '<th class="px-4 py-2 font-medium">Actions</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>`;
}

function addSubject() {
  const name = (prompt('New subject name:') || '').trim(); if (!name) return;
  data.subjects.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, topics: [] }); si = data.subjects.length - 1; touch(); render();
}

// Topic modal
function openTopic(sIdx, tIdx) {
  const t = tIdx == null ? { name: '', group: '', optional: false, links: [{ label: 'Lecture 1', url: '' }] } : JSON.parse(JSON.stringify(data.subjects[sIdx].topics[tIdx]));
  const m = $('#modal');
  const linkRow = l => `<div class="lrow flex gap-2 mb-2"><input class="l-label ${field} w-1/3" placeholder="Label" value="${esc(l.label)}"><input class="l-url ${field}" placeholder="https://mega.nz/..." value="${esc(l.url)}"><button type="button" class="l-del ${dangerBtn}" aria-label="Remove link">✕</button></div>`;
  m.innerHTML = `<div class="w-full max-w-xl mt-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-5">
    <h2 class="font-semibold mb-4">${tIdx == null ? 'Add topic' : 'Edit topic'}</h2>
    <label class="block text-sm mb-1">Topic name</label><input id="f-name" class="${field} mb-3" value="${esc(t.name)}">
    <label class="block text-sm mb-1">Group heading (optional)</label><input id="f-group" class="${field} mb-3" value="${esc(t.group)}">
    <label class="flex items-center gap-2 text-sm mb-4"><input id="f-opt" type="checkbox" ${t.optional ? 'checked' : ''}> Mark as optional</label>
    <div class="text-sm mb-1">PDF links</div><div id="f-links">${t.links.map(linkRow).join('')}</div>
    <button type="button" id="f-addlink" class="${btn} text-sm mb-5">+ Add PDF Extra</button>
    <div class="flex justify-end gap-2"><button type="button" id="f-cancel" class="${btn}">Cancel</button><button type="button" id="f-save" class="px-3 py-1 rounded bg-teal-700 text-white hover:bg-teal-800">Save topic</button></div></div>`;
  m.classList.remove('hidden'); m.classList.add('flex'); $('#f-name').focus();
  const close = () => { m.classList.add('hidden'); m.classList.remove('flex'); m.innerHTML = ''; };
  m.onclick = e => {
    if (e.target === m || e.target.id === 'f-cancel') close();
    else if (e.target.id === 'f-addlink') { $('#f-links').insertAdjacentHTML('beforeend', linkRow({ label: 'Extra PDF', url: '' })); }
    else if (e.target.classList.contains('l-del')) e.target.closest('.lrow').remove();
    else if (e.target.id === 'f-save') {
      const name = $('#f-name').value.trim(); if (!name) { $('#f-name').focus(); return; }
      const links = [...m.querySelectorAll('.lrow')].map(r => ({ label: r.querySelector('.l-label').value.trim() || 'PDF', url: r.querySelector('.l-url').value.trim() }));
      const nt = { name, group: $('#f-group').value.trim(), optional: $('#f-opt').checked, links };
      if (tIdx == null) data.subjects[sIdx].topics.push(nt); else data.subjects[sIdx].topics[tIdx] = nt;
      close(); touch(); render();
    }
  };
}

function exportJson() { return JSON.stringify(data, null, 2) + '\n'; }

// Events
$('#modeBtn').onclick = () => { admin = !admin; render(); };
$('#themeBtn').onclick = () => { const d = document.documentElement.classList.toggle('dark'); try { localStorage.setItem('theme', d ? 'dark' : 'light'); } catch (e) {} $('#themeBtn').textContent = d ? 'Light' : 'Dark'; };
$('#themeBtn').textContent = document.documentElement.classList.contains('dark') ? 'Light' : 'Dark';
$('#search').oninput = e => { q = e.target.value; render(); };
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-add')) return addSubject(); si = +b.dataset.s; $('#search').value = ''; q = ''; render(); };
$('#subjectSel').onchange = e => { if (e.target.value === 'add') { addSubject(); } else { si = +e.target.value; q = ''; $('#search').value = ''; render(); } };
$('#addTopicBtn').onclick = () => openTopic(si, null);
$('#subjectTools').onclick = e => {
  const a = e.target.closest('button')?.dataset.act, s = data.subjects, cur = s[si]; if (!a) return;
  if (a === 'rename') { const n = (prompt('Rename subject:', cur.name) || '').trim(); if (n) { cur.name = n; touch(); } }
  else if (a === 'left' && si > 0) { [s[si - 1], s[si]] = [s[si], s[si - 1]]; si--; touch(); }
  else if (a === 'right' && si < s.length - 1) { [s[si + 1], s[si]] = [s[si], s[si + 1]]; si++; touch(); }
  else if (a === 'delsub' && confirm(`Delete "${cur.name}" and all its topics?`)) { s.splice(si, 1); touch(); }
  render();
};
$('#view').onclick = e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const td = b.closest('td'), sIdx = +td.dataset.s, tIdx = +td.dataset.t, list = data.subjects[sIdx].topics;
  if (b.dataset.act === 'edit') return openTopic(sIdx, tIdx);
  if (b.dataset.act === 'del' && confirm(`Delete "${list[tIdx].name}"?`)) list.splice(tIdx, 1);
  else if (b.dataset.act === 'up' && tIdx > 0) [list[tIdx - 1], list[tIdx]] = [list[tIdx], list[tIdx - 1]];
  else if (b.dataset.act === 'down' && tIdx < list.length - 1) [list[tIdx + 1], list[tIdx]] = [list[tIdx], list[tIdx + 1]];
  else return;
  touch(); render();
};
$('#copyBtn').onclick = async () => { try { await navigator.clipboard.writeText(exportJson()); toast('JSON copied. Paste it into data.json on GitHub.'); } catch (e) { toast('Copy blocked. Use Download instead.'); } };
$('#dlBtn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' })); a.download = 'data.json'; a.click(); URL.revokeObjectURL(a.href); toast('data.json downloaded.'); };
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

load();
