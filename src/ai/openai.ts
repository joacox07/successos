import OpenAI from 'openai';
import { config } from '../config.js';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    if (!config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set. Set it in your .env file.');
    }
    client = new OpenAI({
      apiKey: config.openaiApiKey,
      timeout: config.openaiTimeoutMs,
      maxRetries: 0, // we handle retries in withRetry
    });
  }
  return client;
}
