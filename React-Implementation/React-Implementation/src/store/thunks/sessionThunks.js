import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { auth, githubProvider, googleProvider } from '../../services/firebase';
import * as authApiModule from '../../services/authApi';
import * as adminApiModule from '../../services/adminApi';
import * as mentorApplicationsApiModule from '../../services/mentorApplicationsApi';
import {
  checkServerBoot,
  getAuthMode,
  resetServerRestartGuard,
  setAccessToken,
  setRestartRedirectHandler,
} from '../../services/apiClient';
import tokenManager from '../../services/tokenManager';
import { runSingleFlightAdminRefresh } from '../../services/adminTokenManager';

export function registerRestartRedirectHandler(handler) {
  setRestartRedirectHandler(handler);
}
import { resolveApiForMethod } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';
import {
  ROLE_CANONICAL,
  canonicalRole,
  computeAllowedRoles,
  getHomePathForRole,
} from '../utils/roleHelpers';
import {
  clearAdminSession,
  setActiveRole,
  setAdminBootstrapStatus,
  setAdminSession,
  setBootId,
  setMentorStatus,
  setNotice,
  setSession,
  setSessionStatus,
  setSuspendedInfo,
  userUpdated,
} from '../slices/sessionSlice';
import { sessionReset } from '../actions/appActions';

let authChannel = null;
let authUnsubscribe = null;

export function getCurrentAuthMode() {
  return getAuthMode();
}

export function mapMeToUser(me, fbUser = null, tokenResult = null) {
  if (!me || (!me.uid && !me.id && !fbUser)) return null;
  const uid = me.uid || me.id || fbUser?.uid;
  const profile = me.profile || {};
  const role = me.role || tokenResult?.claims?.role || 'Collaborator';
  const rawAvatar =
    me.avatarUrl || profile.avatarUrl || me.avatar || profile.avatar || null;
  const canonicalAvatar =
    typeof rawAvatar === 'string' && rawAvatar.trim().length > 0 && !/^blob:/i.test(rawAvatar)
      ? rawAvatar.trim()
      : null;
  const updatedAt = me.updatedAt || profile.updatedAt || null;

  return {
    id: uid,
    uid,
    email: me.email || fbUser?.email || '',
    name: me.name || profile.fullName || fbUser?.displayName || '',
    username: me.username || profile.username || '',
    avatarUrl: canonicalAvatar,
    avatar: canonicalAvatar || '',
    updatedAt,
    university: me.university || profile.university || '',
    bio: me.bio || profile.bio || '',
    skills: me.skills || profile.skills || [],
    profile: {
      ...profile,
      avatarUrl: canonicalAvatar,
      avatar: canonicalAvatar,
    },
    xp: me.xp,
    phone: me.phone,
    phoneVerified: Boolean(me.phoneVerified),
    role,
    permissions: me.permissions || [],
    claims: me.claims || tokenResult?.claims || {},
    mentorUnlocked: Boolean(
      me.mentorUnlocked ||
        profile.mentorUnlocked ||
        String(role).toLowerCase() === 'mentor',
    ),
    profileComplete: me.profileComplete !== false,
    needsUsernameConfirmation: Boolean(me.needsUsernameConfirmation),
    emailVerified:
      typeof me.emailVerified === 'boolean'
        ? me.emailVerified
        : fbUser
          ? Boolean(fbUser.emailVerified)
          : true,
    hasPassword: typeof me.hasPassword === 'boolean' ? me.hasPassword : undefined,
  };
}

function logPortalAuditNonBlocking(entry) {
  try {
    const adminApi = resolveApiForMethod(
      adminApiModule,
      'adminApi',
      'recordPortalAuditEntry',
    );
    if (typeof adminApi?.recordPortalAuditEntry === 'function') {
      adminApi.recordPortalAuditEntry(entry);
    } else if (typeof adminApiModule.recordPortalAuditEntry === 'function') {
      adminApiModule.recordPortalAuditEntry(entry);
    }
  } catch {
    // Non-blocking telemetry
  }
}

