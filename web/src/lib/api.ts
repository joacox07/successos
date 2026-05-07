const API_BASE = '/api';

type AuthTokenPayload = {
  exp?: number;
  isAdmin?: boolean;
  profileComplete?: boolean;
};

function getToken(): string | null {
  return localStorage.getItem('successos_token');
}

function normalizeExpiry(exp?: number): number | null {
  if (!Number.isFinite(exp)) return null;
  return (exp as number) < 1_000_000_000_000 ? (exp as number) * 1000 : (exp as number);
}

function decodeTokenPayload(token: string | null): AuthTokenPayload | null {
  if (!token) return null;
  try {
    const [payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded)) as AuthTokenPayload;
  } catch {
    return null;
  }
}

function readTokenPayload() {
  return decodeTokenPayload(getToken());
}

export function setToken(token: string) {
  localStorage.setItem('successos_token', token);
}

export function clearToken() {
  localStorage.removeItem('successos_token');
}

export function isAuthenticated(): boolean {
  const payload = readTokenPayload();
  const expiry = normalizeExpiry(payload?.exp);
  return !!expiry && expiry > Date.now();
}

export function isAdminToken(): boolean {
  const payload = readTokenPayload();
  const expiry = normalizeExpiry(payload?.exp);
  return !!payload?.isAdmin && !!expiry && expiry > Date.now();
}

export function isProfileComplete(): boolean {
  const payload = readTokenPayload();
  if (!payload) return true;
  if (payload.isAdmin) return true;
  return !!payload.profileComplete;
}

