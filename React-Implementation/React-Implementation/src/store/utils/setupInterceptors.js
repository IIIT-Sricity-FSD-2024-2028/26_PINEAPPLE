let boundStore = null;

/**
 * Binds the active Redux store so transport modules (apiClient.js, tokenManager.js)
 * can read state or dispatch global session/maintenance actions without circular imports.
 */
export function setupInterceptors(store) {
  boundStore = store || null;
  return () => {
    if (boundStore === store) {
      boundStore = null;
    }
  };
}

export function dispatchFromInterceptor(action) {
  if (boundStore && typeof boundStore.dispatch === 'function') {
    return boundStore.dispatch(action);
  }
  return undefined;
}

export function getStateFromInterceptor() {
  if (boundStore && typeof boundStore.getState === 'function') {
    return boundStore.getState();
  }
  return undefined;
}
