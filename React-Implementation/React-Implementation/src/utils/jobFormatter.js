import { formatDateTime as sharedFormatDateTime } from './dateFormatter';

export function formatDateTime(isoString) {
  if (!isoString) return 'None';
  return sharedFormatDateTime(isoString);
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return 'In Progress';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function getNextExpectedRun() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1);
  nextHour.setMinutes(0, 0, 0);

  const diffMs = nextHour.getTime() - now.getTime();
  const diffMins = Math.max(1, Math.round(diffMs / 60000));

  const timeStr = nextHour.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${timeStr} UTC (in ~${diffMins}m)`;
}
