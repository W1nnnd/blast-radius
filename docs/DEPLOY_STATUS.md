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

## Blocker: persisted query registration

`POST /gateway/api/twg/cypher-queries` returns **401** with `x-failure-category: FAILURE_CLIENT_AUTH_MISMATCH` for API-token basic authentication. Jira REST and the GraphQL gateway work with the same token.

Submit the queries through **TWG Labs / query builder in a logged-in browser**, write the returned keys into `src/graph/queryKeys.js`, then redeploy.

## Remaining work

- Register queries via browser and redeploy. Until then, consider `BLAST_RADIUS_DATA_SOURCE=fixture` for the demo.
- Verify `NEEDS-LIVE` queries.
- Open the issue panel on `PAY-1` in a browser and check Forge logs.
- Enable MCP tools in admin.
- Align demo scripts/video with live key `PAY-1`; they currently reference `PAY-142`.
- Deploy to production and create a sharing link **only after user approval**.
