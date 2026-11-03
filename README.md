# Blast Radius — know what a release could break before you ship it

> Codegeist 2026 · **Apps for Software Teams** · Forge app for Jira + Rovo + Atlassian MCP + Teamwork Graph
>
> Status (2026-11-03 15:45 SGT): production app **2.0.0** deployed and installed in Jira + Confluence on
> `one-atlas-wdon.atlassian.net`, alongside development **2.4.0**; **141 tests**. Browser verification remains TODO.
> Judges’ sharing link generation is pending. See [deployment status](docs/DEPLOY_STATUS.md).

Before every release an engineering lead has to answer three questions:
**What could this break? Who knows this code? What did we already decide or learn the hard way?**
The answers are scattered across Jira issues, pull requests, CI builds, deployments, Confluence runbooks and ADRs,
and incident tickets. Blast Radius walks **Atlassian Teamwork Graph** from a Jira issue or release version to all of
that context and turns it into:

1. **A go / no-go verdict** — `GO`, `GO_WITH_CAUTION`, `HOLD` or `INSUFFICIENT_EVIDENCE`, with a 0–100 score.
2. **Explainable risks** — every point comes from a named rule, and every rule links to its evidence (PR, build, deployment, page, incident).
3. **A pre-release checklist** — concrete `must / should / nice` actions with suggested owners (reviewer load-balanced, never the PR author).
4. **Who to ask** — experts ranked from authored/approved PRs, owned runbooks and assignments, with recency decay.

The score is **deterministic** (no LLM decides the number). Rovo and external agents only explain it.

## Source / Install

