import { Router, Request, Response } from 'express';
import multer from 'multer';
import { existsSync, readFileSync } from 'fs';
import { verifyJwt, loginWithPassword, setUserPassword, generateUserToken } from './auth.js';
import { getSqlite } from '../db/client.js';
import { config } from '../config.js';
import { extractData } from '../ai/extractor.js';
import { generateCoachResponse } from '../ai/coach.js';
import { generateGuideResponse, generateCalendarChatResponse, type CalendarChatResult } from '../ai/guide.js';
import { transcribeAudio } from '../ai/transcriber.js';
import { trackExtraction } from '../engine/tracker.js';
import { logger } from '../utils/logger.js';
import {
  applySuggestedCompetitionHabitLink,
  createCompetition,
  createCompetitionHabit,
  createAndLinkCompetitionHabit,
  deleteCompetition,
  deleteCompetitionHabit,
  discoverCompetitionInviteTarget,
  findDiscoverableUserByUsername,
  getCompetitionDetail,
  getCompetitionHabitsForDiary,
  getCompetitionStats,
  inviteUserToCompetition,
  linkExistingCompetitionHabit,
  listCompetitionInviteCandidates,
  listCompetitionInvites,
  listCompetitionsForUser,
  logCompetitionHabit,
  logCompetitionHabitDuration,
  respondToCompetitionInvite,
  unlinkCompetitionHabit,
  type CompetitionHabitKind,
  type CompetitionLogStatus,
  type CompetitionRange,
  type CompetitionScoringMode,
  updateCompetition,
  updateCompetitionHabit,
} from '../db/competition.js';
import { assertEditableDate, getEditableDateWindow, getTodayDate, normalizeDateKey } from '../utils/dates.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
import {
  getActiveGoals,
  getAllGoals,
  getTodayEntry,
  getDailyEntries,
  upsertDailyEntry,
  getActivePatterns,
  getLatestReport,
  getRecentMessagesAsc,
  getGoalLogsByUser,
  createHabit,
  getUserHabits,
  getHabitByIdForUser,
  updateHabit,
  deactivateHabit,
  toggleHabitLog,
  getHabitLogs,
  getHabitsToday,
  createStudySession,
  getStudySessions,
  getStudyStats,
  createFlashcardDeck,
  getUserDecks,
  deleteFlashcardDeck,
  createFlashcard,
  getDeckCards,
  getCardsForReview,
  updateFlashcard,
  deleteFlashcard,
  createStudySubject,
  getUserSubjects,
  markSubjectStudied,
  deleteStudySubject,
  logMessage,
  logGuideMessage,
  getGuideHistory,
} from '../db/repository.js';

const router = Router();

// ── Google Calendar OAuth callback (public, no auth needed) ──

router.get('/calendar/callback', async (req: Request, res: Response) => {
  // Prevent Service Worker from caching this response
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const code = req.query.code as string;
    const userId = Number(req.query.state);
    logger.info({ userId, hasCode: !!code }, 'Calendar OAuth callback received');

    if (!code || !userId) {
      return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#111;color:#fff"><h1>Error</h1><p>Faltan parámetros. Intentá de nuevo desde WhatsApp.</p></body></html>');
    }

    const { exchangeCode } = await import('../calendar/gcal.js');
    const { upsertCalendarTokens } = await import('../db/repository.js');

    const tokens = await exchangeCode(code);
    logger.info({ userId, hasAccess: !!tokens.access_token, hasRefresh: !!tokens.refresh_token }, 'Calendar tokens received');

    await upsertCalendarTokens(userId, {
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date ? String(tokens.expiry_date) : null,
    });

    logger.info({ userId }, 'Calendar tokens saved');

    // Redirect to PWA calendar page
    res.redirect('/calendar?connected=1');
  } catch (err: any) {
    logger.error({ err: err?.message || err, stack: err?.stack }, 'Calendar OAuth callback error');
    res.redirect('/calendar?error=auth_failed');
  }
});


// ── Auth middleware ──

function authMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  const user = verifyJwt(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  (req as any).user = user;
  next();
}

function adminMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  const user = verifyJwt(token);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

function validateUsernameFormat(value: string) {
  const normalized = normalizeUsername(value);
  if (!normalized) return { normalized, error: 'Username requerido' };
  if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
    return { normalized, error: 'Us? entre 3 y 24 caracteres: letras min?sculas, n?meros o guion bajo' };
  }
  return { normalized, error: null };
}

function buildCheckinPayload(entry: any) {
  return entry ? {
    overallScore: entry.overall_score,
    mood: entry.mood,
    energyLevel: entry.energy_level,
    sleepQuality: entry.sleep_quality,
    bedtime: entry.bedtime,
    wakeTime: entry.wake_time,
    exerciseDone: !!entry.exercise_done,
    exerciseType: entry.exercise_type,
    exerciseDuration: entry.exercise_duration,
    focusHours: entry.focus_hours,
    dietQuality: entry.diet_quality,
    dietEntries: entry.diet_entries,
    biggestWin: entry.biggest_win,
    emotionalState: entry.emotional_state,
    emotionalNote: entry.emotional_note,
    dayRating: entry.day_rating,
    procrastination: !!entry.procrastination,
    socialEvent: entry.social_event,
    vicesDetails: entry.vices_details,
  } : null;
}

async function buildCheckinState(userId: number, date: string) {
  const entry = await getTodayEntry(userId, date);
  const streakStart = new Date(`${date}T12:00:00`);
  streakStart.setDate(streakStart.getDate() - 60);
  const entries = await getDailyEntries(userId, streakStart.toLocaleDateString('en-CA'), date);
  const entryDates = new Set(entries.map((item) => item.date));
  let streak = 0;
  const anchor = new Date(`${date}T12:00:00`);
  for (let i = 0; i < 60; i += 1) {
    const cursor = new Date(anchor);
    cursor.setDate(cursor.getDate() - i);
    const dateStr = cursor.toISOString().split('T')[0];
    if (entryDates.has(dateStr)) streak += 1;
    else if (i > 0) break;
  }
  return { date, entry: buildCheckinPayload(entry), streak };
}

// ── Auth routes (public) ──

router.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const result = await loginWithPassword(username.trim(), password);
  if (!result.ok) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  if (result.isAdmin) {
    return res.json({ ok: true, token: result.token, isAdmin: true });
  }

  res.json({ ok: true, token: result.token, profileComplete: result.profileComplete, isAdmin: false });
});

// ── Admin routes ──

router.get('/admin/users', adminMiddleware, async (_req: Request, res: Response) => {
  const sqlite = getSqlite();
  const rows = sqlite.prepare(
    'SELECT id, name, phone, email, profile_complete, created_at FROM users ORDER BY created_at DESC'
  ).all() as any[];
  res.json({ users: rows });
});

router.get('/admin/backup-status', adminMiddleware, async (_req: Request, res: Response) => {
  try {
    if (!existsSync(config.backupStatusFile)) {
      return res.json({
        configured: true,
        available: false,
        backupRoot: config.backupRoot,
        statusFile: config.backupStatusFile,
        remoteMode: config.backupRemoteMode,
      });
    }

    const raw = readFileSync(config.backupStatusFile, 'utf-8');
    const status = JSON.parse(raw);
    return res.json({
      configured: true,
      available: true,
      backupRoot: config.backupRoot,
      statusFile: config.backupStatusFile,
      remoteMode: config.backupRemoteMode,
      status,
    });
  } catch (err: any) {
    logger.error({ err: err?.message || err }, 'GET /admin/backup-status error');
    return res.status(500).json({ error: 'No se pudo leer el estado del backup' });
  }
});

