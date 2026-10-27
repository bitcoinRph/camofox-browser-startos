# Camofox agent skills

This folder holds five agent skills for the Camofox Browser service. Each skill is a folder with a `SKILL.md` file. The format is the common Agent Skills format. It works in Claude Code, Codex, Hermes Agent, and OpenClaw.

| Skill | Use it for |
|---|---|
| `camofox-stealth-browsing` | Choose Camofox. Run the tab, snapshot, and act loop. Save tokens. Keep a stable identity. |
| `camofox-bot-challenges` | Handle Cloudflare, Turnstile, CAPTCHA, and 403 or 429 pages. Use the service responsibly. |
| `camofox-data-extraction` | Collect lists, tables, links, images, and files. Check that the data is complete. |
| `camofox-login-handoff` | Let the user sign in through noVNC. Reuse the saved session. Import cookies. |
| `camofox-agent-setup` | Connect Claude Code, Codex, Hermes Agent, OpenClaw, or REST. Fix connection errors. |

Every skill names three sets of tools: the MCP tools (`camofox_*`), the Hermes native tools (`browser_*`), and the REST routes.

## Get the files

Clone the package repository and use the `skills/` folder:

```bash
git clone https://github.com/bitcoinRph/camofox-browser-startos
```

The Camofox Browser package also keeps a copy of these files in the service image. The MCP server serves them to MCP clients.

## Install

### MCP clients

An MCP client that lists prompts and resources gets the skills with no install. Each skill is one prompt and one resource. The resource URI is `camofox://skills/<name>`. Connect the client first. Read `camofox-agent-setup`.

### Claude Code

Copy the skill folders to the user skills folder:

```bash
mkdir -p ~/.claude/skills
cp -r skills/camofox-* ~/.claude/skills/
```

For one project only, copy them to `.claude/skills/` in that project.

### Codex

Put the skill folders in the skills folder that Codex reads. See the Codex documentation at <https://developers.openai.com/codex/skills> for the path.

### Hermes Agent

Add the folder to `skills.external_dirs` in `~/.hermes/config.yaml`:

```yaml
skills:
  external_dirs:
    - /path/to/camofox-browser-startos/skills
```

Or copy the skill folders to `~/.hermes/skills/`. Start a new session after the change.

### OpenClaw

Add the folder to `skills.load.extraDirs` in the OpenClaw configuration:

```json
{
  "skills": {
    "load": { "extraDirs": ["/path/to/camofox-browser-startos/skills"] }
  }
}
```

## Edit a skill

Keep the frontmatter on one line for `metadata`. OpenClaw needs single-line JSON there. Keep the `name` equal to the folder name. The MCP server reads each `skills/<name>/SKILL.md` as it is.
