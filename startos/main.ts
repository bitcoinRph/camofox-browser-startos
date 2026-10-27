import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { idleTimeoutSettings } from './timeoutSettings'
import { apiPort, checkHttpOk, mcpPort, novncPort } from './utils'

const minutesToMs = (minutes: number) => String(Math.round(minutes * 60_000))

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Camofox Browser!'))

  const apiKey = await storeJson.read((s) => s.apiKey).const(effects)
  if (!apiKey) throw new Error('store.json holds no API key')
  const browser = await storeJson.read((s) => s.browser).const(effects)
  const idle = idleTimeoutSettings(browser ?? {})
  const proxy = await storeJson.read((s) => s.proxy).const(effects)
  const interactive = await storeJson.read((s) => s.interactive).const(effects)

  const identity =
    browser?.locale && browser.timezone
      ? {
          CAMOFOX_LOCALE: browser.locale,
          CAMOFOX_TIMEZONE: browser.timezone,
        }
      : {}

  const proxyEnv =
    proxy?.enabled && proxy.host
      ? {
          PROXY_PROTOCOL: proxy.protocol,
          PROXY_HOST: proxy.host,
          PROXY_PORT: String(proxy.port),
          PROXY_USERNAME: proxy.username || undefined,
          PROXY_PASSWORD: proxy.password || undefined,
        }
      : {}

  const vncEnabled = !!interactive?.enabled

  const vncEnv = vncEnabled
    ? {
        ENABLE_VNC: '1',
        VNC_PASSWORD: interactive?.password ?? undefined,
        VNC_BIND: '0.0.0.0',
        NOVNC_PORT: String(novncPort),
        VNC_RESOLUTION: interactive?.resolution,
      }
    : {}

  const subcontainer = sdk.SubContainer.of(
    effects,
    { imageId: 'camofox-browser' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    }),
    'camofox-sub',
  )

  return sdk.Daemons.of(effects)
    .addOneshot('data-dirs', {
      subcontainer,
      exec: {
        command: [
          'mkdir',
          '-p',
          '/data/profiles',
          '/data/cookies',
          '/data/uploads',
          '/data/traces',
        ],
      },
      requires: [],
    })
    .addDaemon('camofox', {
      subcontainer,
      exec: {
        command: ['node', '--max-old-space-size=256', 'server.js'],
        cwd: '/app',
        sigtermTimeout: 30_000,
        env: {
          NODE_ENV: 'production',
          CAMOFOX_PORT: String(apiPort),
          HOME: '/root',
          CAMOFOX_ACCESS_KEY: apiKey,
          CAMOFOX_API_KEY: apiKey,
          CAMOFOX_PROFILE_DIR: '/data/profiles',
          CAMOFOX_COOKIES_DIR: '/data/cookies',
          CAMOFOX_UPLOADS_DIR: '/data/uploads',
          CAMOFOX_TRACES_DIR: '/data/traces',
          CAMOFOX_CRASH_REPORT_ENABLED: browser?.crashReports
            ? 'true'
            : 'false',
          MAX_SESSIONS: String(browser?.maxSessions ?? 50),
          MAX_TABS_PER_SESSION: String(browser?.maxTabsPerSession ?? 10),
          MAX_TABS_GLOBAL: String(browser?.maxTabsGlobal ?? 50),
          SESSION_TIMEOUT_MS: minutesToMs(browser?.sessionTimeoutMinutes ?? 10),
          TAB_INACTIVITY_MS: minutesToMs(idle.tabInactivityMinutes),
          BROWSER_IDLE_TIMEOUT_MS: minutesToMs(
            browser?.browserIdleTimeoutMinutes ?? 5,
          ),
          ...identity,
          ...proxyEnv,
          ...vncEnv,
        },
      },
      ready: {
        display: i18n('REST API'),
        gracePeriod: 60_000,
        fn: () =>
          checkHttpOk(`http://127.0.0.1:${apiPort}/health`, {
            successMessage: i18n('The REST API is ready'),
            errorMessage: i18n('The REST API is not ready'),
          }),
      },
      requires: ['data-dirs'],
    })
    .addDaemon('mcp-gateway', {
      subcontainer,
      exec: {
        command: ['node', '/app/gateway/server.mjs'],
        cwd: '/app',
        env: {
          NODE_ENV: 'production',
          MCP_PORT: String(mcpPort),
          MCP_BIND: '0.0.0.0',
          MCP_SESSION_IDLE_MS: minutesToMs(idle.mcpSessionIdleMinutes),
          CAMOFOX_BASE_URL: `http://127.0.0.1:${apiPort}`,
          CAMOFOX_ACCESS_KEY: apiKey,
          CAMOFOX_API_KEY: apiKey,
          MCP_AUTH_TOKEN: apiKey,
          CAMOFOX_COOKIES_DIR: '/data/cookies',
          CAMOFOX_SKILLS_DIR: '/opt/camofox/skills',
          CAMOFOX_DEFAULT_USER_ID: 'agent',
          CAMOFOX_NOVNC_ENABLED: vncEnabled ? '1' : '0',
        },
      },
      ready: {
        display: i18n('MCP Server'),
        gracePeriod: 30_000,
        fn: () =>
          checkHttpOk(`http://127.0.0.1:${mcpPort}/healthz`, {
            successMessage: i18n('The MCP server is ready'),
            errorMessage: i18n('The MCP server is not ready'),
          }),
      },
      requires: ['camofox'],
    })
    .addHealthCheck('novnc', () =>
      vncEnabled
        ? {
            ready: {
              display: i18n('Interactive Login'),
              gracePeriod: 60_000,
              fn: () =>
                sdk.healthCheck.checkPortListening(effects, novncPort, {
                  successMessage: i18n('The noVNC page is ready'),
                  errorMessage: i18n('The noVNC page is not ready'),
                }),
            },
            requires: ['camofox'],
          }
        : null,
    )
})