router.post('/admin/users', adminMiddleware, async (req: Request, res: Response) => {
  const { name, phone, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  const sqlite = getSqlite();
  try {
    const phoneVal = phone?.trim() || `pending_${Date.now()}`;
    const existing = phone ? sqlite.prepare('SELECT id FROM users WHERE phone = ?').get(phoneVal) : null;
    if (existing) {
      return res.status(409).json({ error: 'El teléfono ya está registrado' });
    }
    const now = new Date().toISOString();
    const result = sqlite.prepare(
      'INSERT INTO users (name, phone, profile_complete, created_at, updated_at) VALUES (?, ?, 0, ?, ?)'
    ).run(name.trim(), phoneVal, now, now);
    const userId = result.lastInsertRowid as number;
    setUserPassword(userId, password);
    res.json({ ok: true, userId });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Admin create user error');
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.delete('/admin/users/:id', adminMiddleware, async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Usuario inválido' });
  }
  const sqlite = getSqlite();
  try {
    const exists = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!exists) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Delete all related data before the user (FK constraints are ON).
    // Competition data needs to go first because it references both users and habits.
    const cascade = sqlite.transaction(() => {
      sqlite.prepare(
        `DELETE FROM competition_habit_logs
         WHERE competition_habit_id IN (
           SELECT ch.id
           FROM competition_habits ch
           INNER JOIN habit_competitions hc ON hc.id = ch.competition_id
           WHERE hc.created_by_user_id = ?
         )`
      ).run(userId);
      sqlite.prepare(
        `DELETE FROM competition_habit_links
         WHERE competition_habit_id IN (
           SELECT ch.id
           FROM competition_habits ch
           INNER JOIN habit_competitions hc ON hc.id = ch.competition_id
           WHERE hc.created_by_user_id = ?
         )`
      ).run(userId);
      sqlite.prepare(
        `DELETE FROM competition_habits
         WHERE competition_id IN (
           SELECT id FROM habit_competitions WHERE created_by_user_id = ?
         )`
      ).run(userId);
      sqlite.prepare(
        `DELETE FROM competition_participants
         WHERE competition_id IN (
           SELECT id FROM habit_competitions WHERE created_by_user_id = ?
         )`
      ).run(userId);
      sqlite.prepare('DELETE FROM habit_competitions WHERE created_by_user_id = ?').run(userId);

      sqlite.prepare('DELETE FROM competition_habit_logs WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM competition_habit_links WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM competition_participants WHERE user_id = ?').run(userId);

      sqlite.prepare('DELETE FROM habit_logs WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM habits WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM goal_logs WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM patterns WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM daily_entries WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM reports WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM onboarding_state WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM sent_checkins WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM study_sessions WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM flashcards WHERE deck_id IN (SELECT id FROM flashcard_decks WHERE user_id = ?)').run(userId);
      sqlite.prepare('DELETE FROM flashcard_decks WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM study_subjects WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM calendar_tokens WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM profiles WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });

    cascade();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId }, 'DELETE /admin/users/:id error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al eliminar usuario' });
  }
});

router.post('/admin/users/:id/reset-password', adminMiddleware, async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Contraseña requerida' });
  setUserPassword(userId, password);
  res.json({ ok: true });
});

// ── Protected routes ──

router.use(authMiddleware);

// ── Competitions ──

router.get('/competition/discover', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const username = String(req.query.username || '').trim();
  const competitionId = Number(req.query.competitionId || 0);
  if (!username) return res.status(400).json({ error: 'Username requerido' });
  try {
    if (competitionId > 0) {
      const result = discoverCompetitionInviteTarget({
        competitionId,
        actorUserId: auth.userId ?? null,
        actorIsAdmin: !!auth.isAdmin,
        username,
      });
      return res.json(result);
    }
    const user = findDiscoverableUserByUsername(username, auth.userId);
    if (!user) {
      return res.json({
        status: 'not_found',
        message: 'No existe un usuario con ese @username.',
        user: null,
        canInvite: false,
      });
    }
    res.json({
      status: 'found',
      message: 'Usuario encontrado.',
      user,
      canInvite: true,
    });
  } catch (err) {
    logger.error({ err }, 'GET /competition/discover error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al buscar usuario' });
  }
});

router.get('/competitions', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  try {
    const competitions = listCompetitionsForUser(auth.userId ?? null, !!auth.isAdmin);
    res.json({ competitions });
  } catch (err) {
    logger.error({ err }, 'GET /competitions error');
    res.status(500).json({ error: 'Error al cargar competencias' });
  }
});

router.get('/competitions/invites', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  if (auth.isAdmin || !auth.userId) return res.json({ invites: [] });
  try {
    const invites = listCompetitionInvites(auth.userId);
    res.json({ invites });
  } catch (err) {
    logger.error({ err }, 'GET /competitions/invites error');
    res.status(500).json({ error: 'Error al cargar invitaciones' });
  }
});

router.post('/competitions', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const { name, participantUserIds } = req.body as { name?: string; participantUserIds?: number[] };
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    if (!auth.isAdmin && !auth.userId) return res.status(401).json({ error: 'No autorizado' });
    const competitionId = createCompetition({
      name,
      actorUserId: auth.userId ?? null,
      isAdmin: !!auth.isAdmin,
      participantUserIds: auth.isAdmin && Array.isArray(participantUserIds) ? participantUserIds : undefined,
    });
    res.json({ ok: true, competitionId });
  } catch (err) {
    logger.error({ err }, 'POST /competitions error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al crear competencia' });
  }
});

router.get('/competitions/:id', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  try {
    const detail = getCompetitionDetail({
      competitionId: Number(req.params.id),
      viewerUserId: auth.userId ?? null,
      viewerIsAdmin: !!auth.isAdmin,
    });
    res.json(detail);
  } catch (err) {
    logger.error({ err }, 'GET /competitions/:id error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al cargar competencia' });
  }
});

router.put('/competitions/:id', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    updateCompetition({
      competitionId: Number(req.params.id),
      actorUserId: auth.userId ?? null,
      actorIsAdmin: !!auth.isAdmin,
      name,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'PUT /competitions/:id error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al actualizar competencia' });
  }
});

router.delete('/competitions/:id', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  try {
    deleteCompetition({
      competitionId: Number(req.params.id),
      actorUserId: auth.userId ?? null,
      actorIsAdmin: !!auth.isAdmin,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'DELETE /competitions/:id error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al eliminar competencia' });
  }
});

router.get('/competitions/:id/invite-options', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const limit = Number(req.query.limit || 10);
  try {
    const candidates = listCompetitionInviteCandidates({
      competitionId: Number(req.params.id),
      actorUserId: auth.userId ?? null,
      actorIsAdmin: !!auth.isAdmin,
      limit,
    });
    res.json({ candidates });
  } catch (err) {
    logger.error({ err }, 'GET /competitions/:id/invite-options error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al cargar candidatos' });
  }
});

router.post('/competitions/:id/invite', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const { username } = req.body as { username?: string };
  if (!username?.trim()) return res.status(400).json({ error: 'Username requerido' });
  try {
    const invitedUser = inviteUserToCompetition({
      competitionId: Number(req.params.id),
      actorUserId: auth.userId ?? null,
      actorIsAdmin: !!auth.isAdmin,
      username: normalizeUsername(username),
    });
    res.json({ ok: true, invitedUser });
  } catch (err) {
    logger.error({ err }, 'POST /competitions/:id/invite error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al invitar usuario' });
  }
});

router.post('/competitions/:id/respond-invite', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const { action } = req.body as { action?: 'accepted' | 'declined' };
  if (!auth.userId) return res.status(401).json({ error: 'No autorizado' });
  if (action !== 'accepted' && action !== 'declined') {
    return res.status(400).json({ error: 'Accion invalida' });
  }

  try {
    respondToCompetitionInvite({
      competitionId: Number(req.params.id),
      userId: auth.userId,
      action,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'POST /competitions/:id/respond-invite error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al responder invitacion' });
  }
});

router.post('/competitions/:id/habits', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const {
    name,
    description,
    category,
    kind,
    scoringMode,
    pointsPositive,
    pointsNegative,
    minutesPerBlock,
    pointsPerBlock,
    dailyTargetMinutes,
  } = req.body as {
    name?: string;
    description?: string;
    category?: string;
    kind?: CompetitionHabitKind;
    scoringMode?: CompetitionScoringMode;
    pointsPositive?: number;
    pointsNegative?: number;
    minutesPerBlock?: number;
    pointsPerBlock?: number;
    dailyTargetMinutes?: number;
  };

  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  if (!kind || !['event', 'duration'].includes(kind)) {
    return res.status(400).json({ error: 'Tipo de hábito inválido' });
  }
  if (!scoringMode || !['positive_only', 'negative_only', 'both'].includes(scoringMode)) {
    return res.status(400).json({ error: 'Scoring mode invalido' });
  }
  if (kind === 'duration' && (!minutesPerBlock || !pointsPerBlock || Number(minutesPerBlock) <= 0 || Number(pointsPerBlock) < 0)) {
    return res.status(400).json({ error: 'Configuración de minutos inválida' });
  }

  try {
    const habitId = createCompetitionHabit({
      competitionId: Number(req.params.id),
      actorUserId: auth.userId ?? null,
      actorIsAdmin: !!auth.isAdmin,
      name,
      description,
      category,
      kind,
      scoringMode,
      pointsPositive: Number(pointsPositive ?? 1),
      pointsNegative: Number(pointsNegative ?? 0),
      minutesPerBlock: minutesPerBlock == null ? null : Number(minutesPerBlock),
      pointsPerBlock: pointsPerBlock == null ? null : Number(pointsPerBlock),
      dailyTargetMinutes: dailyTargetMinutes == null ? null : Number(dailyTargetMinutes),
    });
    res.json({ ok: true, habitId });
  } catch (err) {
    logger.error({ err }, 'POST /competitions/:id/habits error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al crear hábito competitivo' });
  }
});

