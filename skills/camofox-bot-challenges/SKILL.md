---
name: camofox-bot-challenges
description: Use when a Camofox page shows a Cloudflare or Turnstile check, a CAPTCHA, or a human-verification page, or returns 403, 429, or 503. Explains how to recognise the challenge, wait, back off, keep the identity consistent, hand off to a person, and stop.
metadata: {"hermes": {"tags": ["browser", "camofox", "captcha", "cloudflare", "turnstile"], "related_skills": ["camofox-stealth-browsing", "camofox-login-handoff"]}, "openclaw": {"emoji": "🛡️"}}
---

# Camofox bot challenges

Camofox lowers the chance of a challenge. It does not remove the chance. No setting guarantees a pass. Treat a challenge as a signal to slow down.

## Recognise a challenge

Take a snapshot. Look for these signs:

- The title or text has a phrase like "Just a moment", "Checking your browser", "Verify you are human", "Access denied", or "unusual traffic".
- The snapshot has very few refs and no page content.
- The tab result has `navigationOk: false` with `httpStatus` 403, 429, or 503.
- The page shows a checkbox or a widget in a frame. Some CAPTCHA frames do not appear in a snapshot. Take a screenshot to see them.
- The URL moves to a path with `challenge` or `captcha` in it.

If none of these signs is present, the page is not a challenge. Continue with the task.

## Response ladder

Follow the steps in order. Stop at the first step that works.

1. Wait. Call `camofox_wait` with a `timeout` of 10000. Then take a new snapshot. Many checks end by themselves in a few seconds. With Hermes native tools, call `browser_snapshot` again after a pause.
2. Do not try to solve a CAPTCHA with automation. Do not reload in a loop.
3. If the page is still a challenge, wait 30 seconds. Take a snapshot. Make at most two more attempts. Increase the wait each time. Example: 30 seconds, 2 minutes, 10 minutes.
4. Close the tab. Open a new tab later with the same `userId`. Do not create many tabs to retry.
5. Check the browser identity. Read the next section.
6. If the site needs a person, hand off. Read `camofox-login-handoff`.
7. If the challenge stays, stop. Report the URL, the status code, and what you tried.

Do not reload more than once on the same page. A reload loop makes the site more likely to block the address.

## Keep the identity consistent

A site compares the IP address, the language, and the time zone. A mismatch raises the chance of a challenge.

- Run Camofox on a home server with a residential IP when you can. This is the best default.
- Use the `Browser Settings` action to set the locale and the time zone. Set both. Choose values that match the place of the IP address. Example: `en-GB` and `Europe/London`.
- Without a proxy, Camofox does not read the location from the IP. You must set the values.
- Use a proxy only when you need a different location or the home IP is blocked. Set it with the `Proxy Settings` action.
- With a proxy, Camofox sets locale, time zone, and geolocation from the proxy exit IP. Do not set them again by hand.
- With a proxy, a navigation timeout or a proxy error can make the server destroy the session. Your tabs then return `404`. Open a new tab.
- Do not change the settings during a task. A change restarts the service and closes all tabs.

## Reuse a warmed profile

A profile that has a history of normal visits gets fewer challenges than a new one.

- Use the same `userId` for the same site. The server saves cookies and storage for that `userId` and restores them.
- Pass a challenge once by hand with Interactive Login. The saved cookies then often let later visits pass. A site can still ask again.
- Do not delete the profile unless you want a clean start. The `Reset Browser Profiles` action deletes all profiles.
- Use a separate `userId` for each unrelated task. Do not use new identities to avoid a block.

## Hand off to a person

Hand off when a CAPTCHA needs a human, when a login needs MFA, or when waiting did not help.

1. Ask the user to run the `Enable Interactive Login` action and open the noVNC URL.
2. Open the page in a tab with your `userId`. The user sees this tab in noVNC.
3. Tell the user which step to complete. Ask the user to tell you when it is done.
4. Keep the session alive. Call `camofox_snapshot` or `camofox_wait` every few minutes.
5. Take a snapshot to check the result. Continue the task.

Never ask the user to type a password into the chat. Read `camofox-login-handoff` for the full flow.

## When to stop

Stop when any of these is true:

- The same site challenges you after the ladder above.
- The page says that automated access is not allowed.
- The site asks for a payment, an identity document, or a phone number that you do not have.
- The user did not give permission for the task.

Report what happened. Do not try a different tool to get around the block without asking the user.

## Responsible use

- Respect the site terms of service and its `robots.txt`. If the terms forbid automated access, do not browse that site with this tool.
- Respect rate limits. Make few requests. Pace them like a person.
- Do not use stolen or guessed credentials. Do not test lists of passwords (credential stuffing).
- Do not use CAPTCHA solving farms or paid solving services.
- Do not collect personal data of other people without a lawful reason.
- Do not use Camofox to bypass a paywall, an age check, or another access control.
- Only use accounts that belong to the user.
