/**
 * Lightweight document-type classifier.
 *
 * The agentic system uses the detected type to FRAME its answers for the
 * right domain (a resume vs a financial filing vs a legal contract get
 * different framing) — without changing the grounded facts.
 *
 * This is a fast, dependency-free keyword classifier. A production system
 * could swap in an LLM classifier behind the same interface.
 */
export type DocType =
  | 'resume'
  | 'financial'
  | 'legal'
  | 'technical'
  | 'medical'
  | 'general';

const SIGNALS: Record<Exclude<DocType, 'general'>, string[]> = {
  resume: [
    'resume', 'curriculum vitae', 'work experience', 'professional summary',
    'education', 'certifications', 'skills', 'employment history',
  ],
  financial: [
    '10-k', '10-q', 'revenue', 'net income', 'balance sheet', 'earnings',
    'fiscal year', 'operating margin', 'cash flow', 'shareholders',
  ],
  legal: [
    'agreement', 'party', 'hereby', 'whereas', 'terms and conditions',
    'liability', 'governing law', 'jurisdiction', 'indemnification', 'clause',
  ],
  technical: [
    'architecture', 'api', 'endpoint', 'deployment', 'kubernetes', 'database',
    'function', 'algorithm', 'latency', 'throughput', 'microservice',
  ],
  medical: [
    'patient', 'diagnosis', 'treatment', 'symptoms', 'clinical', 'dosage',
    'prescription', 'medical history', 'prognosis',
  ],
};

/** Classify a document from a sample of its text. */
export function classifyDocument(text: string): DocType {
  const sample = text.toLowerCase().slice(0, 4000);
  let best: { type: DocType; score: number } = { type: 'general', score: 0 };

  for (const [type, words] of Object.entries(SIGNALS) as [
    Exclude<DocType, 'general'>,
    string[],
  ][]) {
    const score = words.reduce(
      (n, w) => n + (sample.includes(w) ? 1 : 0),
      0
    );
    if (score > best.score) best = { type, score };
  }

  // require at least 2 signal hits to commit to a specialized type
  return best.score >= 2 ? best.type : 'general';
}

/** How the agent should FRAME answers for each document type. */
export const TYPE_FRAMING: Record<DocType, string> = {
  resume:
    'This is a resume/CV. Answer about the person\'s experience, skills, ' +
    'roles, and education. Be specific and factual.',
  financial:
    'This is a financial document. Focus on figures, periods, and trends. ' +
    'Never invent numbers; cite the exact value from the context.',
  legal:
    'This is a legal document. Be literal and precise. Quote the relevant ' +
    'clause; do not interpret beyond the text.',
  technical:
    'This is a technical document. Be precise and structured; preserve ' +
    'names of systems, APIs, and components exactly.',
  medical:
    'This is a medical document. Report only what the text states. Do not ' +
    'give medical advice or diagnoses beyond the document.',
  general:
    'Answer the question using only the provided context, clearly and factually.',
};