router.put('/competitions/:id/habits/:habitId', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const { name, description, category, kind, scoringMode, pointsPositive, pointsNegative, minutesPerBlock, pointsPerBlock, dailyTargetMinutes } = req.body as {
    name?: string;
    description?: string;
    category?: string;
    kind?: CompetitionHabitKind;
    scoringMode?: CompetitionScoringMode;
    pointsPositive?: number;
    pointsNegative?: number;
    minutesPerBlock?: number;
    pointsPerBlock?: number;
    dailyTargetMinutes?: number;
  };
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  if (!scoringMode || !['positive_only', 'negative_only', 'both'].includes(scoringMode)) {
    return res.status(400).json({ error: 'Modo de scoring inválido' });
  }
  try {
    updateCompetitionHabit({
      competitionId: Number(req.params.id),
      competitionHabitId: Number(req.params.habitId),
      actorUserId: auth.userId ?? null,
      actorIsAdmin: !!auth.isAdmin,
      name,
      description,
      category,
      kind: kind ?? 'event',
      scoringMode,
      pointsPositive: Number(pointsPositive ?? 0),
      pointsNegative: Number(pointsNegative ?? 0),
      minutesPerBlock: minutesPerBlock == null ? null : Number(minutesPerBlock),
      pointsPerBlock: pointsPerBlock == null ? null : Number(pointsPerBlock),
      dailyTargetMinutes: dailyTargetMinutes == null ? null : Number(dailyTargetMinutes),
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'PUT /competitions/:id/habits/:habitId error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al actualizar hábito competitivo' });
  }
});

router.delete('/competitions/:id/habits/:habitId', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  try {
    deleteCompetitionHabit({
      competitionId: Number(req.params.id),
      competitionHabitId: Number(req.params.habitId),
      actorUserId: auth.userId ?? null,
      actorIsAdmin: !!auth.isAdmin,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'DELETE /competitions/:id/habits/:habitId error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al eliminar hábito competitivo' });
  }
});

router.post('/competitions/:id/habits/:habitId/link-existing', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number };
  const { personalHabitId } = req.body as { personalHabitId?: number };
  if (!auth.userId) return res.status(401).json({ error: 'No autorizado' });
  if (!personalHabitId) return res.status(400).json({ error: 'Hábito personal requerido' });
  try {
    linkExistingCompetitionHabit({
      competitionId: Number(req.params.id),
      competitionHabitId: Number(req.params.habitId),
      userId: auth.userId,
      personalHabitId: Number(personalHabitId),
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'POST /competitions/:id/habits/:habitId/link-existing error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al vincular hábito' });
  }
});

router.post('/competitions/:id/habits/:habitId/apply-suggested-link', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number };
  if (!auth.userId) return res.status(401).json({ error: 'No autorizado' });
  try {
    const result = applySuggestedCompetitionHabitLink({
      competitionId: Number(req.params.id),
      competitionHabitId: Number(req.params.habitId),
      userId: auth.userId,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, 'POST /competitions/:id/habits/:habitId/apply-suggested-link error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al aplicar la sugerencia' });
  }
});

router.post('/competitions/:id/habits/:habitId/create-and-link', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number };
  if (!auth.userId) return res.status(401).json({ error: 'No autorizado' });
  try {
    const personalHabitId = createAndLinkCompetitionHabit({
      competitionId: Number(req.params.id),
      competitionHabitId: Number(req.params.habitId),
      userId: auth.userId,
    });
    res.json({ ok: true, personalHabitId });
  } catch (err) {
    logger.error({ err }, 'POST /competitions/:id/habits/:habitId/create-and-link error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al crear y vincular hábito' });
  }
});

router.delete('/competitions/:id/habits/:habitId/link', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number };
  if (!auth.userId) return res.status(401).json({ error: 'No autorizado' });
  try {
    unlinkCompetitionHabit({
      competitionId: Number(req.params.id),
      competitionHabitId: Number(req.params.habitId),
      userId: auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'DELETE /competitions/:id/habits/:habitId/link error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al desvincular hábito' });
  }
});

router.post('/competitions/:id/habits/:habitId/log', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number };
  const { status, date } = req.body as { status?: CompetitionLogStatus; date?: string };
  if (!auth.userId) return res.status(401).json({ error: 'No autorizado' });
  if (!status || !['positive', 'negative', 'clear'].includes(status)) {
    return res.status(400).json({ error: 'Status invalido' });
  }

  try {
    if (date) assertEditableDate(date, 'America/Argentina/Buenos_Aires');
    const result = logCompetitionHabit({
      competitionId: Number(req.params.id),
      competitionHabitId: Number(req.params.habitId),
      userId: auth.userId,
      status,
      date,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, 'POST /competitions/:id/habits/:habitId/log error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al registrar hábito competitivo' });
  }
});

router.post('/competitions/:id/habits/:habitId/log-duration', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number };
  const { minutesDelta, date } = req.body as { minutesDelta?: number; date?: string };
  if (!auth.userId) return res.status(401).json({ error: 'No autorizado' });
  if (!Number.isFinite(Number(minutesDelta)) || Number(minutesDelta) <= 0) {
    return res.status(400).json({ error: 'Minutos inválidos' });
  }

  try {
    if (date) assertEditableDate(date, 'America/Argentina/Buenos_Aires');
    const result = logCompetitionHabitDuration({
      competitionId: Number(req.params.id),
      competitionHabitId: Number(req.params.habitId),
      userId: auth.userId,
      minutesDelta: Number(minutesDelta),
      date,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, 'POST /competitions/:id/habits/:habitId/log-duration error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al registrar minutos' });
  }
});

router.get('/competitions/:id/stats', async (req: Request, res: Response) => {
  const auth = (req as any).user as { userId?: number; isAdmin?: boolean };
  const range = ((req.query.range as string) || 'week') as CompetitionRange;
  if (!['week', 'month', 'total'].includes(range)) {
    return res.status(400).json({ error: 'Range invalido' });
  }
  try {
    const stats = getCompetitionStats({
      competitionId: Number(req.params.id),
      range,
      viewerUserId: auth.userId ?? null,
      viewerIsAdmin: !!auth.isAdmin,
    });
    res.json(stats);
  } catch (err) {
    logger.error({ err }, 'GET /competitions/:id/stats error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al cargar estadisticas' });
  }
});

// Dashboard — today's data
router.get('/dashboard', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const tz = 'America/Argentina/Buenos_Aires';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

  const [entry, goals, patterns] = await Promise.all([
    getTodayEntry(userId, today),
    getActiveGoals(userId),
    getActivePatterns(userId),
  ]);

  // Calculate daily score (average of available metrics, normalized to 0-100)
  let score = 0;
  let count = 0;
  if (entry) {
    if (entry.sleepQuality) { score += entry.sleepQuality * 10; count++; }
    if (entry.mood) { score += entry.mood * 10; count++; }
    if (entry.energyLevel) { score += entry.energyLevel * 10; count++; }
    if (entry.exerciseDone) { score += 80; count++; }
    if (entry.dietQuality) { score += entry.dietQuality * 10; count++; }
  }

  res.json({
    date: today,
    score: count > 0 ? Math.round(score / count) : null,
    entry,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      unit: g.unit,
      progress: g.targetValue ? Math.round((parseFloat(g.currentValue || '0') / parseFloat(g.targetValue)) * 100) : 0,
    })),
    patterns: patterns.map((p) => ({
      areaA: p.areaA,
      areaB: p.areaB,
      correlation: p.correlation,
      description: p.description,
    })),
  });
});

