import { requireAsciiCredential } from '../credentialValidation'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  getAddresses,
  novncPort,
  vncHostId,
  vncInterfaceId,
  vncPasswordLength,
} from '../utils'

const { InputSpec, Value } = sdk

const randomVncPassword = {
  charset: 'a-z,A-Z,0-9',
  len: vncPasswordLength,
}

const inputSpec = InputSpec.of({
  password: Value.text({
    name: i18n('VNC Password'),
    description: null,
    warning: null,
    required: true,
    default: randomVncPassword,
    generate: randomVncPassword,
    masked: true,
    minLength: vncPasswordLength,
    maxLength: vncPasswordLength,
    patterns: [
      {
        regex: `^[A-Za-z0-9]{${vncPasswordLength}}$`,
        description: `Must be exactly ${vncPasswordLength} ASCII letters or numbers.`,
      },
    ],
  }),
})

const waitForAddresses = async (
  effects: Parameters<typeof getAddresses>[0],
) => {
  const deadline = Date.now() + 10_000
  for (;;) {
    const addresses = await getAddresses(
      effects,
      vncHostId,
      novncPort,
      vncInterfaceId,
    )
    if (addresses.length > 0 || Date.now() > deadline) return addresses
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

export const enableInteractiveLogin = sdk.Action.withInput(
  'enable-interactive-login',

  async ({ effects }) => {
    const enabled = await storeJson
      .read((s) => s.interactive.enabled)
      .const(effects)
    return {
      name: i18n('Enable Interactive Login'),
      description: i18n(
        'Show the browser on a noVNC page, so that you can sign in to sites yourself. The service restarts.',
      ),
      warning: i18n(
        'Copy the proposed password before submitting. Anyone with it who can reach noVNC controls the browser. Disable this feature after signing in.',
      ),
      allowedStatuses: 'any' as const,
      group: null,
      visibility: enabled ? ('hidden' as const) : ('enabled' as const),
    }
  },

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    const password = requireAsciiCredential(
      input.password,
      vncPasswordLength,
      'VNC password',
    )
    await storeJson.merge(effects, {
      interactive: { enabled: true, password },
    })

    const addresses = await waitForAddresses(effects)

    return {
      version: '1',
      title: i18n('Interactive Login Is On'),
      message: i18n(
        'Open the noVNC address and enter the password you copied before submitting. Disable Interactive Login when finished.',
      ),
      result: {
        type: 'group',
        value: addresses.map((a) => ({
          type: 'single' as const,
          name: a.url,
          description: null,
          value: a.url,
          masked: false,
          copyable: true,
          qr: false,
          launchable: true,
        })),
      },
    }
  },
)

export const disableInteractiveLogin = sdk.Action.withoutInput(
  'disable-interactive-login',

  async ({ effects }) => {
    const enabled = await storeJson
      .read((s) => s.interactive.enabled)
      .const(effects)
    return {
      name: i18n('Disable Interactive Login'),
      description: i18n(
        'Close the noVNC page and remove the VNC password. The service restarts.',
      ),
      warning: i18n('Open browser sessions end. Saved cookies stay on disk.'),
      allowedStatuses: 'any' as const,
      group: null,
      visibility: enabled ? ('enabled' as const) : ('hidden' as const),
    }
  },

  async ({ effects }) => {
    await storeJson.merge(effects, {
      interactive: { enabled: false, password: null },
    })
    return {
      version: '1',
      title: i18n('Interactive Login Is Off'),
      message: i18n('The noVNC page is closed.'),
      result: null,
    }
  },
)
