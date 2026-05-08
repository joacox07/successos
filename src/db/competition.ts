import { getSqlite } from './client.js';
import { assertEditableDate } from '../utils/dates.js';

export type CompetitionRange = 'week' | 'month' | 'total';
export type CompetitionLogStatus = 'positive' | 'negative' | 'clear';
export type CompetitionScoringMode = 'positive_only' | 'negative_only' | 'both';
export type CompetitionHabitKind = 'event' | 'duration';
export type CompetitionInviteSearchStatus =
  | 'found'
  | 'not_found'
  | 'self'
  | 'already_invited'
  | 'already_participant';

export interface CompetitionSummaryRow {
  id: number;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  acceptedCount: number;
  pendingCount: number;
  role: string | null;
  inviteStatus: string | null;
}

export interface CompetitionParticipantRow {
  userId: number;
  name: string | null;
  username: string | null;
  role: string;
  inviteStatus: string;
  joinedAt: string | null;
}

export interface CompetitionHabitRow {
  id: number;
  competitionId: number;
  name: string;
  description: string | null;
  category: string | null;
  kind: CompetitionHabitKind;
  scoringMode: CompetitionScoringMode;
  pointsPositive: number;
  pointsNegative: number;
  minutesPerBlock: number | null;
  pointsPerBlock: number | null;
  dailyTargetMinutes: number | null;
  active: number;
  linkedPersonalHabitId?: number | null;
  todayStatus?: CompetitionLogStatus;
  todayMinutes?: number;
  todayPoints?: number;
  syncState?: 'linked' | 'suggested_match' | 'create_in_profile';
  suggestedPersonalHabitId?: number | null;
  suggestedPersonalHabitName?: string | null;
}

export interface CompetitionLeaderboardRow {
  userId: number;
  name: string;
  username: string | null;
  points: number;
  positiveDays: number;
  negativeDays: number;
  completionRate: number;
  currentStreak: number;
  bestStreak: number;
}

export interface CompetitionInviteSearchResult {
  status: CompetitionInviteSearchStatus;
  message: string;
  user: { id: number; name: string | null; username: string | null } | null;
  canInvite: boolean;
}

export interface CompetitionInviteCandidateRow {
  id: number;
  name: string | null;
  username: string | null;
  status: 'invitable' | 'self' | 'pending' | 'accepted';
  message: string;
  canInvite: boolean;
}

export interface CompetitionTimelineParticipantPoint {
  userId: number;
  name: string;
  username: string | null;
  points: number;
  cumulativePoints: number;
}

export interface CompetitionTimelineRow {
  date: string;
  positiveCount: number;
  negativeCount: number;
  clearCount: number;
  netPoints: number;
  participants: CompetitionTimelineParticipantPoint[];
}

export interface CompetitionHabitParticipantRow extends CompetitionLeaderboardRow {
  linkedPersonalHabitId: number | null;
  minutesLogged: number;
}

export interface CompetitionHabitAnalyticsRow {
  habitId: number;
  name: string;
  description: string | null;
  category: string | null;
  kind: CompetitionHabitKind;
  scoringMode: CompetitionScoringMode;
  pointsPositive: number;
  pointsNegative: number;
  minutesPerBlock: number | null;
  pointsPerBlock: number | null;
  dailyTargetMinutes: number | null;
  positiveCount: number;
  negativeCount: number;
  completionRate: number;
  netPoints: number;
  totalMinutes: number;
  participants: CompetitionHabitParticipantRow[];
  timeline: Array<{
    date: string;
    positiveCount: number;
    negativeCount: number;
    clearCount: number;
    netPoints: number;
    minutesLogged: number;
  }>;
}

export interface CompetitionParticipantHabitBreakdown {
  habitId: number;
  habitName: string;
  kind: CompetitionHabitKind;
  scoringMode: CompetitionScoringMode;
  pointsPositive: number;
  pointsNegative: number;
  minutesPerBlock: number | null;
  pointsPerBlock: number | null;
  points: number;
  positiveDays: number;
  negativeDays: number;
  completionRate: number;
  currentStreak: number;
  bestStreak: number;
  totalMinutes: number;
}

export interface CompetitionParticipantAnalyticsRow extends CompetitionLeaderboardRow {
  rank: number;
  pointsDiffToLeader: number;
  habitBreakdown: CompetitionParticipantHabitBreakdown[];
  cumulativePoints: Array<{ date: string; value: number }>;
}

export interface CompetitionDashboardStats {
  range: CompetitionRange;
  summary: {
    activeParticipants: number;
    pendingParticipants: number;
    habitCount: number;
    totalPoints: number;
    averageCompletionRate: number;
    positiveCount: number;
    negativeCount: number;
    leaderUserId: number | null;
    leaderName: string | null;
    leaderUsername: string | null;
    leaderPoints: number;
  };
  leaderboard: CompetitionLeaderboardRow[];
  habits: CompetitionHabitAnalyticsRow[];
  participants: CompetitionParticipantAnalyticsRow[];
  timeline: CompetitionTimelineRow[];
}

interface CompetitionLogRow {
  date: string;
  status: CompetitionLogStatus;
  minutesLogged: number;
}

interface CompetitionMetaRow {
  id: number;
  name: string;
  status: string;
  createdByMode: string;
  createdAt: string;
  updatedAt: string;
}

function sqliteOrThrow() {
  const sqlite = getSqlite();
  if (!sqlite) throw new Error('DB not ready');
  return sqlite;
}

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase();
}

function getTodayDate(tz = 'America/Argentina/Buenos_Aires') {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

function normalizeHabitName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateUTC(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getDateWindow(range: CompetitionRange, competitionCreatedAt: string, tz = 'America/Argentina/Buenos_Aires') {
  const today = parseDateUTC(getTodayDate(tz));
  const created = parseDateUTC(competitionCreatedAt.slice(0, 10));
  let start = created;
  if (range === 'week') {
    start = addUtcDays(today, -6);
  } else if (range === 'month') {
    start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  }
  if (start.getTime() < created.getTime()) start = created;
  return {
    start: toDateKey(start),
    end: toDateKey(today),
  };
}

function enumerateDates(startDate: string, endDate: string) {
  const start = parseDateUTC(startDate);
  const end = parseDateUTC(endDate);
  const dates: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addUtcDays(cursor, 1)) {
    dates.push(toDateKey(cursor));
  }
  return dates;
}

function pointsForEvent(mode: CompetitionScoringMode, positive: number, negative: number, status: CompetitionLogStatus) {
  if (status === 'clear') return 0;
  if (status === 'positive') {
    if (mode === 'negative_only') return 0;
    return positive;
  }
  if (mode === 'positive_only') return 0;
  return -Math.abs(negative);
}

function isAvoidanceScoring(mode: CompetitionScoringMode) {
  return mode === 'negative_only' || mode === 'both';
}

function effectiveEventStatus(
  habit: Pick<CompetitionHabitRow, 'kind' | 'scoringMode'>,
  status: CompetitionLogStatus,
  date?: string,
): CompetitionLogStatus {
  if (habit.kind !== 'event') return status;
  if (status === 'clear' && isAvoidanceScoring(habit.scoringMode)) {
    if (!date) return status;
    const today = parseDateUTC(getTodayDate());
    const target = parseDateUTC(date);
    if (target.getTime() < today.getTime()) return 'positive';
  }
  return status;
}

function normalizeCompetitionKind(value?: string | null): CompetitionHabitKind {
  return value === 'duration' ? 'duration' : 'event';
}

function pointsForDuration(totalMinutes: number, minutesPerBlock: number | null, pointsPerBlock: number | null) {
  const blockMinutes = Math.max(1, minutesPerBlock ?? 0);
  const blockPoints = Math.max(0, pointsPerBlock ?? 0);
  return Math.floor(Math.max(0, totalMinutes) / blockMinutes) * blockPoints;
}

function statusFromPersonalRow(row?: { status?: string | null; completed?: number | null } | undefined): CompetitionLogStatus {
  if (!row) return 'clear';
  if (row.status === 'negative') return 'negative';
  if (row.completed === 1 || row.status === 'positive') return 'positive';
  return 'clear';
}

function sortLeaderboard(rows: CompetitionLeaderboardRow[]) {
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.positiveDays !== a.positiveDays) return b.positiveDays - a.positiveDays;
    return (a.username || '').localeCompare(b.username || '');
  });
}

function ensureCompetitionAccess(competitionId: number, viewerUserId: number | null, isAdmin: boolean) {
  if (isAdmin) return;
  if (!viewerUserId) throw new Error('No autorizado');
  const sqlite = sqliteOrThrow();
  const row = sqlite.prepare(
    `SELECT invite_status FROM competition_participants WHERE competition_id = ? AND user_id = ?`
  ).get(competitionId, viewerUserId) as { invite_status?: string } | undefined;
  if (!row || row.invite_status !== 'accepted') {
    throw new Error('No autorizado');
  }
}

