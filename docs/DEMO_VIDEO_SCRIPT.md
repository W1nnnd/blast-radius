# Demo video script — Blast Radius (maximum 3 minutes)

Record the development app **2.4.0** on `one-atlas-wdon.atlassian.net`. Browser verification is TODO; rehearse against the actual UI and use the displayed values. REST preview reference values are PAY-1 **HOLD 67/100** and release 2.4.0 **HOLD 82/100**; TWG pages can change panel scores slightly.

| Time | Shot | Narration |
|---|---|---|
| 0:00–0:15 | Open `https://one-atlas-wdon.atlassian.net/browse/PAY-1`, then Apps → Blast Radius. | “Can we ship Northwind Pay 2.4.0? Blast Radius brings release evidence into the Jira issue where the team is working.” |
| 0:15–0:40 | Show PAY-1 verdict **HOLD**, displayed score and top risks. Point to failed CI and incident PAY-11. | “This change is on hold. Its CI failed, and an open incident is linked to it. The score comes from deterministic rules, with evidence behind the risks.” |
| 0:40–1:05 | Open **Evidence**. Show provenance labels and coverage notes. | “In Forge, Teamwork Graph is queried first. This site returned two pages, but has no dev-tool connector. The fallback is labelled ‘Jira remote link, not Teamwork Graph.’ Jira issue links supply blockers when the graph has none. Source failures appear as coverage notes.” |
| 1:05–1:30 | Use the panel’s release option to **Analyze release 2.4.0**. Show HOLD and top risks for PAY-1, PAY-4 and PAY-11. | “Now analyze the whole release: seven issues. Failed builds on PAY-1 and PAY-4, plus incident PAY-11, keep the release on hold. The release candidate has staging evidence, not production validation.” |
| 1:30–1:50 | Open **Checklist**; show build/incident actions and suggested reviewers for approval items. | “The checklist turns risks into next steps: fix the builds, resolve the incident, and obtain approving reviews. Suggested reviewers help the team decide who to ask.” |
| 1:50–2:25 | Rovo Chat → agent **Blast Radius** → **“Can we ship PAY 2.4.0?”** Show the actual response and evidence links. | “The same engine is available through the Blast Radius Rovo agent. Ask about the release in plain language, then follow the evidence and checklist. The language model explains the result; it does not choose the score.” |
| 2:25–2:45 | **Optional, only if enabled and verified:** MCP client calls `score-release-risk` with `projectKey: PAY`, `versionName: 2.4.0`; show actual result. Otherwise omit this shot. | “After an admin enables external MCP tools, a compatible client can call the same release-risk action.” |
| 2:45–3:00 | Return to panel; closing card with app name. If MCP shot omitted, close at 2:40. | “Blast Radius makes release risk explainable, shows where evidence came from, and gives the team concrete actions before shipping.” |

## Recording checklist

- [ ] TODO: browser-verify PAY-1, the release option, Evidence labels, Checklist and Rovo response on development 2.4.0.
- [ ] Seed v2 is already applied, including PAY-11. If reseeding is needed, inspect/dry-run before an authorized `node scripts/seed-live-v2.mjs --apply`.
- [ ] Use live development mode; keep fallback provenance and missing-source notes visible.
- [ ] MCP is **not yet enabled**. Include its optional shot only after admin enablement and a successful client call to `score-release-risk`.
- [ ] MCP endpoint: `https://mcp.atlassian.com/forge/71f0dc36-ccf4-4d78-88d0-882f02159e9e`.
- [ ] Show actual results; do not substitute the REST-only JSON preview for a panel or MCP capture. Do not narrate a production rollback or a clean-release result that has not been verified.
- [ ] Capture the five README screenshot placeholders; keep the final edit at or below 3:00, including the closing card.
- [ ] TODO: video URL. Production deployment and judges’ sharing link remain pending owner approval.
