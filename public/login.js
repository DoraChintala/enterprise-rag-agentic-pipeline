// Login page: capture name + role, store locally, go to the app.
const roleHints = {
  'Financial Analyst':
    'You will see analysis-focused prompts (revenue, margins, trends).',
  'Portfolio Manager':
    'You will see portfolio-focused prompts (risk, exposure, performance).',
  'Investment Banker':
    'You will see deal-focused prompts (valuation, comparables, growth).',
  'Tech Lead':
    'You will see system-focused prompts (architecture, data, pipelines).',
  'Compliance Officer':
    'You will see audit-focused prompts (disclosures, citations, sources).',
};

const roleSelect = document.getElementById('role');
const hint = document.getElementById('role-hint');

roleSelect.addEventListener('change', () => {
  hint.textContent =
    roleHints[roleSelect.value] ||
    'Your role tailors example questions and how answers are framed.';
});

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const role = roleSelect.value;
  if (!name || !role) return;

  // Persist for the app (simple client-side session for the demo).
  localStorage.setItem('rag_user', JSON.stringify({ name, role }));
  window.location.href = '/';
});
