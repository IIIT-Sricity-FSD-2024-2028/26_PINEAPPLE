module.exports = {
  initializeApp: () => ({}),
  getApps: () => [],
  cert: () => ({}),
  getAuth: () => ({
    verifyIdToken: async () => ({ uid: 'mock-uid', email: 'test@teamforge.io' }),
    getUser: async () => ({ uid: 'mock-uid', email: 'test@teamforge.io' }),
    updateUser: async () => ({}),
    revokeRefreshTokens: async () => ({}),
    createUser: async () => ({ uid: 'mock-uid' }),
    getUserByEmail: async () => null,
  }),
};
