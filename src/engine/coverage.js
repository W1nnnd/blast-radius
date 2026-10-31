/** Evidence-source coverage and conservative confidence thresholds. */
export const SOURCES = ['pullRequests', 'builds', 'deployments', 'pages', 'people'];
/** Compute confidence from observed core sources, retaining reasons for visibility gaps. */
export function computeCoverage(context = {}) {
  const available = SOURCES.filter(source => context.coverage?.[source]?.available === true).length;
  const fraction = available / SOURCES.length;
  return {
    fraction,
    confidence: fraction >= .8 ? 'high' : fraction >= .5 ? 'medium' : 'low',
    sources: Object.fromEntries(SOURCES.map(source => [
      source,
      context.coverage?.[source] ?? {
        available: false,
        reason: 'not observed'
      }
    ]))
  };
}
