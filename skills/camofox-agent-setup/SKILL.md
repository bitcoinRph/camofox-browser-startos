---
name: camofox-agent-setup
description: Use when connecting an AI agent to the Camofox Browser service on StartOS, or when a connection fails. Gives setup for Claude Code, Codex, Hermes Agent, OpenClaw, and raw REST. Also covers URLs, the API key, TLS trust, and troubleshooting.
metadata: {"hermes": {"tags": ["browser", "camofox", "setup", "mcp", "startos"], "related_skills": ["camofox-stealth-browsing", "camofox-login-handoff"]}, "openclaw": {"emoji": "🔌"}}
---

# Camofox agent setup

The Camofox Browser service on StartOS has one API key. The key works on every route. Each client sends it as `Authorization: Bearer <KEY>`.

## Get the URLs and the key

Ask the user to run the `Connection Info` action of the Camofox Browser service. The action shows:

- the REST API URL or URLs (port 9377),
- the MCP URL or URLs (port 9378, path `/mcp`),
- the API key,
- the noVNC URL and password, only while Interactive Login is on,
- copyable setup text for each client below.

Do not ask the user to paste the key into the chat. Ask the user to put the key in an environment variable or a `.env` file. The examples use `CAMOFOX_API_KEY`.

Never write the key in a file that goes into version control.

## Choose an address

| Client location | Address to use |
|---|---|
| A service on the same StartOS server | The bridge address. Usually `http://10.0.3.1:9377` for REST and `http://10.0.3.1:9378/mcp` for MCP. The port can differ. Read it in `Connection Info`. |
| A device on the home network | A LAN address from `Connection Info`. |
| A device elsewhere | A Tor address or a clearnet domain from `Connection Info`, only if the user enabled it for that interface. |

The user decides which addresses exist. Use only the addresses that `Connection Info` shows.

`https://*.local` addresses use a certificate from the StartOS root CA. A client on another device must trust that CA. Without it, you get a TLS error. Read the TLS section below.

## Claude Code

```bash
export CAMOFOX_API_KEY='<KEY>'
claude mcp add --transport http camofox '<MCP_URL>' \
  --header "Authorization: Bearer $CAMOFOX_API_KEY" \
  --header "X-Camofox-User: claude-code"
```

The `X-Camofox-User` header is optional. It sets the `userId`. Without it, the gateway uses `agent`, and all such clients share one profile. Use one stable value for each identity. A client that cannot send headers can add `?user=<name>` to the MCP URL. Run `/mcp` in Claude Code to check that `camofox` is connected. Then call `camofox_status`.

## Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.camofox]
url = "<MCP_URL>"
bearer_token_env_var = "CAMOFOX_API_KEY"
http_headers = { "X-Camofox-User" = "codex" }
```

Set `CAMOFOX_API_KEY` in the environment before you start Codex. The `http_headers` line is optional.

## Hermes Agent

Native plugin. It uses the REST API and the Hermes tool names (`browser_*`).

```bash
hermes plugins install camofox
```

Add these lines to the Hermes `.env`:

```bash
CAMOFOX_URL=<API_URL>
CAMOFOX_API_KEY=<KEY>
```

Then run `hermes tools enable camofox` and start a new session. The tools do not appear in a running session. Run `hermes camofox status` to check the connection.

To keep logins between sessions, add this to `config.yaml`:

```yaml
browser:
  camofox:
    managed_persistence: true
```

MCP route. It has more tools, such as `camofox_wait`, `camofox_extract`, and `camofox_links`.

```yaml
mcp_servers:
  camofox:
    url: <MCP_URL>
    headers:
      Authorization: "Bearer ${CAMOFOX_API_KEY}"
```

Put `CAMOFOX_API_KEY` in the Hermes `.env`. If the variable is not set, Hermes refuses to connect.

Use the plugin for the Hermes browser skills and vision. Use MCP for the extra tools. Do not enable both for the same task.

## OpenClaw

```bash
openclaw plugins install @askjo/camofox-browser
```

Set the plugin config `url` to the REST API URL. Set `autoStart` to `false`. Set both `CAMOFOX_ACCESS_KEY` and `CAMOFOX_API_KEY` to the key in the environment of OpenClaw. The plugin reads keys only from the environment. If your OpenClaw version supports remote MCP, you can use the MCP URL instead.

## Raw REST

```bash
API='<API_URL>'
KEY='<KEY>'
curl -s "$API/health"

