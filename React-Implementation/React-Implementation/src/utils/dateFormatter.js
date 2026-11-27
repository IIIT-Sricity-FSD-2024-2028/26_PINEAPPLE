/**
 * Universal date formatter for "Member since" and user join dates.
 * Standard format: "26 Oct 2026".
 * Returns "Unknown" if missing or invalid.
 * NEVER falls back to current date.
 */
export function formatMemberSince(rawDate) {
  if (!rawDate) return 'Unknown';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    // If it's already a non-empty human-readable string without a valid timestamp, check if it has valid words
    if (typeof rawDate === 'string' && rawDate.trim() && rawDate !== 'Unknown Date' && rawDate !== 'N/A') {
      return rawDate.trim();
    }
    return 'Unknown';
  }
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Extracts viewer's local time zone abbreviation (e.g. "IST", "EST", "PST", "UTC").
 */
export function getTimeZoneAbbr(d = new Date()) {
  try {
    const timeString = d.toTimeString();
    const match = timeString.match(/\(([^)]+)\)$/);
    if (match && match[1]) {
      const words = match[1].split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        return words.map((w) => w[0].toUpperCase()).join('');
      }
      return match[1];
    }
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Formats date and time in viewer's local time zone with abbreviation.
 * Example: "12 Nov, 6:30 PM IST"
 */
export function formatDateTime(rawDate) {
  if (!rawDate) return 'N/A';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    return typeof rawDate === 'string' && rawDate.trim() ? rawDate.trim() : 'N/A';
  }

  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];

  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? '0' + minutes : minutes;
  const timeStr = `${hours}:${minStr} ${ampm}`;

  const tzAbbr = getTimeZoneAbbr(d);
  return tzAbbr ? `${day} ${month}, ${timeStr} ${tzAbbr}` : `${day} ${month}, ${timeStr}`;
}

/**
 * Formats countdown relative to target date.
 * Returns e.g. "2d 5h remaining" or "Overdue".
 */
export function formatCountdown(rawDate, now = new Date()) {
  if (!rawDate) return '';
  const target = new Date(rawDate).getTime();
  if (isNaN(target)) return '';
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const diffMs = target - current;
  if (diffMs <= 0) {
    return 'Overdue';
  }
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

/**
 * Formats a project due date with countdown in days.
 * Example: "Due 29 Nov 2026 (16 days left)"
 */
export function formatProjectDueDate(rawDate, now = new Date()) {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    return typeof rawDate === 'string' && rawDate.trim() ? rawDate.trim() : '';
  }
  const dateStr = formatMemberSince(d);
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const diffMs = d.getTime() - current;
  if (diffMs <= 0) {
    return `Due ${dateStr} (overdue)`;
  }
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return `Due ${dateStr} (${days} ${days === 1 ? 'day' : 'days'} left)`;
}

/**
 * Formats a date input as a concise relative time string ("Just now", "5m ago", "2d ago").
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 60) {
    return 'Just now';
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}
