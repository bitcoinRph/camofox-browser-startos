import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  locale: Value.text({
    name: i18n('Locale'),
    description: i18n(
      'The browser language as a BCP 47 tag, such as en-US. Set it together with the timezone.',
    ),
    required: false,
    default: null,
    placeholder: 'en-US',
  }),
  timezone: Value.text({
    name: i18n('Timezone'),
    description: i18n(
      'The browser timezone as an IANA name, such as America/New_York. Set it together with the locale.',
    ),
    required: false,
    default: null,
    placeholder: 'America/New_York',
  }),
  maxSessions: Value.number({
    name: i18n('Maximum Sessions'),
    description: i18n(
      'The most browser sessions that can be open at one time.',
    ),
    required: true,
    default: 50,
    min: 1,
    max: 500,
    integer: true,
  }),
  maxTabsPerSession: Value.number({
    name: i18n('Maximum Tabs per Session'),
    description: i18n('The most tabs that one session can have open.'),
    required: true,
    default: 10,
    min: 1,
    max: 100,
    integer: true,
  }),
  maxTabsGlobal: Value.number({
    name: i18n('Maximum Tabs in Total'),
    description: i18n(
      'The most tabs that all sessions can have open together.',
    ),
    required: true,
    default: 50,
    min: 1,
    max: 500,
    integer: true,
  }),
  sessionTimeoutMinutes: Value.number({
    name: i18n('Session Timeout'),
    description: i18n(
      'Close a session after this time. Saved cookies stay on disk.',
    ),
    required: true,
    default: 10,
    min: 1,
    max: 1440,
    integer: true,
    units: i18n('minutes'),
  }),
  browserIdleTimeoutMinutes: Value.number({
    name: i18n('Browser Idle Timeout'),
    description: i18n(
      'Stop the browser process after this time with no sessions. This frees memory.',
    ),
    required: true,
    default: 5,
    min: 1,
    max: 1440,
    integer: true,
    units: i18n('minutes'),
  }),
  crashReports: Value.toggle({
    name: i18n('Crash Reports'),
    description: i18n(
      'Send crash reports to the Camofox developers. Reports are off by default.',
    ),
    default: false,
  }),
})

const isValidLocale = (locale: string) => {
  try {
    Intl.getCanonicalLocales(locale)
    return true
  } catch {
    return false
  }
}

const isValidTimezone = (timezone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

export const browserSettings = sdk.Action.withInput(
  'browser-settings',

  async () => ({
    name: i18n('Browser Settings'),
    description: i18n(
      'Set the browser locale, timezone, and limits. The service restarts to apply changes.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => storeJson.read((s) => s.browser).once(),

  async ({ effects, input }) => {
    const locale = input.locale?.trim() || null
    const timezone = input.timezone?.trim() || null

    if (!locale !== !timezone) {
      throw new Error(
        i18n('Set the locale and the timezone together, or leave both empty.'),
      )
    }
    if (locale && !isValidLocale(locale)) {
      throw new Error(
        i18n('The locale must be a valid BCP 47 tag, such as en-US.'),
      )
    }
    if (timezone && !isValidTimezone(timezone)) {
      throw new Error(
        i18n(
          'The timezone must be a valid IANA name, such as America/New_York.',
        ),
      )
    }

    await storeJson.merge(effects, { browser: { ...input, locale, timezone } })
  },
)