curl -s -X POST "$API/tabs" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"userId":"demo","sessionKey":"main","url":"https://example.com"}'

curl -s "$API/tabs/<TAB_ID>/snapshot?userId=demo" \
  -H "Authorization: Bearer $KEY"

curl -s -X DELETE "$API/sessions/demo" -H "Authorization: Bearer $KEY"
```

`/health` needs no key. The MCP gateway has `/healthz` on port 9378. It needs no key.

The REST API documents each route at `/openapi.json`.

## Tool names

| Task | MCP tool | Hermes native tool |
|---|---|---|
| Open a tab | `camofox_create_tab` | `browser_navigate` |
| Read the page | `camofox_snapshot` | `browser_snapshot` |
| Click or type | `camofox_click`, `camofox_type` | `browser_click`, `browser_type` |
| Run JavaScript | `camofox_evaluate` | `browser_console` |
| Import cookies | `camofox_import_cookies` | `browser_import_cookies` |

For the full table and the REST routes, read `camofox-stealth-browsing`.

## MCP prompts and resources

The MCP gateway serves the skills of this library. Each skill is a prompt and a resource. The resource URI is `camofox://skills/<name>`. An MCP client that lists prompts shows them without any install.

## Trust the StartOS root CA

Use this when a client reaches a `https://*.local` address and reports a TLS error.

1. Download the root CA file from the StartOS server. The user knows where it is. See the StartOS documentation.
2. Give the file to the client:
   - Node clients: set `NODE_EXTRA_CA_CERTS=/path/to/root-ca.crt` before you start the client.
   - Hermes MCP: set `ssl_verify: /path/to/root-ca.crt` in the server entry.
   - curl: add `--cacert /path/to/root-ca.crt`.
3. Do not turn off TLS checks.

A bridge address or an `http` LAN address does not need a certificate.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` on a REST route | The key is missing or wrong. | Send `Authorization: Bearer <KEY>`. Copy the key again from `Connection Info`. |
| `401` from the MCP URL | The key is missing or wrong. | Set the header or `bearer_token_env_var`. Check that the environment variable is set. |
| `403 Forbidden` on cookie import | The key does not match. | Use the current key. The key changes after `Regenerate API Key`. |
| All calls fail after a change of key | A client still uses the old key. | Update every client. |
| `404 Tab not found` | The tab closed, expired, or was recycled. | Open a new tab. Take a new snapshot. |
| `410` with `retryable: true` | The page crashed or the browser restarted. | Open a new tab. |
| `503` with `retryable: true` | The tab did not respond, or the session expired. | Retry. If it fails again, open a new tab. |
| `429` on tab open | Tab limit reached and no tab could close. | Close tabs. Raise the limits in `Browser Settings`. |
| `422 strict mode violation` | A CSS selector matched many elements. | Take a snapshot. Use a ref. |
| `409` on extract | The tab has no refs. | Take a snapshot first. |
| TLS error on `https://*.local` | The client does not trust the StartOS root CA. | Read the TLS section above. |
| Connection refused or timeout | The service is stopped, or the URL or port is wrong. | Start the service. Copy the URL from `Connection Info`. Check that the MCP URL ends with `/mcp`. |
| MCP client shows no tools | The URL or the header is wrong. | Check the URL and the key. Restart the client. |
| Hermes shows no `browser_*` tools | The `camofox` toolset is off, or the session is old. | Run `hermes tools enable camofox`. Start a new session. Check `CAMOFOX_URL`. |
| Hermes MCP server fails to connect | `CAMOFOX_API_KEY` is not set in the profile `.env`. | Set it. Hermes refuses a literal `${CAMOFOX_API_KEY}`. |
| Login lost after a task | The `userId` changed. | Use one stable `userId`. Read `camofox-login-handoff`. |
| Page shows a challenge | Bot protection. | Read `camofox-bot-challenges`. |
