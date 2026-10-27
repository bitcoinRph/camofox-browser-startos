---
name: camofox-stealth-browsing
description: Use when a task needs a real browser for a site with bot protection, heavy JavaScript, or a logged-in session. Covers when to choose Camofox over a plain fetch, the core loop, search macros, token economy, tab hygiene, and identity.
metadata: {"hermes": {"tags": ["browser", "camofox", "web", "stealth"], "related_skills": ["camofox-bot-challenges", "camofox-data-extraction", "camofox-login-handoff", "camofox-agent-setup"]}, "openclaw": {"emoji": "🦊"}}
---

# Camofox stealth browsing

Camofox is a self-hosted anti-detection browser (Camoufox, a Firefox fork). You drive it with tools. You read pages as accessibility snapshots with element refs.

## When to choose Camofox

Choose Camofox when one of these is true:

- The site has bot protection and a plain HTTP fetch returns 403, 429, or an interstitial page.
- The page needs JavaScript to show its content.
- The task needs a logged-in session.
- The task needs a search engine result page. Use a search macro.

Do not choose Camofox when a plain HTTP fetch is enough. Examples are a public API, a JSON endpoint, an RSS feed, a static page, or a file download. A fetch is faster and uses no browser memory.

Try a fetch first for static content. Switch to Camofox when the fetch fails or returns an empty shell.

Do not use Camofox to bypass a paywall or an access control. Read the Responsible use section of `camofox-bot-challenges`.

## Tool names

Three clients call the same browser. Use the column that matches your client.

| Action | MCP tool | Hermes native tool | REST route |
|---|---|---|---|
| Open a tab | `camofox_create_tab` | `browser_navigate` (opens a tab if none) | `POST /tabs` |
| Go to URL or macro | `camofox_navigate` | `browser_navigate` | `POST /tabs/:tabId/navigate` |
| Read the page | `camofox_snapshot` | `browser_snapshot` | `GET /tabs/:tabId/snapshot` |
| Click | `camofox_click` | `browser_click` | `POST /tabs/:tabId/click` |
| Type | `camofox_type` | `browser_type` | `POST /tabs/:tabId/type` |
| Press a key | `camofox_press` | `browser_press` | `POST /tabs/:tabId/press` |
| Choose a select option | `camofox_select` | none | `POST /tabs/:tabId/select` |
| Scroll | `camofox_scroll` | `browser_scroll` | `POST /tabs/:tabId/scroll` |
| Wait for the page | `camofox_wait` | none | `POST /tabs/:tabId/wait` |
| Back, forward, refresh | `camofox_back`, `camofox_forward`, `camofox_refresh` | `browser_back` | `POST /tabs/:tabId/back`, `/forward`, `/refresh` |
| Screenshot | `camofox_screenshot` | `browser_vision` (asks a vision model) | `GET /tabs/:tabId/screenshot` |
| Run JavaScript | `camofox_evaluate` | `browser_console` with `expression` | `POST /tabs/:tabId/evaluate` |
| List tabs | `camofox_list_tabs` | none | `GET /tabs` |
| Close a tab | `camofox_close_tab` | none | `DELETE /tabs/:tabId` |
| Close all tabs of one identity | `camofox_close_session` | none | `DELETE /sessions/:userId` |
| Check the connection and identity | `camofox_status` | `hermes camofox status` (CLI) | `GET /health` |

Hermes native tools have no `tabId` argument. The plugin keeps one tab for each task.

REST calls need `userId` in the body or the query. MCP tools set it for you. Read the `camofox-data-extraction` skill for links, extract, images, and downloads.

## The core loop

1. Open a tab with the URL. Check `navigationOk` in the result. A value of `false` means the page answered with HTTP 400 or higher.
2. Take a snapshot. Read the refs (`e1`, `e2`, and so on).
3. Act on an element by its ref. Use click, type, press, or select.
4. Take a snapshot again. Read the new state.
5. Repeat steps 3 and 4 until the task is done.
6. Close the tab.

