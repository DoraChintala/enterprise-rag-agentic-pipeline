/**
 * Extracts plain text from an uploaded file buffer.
 *
 * - PDF  -> parsed with pdf-parse
 * - txt / md / csv / json / html -> decoded as UTF-8 text
 *
 * Returns the extracted text (trimmed). Throws if a PDF cannot be parsed.
 */
export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.pdf')) {
    // pdf-parse is CommonJS; import the implementation module directly to
    // avoid its index.js debug harness running on import.
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{
      text: string;
    }>;
    const parsed = await pdfParse(buffer);
    return parsed.text.trim();
  }

  // Treat everything else as UTF-8 text.
  return buffer.toString('utf8').trim();
}
