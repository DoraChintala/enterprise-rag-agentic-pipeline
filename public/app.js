// Front-end for the RAG API. No framework, no build step.
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------- Auth gate ----------
// Require a signed-in user (role chosen on the login page). The role
// tailors example prompts and is sent with each question so answers can
// be framed for the persona — WITHOUT changing the grounded facts.
const user = JSON.parse(localStorage.getItem('rag_user') || 'null');
if (!user) {
  window.location.href = '/login.html';
}

// Role-specific example prompts.
const roleExamples = {
  'Financial Analyst': [
    'Summarize the latest 10-K',
    'What are the key risk factors?',
    'Compare Acme revenue vs Globex',
    'How did net income change?',
  ],
  'Portfolio Manager': [
    'What is the revenue trend?',
    'What are the main risk factors?',
    'How did operating margin change?',
    'Summarize financial health',
  ],
  'Investment Banker': [
    'What was revenue growth year over year?',
    'Compare Acme and Globex revenue',
    'What is the net income?',
    'Summarize the growth story',
  ],
  'Tech Lead': [
    'What does the company report on data?',
    'Summarize the latest filing',
    'What are the key risk factors?',
    'How many employees and locations?',
  ],
  'Compliance Officer': [
    'What are the disclosed risk factors?',
    'What figures are reported for revenue?',
    'Summarize the filing with sources',
    'What is the reported net income?',
  ],
};

// Session state (for Documents / Companies / Recent views)
const state = { docs: [], recent: [] };

// ---------- Apply user identity to the UI ----------
function applyUser() {
  if (!user) return;
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const avatar = document.querySelector('.avatar');
  const nameEl = document.querySelector('.user-name');
  if (avatar) avatar.textContent = initials || 'U';
  if (nameEl) {
    nameEl.innerHTML = `${escapeHtml(user.name)}<span class="role-badge">${escapeHtml(
      user.role
    )}</span>`;
  }
  // Tailor example prompts to the role.
  const examples = roleExamples[user.role] || roleExamples['Financial Analyst'];
  $$('.example').forEach((btn, i) => {
    if (examples[i]) btn.textContent = examples[i];
  });
}

// ---------- Logout ----------
function wireLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      localStorage.removeItem('rag_user');
      window.location.href = '/login.html';
    });
  }
}

// ---------- Navigation ----------
$$('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $(`view-${view}`).classList.remove('hidden');
  });
});

// ---------- Health badge ----------
async function checkHealth() {
  const dot = $('health');
  if (!dot) return;
  try {
    const res = await fetch('/health');
    dot.className = res.ok ? 'health-dot ok' : 'health-dot err';
    dot.title = res.ok ? 'API online' : 'API error';
  } catch {
    dot.className = 'health-dot err';
    dot.title = 'API offline';
  }
}

// ---------- Helpers ----------
async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// ---------- Ask (search bar) ----------
$('ask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await ask();
});

$$('.example').forEach((btn) => {
  btn.addEventListener('click', () => {
    $('question').value = btn.textContent.trim();
    ask();
  });
});

// Clear the question box + hide the answer, ready for a fresh question.
function resetAsk() {
  $('question').value = '';
  $('answer-card').classList.add('hidden');
  $('answer-text').textContent = '';
  $('citations').innerHTML = '';
  $('meta').textContent = '';
  $('question').focus();
}

$('clear-btn').addEventListener('click', resetAsk);
$('close-answer').addEventListener('click', resetAsk);
$('ask-another').addEventListener('click', resetAsk);

async function ask() {
  const question = $('question').value.trim();
  if (!question) return;

  const agentMode = $('agent-mode').checked;
  const btn = $('ask-btn');
  btn.disabled = true;
  btn.textContent = '...';

  const endpoint = agentMode ? '/agent' : '/query';
  // Send the role so the API can frame the answer for this persona.
  const { status, body } = await postJson(endpoint, {
    question,
    role: user ? user.role : undefined,
  });

  btn.disabled = false;
  btn.textContent = 'Ask';

  if (status === 200) {
    renderAnswer(body, agentMode);
    state.recent.unshift({ question, when: new Date().toLocaleTimeString() });
    renderRecent();
  } else {
    renderAnswerError();
  }
}

function renderAnswer(body, agentMode) {
  $('answer-card').classList.remove('hidden');
  $('answer-text').textContent = body.answer || '(no answer)';

  const parts = [`${body.latencyMs}ms`, body.usedCache ? 'cache hit' : 'fresh'];
  if (agentMode && Array.isArray(body.steps)) parts.push(`${body.steps.length} steps`);
  $('meta').textContent = parts.join(' · ');

  const list = $('citations');
  list.innerHTML = '';
  const citations = body.citations || [];
  if (citations.length === 0) {
    list.innerHTML =
      '<li>No sources found. Add a document in the Documents tab.</li>';
    return;
  }
  for (const c of citations) {
    const where = c.page ? `${c.source}, p.${c.page}` : c.source;
    const li = document.createElement('li');
    li.innerHTML = `<span class="src">${escapeHtml(where)}</span> — ${escapeHtml(
      c.snippet
    )}`;
    list.appendChild(li);
  }
}