// Metrics — historical data for charts
router.get('/dashboard/habit-summary', async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const tz = 'America/Argentina/Buenos_Aires';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const requestedIds = String(req.query.ids || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    const habits = await getUserHabits(userId);
    const criticalHabits = requestedIds.length > 0
      ? habits.filter((habit) => requestedIds.includes(habit.id))
      : habits;

    const todayStatuses = await Promise.all(
      criticalHabits.map(async (habit) => {
        const logs = await getHabitLogs(habit.id, today, today);
        const log = logs[0];
        const status = log?.status || (log?.completed ? 'positive' : 'clear');
        const completed = habit.isNegative ? status !== 'negative' : status === 'positive';
        return {
          id: habit.id,
          name: habit.name,
          isNegative: !!habit.isNegative,
          status,
          completed,
        };
      }),
    );

    const pendingHabits = todayStatuses.filter((habit) => !habit.completed);
    const completedCount = todayStatuses.filter((habit) => habit.completed).length;
    const totalCount = todayStatuses.length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const streakEnd = new Date(`${today}T12:00:00`);
    const streakStart = new Date(streakEnd);
    streakStart.setDate(streakStart.getDate() - 90);
    const startDate = normalizeDateKey(streakStart);
    const endDate = normalizeDateKey(streakEnd);
    const completedDaysByHabit = new Map<number, Set<string>>();
    const failedDaysByHabit = new Map<number, Set<string>>();

    for (const habit of criticalHabits) {
      const logs = await getHabitLogs(habit.id, startDate, endDate);
      completedDaysByHabit.set(
        habit.id,
        new Set(
          logs
            .filter((log) => (log.status || (log.completed ? 'positive' : 'clear')) === 'positive')
            .map((log) => log.date),
        ),
      );
      failedDaysByHabit.set(
        habit.id,
        new Set(
          logs
            .filter((log) => (log.status || (log.completed ? 'positive' : 'clear')) === 'negative')
            .map((log) => log.date),
        ),
      );
    }

    let streak = 0;
    if (criticalHabits.length > 0) {
      for (let offset = 0; offset < 90; offset += 1) {
        const day = new Date(streakEnd);
        day.setDate(day.getDate() - offset);
        const dateKey = normalizeDateKey(day);
        const dayComplete = criticalHabits.every((habit) => {
          if (habit.isNegative) return !failedDaysByHabit.get(habit.id)?.has(dateKey);
          return !!completedDaysByHabit.get(habit.id)?.has(dateKey);
        });
        if (dayComplete) streak += 1;
        else if (offset > 0 || criticalHabits.length > 0) break;
      }
    }

    res.json({
      date: today,
      completedCount,
      totalCount,
      completionRate,
      streak,
      criticalHabits: todayStatuses,
      pendingHabits,
    });
  } catch (err) {
    logger.error({ err }, 'GET /dashboard/habit-summary error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al cargar resumen de hábitos' });
  }
});

router.get('/metrics', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const range = (req.query.range as string) || 'week';
  const tz = 'America/Argentina/Buenos_Aires';
  const end = new Date().toLocaleDateString('en-CA', { timeZone: tz });

  const [y, m, d] = end.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);
  if (range === 'week') startDate.setDate(startDate.getDate() - 7);
  else if (range === 'month') startDate.setMonth(startDate.getMonth() - 1);
  else if (range === 'total') startDate.setFullYear(startDate.getFullYear() - 5);
  const start = startDate.toLocaleDateString('en-CA');

  const entries = await getDailyEntries(userId, start, end);

  res.json({
    range,
    start,
    end,
    entries: entries.map((e) => ({
      date: e.date,
      sleepQuality: e.sleepQuality,
      bedtime: e.bedtime,
      wakeTime: e.wakeTime,
      mood: e.mood,
      energyLevel: e.energyLevel,
      exerciseDone: e.exerciseDone,
      exerciseDuration: e.exerciseDuration,
      focusHours: e.focusHours,
      dietQuality: e.dietQuality,
      dayRating: e.dayRating,
      overallScore: e.overallScore,
    })),
  });
});

// Goals — CRUD
router.post('/goals', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const { title, category, description, metric, targetValue, unit, deadline, priority } = req.body;
  if (!title || !category) return res.status(400).json({ error: 'Titulo y categoria requeridos' });

  const sqlite = getSqlite();
  const result = sqlite.prepare(
    'INSERT INTO goals (user_id, title, category, description, metric, target_value, unit, deadline, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(auth.userId, title, category, description || null, metric || null, targetValue || null, unit || null, deadline || null, priority || 3);

  res.json({ ok: true, goalId: result.lastInsertRowid });
});

router.put('/goals/:id', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const { id } = req.params;
  const { title, category, description, metric, targetValue, currentValue, unit, deadline, priority, status } = req.body;
  const sqlite = getSqlite();

  // Verify ownership
  const goal = sqlite.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').get(Number(id), auth.userId);
  if (!goal) return res.status(404).json({ error: 'Objetivo no encontrado' });

  const fields: string[] = [];
  const values: any[] = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (category !== undefined) { fields.push('category = ?'); values.push(category); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (metric !== undefined) { fields.push('metric = ?'); values.push(metric); }
  if (targetValue !== undefined) { fields.push('target_value = ?'); values.push(targetValue); }
  if (currentValue !== undefined) { fields.push('current_value = ?'); values.push(currentValue); }
  if (unit !== undefined) { fields.push('unit = ?'); values.push(unit); }
  if (deadline !== undefined) { fields.push('deadline = ?'); values.push(deadline); }
  if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }

  if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
  values.push(Number(id));
  sqlite.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

router.delete('/goals/:id', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const { id } = req.params;
  const sqlite = getSqlite();
  const goal = sqlite.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').get(Number(id), auth.userId);
  if (!goal) return res.status(404).json({ error: 'Objetivo no encontrado' });

  sqlite.prepare('DELETE FROM goal_logs WHERE goal_id = ?').run(Number(id));
  sqlite.prepare('DELETE FROM goals WHERE id = ?').run(Number(id));
  res.json({ ok: true });
});

router.get('/goals', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const goals = await getAllGoals(userId);

  res.json({
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      description: g.description,
      metric: g.metric,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      unit: g.unit,
      deadline: g.deadline,
      status: g.status,
      priority: g.priority,
      progress: g.targetValue ? Math.round((parseFloat(g.currentValue || '0') / parseFloat(g.targetValue)) * 100) : 0,
    })),
  });
});

// Insights — correlations
router.get('/insights', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const patterns = await getActivePatterns(userId);

  res.json({
    correlations: patterns.map((p) => ({
      areaA: p.areaA,
      areaB: p.areaB,
      correlation: p.correlation,
      dataPoints: p.dataPoints,
      confidence: p.confidence,
      description: p.description,
      patternType: p.patternType,
    })),
  });
});

// Guide — pattern analysis chat
router.get('/guide/chat', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  try {
    const history = await getGuideHistory(userId, 30);
    res.json({
      messages: history.map(m => ({
        id: m.id,
        direction: m.direction,
        content: m.rawContent,
        timestamp: m.timestamp,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'GET /guide/chat error');
    res.status(500).json({ error: 'Error al cargar historial' });
  }
});

router.post('/guide/chat', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { text } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: 'Texto requerido' });
  }

  try {
    // Log user message
    await logGuideMessage({ userId, direction: 'in', content: text.trim() });

    // Get context: correlations, latest report, guide history
    const [correlations, reportRow, guideHistory] = await Promise.all([
      getActivePatterns(userId),
      getLatestReport(userId, 'weekly'),
      getGuideHistory(userId, 10),
    ]);

    // Build conversation history for context (exclude the message just logged)
    const history = guideHistory
      .slice(0, -1) // exclude the one we just added
      .map(m => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.rawContent ?? '' }));

    // Enrich with upcoming calendar events
    let calendarContext = '';
    try {
      const { getCalendarTokens: getCalTokens } = await import('../db/repository.js');
      const { listEvents: listCalEvents } = await import('../calendar/gcal.js');
      const calTokens = await getCalTokens(userId);
      if (calTokens) {
        const now = new Date();
        const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const calEvents = await listCalEvents(calTokens, now.toISOString(), twoWeeks.toISOString(), 10);
        if (calEvents.length > 0) {
          calendarContext = '\n\nPRÓXIMOS EVENTOS DEL CALENDARIO (próximas 2 semanas):\n' +
            calEvents.map((e: any) => {
              const when = e.allDay ? e.start.slice(0, 10) : e.start.slice(0, 16).replace('T', ' ');
              return `- ${when}: ${e.summary}`;
            }).join('\n');
        }
      }
    } catch {
      // Calendar is optional — silent fail
    }

    const enrichedReport = (reportRow?.content ?? '') + calendarContext || null;

    const response = await generateGuideResponse(
      text.trim(),
      correlations,
      enrichedReport,
      history,
    );

    // Log AI response
    await logGuideMessage({ userId, direction: 'out', content: response });

    res.json({ response });
  } catch (err) {
    logger.error({ err }, 'POST /guide/chat error');
    res.status(500).json({ error: 'Error al procesar mensaje' });
  }
});

