/** Deterministic ordering and verdict prose shared by actions and the panel. */
/** Order blockers before warnings, then by contribution and stable human identifier. */
export function sortSignals(signals) {
  return [...signals].sort((left, right) => {
    return Number(right.severity === 'blocker') - Number(left.severity === 'blocker') ||
      right.points - left.points ||
      left.id.localeCompare(right.id);
  });
}

/** Describe the strongest observed release evidence without remote prose generation. */
export function releaseSummary(context, risk, verdict) {
  const subject = context.subject?.type === 'release'
    ? context.subject.name
    : context.subject?.key;
  const failures = risk.signals.filter(signal => signal.id.startsWith('failed-build:')).length;
  const rollback = risk.signals.find(signal => signal.id.startsWith('prod-rollback:'));
  const incidents = risk.signals.filter(signal => signal.id.startsWith('open-incident:')).length;
  const findings = [];
  if (failures) {
    findings.push(`${failures} failing build${failures === 1 ? '' : 's'}`);
  }
  if (rollback) {
    findings.push(`a production rollback ${rollback.title.match(/\d+ days ago/)[0]}`);
  }
  if (incidents) {
    findings.push(incidents === 1 ? 'an open incident' : `${incidents} open incidents`);
  }
  let explanation;
  if (findings.length) {
    const joined = findings.length < 2
      ? findings[0]
      : `${findings.slice(0, -1).join(', ')} and ${findings.at(-1)}`;
    const plural = findings.length > 1 || failures > 1 || incidents > 1;
    explanation = `${joined} ${plural ? 'block' : 'blocks'} ${subject}`;
  } else if (risk.signals.length) {
    explanation = `${sortSignals(risk.signals)[0].title}; review before releasing ${subject}`;
  } else {
    explanation = `No risk signals observed for ${subject}`;
  }
  return `${verdict} — ${explanation}.${risk.confidence === 'low' ? ' Evidence is incomplete.' : ''}`;
}
