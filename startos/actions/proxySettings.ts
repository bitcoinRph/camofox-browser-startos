import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value, Variants } = sdk

const inputSpec = InputSpec.of({
  proxy: Value.union({
    name: i18n('Proxy'),
    description: i18n(
      'Route all browser traffic through a proxy server. The proxy is off by default.',
    ),
    default: 'disabled',
    variants: Variants.of({
      disabled: {
        name: i18n('Off'),
        spec: InputSpec.of({}),
      },
      enabled: {
        name: i18n('On'),
        spec: InputSpec.of({
          protocol: Value.select({
            name: i18n('Protocol'),
            default: 'http',
            values: {
              http: 'HTTP',
              https: 'HTTPS',
              socks4: 'SOCKS4',
              socks5: 'SOCKS5',
            },
          }),
          host: Value.text({
            name: i18n('Host'),
            description: i18n('The host name or IP address of the proxy.'),
            required: true,
            default: null,
            placeholder: 'proxy.example.com',
            patterns: [
              {
                regex: '\\S+',
                description: i18n('The host cannot contain spaces.'),
              },
            ],
          }),
          port: Value.number({
            name: i18n('Port'),
            required: true,
            default: null,
            min: 1,
            max: 65535,
            integer: true,
            placeholder: '8080',
          }),
          username: Value.text({
            name: i18n('Username'),
            required: false,
            default: null,
          }),
          password: Value.text({
            name: i18n('Password'),
            required: false,
            default: null,
            masked: true,
          }),
        }),
      },
    }),
  }),
})

export const proxySettings = sdk.Action.withInput(
  'proxy-settings',

  async () => ({
    name: i18n('Proxy Settings'),
    description: i18n(
      'Route browser traffic through a proxy. The service restarts to apply changes.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => {
    const proxy = await storeJson.read((s) => s.proxy).once()
    if (!proxy?.enabled)
      return { proxy: { selection: 'disabled' as const, value: {} } }
    return {
      proxy: {
        selection: 'enabled' as const,
        value: {
          protocol: proxy.protocol,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password,
        },
      },
    }
  },

  async ({ effects, input }) => {
    const { proxy } = input
    if (proxy.selection === 'disabled') {
      await storeJson.merge(effects, { proxy: { enabled: false } })
      return
    }
    const { protocol, host, port, username, password } = proxy.value
    await storeJson.merge(effects, {
      proxy: {
        enabled: true,
        protocol,
        host: host.trim(),
        port,
        username: username ?? '',
        password: password ?? '',
      },
    })
  },
)
