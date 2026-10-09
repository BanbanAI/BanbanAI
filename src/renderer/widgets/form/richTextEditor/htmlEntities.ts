export function escapeUnterminatedHtmlEntities(value: string): string {
  return value.replace(
    /&(?!(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);)(#\d+|#x[\da-f]+|[a-z][a-z\d]*)/gi,
    "&amp;$1",
  );
}
