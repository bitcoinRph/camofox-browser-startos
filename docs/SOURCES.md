# Source provenance

This repository is an owned consolidation of three reviewed components. It uses
file snapshots rather than merged repository histories so private benchmark
history, credentials, obsolete deployment automation, and unrelated author
assets are not carried into the public repository.

## StartOS package and gateway

- Location: repository root
- Source repository: `bitcoinRph/camofox-browser-startos`
- Consolidation base: `aeb6acdbdaad5714ab03598f7572e761380b9fc9` (`master`)
- Runtime image: `ghcr.io/bitcoinrph/camofox-browser:1.18.1-startos.1`
- OCI index digest: `sha256:e545da36937765eaf2480e07e81aeaf97c13589d7531ea77152b723319b0daaf`

The repository reorganization does not alter the already installed StartOS
package. The installed package remains version `1.18.1:2`. Because repository
metadata is changing, any new package build must use a new wrapper revision rather
than republishing different bytes as `1.18.1:2`.

## Browser source

- Location: `browser/`
- Upstream project: `jo-inc/camofox-browser`
- Upstream base: `39c82094013480b373df6600d44c7f036f58356e`
- Runtime-image source snapshot: `ea40b5168a1a652ca097ae36ec0c934bca04d004`
- License: MIT; original Jo, Inc copyright is retained in `browser/LICENSE`

The import excludes inherited release/publishing workflows, Cloudflare crash
relay deployment code, Railway deployment configuration, funding/CODEOWNERS
files, release scripts, and author profile/logo assets. Those exclusions prevent
this repository from publishing packages, deploying telemetry, or implying
ownership of unrelated upstream infrastructure.

The current `browser/` tree starts from that reviewed snapshot and adds the
public-import metadata, test compatibility, and telemetry-default hardening in
this consolidation change. The already published runtime image was built from
`ea40b5168a1a652ca097ae36ec0c934bca04d004`, before those consolidation-only
telemetry changes. StartOS still forces crash reporting off in the installed
package. A future image build is required before the source-level opt-in default
and empty relay become runtime-image defaults.

## Benchmark and Worker fixture

- Location: `benchmark/`
- Private source snapshot: `b4e8a842c003de0e809ae24ca7c21ff9537167a5`
- Import form: reviewed file snapshot without private Git history
- License: MIT; Copyright (c) 2026 Freehold AI LLC, in `benchmark/LICENSE`

The public import replaces machine-specific paths with `<repo>/benchmark` or
`<python>` and replaces owned deployment hostnames with reserved example
domains. Details are recorded in `benchmark/evidence/SANITIZATION.md`.

The benchmark contains source, schemas, synthetic fixtures, and verification
evidence. It does not include credentials, production cookies, customer data,
real target lists, collected live-site results, or deployment authorization.
The Worker fixture has no deployment workflow, account ID, route, or live site
key.

## Security and operational boundaries

- REST, MCP, VNC, and noVNC are private service interfaces.
- API-key authentication remains enabled.
- noVNC remains off except during a short operator-approved interactive login.
- Ordinary Chromium remains the default Hermes browser; Camofox is an escalation
  backend.
- Do not use this project to defeat CAPTCHA, managed challenges, login gates,
  access controls, subscription gates, or rate limits.
- Do not add publishing, deployment, telemetry, or recurring third-party probe
  automation without explicit review and approval.