export const evaluateMentorStatus = createAsyncThunk(
  'session/evaluateMentorStatus',
  async (_arg, { dispatch, getState }) => {
    const user = getState()?.session?.user;
    if (!user?.id || user?.profileComplete === false) {
      dispatch(setMentorStatus({ isApproved: false, status: null }));
      return { isApproved: false, status: null };
    }

    const isExplicit = Boolean(
      user?.mentorUnlocked ||
        user?.profile?.mentorUnlocked ||
        String(user?.role || '').toLowerCase() === 'mentor',
    );

    if (isExplicit) {
      dispatch(setMentorStatus({ isApproved: true, status: 'approved' }));
      return { isApproved: true, status: 'approved' };
    }

    try {
      const mentorAppsApi = resolveApiForMethod(
        mentorApplicationsApiModule,
        'mentorApplicationsApi',
        'getMyStatus',
      );
      let data = null;
      try {
        if (typeof mentorAppsApi?.getMyStatus === 'function') {
          data = await mentorAppsApi.getMyStatus({ userId: user.id });
        }
      } catch {
        // Silently handle 404 / unavailable
      }

      if (data && data.status !== undefined) {
        const status = String(data.status || '').toLowerCase();
        const approved = Boolean(data.mentorUnlocked || status === 'approved');
        dispatch(
          setMentorStatus({
            isApproved: approved,
            status: status || (approved ? 'approved' : null),
          }),
        );
        return { isApproved: approved, status };
      }

      const listApi = resolveApiForMethod(
        mentorApplicationsApiModule,
        'mentorApplicationsApi',
        'list',
      );
      let apps = [];
      try {
        if (typeof listApi?.list === 'function') {
          apps = await listApi.list({ userId: user.id });
        }
      } catch {
        // Ignore
      }

      const list = Array.isArray(apps) ? [...apps] : [];
      list.sort(
        (a, b) =>
          new Date(b.createdAt || b.applicationDate || 0).getTime() -
          new Date(a.createdAt || a.applicationDate || 0).getTime(),
      );
      const activeList = list.filter((a) => a.status !== 'superseded');
      const latestApp = activeList[0] || list[0];
      const everApproved = list.some((a) => a.status === 'approved');

      if (latestApp) {
        const status = String(latestApp.status || '').toLowerCase();
        const approved = everApproved || status === 'approved';
        dispatch(setMentorStatus({ isApproved: approved, status }));
        return { isApproved: approved, status };
      }

      dispatch(
        setMentorStatus({
          isApproved: everApproved,
          status: everApproved ? 'approved' : null,
        }),
      );
      return { isApproved: everApproved, status: everApproved ? 'approved' : null };
    } catch {
      dispatch(
        setMentorStatus({
          isApproved: isExplicit,
          status: isExplicit ? 'approved' : null,
        }),
      );
      return { isApproved: isExplicit, status: isExplicit ? 'approved' : null };
    }
  },
);

