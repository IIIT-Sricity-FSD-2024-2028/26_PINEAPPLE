import { Injectable } from '@nestjs/common';

@Injectable()
export class ClockService {
  private offsetMs = 0;
  private fixedDate: Date | null = null;

  /**
   * Returns current effective Date (real or mocked)
   */
  now(): Date {
    if (this.fixedDate) {
      return new Date(this.fixedDate.getTime());
    }
    return new Date(Date.now() + this.offsetMs);
  }

  /**
   * Returns current effective time in ISO format
   */
  nowIso(): string {
    return this.now().toISOString();
  }

  /**
   * Pin the clock to a specific timestamp
   */
  setTime(time: Date | string | number): void {
    this.fixedDate = new Date(time);
    this.offsetMs = 0;
  }

  /**
   * Advance the clock by a number of milliseconds
   */
  advanceTime(ms: number): void {
    if (this.fixedDate) {
      this.fixedDate = new Date(this.fixedDate.getTime() + ms);
    } else {
      this.offsetMs += ms;
    }
  }

  /**
   * Advance the clock by hours
   */
  advanceHours(hours: number): void {
    this.advanceTime(hours * 3600 * 1000);
  }

  /**
   * Advance the clock by days
   */
  advanceDays(days: number): void {
    this.advanceTime(days * 24 * 3600 * 1000);
  }

  /**
   * Reset clock to real wall-clock time
   */
  reset(): void {
    this.fixedDate = null;
    this.offsetMs = 0;
  }
}