async function fetchApi<T>(path: string, options?: RequestInit & { redirectOnUnauthorized?: boolean }): Promise<T> {
  const token = getToken();
  const { redirectOnUnauthorized = true, ...requestOptions } = options || {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...requestOptions.headers,
    },
  });

  if (res.status === 401 && redirectOnUnauthorized) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `Error del servidor (${res.status})` }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const api = {
  login: (username: string, password: string) =>
    fetchApi<{ ok: true; token: string; isAdmin: boolean; profileComplete?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      redirectOnUnauthorized: false,
    }),

  // Chat (conversational AI input)
  sendChatMessage: async (text: string): Promise<ChatResponse> => {
    const token = getToken();
    const form = new FormData();
    form.append('text', text);
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (res.status === 401) { clearToken(); window.location.href = '/login'; throw new Error('Unauthorized'); }
    if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Error' })); throw new Error(e.error); }
    return res.json();
  },

  sendChatAudio: async (blob: Blob): Promise<ChatResponse> => {
    const token = getToken();
    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (res.status === 401) { clearToken(); window.location.href = '/login'; throw new Error('Unauthorized'); }
    if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Error' })); throw new Error(e.error); }
    return res.json();
  },

  getChatHistory: (limit = 50) =>
    fetchApi<ChatHistoryData>(`/chat/history?limit=${limit}`),

  // Check-in
  getCheckinToday: () =>
    fetchApi<CheckinTodayData>('/checkin/today'),

  getCheckinByDate: (date: string) =>
    fetchApi<CheckinTodayData>(`/checkin/${date}`),

  submitCheckin: (data: Record<string, any>) =>
    fetchApi<{ ok: boolean }>('/checkin', { method: 'POST', body: JSON.stringify(data) }),

  // Data
  getDashboard: () =>
    fetchApi<DashboardData>('/dashboard'),

  getHabitWidgetSummary: (ids?: number[]) =>
    fetchApi<HabitWidgetSummary>(
      `/dashboard/habit-summary${ids && ids.length > 0 ? `?ids=${ids.join(',')}` : ''}`,
    ),

  getMetrics: (range: 'week' | 'month' | 'total' = 'week') =>
    fetchApi<MetricsData>(`/metrics?range=${range}`),

  getGoals: () =>
    fetchApi<GoalsData>('/goals'),

  getInsights: () =>
    fetchApi<InsightsData>('/insights'),

  getReport: (type: 'weekly' | 'monthly') =>
    fetchApi<ReportData>(`/reports/${type}`),

  getTimeline: (limit = 20) =>
    fetchApi<TimelineData>(`/timeline?limit=${limit}`),

  // Habits
  getHabits: (date?: string) =>
    fetchApi<HabitsData>(`/habits${date ? `?date=${date}` : ''}`),

  createHabit: (data: { name: string; emoji?: string; category?: string; frequency?: string; isNegative?: boolean }) =>
    fetchApi<{ ok: boolean; habit: Habit }>('/habits', { method: 'POST', body: JSON.stringify(data) }),

  updateHabit: (id: number, data: { name?: string; emoji?: string; category?: string; isNegative?: boolean }) =>
    fetchApi<{ ok: boolean }>(`/habits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteHabit: (id: number) =>
    fetchApi<{ ok: boolean }>(`/habits/${id}`, { method: 'DELETE' }),

  toggleHabit: (id: number, date?: string) =>
    fetchApi<{ ok: boolean; completed: boolean; habits?: HabitsData }>(`/habits/${id}/toggle`, {
      method: 'POST', body: JSON.stringify({ date }),
    }),

  setHabitStatus: (id: number, status: 'positive' | 'negative' | 'clear', date?: string) =>
    fetchApi<{ ok: boolean; status: string; marked: boolean; habits?: HabitsData }>(`/habits/${id}/status`, {
      method: 'POST', body: JSON.stringify({ status, date }),
    }),

  setHabitMinutes: (id: number, minutes: number, date?: string, mode: 'add' | 'set' = 'set') =>
    fetchApi<{ ok: boolean; minutesLogged: number; targetMinutes: number | null; completed: boolean; status: string; habits?: HabitsData }>(`/habits/${id}/minutes`, {
      method: 'POST', body: JSON.stringify({ minutes, date, mode }),
    }),

  getHabitCalendar: (id: number, month: string) =>
    fetchApi<HabitCalendarData>(`/habits/${id}/calendar?month=${month}`),

  // Competitions
  discoverCompetitionUser: (username: string) =>
    fetchApi<CompetitionInviteSearchResult>(`/competition/discover?username=${encodeURIComponent(username)}`),

  discoverCompetitionInvite: (competitionId: number, username: string) =>
    fetchApi<CompetitionInviteSearchResult>(`/competition/discover?competitionId=${competitionId}&username=${encodeURIComponent(username)}`),

  getCompetitions: () =>
    fetchApi<{ competitions: CompetitionSummary[] }>('/competitions'),

  getCompetitionInvites: () =>
    fetchApi<{ invites: CompetitionInvite[] }>('/competitions/invites'),

  createCompetition: (data: { name: string; participantUserIds?: number[] }) =>
    fetchApi<{ ok: boolean; competitionId: number }>('/competitions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCompetition: (id: number, data: { name: string }) =>
    fetchApi<{ ok: boolean }>(`/competitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCompetition: (id: number) =>
    fetchApi<{ ok: boolean }>(`/competitions/${id}`, { method: 'DELETE' }),

  getCompetitionDetail: (id: number) =>
    fetchApi<CompetitionDetail>(`/competitions/${id}`),

  getCompetitionInviteOptions: (id: number, limit = 10) =>
    fetchApi<{ candidates: CompetitionInviteCandidate[] }>(`/competitions/${id}/invite-options?limit=${limit}`),

  inviteToCompetition: (id: number, username: string) =>
    fetchApi<{ ok: boolean; invitedUser: CompetitionUser }>(`/competitions/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  respondCompetitionInvite: (id: number, action: 'accepted' | 'declined') =>
    fetchApi<{ ok: boolean }>(`/competitions/${id}/respond-invite`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  createCompetitionHabit: (id: number, data: CreateCompetitionHabit) =>
    fetchApi<{ ok: boolean; habitId: number }>(`/competitions/${id}/habits`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCompetitionHabit: (competitionId: number, competitionHabitId: number, data: CreateCompetitionHabit) =>
    fetchApi<{ ok: boolean }>(`/competitions/${competitionId}/habits/${competitionHabitId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCompetitionHabit: (competitionId: number, competitionHabitId: number) =>
    fetchApi<{ ok: boolean }>(`/competitions/${competitionId}/habits/${competitionHabitId}`, {
      method: 'DELETE',
    }),

  getCompetitionStats: (id: number, range: CompetitionRange) =>
    fetchApi<CompetitionDashboardStats>(`/competitions/${id}/stats?range=${range}`),

  linkCompetitionHabitExisting: (competitionId: number, competitionHabitId: number, personalHabitId: number) =>
    fetchApi<{ ok: boolean }>(`/competitions/${competitionId}/habits/${competitionHabitId}/link-existing`, {
      method: 'POST',
      body: JSON.stringify({ personalHabitId }),
    }),

  applySuggestedCompetitionHabitLink: (competitionId: number, competitionHabitId: number) =>
    fetchApi<{ ok: boolean; personalHabitId: number; personalHabitName: string }>(
      `/competitions/${competitionId}/habits/${competitionHabitId}/apply-suggested-link`,
      { method: 'POST' },
    ),

  createAndLinkCompetitionHabit: (competitionId: number, competitionHabitId: number) =>
    fetchApi<{ ok: boolean; personalHabitId: number }>(`/competitions/${competitionId}/habits/${competitionHabitId}/create-and-link`, {
      method: 'POST',
    }),

  unlinkCompetitionHabit: (competitionId: number, competitionHabitId: number) =>
    fetchApi<{ ok: boolean }>(`/competitions/${competitionId}/habits/${competitionHabitId}/link`, {
      method: 'DELETE',
    }),

  logCompetitionHabit: (competitionId: number, competitionHabitId: number, status: CompetitionLogStatus, date?: string) =>
    fetchApi<CompetitionHabitLogResult>(`/competitions/${competitionId}/habits/${competitionHabitId}/log`, {
      method: 'POST',
      body: JSON.stringify({ status, date }),
    }),

  logCompetitionHabitDuration: (competitionId: number, competitionHabitId: number, minutesDelta: number, date?: string) =>
    fetchApi<CompetitionHabitLogResult>(`/competitions/${competitionId}/habits/${competitionHabitId}/log-duration`, {
      method: 'POST',
      body: JSON.stringify({ minutesDelta, date }),
    }),

  checkUsernameAvailability: (username: string) =>
    fetchApi<{ available: boolean; normalized: string; message: string }>(`/profile/username-availability?username=${encodeURIComponent(username)}`),

  // Study
  createStudySession: (data: CreateStudySession) =>
    fetchApi<{ ok: boolean }>('/study/sessions', { method: 'POST', body: JSON.stringify(data) }),

  getStudySessions: (range: 'week' | 'month' | 'year' = 'week') =>
    fetchApi<StudySessionsData>(`/study/sessions?range=${range}`),

  getStudyStats: () =>
    fetchApi<StudyStatsData>('/study/stats'),

  // Flashcards
  getDecks: () =>
    fetchApi<{ decks: FlashcardDeck[] }>('/flashcards/decks'),

  createDeck: (name: string, emoji?: string) =>
    fetchApi<{ ok: boolean; deck: FlashcardDeck }>('/flashcards/decks', {
      method: 'POST', body: JSON.stringify({ name, emoji }),
    }),

  deleteDeck: (id: number) =>
    fetchApi<{ ok: boolean }>(`/flashcards/decks/${id}`, { method: 'DELETE' }),

  getDeckCards: (deckId: number) =>
    fetchApi<{ cards: Flashcard[] }>(`/flashcards/decks/${deckId}/cards`),

  getCardsForReview: (deckId: number) =>
    fetchApi<{ cards: Flashcard[] }>(`/flashcards/decks/${deckId}/review`),

  createCard: (deckId: number, front: string, back: string) =>
    fetchApi<{ ok: boolean; card: Flashcard }>('/flashcards/cards', {
      method: 'POST', body: JSON.stringify({ deckId, front, back }),
    }),

  reviewCard: (cardId: number, quality: number) =>
    fetchApi<{ ok: boolean; nextReview: string; interval: number }>(`/flashcards/cards/${cardId}/review`, {
      method: 'PUT', body: JSON.stringify({ quality }),
    }),

  deleteCard: (cardId: number) =>
    fetchApi<{ ok: boolean }>(`/flashcards/cards/${cardId}`, { method: 'DELETE' }),

  // Study Subjects (Spaced Rep)
  getSubjects: () =>
    fetchApi<{ subjects: StudySubject[] }>('/study/subjects'),

  createSubject: (name: string) =>
    fetchApi<{ ok: boolean; subject: StudySubject }>('/study/subjects', {
      method: 'POST', body: JSON.stringify({ name }),
    }),

  markSubjectStudied: (id: number) =>
    fetchApi<{ ok: boolean; subject: StudySubject }>(`/study/subjects/${id}/studied`, { method: 'POST' }),

  deleteSubject: (id: number) =>
    fetchApi<{ ok: boolean }>(`/study/subjects/${id}`, { method: 'DELETE' }),

  // Goals CRUD
  createGoal: (data: { title: string; category: string; description?: string; metric?: string; targetValue?: string; unit?: string; deadline?: string; priority?: number }) =>
    fetchApi<{ ok: boolean; goalId: number }>('/goals', { method: 'POST', body: JSON.stringify(data) }),

  updateGoal: (id: number, data: Record<string, any>) =>
    fetchApi<{ ok: boolean }>(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteGoal: (id: number) =>
    fetchApi<{ ok: boolean }>(`/goals/${id}`, { method: 'DELETE' }),

  // Profile & Schedule
  getProfile: () =>
    fetchApi<ProfileData>('/profile'),

  updateProfile: (data: { name?: string; username?: string; avatar?: AvatarConfig }) =>
    fetchApi<{ ok: boolean }>('/profile', { method: 'PUT', body: JSON.stringify(data) }),

  updateSchedule: (data: { morningCheckIn?: string; eveningCheckIn?: string; defaultCheckinDayMode?: 'today' | 'previous_day' }) =>
    fetchApi<{ ok: boolean }>('/profile/schedule', { method: 'PUT', body: JSON.stringify(data) }),

  // Day detail (diary)
  getDayEntries: (date: string) =>
    fetchApi<DayEntriesData>(`/day/${date}`),

  // Data reset
  resetAllData: () =>
    fetchApi<{ ok: boolean; message: string }>('/data/reset', { method: 'DELETE', body: JSON.stringify({ confirm: 'BORRAR TODO' }) }),

  // Admin
  adminGetUsers: () =>
    fetchApi<{ users: AdminUser[] }>('/admin/users'),

  adminCreateUser: (data: { name: string; phone?: string; password: string }) =>
    fetchApi<{ ok: boolean; userId: number }>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),

  adminDeleteUser: (id: number) =>
    fetchApi<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),

  adminResetPassword: (id: number, password: string) =>
    fetchApi<{ ok: boolean }>(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),

  // Profile setup
  setupProfile: (data: {
    name: string;
    email: string;
    phone: string;
    newPassword: string;
    age?: number;
    height?: number;
    weight?: number;
    habits?: Array<{ name: string; emoji?: string; category?: string }>;
  }) =>
    fetchApi<{ ok: boolean; token: string }>('/profile/setup', { method: 'POST', body: JSON.stringify(data) }),

  // Guide chat (pattern analysis AI)
  sendGuideMessage: (text: string) =>
    fetchApi<{ response: string }>('/guide/chat', { method: 'POST', body: JSON.stringify({ text }) }),

  getGuideHistory: () =>
    fetchApi<GuideHistoryData>('/guide/chat'),

  // Calendar
  getCalendarStatus: () =>
    fetchApi<{ connected: boolean }>('/calendar/status'),

  getCalendarConnectUrl: () =>
    fetchApi<{ authUrl: string }>('/calendar/connect'),

  getCalendarEvents: (date?: string, days?: number) =>
    fetchApi<{ events: CalendarEvent[] }>(`/calendar/events${date ? `?date=${date}&days=${days ?? 14}` : `?days=${days ?? 14}`}`),

  createCalendarEvent: (data: { summary: string; date: string; time?: string; endTime?: string; description?: string; allDay?: boolean }) =>
    fetchApi<{ ok: boolean; event: CalendarEvent }>('/calendar/events', { method: 'POST', body: JSON.stringify(data) }),

  deleteCalendarEvent: (id: string) =>
    fetchApi<{ ok: boolean }>(`/calendar/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  calendarChat: (text: string, history?: { role: string; content: string }[], date?: string) =>
    fetchApi<{ response: string }>('/calendar/chat', { method: 'POST', body: JSON.stringify({ text, history, date }) }),
};

// Admin
export interface AdminUser {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  profile_complete: number;
  created_at: string;
}

// Types
export type AvatarConfig =
  | { type: 'initials' }
  | { type: 'icon'; name: string; color: string };

export interface ProfileData {
  name: string;
  username: string | null;
  morningCheckIn: string;
  eveningCheckIn: string;
  defaultCheckinDayMode: 'today' | 'previous_day';
  createdAt: string;
  totalEntries: number;
}

export interface DashboardData {
  date: string;
  score: number | null;
  entry: Record<string, unknown> | null;
  goals: GoalSummary[];
  patterns: PatternSummary[];
}

export interface GoalSummary {
  id: number;
  title: string;
  category: string;
  currentValue: string | null;
  targetValue: string | null;
  unit: string | null;
  progress: number;
}

export interface PatternSummary {
  areaA: string;
  areaB: string;
  correlation: number | null;
  description: string | null;
}

export interface MetricsData {
  range: string;
  start: string;
  end: string;
  entries: MetricEntry[];
}

export interface MetricEntry {
  date: string;
  sleepQuality: number | null;
  bedtime: string | null;
  wakeTime: string | null;
  mood: number | null;
  energyLevel: number | null;
  exerciseDone: boolean | null;
  exerciseDuration: number | null;
  focusHours: number | null;
  dietQuality: number | null;
  dayRating: number | null;
  overallScore: number | null;
}

export interface GoalsData {
  goals: Array<GoalSummary & {
    description: string | null;
    metric: string | null;
    deadline: string | null;
    status: string | null;
    priority: number | null;
  }>;
}

export interface InsightsData {
  correlations: Array<{
    areaA: string;
    areaB: string;
    correlation: number | null;
    dataPoints: number | null;
    confidence: number | null;
    description: string | null;
    patternType: string;
  }>;
}

export interface ReportData {
  report: {
    content: string;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
  } | null;
}

export interface TimelineData {
  messages: Array<{
    id: number;
    direction: string;
    contentType: string;
    content: string | null;
    timestamp: string;
  }>;
}

// ── Habits ──

export interface Habit {
  id: number;
  name: string;
  emoji: string | null;
  category: string | null;
  frequency: string;
  isNegative?: boolean;
  targetMinutes?: number | null;
}

export interface HabitsData {
  habits: Habit[];
  today: Record<number, boolean>;
  status?: Record<number, 'positive' | 'negative' | 'clear'>;
  minutes?: Record<number, number>;
}

export interface HabitCalendarData {
  dates: string[];
  successDates: string[];
  failureDates: string[];
  streak: number;
  completionRate: number;
  daysCompleted: number;
  totalDays: number;
}

export interface HabitWidgetSummary {
  date: string;
  completedCount: number;
  totalCount: number;
  completionRate: number;
  streak: number;
  criticalHabits: Array<{
    id: number;
    name: string;
    isNegative: boolean;
    status: 'positive' | 'negative' | 'clear';
    completed: boolean;
  }>;
  pendingHabits: Array<{
    id: number;
    name: string;
    isNegative: boolean;
    status: 'positive' | 'negative' | 'clear';
    completed: boolean;
  }>;
}

export type CompetitionRange = 'week' | 'month' | 'total';
export type CompetitionScoringMode = 'positive_only' | 'negative_only' | 'both';
export type CompetitionLogStatus = 'positive' | 'negative' | 'clear';
export type CompetitionHabitKind = 'event' | 'duration';

export interface CompetitionUser {
  id: number;
  name: string | null;
  username: string | null;
}

export type CompetitionInviteSearchStatus =
  | 'found'
  | 'not_found'
  | 'self'
  | 'already_invited'
  | 'already_participant';

export interface CompetitionInviteSearchResult {
  status: CompetitionInviteSearchStatus;
  message: string;
  user: CompetitionUser | null;
  canInvite: boolean;
}

export interface CompetitionInviteCandidate {
  id: number;
  name: string | null;
  username: string | null;
  status: 'invitable' | 'self' | 'pending' | 'accepted';
  message: string;
  canInvite: boolean;
}

export interface CompetitionSummary {
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

export interface CompetitionInvite {
  competitionId: number;
  name: string;
  invitedAt: string;
  ownerUsername: string | null;
  ownerName: string | null;
}

export interface CompetitionParticipant {
  userId: number;
  name: string | null;
  username: string | null;
  role: string;
  inviteStatus: string;
  joinedAt: string | null;
}

export interface CompetitionHabit {
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
  linkedPersonalHabitId: number | null;
  todayStatus: CompetitionLogStatus;
  todayMinutes?: number;
  todayPoints?: number;
  syncState: 'linked' | 'suggested_match' | 'create_in_profile';
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

export interface CompetitionDetail {
  competition: {
    id: number;
    name: string;
    status: string;
    createdByMode: string;
    createdAt: string;
    updatedAt: string;
  };
  viewer: {
    userId: number | null;
    username: string | null;
    missingUsername: boolean;
  };
  participants: CompetitionParticipant[];
  habits: CompetitionHabit[];
  personalHabits: Habit[];
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
  minutesLogged?: number;
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

export interface CompetitionHabitLogResult {
  ok: boolean;
  status: CompetitionLogStatus;
  appliedToPersonal: boolean;
  personalHabitId: number | null;
  pointsDelta: number;
  minutesLogged?: number;
}

export interface CreateCompetitionHabit {
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
}

// ── Study ──

export interface StudySession {
  id: number;
  date: string;
  method: string;
  subject: string | null;
  focusMinutes: number;
  breakMinutes: number | null;
  cyclesCompleted: number | null;
  cardsReviewed: number | null;
  quality: number | null;
  startedAt: string;
  endedAt: string | null;
}

export interface CreateStudySession {
  method: string;
  subject?: string;
  focusMinutes: number;
  breakMinutes?: number;
  cyclesCompleted?: number;
  cardsReviewed?: number;
  quality?: number;
  note?: string;
  startedAt: string;
  endedAt?: string;
}

export interface StudySessionsData {
  sessions: StudySession[];
}

export interface StudyStatsData {
  totalFocusMinutes: number;
  sessionsCount: number;
  avgQuality: number | null;
  streak: number;
  dailyMinutes: Array<{ date: string; minutes: number }>;
}

// ── Flashcards ──

export interface FlashcardDeck {
  id: number;
  name: string;
  emoji: string | null;
  cardCount: number;
}

export interface Flashcard {
  id: number;
  deckId: number;
  front: string;
  back: string;
  easeFactor: number;
  interval: number;
  nextReview: string | null;
  repetitions: number;
}

// ── Study Subjects ──

export interface StudySubject {
  id: number;
  name: string;
  lastStudied: string | null;
  nextReview: string | null;
  reviewStage: number;
}

// ── Chat ──

export interface ChatMessage {
  id: number;
  direction: 'in' | 'out';
  contentType: string;
  content: string | null;
  extractedData: Record<string, any> | null;
  timestamp: string;
}

export interface ChatResponse {
  response: string;
  extractedData: Record<string, any> | null;
  currentEntry: Record<string, any> | null;
  entryDate?: string;
  streak: number;
  transcription?: string;
}

export interface ChatHistoryData {
  messages: ChatMessage[];
  currentEntry: Record<string, any> | null;
  streak: number;
}

// ── Guide ──

export interface GuideMessage {
  id: number;
  direction: 'in' | 'out';
  content: string | null;
  timestamp: string;
}

export interface GuideHistoryData {
  messages: GuideMessage[];
}

// ── Calendar ──

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: string;
  end?: string;
  allDay?: boolean;
}

// ── Check-in ──

export interface CheckinTodayData {
  date: string;
  entry: Record<string, any> | null;
  streak: number;
}

// ── Day detail (diary) ──

export interface DayEntriesData {
  date: string;
  canEdit: boolean;
  editableWindowDays: number;
  entry: MetricEntry | null;
  messages: ChatMessage[];
  habits: Array<{
    id: number;
    name: string;
    emoji: string | null;
    category?: string | null;
    isNegative?: boolean;
    targetMinutes?: number | null;
    minutesLogged?: number;
    status?: 'positive' | 'negative' | 'clear';
    completed: boolean;
  }>;
  competitionHabits: Array<{
    competitionId: number;
    competitionName: string;
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
    linkedPersonalHabitId: number | null;
    status: CompetitionLogStatus;
    minutesLogged: number;
    pointsAwarded: number;
  }>;
  goals: GoalSummary[];
  studySessions: StudySession[];
}
