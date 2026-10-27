const defaults = {
  tabInactivityMinutes: 5,
  mcpSessionIdleMinutes: 30,
}

type IdleSettings = { [K in keyof typeof defaults]?: unknown }

const isIdleMinutes = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 1440

/** Validate persisted values as well as action input. Only absence uses defaults. */
export function idleTimeoutSettings(settings: IdleSettings = {}) {
  const result = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const value = settings[key] === undefined ? defaults[key] : settings[key]
    if (!isIdleMinutes(value)) {
      throw new Error(`${key} must be a whole number from 1 to 1440 minutes.`)
    }
    result[key] = value
  }
  return result
}

/** Form prefill only. An invalid field shows its default so the user can repair it. */
export function idleTimeoutPrefill(settings: IdleSettings = {}) {
  const result = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const value = settings[key]
    if (isIdleMinutes(value)) result[key] = value
  }
  return result
}
