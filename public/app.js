// Minimal front-end for the RAG API. No framework, no build step.
const $ = (id) => document.getElementById(id);

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// --- Health badge ---
async function checkHealth() {
  const badge = $('health');
  try {
    const res = await fetch('/health');
    if (res.ok) {
      badge.textContent = 'API online';
      badge.className = 'badge ok';
    } else {
      throw new Error('bad status');
    }
  } catch {
    badge.textContent = 'API offline';
    badge.className = 'badge err';
  }
}

// --- Ingest ---
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
    status.textContent = `Ingested ${body.chunks} chunk(s). docId: ${body.docId}`;
    status.className = 'status ok';
  } else {
    status.textContent = 'Ingestion failed. Check the input.';
    status.className = 'status err';
  }
});

// --- Ask ---
$('ask-btn').addEventListener('click', async () => {
  const question = $('question').value.trim();
  const agentMode = $('agent-mode').checked;
  const status = $('ask-status');

  if (!question) {
    status.textContent = 'Please enter a question.';
    status.className = 'status err';
    return;
  }

  $('ask-btn').disabled = true;
  status.textContent = 'Thinking…';
  status.className = 'status';

  const endpoint = agentMode ? '/agent' : '/query';
  const { status: code, body } = await postJson(endpoint, { question });
  $('ask-btn').disabled = false;

  if (code !== 200) {
    status.textContent = 'Query failed.';
    status.className = 'status err';
    return;
  }

  status.textContent = '';
  renderAnswer(body, agentMode);
});

function renderAnswer(body, agentMode) {
  $('answer-card').classList.remove('hidden');
  $('answer-text').textContent = body.answer || '(no answer)';

  const parts = [];
  parts.push(`latency: ${body.latencyMs}ms`);
  parts.push(`cache: ${body.usedCache ? 'hit' : 'miss'}`);
  if (agentMode && Array.isArray(body.steps)) {
    parts.push(`steps: ${body.steps.length}`);
  }
  $('meta').textContent = parts.join(' · ');

  const list = $('citations');
  list.innerHTML = '';
  const citations = body.citations || [];
  if (citations.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No citations (no relevant documents found).';
    list.appendChild(li);
    return;
  }
  for (const c of citations) {
    const li = document.createElement('li');
    const where = c.page ? `${c.source}, p.${c.page}` : c.source;
    li.innerHTML = `<span class="src">${escapeHtml(where)}</span> — ${escapeHtml(
      c.snippet
    )}`;
    list.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

checkHealth();
