<p align="center">
  <img src="icon.png" alt="Camofox Browser Logo" width="21%">
</p>

# Camofox Browser on StartOS

> Everything not listed in this document should behave the same as upstream
> Camofox Browser. If a feature, setting, or behavior is not mentioned here,
> the upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[Camofox Browser](https://github.com/jo-inc/camofox-browser) is a REST server for AI agents. It drives Camoufox, a Firefox fork with built-in fingerprint spoofing. Agents read pages as accessibility snapshots and act on element refs.

This package wraps the pinned upstream image without a code change. It adds an MCP gateway that serves the same browser over HTTP, and a library of agent skills.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

The package builds one image on top of the upstream image. The upstream image is pinned by tag and index digest in `Dockerfile`. The package adds two folders and changes nothing else in the image.

| What          | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Image source  | Upstream image plus `COPY gateway/ /app/gateway/` and `COPY skills/ /opt/camofox/skills/` |
| Architectures | x86_64, aarch64                                                                           |
| Entrypoint    | Custom. The daemons below replace the upstream `CMD`.                                     |
| User          | root, as in the upstream image                                                            |

The package runs one subcontainer, named `camofox-sub`. All processes below run in it.

| Process       | Kind    | What it runs                                                                                                                                       |
| ------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-dirs`   | oneshot | `mkdir -p` for the four data folders on every start                                                                                                |
| `camofox`     | daemon  | `node --max-old-space-size=256 server.js` in `/app`. Node runs as the main process, so a stop signal reaches it. Camofox then saves open profiles. |
| `mcp-gateway` | daemon  | `node /app/gateway/server.mjs`. It starts after `camofox`.                                                                                         |

To look inside, run `start-cli package attach camofox-browser -n camofox-sub`.

The gateway imports `express` and the MCP SDK from `/app/node_modules`. It imports the tool contracts from `/app/mcp/lib/tool-contracts.mjs` in the upstream image.

The skills folder is part of the image. It is read-only and is not on the volume.

## Volume and Data Layout

The package uses two volumes. Only `main` is mounted in the subcontainer.

| Volume    | Mount point | Content                            |
| --------- | ----------- | ---------------------------------- |
| `main`    | `/data`     | All Camofox data                   |
| `startos` | none        | `store.json`, the StartOS settings |

Folders in `/data`:

| Folder      | Content                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `profiles/` | One folder for each `userId`, named by a hash of the `userId`. Each holds `storage_state.json` with cookies and local storage. |
| `cookies/`  | Bootstrap cookie files. `camofox_import_cookies` with `cookiesPath` reads files here.                                          |
| `uploads/`  | The only folder from which the upload route accepts files.                                                                     |
| `traces/`   | Optional Playwright trace files. Camofox deletes old traces.                                                                   |

Camofox saves a profile when a session closes, when a session times out, when cookies are imported, and when the service stops. A login in an open session is not on disk until one of these events happens.

The database is not used. There is no SQL service.

## File Models

The package owns one file, `store.json` on the `startos` volume. It holds StartOS state, not upstream configuration. The package writes no other configuration file.

| Key           | Seeded by                              | Written by                                                 | Hand edit                                                                  |
| ------------- | -------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apiKey`      | Install. A random 48-character key.    | `Regenerate API Key`                                       | Survives. The service restarts and uses the new value.                     |
| `browser`     | Defaults at install                    | `Browser Settings`                                         | Survives. The service restarts.                                            |
| `proxy`       | Defaults at install. The proxy is off. | `Proxy Settings`                                           | Survives. The proxy applies only when `enabled` is true and `host` is set. |
| `interactive` | Defaults at install. It is off.        | `Enable Interactive Login` and `Disable Interactive Login` | Survives. No action sets `resolution`. It stays at its default.            |

Use the actions. A hand edit works, but an action overwrites the same keys. Unknown keys in the file stay.

Camofox reads its settings from environment variables on every start. The package sets these variables from `store.json`. A change to a setting therefore restarts the service. Do not set these variables by hand.

- Camofox: `NODE_ENV`, `CAMOFOX_PORT`, `HOME`, `CAMOFOX_ACCESS_KEY`, `CAMOFOX_API_KEY`, `CAMOFOX_PROFILE_DIR`, `CAMOFOX_COOKIES_DIR`, `CAMOFOX_UPLOADS_DIR`, `CAMOFOX_TRACES_DIR`, `CAMOFOX_CRASH_REPORT_ENABLED`, `MAX_SESSIONS`, `MAX_TABS_PER_SESSION`, `MAX_TABS_GLOBAL`, `SESSION_TIMEOUT_MS`, `TAB_INACTIVITY_MS`, `BROWSER_IDLE_TIMEOUT_MS`
- Only when both locale and time zone are set: `CAMOFOX_LOCALE`, `CAMOFOX_TIMEZONE`
- Only when the proxy is on: `PROXY_PROTOCOL`, `PROXY_HOST`, `PROXY_PORT`, `PROXY_USERNAME`, `PROXY_PASSWORD`
- Only when Interactive Login is on: `ENABLE_VNC`, `VNC_PASSWORD`, `VNC_BIND`, `NOVNC_PORT`, `VNC_RESOLUTION`
- Gateway: `MCP_PORT`, `MCP_BIND`, `MCP_SESSION_IDLE_MS`, `CAMOFOX_BASE_URL`, `CAMOFOX_ACCESS_KEY`, `CAMOFOX_API_KEY`, `MCP_AUTH_TOKEN`, `CAMOFOX_SKILLS_DIR`, `CAMOFOX_DEFAULT_USER_ID`, `CAMOFOX_NOVNC_ENABLED`

Upstream also has `camofox.config.json` inside the image. The package does not change it.

## Dependencies

None.

## Network Access and Interfaces

The package exposes two API interfaces. A third interface, for noVNC, exists only while Interactive Login is on.

| Interface id | Type | Port | Protocol | Purpose                                               |
| ------------ | ---- | ---- | -------- | ----------------------------------------------------- |
| `api`        | api  | 9377 | HTTP     | The Camofox REST API                                  |
| `mcp`        | api  | 9378 | HTTP     | The MCP server. The path is `/mcp` (Streamable HTTP). |
| `vnc`        | ui   | 6080 | HTTP     | The noVNC page. The path is `/vnc.html`.              |

The preferred external port of each interface equals its internal port. Services on the same server usually reach the API at `http://10.0.3.1:9377` and MCP at `http://10.0.3.1:9378/mcp`. The assigned port can differ.

Authentication:

- One API key protects the REST API and the MCP server. Clients send `Authorization: Bearer <key>`.
- `GET /health` on the REST API and `GET /healthz` on the MCP server need no key.
- The noVNC page is protected by the VNC password only. The API key does not open it. The password has 8 characters, because VNC authentication cuts longer passwords. Anyone who can reach the noVNC address and knows the password can see and control the browser.
- The raw VNC port stays on the loopback address inside the container. The package does not expose it.

The MCP server reads two optional identity values for each MCP session. The header `X-Camofox-User` or the query parameter `user` sets the `userId`. The header `X-Camofox-Session` or the query parameter `session` sets the tab group. Both values accept 1 to 64 characters from `A-Z a-z 0-9 _ . -`. The default `userId` is `agent`. The `userId` is the boundary of cookies and saved profiles.

The MCP server also serves the five skills in `skills/`. Each skill is one MCP prompt and one MCP resource with the URI `camofox://skills/<name>`.

## Installation and First-Run Flow

Setup differs from upstream in these points. Nothing here blocks the first start.

- Install creates the API key. There is no setup wizard and no default password.
- The Camoufox browser is part of the image. No browser download happens at install.
- The browser itself starts at the first request and stops after the browser idle timeout. The first request after an idle period is slower.
- Interactive Login is off. Telemetry is off. The proxy is off.
- Install raises one optional task for the browser locale and time zone.
- A client needs the API key and the URL. Run `Regenerate API Key`, copy the proposed key before submitting, and then run `Connection Info` for addresses and credential-free setup text.

Order to respect: turn on Interactive Login before an agent opens the tabs that the user must see. The change restarts the service and closes open tabs.

## Actions

All seven actions are user-facing. The package has no hidden action. The OS shows the name, description, and warning of each action. This section gives what they do not show.

### Connection Info

- **When to run it:** Before you connect a client or when you need an address.
- **What it changes:** Nothing.
- **Cost:** Instant. It does not interrupt the service.
- **Repeat safety:** Safe.
- **Outputs:** Every non-local REST and MCP address. The same-server addresses (`http://10.0.3.1:<port>`). The noVNC address while Interactive Login is on. Credential-free setup text for Claude Code, Codex, Hermes Agent, and OpenClaw. Insert the key copied from `Regenerate API Key` where the placeholder appears.

### Regenerate API Key

- **When to run it:** Before first client setup, when the key leaks, when you lose your copy, or when a person who knew the key must lose access.
- **What it changes:** `apiKey` in `store.json`.
- **Cost:** The service restarts. Open tabs close. Camofox saves the profiles when it stops.
- **Repeat safety:** Each run replaces the key again. Copy the proposed key from the masked form before submitting. Every client must then use the newest key.
- **Outputs:** A non-secret confirmation only. The action result never returns the key.

### Browser Settings

- **When to run it:** To set the locale and time zone, change limits, or allow crash reports.
- **What it changes:** `browser` in `store.json`. The locale and the time zone go to Camofox only when both are set.
- **Cost:** The service restarts. Open tabs close.
- **Repeat safety:** Safe. The same input gives the same result.
- **What happens next:** The optional task for the locale and time zone clears when both values are set.

### Timeout Scopes

Each timer has a separate scope. Increasing one timer does not increase the others.

| Browser Settings field | Environment variable | Default | Scope |
| --- | --- | --- | --- |
| Browser Session Timeout | `SESSION_TIMEOUT_MS` | 10 minutes | API inactivity for one browser identity. Closes its context and tabs. Saved profiles remain. |
| Tab Inactivity Timeout | `TAB_INACTIVITY_MS` | 5 minutes | No tool activity on that tab. Other tabs do not refresh it. |
| Browser Idle Timeout | `BROWSER_IDLE_TIMEOUT_MS` | 5 minutes | Stops the browser process after all browser sessions close. |
| MCP Session Idle Timeout | `MCP_SESSION_IDLE_MS` | 30 minutes | Expires an idle stateful MCP transport, not the browser identity. Active POST requests prevent expiry. |

Tab expiry follows upstream tool-call activity, checked approximately once each minute. The tab reaper can also close an empty browser session.

MCP discovery calls keep only the MCP connection active. They do not keep browser sessions or tabs active.

Stateless requests create no MCP transport session. Their tab group remains subject to browser-session and tab expiry.

Gateway-owned tab groups close when their MCP session expires. Explicit `X-Camofox-Session` groups remain subject to upstream cleanup.

noVNC input does not count as API or tab-tool activity. A longer browser-session timer alone does not protect an inactive tab.

Set both idle fields with whole minutes from 1 to 1440. The action validates them before saving.

Runtime validation rejects malformed new settings before daemon creation. Old stores retain all previous defaults.

Browser Settings can repair malformed stored idle values. Its form suggests defaults without saving anything until submission.

The direct upstream daemon reads `TAB_INACTIVITY_MS`. Only the gateway receives `MCP_SESSION_IDLE_MS`.

The gateway validates direct environment values as whole milliseconds from 1 to 86400000. Only an absent value selects its default.

### Proxy Settings

- **When to run it:** When the browser must use a proxy, for example to get a different location.
- **What it changes:** `proxy` in `store.json`. The proxy password is stored there in plain text and is part of every backup.
- **Cost:** The service restarts. Open tabs close.
- **Repeat safety:** Safe.
- **What happens next:** With a proxy, Camofox sets locale, time zone, and geolocation from the proxy exit address.

### Enable Interactive Login and Disable Interactive Login

These are separate actions. StartOS shows only the action that applies to the current state.

- **When to run it:** Enable it when a person must sign in, pass MFA, or solve a CAPTCHA. Disable it when that work is done.
- **What it changes:** `interactive` in `store.json`. Enable saves the 8-character VNC password entered in the masked form. Disable removes it. The `vnc` interface exists only while the feature is on.
- **Cost:** The service restarts each time. Open tabs close. Saved cookies stay on disk.
- **Repeat safety:** Enable is available only while the feature is off. Disable is available only while it is on. Copy the proposed password before submitting Enable.
- **Outputs:** Enable returns the noVNC address and a non-secret confirmation. It never returns the VNC password.

### Reset Browser Profiles

- **When to run it:** To remove all saved logins and cookie files and start clean.
- **What it changes:** It empties `/data/profiles` and `/data/cookies`. It does not touch `uploads` or `traces`.
- **Cost:** Instant. The service must be stopped first.
- **Repeat safety:** Destructive and final. A second run on empty folders changes nothing. Only a backup restore brings the data back.

## Tasks

The package creates one task.

| Task                                                          | Action             | Severity |
| ------------------------------------------------------------- | ------------------ | -------- |
| Match the browser locale and time zone to the server location | `browser-settings` | optional |

- **What raises it:** Every init finds the locale or the time zone unset in `store.json`.
- **What clears it:** Run `Browser Settings` with both values set. The task returns if either value is unset again.
- **Effect:** An optional task does not block the service. It only prompts the user.

The package creates no dependency task.

## Health Checks

The package has three checks. The first two are daemon checks.

| Id            | Display name      | What it probes                                                               | Grace period |
| ------------- | ----------------- | ---------------------------------------------------------------------------- | ------------ |
| `camofox`     | REST API          | `GET http://127.0.0.1:9377/health` returns HTTP 200                          | 60 seconds   |
| `mcp-gateway` | MCP Server        | `GET http://127.0.0.1:9378/healthz` returns HTTP 200                         | 30 seconds   |
| `novnc`       | Interactive Login | Port 6080 accepts connections. It exists only while Interactive Login is on. | 60 seconds   |

What a failure means:

- `camofox` fails after the grace period: The Node process is not running, or the browser engine is recovering after a crash. A recovering engine answers HTTP 503 and then returns by itself. A stopped browser with a healthy REST API is normal when the service is idle. Read the service logs if the failure stays.
- `mcp-gateway` fails while `camofox` is ready: The gateway process stopped. The gateway reports 503 when the REST API does not answer. Restart the service.
- `novnc` fails: The VNC processes did not start or exited. Disable Interactive Login and enable it again.

## Backups and Restore

The backup copies whole volumes. It copies `main` without `traces/`, and it copies `startos`. No database dump is used.

- **Included:** Browser profiles and cookies (these hold login sessions), uploads, and `store.json`.
- **Excluded:** `traces/`. These are debug recordings that Camofox deletes by size and age.
- **Sensitive content:** `store.json` holds the API key, the proxy password, and the VNC password. Profiles hold session cookies of the user. Protect the backup target.
- **After a restore:** The API key is the same, so clients keep working. The saved settings return, including a running Interactive Login with its password. Websites can end old sessions. The user may have to sign in again.

## Limitations and Differences

Read `PATCHES.md` for wrapper patches, rollback preparation, and separate image-verification requirements.

This section lists what differs from upstream, and then what does not work or is not verified.

Differences from upstream:

1. Telemetry is off by default. Upstream turns crash and hang reports on. Turn them on in `Browser Settings`.
2. MCP uses HTTP. Upstream ships a standard-input MCP adapter that each client starts. This package serves one HTTP endpoint with a Bearer key.
3. Interactive Login is a switch. Upstream has the VNC plugin off unless you set environment variables. Here the action sets them, creates a password, and adds the `vnc` interface.
4. One key protects every route. The package sets `CAMOFOX_ACCESS_KEY` and `CAMOFOX_API_KEY` to the same value. Upstream uses two separate keys.
5. The MCP server has more tools than upstream. Upstream has 11 tools. The gateway adds `camofox_wait`, `camofox_press`, `camofox_select`, `camofox_back`, `camofox_forward`, `camofox_refresh`, `camofox_links`, `camofox_extract`, `camofox_images`, `camofox_downloads`, `camofox_close_session`, and `camofox_status`. Its snapshot has no screenshot unless asked. It returns plain text. `camofox_import_cookies` accepts the text of a cookie file in `cookiesTxt`.
6. `POST /stop` always answers 403. The package sets no admin key. Use `camofox_close_session` or `DELETE /sessions/:userId` to save a profile.
7. The Node heap limit is 256 MB. The upstream image default is 128 MB.
8. Data is under `/data`, not under the home folder of root.

Limitations:

1. This P1 wrapper revision has no live verification. Local boundary tests do not verify browser-engine fixes.
2. The StartOS packages for Hermes Agent and OpenClaw do not set up this service yet. The user must add the URL and key to the agent by hand.
3. The community plugin `hermes-camofox-human-auth` does not work with this package. It sends no authorization header.
4. Browser-session, tab, and MCP timers are independent. noVNC does not refresh them. Read Timeout Scopes before a long login.
5. With the Hermes native plugin, the end of a Hermes session does not close the Camofox session. Camofox saves the login when the session times out or the service stops.
6. Raw VNC is not available. Only noVNC is.
7. The browser may need to download its default ad-blocking add-on at the first start. This needs internet access and has not been verified here.
8. Memory use grows with open tabs. Small servers may need lower tab limits.

---

## Quick Reference for AI Consumers

```yaml
package_id: 'camofox-browser'
image: ghcr.io/jo-inc/camofox-browser
architectures: [x86_64, aarch64]
subcontainers: [camofox-sub]
volumes:
  main: /data
  startos: not mounted
file_models:
  - store.json # on the startos volume
startos_managed_env_vars:
  - CAMOFOX_ACCESS_KEY
  - CAMOFOX_API_KEY
  - MCP_AUTH_TOKEN
  - CAMOFOX_PORT
  - CAMOFOX_PROFILE_DIR
  - CAMOFOX_COOKIES_DIR
  - CAMOFOX_UPLOADS_DIR
  - CAMOFOX_TRACES_DIR
  - CAMOFOX_CRASH_REPORT_ENABLED
  - MAX_SESSIONS
  - MAX_TABS_PER_SESSION
  - MAX_TABS_GLOBAL
  - SESSION_TIMEOUT_MS
  - TAB_INACTIVITY_MS
  - BROWSER_IDLE_TIMEOUT_MS
  - CAMOFOX_LOCALE
  - CAMOFOX_TIMEZONE
  - PROXY_PROTOCOL
  - PROXY_HOST
  - PROXY_PORT
  - PROXY_USERNAME
  - PROXY_PASSWORD
  - ENABLE_VNC
  - VNC_PASSWORD
  - VNC_BIND
  - NOVNC_PORT
  - VNC_RESOLUTION
  - MCP_PORT
  - MCP_BIND
  - MCP_SESSION_IDLE_MS
  - CAMOFOX_BASE_URL
  - CAMOFOX_SKILLS_DIR
  - CAMOFOX_DEFAULT_USER_ID
  - CAMOFOX_NOVNC_ENABLED
dependencies: none
interfaces:
  api: { type: api, port: 9377 }
  mcp: { type: api, port: 9378 }
  vnc: { type: ui, port: 6080 } # only while Interactive Login is on
actions:
  - connection-info
  - regenerate-api-key
  - browser-settings
  - proxy-settings
  - enable-interactive-login
  - disable-interactive-login
  - reset-browser-profiles
tasks:
  - { action: browser-settings, severity: optional }
health_checks:
  - camofox
  - mcp-gateway
  - novnc
```
