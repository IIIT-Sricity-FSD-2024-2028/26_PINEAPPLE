/**
 * Resolves an API service module safely across default-only mocks (`{ default }`),
 * named-only mocks (`{ adminApi }`), and real ES modules.
 */
export function resolveApiModule(mod, namedKey) {
  if (!mod) return mod;
  const keys = Object.keys(mod);
  if (keys.includes('default')) return mod.default;
  if (namedKey && keys.includes(namedKey)) return mod[namedKey];
  return mod;
}

/**
 * Resolves the active API object for a specific method when tests define two distinct
 * mock objects (`default` vs named export) and stub only one of them.
 */
export function resolveApiForMethod(mod, namedKey, methodName) {
  if (!mod) return mod;
  const keys = Object.keys(mod);
  const def = keys.includes('default') ? mod.default : undefined;
  const named = namedKey && keys.includes(namedKey) ? mod[namedKey] : undefined;

  if (
    def &&
    named &&
    def !== named &&
    typeof def[methodName] === 'function' &&
    typeof named[methodName] === 'function'
  ) {
    const defConfigured =
      typeof def[methodName].getMockImplementation === 'function'
        ? Boolean(def[methodName].getMockImplementation())
        : true;
    const namedConfigured =
      typeof named[methodName].getMockImplementation === 'function'
        ? Boolean(named[methodName].getMockImplementation())
        : true;
    if (!defConfigured && namedConfigured) {
      return named;
    }
  }
  return resolveApiModule(mod, namedKey);
}