// Reports
router.get('/reports/:type', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { type } = req.params;
  if (type !== 'weekly' && type !== 'monthly') {
    return res.status(400).json({ error: 'Type must be weekly or monthly' });
  }

  const report = await getLatestReport(userId, type);
  res.json({ report });
});

// Recent messages (timeline)
router.get('/timeline', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const msgs = await getRecentMessagesAsc(userId, limit);

  res.json({
    messages: msgs.map((m) => ({
      id: m.id,
      direction: m.direction,
      contentType: m.contentType,
      content: m.rawContent,
      timestamp: m.timestamp,
    })),
  });
});

// ── Chat (conversational input with AI) ──

router.post('/chat', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const tz = 'America/Argentina/Buenos_Aires';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    let text = req.body?.text as string | undefined;
    let transcription: string | undefined;

    // If audio uploaded, transcribe it
    if (req.file) {
      const mimeType = req.file.mimetype || 'audio/webm';
      transcription = await transcribeAudio(req.file.buffer, mimeType);
      text = transcription;
      logger.info({ userId, transcriptionLen: transcription.length }, 'Audio transcribed for chat');
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No text or audio provided' });
    }

    // Use shared message processor (same logic as WhatsApp handler)
    const { processMessage } = await import('../engine/messageProcessor.js');
    const result = await processMessage(userId, text, {
      timezone: tz,
      contentType: req.file ? 'audio' : 'text',
      transcription,
    });

    // Skip response for trivial messages (return minimal data, no AI call)
    if (result.type === 'trivial') {
      const entry = await getTodayEntry(userId, today);
      return res.json({ response: '', extractedData: null, currentEntry: entry, streak: 0, type: 'trivial' });
    }

    // Get updated entry and calculate streak (only check last 60 days)
    const entryDate = result.targetDate || today;
    const updatedEntry = await getTodayEntry(userId, entryDate);
    const streakStart = new Date(today + 'T12:00:00');
    streakStart.setDate(streakStart.getDate() - 60);
    const entries = await getDailyEntries(userId, streakStart.toLocaleDateString('en-CA'), today);
    const entryDates = new Set(entries.map(e => e.date));
    let streak = 0;
    const todayDate = new Date(today + 'T12:00:00');
    for (let i = 0; i < 60; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (entryDates.has(dateStr)) streak++;
      else if (i > 0) break;
    }

    res.json({
      response: result.response,
      extractedData: result.extractedData || null,
      currentEntry: updatedEntry,
      entryDate,
      streak,
      type: result.type,
      ...(transcription ? { transcription } : {}),
    });
  } catch (err) {
    logger.error({ err }, 'Chat endpoint error');
    res.status(500).json({ error: 'Error procesando mensaje' });
  }
});

router.get('/chat/history', async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const tz = 'America/Argentina/Buenos_Aires';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const msgs = await getRecentMessagesAsc(userId, limit);
    const entry = await getTodayEntry(userId, today);

    // Streak (only check last 60 days)
    const streakStart = new Date(today + 'T12:00:00');
    streakStart.setDate(streakStart.getDate() - 60);
    const entries = await getDailyEntries(userId, streakStart.toLocaleDateString('en-CA'), today);
    const entryDates = new Set(entries.map(e => e.date));
    let streak = 0;
    const todayDate = new Date(today + 'T12:00:00');
    for (let i = 0; i < 60; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (entryDates.has(dateStr)) streak++;
      else if (i > 0) break;
    }

    res.json({
      messages: msgs.map(m => ({
        id: m.id,
        direction: m.direction,
        contentType: m.contentType,
        content: m.rawContent,
        extractedData: m.extractedData,
        timestamp: m.timestamp,
      })),
      currentEntry: entry,
      streak,
    });
  } catch (err) {
    logger.error({ err }, 'Chat history endpoint error');
    res.status(500).json({ error: 'Error cargando historial' });
  }
});

// ── Daily Check-in (web input) ──

router.get('/checkin/today', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const tz = 'America/Argentina/Buenos_Aires';
  const today = getTodayDate(tz);
  res.json(await buildCheckinState(userId, today));
});

router.get('/checkin/:date', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { date } = req.params;
  res.json(await buildCheckinState(userId, date));
});

router.post('/checkin', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const tz = 'America/Argentina/Buenos_Aires';
  const date = (req.body.date as string) || getTodayDate(tz);
  try {
    assertEditableDate(date, tz);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Solo podés modificar hoy y los últimos 3 días' });
  }

  const data: any = {};
  const fields = [
    'sleepQuality', 'bedtime', 'wakeTime', 'sleepNote',
    'mood', 'emotionalState', 'emotionalNote',
    'energyLevel', 'energyNote',
    'exerciseDone', 'exerciseType', 'exerciseDuration', 'exerciseNote',
    'dietQuality', 'dietNote',
    'focusHours', 'tasksCompleted', 'biggestWin', 'productivityNote',
    'dayRating', 'overallScore',
  ];

  for (const f of fields) {
    if (req.body[f] !== undefined && req.body[f] !== null && req.body[f] !== '') {
      data[f] = req.body[f];
    }
  }

  // Calculate overallScore from available metrics
  if (!data.overallScore) {
    let score = 0;
    let count = 0;
    if (data.sleepQuality) { score += data.sleepQuality * 10; count++; }
    if (data.mood) { score += data.mood * 10; count++; }
    if (data.energyLevel) { score += data.energyLevel * 10; count++; }
    if (data.exerciseDone) { score += 80; count++; }
    if (data.dietQuality) { score += data.dietQuality * 10; count++; }
    if (data.dayRating) { score += data.dayRating * 10; count++; }
    if (count > 0) data.overallScore = Math.round(score / count);
  }

  const entry = await upsertDailyEntry(userId, date, data);
  res.json({ ok: true, entry });
});

// ── Habits ──

router.get('/habits', async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const tz = 'America/Argentina/Buenos_Aires';
    const date = String(req.query.date || '') || getTodayDate(tz);
    const result = await getHabitsToday(userId, date);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Error fetching habits');
    res.status(500).json({ error: 'Error al cargar hábitos' });
  }
});

router.post('/habits', async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { name, emoji, category, frequency, isNegative } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const habit = await createHabit({ userId, name, emoji, category, frequency, isNegative: !!isNegative });
    res.json({ ok: true, habit });
  } catch (err) {
    logger.error({ err }, 'Error creating habit');
    res.status(500).json({ error: 'Error al crear hábito' });
  }
});

router.put('/habits/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, emoji, category, frequency, isNegative } = req.body;
    const updateData: Record<string, unknown> = { name, emoji, category, frequency };
    if (isNegative !== undefined) updateData.isNegative = isNegative;
    await updateHabit(id, updateData);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Error updating habit');
    res.status(500).json({ error: 'Error al actualizar hábito' });
  }
});

router.delete('/habits/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await deactivateHabit(id);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Error deleting habit');
    res.status(500).json({ error: 'Error al eliminar hábito' });
  }
});

router.post('/habits/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const habitId = Number(req.params.id);
    const tz = 'America/Argentina/Buenos_Aires';
    const date = (req.body.date as string) || getTodayDate(tz);
    assertEditableDate(date, tz);
    const completed = await toggleHabitLog(habitId, userId, date);
    res.json({ ok: true, completed });
  } catch (err) {
    logger.error({ err }, 'Error toggling habit');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al marcar hábito' });
  }
});

