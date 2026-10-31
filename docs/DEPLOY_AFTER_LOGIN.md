# Deploy after login — exact command runbook

Everything here runs **after** 风风 has (1) an Atlassian account, (2) an API token from
https://id.atlassian.com/manage-profile/security/api-tokens stored in the vault, and (3) approved
registering/deploying the app. Nothing in this file has been executed yet.

Commands were checked against Forge CLI **15.0.0** `--help` on 2026-10-31 and the official
Forge docs (`forge login` env vars, Distribution → Sharing). Teamwork Graph steps follow the
official *Persisted Cypher queries* guide (raw `cypherQuery` is unavailable to new apps).

> Secrets rule: never paste the token into chat, files, commits or command lines that end up in
> shell history. Load it into the environment with `read -s` (or the vault's secure fill) only.

## 0. Environment (once per shell)
```sh
cd /workspace/codegeist2026/blast-radius
export FORGE_DISABLE_ANALYTICS=1
read -r  FORGE_EMAIL          # Atlassian account email
read -rs FORGE_API_TOKEN      # API token (hidden input)
export FORGE_EMAIL FORGE_API_TOKEN
# The seed/registration scripts reuse the same credentials:
export ATLASSIAN_EMAIL="$FORGE_EMAIL" ATLASSIAN_API_TOKEN="$FORGE_API_TOKEN"
```
The box has no OS keyring, so `forge` reads `FORGE_EMAIL` / `FORGE_API_TOKEN` directly
(documented fallback "If a keychain isn't available…"). `forge login` is therefore optional;
if wanted: `npx --no-install forge login --non-interactive -u "$FORGE_EMAIL" -t "$FORGE_API_TOKEN"`
(only in a shell with history disabled: `set +o history`).

```sh
npx --no-install forge whoami            # expect the account name/email
npm ci && npm test                       # must be all green before deploying
```

## 1. Demo site (Rovo + Teamwork Graph + seeded enterprise data)
```sh
npx --no-install forge site provision    # interactive; one demo site per person, 90 days
```
Record the site host it prints, then `export ATLASSIAN_SITE=<name>.atlassian.net`.
If provisioning is unavailable, create a free Cloud developer site at
https://developer.atlassian.com/cloud/ and use it instead (Rovo must be enabled by the admin).

## 2. Register the app (creates the app ID)
```sh
npx --no-install forge register "Blast Radius" --accept-terms --non-interactive
grep -n "app/" manifest.yml               # placeholder replaced with ari:cloud:ecosystem::app/<uuid>
export FORGE_APP_ID="$(grep -oE 'ari:cloud:ecosystem::app/[0-9a-f-]+' manifest.yml)"
```
If `register` refuses because the manifest already has an id, edit `app.id` back to the
placeholder and retry. Commit the new id locally.

## 3. Lint (manifest + scopes + source)
```sh
npx --no-install forge lint
npx --no-install forge lint --fix        # only if lint suggests auto-fixable issues
```
Expected warnings to review: Preview modules (`rovo:mcp`), `read:graph:*` scopes.

## 4. Deploy (development first)
```sh
npx --no-install forge variables set BLAST_RADIUS_DATA_SOURCE twg -e development
npx --no-install forge deploy -e development --non-interactive
```
For a fixture-backed demo environment (no dev-tool connector on the site):
`npx --no-install forge variables set BLAST_RADIUS_DATA_SOURCE fixture -e development` then redeploy.

## 5. Install onto the demo site
```sh
npx --no-install forge install --demo-site -p Jira -e development --non-interactive --confirm-scopes
# or, for a developer site:
npx --no-install forge install -s "$ATLASSIAN_SITE" -p Jira -e development --non-interactive --confirm-scopes
npx --no-install forge install list
```
Confluence context (pages linked to issues) comes through Teamwork Graph, so a Jira install is enough.

## 6. Register persisted Cypher queries (Teamwork Graph)
```sh
node scripts/register-persisted-queries.mjs --dry-run      # review query text
node scripts/register-persisted-queries.mjs --apply        # POST /gateway/api/twg/cypher-queries
git diff src/graph/queryKeys.js                            # keys written by the script
npx --no-install forge deploy -e development --non-interactive
```
Wait ~1 minute (propagation) before testing; `QUERY_NOT_FOUND` during that window is expected.
Then open https://teamwork-graph.atlassian.com/query-builder, choose the site, and verify every
query marked **NEEDS-LIVE** in `docs/TWG_VERIFIED_SCHEMA.md` (inverse `blocks`, page→issue via
`content_entity_links_entity`, User union fields). Fix the Cypher text if needed → re-run `--apply`
(new text = new key) → redeploy.

## 7. Seed the demo data
```sh
node scripts/seed-demo-site.mjs --dry-run                 # prints every REST call, no network
node scripts/seed-demo-site.mjs --apply --space PAYDOCS   # creates versions, issues, links, pages, remote links
```
Pre-requisites the script checks and explains: Jira software project **PAY** and Confluence
space **PAYDOCS** exist (create in UI if missing). External PRs/builds/deployments in Teamwork
Graph only come from a connected dev tool (GitHub/Bitbucket for Jira); the script adds remote
links for visibility and the fixture mode covers the full demo.

## 8. Enable Rovo + external MCP
1. Site admin → Atlassian Administration → Apps → Sites → *site* → Connected apps → **Blast Radius**
   → app details → turn on the MCP tools (`get-change-context`, `score-release-risk`,
   `find-experts`, `generate-release-checklist`). External exposure is off by default.
2. Same page → Permissions: confirm every `read:graph:*` scope is allowed.
3. MCP endpoint for Claude/Cursor: `https://mcp.atlassian.com/forge/<uuid>` where `<uuid>` is the
   part after `ari:cloud:ecosystem::app/` → `echo "${FORGE_APP_ID##*/}"`.
4. Test in Rovo Chat: open the **Blast Radius** agent → "Can we ship PAY 2.4.0?".

## 9. Production + judge installation link
```sh
npx --no-install forge variables set BLAST_RADIUS_DATA_SOURCE twg -e production
npx --no-install forge deploy -e production --non-interactive
npx --no-install forge install -s "$ATLASSIAN_SITE" -p Jira -e production --non-interactive --confirm-scopes
npx --no-install forge eligibility -e production          # "Runs on Atlassian" check
npx --no-install forge console                            # prints developer console URL
```
Then in the developer console (browser, logged in as 风风): **Distribution → Distribution controls →
Edit → Sharing** → fill app details (name, description, privacy/security links from
docs/DEVPOST_SUBMISSION.md) → Save → **copy the installation link**. Paste it into Devpost
"Installation link" and the testing instructions. Verify on a second clean site that the link
installs and the panel renders.

Marketplace bonus note (official docs): apps *submitted for listing* "can't be shared via
installation link" → for Marketplace, register a **second copy** (`forge register "Blast Radius
(Marketplace)"` in a separate checkout) and submit that one; keep this app for the judges' link.

## 10. Smoke checklist before the video
- [ ] `forge logs -e development --since 15m` shows no errors after opening PAY-142 panel
- [ ] Panel shows verdict, categories, checklist, experts, evidence links
- [ ] Rovo agent answers the 3 conversation starters with links
- [ ] Claude/Cursor MCP client lists 4 tools and `score-release-risk` returns JSON
- [ ] Coverage tab says which sources are missing (never "safe" on empty data)
