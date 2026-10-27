# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

- `gateway/` imports `/app/mcp/lib/tool-contracts.mjs` and `cookies.mjs` from the upstream image. Re-check those exports on every image bump, because a missing export stops the MCP server at start (`UPDATING.md` lists the checks).
- The gateway serves `skills/<name>/SKILL.md` verbatim as MCP prompts and resources. Keep `name` equal to the folder name and `metadata` on one line, because the gateway's frontmatter reader takes top-level scalar keys only.
- `npm test` runs wrapper regressions. `npm run check` runs TypeScript without emitting files and SDK lint. See `tests/README.md` for host-side gateway dependencies and TDD evidence. Do not build packages or change the image pin without release approval.
- Write `README.md`, `instructions.md`, and `skills/` in ASD-STE100 Simplified Technical English: at most 20 words for each instruction, no semicolons, no phrasal verbs.
