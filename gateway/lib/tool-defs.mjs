import { UPSTREAM_TOOLS } from './contracts.mjs';

/**
 * Tool definitions: the 11 upstream tools (same names, same properties, some
 * optional properties added) plus the extra tools. Every route and field here
 * was checked against server.js; the handlers read exactly these fields.
 */

const tabId = { type: 'string', description: 'Tab identifier from camofox_create_tab' };
const ref = { type: 'string', description: 'Element ref from the latest snapshot (e.g. e5)' };
const selector = { type: 'string', description: 'CSS selector (use only when no ref exists)' };

const schema = (properties, required = []) => ({ type: 'object', properties, required });

// Take the macro list from upstream so the two never drift apart. The server
// also knows @reddit_subreddit (lib/macros.js), which upstream does not list.
const upstreamNavigate = UPSTREAM_TOOLS.find((t) => t.name === 'camofox_navigate');
const MACROS = [
  ...new Set([...(upstreamNavigate?.inputSchema.properties.macro.enum ?? []), '@reddit_subreddit']),
];

/**
 * @typedef {Object} GatewayTool
 * @property {string} name
 * @property {string} description
 * @property {object} inputSchema
 * @property {boolean} readOnly - True when the tool never changes browser state.
 */

/** @type {GatewayTool[]} */
export const TOOLS = [
  {
    name: 'camofox_create_tab',
    readOnly: false,
    description:
      'Open a new tab in the Camoufox anti-detection browser and load a URL. Returns tabId, which every other tool needs. Call camofox_snapshot next.',
    inputSchema: schema({ url: { type: 'string', description: 'Initial URL (http or https)' } }, ['url']),
  },
  {
    name: 'camofox_snapshot',
    readOnly: true,
    description:
      'Read the page as an accessibility tree. Interactive elements carry refs (e1, e2, ...) for click, type and select. Refs reset after navigation or page changes, so snapshot again first. Long pages are cut: when hasMore is true, call again with offset=nextOffset. Set includeScreenshot only when you must see the page.',
    inputSchema: schema(
      {
        tabId,
        offset: {
          type: 'number',
          description: 'Character offset for paging. Use nextOffset from the previous truncated snapshot.',
        },
        includeScreenshot: { type: 'boolean', description: 'Also return a PNG screenshot (default false)' },
        includeStructure: {
          type: 'boolean',
          description: 'Also return forms and tables as compact JSON, with refs (default false)',
        },
      },
      ['tabId'],
    ),
  },
  {
    name: 'camofox_click',
    readOnly: false,
    description:
      'Click an element by ref (preferred) or CSS selector. The page may change afterwards: snapshot again before the next action.',
    inputSchema: schema({ tabId, ref, selector }, ['tabId']),
  },
  {
    name: 'camofox_type',
    readOnly: false,
    description:
      "Type text into an input by ref or selector. mode 'fill' (default) sets the value at once. mode 'keyboard' sends key presses, for rich editors. Set pressEnter to submit.",
    inputSchema: schema(
      {
        tabId,
        ref,
        selector,
        text: { type: 'string', description: 'Text to type' },
        pressEnter: { type: 'boolean', description: 'Press Enter after typing' },
        mode: { type: 'string', enum: ['fill', 'keyboard'], description: "'fill' (default) or 'keyboard'" },
      },
      ['tabId', 'text'],
    ),
  },
  {
    name: 'camofox_navigate',
    readOnly: false,
    description:
      'Send an existing tab to a URL, or run a search macro with a query (e.g. macro=@google_search, query=...). Macros are more reliable than typing into search boxes. Refs reset: snapshot afterwards.',
    inputSchema: schema(
      {
        tabId,
        url: { type: 'string', description: 'URL to open' },
        macro: { type: 'string', enum: MACROS, description: 'Search macro (instead of url)' },
        query: { type: 'string', description: 'Search query for the macro' },
      },
      ['tabId'],
    ),
  },
  {
    name: 'camofox_scroll',
    readOnly: false,
    description: 'Scroll the page. Use for lazy-loaded content, then snapshot again.',
    inputSchema: schema(
      {
        tabId,
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
        amount: { type: 'number', description: 'Pixels to scroll (default 500)' },
      },
      ['tabId', 'direction'],
    ),
  },
  {
    name: 'camofox_screenshot',
    readOnly: true,
    description: 'Take a PNG screenshot of the tab. Costs more than a snapshot: use it to check layout or CAPTCHAs.',
    inputSchema: schema(
      { tabId, fullPage: { type: 'boolean', description: 'Capture the whole page, not only the viewport' } },
      ['tabId'],
    ),
  },
  {
    name: 'camofox_close_tab',
    readOnly: false,
    description: 'Close a tab. Do this when you finish with a page to free memory.',
    inputSchema: schema({ tabId }, ['tabId']),
  },
  {
    name: 'camofox_evaluate',
    readOnly: false,
    description:
      'Run a JavaScript expression in the page and return its result. Use it to read data a snapshot misses. Prefer click and type for interaction.',
    inputSchema: schema(
      {
        tabId,
        expression: { type: 'string', description: 'JavaScript expression evaluated in the page context' },
      },
      ['tabId', 'expression'],
    ),
  },
  {
    name: 'camofox_list_tabs',
    readOnly: true,
    description: 'List open tabs (tabId, url, title) for the current user identity. Use it to recover a lost tabId.',
    inputSchema: schema({}),
  },
  {
    name: 'camofox_import_cookies',
    readOnly: false,
    description:
      'Import cookies into the browser profile of the current user, to start already logged in. Pass cookiesTxt (the text of a Netscape cookies.txt file) or cookiesPath (a file in the server cookies directory). Use domainSuffix to import one site only.',
    inputSchema: schema({
      cookiesTxt: { type: 'string', description: 'Content of a Netscape-format cookies.txt file' },
      cookiesPath: {
        type: 'string',
        description: 'Relative path to a cookies.txt file inside the server cookies directory (alternative to cookiesTxt)',
      },
      domainSuffix: { type: 'string', description: 'Only import cookies whose domain ends with this suffix' },
    }),
  },

  // Tools added by the gateway.
  {
    name: 'camofox_wait',
    readOnly: false,
    description:
      'Wait until the page is ready (DOM loaded, network quiet, hydrated). Use it after a click or navigation, or while a bot-challenge page resolves. Then snapshot.',
    inputSchema: schema(
      {
        tabId,
        timeout: { type: 'number', description: 'Maximum wait in milliseconds (default 10000)' },
        waitForNetwork: { type: 'boolean', description: 'Also wait for network idle (default true)' },
        dismissConsent: { type: 'boolean', description: 'Try to dismiss a cookie-consent dialog (default false)' },
      },
      ['tabId'],
    ),
  },
  {
    name: 'camofox_press',
    readOnly: false,
    description: "Press a keyboard key or combination, e.g. 'Enter', 'Escape', 'Tab', 'Control+A'.",
    inputSchema: schema({ tabId, key: { type: 'string', description: 'Key name, e.g. Enter or Control+A' } }, [
      'tabId',
      'key',
    ]),
  },
  {
    name: 'camofox_select',
    readOnly: false,
    description: 'Choose an option in a native <select> by its visible label or value. Give a ref or selector.',
    inputSchema: schema(
      {
        tabId,
        ref,
        selector,
        option: { type: 'string', description: 'Visible label or HTML value of the option' },
      },
      ['tabId', 'option'],
    ),
  },
  {
    name: 'camofox_back',
    readOnly: false,
    description: 'Go back in the tab history. Returns the new url. Snapshot afterwards.',
    inputSchema: schema({ tabId }, ['tabId']),
  },
  {
    name: 'camofox_forward',
    readOnly: false,
    description: 'Go forward in the tab history. Returns the new url. Snapshot afterwards.',
    inputSchema: schema({ tabId }, ['tabId']),
  },
  {
    name: 'camofox_refresh',
    readOnly: false,
    description: 'Reload the page. Avoid it on a bot-challenge page: wait and snapshot instead.',
    inputSchema: schema({ tabId }, ['tabId']),
  },
  {
    name: 'camofox_links',
    readOnly: true,
    description:
      'List the http(s) links on the page as {url, text}, paged. Cheaper than a full snapshot when you only need URLs.',
    inputSchema: schema(
      {
        tabId,
        limit: { type: 'number', description: 'Links per page (default 50)' },
        offset: { type: 'number', description: 'Links to skip (default 0)' },
      },
      ['tabId'],
    ),
  },
  {
    name: 'camofox_extract',
    readOnly: true,
    description:
      "Read named values from snapshot refs into JSON. Take a snapshot first. schema is {type:'object', properties:{price:{type:'number','x-ref':'e12'}}, required:['price']}. Each property reads the text of one ref, typed as string, number, integer or boolean.",
    inputSchema: schema(
      {
        tabId,
        schema: {
          type: 'object',
          description: "JSON Schema with type 'object' and properties; each property may set 'x-ref' and 'type'",
        },
      },
      ['tabId', 'schema'],
    ),
  },
  {
    name: 'camofox_images',
    readOnly: true,
    description:
      'List images on the page ({src, alt, width, height}). Set includeData to receive the pictures themselves (png, jpeg, gif, webp).',
    inputSchema: schema(
      {
        tabId,
        limit: { type: 'number', description: 'Maximum images, 1-20 (default 8)' },
        includeData: { type: 'boolean', description: 'Return image data as image blocks (default false)' },
        maxBytes: { type: 'number', description: 'Skip images larger than this many bytes (default 2000000)' },
      },
      ['tabId'],
    ),
  },
  {
    name: 'camofox_downloads',
    readOnly: false,
    description:
      'List files the tab downloaded. Set includeData to receive the file content as an embedded resource. Set consume to delete the list afterwards.',
    inputSchema: schema(
      {
        tabId,
        includeData: { type: 'boolean', description: 'Attach file content (default false)' },
        maxBytes: { type: 'number', description: 'Skip files larger than this many bytes (default 1000000)' },
        consume: { type: 'boolean', description: 'Clear the download list after reading (default false)' },
      },
      ['tabId'],
    ),
  },
  {
    name: 'camofox_close_session',
    readOnly: false,
    description:
      "Close this identity's browser context and all its tabs. Cookies and the profile stay on disk. Other MCP clients that use the same user id lose their tabs too.",
    inputSchema: schema({}),
  },
  {
    name: 'camofox_status',
    readOnly: true,
    description:
      'Report camofox health (browser state, tabs, sessions), this connection\'s userId and sessionKey, and whether noVNC interactive login is enabled.',
    inputSchema: schema({}),
  },
];

/** Tool lookup by name. */
export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
