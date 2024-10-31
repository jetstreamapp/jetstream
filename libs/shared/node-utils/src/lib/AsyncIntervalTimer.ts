import { logger } from '@jetstream/api-config';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';

type TimerOptions = {
  name: string;
  /**
   * Option to change the interval
   */
  intervalMs: number;
  /**
   * Option to run the function immediately on initialization
   * @default false
   */
  runOnInit?: boolean;
};

export class AsyncIntervalTimer {
  private timerId: NodeJS.Timeout | null = null;
  private failureCount = 0;

  constructor(private callback: () => Promise<void>, private options: TimerOptions) {
    this.options.runOnInit = !!this.options.runOnInit;
    if (this.options.runOnInit) {
      this.runCallback(); // Run immediately if `runOnInit` is true
    }
    this.startTimer();
  }

  private async runCallback() {
    try {
      logger.info(`[AsyncIntervalTimer][INVOKING]: %s`, this.options.name);
      await this.callback();
      this.failureCount = 0; // Reset failure count on success
    } catch (error) {
      logger.error(getErrorMessageAndStackObj(error), `[AsyncIntervalTimer][FAILURE]: %s`, this.options.name);
      this.failureCount++;
      if (this.failureCount >= 3) {
        logger.error(`[AsyncIntervalTimer][FAILURE][FATAL]: %s`, this.options.name);
        this.cancelTimer();
      }
    }
  }

  private startTimer() {
    this.timerId = setInterval(() => this.runCallback(), this.options.intervalMs);
  }

  public cancelTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
