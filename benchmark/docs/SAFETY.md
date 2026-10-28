# Target and execution safety

Current policy is an exact literal allowlist: HTTP, host `127.0.0.1`, optional valid
nonzero port, and only the thirteen owned fixture GET routes. No hostname/DNS,
credentials, query string, fragment, percent-encoded path, non-loopback address,
alternative numeric IP representation, file/data/javascript URL, external endpoint
or redirect is accepted. `localhost` is deliberately not accepted. URL validation
is static; the harness never resolves or requests a target.

The owned server binds loopback only, checks Host and Origin, sets no cookies,
logs no client/URL/upload content and adds no-store/nosniff/CSP headers. Fixture
HTML has no external assets. The popup opens same-origin owned content only.
Upload action accepts at most 4096 bytes and discards without parsing, persisting,
executing or reflecting them; use dummy data only. Download is a fixed harmless
text attachment. These are capability surfaces, not primary automation actions.

Do not use the server on shared/untrusted hosts; loopback is not authentication
against other local users. Do not expose it via tunnel, reverse proxy or public
interface. Test server is a development fixture, not a hardened public service.
The offline extractor parses bounded source HTML, skips script/style text, caps
characters/nodes and does not load frames or execute scripts. A future real
browser runner must separately enforce redirect/subresource/origin/response and
resource limits; calling `safe_url` alone does not enforce browser egress.

Any future external panel needs explicit owner approval, a new schema version,
robots/terms/rate/permission review and a frozen target inventory. Exclude login,
paywalls, financial/medical/customer data, invasive collection, purchases, form
submissions, CAPTCHA solving, rate-limit evasion and restricted resources. Current
schema permits no such panel. External targets are intentionally absent.

No network package install, external browsing, DNS provider action, Cloudflare
write, browser adapter call, live Camofox call, secret reading or push is part of
this deliverable. `worker-reference/README.md` is a handoff boundary, not a Worker.