export const refreshSessionUser = createAsyncThunk(
  'session/refreshSessionUser',
  async (_arg, { dispatch, getState, rejectWithValue }) => {
    try {
      const mode = getAuthMode();
      if (mode === 'legacy') {
        const current = getState()?.session?.user;
        if (!current?.id) {
          dispatch(
            setSession({
              user: null,
              isAuthenticated: false,
              status: 'signed_out',
              loading: false,
            }),
          );
          return null;
        }
      }

      if (mode === 'firebase' && auth?.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          setAccessToken(token);
        } catch {
          // Ignore token retrieval warning
        }
      }

      const authApi = resolveApiForMethod(authApiModule, 'authApi', 'getMe');
      const me = await authApi.getMe();
      const mapped = mapMeToUser(me, mode === 'firebase' ? auth?.currentUser : null);
      if (mapped) {
        dispatch(
          setSession({
            user: mapped,
            isAuthenticated: true,
            status: 'authenticated',
            loading: false,
          }),
        );
      } else {
        dispatch(
          setSession({
            user: null,
            isAuthenticated: false,
            status: 'signed_out',
            loading: false,
          }),
        );
      }
      return mapped;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const bootstrapSession = createAsyncThunk(
  'session/bootstrapSession',
  async (_arg, { dispatch, getState }) => {
    const mode = getAuthMode();

    if (typeof BroadcastChannel !== 'undefined' && !authChannel) {
      authChannel = new BroadcastChannel('teamforge_auth');
      authChannel.onmessage = (event) => {
        if (event.data?.type === 'LOGOUT') {
          setAccessToken(null);
          tokenManager.clear();
          dispatch(sessionReset());
        }
      };
    }

    if (mode === 'legacy') {
      const existing = getState()?.session;
      const isAuthed = Boolean(existing?.user?.id);
      dispatch(
        setSession({
          user: existing?.user || null,
          isAuthenticated: isAuthed,
          status: isAuthed ? 'authenticated' : 'signed_out',
          loading: false,
        }),
      );
      return existing?.user || null;
    }

    dispatch(setSessionStatus({ status: 'loading', loading: true }));

    if (mode === 'firebase') {
      const bootInfo = await checkServerBoot();
      if (bootInfo?.bootId) dispatch(setBootId(bootInfo.bootId));
      if (bootInfo?.restarted) {
        dispatch(
          setSession({
            user: null,
            isAuthenticated: false,
            status: 'signed_out',
            loading: false,
          }),
        );
        return null;
      }

      if (authUnsubscribe) authUnsubscribe();
      authUnsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          try {
            const token = await fbUser.getIdToken();
            setAccessToken(token);
            const tokenResult = await fbUser.getIdTokenResult();
            const authApi = resolveApiForMethod(authApiModule, 'authApi', 'getMe');
            const me = await authApi.getMe().catch(() => null);
            const mapped = me
              ? mapMeToUser(me, fbUser, tokenResult)
              : mapMeToUser(null, fbUser, tokenResult);
            dispatch(
              setSession({
                user: mapped,
                accessToken: token,
                isAuthenticated: Boolean(mapped),
                status: mapped ? 'authenticated' : 'signed_out',
                loading: false,
              }),
            );
            if (mapped) {
              dispatch(evaluateMentorStatus());
            }
          } catch {
            dispatch(
              setSession({
                user: null,
                isAuthenticated: false,
                status: 'signed_out',
                loading: false,
              }),
            );
          }
        } else {
          setAccessToken(null);
          dispatch(
            setSession({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              status: 'signed_out',
              loading: false,
            }),
          );
        }
      });
      return null;
    }

    // JWT Mode
    try {
      const bootInfo = await checkServerBoot();
      if (bootInfo?.bootId) dispatch(setBootId(bootInfo.bootId));
      if (bootInfo?.restarted) {
        dispatch(
          setSession({
            user: null,
            isAuthenticated: false,
            status: 'signed_out',
            loading: false,
          }),
        );
        return null;
      }

      let accessToken = await tokenManager.refresh();
      if (!accessToken) {
        try {
          const authApi = resolveApiForMethod(authApiModule, 'authApi', 'refresh');
          const refreshRes = await authApi.refresh();
          accessToken = refreshRes?.accessToken || null;
        } catch {
          // Silent
        }
      }

      if (accessToken) {
        setAccessToken(accessToken);
        const authApi = resolveApiForMethod(authApiModule, 'authApi', 'getMe');
        const me = await authApi.getMe().catch(() => null);
        const mapped = me && (me.uid || me.id) ? mapMeToUser(me) : null;
        dispatch(
          setSession({
            user: mapped,
            accessToken: mapped ? accessToken : null,
            isAuthenticated: Boolean(mapped),
            status: mapped ? 'authenticated' : 'signed_out',
            loading: false,
          }),
        );
        if (mapped) {
          dispatch(evaluateMentorStatus());
        }
        return mapped;
      }

      dispatch(
        setSession({
          user: null,
          isAuthenticated: false,
          status: 'signed_out',
          loading: false,
        }),
      );
      return null;
    } catch {
      dispatch(
        setSession({
          user: null,
          isAuthenticated: false,
          status: 'signed_out',
          loading: false,
        }),
      );
      return null;
    }
  },
);

