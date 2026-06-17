/**
 * Cron Service interface.
 * Defines the contract for scheduling and executing automated quote/dividend updates.
 *
 * Implements:
 * - Max 2x/day execution with minimum 8h interval (Req 11.1)
 * - Local cache valid until next cron execution (Req 11.2)
 * - Execution logging with success/failure counts (Req 4.5)
 */

export interface CronExecutionResult {
  /** Number of FIIs successfully updated */
  successCount: number;
  /** Number of FIIs that failed to update */
  failureCount: number;
  /** Array of error details for failed FIIs */
  errors: Array<{ ticker: string; error: string }>;
  /** Total execution duration in milliseconds */
  duration: number;
}

export interface CronExecutionLog {
  id: string;
  executionDate: Date;
  successCount: number;
  failureCount: number;
  errors: Array<{ ticker: string; error: string }> | null;
  duration: number;
}

export interface ICronService {
  /**
   * Schedule automatic quote and dividend updates.
   * Enforces minimum 8h interval between executions and max 2x/day.
   *
   * @param schedule - Cron expression (e.g., "0 8,16 * * *" for 8am and 4pm)
   */
  scheduleQuoteUpdate(schedule: string): void;

  /**
   * Manually execute a quote and dividend update for all user FIIs.
   * Enforces minimum 8h interval since last execution.
   * For each FII: fetches quote + dividend, persists if successful, logs if failed.
   *
   * @returns Execution result with success/failure counts and duration
   */
  executeQuoteUpdate(): Promise<CronExecutionResult>;

  /**
   * Get the last cron execution log entry.
   *
   * @returns The most recent execution log, or null if never executed
   */
  getLastExecution(): Promise<CronExecutionLog | null>;
}