function ensureCompetitionOwner(competitionId: number, viewerUserId: number | null, isAdmin: boolean) {
  if (isAdmin) return;
  if (!viewerUserId) throw new Error('No autorizado');
  const sqlite = sqliteOrThrow();
  const row = sqlite.prepare(
    `SELECT role, invite_status FROM competition_participants WHERE competition_id = ? AND user_id = ?`
  ).get(competitionId, viewerUserId) as { role?: string; invite_status?: string } | undefined;
  if (!row || row.invite_status !== 'accepted' || row.role !== 'owner') {
    throw new Error('No autorizado');
  }
}

function getCompetitionMeta(competitionId: number) {
  const sqlite = sqliteOrThrow();
  return sqlite.prepare(
    `SELECT id, name, status, created_by_mode as createdByMode, created_at as createdAt, updated_at as updatedAt
     FROM habit_competitions
     WHERE id = ?
     LIMIT 1`
  ).get(competitionId) as CompetitionMetaRow | undefined;
}

export function findDiscoverableUserByUsername(username: string, excludeUserId?: number) {
  const sqlite = sqliteOrThrow();
  const normalized = normalizeUsername(username);
  const row = sqlite.prepare(
    `SELECT id, name, username FROM users WHERE lower(username) = ? ${excludeUserId ? 'AND id != ?' : ''} LIMIT 1`
  ).get(...(excludeUserId ? [normalized, excludeUserId] : [normalized])) as
    | { id: number; name: string | null; username: string | null }
    | undefined;
  return row ?? null;
}

export function discoverCompetitionInviteTarget(input: {
  competitionId: number;
  actorUserId: number | null;
  actorIsAdmin: boolean;
  username: string;
}): CompetitionInviteSearchResult {
  ensureCompetitionOwner(input.competitionId, input.actorUserId, input.actorIsAdmin);
  const normalized = normalizeUsername(input.username);
  const sqlite = sqliteOrThrow();
  const target = sqlite.prepare(
    `SELECT id, name, username FROM users WHERE lower(username) = ? LIMIT 1`
  ).get(normalized) as { id: number; name: string | null; username: string | null } | undefined;

  if (!target) {
    return {
      status: 'not_found',
      message: 'No existe un usuario con ese @username.',
      user: null,
      canInvite: false,
    };
  }

  if (input.actorUserId && target.id === input.actorUserId) {
    return {
      status: 'self',
      message: 'No podés invitarte a vos mismo.',
      user: target,
      canInvite: false,
    };
  }

  const existing = sqlite.prepare(
    `SELECT invite_status FROM competition_participants WHERE competition_id = ? AND user_id = ?`
  ).get(input.competitionId, target.id) as { invite_status?: string } | undefined;

  if (existing?.invite_status === 'pending') {
    return {
      status: 'already_invited',
      message: 'Ese usuario ya tiene una invitación pendiente.',
      user: target,
      canInvite: false,
    };
  }

  if (existing?.invite_status === 'accepted') {
    return {
      status: 'already_participant',
      message: 'Ese usuario ya participa en esta competencia.',
      user: target,
      canInvite: false,
    };
  }

  return {
    status: 'found',
    message: 'Usuario encontrado. Podés enviarlo a esta competencia.',
    user: target,
    canInvite: true,
  };
}

export function listCompetitionInviteCandidates(input: {
  competitionId: number;
  actorUserId: number | null;
  actorIsAdmin: boolean;
  limit?: number;
}) {
  ensureCompetitionOwner(input.competitionId, input.actorUserId, input.actorIsAdmin);
  const sqlite = sqliteOrThrow();
  const rows = sqlite.prepare(
    `SELECT u.id, u.name, u.username, cp.invite_status as inviteStatus
     FROM users u
     LEFT JOIN competition_participants cp
       ON cp.user_id = u.id AND cp.competition_id = ?
     WHERE ((u.username IS NOT NULL AND trim(u.username) <> '') OR u.id = ? OR cp.invite_status IS NOT NULL)
     ORDER BY lower(COALESCE(u.username, u.name, 'zzzzzz')) ASC
     LIMIT ?`
  ).all(input.competitionId, input.actorUserId ?? -1, Math.max(1, Math.min(input.limit ?? 12, 50))) as Array<{
    id: number;
    name: string | null;
    username: string | null;
    inviteStatus?: string | null;
  }>;

  const candidates: CompetitionInviteCandidateRow[] = rows.map((row) => {
    if (input.actorUserId && row.id === input.actorUserId) {
      return {
        id: row.id,
        name: row.name,
        username: row.username,
        status: 'self',
        message: 'Sos vos.',
        canInvite: false,
      };
    }
    if (row.inviteStatus === 'pending') {
      return {
        id: row.id,
        name: row.name,
        username: row.username,
        status: 'pending',
        message: 'Invitación pendiente.',
        canInvite: false,
      };
    }
    if (row.inviteStatus === 'accepted') {
      return {
        id: row.id,
        name: row.name,
        username: row.username,
        status: 'accepted',
        message: 'Ya participa.',
        canInvite: false,
      };
    }
    return {
      id: row.id,
      name: row.name,
      username: row.username,
      status: 'invitable',
      message: 'Disponible para invitar.',
      canInvite: true,
    };
  });

  candidates.sort((a, b) => {
    const statusOrder = { invitable: 0, pending: 1, accepted: 2, self: 3 } as const;
    const diff = statusOrder[a.status] - statusOrder[b.status];
    if (diff !== 0) return diff;
    return (a.username || a.name || '').localeCompare(b.username || b.name || '');
  });

  return candidates;
}

export function createCompetition(input: {
  name: string;
  actorUserId: number | null;
  isAdmin: boolean;
  participantUserIds?: number[];
}) {
  const sqlite = sqliteOrThrow();
  const now = new Date().toISOString();
  const tx = sqlite.transaction(() => {
    const result = sqlite.prepare(
      `INSERT INTO habit_competitions (name, created_by_user_id, created_by_mode, status, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?)`
    ).run(input.name.trim(), input.actorUserId, input.isAdmin ? 'admin' : 'user', now, now);
    const competitionId = Number(result.lastInsertRowid);

    if (input.actorUserId) {
      sqlite.prepare(
        `INSERT INTO competition_participants (competition_id, user_id, role, invite_status, joined_at, created_at)
         VALUES (?, ?, 'owner', 'accepted', ?, ?)`
      ).run(competitionId, input.actorUserId, now, now);
    }

    for (const participantUserId of input.participantUserIds ?? []) {
      if (participantUserId === input.actorUserId) continue;
      sqlite.prepare(
        `INSERT OR IGNORE INTO competition_participants (competition_id, user_id, role, invite_status, joined_at, created_at)
         VALUES (?, ?, 'member', 'accepted', ?, ?)`
      ).run(competitionId, participantUserId, now, now);
    }

    return competitionId;
  });

  return tx();
}

export function updateCompetition(input: {
  competitionId: number;
  actorUserId: number | null;
  actorIsAdmin: boolean;
  name: string;
}) {
  ensureCompetitionOwner(input.competitionId, input.actorUserId, input.actorIsAdmin);
  const sqlite = sqliteOrThrow();
  sqlite.prepare(
    `UPDATE habit_competitions SET name = ?, updated_at = ? WHERE id = ?`
  ).run(input.name.trim(), new Date().toISOString(), input.competitionId);
}

export function deleteCompetition(input: {
  competitionId: number;
  actorUserId: number | null;
  actorIsAdmin: boolean;
}) {
  ensureCompetitionOwner(input.competitionId, input.actorUserId, input.actorIsAdmin);
  const sqlite = sqliteOrThrow();
  const tx = sqlite.transaction(() => {
    sqlite.prepare(
      `DELETE FROM competition_habit_logs
       WHERE competition_habit_id IN (
         SELECT id FROM competition_habits WHERE competition_id = ?
       )`
    ).run(input.competitionId);
    sqlite.prepare(
      `DELETE FROM competition_habit_links
       WHERE competition_habit_id IN (
         SELECT id FROM competition_habits WHERE competition_id = ?
       )`
    ).run(input.competitionId);
    sqlite.prepare(`DELETE FROM competition_habits WHERE competition_id = ?`).run(input.competitionId);
    sqlite.prepare(`DELETE FROM competition_participants WHERE competition_id = ?`).run(input.competitionId);
    sqlite.prepare(`DELETE FROM habit_competitions WHERE id = ?`).run(input.competitionId);
  });
  tx();
}

