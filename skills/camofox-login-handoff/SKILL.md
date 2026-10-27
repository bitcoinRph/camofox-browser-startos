---
name: camofox-login-handoff
description: Use when a Camofox task needs a logged-in session and the user must sign in with a password, MFA, or CAPTCHA. Covers the Interactive Login and noVNC hand-off, one stable userId, cookie import, login checks, and profile reset.
metadata:
  {
    'hermes':
      {
        'tags': ['browser', 'camofox', 'login', 'vnc', 'session'],
        'related_skills':
          ['camofox-stealth-browsing', 'camofox-bot-challenges'],
      },
    'openclaw': { 'emoji': '🔑' },
  }
---

# Camofox login hand-off

The user signs in. You never see the password. Camofox saves the session in a profile. You reuse the profile with the same `userId`.

## Rules

- Never ask the user to paste a password, an MFA code, or a recovery code into the chat.
- Never type a password with `camofox_type` or `browser_type`. Camofox snapshots can show the value of a filled field.
- Use the same `userId` for the whole login and for every later task on that account.
- Only log in to accounts that belong to the user.

## Tool names

| Action                             | MCP tool                 | Hermes native tool       | REST route                               |
| ---------------------------------- | ------------------------ | ------------------------ | ---------------------------------------- |
| Open the login page                | `camofox_create_tab`     | `browser_navigate`       | `POST /tabs`                             |
| Check the page                     | `camofox_snapshot`       | `browser_snapshot`       | `GET /tabs/:tabId/snapshot`              |
| Check the identity and noVNC state | `camofox_status`         | none                     | `GET /health`                            |
| Keep the session alive             | `camofox_wait`           | none                     | `POST /tabs/:tabId/wait`                 |
| Save the profile now               | `camofox_close_session`  | none                     | `DELETE /sessions/:userId`               |
| Import cookies                     | `camofox_import_cookies` | `browser_import_cookies` | `POST /sessions/:userId/cookies`         |
| Delete the profile of one `userId` | none                     | none                     | `DELETE /sessions/:userId/storage_state` |

REST calls other than the last two need `userId` in the body or the query. All REST calls need `Authorization: Bearer <key>`.

## Interactive Login flow

Interactive Login is off by default. The user turns it on in StartOS.

1. Choose the `userId`. Use a name for the account. Example: `work-github`. Tell the user the name.
2. Ask the user to run the `Enable Interactive Login` action of the Camofox Browser service. The masked form proposes a VNC password. The user must copy it before submitting. The service restarts, open tabs close, and the completed action shows the noVNC URL but never returns the password. Do this before you open tabs.
3. Open the login page with your tool. Use the chosen `userId`. The page opens in the browser that the user will see.
4. Ask the user to open the noVNC URL in a web browser and enter the password. The user then sees the Camoufox window and your tab.
5. Tell the user what to do. Example: "Sign in to GitHub in the open tab. Complete the MFA step. Tell me when you see your dashboard."
6. Wait for the user. Keep the session alive. Call `camofox_snapshot` or `camofox_wait` every few minutes. A session closes after the session timeout (default 10 minutes) when no API call arrives. If the user needs more time, ask the user to raise the session timeout in the `Browser Settings` action.
7. When the user says it is done, verify the login. Read the next section.
8. Save the profile. Read the section on saving.
9. Tell the user to run the `Disable Interactive Login` action when no more logins are needed. The service restarts again. Saved cookies stay on disk.

The noVNC page gives full control of the browser to anyone with the URL and the password. Do not share them. Do not write the password in files or logs.

## Verify the login state

1. Take a snapshot of the page that the user left open.
2. Look for signs of a logged-in state: the account name, an avatar, a "Log out" or "Sign out" link, or the dashboard content.
3. Look for signs of a logged-out state: a login form, a "Sign in" button, or a redirect to a login URL.
4. Navigate to a page that needs a login. Example: the account settings page. Take a snapshot. Check that the page opens.
5. If the state is logged out, tell the user. Ask the user to repeat the sign-in. Do not retry with other data.

## Save and reuse the profile

Camofox saves the profile of a `userId` to disk when:

- the session closes (call `camofox_close_session`),
- the session times out,
- cookies are imported, or
- the service stops.

Steps to save now and to check that it works:

1. Call `camofox_close_session`. This closes all tabs of that `userId`.
2. Open a new tab for the site with the same `userId`.
3. Take a snapshot. Check that the page is still logged in.

For later tasks, open a tab with the same `userId`. The server restores the cookies and local storage. IndexedDB is not saved.

How to keep the same `userId`:

- MCP clients: set the header `X-Camofox-User` or the query parameter `user` on the MCP URL. Use the same value every time. Without it, the gateway uses `agent`. Call `camofox_status` to see the `userId`.
- Hermes native plugin: set `browser.camofox.managed_persistence: true` in `config.yaml`, or set `browser.camofox.user_id`. Without this, each Hermes session uses a random identity and loses the login.
- OpenClaw plugin and REST: send the same `userId` in every request.

A site can end a session when the IP address or the browser identity changes. Do not change the `Browser Settings` locale and time zone, or the proxy, between the login and later tasks.

## Alternative: cookie import

Use this when the user cannot use noVNC. A cookie file holds the same power as a password. Prefer Interactive Login.

1. Ask the user to export the cookies for one site. The user uses a "cookies.txt" browser extension. The file has the Netscape format.
2. Import only the domain you need. Set `domainSuffix`, for example `github.com`.
3. MCP: call `camofox_import_cookies` with `cookiesTxt` set to the content of the file. Set `cookiesPath` only for a file in the server cookies directory.
4. Hermes native: call `browser_import_cookies` with the path of the file in `browser.camofox.cookies_dir` on the Hermes machine. The key `CAMOFOX_API_KEY` must be set in the Hermes `.env`.
5. Verify the login state as above.

Limit: 5 MB for each file. The gateway splits a large import into batches. Hermes native import stops at 500 cookies. Never print the cookie values. Ask the user to delete the exported file after the import.

If the content of the file passes through the chat, the model sees the cookies. Tell the user this before the import.

## Start clean

- Delete the profile of one `userId`. Send `DELETE /sessions/:userId/storage_state` with the bearer key. This closes that live session and deletes its saved state.
- Delete all profiles. Ask the user to stop the service and run the `Reset Browser Profiles` action. This logs out every identity and deletes imported cookie files.
- After a reset, the user must sign in again.
