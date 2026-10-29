import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/rag/chunker.js';

describe('chunkText', () => {
  it('splits text into overlapping chunks with metadata', () => {
    const words = Array.from({ length: 1000 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(words, {
      docId: 'doc1',
      source: 'test.pdf',
      chunkSize: 100,
      chunkOverlap: 20,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // metadata present on every chunk (needed for citations)
    for (const c of chunks) {
      expect(c.docId).toBe('doc1');
      expect(c.source).toBe('test.pdf');
      expect(typeof c.position).toBe('number');
      expect(c.text.length).toBeGreaterThan(0);
    }
    // positions are sequential
    expect(chunks.map((c) => c.position)).toEqual(
      chunks.map((_, i) => i)
    );
  });

  it('produces overlap between consecutive chunks', () => {
    const words = Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(words, {
      docId: 'd',
      source: 's',
      chunkSize: 20,
      chunkOverlap: 5,
    });
    const first = chunks[0].text.split(' ');
    const second = chunks[1].text.split(' ');
    // last 5 words of chunk 0 should equal first 5 words of chunk 1
    expect(first.slice(-5)).toEqual(second.slice(0, 5));
  });

  it('throws if overlap >= size', () => {
    expect(() =>
      chunkText('a b c', {
        docId: 'd',
        source: 's',
        chunkSize: 10,
        chunkOverlap: 10,
      })
    ).toThrow();
  });
});
