import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  apiHostId,
  apiInterfaceId,
  apiPort,
  mcpHostId,
  mcpInterfaceId,
  mcpPort,
  novncPort,
  vncHostId,
  vncInterfaceId,
} from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const interactive = await storeJson
    .read((s) => s.interactive.enabled)
    .const(effects)

  const apiOrigin = await sdk.MultiHost.of(effects, apiHostId).bindPort(
    apiPort,
    { protocol: 'http', preferredExternalPort: apiPort },
  )
  const api = sdk.createInterface(effects, {
    name: i18n('REST API'),
    id: apiInterfaceId,
    description: i18n(
      'The Camofox REST API. Send the API key as a Bearer token.',
    ),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  const mcpOrigin = await sdk.MultiHost.of(effects, mcpHostId).bindPort(
    mcpPort,
    { protocol: 'http', preferredExternalPort: mcpPort },
  )
  const mcp = sdk.createInterface(effects, {
    name: i18n('MCP Server'),
    id: mcpInterfaceId,
    description: i18n(
      'The MCP endpoint for AI agents. Send the API key as a Bearer token.',
    ),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '/mcp',
    query: {},
  })

  const receipts = [
    await apiOrigin.export([api]),
    await mcpOrigin.export([mcp]),
  ]

  if (interactive) {
    const vncOrigin = await sdk.MultiHost.of(effects, vncHostId).bindPort(
      novncPort,
      { protocol: 'http', preferredExternalPort: novncPort },
    )
    const vnc = sdk.createInterface(effects, {
      name: i18n('Interactive Login'),
      id: vncInterfaceId,
      description: i18n(
        'The noVNC page that shows the browser. Sign in to sites here, then let agents reuse the session.',
      ),
      type: 'ui',
      masked: false,
      schemeOverride: null,
      username: null,
      path: '/vnc.html',
      query: { resize: 'scale' },
    })
    receipts.push(await vncOrigin.export([vnc]))
  }

  return receipts
})
