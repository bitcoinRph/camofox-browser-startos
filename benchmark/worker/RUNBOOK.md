# Operator runbook — not executed

**STOP: this is a future procedure, not standing approval.** No Cloudflare token,
control-plane API call, DNS lookup/change, upload, public fixture request, custom
domain, WAF rule, Turnstile widget, or deployment was used to build/test this
fixture. All current verification of the fixture is offline. Official runtime/configuration docs have
been consulted read-only; that is not runtime or account validation. Obtain
separate, explicit approval for each live phase.

## 1. Approval and discovery gate (read-only phase first)

Record owner approval naming the Cloudflare account, zone `example.com`,
Worker `camofox-botlab-fixture`, hostname `botlab.example.com`, time window, budget,
allowed paths, and teardown owner. Also authorize the actual browser benchmark;
creating a fixture does not authorize probing other sites or bypassing controls.
Do not take a paid upgrade or enable billing automatically.

Once read-only discovery is explicitly approved:

1. Verify authoritative DNS ownership **and** account control; a hostname resolving
   to Cloudflare is not proof the account can manage its parent zone. Use current
   official Cloudflare docs to verify API/CLI schema and current Free-plan quotas,
   custom-rule availability and Managed Challenge support. Account-specific
   quotas/entitlements remain unverified. Stop on missing entitlement or
   insufficient token scope; do not silently substitute a different plan/control.
2. Read exact existing Worker name, deployments/version, settings, routes,
   workers.dev/preview flags, custom hostname, zone DNS record, widget metadata,
   and relevant security settings/custom rules including execution order. Record
   baseline IDs and redacted settings outside the repository. If the Worker or
   hostname already belongs to another service, stop rather than overwrite it.
3. Inventory inherited WAF/rate-limit/Bot Fight Mode/Access policies and cache
   rules that may affect any fixture path. Do not weaken zone-wide protections
   for this benchmark. Label experiments confounded by inherited controls.
4. Use a narrowly scoped credential in an approved vault, not chat, source code,
   command arguments, shell history, or committed `.dev.vars`. Exact permissions
   depend on the approved operation; do not request global account/DNS authority
   for a Worker-only upload. Never print tokens, siteverify secrets, cookies or IPs.
5. Set a small request/trial ceiling, concurrency 1, and an automatic/manual stop
   time. Stop on unexpected traffic, cost/quota signals, 429s, 5xx bursts, or policy
   conflicts. The Worker is a public test surface, not an authenticated service;
   configure only a separately approved, hostname-scoped access/rate control if
   required, and record that as an experimental condition.

Authoritative documentation to check at that future gate:

- Cloudflare Workers configuration, limits, custom domains and observability.
- Turnstile client integration/CSP and server-side validation (siteverify).
- WAF custom rules, plan limits, expressions, Managed Challenge action and order.

## 2. Local preflight (no remote approval required)

From the repository root, with Node 26+ selected on `PATH` (verified with
v26.12.1; `package.json` deliberately retains `>=26`):

```sh
node --version
node --permission --allow-fs-read=. --test-isolation=none --test worker/test/*.test.mjs
npm --prefix worker run check
git diff --check
```

Do not run `npm install`, `npx`, Wrangler login/deploy/dev, browser navigation,
or cloud API requests as part of offline acceptance. No dependencies need
installing for this suite. It is a Web-API handler harness, not workerd or a real
edge emulator. Tests do not prove runtime/plan/browser behavior.
Do not accept a run under Node 24 or lower merely because permission checks
return false: an unknown permission scope also returns false. The suite requires
both Node 26+ and an implemented `--allow-net` flag, in addition to denied scopes.

After tooling/network use is approved, obtain an explicitly reviewed/pinned
Wrangler release through the normal supply-chain process (no unpinned `npx`).
Review its config schema before proceeding. A future dry build may be run with
that **already installed** binary:

```sh
WRANGLER_SEND_METRICS=false wrangler deploy --config worker/wrangler.toml --dry-run --outdir worker/dist
```

This command is not part of the verified offline suite and was not run. Do not
assume a CLI's dry-run is network-free without checking the selected version.

## 3. Configure and deploy (separate explicit write approval)

Approval must separately cover Worker upload, secret changes, Turnstile widget
creation/reuse, hostname routing/TLS/DNS effects, and the challenge rule. Do not
bundle them into a general "enable Cloudflare" change.

1. Preserve the reviewed baseline and intended rollback version. Keep
   `workers_dev = false`, `preview_urls = false`, and observability disabled.
   No secrets or account IDs are needed in the committed manifest. Do not add
   log sinks, invocation logs, tail consumers, analytics, paid storage, or cron.
