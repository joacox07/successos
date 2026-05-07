import 'dotenv/config';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

const appBaseUrl = trimTrailingSlash(
  process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || `http://localhost:${process.env.API_PORT || '3000'}`,
);

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
  backupRoot: process.env.BACKUP_ROOT || '/home/ubuntu/backups/successos',
  backupStatusFile: process.env.BACKUP_STATUS_FILE || `${process.env.BACKUP_ROOT || '/home/ubuntu/backups/successos'}/latest.json`,
  backupRemoteMode: process.env.BACKUP_REMOTE_MODE || 'none',
  backupRcloneRemote: process.env.BACKUP_RCLONE_REMOTE || '',
  backupRclonePrefix: process.env.BACKUP_RCLONE_PREFIX || 'prod',
  backupS3Bucket: process.env.BACKUP_S3_BUCKET || '',
  backupS3Prefix: process.env.BACKUP_S3_PREFIX || 'prod',
  backupLocalDailyRetention: Number(process.env.BACKUP_LOCAL_DAILY_RETENTION) || 7,
  backupLocalWeeklyRetention: Number(process.env.BACKUP_LOCAL_WEEKLY_RETENTION) || 4,

  // AI Models
  llmModel: 'gpt-4o-mini' as const,
  whisperModel: 'whisper-1' as const,

  // Timeouts
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 30_000,
  whisperTimeoutMs: Number(process.env.WHISPER_TIMEOUT_MS) || 180_000,

  // WhatsApp
  messageCooldownMs: Number(process.env.MESSAGE_COOLDOWN_MS) || 1500,

  // AI behavior
  maxRetries: 3,
  conversationContextLimit: Number(process.env.CONTEXT_LIMIT) || 10,
  quickLogMaxLength: 50,

  // Analytics
  correlationThreshold: 0.4,
  minDataPointsForCorrelation: 14,

  // Google Calendar OAuth2
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl}/api/calendar/callback`,

  // Admin credentials
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',

  // API Server (for PWA)
  apiPort: Number(process.env.API_PORT) || 3000,
  appBaseUrl,
  jwtSecret: process.env.JWT_SECRET || 'successos-dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Trivial message filter
  trivialPatterns: /^(jaja|jeje|ok|dale|sí|si|no|bueno|genial|gracias|grax|thx|👍|🙏|💪|😂|🔥|👏)$/i,
};
