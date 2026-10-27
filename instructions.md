# Camofox Browser

## Documentation

- [Camofox Browser README](https://github.com/jo-inc/camofox-browser/blob/master/README.md) — features, REST routes, search macros, settings
- [Camofox REST API specification](https://github.com/jo-inc/camofox-browser/blob/master/openapi.json) — every route with its request and response fields
- [VNC plugin guide](https://github.com/jo-inc/camofox-browser/blob/master/plugins/vnc/README.md) — how interactive login works
- [Persistence plugin guide](https://github.com/jo-inc/camofox-browser/blob/master/plugins/persistence/README.md) — how saved logins work

## What you get on StartOS

Camofox Browser gives your AI agents a stealth web browser that runs on your server.

- **REST API.** Agents that use plain HTTP connect here.
- **MCP server.** Agents that support MCP, such as Claude Code and Codex, connect here. It also gives your agent five skills. The skills teach it to browse, handle bot checks, extract data, hand a login to you, and set itself up.
- **Interactive Login.** You can open the browser in your own web browser. You sign in to a site, and your agent then uses the saved session. This is off until you turn it on.
- **One API key.** The same key protects the REST API and the MCP server.
- **Saved logins.** The browser keeps cookies for each agent identity. They stay on your server and are part of your backups.

## Getting set up

1. Start the service.
2. Run **Regenerate API Key**. Copy the proposed key from the masked form before you submit it. The completed action does not show the key again.
3. Run **Connection Info**. It shows the REST and MCP addresses and setup text for Claude Code, Codex, Hermes Agent, and OpenClaw. The setup text contains a placeholder, not the key.
4. Copy the setup text for your agent client. Replace the placeholder with the API key you copied. Put the key in an environment variable, not in a chat.
5. Ask your agent to open a web page and describe it. If it answers, the connection works.
6. Optional but recommended. Run **Browser Settings** and set the locale and the time zone. Choose values that match the place of your internet address. Sites then see a consistent browser. StartOS shows a prompt for this until you do it.
7. Optional. Run **Proxy Settings** if the browser must use a proxy. Most home servers do not need one.

If you lose the API key, run **Regenerate API Key** again, copy the proposed key before submitting, and update every client.

## Using Camofox Browser

### Sign in to a site yourself

Use this for sites that need a password, MFA, or a CAPTCHA. Your agent never sees your password.

1. Run **Enable Interactive Login**. Copy the proposed VNC password from the masked form before you submit it. The service restarts, and the completed action shows the noVNC address but not the password.
2. Ask your agent to open the login page of the site.
3. Open the address in your web browser. Enter the password you copied. You see the browser of your agent.
4. Sign in to the site in that window. Complete MFA or the CAPTCHA.
5. Tell your agent that you are done. Ask it to check that the login worked.
6. Run **Disable Interactive Login**. The saved login stays.

Do this within a few minutes of step 2. A session that gets no calls from your agent closes after the session timeout. Ask your agent to keep the page open while you sign in, or raise **Session Timeout** in **Browser Settings**.

Anyone who has the address and the password can control the browser. Keep Interactive Login off when you do not need it.

### Settings

- **Browser Settings.** Set the locale, the time zone, the limits, and the timeouts. Crash reports are off. You can turn them on here. The service restarts when you save.
- **Proxy Settings.** Turn the proxy on or off and set its protocol, host, port, user name, and password. The service restarts when you save.

### Keys and saved data

- **Regenerate API Key.** Run it if the key is no longer secret or you lost your copy. Copy the proposed key before submitting. The old key stops working, and the completed action does not show the new key. Update every client with the key you copied.
- **Reset Browser Profiles.** StartOS offers this action only while the service is stopped. It deletes all saved logins and cookie files. You cannot undo it.

### Use the skills

Your agent can read the skills as MCP prompts. The names are `camofox-stealth-browsing`, `camofox-bot-challenges`, `camofox-data-extraction`, `camofox-login-handoff`, and `camofox-agent-setup`. If your client does not show MCP prompts, ask your agent to read the resource `camofox://skills/<name>`.
