import { ClockService } from './clock.service';

describe('ClockService', () => {
  let clock: ClockService;

  beforeEach(() => {
    clock = new ClockService();
  });

  afterEach(() => {
    clock.reset();
  });

  it('should return current system time when not offset or fixed', () => {
    const before = Date.now();
    const now = clock.now().getTime();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('should pin time to fixed date when setTime is called', () => {
    const fixedIso = '2026-11-10T12:00:00.000Z';
    clock.setTime(fixedIso);

    expect(clock.nowIso()).toBe(fixedIso);
    expect(clock.now().toISOString()).toBe(fixedIso);
  });

  it('should advance hours correctly', () => {
    clock.setTime('2026-11-10T12:00:00.000Z');
    clock.advanceHours(3);

    expect(clock.nowIso()).toBe('2026-11-10T15:00:00.000Z');
  });

  it('should advance days correctly', () => {
    clock.setTime('2026-11-10T12:00:00.000Z');
    clock.advanceDays(7); // e.g. 7-day appeal window

    expect(clock.nowIso()).toBe('2026-11-17T12:00:00.000Z');
  });

  it('should reset back to real time', () => {
    clock.setTime('2020-01-01T00:00:00.000Z');
    expect(clock.now().getFullYear()).toBe(2020);

    clock.reset();
    expect(clock.now().getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});