router.get('/habits/:id/calendar', async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const habitId = Number(req.params.id);
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const startDate = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    const habit = await getHabitByIdForUser(habitId, userId);
    if (!habit) return res.status(404).json({ error: 'Hábito no encontrado' });
    const logs = await getHabitLogs(habitId, startDate, endDate);
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const failureDates = logs
      .filter((log) => log.status === 'negative')
      .map((log) => log.date);
    const successDates = habit.isNegative
      ? Array.from({ length: lastDay }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
          .filter((dateStr) => dateStr <= todayStr)
          .filter((dateStr) => !failureDates.includes(dateStr))
      : logs.filter((log) => log.status === 'positive' || log.completed).map((log) => log.date);

    // Calculate streak — single query for last 365 days, computed in memory
    const today = new Date();
    const streakWindowStart = new Date(today);
    streakWindowStart.setDate(streakWindowStart.getDate() - 365);
    const streakWindowStartStr = streakWindowStart.toISOString().split('T')[0];
    const todayStr2 = today.toISOString().split('T')[0];
    const recentLogs = await getHabitLogs(habitId, streakWindowStartStr, todayStr2);
    const completedDatesSet = new Set(recentLogs.filter((log) => log.status === 'positive' || log.completed).map((log) => log.date));
    const failedDatesSet = new Set(recentLogs.filter((log) => log.status === 'negative').map((log) => log.date));

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (habit.isNegative ? !failedDatesSet.has(dateStr) : completedDatesSet.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    const daysPassed = month === today.toISOString().slice(0, 7) ? today.getDate() : lastDay;
    const daysCompleted = successDates.length;
    const completionRate = daysPassed > 0 ? Math.round((daysCompleted / daysPassed) * 100) : 0;

    res.json({
      dates: successDates,
      successDates,
      failureDates,
      streak,
      completionRate,
      daysCompleted,
      totalDays: daysPassed,
    });
  } catch (err) {
    logger.error({ err }, 'Error fetching habit calendar');
    res.status(500).json({ error: 'Error al cargar calendario de hábito' });
  }
});

// ── Study Sessions ──

router.post('/study/sessions', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { method, subject, focusMinutes, breakMinutes, cyclesCompleted, cardsReviewed, quality, note, startedAt, endedAt } = req.body;
  if (!method || !focusMinutes || !startedAt) {
    return res.status(400).json({ error: 'method, focusMinutes, and startedAt are required' });
  }
  const tz = 'America/Argentina/Buenos_Aires';
  const date = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const session = await createStudySession({
    userId, date, method, subject, focusMinutes, breakMinutes, cyclesCompleted, cardsReviewed, quality, note, startedAt, endedAt,
  });
  res.json({ ok: true, session });
});

router.get('/study/sessions', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const range = (req.query.range as string) || 'week';
  const tz = 'America/Argentina/Buenos_Aires';
  const end = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const [y, m, d] = end.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);
  if (range === 'week') startDate.setDate(startDate.getDate() - 7);
  else if (range === 'month') startDate.setMonth(startDate.getMonth() - 1);
  else startDate.setFullYear(startDate.getFullYear() - 1);
  const sessions = await getStudySessions(userId, startDate.toLocaleDateString('en-CA'), end);
  res.json({ sessions });
});

router.get('/study/stats', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const tz = 'America/Argentina/Buenos_Aires';
  const end = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const stats = await getStudyStats(userId, startDate.toLocaleDateString('en-CA'), end);
  res.json(stats);
});

// ── Flashcard Decks ──

router.get('/flashcards/decks', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const decks = await getUserDecks(userId);
  res.json({ decks });
});

router.post('/flashcards/decks', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { name, emoji } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const deck = await createFlashcardDeck({ userId, name, emoji });
  res.json({ ok: true, deck });
});

router.delete('/flashcards/decks/:id', async (req: Request, res: Response) => {
  await deleteFlashcardDeck(Number(req.params.id));
  res.json({ ok: true });
});

router.get('/flashcards/decks/:id/cards', async (req: Request, res: Response) => {
  const cards = await getDeckCards(Number(req.params.id));
  res.json({ cards });
});

router.get('/flashcards/decks/:id/review', async (req: Request, res: Response) => {
  const tz = 'America/Argentina/Buenos_Aires';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const cards = await getCardsForReview(Number(req.params.id), today);
  res.json({ cards });
});

router.post('/flashcards/cards', async (req: Request, res: Response) => {
  const { deckId, front, back } = req.body;
  if (!deckId || !front || !back) return res.status(400).json({ error: 'deckId, front, and back are required' });
  const tz = 'America/Argentina/Buenos_Aires';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const card = await createFlashcard({ deckId, front, back, nextReview: today });
  res.json({ ok: true, card });
});

router.put('/flashcards/cards/:id/review', async (req: Request, res: Response) => {
  const cardId = Number(req.params.id);
  const { quality } = req.body; // 0-5 (SM-2 scale: 0=forgot, 3=hard, 5=easy)
  if (quality == null) return res.status(400).json({ error: 'quality (0-5) required' });

  // Get the card directly by ID
  const { getDb: getDatabase } = await import('../db/client.js');
  const { flashcards: fc } = await import('../db/schema.js');
  const { eq: eqOp } = await import('drizzle-orm');
  const [theCard] = await getDatabase().select().from(fc).where(eqOp(fc.id, cardId)).limit(1);
  if (!theCard) return res.status(404).json({ error: 'Card not found' });

  // SM-2 algorithm
  let ef = theCard.easeFactor ?? 2.5;
  let iv = theCard.interval ?? 0;
  let reps = theCard.repetitions ?? 0;

  if (quality < 3) {
    reps = 0;
    iv = 1;
  } else {
    if (reps === 0) iv = 1;
    else if (reps === 1) iv = 6;
    else iv = Math.round(iv * ef);
    reps++;
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + iv);

  await updateFlashcard(cardId, {
    easeFactor: ef,
    interval: iv,
    repetitions: reps,
    nextReview: nextDate.toISOString().split('T')[0],
  });

  res.json({ ok: true, nextReview: nextDate.toISOString().split('T')[0], interval: iv });
});

router.delete('/flashcards/cards/:id', async (req: Request, res: Response) => {
  await deleteFlashcard(Number(req.params.id));
  res.json({ ok: true });
});

// ── Study Subjects (Spaced Repetition) ──

router.get('/study/subjects', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const subjects = await getUserSubjects(userId);
  res.json({ subjects });
});

router.post('/study/subjects', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const tz = 'America/Argentina/Buenos_Aires';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const subject = await createStudySubject({ userId, name, nextReview: today });
  res.json({ ok: true, subject });
});

router.post('/study/subjects/:id/studied', async (req: Request, res: Response) => {
  const result = await markSubjectStudied(Number(req.params.id));
  if (!result) return res.status(404).json({ error: 'Subject not found' });
  res.json({ ok: true, subject: result });
});

router.delete('/study/subjects/:id', async (req: Request, res: Response) => {
  await deleteStudySubject(Number(req.params.id));
  res.json({ ok: true });
});

// ── Profile & Schedule ──

router.get('/profile', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const sqlite = getSqlite();
  const user = sqlite.prepare('SELECT id, name, username, morning_check_in, evening_check_in, created_at FROM users WHERE id = ?').get(auth.userId) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const stats = sqlite.prepare('SELECT COUNT(*) as entries FROM daily_entries WHERE user_id = ?').get(auth.userId) as any;
  const streak = sqlite.prepare(`
    SELECT COUNT(*) as streak FROM (
      SELECT date FROM daily_entries WHERE user_id = ? ORDER BY date DESC
    )
  `).get(auth.userId) as any;

  res.json({
    name: user.name,
    username: user.username,
    morningCheckIn: user.morning_check_in,
    eveningCheckIn: user.evening_check_in,
    createdAt: user.created_at,
    totalEntries: stats?.entries || 0,
  });
});

// ── Profile Setup (first login) ──

