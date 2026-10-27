/**
 * Check tool arguments against a tool's JSON Schema (the small subset these
 * tools use) and return a clean copy. MCP's low-level server does not validate,
 * and the upstream request builders spread arguments into URLs and bodies.
 * Unknown properties are dropped. Values must have their advertised JSON types.
 *
 * @param {{properties: Record<string, any>, required?: string[]}} schema
 * @param {unknown} rawArgs
 * @returns {{args: Record<string, any>} | {error: string}}
 */
export function validateArgs(schema, rawArgs) {
  if (rawArgs === undefined) rawArgs = {};
  if (rawArgs === null || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) return { error: 'Arguments must be an object.' };
  const input = /** @type {Record<string, unknown>} */ (rawArgs);
  const args = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    const value = input[key];
    if (value === undefined) continue;
    if (prop.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `"${key}" must be a number.` };
    } else if (prop.type === 'boolean') {
      if (typeof value !== 'boolean') return { error: `"${key}" must be true or false.` };
    } else if (prop.type === 'string') {
      if (typeof value !== 'string') return { error: `"${key}" must be a string.` };
    } else if (prop.type === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { error: `"${key}" must be an object.` };
      }
    }
    if (prop.enum && !prop.enum.includes(value)) {
      return { error: `"${key}" must be one of: ${prop.enum.join(', ')}.` };
    }
    args[key] = value;
  }
  for (const key of schema.required || []) {
    if (args[key] === undefined) return { error: `"${key}" is required.` };
  }
  // The tab id goes into a URL path: allow only what camofox itself generates.
  if (args.tabId !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(args.tabId)) {
    return { error: '"tabId" is not a valid tab id. Use the tabId returned by camofox_create_tab.' };
  }
  return { args };
}
