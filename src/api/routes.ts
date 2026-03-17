import { Router, Request, Response } from 'express';
import multer from 'multer';
import { verifyJwt, loginWithPassword } from './auth.js';
import { getSqlite } from '../db/client.js';
import { extractData } from '../ai/extractor.js';
import { generateCoachResponse } from '../ai/coach.js';
import { transcribeAudio } from '../ai/transcriber.js';
import { trackExtraction } from '../engine/tracker.js';
import { logger } from '../utils/logger.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
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
} from '../db/repository.js';

const router = Router();

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

// ── Auth routes (public) ──

router.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const jwt = await loginWithPassword(username.trim(), password);
  if (!jwt) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  res.json({ ok: true, token: jwt });
});

// ── Protected routes ──

router.use(authMiddleware);

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
router.get('/metrics', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const range = (req.query.range as string) || 'week';
  const tz = 'America/Argentina/Buenos_Aires';
  const end = new Date().toLocaleDateString('en-CA', { timeZone: tz });

  const [y, m, d] = end.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);
  if (range === 'week') startDate.setDate(startDate.getDate() - 7);
  else if (range === 'month') startDate.setMonth(startDate.getMonth() - 1);
  else if (range === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
  const start = startDate.toLocaleDateString('en-CA');

  const entries = await getDailyEntries(userId, start, end);

  res.json({
    range,
    start,
    end,
    entries: entries.map((e) => ({
      date: e.date,
      sleepQuality: e.sleepQuality,
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

    // Log incoming message
    const inMsg = await logMessage({
      userId,
      direction: 'in',
      contentType: req.file ? 'audio' : 'text',
      rawContent: text,
      timestamp: new Date().toISOString(),
    });

    // Get context for extraction and coaching
    const userGoals = await getActiveGoals(userId);
    const todayEntry = await getTodayEntry(userId, today);
    const activePatterns = await getActivePatterns(userId);

    // Extract structured data from natural language
    const goalsForExtraction = userGoals.map(g => ({
      id: g.id, title: g.title, category: g.category,
      metric: g.metric, unit: g.unit,
    }));
    const extraction = await extractData(text, goalsForExtraction, todayEntry as Record<string, unknown> | null);

    // Track extraction (merge into daily entry)
    await trackExtraction(userId, tz, extraction, inMsg.id);

    // Build conversation history for coaching
    const recentMsgs = await getRecentMessagesAsc(userId, 10);
    const history = recentMsgs.map(m => ({
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: m.rawContent || '',
    }));

    // Generate coaching response
    const goalsForCoach = userGoals.map(g => ({
      id: g.id, title: g.title, category: g.category,
      currentValue: g.currentValue, targetValue: g.targetValue, unit: g.unit,
    }));
    const patternsForCoach = activePatterns.map(p => ({ description: p.description }));
    const response = await generateCoachResponse(text, extraction as Record<string, unknown>, goalsForCoach, patternsForCoach, history);

    // Log outgoing message
    await logMessage({
      userId,
      direction: 'out',
      contentType: 'text',
      rawContent: response,
      extractedData: extraction as any,
      timestamp: new Date().toISOString(),
    });

    // Get updated entry and calculate streak
    const updatedEntry = await getTodayEntry(userId, today);
    const entries = await getDailyEntries(userId, '2020-01-01', today);
    const entryDates = new Set(entries.map(e => e.date));
    let streak = 0;
    const todayDate = new Date(today + 'T12:00:00');
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (entryDates.has(dateStr)) streak++;
      else if (i > 0) break;
    }

    res.json({
      response,
      extractedData: extraction,
      currentEntry: updatedEntry,
      streak,
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

    // Streak
    const entries = await getDailyEntries(userId, '2020-01-01', today);
    const entryDates = new Set(entries.map(e => e.date));
    let streak = 0;
    const todayDate = new Date(today + 'T12:00:00');
    for (let i = 0; i < 365; i++) {
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
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const entry = await getTodayEntry(userId, today);

  // Calculate check-in streak (consecutive days with entries)
  const entries = await getDailyEntries(userId, '2020-01-01', today);
  const entryDates = new Set(entries.map(e => e.date));
  let streak = 0;
  const todayDate = new Date(today + 'T12:00:00');
  for (let i = 0; i < 365; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (entryDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  res.json({ date: today, entry, streak });
});

router.post('/checkin', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const tz = 'America/Argentina/Buenos_Aires';
  const date = (req.body.date as string) || new Date().toLocaleDateString('en-CA', { timeZone: tz });

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
  const { userId } = (req as any).user;
  const tz = 'America/Argentina/Buenos_Aires';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const result = await getHabitsToday(userId, today);
  res.json(result);
});

router.post('/habits', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { name, emoji, category, frequency } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const habit = await createHabit({ userId, name, emoji, category, frequency });
  res.json({ ok: true, habit });
});

router.put('/habits/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, emoji, category, frequency } = req.body;
  await updateHabit(id, { name, emoji, category, frequency });
  res.json({ ok: true });
});

router.delete('/habits/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deactivateHabit(id);
  res.json({ ok: true });
});

router.post('/habits/:id/toggle', async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const habitId = Number(req.params.id);
  const tz = 'America/Argentina/Buenos_Aires';
  const date = (req.body.date as string) || new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const completed = await toggleHabitLog(habitId, userId, date);
  res.json({ ok: true, completed });
});

router.get('/habits/:id/calendar', async (req: Request, res: Response) => {
  const habitId = Number(req.params.id);
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const startDate = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
  const logs = await getHabitLogs(habitId, startDate, endDate);
  const dates = logs.filter(l => l.completed).map(l => l.date);

  // Calculate streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const allLogs = await getHabitLogs(habitId, dateStr, dateStr);
    if (allLogs.some(l => l.completed)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const daysInMonth = dates.length;
  const daysPassed = month === today.toISOString().slice(0, 7) ? today.getDate() : lastDay;
  const completionRate = daysPassed > 0 ? Math.round((daysInMonth / daysPassed) * 100) : 0;

  res.json({ dates, streak, completionRate, daysCompleted: daysInMonth, totalDays: daysPassed });
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

  // Get the card
  const allCards = await getDeckCards(0).catch(() => []);
  // Fetch card by getting all deck cards is wasteful — use getDb directly
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
  const user = sqlite.prepare('SELECT id, name, morning_check_in, evening_check_in, created_at FROM users WHERE id = ?').get(auth.userId) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const stats = sqlite.prepare('SELECT COUNT(*) as entries FROM daily_entries WHERE user_id = ?').get(auth.userId) as any;
  const streak = sqlite.prepare(`
    SELECT COUNT(*) as streak FROM (
      SELECT date FROM daily_entries WHERE user_id = ? ORDER BY date DESC
    )
  `).get(auth.userId) as any;

  res.json({
    name: user.name,
    morningCheckIn: user.morning_check_in,
    eveningCheckIn: user.evening_check_in,
    createdAt: user.created_at,
    totalEntries: stats?.entries || 0,
  });
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
        SELECT h.id AS habit_id, h.name, h.emoji, h.frequency,
               COALESCE(hl.completed, 0) AS completed
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

    res.json({
      date,
      entry: entry ? {
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
        procrastination: !!entry.procrastination,
        socialEvent: entry.social_event,
        vicesDetails: entry.vices_details,
      } : null,
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
        completed: !!h.completed,
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

  const { name } = req.body;
  const sqlite = getSqlite();

  if (name && typeof name === 'string' && name.trim().length > 0) {
    sqlite.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), auth.userId);
  }

  res.json({ ok: true });
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

export { router };
