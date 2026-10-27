// The upstream tool contracts live in /app/mcp/lib inside the image. Importing
// them (instead of copying) keeps routes, request bodies and auth identical to
// the stdio MCP server and the OpenClaw plugin. CAMOFOX_CONTRACTS_DIR lets a
// test point at another copy.
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = process.env.CAMOFOX_CONTRACTS_DIR || join(here, '..', '..', 'mcp', 'lib');

const toolContracts = await import(pathToFileURL(join(dir, 'tool-contracts.mjs')).href);
const cookies = await import(pathToFileURL(join(dir, 'cookies.mjs')).href);

/** Upstream tool definitions (name, description, inputSchema). */
export const UPSTREAM_TOOLS = toolContracts.TOOL_DEFS;
/** Upstream request builder for the original 11 tools. */
export const buildRequest = toolContracts.buildRequest;
/** Upstream cookie-file request builder (reads and parses a file in the cookies dir). */
export const buildCookieRequest = toolContracts.buildCookieRequest;
/** Upstream HTTP dispatcher: sets auth headers and throws `Error("<status>: <body>")`. */
export const fetchSpec = toolContracts.fetchSpec;
/** Upstream Netscape cookies.txt parser. */
export const parseNetscapeCookieFile = cookies.parseNetscapeCookieFile;
