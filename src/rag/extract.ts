/**
 * Extracts plain text from an uploaded file buffer, across many formats.
 *
 *   PDF                         -> pdf-parse
 *   DOCX                        -> mammoth
 *   txt / md / csv / json / log -> UTF-8 decode
 *   html / htm / xml            -> strip tags, decode entities
 *   anything else               -> best-effort UTF-8 if it looks like text,
 *                                  otherwise a clear "unsupported" error
 *
 * Returns the extracted text (trimmed). Throws a descriptive error if the
 * file cannot be turned into usable text.
 */
export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';

  // --- PDF ---
  if (ext === '.pdf') {
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{
      text: string;
    }>;
    const parsed = await pdfParse(buffer);
    return parsed.text.trim();
  }

  // --- DOCX (Word) ---
  if (ext === '.docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  // --- HTML / XML: strip tags, decode common entities ---
  if (ext === '.html' || ext === '.htm' || ext === '.xml') {
    return htmlToText(buffer.toString('utf8'));
  }

  // --- Known plain-text formats ---
  const textExts = ['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.log', '.yaml', '.yml'];
  if (textExts.includes(ext)) {
    return buffer.toString('utf8').trim();
  }

  // --- Unknown extension: accept it only if it actually looks like text ---
  const asText = buffer.toString('utf8');
  if (looksLikeText(asText)) {
    return asText.trim();
  }

  throw new Error(
    `Unsupported file type "${ext || 'unknown'}". Supported: PDF, DOCX, ` +
      `TXT, MD, CSV, JSON, HTML, XML, and other plain-text files.`
  );
}

/** Remove HTML/XML tags and decode a few common entities. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Heuristic: a buffer "looks like text" if it has few control/binary bytes.
 * Prevents us from ingesting garbage from images/zip/etc. as fake text.
 */
function looksLikeText(s: string): boolean {
  if (s.length === 0) return false;
  const sample = s.slice(0, 2000);
  let suspicious = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // allow tab(9), LF(10), CR(13); flag other control chars + replacement char
    if ((code < 9 || (code > 13 && code < 32) || code === 0xfffd)) suspicious++;
  }
  return suspicious / sample.length < 0.1;
}