export const loginSessionUser = createAsyncThunk(
  'session/loginSessionUser',
  async (credentialsOrUser, { dispatch, rejectWithValue }) => {
    resetServerRestartGuard();
    dispatch(setSessionStatus({ status: 'loading', loading: true, error: null }));
    const mode = getAuthMode();

    try {
      if (mode === 'jwt') {
        const authApi = resolveApiForMethod(authApiModule, 'authApi', 'login');
        const res =
          credentialsOrUser && credentialsOrUser.accessToken
            ? credentialsOrUser
            : await authApi.login(credentialsOrUser);

        tokenManager.setTokens({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        });
        setAccessToken(res.accessToken);
        dispatch(setNotice({ key: 'serverRestart', message: '' }));
        dispatch(setNotice({ key: 'sessionEnded', message: '' }));

        let mapped = null;
        try {
          mapped = await dispatch(refreshSessionUser()).unwrap();
        } catch {
          // Fallback to login payload if /auth/me not mocked
        }

        if (!mapped && res?.user) {
          mapped = mapMeToUser({
            uid: res.user.id,
            id: res.user.id,
            email: res.user.email,
            name: res.user.name || res.user.username || '',
            username: res.user.username || '',
            role: res.user.role || 'Collaborator',
            claims: { role: res.user.role },
            profileComplete: res.user.profileComplete !== false,
            needsUsernameConfirmation: Boolean(
              res.user.usernameAutoGenerated || res.user.needsUsernameConfirmation,
            ),
            emailVerified: res.user.emailVerified !== false,
          });
        }

        dispatch(
          setSession({
            user: mapped,
            accessToken: res.accessToken || null,
            isAuthenticated: Boolean(mapped),
            status: mapped ? 'authenticated' : 'signed_out',
            loading: false,
          }),
        );
        if (mapped) {
          dispatch(evaluateMentorStatus());
        }
        return mapped;
      }

      if (mode === 'firebase') {
        if (credentialsOrUser?.identifier) {
          let signinEmail = String(credentialsOrUser.identifier || '').trim();
          if (!signinEmail.includes('@')) {
            const authApi = resolveApiForMethod(
              authApiModule,
              'authApi',
              'resolveIdentifier',
            );
            const resolved = await authApi.resolveIdentifier(signinEmail);
            if (!resolved?.email) {
              throw new Error(
                'Invalid credentials. Please check your username/email and password.',
              );
            }
            signinEmail = resolved.email;
          }
          await signInWithEmailAndPassword(
            auth,
            signinEmail,
            credentialsOrUser.password,
          );
          const mapped = await dispatch(refreshSessionUser()).unwrap().catch(() => null);
          return mapped;
        }
        dispatch(setNotice({ key: 'serverRestart', message: '' }));
        dispatch(setNotice({ key: 'sessionEnded', message: '' }));
        if (credentialsOrUser?.id) {
          dispatch(
            setSession({
              user: credentialsOrUser,
              isAuthenticated: true,
              status: 'authenticated',
              loading: false,
            }),
          );
          dispatch(evaluateMentorStatus());
        }
        return credentialsOrUser;
      }

      // Legacy fallback
      const authApi = resolveApiForMethod(authApiModule, 'authApi', 'login');
      const res =
        credentialsOrUser && (credentialsOrUser.id || credentialsOrUser.uid)
          ? { user: credentialsOrUser }
          : await authApi.login(credentialsOrUser);
      if (res?.accessToken) setAccessToken(res.accessToken);
      const matchedUser = res?.user;
      if (!matchedUser) {
        throw new Error('Invalid credentials. Please check your username/email and password.');
      }
      logPortalAuditNonBlocking({
        action: 'login',
        actor: matchedUser.name || matchedUser.username || matchedUser.email || 'User',
        target: 'User Login',
        event: `User "${matchedUser.name || matchedUser.username || matchedUser.email}" logged in`,
        details: { email: matchedUser.email, role: matchedUser.role },
      });
      dispatch(setNotice({ key: 'serverRestart', message: '' }));
      dispatch(setNotice({ key: 'sessionEnded', message: '' }));
      dispatch(
        setSession({
          user: matchedUser,
          accessToken: res?.accessToken || null,
          isAuthenticated: true,
          status: 'authenticated',
          loading: false,
          allowedRoles: computeAllowedRoles(matchedUser),
        }),
      );
      dispatch(evaluateMentorStatus());
      return matchedUser;
    } catch (err) {
      dispatch(setSessionStatus({ status: 'signed_out', loading: false }));
      if (err?.code === 'ACCOUNT_SUSPENDED' || err?.data?.code === 'ACCOUNT_SUSPENDED') {
        const info = err.data || {
          reason: err.reason,
          suspendedAt: err.suspendedAt,
          suspensionType: err.suspensionType,
          appealAvailable: err.appealAvailable,
          supportContact: err.supportContact,
        };
        dispatch(setSuspendedInfo(info));
      }
      return rejectWithValue({
        ...normalizeThunkError(err),
        code: err?.code || err?.data?.code || 'AUTH_ERROR',
      });
    }
  },
);

