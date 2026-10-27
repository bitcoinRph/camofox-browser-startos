# Updating the upstream version

The upstream is the container image `ghcr.io/jo-inc/camofox-browser`. The `Dockerfile` in the repository root pins it by tag and by index digest. The manifest builds the root `Dockerfile` (`dockerBuild`), so the manifest holds no image tag. The package has one upstream source.

## Determining the upstream version

The current pin is the `FROM` line of `Dockerfile`:

```
FROM ghcr.io/jo-inc/camofox-browser:<tag>@sha256:<index digest>
```

The image tag has no leading `v`. The git tag and the GitHub release tag have a leading `v`. Example: image tag `1.2.3` and git tag `v1.2.3`.

Find the latest release with one of these commands:

```bash
git ls-remote --tags --refs https://github.com/jo-inc/camofox-browser | sort -t/ -k3 -V | tail -n 5
gh release view -R jo-inc/camofox-browser --json tagName -q .tagName
```

Check that the image tag exists in the registry. Read the digest of the OCI index, not the digest of one platform:

```bash
docker buildx imagetools inspect ghcr.io/jo-inc/camofox-browser:<tag>
```

Copy the top-level `Digest` line. The `Manifests` list below it must show `linux/amd64` and `linux/arm64`. If the tag lacks one of them, do not bump. The manifest builds both architectures.

## Wrapper P1 preparation

Read `PATCHES.md` before any image change. Revision `1.18.1:2` contains wrapper-only gateway and timeout changes. The Docker digest remains unchanged. It does not include upstream engine fixes.

Preserve `startos/versions/previous.ts` and its version-graph entry. The prepared revision supports no-write upgrade and downgrade to `1.18.1:1`. Additive timeout settings do not require store migration. The older wrapper ignores them and restores its previous timeout defaults.

Run `npm test` and `npm run check` before packaging. See `tests/README.md` for dependencies. Builds, image publication, installation, and live probes require separate approval.

## Applying the bump

1. Edit the `FROM` line in `Dockerfile`. Set the new tag and the new index digest. Keep both.
2. Edit `startos/versions/current.ts`. Set `version` to `<upstream version>:0`. Update `releaseNotes` in all five languages. Do not add a new version file unless the old version carries a migration.
3. Check the items in the next list against the new upstream source.
4. Run `make javascript/index.js` to check the code. Then build the `.s9pk` in CI and test it on a StartOS server.

If only the package changes, keep the upstream version. Raise only the revision after the colon.

What to re-check on every bump:

- **Gateway imports.** `gateway/lib/contracts.mjs` imports `TOOL_DEFS`, `buildRequest`, `buildCookieRequest`, and `fetchSpec` from `/app/mcp/lib/tool-contracts.mjs`. It imports `parseNetscapeCookieFile` from `/app/mcp/lib/cookies.mjs`. Confirm that each export still exists with the same arguments.
- **REST routes.** `gateway/lib/tools.mjs` calls the routes `wait`, `press`, `select`, `back`, `forward`, `refresh`, `links`, `extract`, `images`, `downloads`, `/sessions/:userId`, and `/sessions/:userId/cookies`. Compare their fields with `openapi.json` and `server.js`. Upstream `openapi.json` can differ from the code. The `links` route returns `url` and `text`.
- **Environment variables.** Compare the variables that `startos/main.ts` sets with `lib/config.js` and the VNC variables in `plugins/vnc/README.md`. Check that the default of `CAMOFOX_CRASH_REPORT_ENABLED` is still handled. The package sets it on every start.
- **Plugins.** Check `camofox.config.json` in the image. The package expects the persistence plugin on and the VNC plugin off. The `ENABLE_VNC` variable turns VNC on.
- **Auth.** Check `lib/auth.js`. The package relies on one key that works on every route. Check that `POST /stop` still needs an admin key.
- **Search macros.** Compare `lib/macros.js` with the macro list in `skills/camofox-stealth-browsing/SKILL.md`. The gateway adds `@reddit_subreddit` by hand when the upstream enum lacks it.
- **Skills.** Read the five skills in `skills/` against the new README and routes. Fix any tool name, route, limit, or default that changed.
- **Image contents.** Check that the image still holds `express` and `@modelcontextprotocol/sdk` in `/app/node_modules`. The gateway needs both. Verify SDK exports `CallToolRequestParamsSchema`, `JSONRPCMessageSchema`, `McpError`, `ErrorCode`, `DEFAULT_NEGOTIATED_PROTOCOL_VERSION`, `SUPPORTED_PROTOCOL_VERSIONS`, and `LATEST_PROTOCOL_VERSION`. A missing export prevents gateway startup. Recheck protocol negotiation against the SDK initialize handler.
