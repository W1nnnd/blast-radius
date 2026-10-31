# Demo video script — Blast Radius (target 2:50, hard limit < 5:00; everything that matters in the first 3:00)

Rules from the official page: public YouTube, under 5 minutes, judges need not watch past 3 minutes, no third-party
trademarks or copyrighted music. Use the demo site with Northwind Pay data (project PAY). Voice-over in English, 1080p,
browser zoom 110 %, notifications off. Music: none or a royalty-free track you own.

| Time | Screen | Voice-over (≈ 150 words/min) |
|---|---|---|
| 0:00–0:15 | Title card "Blast Radius — know what a release could break before you ship it", then Jira release page PAY 2.4.0 | "It's Thursday. Release 2.4.0 of our payments app ships tomorrow. Eight issues, ten pull requests, three repositories. Is it safe?" |
| 0:15–0:30 | Quick cuts: PR list, CI page, deployment list, Confluence runbook (each 2 s) | "Today the answer lives in five tools. Teams click through all of them, or ship on gut feel. Most incidents start with something that was already visible." |
| 0:30–1:15 | Open PAY-142 → Blast Radius panel. Point at verdict, score, confidence. Top risks tab: failed build, prod rollback 12 days ago, open incident. Click a build evidence link. | "Blast Radius walks Atlassian Teamwork Graph from this issue to its pull requests, builds, deployments, Confluence pages, incidents, people and teams. Verdict: HOLD, 76 out of 100, high confidence. Every point is a named rule with a link to the evidence — this build failed, production was rolled back twelve days ago, and incident INC-7 is still open. The score is deterministic: no LLM decides the number." |
| 1:15–1:40 | Click "Analyze release 2.4.0" → HOLD 88/100. Checklist tab: must items, reviewer suggestions. Experts tab. | "One click scores the whole release. The checklist turns risks into actions — and suggests a reviewer who isn't the author, balanced across the team. The experts tab shows who actually knows this code, from PRs, approvals and the runbooks they own." |
| 1:40–2:10 | Rovo Chat → Blast Radius agent → "Can we ship PAY 2.4.0 on Friday?" → answer with verdict, top 3 risks with links, checklist, who to ask. | "The same engine is a Rovo agent. Ask in plain language and it answers with the verdict, the evidence links, the checklist and who to ask — and it never invents a green light." |
| 2:10–2:35 | Claude Desktop or Cursor with MCP server `mcp.atlassian.com/forge/<appId>` → prompt "Generate the release checklist for PAY 2.4.0" → tool call `generate-release-checklist` → Markdown pasted into a PR description. Show `SKILL.md` for 2 s. | "And because it's an Atlassian MCP server, Claude or Cursor can call the same tools, guided by our open-source skill file. Here the coding agent pulls the release checklist straight into a pull request." |
| 2:35–2:50 | Back in Jira: PAY 2.3.1 → GO 0/100. Then Evidence tab showing coverage. End card: modules list (Jira panel · Rovo agent · MCP · Teamwork Graph), 101 tests, "Read-only · user-scoped · Runs on Atlassian". | "A clean hotfix gets a GO. And when data is missing, Blast Radius says so — insufficient evidence is never shown as safe. Blast Radius: release confidence from your team's own context." |
| 2:50–3:00 | End card with app name and "Built on Forge for Codegeist 2026" | (silence / logo) |

## Recording checklist
- [ ] Demo site seeded (`node scripts/seed-demo-site.mjs --apply`), app installed, Rovo enabled, MCP tools enabled.
- [ ] If no dev-tool connector on the site: deploy with `BLAST_RADIUS_DATA_SOURCE=fixture` and keep the "Demo data" banner visible (honesty).
- [ ] Fixture keys are PAY-142…PAY-151; on a fresh site the seeded keys may differ — use `demo/seed/.seed-state.json` to map, or record in fixture mode.
- [ ] Rehearse Rovo prompt once so the answer is cached-in style; cut waiting time in editing.
- [ ] Captions (English) burned in or uploaded as SRT; title "Blast Radius — Codegeist 2026".
- [ ] Upload to 风风's YouTube channel as Public only after 风风 approves.
