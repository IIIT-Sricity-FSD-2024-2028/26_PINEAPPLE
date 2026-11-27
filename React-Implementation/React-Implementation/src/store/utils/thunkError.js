const FORWARDED_ERROR_KEYS = [
  'details',
  'blockers',
  'taskBlockers',
  'obligations',
  'remainingSeconds',
  'locked',
  'rejectedFields',
  'conflictingRange',
  'conflictStart',
  'conflictEnd',
  'retryAt',
  'retryAfter',
  'retryAfterSeconds',
  'cooldownSeconds',
  'wrongAttempts',
  'attemptsRemaining',
  'currentCount',
  'maxAllowed',
  'projects',
  'project',
  'reason',
  'suspendedAt',
  'suspensionType',
  'appealAvailable',
  'supportContact',
  'minProjectDueDate',
  'currentProjectDueDate',
  'newDueDate',
  'reviewCreditMs',
];

function formatHttpStatusError(statusCode) {
  switch (statusCode) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 422:
      return 'Unprocessable Entity';
    case 429:
      return 'Too Many Requests';
    case 503:
      return 'Service Unavailable';
    default:
      return statusCode >= 500 ? 'Internal Server Error' : 'Error';
  }
}

/**
 * Normalizes errors thrown by apiClient / *Api.js into a plain serializable
 * shape matching back-end HttpExceptionFilter responses:
 * { statusCode, error, code, message, field?, ...forwardedMetadata }
 */
export function normalizeThunkError(err) {
  const payload =
    (err && typeof err === 'object' && (err.data || err.response?.data)) || {};
  const statusCode =
    err?.statusCode ?? err?.status ?? payload?.statusCode ?? 0;

  const rawMsg =
    err?.serverMessage ||
    payload?.message ||
    err?.message ||
    'Request failed.';
  const message = Array.isArray(rawMsg)
    ? rawMsg.join(', ')
    : String(rawMsg);

  const normalized = {
    statusCode,
    error: payload?.error || formatHttpStatusError(statusCode),
    code:
      err?.code ??
      payload?.code ??
      (err?.isNetworkError ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'),
    message,
    field: err?.field ?? payload?.field ?? null,
  };

  for (const key of FORWARDED_ERROR_KEYS) {
    const val = err?.[key] !== undefined ? err[key] : payload?.[key];
    if (val !== undefined) {
      normalized[key] = val;
    }
  }

  return normalized;
}
