# Offline Worker implementation boundary

Placeholder reference only. Another task owns any Cloudflare Worker source,
configuration, account/DNS changes, credentials, deployment and live verification.
No Worker code, wrangler configuration, domain, zone ID, account ID or deploy
command is provided here. The owned loopback Python fixture is self-contained.
A future Worker must implement only authorized owned challenge-like fixtures,
not third-party challenge reproduction or bypass. A Worker result is a separate
fixture population and must not be silently combined with local results.
