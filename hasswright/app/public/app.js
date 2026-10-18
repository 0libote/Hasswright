const $ = (id) => document.getElementById(id);
let sessionId = null;

document.querySelectorAll('#nav button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#nav button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $('view-' + b.dataset.view).classList.add('active');
  if (b.dataset.view === 'overview') loadOverview().catch((e) => console.error(e));
  if (b.dataset.view === 'changes') loadApprovals().catch((e) => console.error(e));
  if (b.dataset.view === 'settings') loadSettings().catch((e) => console.error(e));
  if (b.dataset.view === 'maintenance') loadMaint().catch((e) => console.error(e));
}));

async function api(path, opts) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 428) throw new Error(j.error || r.status);
  return { status: r.status, body: j };
}

async function refreshSessions() {
  const { body } = await api('/api/sessions');
  const sel = $('sessions'); sel.innerHTML = '';
  for (const s of body.sessions || []) {
    const o = document.createElement('option'); o.value = s.id; o.textContent = s.title || s.id; sel.appendChild(o);
  }
  if (body.sessions?.length) { sessionId = body.sessions[0].id; sel.value = sessionId; renderMessages(body.sessions[0]); }
}
function renderMessages(s) {
  const m = $('messages'); m.innerHTML = '';
  for (const msg of s.messages || []) {
    const d = document.createElement('div'); d.className = 'msg ' + msg.role; d.textContent = msg.content; m.appendChild(d);
  }
  m.scrollTop = m.scrollHeight;
}
$('sessions').addEventListener('change', async (e) => {
  sessionId = e.target.value;
  const { body } = await api('/api/sessions/' + sessionId);
  renderMessages(body.session);
});
$('new-session').addEventListener('click', async () => {
  const { body } = await api('/api/sessions', { method: 'POST', body: '{}' });
  sessionId = body.session.id; refreshSessions().catch((e) => console.error(e));
});
$('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('chat-input'); const text = input.value.trim(); if (!text) return;
  input.value = '';
  const m = $('messages');
  const u = document.createElement('div'); u.className = 'msg user'; u.textContent = text; m.appendChild(u);
  const t = document.createElement('div'); t.className = 'msg assistant'; t.textContent = '…'; m.appendChild(t);
  try {
    if (!sessionId) { const s = await api('/api/sessions', { method: 'POST', body: '{}' }); sessionId = s.body.session.id; }
    const { body } = await api(`/api/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ content: text }) });
    t.textContent = body.reply || '(no reply)';
  } catch (err) { t.textContent = 'Error: ' + err.message; }
  m.scrollTop = m.scrollHeight;
});
$('cancel').addEventListener('click', () => { $('chat-input').value = ''; });

async function loadOverview() {
  $('overview').textContent = 'Loading…';
  try { const { body } = await api('/api/overview'); $('overview').textContent = JSON.stringify(body.overview, null, 2); }
  catch (e) { $('overview').textContent = 'Error: ' + e.message; }
}
$('refresh')?.addEventListener('click', async () => {
  $('overview').textContent = 'Refreshing…';
  const { body } = await api('/api/overview?refresh=1'); $('overview').textContent = JSON.stringify(body.overview, null, 2);
});
let qTimer; $('q').addEventListener('input', () => {
  clearTimeout(qTimer); qTimer = setTimeout(async () => {
    const q = $('q').value; if (!q) return;
    const { body } = await api('/api/search?q=' + encodeURIComponent(q));
    $('results').innerHTML = '<pre>' + JSON.stringify(body.results, null, 2) + '</pre>' +
      (body.results || []).map((r) => `<button data-e="${r.entity_id}">deps: ${r.entity_id}</button>`).join(' ');
    $('results').querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
      const d = await api('/api/dependencies/' + encodeURIComponent(b.dataset.e));
      $('deps').innerHTML = '<pre>' + JSON.stringify(d.body, null, 2) + '</pre>';
    }));
  }, 300);
});
$('load-log').addEventListener('click', async () => {
  $('log').textContent = '…';
  const r = await api('/api/tools/exec', { method: 'POST', body: JSON.stringify({ tool: 'ha.get_log', args: {} }) });
  $('log').textContent = JSON.stringify(r.body, null, 2).slice(0, 6000);
});
$('load-repairs').addEventListener('click', async () => {
  $('repairs').textContent = '…';
  const r = await api('/api/tools/exec', { method: 'POST', body: JSON.stringify({ tool: 'ha.get_repairs', args: {} }) });
  $('repairs').textContent = JSON.stringify(r.body, null, 2).slice(0, 6000);
});
$('load-trace').addEventListener('click', async () => {
  $('trace').textContent = '…';
  const r = await api('/api/tools/exec', { method: 'POST', body: JSON.stringify({ tool: 'ha.get_trace', args: { entity_id: $('trace-id').value } }) });
  $('trace').textContent = JSON.stringify(r.body, null, 2).slice(0, 6000);
});
async function loadApprovals() {
  const { body } = await api('/api/approvals');
  $('approvals').innerHTML = '<div class="card"><h3>Pending approvals</h3>' + (body.approvals || []).map((a) =>
    `<div>[${a.status}] ${a.tool} <code>${a.preview || ''}</code> <button data-id="${a.id}" data-ok="1">Approve</button> <button data-id="${a.id}" data-ok="0">Reject</button></div>`).join(' ') + '</div>';
  $('approvals').querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
    await api('/api/approvals/decide', { method: 'POST', body: JSON.stringify({ id: b.dataset.id, approve: b.dataset.ok === '1' }) });
    loadApprovals().catch((e) => console.error(e));
  }));
}
$('run-tool').addEventListener('click', async () => {
  $('tool-out').textContent = '…';
  try {
    const args = JSON.parse($('tool-args').value || '{}');
    const r = await api('/api/tools/exec', { method: 'POST', body: JSON.stringify({ tool: $('tool-name').value, args }) });
    $('tool-out').textContent = JSON.stringify(r.body, null, 2).slice(0, 8000) + (r.status === 428 ? '\n\n→ Approval created. Approve it in the list above, then re-run with approvalId.' : '');
  } catch (e) { $('tool-out').textContent = 'Error: ' + e.message; }
  loadApprovals().catch((e) => console.error(e));
});
async function loadSettings() {
  const t = await api('/api/tools'); $('tools').textContent = JSON.stringify(t.body, null, 2).slice(0, 6000);
  const a = await api('/api/audit'); $('audit').textContent = 'AUDIT\n' + JSON.stringify(a.body.audit, null, 2).slice(0, 6000);
  const h = await api('/api/health'); document.getElementById('mode-badge').textContent = h.body.mode || 'observe';
}
async function loadMaint() { const m = await api('/api/maintenance'); $('maint').textContent = JSON.stringify(m.body, null, 2); }
try { await refreshSessions(); await loadOverview(); await loadSettings(); } catch (e) { console.error(e); }
