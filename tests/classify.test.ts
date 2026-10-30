import { describe, expect, it } from 'vitest';
import { classifyDocument } from '../src/rag/classify.js';

describe('classifyDocument', () => {
  it('detects a resume', () => {
    const text =
      'Professional summary. Work experience: Senior Software Engineer. ' +
      'Education: BSc. Skills: Java, Python. Certifications: AWS.';
    expect(classifyDocument(text)).toBe('resume');
  });

  it('detects a financial document', () => {
    const text =
      'Annual report 10-K. Total revenue was 5.2 billion. Net income grew. ' +
      'Operating margin improved. Cash flow was strong this fiscal year.';
    expect(classifyDocument(text)).toBe('financial');
  });

  it('detects a legal document', () => {
    const text =
      'This agreement is made between the parties. Whereas the terms and ' +
      'conditions apply, liability is limited under the governing law clause.';
    expect(classifyDocument(text)).toBe('legal');
  });

  it('detects a technical document', () => {
    const text =
      'The architecture exposes an API endpoint. Deployment runs on ' +
      'Kubernetes. The database stores records. Latency and throughput matter.';
    expect(classifyDocument(text)).toBe('technical');
  });

  it('falls back to general when there is no strong signal', () => {
    expect(classifyDocument('The quick brown fox jumped over a lazy dog.')).toBe(
      'general'
    );
  });
});
