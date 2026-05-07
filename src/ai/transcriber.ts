import OpenAI from 'openai';
import { getOpenAI } from './openai.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

function getExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'ogg';
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType = 'audio/ogg; codecs=opus'): Promise<string> {
  const openai = getOpenAI();
  const ext = getExtension(mimeType);

  // Use toFile from OpenAI SDK — more reliable than Node's File class across versions
  const file = await OpenAI.toFile(audioBuffer, `audio.${ext}`, { type: mimeType });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.whisperTimeoutMs);

  try {
    const response = await withRetry(
      () =>
        openai.audio.transcriptions.create(
          {
            model: config.whisperModel,
            file,
            language: 'es',
          },
          { signal: controller.signal },
        ),
      'whisper-transcription',
    );

    const text = response.text.trim();
    if (!text) throw new Error('Whisper returned empty text');

    logger.info({ textLen: text.length, ext }, 'Audio transcribed');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
