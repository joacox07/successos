import { getOpenAI } from './openai.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { File } from 'buffer';

export async function transcribeAudio(audioBuffer: Buffer, mimeType = 'audio/ogg'): Promise<string> {
  const openai = getOpenAI();

  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'ogg';
  const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

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

    logger.info({ textLen: response.text.length }, 'Audio transcribed');
    return response.text;
  } finally {
    clearTimeout(timeout);
  }
}