2. Upload the reviewed baseline **without any route** only if authorized. That
   baseline returns 503 on Turnstile paths until configured:

   ```sh
   WRANGLER_SEND_METRICS=false wrangler deploy --config worker/wrangler.toml
   ```

   Immediately read back Worker settings, exact script deployment/version and
   route inventory in the approved account. A successful upload message alone
   is not acceptance. Confirm the two public preview flags are still off.
3. Separately approve/create or reuse a real Turnstile widget restricted to
   **only** `botlab.example.com`. Avoid clearance/pre-clearance changes for
   this isolated test. Do not deploy test keys, demo keys, or wildcard hostname
   allowances. Verify the widget hostname/mode by reading its exact record.
4. Set public `TURNSTILE_SITEKEY` and exact `TURNSTILE_HOSTNAME` in the reviewed
   operator deployment copy. Editing `[vars]` on disk does not update a running
   deployment: deploy that reviewed copy before routing or running acceptance.
   Wrangler treats configuration as source of truth and normally overwrites
   dashboard vars on deploy; `keep_vars = true` changes that behavior and must be
   separately reviewed, not silently enabled. Never redeploy the checked-in
   empty-sitekey baseline over the configured fixture. Named environments do
   not inherit vars: define them explicitly and use the same environment/config
   for every upload, secret operation, deployment and readback.

   Provision actual `TURNSTILE_SECRET` and independent
   random `TRIAL_NONCE_SECRET` (32+ high-entropy characters) through the approved
   secret input mechanism. Example interactive commands, never with values in
   command arguments or transcripts:

   ```sh
   wrangler secret put TURNSTILE_SECRET --config worker/wrangler.toml
   wrangler secret put TRIAL_NONCE_SECRET --config worker/wrangler.toml
   wrangler secret list --config worker/wrangler.toml
   ```

   Read back binding **names/types/presence only**; do not retrieve or log values.
   `wrangler secret put` creates a new version and deploys it immediately; it is
   not a passive binding edit. Read back after each mutation and record the final
   active deployment/version, not just the initial code-upload version. By
   contrast, `wrangler versions secret put` creates an undeployed version that
   requires a separately approved `wrangler versions deploy`. Do not mix the two
   flows or assume a new version is active. Later commands must use the same
   reviewed operator configuration copy; examples above name the safe baseline
   only as a path illustration. Verify that the final active version has both
   public vars and both secret bindings without retrieving secret values.
   Rotate the nonce secret to invalidate outstanding trial nonces if needed.
5. Only after separate hostname/DNS approval, add the following reviewed stanza
   to an operator deployment copy of the manifest, not the safe offline baseline:

   ```toml
   [[routes]]
   pattern = "botlab.example.com"
   custom_domain = true
   ```

   Confirm the zone is eligible/active and no DNS/service conflict exists before
   deploying that copy. Custom-domain provisioning can mutate DNS/TLS state;
   this stanza is not harmless configuration. Do not guess an origin CNAME or
   change authoritative nameservers. Read back the exact hostname-to-Worker
   association, DNS change and TLS status after the approved deployment.
6. Create/enable a **single** custom rule only if separately approved and Free
   plan availability is verified. Use the action **Managed Challenge** and the
   exact expression:

   ```text
   (http.host eq "botlab.example.com" and http.request.uri.path eq "/challenge")
   ```

   Do not use a zone-wide rule, wildcard hostname, prefix path, paid Bot
   Management score condition, or disable existing protections. `/`, `/echo`,
   `/diag`, `/turnstile`, and `/turnstile/verify` must not match this new rule.
   Record the created rule ID and phase/order, then read that exact rule back
   and compare expression, action, enabled state and placement. Inspect only
   approved/redacted event evidence; never export raw traffic/identifiers.

## 4. Exact-target readback and live acceptance (separate traffic approval)

Read-only examples for an installed, approved Wrangler version:

```sh
wrangler deployments list --config worker/wrangler.toml
wrangler secret list --config worker/wrangler.toml
```

These do not replace reading exact custom-domain, DNS, WAF-rule and Worker
settings via the current approved Cloudflare dashboard/API. API commands must be
constructed from discovered IDs and current official schemas, not placeholder
IDs pasted into a script. Do not execute undocumented guesses.

Check all of the following before declaring live success:

- Deployed content/version corresponds to the reviewed Git SHA; correct account,
  Worker, hostname and certificate. No unapproved routes, preview URLs, bindings,
  settings, logging sinks or paid services were enabled.
