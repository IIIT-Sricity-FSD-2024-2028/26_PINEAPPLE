/**
 * Highlights the first case-insensitive occurrence of `query` inside `text`
 * using a `<mark data-testid="search-highlight">` element.
 */
export function highlightMatch(text, query) {
  const str = String(text || '');
  const q = String(query || '').trim();
  if (!str || !q) return str;

  const idx = str.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return str;

  const before = str.slice(0, idx);
  const matched = str.slice(idx, idx + q.length);
  const after = str.slice(idx + q.length);

  return (
    <>
      {before}
      <mark
        data-testid="search-highlight"
        style={{ backgroundColor: '#fef08a', color: '#854d0e', padding: '0 2px', borderRadius: '2px', fontWeight: 700 }}
      >
        {matched}
      </mark>
      {after}
    </>
  );
}
