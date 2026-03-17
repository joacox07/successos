const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('successos_token');
}

export function setToken(token: string) {
  localStorage.setItem('successos_token', token);
}

export function clearToken() {
  localStorage.removeItem('successos_token');
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const [payloadB64] = token.split('.');
    const payload = JSON.parse(atob(payloadB64));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const api = {
  login: (username: string, password: string) =>
    fetchApi<{ ok: boolean; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
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

  submitCheckin: (data: Record<string, any>) =>
    fetchApi<{ ok: boolean }>('/checkin', { method: 'POST', body: JSON.stringify(data) }),

  // Data
  getDashboard: () =>
    fetchApi<DashboardData>('/dashboard'),

  getMetrics: (range: 'week' | 'month' | 'year' = 'week') =>
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
  getHabits: () =>
    fetchApi<HabitsData>('/habits'),

  createHabit: (data: { name: string; emoji?: string; category?: string; frequency?: string }) =>
    fetchApi<{ ok: boolean; habit: Habit }>('/habits', { method: 'POST', body: JSON.stringify(data) }),

  updateHabit: (id: number, data: { name?: string; emoji?: string; category?: string }) =>
    fetchApi<{ ok: boolean }>(`/habits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteHabit: (id: number) =>
    fetchApi<{ ok: boolean }>(`/habits/${id}`, { method: 'DELETE' }),

  toggleHabit: (id: number, date?: string) =>
    fetchApi<{ ok: boolean; completed: boolean }>(`/habits/${id}/toggle`, {
      method: 'POST', body: JSON.stringify({ date }),
    }),

  getHabitCalendar: (id: number, month: string) =>
    fetchApi<HabitCalendarData>(`/habits/${id}/calendar?month=${month}`),

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

  updateProfile: (data: { name?: string; avatar?: AvatarConfig }) =>
    fetchApi<{ ok: boolean }>('/profile', { method: 'PUT', body: JSON.stringify(data) }),

  updateSchedule: (data: { morningCheckIn?: string; eveningCheckIn?: string }) =>
    fetchApi<{ ok: boolean }>('/profile/schedule', { method: 'PUT', body: JSON.stringify(data) }),

  // Day detail (diary)
  getDayEntries: (date: string) =>
    fetchApi<DayEntriesData>(`/day/${date}`),

  // Data reset
  resetAllData: () =>
    fetchApi<{ ok: boolean; message: string }>('/data/reset', { method: 'DELETE', body: JSON.stringify({ confirm: 'BORRAR TODO' }) }),
};

// Types
export type AvatarConfig =
  | { type: 'initials' }
  | { type: 'icon'; name: string; color: string };

export interface ProfileData {
  name: string;
  morningCheckIn: string;
  eveningCheckIn: string;
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
}

export interface HabitsData {
  habits: Habit[];
  today: Record<number, boolean>;
}

export interface HabitCalendarData {
  dates: string[];
  streak: number;
  completionRate: number;
  daysCompleted: number;
  totalDays: number;
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
  streak: number;
  transcription?: string;
}

export interface ChatHistoryData {
  messages: ChatMessage[];
  currentEntry: Record<string, any> | null;
  streak: number;
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
  entry: MetricEntry | null;
  messages: ChatMessage[];
  habits: Array<{ id: number; name: string; emoji: string | null; completed: boolean }>;
  goals: GoalSummary[];
  studySessions: StudySession[];
}