Public source: [W1nnnd/blast-radius](https://github.com/W1nnnd/blast-radius), branch `main`.

Production **2.0.0** is deployed with `BLAST_RADIUS_DATA_SOURCE=twg` and installed in Jira + Confluence on `one-atlas-wdon.atlassian.net`. Development **2.4.0** remains installed on the same site; both environments co-exist.

Judges’ installation link: **TODO — generate in the developer console**. See [deployment status](docs/DEPLOY_STATUS.md) for the distribution steps.

## One engine, three surfaces
| Surface | Manifest module | For |
|---|---|---|
| Jira issue panel (UI Kit) | `jira:issuePanel` | Humans on the issue: verdict, top risks, checklist, experts, evidence coverage; one click to analyze the whole fixVersion |
| Rovo agent "Blast Radius" | `rovo:agent` + 4 `action`s | "Can we ship PAY 2.4.0?" in Rovo Chat or automation |
| Atlassian MCP server | `rovo:mcp` (same 4 actions) | Claude, Cursor and other MCP clients via `https://mcp.atlassian.com/forge/<appId>`, plus open-source [`skills/blast-radius/SKILL.md`](skills/blast-radius/SKILL.md) |

Actions: `get-change-context(issueKey)`, `score-release-risk(projectKey, versionName)`, `find-experts(issueKey)`,
`generate-release-checklist(projectKey, versionName)` → Markdown ready for a PR, Confluence page or Slack.

## How it works

The issue panel, Rovo agent and MCP tools share a deterministic scoring, checklist and expert-ranking engine.

1. **Teamwork Graph first in Forge.** Curated queries retrieve PRs and deployments; six persisted Cypher queries retrieve builds, commits, blockers, pages, releaseIssues and incidents. These queries were registered in TWG Labs and run through `customQuery`. Team context also uses a curated query.
2. **Jira remote-link fallback.** When graph evidence is unavailable or empty, the app uses supported Jira remote-link evidence. Evidence/coverage labels this **"Jira remote link (not Teamwork Graph)"** so remote links are never presented as graph results.
3. **Jira REST issue links.** When the graph has no blockers, Jira issue links provide them. Jira REST also resolves issue keys and release membership when needed.

On the development site, TWG returned **2 pages**, but no dev-tool objects: no GitHub/Bitbucket connector is installed. The seeded remote links supply PR, build and deployment context. Every source failure becomes a coverage note, never a blank panel. Missing evidence lowers confidence and can produce `INSUFFICIENT_EVIDENCE`; missing data is not a safety guarantee.

Forge reads run as the requesting user. The score comes from named rules, not an LLM; Rovo and external agents explain the same engine output. Inputs are validated and agent outputs bounded. See [query details](docs/TWG_VERIFIED_SCHEMA.md).

## Risk model (src/engine/risk.js)
| Category (cap) | Rules (points) |
|---|---|
| Code review (25) | no reviewers (12), changes requested (10), not yet approved (6), diff > 500 lines (5) |
| CI (20) | failed build (15, **blocker**), build still running (4) |
| Deployment (20) | pre-prod deployment failed/rolled back (12), production rollback ≤ 30 days (15, **blocker**), merged but never validated pre-prod (6), open linked incident (10, **blocker**) |
| Scope (15) | unfinished issue (3, high priority 6), blocked by open issue (5), ≥ 3 repositories touched (5) |
| Ownership (10) | unassigned (3), single-author bus factor (5), no owning team (2) |
| Knowledge (10) | runbook stale > 90 days (5), no runbook while deploying to prod (4), decision superseded after merge (3) |
Levels: `low` < 30 ≤ `medium` < 60 ≤ `high`; `critical` = high + at least one blocker.

## Try it locally (no Atlassian account needed)
```sh
npm install
npm test                                        # 141 tests
npm run validate:manifest                       # manifest vs. @forge/manifest JSON schema
node scripts/demo-cli.mjs release PAY 2.4.0 --text   # HOLD · 88/100 · high confidence
node scripts/demo-cli.mjs release PAY 2.3.1 --text   # GO · 0/100
node scripts/demo-cli.mjs issue PAY-1 --text
npm run seed:plan                               # what the demo-site seeding would create
npm run queries:plan                            # persisted Cypher that would be registered
```

## Live development demo

Open [PAY-1](https://one-atlas-wdon.atlassian.net/browse/PAY-1) → **Apps → Blast Radius**. Inspect the verdict and Evidence tab, then use the panel’s release option to analyze **PAY 2.4.0** and open Checklist for suggested reviewers.

The applied **Northwind Pay 2.4.0** seed contains seven release issues (PAY-1…PAY-7), failed CI on PAY-1 and PAY-4, open PRs awaiting approval, and staging-only deployment of `2.4.0-rc1`. Open incident **[INCIDENT] PAY-11** links to PAY-1 and PAY-4. PAY-2/PAY-7 block PAY-1; PAY-8 (2.3.1) blocks PAY-4. Confluence contains a runbook, ADR-024, rollback plan and postmortem.

For an authorized operator with the required local setup, the live scripts support:

```sh
node scripts/seed-live-v2.mjs --inspect
node scripts/seed-live-v2.mjs --dry-run
node scripts/seed-live-v2.mjs --apply
node scripts/live-preview.mjs --issue PAY-1
node scripts/live-preview.mjs --release PAY 2.4.0
```

`--apply` writes the seed to the site; inspect/dry-run first. These commands are documented here, not executed as part of this documentation update.

Saved real outputs from `live-preview.mjs` after seeding:

- [Release 2.4.0](demo/live-preview-release-2.4.0.json): **HOLD, 82/100**; top risks are failed builds on PAY-1/PAY-4 and open incident PAY-11.
- [PAY-1](demo/live-preview-PAY-1.json): **HOLD, 67/100**.

These are **Jira-REST-only previews with TWG disabled**, not captures of the Forge panel. Expect approximately these scores in the panel; TWG pages can change the values slightly. The local fixture CLI above is a separate dataset and can produce different scores.

Rovo Chat: choose agent **Blast Radius**, then ask **"Can we ship PAY 2.4.0?"**. Four actions are shared with `rovo:mcp`. External MCP tools are **not yet enabled**. A site admin must enable them at **Atlassian Administration → Apps → Sites → one-atlas-wdon → Connected apps → Blast Radius → View app details → Tools / “Expose tools via external MCP endpoint”**. Then use `https://mcp.atlassian.com/forge/71f0dc36-ccf4-4d78-88d0-882f02159e9e`.

## Limitations and remaining verification

- No dev-tool connector on this site: remote links are seeded context, not proof of live CI or deployment synchronization. Empty graph results do not prove that no risks exist.
- A persisted page query returned an internal error during setup; failures remain visible in coverage. Later TWG reads returned two pages, which does not establish that every query is healthy.
- Browser verification of the current panel, release view and Rovo response is TODO. MCP verification is TODO after admin enablement.
- Judges’ installation/sharing link generation and video URL are TODO.

## Screenshots (TODO: capture from the live development UI)

TODO: PAY-1 panel.
![Panel on PAY-1](docs/screenshots/panel-pay-1.png)

TODO: release 2.4.0 view.
![Release 2.4.0 analysis](docs/screenshots/release-2.4.0.png)

TODO: Evidence tab with provenance and coverage notes.
![Evidence and coverage](docs/screenshots/evidence-coverage.png)

TODO: Rovo chat with Blast Radius.
![Rovo chat](docs/screenshots/rovo-chat.png)

TODO: MCP client after tools are enabled.
![MCP client](docs/screenshots/mcp-client.png)

## Repository map
`manifest.yml` · `src/` (index → handlers → service → engine / graph / jira) · `src/frontend/index.jsx` (UI Kit) ·
`prompts/agent-prompt.txt` · `skills/blast-radius/SKILL.md` · `scripts/` · `demo/seed/` · `test/` · `docs/`
([Devpost text](docs/DEVPOST_SUBMISSION.md), [video script](docs/DEMO_VIDEO_SCRIPT.md), [deploy runbook](docs/DEPLOY_AFTER_LOGIN.md)).

## License

[MIT License](LICENSE) © 2026 W1nnnd.