- Fresh isolated browser session per trial. Use the same new UUIDv4 on all paths
  within a trial, and preserve only bounded trial/status/timing metadata. Never
  retain raw HARs, cookies, tokens, IPs, auth headers or full diagnostics by
  default. Record browser/version and authorized experimental conditions.
- Control returns static harmless HTML; `/echo` only contains the allowlist and
  honest optional-field absence; `/diag` updates locally under its nonce CSP.
  Check security headers and that the application adds no `Set-Cookie`.
- New challenge rule matches only the exact host/path. Browser/edge evidence must
  separately establish whether a challenge was served and whether it completed;
  seeing the static `/challenge` marker is **not** proof. Managed Challenge can
  choose not to show an interactive challenge. Existing clearance/inherited
  controls can change outcomes; do not fabricate a forced-challenge result.
- **Mandatory runtime/browser gate, not satisfied by Node tests:** on an approved
  workerd-based HTTPS staging target or real edge using the reviewed compatibility
  date, navigate to configured `/turnstile` in a supported real browser. Verify
  that the genuine widget visibly renders for the expected hostname/action with
  no CSP violation. Complete it and click the native form's submit button; a
  hand-built Request, console fetch, or stubbed success does not satisfy this gate.
  Check that the widget document's response has `Referrer-Policy: same-origin`,
  the browser-generated POST Origin is exactly the HTTPS fixture origin (not
  missing/null), and the real server-side siteverify call yields HTTP 200 with
  correlated `{trial, verified:true}`. Verify cross-origin vendor requests carry
  no Referer; other routes/results retain `no-referrer`. Keep only redacted
  status/trial evidence, never raw token bodies or unredacted network captures.
  Confirm no remoteip, cookies, or arbitrary inbound headers are sent by the
  application to siteverify. Runtime checks have not been performed by this build.
- Negative trials: blank/missing token, changed nonce/trial, duplicate/replayed
  token, wrong/missing/null Origin (including a same-site sibling hostname),
  expired token, and simulated upstream unavailability or 3xx responses must
  never report success. Fail-closed missing-config validation should be performed
  on an approved unrouted/staging copy, not by removing live secrets casually.
- Wrong methods and oversized bodies reject, unknown paths are 404, error bodies
  have the same security headers, and no secrets/provider errors are reflected.
- Check bounded usage/CPU/error signals without enabling sensitive request logs.
  No test here proves current free-tier headroom; stop at the approved cap.

Persist a **redacted** acceptance record: Git SHA, deployed version, approved
resource IDs, exact rule expression/action/order, public flags, secret-name
presence, trial IDs, timestamps/statuses, safe screenshots if needed, and the
teardown deadline. Failed checks remain failed; offline stubs do not substitute
for live evidence.

## 5. Rollback / teardown (explicit destructive-change approval)

Operate only on resources/IDs created by this experiment; restore pre-existing
state from the baseline rather than deleting another service's resources.

1. Stop trials and disable the exact experimental challenge rule. Read back that
   rule's disabled state (or deletion after separate approval); confirm unrelated
   rules and order have not changed.
2. Detach only the experimental custom domain/route and restore only approved
   DNS changes. Read exact route/custom-domain/DNS inventories back. Preserve
   existing TLS/DNS/service state. An HTTP failure alone does not prove deletion.
3. If the Worker pre-existed, restore its approved baseline version/settings and
   remove only the added bindings. Otherwise, after explicit deletion approval:

   ```sh
   wrangler delete --name camofox-botlab-fixture --config worker/wrangler.toml
   ```

   Confirm by listing/getting the exact Worker in the approved account: absent
   when deleted, or exact baseline version/settings when restored. Also read
   back that public preview flags/routes remain off/absent as intended.
4. Delete the Turnstile widget only if this experiment created it and deletion
   was approved; otherwise remove only the approved hostname/config changes.
   Read back absence/restored configuration. Revoke experiment-only API tokens
   and secret bindings through the approved vault/provider process.
5. Remove transient local secret files, safe-browser profiles/cookies and
   unredacted captures according to the approved retention policy. Keep only
   the redacted Git/deployment/rule/trial/teardown record. Do not commit credentials
   or overwrite another operator's artifacts.
6. Final readback: no experimental rule, Worker route/custom-domain, DNS record,
   widget, secret binding, or credential remains unless explicitly retained;
   original settings match baseline. Report residual resources/unknowns plainly.

**No phase in this runbook has been executed by the offline build.**
