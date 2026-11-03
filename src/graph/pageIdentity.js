/** Canonical Confluence identity across native links, seed links and TWG ARIs. */
export function pageIdentity(page) {
  const id = String(page.globalId ?? page.id ?? '');
  const url = String(page.url ?? page.webUrl ?? '');
  const pageId = id.match(/(?:[?&]|^)pageId=(\d+)(?:&|$)/i)?.[1]
    ?? id.match(/:page:(\d+)(?::|$)/)?.[1]
    ?? url.match(/[?&]pageId=(\d+)(?:&|$)/i)?.[1]
    ?? url.match(/\/pages\/(\d+)(?:\/|[?#]|$)/)?.[1]
    ?? id.match(/^(?:.*\/)?(\d+)$/)?.[1];
  return pageId ? `page:${pageId}` : url || id;
}

export function dedupePages(pages) {
  const seen = new Set();
  return pages.filter(page => {
    const key = pageIdentity(page);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
