# Deployment status

As of **2026-11-03 15:45 SGT**.

## Production deployment — 2026-11-03 15:45 SGT

- Production app **2.0.0** is deployed with `BLAST_RADIUS_DATA_SOURCE=twg`.
- Installed on `one-atlas-wdon.atlassian.net` in **Jira** (installation `5b61467e-cb9c-4896-b55e-2819d14db88f`) and **Confluence** (installation `d57fb83f-7807-4ca4-b041-a468848be85f`).
- Development **2.4.0** remains installed on the same site: Jira installation `eb77711d-…`, Confluence installation `57c71cde-…`. Both environments co-exist.
- Public source: [W1nnnd/blast-radius](https://github.com/W1nnnd/blast-radius), branch `main`, [MIT license](../LICENSE).
- Judges’ production installation link is published in [README](../README.md#source--install).

## Sharing

- Date: **2026-11-03**.
- Distribution status: **Sharing** (anyone with the link), **production**.
- Products: **Jira + Confluence**; installing site admins should install on both.
- Installation link: published in [README](../README.md#source--install).
- Privacy policy: https://github.com/W1nnnd/blast-radius#privacy
- Support: https://github.com/W1nnnd/blast-radius
- Terms: [LICENSE (MIT)](https://github.com/W1nnnd/blast-radius/blob/main/LICENSE).

## 2026-11-03 live demo v2 — current status

- Development app **2.4.0** deployed on **2026-11-03**, installed in **Jira + Confluence** on `one-atlas-wdon.atlassian.net`. Production **2.0.0** is also deployed and installed on this site; judges’ production sharing link is published in README.
- `scripts/seed-live-v2.mjs` applied the **Northwind Pay 2.4.0** story: seven release issues PAY-1…PAY-7; failed CI on PAY-1/PAY-4; open PRs awaiting approval; staging-only `2.4.0-rc1`; open **[INCIDENT] PAY-11** linked to PAY-1/PAY-4. PAY-2/PAY-7 block PAY-1, and PAY-8 (2.3.1) blocks PAY-4. Confluence includes the runbook, ADR-024, rollback plan and postmortem.
- Forge uses TWG first (curated PR/deployment queries and six persisted Cypher queries registered in TWG Labs). TWG returned **two pages**, but no dev-tool objects because the site has no GitHub/Bitbucket connector. Jira remote links supply fallback evidence, labelled **“Jira remote link (not Teamwork Graph)”** in Evidence/coverage. Jira REST issue links provide blockers when the graph has none. Every source failure becomes a coverage note, never a blank panel.
- Real outputs of `node scripts/live-preview.mjs` after seeding are saved as [release 2.4.0](../demo/live-preview-release-2.4.0.json) (**HOLD 82/100**) and [PAY-1](../demo/live-preview-PAY-1.json) (**HOLD 67/100**). These previews are **Jira-REST-only, with TWG disabled**. Release top risks: failed CI on PAY-1/PAY-4 and incident PAY-11; checklist includes suggested reviewers. Panel values may differ slightly when TWG adds pages.
- Current test count: **141**. Earlier counts and versions below are historical.

Remaining work for this live demo:

- **TODO: browser verification** — open [PAY-1](https://one-atlas-wdon.atlassian.net/browse/PAY-1), inspect verdict and Evidence/coverage, analyze PAY 2.4.0 through the panel’s release option, inspect Checklist/reviewers, and verify the Rovo agent **Blast Radius** with “Can we ship PAY 2.4.0?”. Capture screenshots and video after verification.
- **TODO: enable and verify MCP** — not yet enabled. Site admin path: **Atlassian Administration → Apps → Sites → one-atlas-wdon → Connected apps → Blast Radius → View app details → Tools / “Expose tools via external MCP endpoint”**. Endpoint: `https://mcp.atlassian.com/forge/71f0dc36-ccf4-4d78-88d0-882f02159e9e`; four tools share the Rovo actions. Verify `score-release-risk` after enablement.
- Judges’ sharing link is published in README. Video URL: **TODO**.
- Dev-tool connector coverage and persisted-query health still need verification; the earlier page-query internal error remains relevant history even though later TWG reads returned pages.

## Earlier deployment history

The entries below describe earlier stages and are superseded by the live demo v2 status above where they differ.

## Completed

- Developer Space: `fengfeng-dev`.
- Registered app: `ari:cloud:ecosystem::app/71f0dc36-ccf4-4d78-88d0-882f02159e9e`.
- Renamed manifest function key `generateReleaseChecklist` to `releaseChecklist` for Forge's 23-character limit; handler unchanged. `forge lint` is clean.
- Development environment: `BLAST_RADIUS_DATA_SOURCE=twg`; deployed version **2**, eligible for **Runs on Atlassian**.
- Installed in Jira and Confluence on [demo site](https://one-atlas-wdon.atlassian.net), which expires **2027-02-01**. Installation ID: `eb77711d-1dce-47b6-8c82-4790e66d269a`.
- Created via REST: Jira scrum project `PAY` (ID `10234`) and Confluence space `PAYDOCS` (ID `4292611`).
- Seed applied: versions `2.4.0` and `2.3.1`, 10 issues, 1 blocks link, 6 pages, and 10 PR remote links. Dataset keys `PAY-142`–`PAY-151` map to live keys `PAY-1`–`PAY-10`; see `demo/seed/.seed-state.json`.

## Persisted queries (done 2026-11-03)

Registered through TWG Labs query builder (logged-in browser) under this app; keys are in `src/graph/queryKeys.js`:

| Source | Key | UI test on PAY-1 |
|---|---|---|
| builds | `3d6890a5-b11d-4aad-b467-ce4fc7dd92a3` | ran, empty (no dev-tool connector) |
| commits | `78f616b5-24a3-48a0-98e1-bba0c489f740` | result not read |
| blockers | `6fe388c5-0e88-4dd7-ba89-51cb6b9bb45f` | ran, empty |
| pages | `a318fc0b-25e6-4ef1-a386-f9413464497b` | **"There was an issue running this query, please reach out to Atlassian Support"** — app degrades: coverage note with error code |
| releaseIssues | `47563b9e-f1b2-43bd-8585-8cbab9d12936` | ran, empty |
| incidents | `e9492a67-35bb-4ba5-8bc9-4df0ffc8fbc7` | ran, empty |

Execution uses `customQuery(queryKey, queryParams: { id: <ARI> }, first: 25, after)`. Each failing source logs `[blast-radius] twg source=<s> code=<CODE>`; each issue analysis logs `[blast-radius] twg counts {...}` (counts only).

Development redeployed as **2.1.0** (minor; both installs on major 2 show Up-to-date, no upgrade needed). `forge lint` clean, `npm test` 108/108.

The `API-token` registration endpoint still returns 401 `FAILURE_CLIENT_AUTH_MISMATCH`; use the browser for any new query text.

## Fix 2026-11-03 15:xx SGT — panel "Unable to load analysis" (dev 2.2.0)

Root cause (forge logs, 14:56 SGT, dev 2.1.0): every invocation crashed at module load:
`TypeError: resolver_out_namespaceObject is not a constructor at getDefinitions (webpack://blast-radius/src/index.js:78:18)`.
`package.json` is `"type": "module"`, so Forge's webpack treats `src/index.js` as strict ESM and a default import of a CommonJS package (`@forge/resolver`, `@forge/api`) yields the whole `module.exports` object, not `exports.default`.
Fix: namespace imports + `src/forgeInterop.js` (`resolveDefaultExport`, `resolveNamedExport`); verified by a local webpack bundle (old code throws on load, new code exports `handler`).
Also: graph sources read concurrently (7 in parallel, team reads capped at 10 people); every TWG failure is per-source coverage; panel verdict is built from Jira REST (issue links, fix versions, labels, status) when all graph sources fail; the frontend renders the analysis whenever a verdict is present.
Deployed development **2.2.0**; installs on major 2 Up-to-date; lint clean; `npm test` 116/116.

## Fix 2026-11-03 ~15:15 SGT — all persisted queries "graph request unavailable (UNKNOWN)" (dev 2.3.0)

Logs at 15:03 SGT (dev 2.2.0) showed `twg source=<pages|builds|incidents|blockers|commits> code=UNKNOWN` for every persisted source.
A direct probe of `/gateway/api/graphql/twg` with the same `CUSTOM_QUERY` returned HTTP 200 with
`"You must set an operation name of the shape `[company]_[operation]` with company >= 3 chars and operation >= 4 chars and max length 100"` (`classification: DataFetchingException`, no `code`).
The operation was named `BlastRadiusPersisted`; renamed to `BlastRadius_persistedQuery`. With the new name the gateway accepts the query, and the only remaining error outside Forge was `MISSING_TARGET_AUDIENCE` (expected for a non-app token).
Logs now print `[blast-radius] twg {"source","status","code","classification","message"}`, with the message limited to 160 characters and identifiers redacted. A test enforces the operation-name pattern on all queries. Tests: 120/120. Lint: clean.

## Demo key

Live demo issue is **PAY-1** (dataset `PAY-142`, the richest: blocked by PAY-2, linked pages/remote PR links). Manifest starters, docs and skill now say PAY-1; fixture mode accepts PAY-1..PAY-10 as aliases of PAY-142..PAY-151.
Panel test URL: https://one-atlas-wdon.atlassian.net/browse/PAY-1

## Earlier remaining-work snapshot (superseded above)

- Open the PAY-1 panel in a browser, then `forge logs -e development --since 15m` to see per-source codes/counts (no invocation logged yet).
- `pages` query: internal Atlassian error; consider re-registering with a different traversal (e.g. `jira_work_item_links_confluence_page` style relationship) or report to Atlassian.
- Dev-tool data (builds/commits/PRs/deployments) is empty without a GitHub/Bitbucket connector.
- Verify `NEEDS-LIVE` queries return data once links exist.
- Enable MCP tools in admin.
- Production deployment is now complete (see above); judges’ sharing link is now published in README.
