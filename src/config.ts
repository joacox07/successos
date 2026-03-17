import 'dotenv/config';

export const config = {
  // API Keys
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  adminPhone: process.env.ADMIN_PHONE || '',

  // General
  timezone: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Database
  dbPath: process.env.DB_PATH || './data/successos.db',
  authDir: process.env.AUTH_DIR || './data/auth_info_baileys',

  // AI Models
  llmModel: 'gpt-4o-mini' as const,
  whisperModel: 'whisper-1' as const,

  // Timeouts
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 30_000,
  whisperTimeoutMs: Number(process.env.WHISPER_TIMEOUT_MS) || 60_000,

  // WhatsApp
  messageCooldownMs: Number(process.env.MESSAGE_COOLDOWN_MS) || 1500,

  // AI behavior
  maxRetries: 3,
  conversationContextLimit: Number(process.env.CONTEXT_LIMIT) || 10,
  quickLogMaxLength: 50,

  // Analytics
  correlationThreshold: 0.4,
  minDataPointsForCorrelation: 14,

  // API Server (for PWA)
  apiPort: Number(process.env.API_PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'successos-dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Trivial message filter
  trivialPatterns: /^(jaja|jeje|ok|dale|sí|si|no|bueno|genial|gracias|grax|thx|👍|🙏|💪|😂|🔥|👏)$/i,
};