router.post('/profile/setup', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth || auth.isAdmin) return res.status(401).json({ error: 'No autorizado' });

  const { name, phone, email, newPassword, age, height, weight, habits } = req.body;
  if (!name || !newPassword) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }

  try {
    const sqlite = getSqlite();
    const now = new Date().toISOString();

    const fields: string[] = ['name = ?', 'profile_complete = 1', 'updated_at = ?'];
    const values: unknown[] = [name.trim(), now];

    if (phone?.trim()) {
      const cleanPhone = phone.trim();
      const existing = sqlite.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(cleanPhone, auth.userId);
      if (existing) {
        return res.status(409).json({ error: 'Ese número de WhatsApp ya está en uso por otra cuenta' });
      }
      fields.push('phone = ?'); values.push(cleanPhone);
    }
    if (email?.trim()) { fields.push('email = ?'); values.push(email.trim()); }

    values.push(auth.userId);
    sqlite.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    setUserPassword(auth.userId, newPassword);

    // Save physical data to profiles table
    if (age || height || weight) {
      const lifeContext = JSON.stringify({ age: age ?? null, height: height ?? null, weight: weight ?? null });
      const existing = sqlite.prepare('SELECT id FROM profiles WHERE user_id = ?').get(auth.userId);
      if (existing) {
        sqlite.prepare('UPDATE profiles SET life_context = ?, updated_at = ? WHERE user_id = ?').run(lifeContext, now, auth.userId);
      } else {
        sqlite.prepare('INSERT INTO profiles (user_id, life_context, created_at, updated_at) VALUES (?, ?, ?, ?)').run(auth.userId, lifeContext, now, now);
      }
    }

    // Create initial habits
    if (Array.isArray(habits) && habits.length > 0) {
      for (const habit of habits as Array<{ name: string; emoji?: string; category?: string }>) {
        if (habit.name) {
          sqlite.prepare(
            'INSERT INTO habits (user_id, name, emoji, category, frequency, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
          ).run(auth.userId, habit.name, habit.emoji ?? null, habit.category ?? null, 'daily', now, now);
        }
      }
    }

    // Return new token with profileComplete: true
    const user = sqlite.prepare('SELECT phone FROM users WHERE id = ?').get(auth.userId) as { phone: string };
    const newToken = generateUserToken(auth.userId, user.phone, true);

    res.json({ ok: true, token: newToken });
  } catch (err: unknown) {
    logger.error({ err: err instanceof Error ? err.message : err }, 'Profile setup error');
    res.status(500).json({ error: 'Error al guardar el perfil' });
  }
});

router.put('/profile/schedule', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const { morningCheckIn, eveningCheckIn } = req.body;
  const sqlite = getSqlite();

  const fields: string[] = [];
  const values: any[] = [];
  if (morningCheckIn) { fields.push('morning_check_in = ?'); values.push(morningCheckIn); }
  if (eveningCheckIn) { fields.push('evening_check_in = ?'); values.push(eveningCheckIn); }

  if (fields.length > 0) {
    values.push(auth.userId);
    sqlite.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json({ ok: true });
});

// ── Day Detail (Diary) ──

router.get('/day/:date', async (req: Request, res: Response) => {
  try {
    // Disable ALL caching for this endpoint
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
    if (!auth) return res.status(401).json({ error: 'No autorizado' });

    const { date } = req.params; // YYYY-MM-DD
    const sqlite = getSqlite();
    if (!sqlite) return res.status(500).json({ error: 'DB not ready' });

    // Daily entry
    const entry = sqlite.prepare('SELECT * FROM daily_entries WHERE user_id = ? AND date = ?').get(auth.userId, date) as any;

    // Messages for that day — adjust for Argentina timezone (UTC-3)
    // A day in Argentina (e.g. 2026-03-16) runs from 2026-03-16T03:00:00Z to 2026-03-17T02:59:59.999Z in UTC
    let messages: any[] = [];
    try {
      // Calculate next day for the upper bound
      const [y, m, d] = date.split('-').map(Number);
      const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
      const nextDayStr = nextDay.toISOString().slice(0, 10);

      messages = sqlite.prepare(`
        SELECT id, direction, content_type, raw_content, timestamp FROM messages
        WHERE user_id = ? AND timestamp >= ? AND timestamp < ?
        ORDER BY timestamp ASC
      `).all(auth.userId, `${date}T03:00:00Z`, `${nextDayStr}T03:00:00Z`) as any[];
    } catch (err) {
      logger.error({ err, date }, 'Error fetching messages for diary');
    }

    // All active habits for the user, with completion status for this day (LEFT JOIN)
    let habitsWithStatus: any[] = [];
    try {
      habitsWithStatus = sqlite.prepare(`
        SELECT h.id AS habit_id, h.name, h.emoji, h.frequency, h.category, COALESCE(h.is_negative, 0) AS is_negative,
               COALESCE(hl.completed, 0) AS completed, COALESCE(hl.status, CASE WHEN hl.completed = 1 THEN 'positive' ELSE 'clear' END) AS status
        FROM habits h
        LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ? AND hl.user_id = ?
        WHERE h.user_id = ? AND h.active = 1
        ORDER BY h.created_at ASC
      `).all(date, auth.userId, auth.userId) as any[];
    } catch (err) {
      logger.error({ err, date }, 'Error fetching habits for diary');
    }

    // Active goals for the user (always show, not just goal_logs)
    let activeGoals: any[] = [];
    try {
      activeGoals = sqlite.prepare(`
        SELECT id, title, category, current_value, target_value, unit
        FROM goals
        WHERE user_id = ? AND status = 'active'
        ORDER BY priority ASC, created_at ASC
      `).all(auth.userId) as any[];
    } catch (err) {
      logger.error({ err, date }, 'Error fetching goals for diary');
    }

    // Study sessions for that day
    let studySessions: any[] = [];
    try {
      studySessions = sqlite.prepare(`
        SELECT id, method, subject, focus_minutes, break_minutes, cycles_completed, quality, started_at, ended_at
        FROM study_sessions
        WHERE user_id = ? AND date = ?
        ORDER BY started_at ASC
      `).all(auth.userId, date) as any[];
    } catch (err) {
      logger.error({ err, date }, 'Error fetching study sessions for diary');
    }

    let competitionHabits: any[] = [];
    try {
      competitionHabits = getCompetitionHabitsForDiary(auth.userId, date);
    } catch (err) {
      logger.error({ err, date }, 'Error fetching competition habits for diary');
    }

    const canEdit = (() => {
      try {
        assertEditableDate(date, 'America/Argentina/Buenos_Aires');
        return true;
      } catch {
        return false;
      }
    })();

    res.json({
      date,
      canEdit,
      editableWindowDays: 3,
      entry: buildCheckinPayload(entry),
      messages: messages.map(m => ({
        id: m.id,
        direction: m.direction === 'in' ? 'in' as const : 'out' as const,
        contentType: m.content_type || 'text',
        content: m.raw_content,
        timestamp: m.timestamp,
      })),
      habits: habitsWithStatus.map(h => ({
        id: h.habit_id,
        name: h.name,
        emoji: h.emoji || null,
        category: h.category || null,
        isNegative: !!h.is_negative,
        status: h.status || (h.completed ? 'positive' : 'clear'),
        completed: h.is_negative ? (h.status || 'clear') !== 'negative' : !!h.completed,
      })),
      competitionHabits: competitionHabits.map((habit) => ({
        competitionId: habit.competitionId,
        competitionName: habit.competitionName,
        habitId: habit.habitId,
        name: habit.name,
        description: habit.description,
        category: habit.category,
        scoringMode: habit.scoringMode,
        pointsPositive: habit.pointsPositive,
        pointsNegative: habit.pointsNegative,
        linkedPersonalHabitId: habit.linkedPersonalHabitId,
        status: habit.status,
      })),
      goals: activeGoals.map(g => {
        const current = parseFloat(g.current_value) || 0;
        const target = parseFloat(g.target_value) || 1;
        const progress = Math.min(Math.round((current / target) * 100), 100);
        return {
          id: g.id,
          title: g.title,
          category: g.category,
          currentValue: g.current_value,
          targetValue: g.target_value,
          unit: g.unit,
          progress,
        };
      }),
      studySessions: studySessions.map(s => ({
        id: s.id,
        method: s.method,
        subject: s.subject || null,
        focusMinutes: s.focus_minutes,
        breakMinutes: s.break_minutes || null,
        cyclesCompleted: s.cycles_completed || null,
        quality: s.quality,
        startedAt: s.started_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Error in /day/:date');
    res.status(500).json({ error: 'Error loading day data' });
  }
});

// ── Profile Update ──

router.put('/profile', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const { name, username } = req.body;
  const sqlite = getSqlite();

  if (name && typeof name === 'string' && name.trim().length > 0) {
    sqlite.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), auth.userId);
  }

  if (username !== undefined) {
    const { normalized, error } = validateUsernameFormat(String(username || ''));
    if (error) return res.status(400).json({ error });
    const existing = sqlite.prepare('SELECT id FROM users WHERE lower(username) = ? AND id != ?').get(normalized, auth.userId);
    if (existing) {
      return res.status(409).json({ error: 'Ese username ya está en uso' });
    }
    sqlite.prepare('UPDATE users SET username = ? WHERE id = ?').run(normalized, auth.userId);
  }

  res.json({ ok: true });
});

router.get('/profile/username-availability', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const { normalized, error } = validateUsernameFormat(String(req.query.username || ''));
  if (error) {
    return res.status(400).json({ available: false, normalized, message: error });
  }

  const sqlite = getSqlite();
  const existing = sqlite.prepare('SELECT id FROM users WHERE lower(username) = ? AND id != ?').get(normalized, auth.userId);
  if (existing) {
    return res.json({ available: false, normalized, message: 'Ese username ya est?? en uso' });
  }

  res.json({ available: true, normalized, message: 'Username disponible' });
});

// ── Data Reset ──

router.delete('/data/reset', async (req: Request, res: Response) => {
  const auth = verifyJwt(req.headers.authorization?.replace('Bearer ', '') || '');
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const { confirm } = req.body;
  if (confirm !== 'BORRAR TODO') return res.status(400).json({ error: 'Confirmacion requerida' });

  const sqlite = getSqlite();
  sqlite.prepare('DELETE FROM messages WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM goal_logs WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM daily_entries WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM patterns WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM reports WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM sent_checkins WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM habit_logs WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM habits WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM goals WHERE user_id = ?').run(auth.userId);
  sqlite.prepare('DELETE FROM study_sessions WHERE user_id = ?').run(auth.userId);

  res.json({ ok: true, message: 'Todos los datos fueron borrados' });
});

// ── Calendar API ──

router.get('/calendar/connect', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { getAuthUrl } = await import('../calendar/gcal.js');
  const authUrl = getAuthUrl(userId);
  res.json({ authUrl });
});