export function listCompetitionsForUser(viewerUserId: number | null, isAdmin: boolean) {
  const sqlite = sqliteOrThrow();
  if (isAdmin) {
    return sqlite.prepare(
      `SELECT c.id, c.name, c.status, c.created_at as createdAt, c.updated_at as updatedAt,
              (SELECT COUNT(*) FROM competition_participants cp WHERE cp.competition_id = c.id) as participantCount,
              (SELECT COUNT(*) FROM competition_participants cp WHERE cp.competition_id = c.id AND cp.invite_status = 'accepted') as acceptedCount,
              (SELECT COUNT(*) FROM competition_participants cp WHERE cp.competition_id = c.id AND cp.invite_status = 'pending') as pendingCount,
              NULL as role, NULL as inviteStatus
       FROM habit_competitions c
       WHERE c.status = 'active'
       ORDER BY c.updated_at DESC`
    ).all() as CompetitionSummaryRow[];
  }

  return sqlite.prepare(
    `SELECT c.id, c.name, c.status, c.created_at as createdAt, c.updated_at as updatedAt,
            (SELECT COUNT(*) FROM competition_participants cp2 WHERE cp2.competition_id = c.id) as participantCount,
            (SELECT COUNT(*) FROM competition_participants cp2 WHERE cp2.competition_id = c.id AND cp2.invite_status = 'accepted') as acceptedCount,
            (SELECT COUNT(*) FROM competition_participants cp2 WHERE cp2.competition_id = c.id AND cp2.invite_status = 'pending') as pendingCount,
            cp.role as role, cp.invite_status as inviteStatus
     FROM habit_competitions c
     JOIN competition_participants cp ON cp.competition_id = c.id
     WHERE cp.user_id = ? AND c.status = 'active'
     ORDER BY c.updated_at DESC`
  ).all(viewerUserId) as CompetitionSummaryRow[];
}

export function listCompetitionInvites(userId: number) {
  const sqlite = sqliteOrThrow();
  return sqlite.prepare(
    `SELECT c.id as competitionId, c.name, cp.created_at as invitedAt,
            owner.username as ownerUsername, owner.name as ownerName
     FROM competition_participants cp
     JOIN habit_competitions c ON c.id = cp.competition_id
     LEFT JOIN competition_participants ownerp ON ownerp.competition_id = c.id AND ownerp.role = 'owner'
     LEFT JOIN users owner ON owner.id = ownerp.user_id
     WHERE cp.user_id = ? AND cp.invite_status = 'pending'
     ORDER BY cp.created_at DESC`
  ).all(userId) as Array<{
    competitionId: number;
    name: string;
    invitedAt: string;
    ownerUsername: string | null;
    ownerName: string | null;
  }>;
}

