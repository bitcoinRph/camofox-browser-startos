import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Build one MCP server instance for one MCP session. The identity is fixed
 * here, so every tool call in the session uses the same userId and sessionKey.
 *
 * @param {Object} deps
 * @param {{name: string, version: string}} deps.info
 * @param {string} deps.instructions
 * @param {{callTool: Function, tools: Array<{name: string, description: string, inputSchema: object, readOnly: boolean}>}} deps.runner
 * @param {import('./skills.mjs').Skill[]} deps.skills
 * @param {{userId: string, sessionKey: string}} deps.identity
 * @returns {Server}
 */
export function createMcpServer({ info, instructions, runner, skills, identity }) {
  const server = new Server(info, {
    capabilities: { tools: {}, prompts: {}, resources: {} },
    instructions,
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: runner.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { readOnlyHint: t.readOnly, openWorldHint: true },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) =>
    runner.callTool(req.params.name, req.params.arguments, identity),
  );

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: skills.map((s) => ({ name: s.name, description: s.description, arguments: [] })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const skill = skills.find((s) => s.name === req.params.name);
    if (!skill) throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${req.params.name}`);
    return {
      description: skill.description,
      messages: [{ role: 'user', content: { type: 'text', text: skill.body } }],
    };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: skills.map((s) => ({
      uri: s.uri,
      name: s.name,
      description: s.description,
      mimeType: 'text/markdown',
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const skill = skills.find((s) => s.uri === req.params.uri);
    if (!skill) throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${req.params.uri}`);
    return { contents: [{ uri: skill.uri, mimeType: 'text/markdown', text: skill.body }] };
  });

  return server;
}
