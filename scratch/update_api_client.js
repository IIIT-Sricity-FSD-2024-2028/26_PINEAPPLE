const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/services/apiClient.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. normalizeRole
const oldNorm = `function normalizeRole(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (["project-owner", "owner", "projectowner"].includes(normalized)) {
    return "project-owner";
  }
  if (
    [
      "admin",
      "administrator",
      "portal-admin",
      "portaladmin",
      "super-admin",
      "finance-admin",
    ].includes(normalized)
  ) {
    return "admin";
  }
  if (["superuser", "super-user"].includes(normalized)) {
    return "superuser";
  }
  if (["mentor"].includes(normalized)) {
    return "mentor";
  }
  if (["collaborator", "collab", "member"].includes(normalized)) {
    return "collaborator";
  }
  if (["user"].includes(normalized)) {
    return "user";
  }
  return normalized;
}`;

const newNorm = `function normalizeRole(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (["project-owner", "owner", "projectowner"].includes(normalized)) {
    return "project-owner";
  }
  if (
    [
      "superuser",
      "super-user",
      "super_user",
      "superadmin",
      "super-admin",
      "super_admin",
    ].includes(normalized)
  ) {
    return "superuser";
  }
  if (
    [
      "admin",
      "administrator",
      "portal-admin",
      "portaladmin",
      "finance-admin",
    ].includes(normalized)
  ) {
    return "admin";
  }
  if (["mentor"].includes(normalized)) {
    return "mentor";
  }
  if (["collaborator", "collab", "member"].includes(normalized)) {
    return "collaborator";
  }
  if (["user"].includes(normalized)) {
    return "user";
  }
  return normalized;
}`;

content = content.replace(oldNorm, newNorm);

// 2. getFreshToken and apiRequest
const oldGetFreshTokenRegex = /async function getFreshToken\(forceRefresh = false\) \{[\s\S]*?return inMemoryAccessToken;\s*\}/;

const newGetFreshToken = `async function getFreshToken(forceRefresh = false, isPortal = false) {
  const mode = getAuthMode();
  if (mode === 'legacy') return null;

  const hasAdminSession =
    typeof sessionStorage !== 'undefined' &&
    (sessionStorage.getItem('teamforge.adminToken') || sessionStorage.getItem('adminToken'));
  const adminToken =
    hasAdminSession
      ? sessionStorage.getItem('teamforge.adminToken') || sessionStorage.getItem('adminToken')
      : null;
  const isCleanAdminToken = adminToken && adminToken !== 'mock_admin_token';

  const isAdminLocation =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  // If in admin portal or performing portal operation, prioritize the portal admin token
  if ((isPortal || isAdminLocation) && isCleanAdminToken) {
    return adminToken;
  }

  if (mode === 'firebase') {
    try {
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken(forceRefresh);
      }
    } catch (e) {
      console.warn('[apiClient] Firebase getIdToken failed:', e?.message);
    }
    if (isCleanAdminToken) {
      return adminToken;
    }
    return null;
  }

  // JWT mode: if forced refresh or no token in memory, attempt silent refresh via httpOnly cookie
  if (!isAdminLocation && (forceRefresh || !inMemoryAccessToken)) {
    try {
      const res = await fetch(\`\${API_BASE_URL}/auth/refresh\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        inMemoryAccessToken = data.accessToken || null;
        return inMemoryAccessToken;
      }
    } catch {
      // silent refresh error
    }
  }

  // Fallback to portal admin token if available
  if (isCleanAdminToken) {
    return adminToken;
  }

  return inMemoryAccessToken;
}`;

content = content.replace(oldGetFreshTokenRegex, newGetFreshToken);

// Update apiRequest token calls:
content = content.replace(
  `  // Attach fresh token in JWT or Firebase mode
  const mode = getAuthMode();
  if (mode !== 'legacy') {
    const token = await getFreshToken(false);`,
  `  const isPortal =
    (typeof window !== "undefined" && window.location.pathname.startsWith('/admin')) ||
    path.startsWith('/admin') ||
    path.startsWith('/portal-admins') ||
    (options.role && ['admin', 'superuser'].includes(normalizeRole(options.role)));

  // Attach fresh token in JWT or Firebase mode
  const mode = getAuthMode();
  if (mode !== 'legacy') {
    const token = await getFreshToken(false, isPortal);`
);

content = content.replace(
  `      const freshToken = await getFreshToken(true);`,
  `      const freshToken = await getFreshToken(true, isPortal);`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated apiClient.js');
