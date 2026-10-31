# Blast Radius — know what a release could break before you ship it

> Codegeist 2026 · **Apps for Software Teams** · Forge app for Jira + Rovo + Atlassian MCP + Teamwork Graph
>
> Status (2026-10-31): complete locally, 101 unit tests green, manifest validated against the Forge schema.
> Not yet registered/deployed — see [docs/DEPLOY_AFTER_LOGIN.md](docs/DEPLOY_AFTER_LOGIN.md).

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

## One engine, three surfaces
| Surface | Manifest module | For |
|---|---|---|
| Jira issue panel (UI Kit) | `jira:issuePanel` | Humans on the issue: verdict, top risks, checklist, experts, evidence coverage; one click to analyze the whole fixVersion |
| Rovo agent "Blast Radius" | `rovo:agent` + 4 `action`s | "Can we ship PAY 2.4.0?" in Rovo Chat or automation |
| Atlassian MCP server | `rovo:mcp` (same 4 actions) | Claude, Cursor and other MCP clients via `https://mcp.atlassian.com/forge/<appId>`, plus open-source [`skills/blast-radius/SKILL.md`](skills/blast-radius/SKILL.md) |

Actions: `get-change-context(issueKey)`, `score-release-risk(projectKey, versionName)`, `find-experts(issueKey)`,
`generate-release-checklist(projectKey, versionName)` → Markdown ready for a PR, Confluence page or Slack.

## Architecture
```
 Jira issue panel ─┐                         ┌─ engine/risk.js       19 declarative rules, 6 capped categories
 Rovo agent ───────┼─> handlers.js ─> service ┼─ engine/checklist.js  must/should/nice + reviewer suggestion
 MCP clients ──────┘   (validation,   .js     ├─ engine/experts.js    weighted, recency-decayed ranking
                        bounded output)       └─ engine/coverage.js   confidence from data coverage
                                │
                     graph/adapter.js  (one interface, swappable)
                     ├─ twgAdapter.js    Teamwork Graph: curated queries + persisted Cypher (customQuery), asUser()
                     │    └─ jira/jiraRest.js  key→ARI, fixVersion JQL, issue-link fallback
                     └─ fixtureAdapter.js  demo dataset (demo/seed/dataset.json)
```
- **Teamwork Graph done the current way.** Raw `cypherQuery` is no longer available to new apps, so Blast Radius uses
  the curated fields `jiraWorkItemLinkedExternalPullRequests`, `jiraWorkItemLinkedExternalDeployments` and
  `atlassianUserInTeams`, plus **persisted Cypher** queries (builds, commits, blockers, linked pages, incidents, release
  membership) registered once by `scripts/register-persisted-queries.mjs` and executed with `customQuery`.
  Every name was checked against the public docs: [docs/TWG_VERIFIED_SCHEMA.md](docs/TWG_VERIFIED_SCHEMA.md).
- **Least privilege:** `read:jira-work` + 12 per-object `read:graph:<object>:<product>` scopes. All calls run `asUser()`, so
  results are permission-filtered for the person asking. Read-only; no egress; Runs on Atlassian.
- **Fail closed, never falsely green.** A missing scope returns empty rows in TWG; Blast Radius records per-source
  `coverage` and drops confidence, and the verdict becomes `INSUFFICIENT_EVIDENCE` instead of `GO`.
- **Safe for LLMs.** Inputs validated (keys normalized, context fallback), outputs bounded (≤25 items, ≤2,000 chars,
  <100 KB), errors returned as `{error:{code,message}}`, and the agent prompt treats graph text as untrusted data.

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
npm test                                        # 101 tests
npm run validate:manifest                       # manifest vs. @forge/manifest JSON schema
node scripts/demo-cli.mjs release PAY 2.4.0 --text   # HOLD · 88/100 · high confidence
node scripts/demo-cli.mjs release PAY 2.3.1 --text   # GO · 0/100
node scripts/demo-cli.mjs issue PAY-142 --text
npm run seed:plan                               # what the demo-site seeding would create
npm run queries:plan                            # persisted Cypher that would be registered
```

## Demo data
`demo/seed/dataset.json` is a fictional fintech, **Northwind Pay**: project `PAY`, releases `2.4.0` (risky) and `2.3.1`
(clean hotfix), 8 people in 3 teams, 3 repositories, 10 PRs, 8 builds, 8 deployments, 6 Confluence pages, 1 incident.
`scripts/seed-demo-site.mjs --apply` recreates the Jira/Confluence side on a `forge site provision` demo site
(versions, issues, "Blocks" links, pages that link the issues, remote links to PRs). PR/build/deployment objects reach
Teamwork Graph only through a connected dev tool, so the panel can also run on the dataset with
`BLAST_RADIUS_DATA_SOURCE=fixture` (clearly labelled "Demo data").

## Repository map
`manifest.yml` · `src/` (index → handlers → service → engine / graph / jira) · `src/frontend/index.jsx` (UI Kit) ·
`prompts/agent-prompt.txt` · `skills/blast-radius/SKILL.md` · `scripts/` · `demo/seed/` · `test/` · `docs/`
([Devpost text](docs/DEVPOST_SUBMISSION.md), [video script](docs/DEMO_VIDEO_SCRIPT.md), [deploy runbook](docs/DEPLOY_AFTER_LOGIN.md)).

MIT License © 2026 W1nnnd.
