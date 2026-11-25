import { calculateReviewCredit, formatDurationWords } from './review-credit.util';

describe('calculateReviewCredit Unit Tests', () => {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  it('formats duration into words correctly', () => {
    expect(formatDurationWords(3 * ONE_DAY + 4 * ONE_HOUR)).toBe('3 days 4 hours');
    expect(formatDurationWords(1 * ONE_DAY)).toBe('1 day');
    expect(formatDurationWords(2 * ONE_HOUR)).toBe('2 hours');
    expect(formatDurationWords(45 * 60 * 1000)).toBe('45 minutes');
    expect(formatDurationWords(0)).toBe('0 minutes');
  });

  it('adds exact review duration to due date for standard review (4 days)', () => {
    const submittedAt = '2026-11-01T10:00:00.000Z';
    const rejectedAt = '2026-11-05T10:00:00.000Z'; // exactly 4 days
    const dueDate = '2026-11-10T12:00:00.000Z';

    const result = calculateReviewCredit({
      submittedAt,
      rejectedAt,
      dueDate,
      projectDueDate: '2026-11-30T00:00:00.000Z',
    });

    expect(result.creditMs).toBe(4 * ONE_DAY);
    expect(result.creditMinutes).toBe(4 * 24 * 60);
    expect(result.formattedDuration).toBe('4 days');
    expect(result.newDueDate).toBe('2026-11-14T12:00:00.000Z');
    expect(result.requiresProjectExtension).toBe(false);
    expect(result.minProjectDueDate).toBeNull();
  });

  it('skips credit when review duration is less than minimum minutes (e.g. 30 mins < 60 mins)', () => {
    const submittedAt = '2026-11-01T10:00:00.000Z';
    const rejectedAt = '2026-11-01T10:30:00.000Z'; // 30 minutes
    const dueDate = '2026-11-10T12:00:00.000Z';

    const result = calculateReviewCredit({
      submittedAt,
      rejectedAt,
      dueDate,
      minMinutes: 60,
    });

    expect(result.creditMs).toBe(0);
    expect(result.newDueDate).toBe('2026-11-10T12:00:00.000Z');
    expect(result.skippedReason).toBe('BELOW_MIN_DURATION');
  });

  it('caps review credit to per-event limit (14 days cap for 20 days review)', () => {
    const submittedAt = '2026-11-01T10:00:00.000Z';
    const rejectedAt = '2026-11-21T10:00:00.000Z'; // 20 days
    const dueDate = '2026-11-25T12:00:00.000Z';

    const result = calculateReviewCredit({
      submittedAt,
      rejectedAt,
      dueDate,
      perEventCapDays: 14,
      perTaskCapDays: 30,
      creditedSoFarMs: 0,
    });

    expect(result.creditMs).toBe(14 * ONE_DAY);
    expect(result.newDueDate).toBe('2026-12-09T12:00:00.000Z');
  });

  it('caps review credit to cumulative per-task limit (30 days total)', () => {
    const submittedAt = '2026-11-01T10:00:00.000Z';
    const rejectedAt = '2026-11-06T10:00:00.000Z'; // 5 days
    const dueDate = '2026-11-25T12:00:00.000Z';

    // Already received 28 days of credit previously
    const creditedSoFarMs = 28 * ONE_DAY;

    const result = calculateReviewCredit({
      submittedAt,
      rejectedAt,
      dueDate,
      perEventCapDays: 14,
      perTaskCapDays: 30,
      creditedSoFarMs,
    });

    // Only 2 days remaining of the 30-day cap
    expect(result.creditMs).toBe(2 * ONE_DAY);
    expect(result.newDueDate).toBe('2026-11-27T12:00:00.000Z');
  });

  it('detects when newDueDate exceeds projectDueDate and requires project extension', () => {
    const submittedAt = '2026-11-01T00:00:00.000Z';
    const rejectedAt = '2026-11-06T00:00:00.000Z'; // 5 days
    const dueDate = '2026-11-28T00:00:00.000Z';
    const projectDueDate = '2026-11-30T00:00:00.000Z';

    // 5 days added to Nov 28 -> Dec 03, which is > Nov 30
    const result = calculateReviewCredit({
      submittedAt,
      rejectedAt,
      dueDate,
      projectDueDate,
    });

    expect(result.creditMs).toBe(5 * ONE_DAY);
    expect(result.newDueDate).toBe('2026-12-03T00:00:00.000Z');
    expect(result.requiresProjectExtension).toBe(true);
    expect(result.minProjectDueDate).toBe('2026-12-03T00:00:00.000Z');
  });

  it('respects ONLY_IF_OVERDUE mode', () => {
    const submittedAt = '2026-11-01T00:00:00.000Z';
    const rejectedAt = '2026-11-03T00:00:00.000Z';
    const dueDate = '2026-11-10T00:00:00.000Z'; // not overdue on Nov 03

    const result = calculateReviewCredit({
      submittedAt,
      rejectedAt,
      dueDate,
      mode: 'ONLY_IF_OVERDUE',
    });

    expect(result.creditMs).toBe(0);
    expect(result.skippedReason).toBe('NOT_OVERDUE');
  });

  it('safely handles missing or corrupted timestamps', () => {
    expect(calculateReviewCredit({ dueDate: null }).creditMs).toBe(0);
    expect(calculateReviewCredit({ dueDate: 'invalid-date' }).creditMs).toBe(0);
    expect(
      calculateReviewCredit({
        submittedAt: '2026-11-05T00:00:00.000Z',
        rejectedAt: '2026-11-01T00:00:00.000Z', // submission after rejection
        dueDate: '2026-11-10T00:00:00.000Z',
      }).skippedReason,
    ).toBe('SUBMISSION_NOT_BEFORE_REJECTION');
  });
});
