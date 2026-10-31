/** Concrete release actions, bounded for panels and action consumers. */
import { suggestReviewer } from './experts.js';
import { sortSignals } from './summary.js';

/** Build at most twelve signal actions plus four baseline actions and an overflow notice. */
export function buildChecklist(context, risk, {
  now = context.meta?.now ?? new Date()
} = {}) {
  const loads = new Map();
  const unique = new Map();
  for (const signal of sortSignals(risk.signals)) {
    const actionKey = `${signal.evidence[0]?.type}:${signal.evidence[0]?.id}:${signal.action ?? signal.id}`;
    if (unique.has(actionKey)) {
      continue;
    }
    unique.set(actionKey, signal);
  }
  const signals = [...unique.values()];
  const items = signals.slice(0, 12).map(signal => {
    const pullRequest = (context.pullRequests ?? []).find(request => signal.evidence[0]?.type === 'pullRequest' &&
      String(request.id) === signal.evidence[0].id);
    const reviewer = pullRequest && /no-reviewers|unapproved|bus-factor/.test(signal.id)
      ? suggestReviewer(context, pullRequest, loads, now)
      : null;
    return {
      id: signal.id,
      text: (signal.action ?? signal.title) + (reviewer ? ` — suggested: ${reviewer.person.name} (${reviewer.reason})` : ''),
      priority: signal.severity === 'blocker' ? 'must' : 'should',
      ...(reviewer ? {
        owner: reviewer.person
      } : {}),
      evidence: signal.evidence,
      source: 'signal',
      done: false
    };
  });
  for (const [id, text] of [
    ['rollback', 'Confirm rollback plan'],
    ['notes', 'Draft release notes'],
    ['oncall', 'Notify on-call'],
    ['flags', 'Identify feature flags / kill switch']
  ]) {
    items.push({
      id,
      text,
      priority: id === 'rollback' &&
        risk.signals.some(signal => signal.id.startsWith('prod-rollback:'))
        ? 'must'
        : 'nice',
      evidence: [],
      source: 'baseline',
      done: false
    });
  }
  items.sort((left, right) => {
    const priorities = ['must', 'should', 'nice'];
    return priorities.indexOf(left.priority) - priorities.indexOf(right.priority);
  });
  if (signals.length > 12) {
    items.push({
      id: 'overflow',
      text: `${signals.length - 12} more lower-priority items in the Risks tab`,
      priority: 'nice',
      evidence: [],
      source: 'overflow',
      done: false
    });
  }
  return items;
}
/** Render safe Markdown while retaining baseline actions within the text budget. */
export function toMarkdown(items, risk, subject, {
  maxLength = Infinity
} = {}) {
  const escape = value => String(value ?? '').replace(/[\[\]\\<>]/g, '\\$&').replace(/\n/g, ' ');
  const title = escape(String(subject.name ?? subject.key).slice(0, 120));
  const header = `# ${title}\n\n` + `${risk.level}: ${risk.score}/100 (${risk.confidence} confidence)\n\n`;
  const line = item => {
    const links = item.evidence.filter(entry => /^https?:\/\//.test(entry.url ?? '')).map(entry => {
      const url = entry.url.replace(/[()\s]/g, encodeURIComponent);
      return ` [${escape(entry.label)}](${url})`;
    }).join('');
    return `- [ ] **${item.priority}** ${escape(item.text)}${links}`;
  };
  const full = header + items.map(line).join('\n');
  if (full.length <= maxLength) return full;
  const baselines = items.filter(item => item.source === 'baseline');
  const note = 'Additional actions are included in the structured items.';
  let remaining = maxLength - header.length - baselines.map(line).join('\n').length - note.length - 3;
  const selected = [];
  for (const item of items.filter(candidate => candidate.source !== 'baseline')) {
    const text = line(item);
    if (text.length + 1 <= remaining) {
      selected.push(item);
      remaining -= text.length + 1;
    }
  }
  return header + [...selected, ...baselines].map(line).join('\n') + '\n\n' + note;
}
