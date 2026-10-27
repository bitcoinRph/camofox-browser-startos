---
name: camofox-data-extraction
description: Use when a Camofox task must collect structured data from web pages, such as lists, tables, prices, links, images, or files. Covers extract, links, evaluate patterns, lazy pages, pagination, downloads, and completeness checks.
metadata: {"hermes": {"tags": ["browser", "camofox", "scraping", "extraction", "data"], "related_skills": ["camofox-stealth-browsing", "camofox-bot-challenges"]}, "openclaw": {"emoji": "📊"}}
---

# Camofox data extraction

Pick the cheapest tool that returns the data. A snapshot is the most costly choice.

## Tool names

| Need | MCP tool | Hermes native tool | REST route |
|---|---|---|---|
| Named values from known refs | `camofox_extract` | none | `POST /tabs/:tabId/extract` |
| All links of a page | `camofox_links` | none (use `browser_console`) | `GET /tabs/:tabId/links` |
| Any value from the page | `camofox_evaluate` | `browser_console` with `expression` | `POST /tabs/:tabId/evaluate` |
| Images | `camofox_images` | `browser_get_images` | `GET /tabs/:tabId/images` |
| Downloaded files | `camofox_downloads` | none | `GET /tabs/:tabId/downloads` |
| Wait for the page | `camofox_wait` | none | `POST /tabs/:tabId/wait` |
| Text of the page and refs | `camofox_snapshot` | `browser_snapshot` | `GET /tabs/:tabId/snapshot` |

REST calls need `userId` in the body or the query. MCP tools set it for you. Read the input schema of each MCP tool before the first call.

## Choose a method

1. The page is an API, a feed, or a JSON file. Use a plain HTTP fetch. Do not use a browser.
2. The data is in the page state or in a script tag. Use `camofox_evaluate`.
3. You need the links of a page. Use `camofox_links`.
4. You need a few named values from elements that a snapshot shows. Use `camofox_extract`.
5. The page layout decides the answer. Use a snapshot. Add a screenshot only if text is not enough.
6. You need the forms and tables of a page as JSON. Take a snapshot with `includeStructure` set.

## camofox_extract

The tool reads values by ref. It does not use a language model. It reads the accessible name of each ref. For a link, a button, or a heading, the name is its text.

Take a snapshot first. The extract call fails with `409` when the tab has no refs.

Request body (REST):

```json
{
  "userId": "agent",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "x-ref": "e12" },
      "price": { "type": "number", "x-ref": "e31" },
      "in_stock": { "type": "boolean", "x-ref": "e33" }
    },
    "required": ["title", "price"]
  }
}
```

Rules:

- `schema.type` must be `object`. `schema.properties` must exist.
- Each property can have `x-ref` (a ref from the latest snapshot) and `type`.
- Allowed types are `string`, `number`, `integer`, `boolean`, `object`, and `null`.
- A `string` is trimmed. A `number` or `integer` drops other characters, such as a currency sign. A `boolean` accepts `true`, `yes`, `1`, `false`, `no`, `0`.
- A property with no `x-ref`, or with a ref that has no name, returns `null`.
- A name in `required` that returns `null` makes the call fail with `422`. The error names the property.
- A bad schema returns `400`. An unknown tab returns `404`.

Success returns `{ "ok": true, "data": { ... } }`.

The tool reads one element for each property. For many rows, use `camofox_evaluate`.

## camofox_links

REST query: `userId`, `limit` (default 50), and `offset` (default 0). The result has a `links` array. Each link has `url` and `text`. The result also has a `pagination` object with `total`, `offset`, `limit`, and `hasMore`.

- Only `http` and `https` links appear. Each `text` has at most 100 characters.
- Continue with `offset` while `hasMore` is `true`.
- Filter the links in your own code. Do not print all links of a large page.

## camofox_evaluate

The `expression` runs in the page. It must return a value that JSON can carry. A promise is awaited. The request body can hold at most 1 MB. A call has a time limit of about 30 seconds.

Patterns:

Count items before you read them:

```js
document.querySelectorAll('.result-card').length
```

Read a table as rows:

```js
[...document.querySelectorAll('table tbody tr')].map(tr =>
  [...tr.cells].map(td => td.innerText.trim()))
```

Read JSON from the page state or from a script tag:

```js
window.__NEXT_DATA__?.props?.pageProps ?? null
```

```js
[...document.querySelectorAll('script[type="application/ld+json"]')]
  .map(s => JSON.parse(s.textContent))
```

Load a lazy page. Scroll with `window.scrollTo`, not with the scroll tool. The scroll tool can do nothing on lazy-load pages.

```js
(async () => {
  let last = 0
  for (let i = 0; i < 8; i++) {
    window.scrollTo(0, document.body.scrollHeight)
    await new Promise(r => setTimeout(r, 1500))
    const h = document.body.scrollHeight
    if (h === last) break
    last = h
  }
  return last
})()
```

Call the same-origin API that the page itself calls, with the session cookies of the page:

```js
fetch('/api/items?page=2', { credentials: 'include' }).then(r => r.json())
```

Rules for expressions:

- Return only the fields that you need. A large return value costs tokens.
- Do not return cookies, tokens, or storage values. Never print a secret in the chat.
- Hermes can refuse an expression that names cookies, storage, or network calls when `browser.restrict_evaluate` is `true`. Use a snapshot or a link tool instead.
- Call only APIs that the page already calls. Respect the site terms and rate limits.

## Pagination

Two kinds exist: pages of a site, and chunks of one long snapshot.

Pages of a site:

1. Extract the items of the current page.
2. Find the next control. Use a ref from the snapshot, or a `page=` value in the URL.
3. Click it, or navigate to the next URL. Wait with `camofox_wait`.
4. Take a new snapshot or run the evaluate expression again.
5. Stop when the next control is missing, when the page repeats, or at your page limit.

Always set a page limit. Add a pause of a few seconds between pages. Remove duplicates with a stable key such as a URL or an ID.

Chunks of one snapshot: read `camofox-stealth-browsing`. Use `offset` with `nextOffset` while `hasMore` is `true`.

## Images and downloads

Images. The tool arguments are `limit` (default 8, maximum 20), `includeData`, and `maxBytes`. Each image has `src`, `alt`, `width`, and `height`. Without `includeData`, you get only the metadata. With `includeData`, the MCP tool returns the pictures as image blocks. The default for `maxBytes` is 2000000. Hermes `browser_get_images` reads `src` and `alt` from the snapshot.

Downloads. When a click starts a download, the server saves it. Call the downloads tool for the tab. Each item has `filename`, `url`, and `state`. `includeData` adds the file content, up to `maxBytes`. The default for `maxBytes` is 1000000. `consume` clears the list after the read.

PDF in a tab. `POST /tabs/:tabId/fetch-current-resource` saves the open PDF as a download. It uses the cookies of the session. Then read the downloads list.

## Verify completeness

Check these points before you report the result:

- Compare your item count with a number on the page, such as "312 results".
- Check `hasMore` in snapshots and in link results. Continue until it is `false`.
- A snapshot gives at most 500 refs. If a page has more elements, use `camofox_evaluate` to read the rest.
- Check that the last page is not a copy of the previous page.
- Check a few items by hand. Compare them with the screenshot of the page.
- Report gaps. Do not fill a missing value with a guess.

## Structured output

- Define the fields before you start. Use the same names for every item.
- Use `null` for a missing value. Do not invent a value.
- Add the source `url` and the time of retrieval to each record.
- Return JSON or a table. Keep text values short.
- State the number of items, the number of pages, and any known gap.
