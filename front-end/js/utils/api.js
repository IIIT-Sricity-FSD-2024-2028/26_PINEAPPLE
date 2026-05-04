/**
 * api.js — Standardized API client for the NestJS Backend.
 * Make sure this file is included via <script> tag before your feature scripts.
 */

const API_BASE_URL = 'http://localhost:3000'; // Default NestJS port

/**
 * Resolves the current user's role from the frontend state.
 */
function getCurrentUserRole() {
  // 1. Check for Super User override in session storage
  const isSuperUser = sessionStorage.getItem('teamforge.isSuperUser') === 'true';
  if (isSuperUser) {
    return 'Super User';
  }

  // 2. Fallback to the global STATE object defined in state.js
  if (typeof STATE !== 'undefined') {
    return STATE.portalRole || STATE.role || 'Collaborator';
  }

  return 'Collaborator'; // Safe fallback
}

/**
 * Standardized fetch wrapper that automatically injects the RBAC header.
 * 
 * @param {string} endpoint - The API endpoint (e.g., '/users/profile')
 * @param {RequestInit} options - Fetch options (method, body, etc.)
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = options.method || 'GET';
  
  // Set up headers with JSON default
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Dynamically inject the role header for the NestJS RolesGuard
  const role = getCurrentUserRole();
  if (role) {
    headers['x-user-role'] = role;
  }

  // ==========================================
  // BROWSER TERMINAL LOGGING: REQUEST
  // ==========================================
  console.groupCollapsed(`🚀 [API Request] ${method} ${endpoint}`);
  console.log('URL:', url);
  console.log('Headers:', headers);
  if (options.body) {
    console.log('Payload:', JSON.parse(options.body));
  }
  console.groupEnd();

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await response.json();
    }

    if (!response.ok) {
      const errorMessage = data?.message || `API Error: ${response.statusText}`;
      
      // ==========================================
      // BROWSER TERMINAL LOGGING: ERROR
      // ==========================================
      console.group(`❌ [API Error] ${method} ${endpoint} - Status ${response.status}`);
      console.error('Message:', errorMessage);
      console.error('Raw Response Data:', data);
      console.groupEnd();
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    // ==========================================
    // BROWSER TERMINAL LOGGING: SUCCESS
    // ==========================================
    console.groupCollapsed(`✅ [API Success] ${method} ${endpoint} - Status ${response.status}`);
    console.log('Response Data:', data);
    console.groupEnd();

    return data;
  } catch (error) {
    // We only log network-level failures here (like CORS or server dead), 
    // HTTP status errors are caught in the !response.ok block above.
    if (!error.status) {
      console.group(`🚨 [API Network Failure] ${method} ${endpoint}`);
      console.error('Network or CORS error. Is the server running?', error);
      console.groupEnd();
    }
    throw error;
  }
}
