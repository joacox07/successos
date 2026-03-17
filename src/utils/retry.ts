import { logger } from './logger.js';

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn({ attempt, delay, label, error }, 'Retrying after error');
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