function renderAnswerError() {
  $('answer-card').classList.remove('hidden');
  $('answer-text').textContent = 'Something went wrong. Please try again.';
  $('meta').textContent = '';
  $('citations').innerHTML = '';
}

// ---------- Ingest (Documents view) ----------
$('ingest-btn').addEventListener('click', async () => {
  const source = $('source').value.trim();
  const text = $('doc-text').value.trim();
  const status = $('ingest-status');

  if (!source || !text) {
    status.textContent = 'Please provide both a source name and document text.';
    status.className = 'status err';
    return;
  }

  $('ingest-btn').disabled = true;
  status.textContent = 'Ingesting…';
  status.className = 'status';

  const { status: code, body } = await postJson('/ingest', { source, text });
  $('ingest-btn').disabled = false;

  if (code === 201) {
    status.textContent = `Ingested ${body.chunks} chunk(s).`;
    status.className = 'status ok';
    state.docs.unshift({ source, chunks: body.chunks, docId: body.docId });
    renderDocs();
    $('source').value = '';
    $('doc-text').value = '';
  } else {
    status.textContent = 'Ingestion failed. Check the input.';
    status.className = 'status err';
  }
});

function renderDocs() {
  const list = $('doc-list');
  const companies = $('company-list');
  if (state.docs.length === 0) {
    list.innerHTML = '<li class="empty">No documents yet.</li>';
    companies.innerHTML =
      '<li class="empty">Ingest documents to see them here.</li>';
    return;
  }
  const items = state.docs
    .map(
      (d) =>
        `<li><strong>${escapeHtml(d.source)}</strong> — ${d.chunks} chunk(s)</li>`
    )
    .join('');
  list.innerHTML = items;
  companies.innerHTML = items;
}

function renderRecent() {
  const list = $('recent-list');
  if (state.recent.length === 0) {
    list.innerHTML =
      '<li class="empty">Your recent questions will appear here.</li>';
    return;
  }
  list.innerHTML = state.recent
    .slice(0, 20)
    .map(
      (r) =>
        `<li>${escapeHtml(r.question)} <span class="meta">· ${r.when}</span></li>`
    )
    .join('');
}

// ---------- File upload (Documents view) ----------
function wireUpload() {
  const dz = $('dropzone');
  const input = $('file-input');
  if (!dz || !input) return;

  // Click the zone -> open the OS file picker.
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  // File chosen via the picker.
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) uploadFile(input.files[0]);
  });

  // Drag & drop.
  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
    })
  );
  dz.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadFile(file);
  });
}

async function uploadFile(file) {
  const status = $('upload-status');
  status.textContent = `Uploading "${file.name}"…`;
  status.className = 'status';

  const form = new FormData();
  form.append('file', file);

  try {
    const res = await fetch('/upload', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));

    if (res.status === 201) {
      status.textContent = `Ingested "${file.name}" — ${body.chunks} chunk(s).`;
      status.className = 'status ok';
      state.docs.unshift({
        source: file.name,
        chunks: body.chunks,
        docId: body.docId,
      });
      renderDocs();
    } else {
      status.textContent = body.error
        ? `Upload failed: ${body.error}`
        : 'Upload failed.';
      status.className = 'status err';
    }
  } catch {
    status.textContent = 'Upload failed (network error).';
    status.className = 'status err';
  }
}

// ---------- Search-bar upload (paperclip) ----------
function wireSearchUpload() {
  const btn = $('attach-btn');
  const input = $('search-file-input');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) uploadFromSearch(input.files[0]);
    input.value = ''; // allow re-selecting the same file
  });
}

async function uploadFromSearch(file) {
  const status = $('search-upload-status');
  status.textContent = `Uploading "${file.name}"…`;
  status.className = 'search-upload-status';

  const form = new FormData();
  form.append('file', file);

  try {
    const res = await fetch('/upload', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));

    if (res.status === 201) {
      status.textContent = `Added "${file.name}" (${body.chunks} chunk${
        body.chunks === 1 ? '' : 's'
      }). Now ask a question about it.`;
      status.className = 'search-upload-status ok';
      state.docs.unshift({
        source: file.name,
        chunks: body.chunks,
        docId: body.docId,
      });
      renderDocs();
      $('question').focus();
    } else {
      status.textContent = body.error
        ? `Upload failed: ${body.error}`
        : 'Upload failed.';
      status.className = 'search-upload-status err';
    }
  } catch {
    status.textContent = 'Upload failed (network error).';
    status.className = 'search-upload-status err';
  }
}

// ---------- Init ----------
applyUser();
wireLogout();
wireUpload();
wireSearchUpload();
checkHealth();
