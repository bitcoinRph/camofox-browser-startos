import { T } from '@start9labs/start-sdk'
import { sdk } from './sdk'

export const apiPort = 9377
export const mcpPort = 9378
export const novncPort = 6080

export const apiHostId = 'api'
export const mcpHostId = 'mcp'
export const vncHostId = 'vnc'

export const apiInterfaceId = 'api'
export const mcpInterfaceId = 'mcp'
export const vncInterfaceId = 'vnc'

export const defaultResolution = '1920x1080'
export const apiKeyLength = 48
export const vncPasswordLength = 8

export const checkHttpOk = async (
  url: string,
  messages: { successMessage: string; errorMessage: string },
): Promise<{ result: 'success' | 'failure'; message: string }> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    if (res.status === 200) {
      return { result: 'success', message: messages.successMessage }
    }
  } catch {}
  return { result: 'failure', message: messages.errorMessage }
}

export type AddressEntry = {
  url: string
  ssl: boolean
  kind: string
}

const kindRank: Record<string, number> = {
  'public-domain': 0,
  'private-domain': 0,
  mdns: 1,
  ipv4: 2,
  ipv6: 3,
}

export const preferredAddress = (entries: AddressEntry[]) =>
  [...entries].sort(
    (a, b) =>
      Number(b.ssl) - Number(a.ssl) ||
      (kindRank[a.kind] ?? 9) - (kindRank[b.kind] ?? 9),
  )[0]

export const getAddresses = async (
  effects: T.Effects,
  hostId: string,
  port: number,
  interfaceId: string,
): Promise<AddressEntry[]> => {
  const iface = await sdk.host
    .getOwn(
      effects,
      hostId,
      (host) => host?.bindings[port]?.interfaces[interfaceId],
    )
    .once()
  if (!iface) return []
  const addresses = iface.addressInfo.nonLocal
  return addresses.hostnames.map((h) => ({
    url: addresses.toUrl(h),
    ssl: h.ssl,
    kind: h.metadata.kind,
  }))
}

export const getBridgeUrl = async (
  effects: T.Effects,
  hostId: string,
  port: number,
  path: string,
): Promise<string | null> => {
  const address = await sdk.host
    .getBridgeAddress(effects, { hostId, internalPort: port, ssl: false })
    .once()
  return address ? `http://${address}${path}` : null
}