export function inviteUserToCompetition(input: {
  competitionId: number;
  actorUserId: number | null;
  actorIsAdmin: boolean;
  username: string;
}) {
  const search = discoverCompetitionInviteTarget(input);
  if (!search.canInvite || !search.user) throw new Error(search.message);
  const sqlite = sqliteOrThrow();
  sqlite.prepare(
    `INSERT INTO competition_participants (competition_id, user_id, role, invite_status, created_at)
     VALUES (?, ?, 'member', 'pending', ?)`
  ).run(input.competitionId, search.user.id, new Date().toISOString());
  sqlite.prepare(`UPDATE habit_competitions SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), input.competitionId);
  return search.user;
}

export function respondToCompetitionInvite(input: {
  competitionId: number;
  userId: number;
  action: 'accepted' | 'declined';
}) {
  const sqlite = sqliteOrThrow();
  const now = new Date().toISOString();
  const result = sqlite.prepare(
    `UPDATE competition_participants
     SET invite_status = ?, joined_at = CASE WHEN ? = 'accepted' THEN ? ELSE joined_at END
     WHERE competition_id = ? AND user_id = ? AND invite_status = 'pending'`
  ).run(input.action, input.action, now, input.competitionId, input.userId);
  if (result.changes === 0) throw new Error('Invitación no encontrada');
  sqlite.prepare(`UPDATE habit_competitions SET updated_at = ? WHERE id = ?`).run(now, input.competitionId);
}

export function createCompetitionHabit(input: {
  competitionId: number;
  actorUserId: number | null;
  actorIsAdmin: boolean;
  name: string;
  description?: string;
  category?: string;
  kind: CompetitionHabitKind;
  scoringMode: CompetitionScoringMode;
  pointsPositive: number;
  pointsNegative: number;
  minutesPerBlock?: number | null;
  pointsPerBlock?: number | null;
  dailyTargetMinutes?: number | null;
}) {
  ensureCompetitionOwner(input.competitionId, input.actorUserId, input.actorIsAdmin);
  const sqlite = sqliteOrThrow();
  const now = new Date().toISOString();
  const result = sqlite.prepare(
    `INSERT INTO competition_habits
     (competition_id, name, description, category, kind, scoring_mode, points_positive, points_negative, minutes_per_block, points_per_block, daily_target_minutes, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    input.competitionId,
    input.name.trim(),
    input.description ?? null,
    input.category ?? null,
    normalizeCompetitionKind(input.kind),
    input.scoringMode,
    input.pointsPositive,
    input.pointsNegative,
    input.kind === 'duration' ? Math.max(1, Number(input.minutesPerBlock ?? 30)) : null,
    input.kind === 'duration' ? Math.max(0, Number(input.pointsPerBlock ?? 1)) : null,
    input.kind === 'duration' ? Math.max(0, Number(input.dailyTargetMinutes ?? 0)) || null : null,
    now,
    now,
  );
  sqlite.prepare(`UPDATE habit_competitions SET updated_at = ? WHERE id = ?`).run(now, input.competitionId);
  return Number(result.lastInsertRowid);
}

export function updateCompetitionHabit(input: {
  competitionId: number;
  competitionHabitId: number;
  actorUserId: number | null;
  actorIsAdmin: boolean;
  name: string;
  description?: string;
  category?: string;
  kind: CompetitionHabitKind;
  scoringMode: CompetitionScoringMode;
  pointsPositive: number;
  pointsNegative: number;
  minutesPerBlock?: number | null;
  pointsPerBlock?: number | null;
  dailyTargetMinutes?: number | null;
}) {
  ensureCompetitionOwner(input.competitionId, input.actorUserId, input.actorIsAdmin);
  const sqlite = sqliteOrThrow();
  const now = new Date().toISOString();
  const result = sqlite.prepare(
    `UPDATE competition_habits
     SET name = ?, description = ?, category = ?, kind = ?, scoring_mode = ?, points_positive = ?, points_negative = ?, minutes_per_block = ?, points_per_block = ?, daily_target_minutes = ?, updated_at = ?
     WHERE id = ? AND competition_id = ? AND active = 1`
  ).run(
    input.name.trim(),
    input.description ?? null,
    input.category ?? null,
    normalizeCompetitionKind(input.kind),
    input.scoringMode,
    input.pointsPositive,
    input.pointsNegative,
    input.kind === 'duration' ? Math.max(1, Number(input.minutesPerBlock ?? 30)) : null,
    input.kind === 'duration' ? Math.max(0, Number(input.pointsPerBlock ?? 1)) : null,
    input.kind === 'duration' ? Math.max(0, Number(input.dailyTargetMinutes ?? 0)) || null : null,
    now,
    input.competitionHabitId,
    input.competitionId,
  );
  if (result.changes === 0) throw new Error('Hábito competitivo no encontrado');
  sqlite.prepare(`UPDATE habit_competitions SET updated_at = ? WHERE id = ?`).run(now, input.competitionId);
}

export function deleteCompetitionHabit(input: {
  competitionId: number;
  competitionHabitId: number;
  actorUserId: number | null;
  actorIsAdmin: boolean;
}) {
  ensureCompetitionOwner(input.competitionId, input.actorUserId, input.actorIsAdmin);
  const sqlite = sqliteOrThrow();
  const tx = sqlite.transaction(() => {
    sqlite.prepare(`DELETE FROM competition_habit_logs WHERE competition_habit_id = ?`).run(input.competitionHabitId);
    sqlite.prepare(`DELETE FROM competition_habit_links WHERE competition_habit_id = ?`).run(input.competitionHabitId);
    const result = sqlite.prepare(
      `DELETE FROM competition_habits WHERE id = ? AND competition_id = ?`
    ).run(input.competitionHabitId, input.competitionId);
    if (result.changes === 0) throw new Error('Hábito competitivo no encontrado');
    sqlite.prepare(`UPDATE habit_competitions SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), input.competitionId);
  });
  tx();
}

function getCompetitionHabits(competitionId: number) {
  const sqlite = sqliteOrThrow();
  return sqlite.prepare(
    `SELECT id, competition_id as competitionId, name, description, category,
            kind, scoring_mode as scoringMode, points_positive as pointsPositive, points_negative as pointsNegative,
            minutes_per_block as minutesPerBlock, points_per_block as pointsPerBlock, daily_target_minutes as dailyTargetMinutes,
            active
     FROM competition_habits
     WHERE competition_id = ? AND active = 1
     ORDER BY created_at ASC`
  ).all(competitionId).map((habit: any) => ({
    ...habit,
    kind: normalizeCompetitionKind(habit.kind),
  })) as CompetitionHabitRow[];
}

function getCompetitionParticipants(competitionId: number) {
  const sqlite = sqliteOrThrow();
  return sqlite.prepare(
    `SELECT cp.user_id as userId, u.name, u.username, cp.role, cp.invite_status as inviteStatus, cp.joined_at as joinedAt
     FROM competition_participants cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.competition_id = ?
     ORDER BY CASE cp.role WHEN 'owner' THEN 0 ELSE 1 END, lower(COALESCE(u.username, u.name, '')) ASC`
  ).all(competitionId) as CompetitionParticipantRow[];
}

function getPersonalHabits(userId: number) {
  const sqlite = sqliteOrThrow();
  return sqlite.prepare(
    `SELECT id, name, emoji, category, frequency, is_negative as isNegative, target_minutes as targetMinutes
     FROM habits WHERE user_id = ? AND active = 1
     ORDER BY created_at ASC`
  ).all(userId) as Array<{
    id: number;
    name: string;
    emoji: string | null;
    category: string | null;
    frequency: string;
    isNegative: number;
    targetMinutes: number | null;
  }>;
}

function getHabitLink(competitionHabitId: number, userId: number) {
  const sqlite = sqliteOrThrow();
  return sqlite.prepare(
    `SELECT id, personal_habit_id as personalHabitId FROM competition_habit_links
     WHERE competition_habit_id = ? AND user_id = ? LIMIT 1`
  ).get(competitionHabitId, userId) as { id: number; personalHabitId: number } | undefined;
}

function findSuggestedPersonalHabit(
  competitionHabit: { name: string; kind?: CompetitionHabitKind; dailyTargetMinutes?: number | null; minutesPerBlock?: number | null },
  personalHabits: Array<{ id: number; name: string; targetMinutes?: number | null }>,
) {
  const target = normalizeHabitName(competitionHabit.name);
  if (!target) return null;

  const exact = personalHabits.filter((habit) => normalizeHabitName(habit.name) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const fuzzy = personalHabits.filter((habit) => {
    const current = normalizeHabitName(habit.name);
    return current.includes(target) || target.includes(current);
  });
  const candidate = fuzzy.length === 1 ? fuzzy[0] : null;
  if (!candidate) return null;
  if (competitionHabit.kind === 'duration' && !candidate.targetMinutes && !competitionHabit.dailyTargetMinutes) {
    return candidate;
  }
  return candidate;
}

function getTodayProgressForHabit(competitionHabit: CompetitionHabitRow, participantUserId: number, date: string) {
  const sqlite = sqliteOrThrow();
  const link = getHabitLink(competitionHabit.id, participantUserId);
  if (link) {
    const row = sqlite.prepare(
      `SELECT status, completed, minutes_logged as minutesLogged
       FROM habit_logs WHERE habit_id = ? AND user_id = ? AND date = ? LIMIT 1`
    ).get(link.personalHabitId, participantUserId, date) as { status?: string | null; completed?: number | null; minutesLogged?: number | null } | undefined;
    const status = effectiveEventStatus(competitionHabit, statusFromPersonalRow(row), date);
    const minutesLogged = Math.max(0, row?.minutesLogged ?? 0);
    return {
      status,
      minutesLogged,
      points: competitionHabit.kind === 'duration'
        ? pointsForDuration(minutesLogged, competitionHabit.minutesPerBlock, competitionHabit.pointsPerBlock)
        : pointsForEvent(competitionHabit.scoringMode, competitionHabit.pointsPositive, competitionHabit.pointsNegative, status),
    };
  }
  const row = sqlite.prepare(
    `SELECT status, minutes_logged as minutesLogged, points_awarded as pointsAwarded
     FROM competition_habit_logs WHERE competition_habit_id = ? AND user_id = ? AND date = ? LIMIT 1`
  ).get(competitionHabit.id, participantUserId, date) as
    | { status?: string; minutesLogged?: number | null; pointsAwarded?: number | null }
    | undefined;
  const status = effectiveEventStatus(competitionHabit, (row?.status as CompetitionLogStatus | undefined) ?? 'clear', date);
  const minutesLogged = Math.max(0, row?.minutesLogged ?? 0);
  return {
    status,
    minutesLogged,
    points: competitionHabit.kind === 'duration'
      ? pointsForDuration(minutesLogged, competitionHabit.minutesPerBlock, competitionHabit.pointsPerBlock)
      : pointsForEvent(competitionHabit.scoringMode, competitionHabit.pointsPositive, competitionHabit.pointsNegative, status),
  };
}

export function getCompetitionDetail(input: {
  competitionId: number;
  viewerUserId: number | null;
  viewerIsAdmin: boolean;
}) {
  ensureCompetitionAccess(input.competitionId, input.viewerUserId, input.viewerIsAdmin);
  const competition = getCompetitionMeta(input.competitionId);
  if (!competition) throw new Error('Competencia no encontrada');

  const participants = getCompetitionParticipants(input.competitionId);
  const habits = getCompetitionHabits(input.competitionId);
  const today = getTodayDate();
  const viewerHabits = input.viewerUserId ? getPersonalHabits(input.viewerUserId) : [];
  const viewerParticipant = input.viewerUserId
    ? participants.find((participant) => participant.userId === input.viewerUserId) ?? null
    : null;

  const enrichedHabits = habits.map((habit) => {
    const currentLink = input.viewerUserId ? getHabitLink(habit.id, input.viewerUserId) : undefined;
    const suggestedHabit = !currentLink && input.viewerUserId
      ? findSuggestedPersonalHabit(habit, viewerHabits)
      : null;
    const progress = input.viewerUserId ? getTodayProgressForHabit(habit, input.viewerUserId, today) : { status: 'clear' as CompetitionLogStatus, minutesLogged: 0, points: 0 };
    return {
      ...habit,
      linkedPersonalHabitId: currentLink?.personalHabitId ?? null,
      todayStatus: progress.status,
      todayMinutes: progress.minutesLogged,
      todayPoints: progress.points,
      syncState: currentLink ? 'linked' : suggestedHabit ? 'suggested_match' : 'create_in_profile',
      suggestedPersonalHabitId: suggestedHabit?.id ?? null,
      suggestedPersonalHabitName: suggestedHabit?.name ?? null,
    };
  });

  return {
    competition,
    viewer: {
      userId: input.viewerUserId ?? null,
      username: viewerParticipant?.username ?? null,
      missingUsername: !!input.viewerUserId && !viewerParticipant?.username,
    },
    participants,
    habits: enrichedHabits,
    personalHabits: viewerHabits,
  };
}

export function getCompetitionHabitsForDiary(userId: number, date: string) {
  const sqlite = sqliteOrThrow();
  const rows = sqlite.prepare(
    `SELECT c.id as competitionId, c.name as competitionName,
            ch.id, ch.competition_id as competitionIdRef, ch.name, ch.description, ch.category,
            ch.kind, ch.scoring_mode as scoringMode, ch.points_positive as pointsPositive, ch.points_negative as pointsNegative,
            ch.minutes_per_block as minutesPerBlock, ch.points_per_block as pointsPerBlock, ch.daily_target_minutes as dailyTargetMinutes
     FROM competition_participants cp
     JOIN habit_competitions c ON c.id = cp.competition_id AND c.status = 'active'
     JOIN competition_habits ch ON ch.competition_id = c.id AND ch.active = 1
     WHERE cp.user_id = ? AND cp.invite_status = 'accepted'
     ORDER BY c.updated_at DESC, ch.created_at ASC`
  ).all(userId) as Array<{
    competitionId: number;
    competitionName: string;
    id: number;
    competitionIdRef: number;
    name: string;
    description: string | null;
    category: string | null;
    kind: string | null;
    scoringMode: CompetitionScoringMode;
    pointsPositive: number;
    pointsNegative: number;
    minutesPerBlock: number | null;
    pointsPerBlock: number | null;
    dailyTargetMinutes: number | null;
  }>;

  return rows.map((row) => {
    const link = getHabitLink(row.id, userId);
    const status = getTodayProgressForHabit({
      id: row.id,
      competitionId: row.competitionIdRef,
      name: row.name,
      description: row.description,
      category: row.category,
      kind: normalizeCompetitionKind(row.kind),
      scoringMode: row.scoringMode,
      pointsPositive: row.pointsPositive,
      pointsNegative: row.pointsNegative,
      minutesPerBlock: row.minutesPerBlock,
      pointsPerBlock: row.pointsPerBlock,
      dailyTargetMinutes: row.dailyTargetMinutes,
      active: 1,
    }, userId, date);
    return {
      competitionId: row.competitionId,
      competitionName: row.competitionName,
      habitId: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      kind: normalizeCompetitionKind(row.kind),
      scoringMode: row.scoringMode,
      pointsPositive: row.pointsPositive,
      pointsNegative: row.pointsNegative,
      minutesPerBlock: row.minutesPerBlock,
      pointsPerBlock: row.pointsPerBlock,
      dailyTargetMinutes: row.dailyTargetMinutes,
      linkedPersonalHabitId: link?.personalHabitId ?? null,
      status: status.status,
      minutesLogged: status.minutesLogged,
      pointsAwarded: status.points,
    };
  });
}

function getCompetitionHabitLogsForUser(competitionHabitId: number, userId: number, startDate?: string) {
  const sqlite = sqliteOrThrow();
  const habit = sqlite.prepare(
    `SELECT kind, minutes_per_block as minutesPerBlock, points_per_block as pointsPerBlock,
            scoring_mode as scoringMode, points_positive as pointsPositive, points_negative as pointsNegative
     FROM competition_habits WHERE id = ? LIMIT 1`
  ).get(competitionHabitId) as
    | {
        kind?: string | null;
        minutesPerBlock?: number | null;
        pointsPerBlock?: number | null;
        scoringMode: CompetitionScoringMode;
        pointsPositive: number;
        pointsNegative: number;
      }
    | undefined;
  const habitKind = normalizeCompetitionKind(habit?.kind);
  const link = getHabitLink(competitionHabitId, userId);
  if (link) {
    const rows = sqlite.prepare(
      `SELECT date, status, completed, minutes_logged as minutesLogged
       FROM habit_logs
       WHERE habit_id = ? AND user_id = ? ${startDate ? 'AND date >= ?' : ''}
       ORDER BY date ASC`
    ).all(...(startDate ? [link.personalHabitId, userId, startDate] : [link.personalHabitId, userId])) as Array<{
      date: string;
      status?: string | null;
      completed?: number | null;
      minutesLogged?: number | null;
    }>;
    return rows.map((row) => ({
      date: row.date,
      status: habitKind === 'duration' && (row.minutesLogged ?? 0) > 0 ? 'positive' : statusFromPersonalRow(row),
      minutesLogged: Math.max(0, row.minutesLogged ?? 0),
    }));
  }

  return sqlite.prepare(
    `SELECT date, status, minutes_logged as minutesLogged
     FROM competition_habit_logs
     WHERE competition_habit_id = ? AND user_id = ? ${startDate ? 'AND date >= ?' : ''}
     ORDER BY date ASC`
  ).all(...(startDate ? [competitionHabitId, userId, startDate] : [competitionHabitId, userId])).map((row: any) => ({
    date: row.date,
    status: habitKind === 'duration' && (row.minutesLogged ?? 0) > 0 ? 'positive' : ((row.status as CompetitionLogStatus | undefined) ?? 'clear'),
    minutesLogged: Math.max(0, row.minutesLogged ?? 0),
  })) as CompetitionLogRow[];
}

function buildDashboardData(competitionId: number, range: CompetitionRange) {
  const competition = getCompetitionMeta(competitionId);
  if (!competition) throw new Error('Competencia no encontrada');

  const participantsAll = getCompetitionParticipants(competitionId);
  const participants = participantsAll.filter((participant) => participant.inviteStatus === 'accepted');
  const habits = getCompetitionHabits(competitionId);
  const window = getDateWindow(range, competition.createdAt);
  const dates = enumerateDates(window.start, window.end);
  const possibleEvents = Math.max(dates.length * Math.max(habits.length, 1), 1);

  const logMap = new Map<string, CompetitionLogRow>();
  const linkedHabitMap = new Map<string, number | null>();

  for (const habit of habits) {
    for (const participant of participants) {
      const keyBase = `${habit.id}:${participant.userId}`;
      linkedHabitMap.set(keyBase, getHabitLink(habit.id, participant.userId)?.personalHabitId ?? null);
      for (const log of getCompetitionHabitLogsForUser(habit.id, participant.userId, window.start)) {
        if (log.date > window.end) continue;
        logMap.set(`${keyBase}:${log.date}`, log);
      }
    }
  }

  const leaderboard: CompetitionLeaderboardRow[] = [];
  const participantAnalytics: CompetitionParticipantAnalyticsRow[] = [];
  const habitAnalytics: CompetitionHabitAnalyticsRow[] = [];
  const timelineRows = dates.map((date) => ({
    date,
    positiveCount: 0,
    negativeCount: 0,
    clearCount: 0,
    netPoints: 0,
    minutesLogged: 0,
    participants: [] as CompetitionTimelineParticipantPoint[],
  }));

  const dailyTimelineIndex = new Map(dates.map((date, index) => [date, index]));

  const participantCumulativeByDate = new Map<number, Map<string, number>>();
  const readLog = (habit: CompetitionHabitRow, userId: number, date: string): CompetitionLogRow => {
    const raw = logMap.get(`${habit.id}:${userId}:${date}`) ?? { date, status: 'clear' as CompetitionLogStatus, minutesLogged: 0 };
    return {
      ...raw,
      status: habit.kind === 'duration' ? raw.status : effectiveEventStatus(habit, raw.status, date),
    };
  };

  for (const participant of participants) {
    let totalPoints = 0;
    let totalPositive = 0;
    let totalNegative = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let running = 0;
    const cumulativePoints: Array<{ date: string; value: number }> = [];
    const habitBreakdown: CompetitionParticipantHabitBreakdown[] = [];
    const dayStates = new Map<string, { positiveEvents: number; negativeEvents: number; points: number; minutes: number }>();

    for (const date of dates) {
      dayStates.set(date, { positiveEvents: 0, negativeEvents: 0, points: 0, minutes: 0 });
    }

    for (const habit of habits) {
      let habitPoints = 0;
      let habitPositive = 0;
      let habitNegative = 0;
      let habitCurrentStreak = 0;
      let habitBestStreak = 0;
      let streakRun = 0;
      let habitMinutes = 0;

      for (const date of dates) {
        const log = readLog(habit, participant.userId, date);
        const status = log.status;
        const points = habit.kind === 'duration'
          ? pointsForDuration(log.minutesLogged, habit.minutesPerBlock, habit.pointsPerBlock)
          : pointsForEvent(habit.scoringMode, habit.pointsPositive, habit.pointsNegative, status);
        const positiveSuccess = habit.kind === 'duration'
          ? (habit.dailyTargetMinutes ? log.minutesLogged >= habit.dailyTargetMinutes : log.minutesLogged > 0)
          : status === 'positive';
        const positiveEvent = habit.kind === 'duration' ? log.minutesLogged > 0 : status === 'positive';
        const negativeEvent = habit.kind === 'duration' ? false : status === 'negative';
        const dayState = dayStates.get(date)!;
        dayState.points += points;
        dayState.minutes += log.minutesLogged;
        if (positiveEvent) {
          dayState.positiveEvents += 1;
          habitPositive += 1;
        }
        if (negativeEvent) {
          dayState.negativeEvents += 1;
          habitNegative += 1;
        }
        if (positiveSuccess && !negativeEvent) {
          streakRun += 1;
          habitBestStreak = Math.max(habitBestStreak, streakRun);
        } else {
          streakRun = 0;
        }
        habitPoints += points;
        habitMinutes += log.minutesLogged;
      }

      for (let index = dates.length - 1; index >= 0; index -= 1) {
        const log = readLog(habit, participant.userId, dates[index]);
        const success = habit.kind === 'duration'
          ? (habit.dailyTargetMinutes ? log.minutesLogged >= habit.dailyTargetMinutes : log.minutesLogged > 0)
          : log.status === 'positive';
        const hasNegative = habit.kind === 'duration' ? false : log.status === 'negative';
        if (success && !hasNegative) habitCurrentStreak += 1;
        else break;
      }

      habitBreakdown.push({
        habitId: habit.id,
        habitName: habit.name,
        kind: habit.kind,
        scoringMode: habit.scoringMode,
        pointsPositive: habit.pointsPositive,
        pointsNegative: habit.pointsNegative,
        minutesPerBlock: habit.minutesPerBlock,
        pointsPerBlock: habit.pointsPerBlock,
        points: habitPoints,
        positiveDays: habitPositive,
        negativeDays: habitNegative,
        completionRate: Math.round(((habit.kind === 'duration'
          ? dates.filter((date) => {
              const log = readLog(habit, participant.userId, date);
              return habit.dailyTargetMinutes
                ? (log?.minutesLogged ?? 0) >= habit.dailyTargetMinutes
                : (log?.minutesLogged ?? 0) > 0;
            }).length
          : habitPositive) / Math.max(dates.length, 1)) * 100),
        currentStreak: habitCurrentStreak,
        bestStreak: habitBestStreak,
        totalMinutes: habitMinutes,
      });
    }

    let streak = 0;
    for (const date of dates) {
      const dayState = dayStates.get(date)!;
      totalPoints += dayState.points;
      totalPositive += dayState.positiveEvents;
      totalNegative += dayState.negativeEvents;

      if (dayState.positiveEvents > 0 && dayState.negativeEvents === 0) {
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
      }

      running += dayState.points;
      cumulativePoints.push({ date, value: running });
      participantCumulativeByDate.set(
        participant.userId,
        (participantCumulativeByDate.get(participant.userId) ?? new Map<string, number>()).set(date, running),
      );
    }

    currentStreak = streak;

    const row: CompetitionLeaderboardRow = {
      userId: participant.userId,
      name: participant.name || participant.username || `Usuario ${participant.userId}`,
      username: participant.username,
      points: totalPoints,
      positiveDays: totalPositive,
      negativeDays: totalNegative,
      completionRate: Math.round((totalPositive / possibleEvents) * 100),
      currentStreak,
      bestStreak,
    };
    leaderboard.push(row);

    participantAnalytics.push({
      ...row,
      rank: 0,
      pointsDiffToLeader: 0,
      habitBreakdown: habitBreakdown.sort((a, b) => b.points - a.points),
      cumulativePoints,
    });

    for (const date of dates) {
      const index = dailyTimelineIndex.get(date)!;
      const dayState = dayStates.get(date)!;
      const timelineRow = timelineRows[index];
      timelineRow.positiveCount += dayState.positiveEvents;
      timelineRow.negativeCount += dayState.negativeEvents;
      timelineRow.clearCount += Math.max(habits.length - dayState.positiveEvents - dayState.negativeEvents, 0);
      timelineRow.netPoints += dayState.points;
      timelineRow.minutesLogged += dayState.minutes;
      timelineRow.participants.push({
        userId: participant.userId,
        name: row.name,
        username: row.username,
        points: dayState.points,
        cumulativePoints: participantCumulativeByDate.get(participant.userId)?.get(date) ?? 0,
      });
    }
  }

  sortLeaderboard(leaderboard);
  const leader = leaderboard[0];
  participantAnalytics.forEach((participant) => {
    const rank = leaderboard.findIndex((row) => row.userId === participant.userId) + 1;
    participant.rank = rank;
    participant.pointsDiffToLeader = leader ? participant.points - leader.points : 0;
  });
  participantAnalytics.sort((a, b) => a.rank - b.rank);

  for (const habit of habits) {
    const participantRows: CompetitionHabitParticipantRow[] = [];
    const habitTimeline = dates.map((date) => ({
      date,
      positiveCount: 0,
      negativeCount: 0,
      clearCount: 0,
      netPoints: 0,
      minutesLogged: 0,
    }));

    let netPoints = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let totalMinutes = 0;

    for (const participant of participants) {
      let points = 0;
      let positiveDays = 0;
      let negativeDays = 0;
      let bestStreak = 0;
      let currentStreak = 0;
      let runningStreak = 0;
      let minutesLogged = 0;
      let successfulDays = 0;

      for (const date of dates) {
        const log = readLog(habit, participant.userId, date);
        const status = log.status;
        const pointsDelta = habit.kind === 'duration'
          ? pointsForDuration(log.minutesLogged, habit.minutesPerBlock, habit.pointsPerBlock)
          : pointsForEvent(habit.scoringMode, habit.pointsPositive, habit.pointsNegative, status);
        const success = habit.kind === 'duration'
          ? (habit.dailyTargetMinutes ? log.minutesLogged >= habit.dailyTargetMinutes : log.minutesLogged > 0)
          : status === 'positive';
        const positiveEvent = habit.kind === 'duration' ? log.minutesLogged > 0 : status === 'positive';
        const negativeEvent = habit.kind === 'duration' ? false : status === 'negative';
        points += pointsDelta;
        netPoints += pointsDelta;
        minutesLogged += log.minutesLogged;
        totalMinutes += log.minutesLogged;
        if (positiveEvent) {
          positiveDays += 1;
          positiveCount += 1;
        }
        if (negativeEvent) {
          negativeDays += 1;
          negativeCount += 1;
        }
        if (success && !negativeEvent) {
          runningStreak += 1;
          bestStreak = Math.max(bestStreak, runningStreak);
          successfulDays += 1;
          habitTimeline[dailyTimelineIndex.get(date)!].positiveCount += 1;
        } else if (negativeEvent) {
          habitTimeline[dailyTimelineIndex.get(date)!].negativeCount += 1;
          runningStreak = 0;
        } else {
          runningStreak = 0;
          habitTimeline[dailyTimelineIndex.get(date)!].clearCount += 1;
        }
        habitTimeline[dailyTimelineIndex.get(date)!].netPoints += pointsDelta;
        habitTimeline[dailyTimelineIndex.get(date)!].minutesLogged += log.minutesLogged;
      }

      for (let index = dates.length - 1; index >= 0; index -= 1) {
        const log = readLog(habit, participant.userId, dates[index]);
        const success = habit.kind === 'duration'
          ? (habit.dailyTargetMinutes ? log.minutesLogged >= habit.dailyTargetMinutes : log.minutesLogged > 0)
          : log.status === 'positive';
        const hasNegative = habit.kind === 'duration' ? false : log.status === 'negative';
        if (success && !hasNegative) currentStreak += 1;
        else break;
      }

      participantRows.push({
        userId: participant.userId,
        name: participant.name || participant.username || `Usuario ${participant.userId}`,
        username: participant.username,
        points,
        positiveDays,
        negativeDays,
        completionRate: Math.round((successfulDays / Math.max(dates.length, 1)) * 100),
        currentStreak,
        bestStreak,
        linkedPersonalHabitId: linkedHabitMap.get(`${habit.id}:${participant.userId}`) ?? null,
        minutesLogged,
      });
    }

    sortLeaderboard(participantRows);
    habitAnalytics.push({
      habitId: habit.id,
      name: habit.name,
      description: habit.description,
      category: habit.category,
      kind: habit.kind,
      scoringMode: habit.scoringMode,
      pointsPositive: habit.pointsPositive,
      pointsNegative: habit.pointsNegative,
      minutesPerBlock: habit.minutesPerBlock,
      pointsPerBlock: habit.pointsPerBlock,
      dailyTargetMinutes: habit.dailyTargetMinutes,
      positiveCount,
      negativeCount,
      completionRate: Math.round((positiveCount / Math.max(dates.length * Math.max(participants.length, 1), 1)) * 100),
      netPoints,
      totalMinutes,
      participants: participantRows,
      timeline: habitTimeline,
    });
  }

  const averageCompletionRate = leaderboard.length
    ? Math.round(leaderboard.reduce((sum, row) => sum + row.completionRate, 0) / leaderboard.length)
    : 0;

  return {
    range,
    summary: {
      activeParticipants: participants.length,
      pendingParticipants: participantsAll.filter((participant) => participant.inviteStatus === 'pending').length,
      habitCount: habits.length,
      totalPoints: leaderboard.reduce((sum, row) => sum + row.points, 0),
      averageCompletionRate,
      positiveCount: leaderboard.reduce((sum, row) => sum + row.positiveDays, 0),
      negativeCount: leaderboard.reduce((sum, row) => sum + row.negativeDays, 0),
      leaderUserId: leader?.userId ?? null,
      leaderName: leader?.name ?? null,
      leaderUsername: leader?.username ?? null,
      leaderPoints: leader?.points ?? 0,
    },
    leaderboard,
    habits: habitAnalytics,
    participants: participantAnalytics,
    timeline: timelineRows,
  } satisfies CompetitionDashboardStats;
}

export function getCompetitionStats(input: {
  competitionId: number;
  range: CompetitionRange;
  viewerUserId: number | null;
  viewerIsAdmin: boolean;
}) {
  ensureCompetitionAccess(input.competitionId, input.viewerUserId, input.viewerIsAdmin);
  return buildDashboardData(input.competitionId, input.range);
}

export function linkExistingCompetitionHabit(input: {
  competitionId: number;
  competitionHabitId: number;
  userId: number;
  personalHabitId: number;
}) {
  ensureCompetitionAccess(input.competitionId, input.userId, false);
  const sqlite = sqliteOrThrow();
  const personalHabit = sqlite.prepare(
    `SELECT id FROM habits WHERE id = ? AND user_id = ? AND active = 1 LIMIT 1`
  ).get(input.personalHabitId, input.userId) as { id: number } | undefined;
  if (!personalHabit) throw new Error('Hábito personal no encontrado');
  sqlite.prepare(
    `INSERT INTO competition_habit_links (competition_habit_id, user_id, personal_habit_id, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(competition_habit_id, user_id) DO UPDATE SET personal_habit_id = excluded.personal_habit_id`
  ).run(input.competitionHabitId, input.userId, input.personalHabitId, new Date().toISOString());
}

export function applySuggestedCompetitionHabitLink(input: {
  competitionId: number;
  competitionHabitId: number;
  userId: number;
}) {
  ensureCompetitionAccess(input.competitionId, input.userId, false);
  const sqlite = sqliteOrThrow();
  const competitionHabit = sqlite.prepare(
    `SELECT id, name, kind, daily_target_minutes as dailyTargetMinutes
     FROM competition_habits WHERE id = ? AND competition_id = ? AND active = 1 LIMIT 1`
  ).get(input.competitionHabitId, input.competitionId) as
    | { id: number; name: string; kind: string | null; dailyTargetMinutes: number | null }
    | undefined;
  if (!competitionHabit) throw new Error('Hábito competitivo no encontrado');

  const personalHabits = getPersonalHabits(input.userId);
  const suggested = findSuggestedPersonalHabit({ ...competitionHabit, kind: normalizeCompetitionKind(competitionHabit.kind) }, personalHabits);
  if (!suggested) throw new Error('No hay un hábito personal similar para vincular');

  linkExistingCompetitionHabit({
    competitionId: input.competitionId,
    competitionHabitId: input.competitionHabitId,
    userId: input.userId,
    personalHabitId: suggested.id,
  });

  return {
    personalHabitId: suggested.id,
    personalHabitName: suggested.name,
  };
}

export function createAndLinkCompetitionHabit(input: {
  competitionId: number;
  competitionHabitId: number;
  userId: number;
}) {
  ensureCompetitionAccess(input.competitionId, input.userId, false);
  const sqlite = sqliteOrThrow();
  const competitionHabit = sqlite.prepare(
    `SELECT name, category, kind, scoring_mode as scoringMode, daily_target_minutes as dailyTargetMinutes
     FROM competition_habits WHERE id = ? AND competition_id = ? LIMIT 1`
  ).get(input.competitionHabitId, input.competitionId) as
    | {
        name: string;
        category: string | null;
        kind: string | null;
        scoringMode: CompetitionScoringMode;
        dailyTargetMinutes: number | null;
      }
    | undefined;
  if (!competitionHabit) throw new Error('Hábito competitivo no encontrado');
  const now = new Date().toISOString();
  const result = sqlite.prepare(
    `INSERT INTO habits (user_id, name, category, frequency, is_negative, target_minutes, active, created_at, updated_at)
     VALUES (?, ?, ?, 'daily', ?, ?, 1, ?, ?)`
  ).run(
    input.userId,
    competitionHabit.name,
    competitionHabit.category,
    competitionHabit.scoringMode === 'negative_only' || competitionHabit.scoringMode === 'both' ? 1 : 0,
    normalizeCompetitionKind(competitionHabit.kind) === 'duration' ? competitionHabit.dailyTargetMinutes ?? null : null,
    now,
    now,
  );
  const personalHabitId = Number(result.lastInsertRowid);
  linkExistingCompetitionHabit({
    competitionId: input.competitionId,
    competitionHabitId: input.competitionHabitId,
    userId: input.userId,
    personalHabitId,
  });
  return personalHabitId;
}

export function unlinkCompetitionHabit(input: {
  competitionId: number;
  competitionHabitId: number;
  userId: number;
}) {
  ensureCompetitionAccess(input.competitionId, input.userId, false);
  const sqlite = sqliteOrThrow();
  sqlite.prepare(
    `DELETE FROM competition_habit_links WHERE competition_habit_id = ? AND user_id = ?`
  ).run(input.competitionHabitId, input.userId);
}

function setPersonalHabitStatus(habitId: number, userId: number, date: string, status: CompetitionLogStatus) {
  const sqlite = sqliteOrThrow();
  const habit = sqlite.prepare(
    `SELECT is_negative as isNegative FROM habits WHERE id = ? AND user_id = ? LIMIT 1`
  ).get(habitId, userId) as { isNegative?: number } | undefined;
  if (!habit) throw new Error('Hábito personal no encontrado');

  const existing = sqlite.prepare(
    `SELECT id FROM habit_logs WHERE habit_id = ? AND user_id = ? AND date = ? LIMIT 1`
  ).get(habitId, userId, date) as { id: number } | undefined;
  const normalizedStatus = habit.isNegative ? (status === 'negative' ? 'negative' : 'clear') : status;

  if (normalizedStatus === 'clear') {
    if (existing) sqlite.prepare(`DELETE FROM habit_logs WHERE id = ?`).run(existing.id);
    return;
  }

  const completed = normalizedStatus === 'positive' ? 1 : 0;
  if (existing) {
    sqlite.prepare(`UPDATE habit_logs SET completed = ?, status = ?, minutes_logged = 0 WHERE id = ?`).run(completed, normalizedStatus, existing.id);
  } else {
    sqlite.prepare(
      `INSERT INTO habit_logs (habit_id, user_id, date, completed, status, minutes_logged, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).run(habitId, userId, date, completed, normalizedStatus, new Date().toISOString());
  }
}

function setCompetitionHabitStatus(competitionHabitId: number, userId: number, date: string, status: CompetitionLogStatus) {
  const sqlite = sqliteOrThrow();
  const existing = sqlite.prepare(
    `SELECT id FROM competition_habit_logs WHERE competition_habit_id = ? AND user_id = ? AND date = ? LIMIT 1`
  ).get(competitionHabitId, userId, date) as { id: number } | undefined;
  if (status === 'clear') {
    if (existing) sqlite.prepare(`DELETE FROM competition_habit_logs WHERE id = ?`).run(existing.id);
    return;
  }
  const now = new Date().toISOString();
  if (existing) {
    sqlite.prepare(`UPDATE competition_habit_logs SET status = ?, minutes_logged = 0, points_awarded = 0, updated_at = ? WHERE id = ?`).run(status, now, existing.id);
  } else {
    sqlite.prepare(
      `INSERT INTO competition_habit_logs (competition_habit_id, user_id, date, status, minutes_logged, points_awarded, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?)`
    ).run(competitionHabitId, userId, date, status, now, now);
  }
}

function addPersonalHabitMinutes(habitId: number, userId: number, date: string, minutesDelta: number) {
  const sqlite = sqliteOrThrow();
  const habit = sqlite.prepare(
    `SELECT is_negative as isNegative FROM habits WHERE id = ? AND user_id = ? LIMIT 1`
  ).get(habitId, userId) as { isNegative?: number } | undefined;
  if (!habit) throw new Error('Hábito personal no encontrado');
  if (habit.isNegative) throw new Error('Los hábitos de evitación no aceptan minutos');

  const existing = sqlite.prepare(
    `SELECT id, minutes_logged as minutesLogged FROM habit_logs WHERE habit_id = ? AND user_id = ? AND date = ? LIMIT 1`
  ).get(habitId, userId, date) as { id: number; minutesLogged?: number | null } | undefined;
  const totalMinutes = Math.max(0, (existing?.minutesLogged ?? 0) + Math.max(0, Math.round(minutesDelta)));

  if (totalMinutes === 0) {
    if (existing) sqlite.prepare(`DELETE FROM habit_logs WHERE id = ?`).run(existing.id);
    return { minutesLogged: 0 };
  }

  if (existing) {
    sqlite.prepare(`UPDATE habit_logs SET completed = 1, status = 'positive', minutes_logged = ? WHERE id = ?`).run(totalMinutes, existing.id);
  } else {
    sqlite.prepare(
      `INSERT INTO habit_logs (habit_id, user_id, date, completed, status, minutes_logged, created_at)
       VALUES (?, ?, ?, 1, 'positive', ?, ?)`
    ).run(habitId, userId, date, totalMinutes, new Date().toISOString());
  }

  return { minutesLogged: totalMinutes };
}

function addCompetitionHabitMinutes(competitionHabitId: number, userId: number, date: string, minutesDelta: number, mode: 'add' | 'set' = 'add') {
  const sqlite = sqliteOrThrow();
  const existing = sqlite.prepare(
    `SELECT id, minutes_logged as minutesLogged FROM competition_habit_logs
     WHERE competition_habit_id = ? AND user_id = ? AND date = ? LIMIT 1`
  ).get(competitionHabitId, userId, date) as { id: number; minutesLogged?: number | null } | undefined;
  const safeMinutes = Math.max(0, Math.round(minutesDelta));
  const totalMinutes = Math.max(0, mode === 'set' ? safeMinutes : (existing?.minutesLogged ?? 0) + safeMinutes);

  if (totalMinutes === 0) {
    if (existing) sqlite.prepare(`DELETE FROM competition_habit_logs WHERE id = ?`).run(existing.id);
    return { minutesLogged: 0 };
  }

  const now = new Date().toISOString();
  if (existing) {
    sqlite.prepare(`UPDATE competition_habit_logs SET status = 'positive', minutes_logged = ?, updated_at = ? WHERE id = ?`).run(totalMinutes, now, existing.id);
  } else {
    sqlite.prepare(
      `INSERT INTO competition_habit_logs (competition_habit_id, user_id, date, status, minutes_logged, points_awarded, created_at, updated_at)
       VALUES (?, ?, ?, 'positive', ?, 0, ?, ?)`
    ).run(competitionHabitId, userId, date, totalMinutes, now, now);
  }

  return { minutesLogged: totalMinutes };
}

export function syncCompetitionDurationFromPersonal(input: {
  personalHabitId: number;
  userId: number;
  date: string;
  minutesDelta: number;
  mode?: 'add' | 'set';
}) {
  const sqlite = sqliteOrThrow();
  const links = sqlite.prepare(
    `SELECT chl.competition_habit_id as competitionHabitId, ch.minutes_per_block as minutesPerBlock, ch.points_per_block as pointsPerBlock
     FROM competition_habit_links chl
     JOIN competition_habits ch ON ch.id = chl.competition_habit_id
     WHERE chl.personal_habit_id = ? AND chl.user_id = ? AND ch.active = 1 AND ch.kind = 'duration'`
  ).all(input.personalHabitId, input.userId) as Array<{ competitionHabitId: number; minutesPerBlock: number | null; pointsPerBlock: number | null }>;

  return links.map((link) => {
    const result = addCompetitionHabitMinutes(link.competitionHabitId, input.userId, input.date, input.minutesDelta, input.mode ?? 'add');
    const pointsAwarded = pointsForDuration(result.minutesLogged, link.minutesPerBlock, link.pointsPerBlock);
    sqlite.prepare(
      `UPDATE competition_habit_logs
       SET points_awarded = ?, updated_at = ?
       WHERE competition_habit_id = ? AND user_id = ? AND date = ?`
    ).run(pointsAwarded, new Date().toISOString(), link.competitionHabitId, input.userId, input.date);
    return { competitionHabitId: link.competitionHabitId, minutesLogged: result.minutesLogged, pointsAwarded };
  });
}

export function logCompetitionHabit(input: {
  competitionId: number;
  competitionHabitId: number;
  userId: number;
  status: CompetitionLogStatus;
  date?: string;
}) {
  ensureCompetitionAccess(input.competitionId, input.userId, false);
  const sqlite = sqliteOrThrow();
  const habit = sqlite.prepare(
    `SELECT kind, scoring_mode as scoringMode, points_positive as pointsPositive, points_negative as pointsNegative
     FROM competition_habits WHERE id = ? AND competition_id = ? LIMIT 1`
  ).get(input.competitionHabitId, input.competitionId) as
    | { kind?: string | null; scoringMode: CompetitionScoringMode; pointsPositive: number; pointsNegative: number }
    | undefined;
  if (!habit) throw new Error('Hábito competitivo no encontrado');
  if (normalizeCompetitionKind(habit.kind) !== 'event') throw new Error('Este hábito se registra por minutos');
  const date = input.date || getTodayDate();
  assertEditableDate(date);
  const link = getHabitLink(input.competitionHabitId, input.userId);

  if (link) setPersonalHabitStatus(link.personalHabitId, input.userId, date, input.status);
  else setCompetitionHabitStatus(input.competitionHabitId, input.userId, date, input.status);

  const todayStatus = getTodayProgressForHabit({
    id: input.competitionHabitId,
    competitionId: input.competitionId,
    name: '',
    description: null,
    category: null,
    kind: 'event',
    scoringMode: habit.scoringMode,
    pointsPositive: habit.pointsPositive,
    pointsNegative: habit.pointsNegative,
    minutesPerBlock: null,
    pointsPerBlock: null,
    dailyTargetMinutes: null,
    active: 1,
  }, input.userId, date);
  return {
    status: todayStatus.status,
    appliedToPersonal: !!link,
    personalHabitId: link?.personalHabitId ?? null,
    pointsDelta: pointsForEvent(habit.scoringMode, habit.pointsPositive, habit.pointsNegative, todayStatus.status),
  };
}

export function logCompetitionHabitDuration(input: {
  competitionId: number;
  competitionHabitId: number;
  userId: number;
  minutesDelta: number;
  date?: string;
}) {
  ensureCompetitionAccess(input.competitionId, input.userId, false);
  const sqlite = sqliteOrThrow();
  const habit = sqlite.prepare(
    `SELECT kind, minutes_per_block as minutesPerBlock, points_per_block as pointsPerBlock
     FROM competition_habits WHERE id = ? AND competition_id = ? LIMIT 1`
  ).get(input.competitionHabitId, input.competitionId) as
    | { kind?: string | null; minutesPerBlock?: number | null; pointsPerBlock?: number | null }
    | undefined;
  if (!habit) throw new Error('Hábito competitivo no encontrado');
  if (normalizeCompetitionKind(habit.kind) !== 'duration') throw new Error('Este hábito no acepta minutos');

  const date = input.date || getTodayDate();
  assertEditableDate(date);
  const link = getHabitLink(input.competitionHabitId, input.userId);
  const result = link
    ? addPersonalHabitMinutes(link.personalHabitId, input.userId, date, input.minutesDelta)
    : addCompetitionHabitMinutes(input.competitionHabitId, input.userId, date, input.minutesDelta);

  const pointsDelta = pointsForDuration(result.minutesLogged, habit.minutesPerBlock ?? null, habit.pointsPerBlock ?? null);
  if (!link) {
    sqlite.prepare(
      `UPDATE competition_habit_logs
       SET points_awarded = ?, updated_at = ?
       WHERE competition_habit_id = ? AND user_id = ? AND date = ?`
    ).run(pointsDelta, new Date().toISOString(), input.competitionHabitId, input.userId, date);
  }

  return {
    status: result.minutesLogged > 0 ? ('positive' as CompetitionLogStatus) : ('clear' as CompetitionLogStatus),
    appliedToPersonal: !!link,
    personalHabitId: link?.personalHabitId ?? null,
    pointsDelta,
    minutesLogged: result.minutesLogged,
  };
}

export function recomputeLinkedCompetitionForDay(input: {
  userId: number;
  date: string;
  personalHabitIds: number[];
}) {
  const sqlite = sqliteOrThrow();
  const now = new Date().toISOString();
  const uniquePersonal = Array.from(new Set(input.personalHabitIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (uniquePersonal.length === 0) return [];

  const results: Array<{ competitionHabitId: number; kind: CompetitionHabitKind; status?: CompetitionLogStatus; minutesLogged?: number; points: number }> = [];

  for (const personalHabitId of uniquePersonal) {
    const links = sqlite.prepare(
      `SELECT ch.id as competitionHabitId,
              ch.kind as kind,
              ch.scoring_mode as scoringMode,
              ch.points_positive as pointsPositive,
              ch.points_negative as pointsNegative,
              ch.minutes_per_block as minutesPerBlock,
              ch.points_per_block as pointsPerBlock
       FROM competition_habit_links chl
       JOIN competition_habits ch ON ch.id = chl.competition_habit_id
       WHERE chl.personal_habit_id = ? AND chl.user_id = ? AND ch.active = 1`
    ).all(personalHabitId, input.userId) as Array<{
      competitionHabitId: number;
      kind?: string | null;
      scoringMode: CompetitionScoringMode;
      pointsPositive: number;
      pointsNegative: number;
      minutesPerBlock?: number | null;
      pointsPerBlock?: number | null;
    }>;

    for (const link of links) {
      const kind = normalizeCompetitionKind(link.kind) as CompetitionHabitKind;
      if (kind === 'duration') {
        const personalRow = sqlite.prepare(
          `SELECT minutes_logged as minutesLogged
           FROM habit_logs WHERE habit_id = ? AND user_id = ? AND date = ? LIMIT 1`
        ).get(personalHabitId, input.userId, input.date) as { minutesLogged?: number | null } | undefined;
        const minutesLogged = Math.max(0, personalRow?.minutesLogged ?? 0);
        const setResult = addCompetitionHabitMinutes(link.competitionHabitId, input.userId, input.date, minutesLogged, 'set');
        const points = pointsForDuration(setResult.minutesLogged, link.minutesPerBlock ?? null, link.pointsPerBlock ?? null);
        sqlite.prepare(
          `UPDATE competition_habit_logs
           SET points_awarded = ?, updated_at = ?
           WHERE competition_habit_id = ? AND user_id = ? AND date = ?`
        ).run(points, now, link.competitionHabitId, input.userId, input.date);
        results.push({ competitionHabitId: link.competitionHabitId, kind, minutesLogged: setResult.minutesLogged, points });
        continue;
      }

      const personalRow = sqlite.prepare(
        `SELECT status, completed
         FROM habit_logs WHERE habit_id = ? AND user_id = ? AND date = ? LIMIT 1`
      ).get(personalHabitId, input.userId, input.date) as { status?: string | null; completed?: number | null } | undefined;
      const rawStatus = statusFromPersonalRow(personalRow);
      setCompetitionHabitStatus(link.competitionHabitId, input.userId, input.date, rawStatus);
      const effective = effectiveEventStatus({ kind: 'event', scoringMode: link.scoringMode } as any, rawStatus, input.date);
      const points = pointsForEvent(link.scoringMode, link.pointsPositive, link.pointsNegative, effective);
      if (rawStatus !== 'clear') {
        sqlite.prepare(
          `UPDATE competition_habit_logs
           SET points_awarded = ?, updated_at = ?
           WHERE competition_habit_id = ? AND user_id = ? AND date = ?`
        ).run(points, now, link.competitionHabitId, input.userId, input.date);
      }
      results.push({ competitionHabitId: link.competitionHabitId, kind, status: effective, points });
    }
  }

  return results;
}
