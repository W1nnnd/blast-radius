# Deployment status

As of **2026-11-03 SGT**.

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

## Remaining work

- Open the PAY-1 panel in a browser, then `forge logs -e development --since 15m` to see per-source codes/counts (no invocation logged yet).
- `pages` query: internal Atlassian error; consider re-registering with a different traversal (e.g. `jira_work_item_links_confluence_page` style relationship) or report to Atlassian.
- Dev-tool data (builds/commits/PRs/deployments) is empty without a GitHub/Bitbucket connector.
- Verify `NEEDS-LIVE` queries return data once links exist.
- Enable MCP tools in admin.
- Deploy to production and create a sharing link **only after user approval**.
