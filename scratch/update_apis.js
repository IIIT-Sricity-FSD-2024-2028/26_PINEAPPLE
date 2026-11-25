const fs = require('fs');
const path = require('path');

// 1. Update apiClient.js
const apiClientPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/services/apiClient.js');
let apiClientContent = fs.readFileSync(apiClientPath, 'utf8');

if (!apiClientContent.includes('export async function apiDownload(')) {
  const downloadFunc = `
export async function apiDownload(path, options = {}) {
  const url = \`\${API_BASE_URL}\${path.startsWith('/') ? path : \`/\${path}\`}\`;
  const headers = defaultHeaders(options.role, options.userId, options.userEmail);
  delete headers["Content-Type"];

  const mode = getAuthMode();
  if (mode !== 'legacy') {
    const token = await getFreshToken(false);
    if (token) {
      headers["Authorization"] = \`Bearer \${token}\`;
    }
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let msg = \`HTTP \${response.status}: \${response.statusText}\`;
    try {
      const err = await response.json();
      if (err.message) msg = err.message;
    } catch {}
    throw new Error(msg);
  }

  return await response.blob();
}
`;

  // Insert before getCurrentUserRole
  apiClientContent = apiClientContent.replace('function getCurrentUserRole()', downloadFunc + '\nfunction getCurrentUserRole()');

  // Also add apiDownload to export list
  apiClientContent = apiClientContent.replace(
    '  apiRequest,\n  getCurrentUserRole,',
    '  apiRequest,\n  apiDownload,\n  getCurrentUserRole,'
  );

  fs.writeFileSync(apiClientPath, apiClientContent, 'utf8');
  console.log('Updated apiClient.js successfully');
} else {
  console.log('apiClient.js already contains apiDownload');
}

// 2. Update uploadsApi.js
const uploadsApiPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/services/uploadsApi.js');
let uploadsApiContent = fs.readFileSync(uploadsApiPath, 'utf8');

if (!uploadsApiContent.includes('uploadCv')) {
  uploadsApiContent = uploadsApiContent.replace(
    "import { apiRequest, getCurrentUserRole } from './apiClient.js';",
    "import { apiRequest, apiDownload, getCurrentUserRole } from './apiClient.js';"
  );

  const cvMethods = `  uploadCv: (file, role) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/uploads/cv', 'POST', formData, {
      role: role || getCurrentUserRole(),
    });
  },

  downloadCv: (filename, role) => {
    return apiDownload(\`/uploads/cv/\${filename}\`, {
      role: role || getCurrentUserRole(),
    });
  },

  deleteCv: (filename, role) => {
    return apiRequest(\`/uploads/cv/\${filename}\`, 'DELETE', null, {
      role: role || getCurrentUserRole(),
    });
  },
`;

  uploadsApiContent = uploadsApiContent.replace('export const uploadsApi = {', 'export const uploadsApi = {\n' + cvMethods);
  fs.writeFileSync(uploadsApiPath, uploadsApiContent, 'utf8');
  console.log('Updated uploadsApi.js successfully');
} else {
  console.log('uploadsApi.js already contains uploadCv');
}

// 3. Update mentorApplicationsApi.js
const mentorAppApiPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/services/mentorApplicationsApi.js');
let mentorAppApiContent = fs.readFileSync(mentorAppApiPath, 'utf8');

const updatedMentorAppApi = `import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const mentorApplicationsApi = {
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append("userId", params.userId);
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString();
    return apiRequest(
      \`/mentor-applications\${query ? \`?\${query}\` : ""}\`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
        userId: params?.userId,
      },
    );
  },
  get: (id, role) =>
    apiRequest(\`/mentor-applications/\${id}\`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/mentor-applications", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(\`/mentor-applications/\${id}\`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  approve: (id, role) =>
    apiRequest(\`/mentor-applications/\${id}/approve\`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  reject: (id, payload, role) => {
    const body = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
    const effectiveRole = typeof payload === 'string' ? payload : (role || getCurrentUserRole());
    return apiRequest(\`/mentor-applications/\${id}/reject\`, "PUT", body, {
      role: effectiveRole,
    });
  },
  deleteCv: (id, role) =>
    apiRequest(\`/mentor-applications/\${id}/cv\`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
  getDigiLockerStatus: (role) =>
    apiRequest("/mentor-applications/digilocker/status", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  pullDigiLockerDocuments: (applicantName, role) =>
    apiRequest("/mentor-applications/digilocker/pull-documents", "POST", { applicantName }, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(\`/mentor-applications/\${id}\`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default mentorApplicationsApi;
`;

fs.writeFileSync(mentorAppApiPath, updatedMentorAppApi, 'utf8');
console.log('Updated mentorApplicationsApi.js successfully');
