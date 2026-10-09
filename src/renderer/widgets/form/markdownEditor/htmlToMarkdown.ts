const MARKDOWN_SOURCE_PREFIX = '<!-- b2-markdown-source:v1:';
const MARKDOWN_SOURCE_SUFFIX = ' -->';

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(value: string): string | null {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeMarkdownHtml(markdown: string, html: string): string {
  return `${MARKDOWN_SOURCE_PREFIX}${encodeBase64(markdown)}${MARKDOWN_SOURCE_SUFFIX}\n${html}`;
}

export function decodeMarkdownSource(html: string): string | null {
  if (!html.startsWith(MARKDOWN_SOURCE_PREFIX)) return null;

  const suffixIndex = html.indexOf(MARKDOWN_SOURCE_SUFFIX, MARKDOWN_SOURCE_PREFIX.length);
  if (suffixIndex === -1) return null;

  return decodeBase64(html.slice(MARKDOWN_SOURCE_PREFIX.length, suffixIndex));
}
