import { T } from '@start9labs/start-sdk'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  AddressEntry,
  apiHostId,
  apiInterfaceId,
  apiPort,
  getAddresses,
  getBridgeUrl,
  mcpHostId,
  mcpInterfaceId,
  mcpPort,
  novncPort,
  preferredAddress,
  vncHostId,
  vncInterfaceId,
} from '../utils'

type Member = Extract<T.ActionResultMember, { type: 'single' | 'multiline' }>

const urlMembers = (entries: AddressEntry[], trimSlash: boolean): Member[] =>
  entries.map((e) => ({
    type: 'single',
    name: e.url,
    description: null,
    value: trimSlash ? e.url.replace(/\/$/, '') : e.url,
    masked: false,
    copyable: true,
    qr: false,
    launchable: false,
  }))

const snippet = (
  name: string,
  description: string,
  value: string,
  filename: string | null,
): Member => ({
  type: 'multiline',
  name,
  description,
  value,
  masked: false,
  copyable: true,
  qr: false,
  filename,
})

export const connectionInfo = sdk.Action.withoutInput(
  'connection-info',

  async () => ({
    name: i18n('Connection Info'),
    description: i18n(
      'Show API addresses and credential-free setup snippets for AI agent clients.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const apiUrls = await getAddresses(
      effects,
      apiHostId,
      apiPort,
      apiInterfaceId,
    )
    const mcpUrls = await getAddresses(
      effects,
      mcpHostId,
      mcpPort,
      mcpInterfaceId,
    )
    const apiBridge = await getBridgeUrl(effects, apiHostId, apiPort, '')
    const mcpBridge = await getBridgeUrl(effects, mcpHostId, mcpPort, '/mcp')

    const apiUrl = (preferredAddress(apiUrls)?.url ?? apiBridge ?? '').replace(
      /\/$/,
      '',
    )
    const mcpUrl = preferredAddress(mcpUrls)?.url ?? mcpBridge ?? ''

    const members: T.ActionResultMember[] = [
      {
        type: 'group',
        name: i18n('REST API URLs'),
        description: i18n('Addresses for clients that use the REST API.'),
        value: urlMembers(apiUrls, true),
      },
      {
        type: 'group',
        name: i18n('MCP URLs'),
        description: i18n('Addresses for clients that use MCP.'),
        value: urlMembers(mcpUrls, false),
      },
    ]

    const bridge: Member[] = []
    if (apiBridge) {
      bridge.push({
        type: 'single',
        name: i18n('REST API'),
        description: null,
        value: apiBridge,
        masked: false,
        copyable: true,
        qr: false,
        launchable: false,
      })
    }
    if (mcpBridge) {
      bridge.push({
        type: 'single',
        name: i18n('MCP Server'),
        description: null,
        value: mcpBridge,
        masked: false,
        copyable: true,
        qr: false,
        launchable: false,
      })
    }
    if (bridge.length > 0) {
      members.push({
        type: 'group',
        name: i18n('Same-Server Addresses'),
        description: i18n(
          'Use these plain HTTP addresses from other services on this StartOS server.',
        ),
        value: bridge,
      })
    }

    const vncUrls = await getAddresses(
      effects,
      vncHostId,
      novncPort,
      vncInterfaceId,
    )
    if (vncUrls.length > 0) {
      members.push({
        type: 'group',
        name: i18n('Interactive Login'),
        description: i18n(
          'Open the noVNC page and use the password you copied before enabling Interactive Login.',
        ),
        value: urlMembers(vncUrls, false),
      })
    }

    members.push({
      type: 'group',
      name: i18n('Client Setup'),
      description: i18n(
        'Copy the snippet, then insert the API key you chose in Regenerate API Key.',
      ),
      value: [
        snippet(
          'Claude Code',
          i18n('Run this command in a shell.'),
          `claude mcp add --transport http camofox ${mcpUrl} --header "Authorization: Bearer <copy-from-rotate-api-key>"`,
          null,
        ),
        snippet(
          'Codex',
          i18n(
            'Add the TOML to ~/.codex/config.toml. Export the key in the shell that starts Codex.',
          ),
          [
            '[mcp_servers.camofox]',
            `url = "${mcpUrl}"`,
            'bearer_token_env_var = "CAMOFOX_API_KEY"',
            '# http_headers = { "X-Camofox-User" = "codex" }',
            '',
            'export CAMOFOX_API_KEY=<copy-from-rotate-api-key>',
          ].join('\n'),
          null,
        ),
        snippet(
          'Hermes Agent (plugin)',
          i18n(
            'Add these lines to the Hermes .env file. Current Hermes releases include the Camofox client.',
          ),
          [
            `CAMOFOX_URL=${apiUrl}`,
            'CAMOFOX_API_KEY=<copy-from-rotate-api-key>',
          ].join('\n'),
          null,
        ),
        snippet(
          'Hermes Agent (MCP)',
          i18n(
            'Add the YAML to the Hermes config. Add the key line to the Hermes .env file.',
          ),
          [
            'mcp_servers:',
            '  camofox:',
            `    url: ${mcpUrl}`,
            '    headers:',
            '      Authorization: "Bearer ${CAMOFOX_API_KEY}"',
            '',
            'CAMOFOX_API_KEY=<copy-from-rotate-api-key>',
          ].join('\n'),
          null,
        ),
        snippet(
          'OpenClaw',
          i18n(
            'Run the install command. Set the plugin options. Add the environment variables to the OpenClaw process.',
          ),
          [
            'openclaw plugins install @askjo/camofox-browser',
            '',
            `url: ${apiUrl}`,
            'autoStart: false',
            '',
            'CAMOFOX_ACCESS_KEY=<copy-from-rotate-api-key>',
            'CAMOFOX_API_KEY=<copy-from-rotate-api-key>',
          ].join('\n'),
          null,
        ),
      ],
    })

    return {
      version: '1',
      title: i18n('Connection Info'),
      message: i18n(
        'A client on another device must trust the StartOS root CA to use an https .local address.',
      ),
      result: { type: 'group', value: members },
    }
  },
)