router.get('/calendar/status', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { getCalendarTokens } = await import('../db/repository.js');
  const tokens = await getCalendarTokens(userId);
  res.json({ connected: !!tokens });
});

router.get('/calendar/events', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { getCalendarTokens } = await import('../db/repository.js');
  const { listEvents } = await import('../calendar/gcal.js');
  const tokens = await getCalendarTokens(userId);
  if (!tokens) return res.status(403).json({ error: 'Calendario no conectado' });

  const tz = 'America/Argentina/Buenos_Aires';
  const dateParam = req.query.date as string | undefined;
  const days = Number(req.query.days || '14');
  const startStr = dateParam || new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  const events = await listEvents(tokens, start.toISOString(), end.toISOString(), 30);
  res.json({ events });
});

router.post('/calendar/events', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { getCalendarTokens } = await import('../db/repository.js');
  const { createEvent } = await import('../calendar/gcal.js');
  const tokens = await getCalendarTokens(userId);
  if (!tokens) return res.status(403).json({ error: 'Calendario no conectado' });

  const { summary, date, time, endTime, description, allDay } = req.body;
  if (!summary || !date) return res.status(400).json({ error: 'Título y fecha requeridos' });

  const isAllDay = allDay || !time;
  const startIso = isAllDay ? date : `${date}T${time}:00`;
  const endIso = !isAllDay && endTime ? `${date}T${endTime}:00` : undefined;

  const event = await createEvent(tokens, { summary, description, start: startIso, end: endIso, allDay: isAllDay });
  res.json({ ok: true, event });
});

router.delete('/calendar/events/:id', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { getCalendarTokens } = await import('../db/repository.js');
  const { deleteEvent } = await import('../calendar/gcal.js');
  const tokens = await getCalendarTokens(userId);
  if (!tokens) return res.status(403).json({ error: 'Calendario no conectado' });

  await deleteEvent(tokens, decodeURIComponent(req.params.id));
  res.json({ ok: true });
});

router.post('/calendar/chat', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { text, date, history } = req.body as { text?: string; date?: string; history?: { role: string; content: string }[] };

  if (!text?.trim()) return res.status(400).json({ error: 'Texto requerido' });

  const tz = 'America/Argentina/Buenos_Aires';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const targetDate = date || today;

  try {
    const sqlite = getSqlite();
    if (!sqlite) return res.status(500).json({ error: 'DB not ready' });

    // Build diary context for the target date
    const entry = sqlite.prepare('SELECT * FROM daily_entries WHERE user_id = ? AND date = ?').get(userId, targetDate) as any;

    const habitsWithStatus = sqlite.prepare(`
      SELECT h.name, h.emoji, COALESCE(hl.completed, 0) AS completed
      FROM habits h
      LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ? AND hl.user_id = ?
      WHERE h.user_id = ? AND h.active = 1
    `).all(targetDate, userId, userId) as any[];

    // Build calendar context for ±3 days around targetDate
    let calendarSection = 'Calendario: no conectado o sin eventos.';
    try {
      const { getCalendarTokens } = await import('../db/repository.js');
      const { listEvents } = await import('../calendar/gcal.js');
      const tokens = await getCalendarTokens(userId);
      if (tokens) {
        const [y, m, d] = targetDate.split('-').map(Number);
        const windowStart = new Date(Date.UTC(y, m - 1, d - 3));
        const windowEnd = new Date(Date.UTC(y, m - 1, d + 4));
        const events = await listEvents(tokens, windowStart.toISOString(), windowEnd.toISOString(), 20);
        if (events.length > 0) {
          calendarSection = 'EVENTOS DEL CALENDARIO (±3 días respecto a la fecha consultada):\n' +
            events.map(e => {
              const when = e.allDay
                ? `${e.start.slice(0, 10)} (todo el día)`
                : `${e.start.slice(0, 16).replace('T', ' ')}`;
              return `- ${when}: ${e.summary}`;
            }).join('\n');
        } else {
          calendarSection = 'Calendario: sin eventos en el período consultado.';
        }
      }
    } catch (calErr) {
      logger.error({ calErr }, 'calendar/chat: error fetching calendar events');
    }

    // Build diary section
    let diarySection = `DIARIO DEL ${targetDate}:\n`;
    if (entry) {
      const parts: string[] = [];
      if (entry.mood != null) parts.push(`Ánimo: ${entry.mood}/10`);
      if (entry.energy_level != null) parts.push(`Energía: ${entry.energy_level}/10`);
      if (entry.sleep_quality != null) parts.push(`Sueño: ${entry.sleep_quality}/10`);
      if (entry.focus_hours != null) parts.push(`Foco: ${entry.focus_hours}hs`);
      if (entry.exercise_done) parts.push(`Ejercicio: ${entry.exercise_type || 'sí'}`);
      if (entry.biggest_win) parts.push(`Mayor logro: ${entry.biggest_win}`);
      diarySection += parts.length > 0 ? parts.join(', ') : 'Sin métricas registradas.';
    } else {
      diarySection += 'Sin datos registrados para este día.';
    }

    const completedHabits = habitsWithStatus.filter(h => h.completed).map(h => `${h.emoji || ''} ${h.name}`.trim());
    const pendingHabits = habitsWithStatus.filter(h => !h.completed).map(h => `${h.emoji || ''} ${h.name}`.trim());
    if (completedHabits.length > 0) diarySection += `\nHábitos completados: ${completedHabits.join(', ')}`;
    if (pendingHabits.length > 0) diarySection += `\nHábitos pendientes: ${pendingHabits.join(', ')}`;

    const context = `FECHA CONSULTADA: ${targetDate}\n${calendarSection}\n\n${diarySection}`;

    const result: CalendarChatResult = await generateCalendarChatResponse(text.trim(), context, history);

    if (result.type === 'create_event' && result.eventData) {
      try {
        const { getCalendarTokens: getTokens2 } = await import('../db/repository.js');
        const { createEvent } = await import('../calendar/gcal.js');
        const tokens2 = await getTokens2(userId);
        if (tokens2) {
          const { summary, date: evDate, time: evTime, endTime: evEndTime, allDay } = result.eventData;
          const isAllDay = allDay || !evTime;
          const startIso = isAllDay ? evDate : `${evDate}T${evTime}:00`;
          const endIso = !isAllDay && evEndTime ? `${evDate}T${evEndTime}:00` : undefined;
          await createEvent(tokens2, { summary, start: startIso, end: endIso, allDay: isAllDay });
          return res.json({ response: result.text, eventCreated: true });
        } else {
          return res.json({ response: 'Quiero agendarlo pero no tenés el calendario conectado. Conectalo desde la sección Agenda.', eventCreated: false });
        }
      } catch (createErr) {
        logger.error({ createErr }, 'calendar/chat: error creating event');
        return res.json({ response: 'Intenté agendar el evento pero hubo un error. Podés crearlo manualmente.', eventCreated: false });
      }
    }

    res.json({ response: result.text });
  } catch (err) {
    logger.error({ err }, 'POST /calendar/chat error');
    res.status(500).json({ error: 'Error al procesar mensaje' });
  }
});

export { router };
