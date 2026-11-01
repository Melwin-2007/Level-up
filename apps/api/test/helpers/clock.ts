import type { Clock } from '../../src/common/clock/clock.js';
export { SystemClock, type Clock } from '../../src/common/clock/clock.js';

export class FakeClock implements Clock {
  constructor(private currentTime: Date = new Date()) {}

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  setTime(time: Date): void {
    this.currentTime = time;
  }

  advanceMinutes(minutes: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + minutes * 60 * 1000);
  }

  advanceDays(days: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
