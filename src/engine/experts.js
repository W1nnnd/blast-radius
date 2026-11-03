/** Rank people from concrete contributions, with recency and traceable reasons. */
/** Rank up to five experts, excluding specified accounts. */
export function rankExperts(context, {
  now = context.meta?.now ?? new Date(),
  excludeAccountIds = []
} = {}) {
  const scores = new Map();
  const add = (person, weight, date, reason) => {
    if (!person?.accountId || excludeAccountIds.includes(person.accountId)) {
      return;
    }
    const age = (new Date(now) - new Date(date)) / 86400000;
    const multiplier = Number.isFinite(age) ? age <= 30 ? 1 : age <= 90 ? 0.6 : 0.3 : 0.3;
    const row = scores.get(person.accountId) ??
      {
        person,
        score: 0,
        reasons: [],
        lastActiveAt: null,
        teams: (context.teams ?? []).filter(team => team.members?.includes(person.accountId)).map(team => team.name)
      };
    row.score += weight * multiplier;
    if (!row.reasons.includes(reason) && row.reasons.length < 3) {
      row.reasons.push(reason);
    }
    if (Number.isFinite(Date.parse(date)) &&
      (!row.lastActiveAt || Date.parse(date) > Date.parse(row.lastActiveAt))) {
      row.lastActiveAt = date;
    }
    scores.set(person.accountId, row);
  };
  for (const pullRequest of context.pullRequests ?? []) {
    const label = `PR #${pullRequest.displayId ?? pullRequest.id} (${pullRequest.repository})`;
    add(pullRequest.author, 3, pullRequest.updatedAt, `Authored ${label}`);
    for (const reviewer of pullRequest.reviewers ?? []) {
      const approved = reviewer.approvalStatus === 'APPROVED';
      add(
        reviewer.person,
        approved ? 2.5 : 1.5,
        pullRequest.updatedAt,
        `${approved ? 'Approved' : 'Reviewed'} ${label}`
      );
    }
  }
  for (const page of context.pages ?? []) {
    add(page.owner, 2, page.lastUpdatedAt, `Owns '${page.title}'`);
  }
  for (const issue of context.issues ?? []) {
    add(issue.assignee, 1, issue.updatedAt, `Assignee of ${issue.key}`);
  }
  return [...scores.values()].sort((left, right) =>
    right.score - left.score || left.person.name.localeCompare(right.person.name)).slice(0, 5);
}

/** Choose an independent reviewer, preferring repository history and balanced workload. */
export function suggestReviewer(context, pullRequest, loads, now) {
  const experts = rankExperts(context, {
    now,
    excludeAccountIds: [pullRequest.author?.accountId]
  });
  const candidates = new Map(experts.map(expert => [expert.person.accountId, {
    ...expert,
    affinity: 0
  }]));
  const owners = (context.issues ?? []).filter(issue => pullRequest.issueKeys?.includes(issue.key))
    .map(issue => issue.assignee).filter(person => person?.accountId);
  const repoPeople = (context.pullRequests ?? []).filter(other => other.repository &&
    other.repository === pullRequest.repository).flatMap(other =>
    [other.author, ...(other.reviewers ?? []).map(reviewer => reviewer.person)]);
  for (const person of [...owners, ...repoPeople, ...(context.people ?? [])].filter(person => person?.accountId)) {
    if (person.accountId !== pullRequest.author?.accountId &&
      !candidates.has(person.accountId)) {
      candidates.set(person.accountId, {
        person,
        score: 0,
        affinity: 0
      });
    }
  }
  for (const candidate of candidates.values()) {
    const hasHistory = (context.pullRequests ?? []).some(other => {
      return other.repository === pullRequest.repository &&
        (other.author?.accountId === candidate.person.accountId ||
          other.reviewers?.some(reviewer => reviewer.person?.accountId === candidate.person.accountId));
    });
    const sameTeam = (context.teams ?? []).some(team => {
      return team.members?.includes(candidate.person.accountId) &&
        team.members?.includes(pullRequest.author?.accountId);
    });
    const isOwner = owners.some(owner => owner.accountId === candidate.person.accountId);
    candidate.affinity = isOwner ? 3 : hasHistory ? 2 : sameTeam ? 1 : 0;
    candidate.reason = isOwner ? 'owns the linked issue' : hasHistory
      ? `owns ${pullRequest.repository} reviews`
      : sameTeam ? 'shares the author’s team' : 'has related expertise';
  }
  const independent = [...candidates.values()].filter(candidate =>
    candidate.person.accountId !== pullRequest.assignee?.accountId);
  const ordered = (independent.length ? independent : [...candidates.values()]).sort((left, right) => {
    return Number((loads.get(left.person.accountId) ?? 0) >= 2) - Number((loads.get(right.person.accountId) ?? 0) >= 2) ||
      right.affinity - left.affinity ||
      (loads.get(left.person.accountId) ?? 0) - (loads.get(right.person.accountId) ?? 0) ||
      right.score - left.score ||
      left.person.name.localeCompare(right.person.name);
  });
  const selected = ordered[0];
  if (selected) {
    loads.set(selected.person.accountId, (loads.get(selected.person.accountId) ?? 0) + 1);
  }
  return selected;
}
