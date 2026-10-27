import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { defaultResolution } from '../utils'

const browserSchema = z.looseObject({
  locale: z.string().nullable().catch(null),
  timezone: z.string().nullable().catch(null),
  maxSessions: z.number().catch(50),
  maxTabsPerSession: z.number().catch(10),
  maxTabsGlobal: z.number().catch(50),
  sessionTimeoutMinutes: z.number().catch(10),
  browserIdleTimeoutMinutes: z.number().catch(5),
  crashReports: z.boolean().catch(false),
})

const proxySchema = z.looseObject({
  enabled: z.boolean().catch(false),
  protocol: z.enum(['http', 'https', 'socks4', 'socks5']).catch('http'),
  host: z.string().catch(''),
  port: z.number().catch(0),
  username: z.string().catch(''),
  password: z.string().catch(''),
})

const interactiveSchema = z.looseObject({
  enabled: z.boolean().catch(false),
  password: z.string().nullable().catch(null),
  resolution: z.string().catch(defaultResolution),
})

const shape = z.looseObject({
  apiKey: z.string().catch(''),
  browser: browserSchema.catch(() => browserSchema.parse({})),
  proxy: proxySchema.catch(() => proxySchema.parse({})),
  interactive: interactiveSchema.catch(() => interactiveSchema.parse({})),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.startos, subpath: 'store.json' },
  shape,
)