Rules for refs:

- A ref belongs to the latest snapshot of its tab.
- Refs reset after navigation. Take a new snapshot after every navigation, form submit, or click that changes the page.
- Prefer a ref to a CSS selector. A selector that matches many elements fails with `422 strict mode violation`. Take a new snapshot and use a ref.
- A snapshot gives at most 500 refs. For an element after that limit, use a CSS selector or `camofox_evaluate`.
- Some CAPTCHA frames do not appear in a snapshot. Take a screenshot to see them.
- `camofox_type` fills the value at once. For a rich editor, set `mode` to `keyboard`.

## Search macros

Use a macro to search a known site without typing into its search box. Call navigate with `macro` and `query`.

`@google_search`, `@youtube_search`, `@amazon_search`, `@reddit_search`, `@reddit_subreddit`, `@wikipedia_search`, `@twitter_search`, `@yelp_search`, `@spotify_search`, `@netflix_search`, `@linkedin_search`, `@instagram_search`, `@tiktok_search`, `@twitch_search`

For `@reddit_subreddit`, the query is the subreddit name.

Reddit macros return JSON. Read the JSON from the page text or with `camofox_evaluate`.

## Read long pages

A snapshot has at most 80000 characters. A longer page is cut. The result then has `hasMore: true` and `nextOffset`.

1. Call snapshot with `offset` set to `nextOffset`.
2. Repeat until `hasMore` is `false`.

Each cut keeps the last 5000 characters of the page. These characters hold the pagination links. A request with `offset` reads the stored snapshot. It does not read the page again.

## Token economy

- Take snapshots without a screenshot. Set `includeScreenshot` only for a visual check.
- Use `camofox_extract`, `camofox_links`, or `camofox_evaluate` to get data. Do not read the whole snapshot for data.
- Take a screenshot only when layout, a CAPTCHA, or an image decides the next step.
- Ask for the data you need. Do not snapshot the same page twice without an action between the two snapshots.
- On long pages, read the first chunk. Continue with `offset` only when the data is not there.

## Tab and session hygiene

- Close each tab when you finish with it.
- Keep few tabs open. The server has a limit for each identity and a global limit. At the limit, the server closes the oldest tab to make room. The old `tabId` then returns 404.
- A tab that is idle for a long time closes by itself. A session with no calls closes after the session timeout. The default is 10 minutes.
- After `404 Tab not found`, `410`, or `503` with `retryable: true`, open a new tab. Do not reuse the old `tabId`.
- Do not run many parallel requests for one identity. The server limits requests for each identity.
- Call `camofox_close_session` when a task ends and you do not need the browser state. This also saves the profile of that identity. Other clients with the same `userId` lose their tabs.
- Use `camofox_list_tabs` to find a lost `tabId`.

## Identity

The `userId` is the identity of the browser profile. It holds cookies and local storage. The server saves it to disk and restores it on the next session with the same `userId`.

- Use one stable `userId` for each logged-in identity. Example: `work-linkedin`.
- Use a separate `userId` for each unrelated task. Cookies then do not leak between tasks.
- Use only letters, digits, dot, dash, and underscore. Use 1 to 64 characters.
- MCP clients set the `userId` with the `X-Camofox-User` header or the `user` query parameter in the MCP URL. Without it, the gateway uses `agent`. All such clients then share one profile. Call `camofox_status` to see your `userId`.
- Hermes native tools use a random identity unless `browser.camofox.managed_persistence` is `true` in `config.yaml`.
- `sessionKey` groups tabs inside one identity. It does not isolate cookies.

## Pace like a person

- Wait between page loads. Use several seconds. Add random variation.
- Do not click or type many times in one second.
- Do not open many tabs on one site at the same time.
- Read the result of each action before the next action.
- Use `camofox_wait` after a navigation on a slow page. Do not reload.
- Stop and read `camofox-bot-challenges` when a page shows a challenge.
