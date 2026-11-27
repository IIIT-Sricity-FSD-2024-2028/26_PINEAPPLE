/**
 * Single-flight coordinator for admin session refresh.
 * Stored strictly in memory.
 */
let inFlightAdminRefreshPromise = null;
let onAdminSessionRefreshedHandler = null;
let adminRefreshRequester = null;

export function setAdminSessionRefreshedHandler(fn) {
  onAdminSessionRefreshedHandler = typeof fn === 'function' ? fn : null;
}

export function setAdminRefreshRequester(fn) {
  adminRefreshRequester = typeof fn === 'function' ? fn : null;
}

export function notifyAdminSessionRefreshed(payload) {
  if (onAdminSessionRefreshedHandler) {
    onAdminSessionRefreshedHandler(payload);
  }
}

export async function runSingleFlightAdminRefresh(refreshFn) {
  if (inFlightAdminRefreshPromise) {
    return inFlightAdminRefreshPromise;
  }

  const executor = typeof refreshFn === 'function' ? refreshFn : adminRefreshRequester;
  if (typeof executor !== 'function') {
    return null;
  }

  let promise;
  try {
    promise = Promise.resolve(executor());
  } catch (err) {
    promise = Promise.reject(err);
  }

  inFlightAdminRefreshPromise = promise.finally(() => {
    inFlightAdminRefreshPromise = null;
  });

  return inFlightAdminRefreshPromise;
}

export function resetAdminRefreshCoordinator() {
  inFlightAdminRefreshPromise = null;
}

export function hasAdminRefreshInFlight() {
  return Boolean(inFlightAdminRefreshPromise);
}