export const signInWithOAuthProvider = createAsyncThunk(
  'session/signInWithOAuthProvider',
  async (providerName, { dispatch, rejectWithValue }) => {
    try {
      const provider = providerName === 'github' ? githubProvider : googleProvider;
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      const token = await fbUser.getIdToken();
      setAccessToken(token);
      const authApi = resolveApiForMethod(authApiModule, 'authApi', 'getMe');
      const me = await authApi.getMe().catch(() => null);
      if (me) {
        await dispatch(loginSessionUser(me));
      }
      return {
        me,
        fallbackState: {
          name: fbUser.displayName || '',
          email: fbUser.email || '',
        },
      };
    } catch (err) {
      if (err?.code === 'ACCOUNT_SUSPENDED' || err?.data?.code === 'ACCOUNT_SUSPENDED') {
        const info = err.data || {
          reason: err.reason,
          suspendedAt: err.suspendedAt,
          suspensionType: err.suspensionType,
          appealAvailable: err.appealAvailable,
          supportContact: err.supportContact,
        };
        dispatch(setSuspendedInfo(info));
      }
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const signupSessionUser = createAsyncThunk(
  'session/signupSessionUser',
  async ({ email, password, role = ROLE_CANONICAL.COLLABORATOR }, { dispatch, rejectWithValue }) => {
    resetServerRestartGuard();
    dispatch(setSessionStatus({ status: 'loading', loading: true, error: null }));
    const mode = getAuthMode();
    const emailPrefix = String(email || '').split('@')[0]?.trim() || 'User';

    try {
      if (mode === 'jwt') {
        const authApi = resolveApiForMethod(authApiModule, 'authApi', 'signup');
        const res = await authApi.signup({ email, password, role });
        tokenManager.setTokens({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        });
        setAccessToken(res.accessToken);
        dispatch(setNotice({ key: 'serverRestart', message: '' }));
        dispatch(setNotice({ key: 'sessionEnded', message: '' }));

        let mapped = null;
        try {
          mapped = await dispatch(refreshSessionUser()).unwrap();
        } catch {
          // Fallback if /auth/me not mocked
        }

        if (!mapped) {
          mapped = mapMeToUser({
            uid: res.user?.id,
            id: res.user?.id,
            email: res.user?.email,
            name: res.user?.name || '',
            username: res.user?.username || '',
            role: res.user?.role || ROLE_CANONICAL.COLLABORATOR,
            profileComplete: res.user?.profileComplete !== false,
            needsUsernameConfirmation: false,
            emailVerified: res.user?.emailVerified !== false,
          });
        }

        dispatch(
          setSession({
            user: mapped,
            accessToken: res.accessToken || null,
            isAuthenticated: Boolean(mapped),
            status: mapped ? 'authenticated' : 'signed_out',
            loading: false,
          }),
        );
        return mapped;
      }

      if (mode === 'firebase') {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        try {
          if (auth?.currentUser) {
            await updateProfile(auth.currentUser, { displayName: emailPrefix });
          }
          logPortalAuditNonBlocking({
            action: 'signup',
            actor: emailPrefix,
            target: 'Account Registration',
            event: `New user "${email}" signed up (${email})`,
            details: { role },
          });
          dispatch(setSessionStatus({ status: 'authenticated', loading: false }));
          return {
            email,
            name: emailPrefix,
            profileComplete: false,
          };
        } catch (profileErr) {
          if (userCred?.user) {
            await userCred.user.delete().catch(() => {});
          }
          throw profileErr;
        }
      }

      // Legacy fallback
      const authApi = resolveApiForMethod(authApiModule, 'authApi', 'signup');
      const signupRes = await authApi.signup({ email, password, role });
      if (signupRes?.accessToken) setAccessToken(signupRes.accessToken);
      const createdUser = signupRes?.user || signupRes;
      logPortalAuditNonBlocking({
        action: 'signup',
        actor: createdUser?.name || emailPrefix,
        target: 'Account Registration',
        event: `New user "${createdUser?.name || email}" signed up (${email})`,
        details: { role },
      });
      dispatch(
        setSession({
          user: createdUser,
          accessToken: signupRes?.accessToken || null,
          isAuthenticated: Boolean(createdUser),
          status: 'authenticated',
          loading: false,
        }),
      );
      return createdUser;
    } catch (err) {
      dispatch(setSessionStatus({ status: 'signed_out', loading: false }));
      return rejectWithValue({
        ...normalizeThunkError(err),
        code: err?.code || err?.data?.code || 'SIGNUP_ERROR',
      });
    }
  },
);

export const requestPasswordReset = createAsyncThunk(
  'session/requestPasswordReset',
  async (identifier, { rejectWithValue }) => {
    const mode = getAuthMode();
    const trimmed = String(identifier || '').trim();
    try {
      if (mode === 'firebase') {
        let targetEmail = trimmed;
        if (!targetEmail.includes('@')) {
          try {
            const authApi = resolveApiForMethod(
              authApiModule,
              'authApi',
              'resolveIdentifier',
            );
            const res = await authApi.resolveIdentifier(targetEmail);
            if (res?.email) targetEmail = res.email;
          } catch {
            // Silent anti-enumeration
          }
        }
        try {
          if (targetEmail.includes('@')) {
            await sendPasswordResetEmail(auth, targetEmail, {
              url: `${window.location.origin}/login`,
              handleCodeInApp: false,
            });
          }
        } catch {
          // Silent anti-enumeration
        }
        return { mode: 'firebase' };
      }

      const authApi = resolveApiForMethod(authApiModule, 'authApi', 'forgotPassword');
      return await authApi.forgotPassword(trimmed);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const verifyFirebaseResetCode = createAsyncThunk(
  'session/verifyFirebaseResetCode',
  async (oobCode, { rejectWithValue }) => {
    try {
      return await verifyPasswordResetCode(auth, oobCode);
    } catch (err) {
      return rejectWithValue({
        ...normalizeThunkError(err),
        code: err?.code || 'RESET_CODE_INVALID',
      });
    }
  },
);

export const completePasswordReset = createAsyncThunk(
  'session/completePasswordReset',
  async ({ token, oobCode, newPassword }, { rejectWithValue }) => {
    try {
      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, newPassword);
        return { message: 'Password has been successfully reset! Redirecting to login...' };
      }
      const authApi = resolveApiForMethod(authApiModule, 'authApi', 'resetPassword');
      return await authApi.resetPassword(token, newPassword);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const completeUserProfile = createAsyncThunk(
  'session/completeUserProfile',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const authApi = resolveApiForMethod(authApiModule, 'authApi', 'createProfile');
      const res = await authApi.createProfile(payload);
      try {
        await dispatch(refreshSessionUser()).unwrap();
      } catch {
        dispatch(
          userUpdated({
            ...(res || {}),
            name: payload.name,
            username: payload.username,
            profileComplete: true,
            needsUsernameConfirmation: false,
          }),
        );
      }
      return res;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const switchUserRole = createAsyncThunk(
  'session/switchUserRole',
  async (targetRole, { dispatch, getState }) => {
    const canonical = canonicalRole(targetRole);
    const allowed = getState()?.session?.allowedRoles || [];
    if (allowed.length > 0 && !allowed.includes(canonical)) {
      return null;
    }
    dispatch(setActiveRole(canonical));
    try {
      const authApi = resolveApiForMethod(authApiModule, 'authApi', 'switchRole');
      if (typeof authApi?.switchRole === 'function') {
        authApi.switchRole(canonical).catch(() => {});
      }
    } catch {
      // Non-blocking
    }
    return getHomePathForRole(canonical);
  },
);

export const logoutSessionUser = createAsyncThunk(
  'session/logoutSessionUser',
  async ({ reason = 'user_initiated', message = null } = {}, { dispatch, getState }) => {
    const mode = getAuthMode();
    const user = getState()?.session?.user;
    const refreshToken = tokenManager.getRefreshToken();

    dispatch(setSessionStatus({ status: 'signing_out', loading: false }));
    tokenManager.clear();

    if (user) {
      logPortalAuditNonBlocking({
        action: 'logout',
        actor: user.name || user.username || 'User',
        target: 'User Logout',
        event: `User "${user.name || user.username || 'User'}" logged out`,
      });
    }

    if (mode === 'firebase') {
      await fbSignOut(auth).catch(() => {});
    } else if (mode === 'jwt') {
      try {
        const authApi = resolveApiForMethod(authApiModule, 'authApi', 'logout');
        await authApi.logout(refreshToken);
      } catch {
        // Proceed with client session reset
      }
      setAccessToken(null);
    }

    if (authChannel) {
      try {
        authChannel.postMessage({ type: 'LOGOUT' });
      } catch {
        // Ignore broadcast errors
      }
    }

    const sessionEndedMsg = message
      ? String(message)
      : reason === 'session_expired' || reason === 'session_ended'
        ? 'Your session ended. Please log in again.'
        : '';

    dispatch(
      sessionReset({
        notices: {
          ...(sessionEndedMsg ? { sessionEnded: sessionEndedMsg } : {}),
        },
      }),
    );
    return { loggedOut: true };
  },
);

export const loginAdminPortal = createAsyncThunk(
  'session/loginAdminPortal',
  async ({ email, password }, { dispatch, rejectWithValue }) => {
    const cleanEmail = String(email || '').trim();
    const mode = getAuthMode();
    try {
      if (mode === 'firebase') {
        try {
          const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
          const tokenResult = await userCred.user.getIdTokenResult(true);
          const role = (
            tokenResult.claims.role ||
            tokenResult.claims.portalRole ||
            ''
          ).toLowerCase();
          if (!['admin', 'superuser', 'portal_admin'].includes(role)) {
            await fbSignOut(auth);
            throw new Error('This account does not have administrator portal privileges.');
          }
          let backendLoginRes = null;
          try {
            const adminApi = resolveApiForMethod(adminApiModule, 'adminApi', 'login');
            if (adminApi && typeof adminApi.login === 'function') {
              backendLoginRes = await adminApi.login({ email: cleanEmail, password });
            }
          } catch {
            // Allow pure-Firebase admin claims if backend credential store differs
          }
          const payload = {
            uid:
              backendLoginRes?.admin?.id ||
              backendLoginRes?.uid ||
              backendLoginRes?.id ||
              userCred.user.uid,
            token: backendLoginRes?.token || tokenResult.token,
            portalRole: role === 'superuser' ? 'superuser' : 'admin',
            email: backendLoginRes?.email || userCred.user.email,
            permissions:
              backendLoginRes?.permissions ||
              tokenResult.claims.permissions || ['*'],
            name: backendLoginRes?.name || userCred.user.displayName || 'Admin',
          };
          dispatch(setAdminSession(payload));
          setAccessToken(payload.token);
          return payload;
        } catch (fbErr) {
          if (fbErr?.message?.includes('portal privileges')) {
            throw fbErr;
          }
        }
      }

      const adminApi = resolveApiForMethod(adminApiModule, 'adminApi', 'login');
      const response = await adminApi.login({ email: cleanEmail, password });
      const adminObj = response.admin || response;
      const backendPayload = {
        uid: adminObj.id || adminObj.uid || response.uid || response.id || '',
        token: response.token || 'mock_admin_token',
        portalRole: adminObj.role || response.role || 'admin',
        email: adminObj.email || response.email || cleanEmail,
        permissions: adminObj.permissions || response.permissions || [],
        name: adminObj.name || response.name || 'Admin',
      };
      dispatch(setAdminSession(backendPayload));
      setAccessToken(response.token || null);
      return backendPayload;
    } catch (err) {
      if (err?.code === 'ACCOUNT_SUSPENDED' || err?.data?.code === 'ACCOUNT_SUSPENDED') {
        const info = err.data || {
          reason: err.reason,
          suspendedAt: err.suspendedAt,
          suspensionType: err.suspensionType,
          appealAvailable: err.appealAvailable,
          supportContact: err.supportContact,
        };
        dispatch(setSuspendedInfo(info));
      }
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const restoreAdminSession = createAsyncThunk(
  'session/restoreAdminSession',
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(setAdminBootstrapStatus('loading'));
    const mode = getAuthMode();
    if (mode === 'legacy') {
      dispatch(setAdminBootstrapStatus('done'));
      return { authenticated: false, mode };
    }
    try {
      const response = await runSingleFlightAdminRefresh(async () => {
        const adminApi = resolveApiForMethod(adminApiModule, 'adminApi', 'refresh');
        if (!adminApi || typeof adminApi.refresh !== 'function') {
          return null;
        }
        return adminApi.refresh();
      });

      if (!response || !response.token) {
        dispatch(clearAdminSession());
        dispatch(setAdminBootstrapStatus('done'));
        return { authenticated: false };
      }

      const adminObj = response.admin || response;
      const backendPayload = {
        uid: adminObj.id || adminObj.uid || response.uid || response.id || '',
        token: response.token,
        portalRole: adminObj.role || response.role || 'admin',
        email: adminObj.email || response.email || '',
        permissions: adminObj.permissions || response.permissions || [],
        name: adminObj.name || response.name || 'Admin',
      };
      dispatch(setAdminSession(backendPayload));
      setAccessToken(response.token);
      dispatch(setAdminBootstrapStatus('done'));
      return { authenticated: true, admin: backendPayload };
    } catch (err) {
      dispatch(clearAdminSession());
      setAccessToken(null);
      if (err?.code === 'ACCOUNT_SUSPENDED' || err?.data?.code === 'ACCOUNT_SUSPENDED') {
        const info = err.data || {
          reason: err.reason,
          suspendedAt: err.suspendedAt,
          suspensionType: err.suspensionType,
          appealAvailable: err.appealAvailable,
          supportContact: err.supportContact,
        };
        dispatch(setSuspendedInfo(info));
        dispatch(setAdminBootstrapStatus('done'));
        return rejectWithValue(normalizeThunkError(err));
      }
      dispatch(setAdminBootstrapStatus('done'));
      return { authenticated: false };
    }
  },
);

export const logoutAdminPortal = createAsyncThunk(
  'session/logoutAdminPortal',
  async (notices = {}, { dispatch }) => {
    try {
      if (getAuthMode() !== 'legacy') {
        const adminApi = resolveApiForMethod(adminApiModule, 'adminApi', 'logout');
        if (adminApi && typeof adminApi.logout === 'function') {
          await adminApi.logout().catch(() => {});
        }
      }
    } catch {
      // Ignore network errors while clearing session
    }
    setAccessToken(null);
    tokenManager.clear();
    if (getAuthMode() === 'firebase') {
      await fbSignOut(auth).catch(() => {});
    }
    dispatch(sessionReset({ notices }));
    dispatch(setAdminBootstrapStatus('done'));
    return { loggedOut: true };
  },
);

export const clearTransportSession = () => {
  setAccessToken(null);
  tokenManager.clear();
};
