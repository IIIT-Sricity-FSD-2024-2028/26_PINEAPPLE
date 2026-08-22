import { Injectable, Logger, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

/**
 * LogManagerService — Central Logging Service
 *
 * Responsibilities:
 * 1. Buffers request log entries and error log entries in memory.
 * 2. Flushes buffers to disk every 30 seconds via @nestjs/schedule.
 * 3. Rotates log files daily (requests-YYYY-MM-DD.log, errors-YYYY-MM-DD.log).
 * 4. Flushes remaining entries on application shutdown.
 * 5. Provides in-memory access for the Admin log viewer API.
 */
@Injectable()
export class LogManagerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(LogManagerService.name);
  private readonly logsDir = path.join(process.cwd(), 'logs');

  // In-memory buffers
  private requestLogBuffer: string[] = [];
  private errorLogBuffer: string[] = [];

  // Recent logs kept for admin API viewing (capped at 200 entries each)
  private recentRequestLogs: object[] = [];
  private recentErrorLogs: object[] = [];
  private readonly MAX_RECENT = 200;

  /**
   * Called when the module is initialized.
   * Ensures the logs/ directory exists.
   */
  onModuleInit() {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
        this.logger.log(`Created logs directory: ${this.logsDir}`);
      }
      this.logger.log('LogManagerService initialized — buffered logging active');
    } catch (err) {
      this.logger.error('Failed to create logs directory', err);
    }
  }

  /**
   * Called when the application is shutting down.
   * Flushes any remaining buffered log entries to disk.
   */
  onApplicationShutdown() {
    this.logger.log('Application shutting down — flushing remaining logs...');
    this.flushBuffers();
  }

  // ──────────────────────────────────────────────────────────────
  // Public API — used by middleware and filters
  // ──────────────────────────────────────────────────────────────

  /**
   * Adds a structured request log entry to the buffer.
   */
  logRequest(entry: {
    timestamp: string;
    correlationId: string;
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    contentLength?: string;
    userAgent: string;
    ip: string;
    userId?: string;
    userRole?: string;
  }): void {
    const logLine = `[${entry.timestamp}] [INFO] [${entry.correlationId}] ${entry.method} ${entry.url} ${entry.statusCode} ${entry.responseTime}ms — IP:${entry.ip} Role:${entry.userRole || 'none'} User:${entry.userId || 'anonymous'} UA:${entry.userAgent}`;
    this.requestLogBuffer.push(logLine);

    // Keep in recent logs for API access
    this.recentRequestLogs.push(entry);
    if (this.recentRequestLogs.length > this.MAX_RECENT) {
      this.recentRequestLogs.shift();
    }
  }

  /**
   * Adds a structured error log entry to the buffer.
   */
  logError(entry: {
    timestamp: string;
    correlationId?: string;
    method: string;
    url: string;
    statusCode: number;
    message: string;
    stack?: string;
    userId?: string;
    userRole?: string;
  }): void {
    const logLine = `[${entry.timestamp}] [ERROR] [${entry.correlationId || 'N/A'}] ${entry.method} ${entry.url} ${entry.statusCode} — ${entry.message}${entry.stack ? '\n  Stack: ' + entry.stack : ''}`;
    this.errorLogBuffer.push(logLine);

    // Keep in recent logs for API access
    this.recentErrorLogs.push(entry);
    if (this.recentErrorLogs.length > this.MAX_RECENT) {
      this.recentErrorLogs.shift();
    }
  }

  /**
   * Returns recent request logs (for Admin API).
   */
  getRecentRequestLogs(): object[] {
    return [...this.recentRequestLogs];
  }

  /**
   * Returns recent error logs (for Admin API).
   */
  getRecentErrorLogs(): object[] {
    return [...this.recentErrorLogs];
  }

  // ──────────────────────────────────────────────────────────────
  // Periodic Flush — every 30 seconds
  // ──────────────────────────────────────────────────────────────

  @Interval(30000)
  handleLogFlush(): void {
    if (this.requestLogBuffer.length === 0 && this.errorLogBuffer.length === 0) {
      return; // Nothing to flush
    }
    this.flushBuffers();
  }

  // ──────────────────────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────────────────────

  private flushBuffers(): void {
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Flush request logs
    if (this.requestLogBuffer.length > 0) {
      const requestLogFile = path.join(this.logsDir, `requests-${dateStr}.log`);
      const content = this.requestLogBuffer.join('\n') + '\n';
      this.requestLogBuffer = [];

      try {
        fs.appendFileSync(requestLogFile, content, 'utf-8');
        this.logger.debug(`Flushed ${content.split('\n').length - 1} request log entries to ${requestLogFile}`);
      } catch (err) {
        this.logger.error(`Failed to write request logs to ${requestLogFile}`, err);
      }
    }

    // Flush error logs
    if (this.errorLogBuffer.length > 0) {
      const errorLogFile = path.join(this.logsDir, `errors-${dateStr}.log`);
      const content = this.errorLogBuffer.join('\n') + '\n';
      this.errorLogBuffer = [];

      try {
        fs.appendFileSync(errorLogFile, content, 'utf-8');
        this.logger.debug(`Flushed ${content.split('\n').length - 1} error log entries to ${errorLogFile}`);
      } catch (err) {
        this.logger.error(`Failed to write error logs to ${errorLogFile}`, err);
      }
    }
  }
}
