import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  api,
  type CompetitionDashboardStats,
  type CompetitionDetail,
  type CompetitionHabit,
  type CompetitionHabitKind,
  type CompetitionInviteCandidate,
  type CompetitionInviteSearchResult,
  type CompetitionParticipantAnalyticsRow,
  type CompetitionRange,
  type CompetitionScoringMode,
  type CompetitionSummary,
  type Habit,
} from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatDate } from '@/lib/utils';
import Icon from '@/components/Icon';

type CompetitionView = 'summary' | 'habit' | 'rival';

const CHART_COLORS = ['#00c27a', '#ff6b00', '#ffb000', '#0066ff', '#7c3aed', '#e11d48'];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-3xl border border-white/[0.08] bg-bg-card p-4 md:p-5', className)}>{children}</div>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">{title}</p>
      {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
    </div>
  );
}

function CollapsibleCard({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-white/[0.02] p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left md:px-5 md:py-5"
      >
        <SectionTitle title={title} subtitle={subtitle} />
        <Icon
          name="chevron-down"
          size={16}
          className={cn('mt-0.5 shrink-0 text-text-muted transition-transform duration-200', open && 'rotate-180 text-text-primary')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  helper,
  tone = 'default',
  compact = false,
}: {
  label: string;
  value: string;
  helper: string;
  tone?: 'default' | 'mint' | 'coral';
  compact?: boolean;
}) {
  const toneClass = tone === 'mint' ? 'text-accent-mint' : tone === 'coral' ? 'text-accent-coral' : 'text-text-primary';
  return (
    <Card className={cn('bg-white/[0.03]', compact && 'p-3 md:p-5')}>
      <div className={cn('space-y-2', compact && 'flex h-full min-h-[132px] flex-col justify-between md:block md:min-h-0')}>
        <p className={cn('text-[11px] uppercase tracking-[0.18em] text-text-muted', compact && 'text-[10px] leading-tight')}>{label}</p>
        <p className={cn('font-bold tracking-tight', toneClass, compact ? 'text-3xl leading-none' : 'text-3xl')}>{value}</p>
        <p className={cn('text-xs text-text-secondary', compact && 'hidden md:block')}>{helper}</p>
      </div>
    </Card>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed border-white/[0.12] bg-white/[0.02]">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-secondary">{body}</p>
    </Card>
  );
}

function RangeTabs({ value, onChange }: { value: CompetitionRange; onChange: (range: CompetitionRange) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
      {([
        ['week', 'Semana'],
        ['month', 'Mes'],
        ['total', 'Total'],
      ] as Array<[CompetitionRange, string]>).map(([range, label]) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
            value === range ? 'bg-accent-mint/15 text-accent-mint' : 'text-text-muted hover:text-text-primary',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ViewTabs({ value, onChange }: { value: CompetitionView; onChange: (view: CompetitionView) => void }) {
  const options: Array<{ id: CompetitionView; label: string; helper: string; icon: 'star' | 'target' | 'users' }> = [
    { id: 'summary', label: 'Resumen', helper: 'Estado general', icon: 'star' },
    { id: 'habit', label: 'Por hábito', helper: 'Detalle puntual', icon: 'target' },
    { id: 'rival', label: 'Rivales', helper: 'Duelo directo', icon: 'users' },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map(({ id, label, helper, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'rounded-2xl border px-3 py-3 text-left transition-colors',
            value === id
              ? 'border-accent-amber/35 bg-accent-amber/15 text-accent-amber shadow-[0_0_0_1px_rgba(255,176,0,0.15)]'
              : 'border-white/[0.08] bg-white/[0.03] text-text-muted hover:border-white/[0.14] hover:text-text-primary',
          )}
        >
          <div className="flex items-start gap-2">
            <Icon name={icon} size={14} className={cn('mt-0.5', value === id ? 'text-accent-amber' : 'text-text-muted')} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
              <p className={cn('mt-1 text-[11px]', value === id ? 'text-accent-amber/90' : 'text-text-secondary')}>{helper}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function scoringModeLabel(mode: CompetitionScoringMode) {
  switch (mode) {
    case 'negative_only':
      return 'Solo resta por recaÃ­da';
    case 'both':
      return 'Suma por Ã©xito y resta por recaÃ­da';
    default:
      return 'Solo suma por Ã©xito';
  }
}

function statusLabel(habit: CompetitionHabit) {
  if (habit.kind === 'duration') {
    if ((habit.todayMinutes ?? 0) > 0) {
      return `Hoy: ${habit.todayMinutes} min Â· ${habit.todayPoints ?? 0} pts`;
    }
    return 'Hoy: sin minutos';
  }
  switch (habit.todayStatus) {
    case 'positive':
      return 'Hoy: Ã©xito';
    case 'negative':
      return 'Hoy: recaÃ­da';
    default:
      return 'Hoy: sin registrar';
  }
}

function participantLabel(name: string | null, username: string | null, userId: number) {
  return username ? `@${username}` : name || `Usuario ${userId}`;
}

function canLogNegative(habit: CompetitionHabit) {
  return habit.kind === 'event' && (habit.scoringMode === 'negative_only' || habit.scoringMode === 'both');
}

function durationConfigLabel(habit: CompetitionHabit) {
  if (habit.kind !== 'duration') return scoringModeLabel(habit.scoringMode);
  const target = habit.dailyTargetMinutes ? ` Â· meta ${habit.dailyTargetMinutes} min` : '';
  return `${habit.minutesPerBlock ?? 30} min = ${habit.pointsPerBlock ?? 1} pt${target}`;
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function retroDateOptions() {
  const labels = ['Hoy', 'Ayer', 'Hace 2 dÃ­as', 'Hace 3 dÃ­as'];
  return labels.map((label, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return { label, value: toISODate(date) };
  });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const title = typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label) ? formatDate(label) : label;
  return (
    <div className="rounded-2xl border border-white/[0.1] bg-bg-card px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-text-primary">{title}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="font-mono text-text-primary">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompetitionsPage() {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [range, setRange] = useState<CompetitionRange>('week');
  const [view, setView] = useState<CompetitionView>('summary');
  const [competitionName, setCompetitionName] = useState('');
  const [creatingCompetition, setCreatingCompetition] = useState(false);
  const [competitionEditName, setCompetitionEditName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteResult, setInviteResult] = useState<CompetitionInviteSearchResult | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitDescription, setHabitDescription] = useState('');
  const [habitKind, setHabitKind] = useState<CompetitionHabitKind>('event');
  const [habitMode, setHabitMode] = useState<CompetitionScoringMode>('positive_only');
  const [pointsPositive, setPointsPositive] = useState(1);
  const [pointsNegative, setPointsNegative] = useState(0);
  const [minutesPerBlock, setMinutesPerBlock] = useState(30);
  const [pointsPerBlock, setPointsPerBlock] = useState(1);
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState('');
  const [durationInputs, setDurationInputs] = useState<Record<number, string>>({});
  const [selectedLinks, setSelectedLinks] = useState<Record<number, number | ''>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(null);
  const [rivalA, setRivalA] = useState<number | null>(null);
  const [rivalB, setRivalB] = useState<number | null>(null);
  const [inviteSectionOpen, setInviteSectionOpen] = useState(false);
  const [sharedHabitsSectionOpen, setSharedHabitsSectionOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const [editingHabitName, setEditingHabitName] = useState('');
  const [editingHabitDescription, setEditingHabitDescription] = useState('');
  const [editingHabitKind, setEditingHabitKind] = useState<CompetitionHabitKind>('event');
  const [editingHabitMode, setEditingHabitMode] = useState<CompetitionScoringMode>('positive_only');
  const [editingPointsPositive, setEditingPointsPositive] = useState(1);
  const [editingPointsNegative, setEditingPointsNegative] = useState(0);
  const [editingMinutesPerBlock, setEditingMinutesPerBlock] = useState(30);
  const [editingPointsPerBlock, setEditingPointsPerBlock] = useState(1);
  const [editingDailyTargetMinutes, setEditingDailyTargetMinutes] = useState('');
  const [logDate, setLogDate] = useState(() => toISODate(new Date()));

  const competitionsQuery = useApi(() => api.getCompetitions(), [refreshToken]);
  const invitesQuery = useApi(() => api.getCompetitionInvites(), [refreshToken]);
  const detailQuery = useApi<CompetitionDetail | null>(
    () => (selectedCompetitionId ? api.getCompetitionDetail(selectedCompetitionId) : Promise.resolve(null)),
    [selectedCompetitionId, refreshToken],
  );
  const statsQuery = useApi<CompetitionDashboardStats | null>(
    () => (selectedCompetitionId ? api.getCompetitionStats(selectedCompetitionId, range) : Promise.resolve(null)),
    [selectedCompetitionId, range, refreshToken],
  );
  const inviteOptionsQuery = useApi<{ candidates: CompetitionInviteCandidate[] } | null>(
    () => (selectedCompetitionId ? api.getCompetitionInviteOptions(selectedCompetitionId, 8) : Promise.resolve(null)),
    [selectedCompetitionId, refreshToken],
  );

  const competitions = competitionsQuery.data?.competitions ?? [];
  const competitionDetail = detailQuery.data;
  const competitionStats = statsQuery.data;
  const participants = competitionStats?.participants ?? [];
  const selectedHabit = competitionStats?.habits.find((habit) => habit.habitId === selectedHabitId) ?? competitionStats?.habits[0] ?? null;
  const rivalRows = participants.filter((row) => row.userId === rivalA || row.userId === rivalB);

  useEffect(() => {
    if (!selectedCompetitionId && competitions.length > 0) setSelectedCompetitionId(competitions[0].id);
    if (selectedCompetitionId && !competitions.some((competition) => competition.id === selectedCompetitionId)) {
      setSelectedCompetitionId(competitions[0]?.id ?? null);
    }
  }, [competitions, selectedCompetitionId]);

  useEffect(() => {
    const map: Record<number, number | ''> = {};
    for (const habit of competitionDetail?.habits ?? []) {
      map[habit.id] = habit.linkedPersonalHabitId ?? habit.suggestedPersonalHabitId ?? '';
    }
    setSelectedLinks(map);
    setCompetitionEditName(competitionDetail?.competition.name ?? '');
  }, [competitionDetail]);

  useEffect(() => {
    if (!competitionStats?.habits.length) {
      setSelectedHabitId(null);
      return;
    }
    if (!selectedHabitId || !competitionStats.habits.some((habit) => habit.habitId === selectedHabitId)) {
      setSelectedHabitId(competitionStats.habits[0].habitId);
    }
  }, [competitionStats, selectedHabitId]);

  useEffect(() => {
    if (participants.length < 2) {
      setRivalA(participants[0]?.userId ?? null);
      setRivalB(null);
      return;
    }
    if (!rivalA || !participants.some((row) => row.userId === rivalA)) setRivalA(participants[0].userId);
    if (!rivalB || !participants.some((row) => row.userId === rivalB) || rivalA === rivalB) {
      setRivalB(participants.find((row) => row.userId !== (rivalA ?? participants[0].userId))?.userId ?? participants[1].userId);
    }
  }, [participants, rivalA, rivalB]);

  useEffect(() => {
    if (!selectedCompetitionId || !inviteUsername.trim()) {
      setInviteResult(null);
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        const result = await api.discoverCompetitionInvite(selectedCompetitionId, inviteUsername.trim());
        setInviteResult(result);
      } catch (err) {
        setInviteResult({
          status: 'not_found',
          message: err instanceof Error ? err.message : 'No se pudo validar el usuario.',
          user: null,
          canInvite: false,
        });
      }
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [inviteUsername, selectedCompetitionId]);

  const chartSeries = useMemo(() => {
    if (!competitionStats) return [];
    return competitionStats.timeline.map((row) => {
      const point: Record<string, string | number> = {
        date: row.date,
        netPoints: row.netPoints,
        exitos: row.positiveCount,
        recaidas: row.negativeCount,
      };
      row.participants.forEach((participant) => {
        point[`p_${participant.userId}`] = participant.cumulativePoints;
      });
      return point;
    });
  }, [competitionStats]);

  const habitComparisonSeries = useMemo(() => {
    if (!selectedHabit) return [];
    return selectedHabit.participants.map((participant) => ({
      name: participant.username ? `@${participant.username}` : participant.name,
      Puntos: participant.points,
      'Ã‰xitos': participant.positiveDays,
      'RecaÃ­das': participant.negativeDays,
      Cumplimiento: participant.completionRate,
    }));
  }, [selectedHabit]);

  const rivalComparisonSeries = useMemo(() => {
    if (rivalRows.length !== 2) return [];
    const [left, right] = rivalRows;
    const map = new Map<number, { name: string; left: number; right: number }>();
    left.habitBreakdown.forEach((habit) => {
      map.set(habit.habitId, { name: habit.habitName, left: habit.points, right: 0 });
    });
    right.habitBreakdown.forEach((habit) => {
      const row = map.get(habit.habitId);
      if (row) row.right = habit.points;
      else map.set(habit.habitId, { name: habit.habitName, left: 0, right: habit.points });
    });
    return [...map.values()].sort((a, b) => Math.abs(b.left - b.right) - Math.abs(a.left - a.right));
  }, [rivalRows]);

  async function handleCreateCompetition() {
    if (!competitionName.trim()) return;
    setCreatingCompetition(true);
    setErrorMessage(null);
    try {
      const result = await api.createCompetition({ name: competitionName.trim() });
      setCompetitionName('');
      setSelectedCompetitionId(result.competitionId);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo crear la competencia.');
    } finally {
      setCreatingCompetition(false);
    }
  }

  async function handleRenameCompetition() {
    if (!selectedCompetitionId || !competitionEditName.trim()) return;
    setBusyKey('rename-competition');
    setErrorMessage(null);
    try {
      await api.updateCompetition(selectedCompetitionId, { name: competitionEditName.trim() });
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo actualizar la competencia.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteCompetition() {
    if (!selectedCompetitionId) return;
    if (!window.confirm('Se va a borrar la competencia completa con sus hÃ¡bitos, invitaciones y logs.')) return;
    setBusyKey('delete-competition');
    setErrorMessage(null);
    try {
      await api.deleteCompetition(selectedCompetitionId);
      setSelectedCompetitionId(null);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo eliminar la competencia.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleInvite(username?: string) {
    const targetUsername = username ?? inviteUsername.trim();
    if (!selectedCompetitionId || !targetUsername) return;
    setBusyKey('invite');
    setErrorMessage(null);
    try {
      await api.inviteToCompetition(selectedCompetitionId, targetUsername);
      setInviteUsername('');
      setInviteResult(null);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo invitar al usuario.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleInviteResponse(competitionId: number, action: 'accepted' | 'declined') {
    setBusyKey(`invite-${competitionId}-${action}`);
    setErrorMessage(null);
    try {
      await api.respondCompetitionInvite(competitionId, action);
      if (action === 'accepted') setSelectedCompetitionId(competitionId);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo responder la invitaciÃ³n.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateHabit() {
    if (!selectedCompetitionId || !habitName.trim()) return;
    setBusyKey('create-habit');
    setErrorMessage(null);
    try {
      await api.createCompetitionHabit(selectedCompetitionId, {
        name: habitName.trim(),
        description: habitDescription.trim() || undefined,
        kind: habitKind,
        scoringMode: habitMode,
        pointsPositive: habitKind === 'duration' ? 0 : pointsPositive,
        pointsNegative: habitKind === 'duration' ? 0 : pointsNegative,
        minutesPerBlock: habitKind === 'duration' ? minutesPerBlock : null,
        pointsPerBlock: habitKind === 'duration' ? pointsPerBlock : null,
        dailyTargetMinutes: habitKind === 'duration' && dailyTargetMinutes.trim() ? Number(dailyTargetMinutes) : null,
      });
      setHabitName('');
      setHabitDescription('');
      setHabitKind('event');
      setHabitMode('positive_only');
      setPointsPositive(1);
      setPointsNegative(0);
      setMinutesPerBlock(30);
      setPointsPerBlock(1);
      setDailyTargetMinutes('');
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo crear el hÃ¡bito compartido.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleLinkExisting(habitId: number) {
    const personalHabitId = selectedLinks[habitId];
    if (!selectedCompetitionId || !personalHabitId) return;
    setBusyKey(`link-${habitId}`);
    setErrorMessage(null);
    try {
      await api.linkCompetitionHabitExisting(selectedCompetitionId, habitId, Number(personalHabitId));
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo vincular el hÃ¡bito.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateAndLink(habitId: number) {
    if (!selectedCompetitionId) return;
    setBusyKey(`create-link-${habitId}`);
    setErrorMessage(null);
    try {
      await api.createAndLinkCompetitionHabit(selectedCompetitionId, habitId);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo crear y vincular el hÃ¡bito.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSyncAllHabitsToProfile() {
    if (!selectedCompetitionId || !competitionDetail) return;
    setBusyKey('sync-all-habits');
    setErrorMessage(null);
    try {
      for (const habit of competitionDetail.habits) {
        if (habit.linkedPersonalHabitId) continue;
        if (habit.syncState === 'suggested_match' && habit.suggestedPersonalHabitId) {
          await api.applySuggestedCompetitionHabitLink(selectedCompetitionId, habit.id);
        } else {
          await api.createAndLinkCompetitionHabit(selectedCompetitionId, habit.id);
        }
      }
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudieron pasar todos los hÃ¡bitos al tracker personal.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleApplySuggestedLink(habitId: number) {
    if (!selectedCompetitionId) return;
    setBusyKey(`suggested-link-${habitId}`);
    setErrorMessage(null);
    try {
      await api.applySuggestedCompetitionHabitLink(selectedCompetitionId, habitId);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo aplicar la sugerencia.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUnlink(habitId: number) {
    if (!selectedCompetitionId) return;
    setBusyKey(`unlink-${habitId}`);
    setErrorMessage(null);
    try {
      await api.unlinkCompetitionHabit(selectedCompetitionId, habitId);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo desvincular el hÃ¡bito.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleLog(habitId: number, status: 'positive' | 'negative' | 'clear') {
    if (!selectedCompetitionId) return;
    setBusyKey(`log-${habitId}-${status}`);
    setErrorMessage(null);
    try {
      await api.logCompetitionHabit(selectedCompetitionId, habitId, status, logDate);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo registrar el evento.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleLogDuration(habitId: number) {
    if (!selectedCompetitionId) return;
    const rawValue = durationInputs[habitId] ?? '';
    const minutes = Number(rawValue);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setErrorMessage('IngresÃ¡ una cantidad vÃ¡lida de minutos.');
      return;
    }
    setBusyKey(`log-duration-${habitId}`);
    setErrorMessage(null);
    try {
      await api.logCompetitionHabitDuration(selectedCompetitionId, habitId, minutes, logDate);
      setDurationInputs((current) => ({ ...current, [habitId]: '' }));
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudieron registrar los minutos.');
    } finally {
      setBusyKey(null);
    }
  }

  function startHabitEdit(habit: CompetitionHabit) {
    setEditingHabitId(habit.id);
    setEditingHabitName(habit.name);
    setEditingHabitDescription(habit.description ?? '');
    setEditingHabitKind(habit.kind);
    setEditingHabitMode(habit.scoringMode);
    setEditingPointsPositive(habit.pointsPositive);
    setEditingPointsNegative(habit.pointsNegative);
    setEditingMinutesPerBlock(habit.minutesPerBlock ?? 30);
    setEditingPointsPerBlock(habit.pointsPerBlock ?? 1);
    setEditingDailyTargetMinutes(habit.dailyTargetMinutes ? String(habit.dailyTargetMinutes) : '');
  }

  async function handleSaveHabit(habitId: number) {
    if (!selectedCompetitionId || !editingHabitName.trim()) return;
    setBusyKey(`save-habit-${habitId}`);
    setErrorMessage(null);
    try {
      await api.updateCompetitionHabit(selectedCompetitionId, habitId, {
        name: editingHabitName.trim(),
        description: editingHabitDescription.trim() || undefined,
        kind: editingHabitKind,
        scoringMode: editingHabitMode,
        pointsPositive: editingHabitKind === 'duration' ? 0 : editingPointsPositive,
        pointsNegative: editingHabitKind === 'duration' ? 0 : editingPointsNegative,
        minutesPerBlock: editingHabitKind === 'duration' ? editingMinutesPerBlock : null,
        pointsPerBlock: editingHabitKind === 'duration' ? editingPointsPerBlock : null,
        dailyTargetMinutes: editingHabitKind === 'duration' && editingDailyTargetMinutes.trim() ? Number(editingDailyTargetMinutes) : null,
      });
      setEditingHabitId(null);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo actualizar el hÃ¡bito compartido.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteHabit(habitId: number) {
    if (!selectedCompetitionId) return;
    if (!window.confirm('Se va a borrar este hÃ¡bito compartido y sus registros competitivos.')) return;
    setBusyKey(`delete-habit-${habitId}`);
    setErrorMessage(null);
    try {
      await api.deleteCompetitionHabit(selectedCompetitionId, habitId);
      if (selectedHabitId === habitId) setSelectedHabitId(null);
      if (editingHabitId === habitId) setEditingHabitId(null);
      setRefreshToken((current) => current + 1);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo eliminar el hÃ¡bito compartido.');
    } finally {
      setBusyKey(null);
    }
  }

  function renderLinkControls(habit: CompetitionHabit, personalHabits: Habit[]) {
    const selectedValue = selectedLinks[habit.id] ?? '';
    const isSuggested =
      habit.syncState === 'suggested_match'
      && !habit.linkedPersonalHabitId
      && selectedValue === (habit.suggestedPersonalHabitId ?? '');
    return (
      <div className="space-y-2">
        {habit.linkedPersonalHabitId ? (
          <div className="rounded-2xl border border-accent-mint/15 bg-accent-mint/[0.08] px-3 py-3 text-xs text-accent-mint">
            Sincronizado con tu hÃ¡bito personal.
          </div>
        ) : isSuggested ? (
          <div className="rounded-2xl border border-accent-amber/15 bg-accent-amber/[0.08] px-3 py-3 text-xs text-accent-amber">
            EncontrÃ© un hÃ¡bito parecido: <span className="font-semibold">{habit.suggestedPersonalHabitName}</span>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-xs text-text-secondary">
            TodavÃ­a no estÃ¡ sincronizado con tu tracker personal.
          </div>
        )}
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={selectedValue}
            onChange={(event) =>
              setSelectedLinks((current) => ({
                ...current,
                [habit.id]: event.target.value ? Number(event.target.value) : '',
              }))
            }
            className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none [&>option]:bg-white [&>option]:text-slate-900"
          >
            <option value="">Usar solo en competencia</option>
            {personalHabits.map((personalHabit) => (
              <option key={personalHabit.id} value={personalHabit.id}>
                {personalHabit.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => (isSuggested ? handleApplySuggestedLink(habit.id) : handleLinkExisting(habit.id))}
            disabled={!selectedValue || busyKey === `link-${habit.id}` || busyKey === `suggested-link-${habit.id}`}
            className="rounded-2xl bg-accent-mint/15 px-3 py-2 text-sm text-accent-mint disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSuggested ? 'Vincular sugerido' : 'Vincular'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCreateAndLink(habit.id)}
            disabled={busyKey === `create-link-${habit.id}`}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary"
          >
            Crear y vincular
          </button>
          {habit.linkedPersonalHabitId ? (
            <button
              onClick={() => handleUnlink(habit.id)}
              disabled={busyKey === `unlink-${habit.id}`}
              className="rounded-xl border border-accent-coral/20 bg-accent-coral/10 px-3 py-2 text-xs text-accent-coral"
            >
              Desvincular
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderSummaryView() {
    if (!competitionStats) return null;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Puntos totales" value={`${competitionStats.summary.totalPoints}`} helper="Suma neta del perÃ­odo actual." compact />
          <KpiCard label="Cumplimiento" value={`${competitionStats.summary.averageCompletionRate}%`} helper="Promedio de Ã©xitos sobre eventos posibles." tone="mint" compact />
          <KpiCard label="Ã‰xitos" value={`${competitionStats.summary.positiveCount}`} helper="Cantidad total de Ã©xitos registrados." tone="mint" compact />
          <KpiCard label="RecaÃ­das" value={`${competitionStats.summary.negativeCount}`} helper="Cantidad total de recaÃ­das registradas." tone="coral" compact />
        </div>

        <Card>
          <SectionTitle title="EvoluciÃ³n" subtitle="Puntos acumulados por participante." />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDate} stroke="rgba(255,255,255,0.38)" />
                <YAxis stroke="rgba(255,255,255,0.38)" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {competitionStats.participants.map((participant, index) => (
                  <Line
                    key={participant.userId}
                    type="monotone"
                    dataKey={`p_${participant.userId}`}
                    name={participant.username ? `@${participant.username}` : participant.name}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <Card>
            <SectionTitle title="Leaderboard" subtitle="Lectura rÃ¡pida del perÃ­odo filtrado." />
            <div className="mt-4 space-y-3">
              {competitionStats.leaderboard.map((row, index) => (
                <div key={row.userId} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        #{index + 1} {row.username ? `@${row.username}` : row.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Racha actual {row.currentStreak} Â· Mejor racha {row.bestStreak}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-text-primary">{row.points}</p>
                      <p className="text-xs text-text-muted">{row.completionRate}% cumplimiento</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-accent-mint/[0.08] px-3 py-2 text-accent-mint">
                      Ã‰xitos: {row.positiveDays}
                    </div>
                    <div className="rounded-xl bg-accent-coral/[0.08] px-3 py-2 text-accent-coral">
                      RecaÃ­das: {row.negativeDays}
                    </div>
                    <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-text-secondary">
                      Cumplimiento: {row.completionRate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle title="Timeline" subtitle="QuÃ© tan movida viene la competencia dÃ­a por dÃ­a." />
            <div className="mt-4 space-y-2">
              {competitionStats.timeline.slice(-10).reverse().map((day) => (
                <div key={day.date} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-primary">{formatDate(day.date)}</p>
                    <p className={cn('text-sm font-mono', day.netPoints >= 0 ? 'text-accent-mint' : 'text-accent-coral')}>
                      {formatSigned(day.netPoints)}
                    </p>
                  </div>
                  <div className="mt-2 flex gap-2 text-[11px] text-text-secondary">
                    <span>Ã‰xitos {day.positiveCount}</span>
                    <span>RecaÃ­das {day.negativeCount}</span>
                    <span>Sin registro {day.clearCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderHabitView() {
    if (!competitionStats || !competitionDetail || !selectedHabit) return null;
    const habitDetail = competitionDetail.habits.find((habit) => habit.id === selectedHabit.habitId) ?? null;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {competitionStats.habits.map((habit) => (
            <button
              key={habit.habitId}
              onClick={() => setSelectedHabitId(habit.habitId)}
              className={cn(
                'rounded-2xl border px-3 py-2 text-sm transition-colors',
                selectedHabitId === habit.habitId
                  ? 'border-accent-mint/30 bg-accent-mint/10 text-accent-mint'
                  : 'border-white/[0.08] bg-white/[0.03] text-text-secondary',
              )}
            >
              {habit.name}
            </button>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card>
            <SectionTitle title={selectedHabit.name} subtitle={selectedHabit.description || scoringModeLabel(selectedHabit.scoringMode)} />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <KpiCard label="Modo" value={selectedHabit.scoringMode === 'both' ? 'Mixto' : selectedHabit.scoringMode === 'negative_only' ? 'Negativo' : 'Positivo'} helper={scoringModeLabel(selectedHabit.scoringMode)} />
              <KpiCard label="Puntos por Ã©xito" value={`${selectedHabit.pointsPositive}`} helper="Puntos sumados por cada Ã©xito." tone="mint" />
              <KpiCard label="Puntos por recaÃ­da" value={`${selectedHabit.pointsNegative}`} helper="Puntos descontados por cada recaÃ­da." tone="coral" />
              <KpiCard label="Cumplimiento" value={`${selectedHabit.completionRate}%`} helper="Ã‰xitos de este hÃ¡bito sobre el total esperado." />
            </div>
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={habitComparisonSeries}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.38)" />
                  <YAxis stroke="rgba(255,255,255,0.38)" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Puntos" fill="#54d2b1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Ã‰xitos" fill="#6ec3ff" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="RecaÃ­das" fill="#f97360" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="space-y-4">
            <SectionTitle title="Registro y vÃ­nculo" subtitle="UnificÃ¡ este hÃ¡bito con tu tracker personal si te sirve." />
            {habitDetail ? (
              <>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-sm font-semibold text-text-primary">{selectedHabit.name}</p>
                  <p className="mt-1 text-xs text-text-secondary">{scoringModeLabel(selectedHabit.scoringMode)}</p>
                  <p className="mt-2 text-xs text-text-muted">{statusLabel(habitDetail)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleLog(habitDetail.id, 'positive')}
                    disabled={busyKey === `log-${habitDetail.id}-positive`}
                    className="rounded-xl bg-accent-mint/15 px-3 py-2 text-xs text-accent-mint"
                  >
                    Ã‰xito
                  </button>
                  {canLogNegative(habitDetail) ? (
                    <button
                      onClick={() => handleLog(habitDetail.id, 'negative')}
                      disabled={busyKey === `log-${habitDetail.id}-negative`}
                      className="rounded-xl bg-accent-coral/15 px-3 py-2 text-xs text-accent-coral"
                    >
                      RecaÃ­da
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleLog(habitDetail.id, 'clear')}
                    disabled={busyKey === `log-${habitDetail.id}-clear`}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary"
                  >
                    Limpiar
                  </button>
                </div>
                {renderLinkControls(habitDetail, competitionDetail.personalHabits)}
              </>
            ) : (
              <EmptyState title="HÃ¡bito no disponible" body="No pude cargar el detalle editable de este hÃ¡bito." />
            )}
          </Card>
        </div>
      </div>
    );
  }

  function renderRivalView() {
    if (!competitionStats || participants.length < 2) {
      return <EmptyState title="Faltan rivales" body="NecesitÃ¡s al menos dos participantes activos para comparar cara a cara." />;
    }
    const [left, right] = rivalRows;
    if (!left || !right) return null;
    return (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={rivalA ?? ''}
            onChange={(event) => setRivalA(Number(event.target.value))}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
          >
            {participants.map((participant) => (
              <option key={participant.userId} value={participant.userId}>
                {participantLabel(participant.name, participant.username, participant.userId)}
              </option>
            ))}
          </select>
          <select
            value={rivalB ?? ''}
            onChange={(event) => setRivalB(Number(event.target.value))}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
          >
            {participants.map((participant) => (
              <option key={participant.userId} value={participant.userId}>
                {participantLabel(participant.name, participant.username, participant.userId)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard label={participantLabel(left.name, left.username, left.userId)} value={`${left.points}`} helper={`Cumplimiento ${left.completionRate}% Â· Racha ${left.currentStreak}`} />
          <KpiCard label={participantLabel(right.name, right.username, right.userId)} value={`${right.points}`} helper={`Cumplimiento ${right.completionRate}% Â· Racha ${right.currentStreak}`} />
          <KpiCard label="Diferencia" value={formatSigned(left.points - right.points)} helper="Puntos que separan a ambos en este perÃ­odo." tone={left.points >= right.points ? 'mint' : 'coral'} />
          <KpiCard label="HÃ¡bitos comparados" value={`${rivalComparisonSeries.length}`} helper="Cantidad de hÃ¡bitos compartidos incluidos en el duelo." />
        </div>

        <Card>
          <SectionTitle title="DÃ³nde gana cada uno" subtitle="ComparaciÃ³n de puntos por hÃ¡bito." />
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rivalComparisonSeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.38)" />
                <YAxis stroke="rgba(255,255,255,0.38)" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="left" name={participantLabel(left.name, left.username, left.userId)} fill="#54d2b1" radius={[8, 8, 0, 0]} />
                <Bar dataKey="right" name={participantLabel(right.name, right.username, right.userId)} fill="#f97360" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pb-28 pt-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">Competencias</h1>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              ComparÃ¡ hÃ¡bitos compartidos, entendÃ© quiÃ©n viene mejor y evitÃ¡ tener que registrar dos veces cuando el hÃ¡bito tambiÃ©n vive en tu tracker personal.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.18em] text-text-muted">
            <Icon name="crown" size={14} className="text-accent-mint" />
            {competitionStats?.summary.leaderUsername ? `LÃ­der: @${competitionStats.summary.leaderUsername}` : 'Sin lÃ­der aÃºn'}
          </div>
        </div>

        {errorMessage ? (
          <Card className="border-accent-coral/25 bg-accent-coral/[0.06]">
            <p className="text-sm text-accent-coral">{errorMessage}</p>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="space-y-4">
              <SectionTitle title="Crear competencia" subtitle="PodÃ©s usarla para un duelo 1 vs 1 o para un grupo." />
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-text-secondary">Nombre</span>
                <input
                  value={competitionName}
                  onChange={(event) => setCompetitionName(event.target.value)}
                  placeholder="Ej. Rutina de mayo"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                />
              </label>
              <button
                onClick={handleCreateCompetition}
                disabled={!competitionName.trim() || creatingCompetition}
                className="w-full rounded-2xl bg-accent-mint/15 px-4 py-3 text-sm font-semibold text-accent-mint disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creatingCompetition ? 'Creando...' : 'Crear competencia'}
              </button>
            </Card>

            <Card className="space-y-4">
              <SectionTitle title="Invitaciones" subtitle="AceptÃ¡ o rechazÃ¡ competencias que te mandaron." />
              {(invitesQuery.data?.invites ?? []).length === 0 ? (
                <EmptyState title="Sin invitaciones pendientes" body="Cuando alguien te invite a competir, te va a aparecer acÃ¡." />
              ) : (
                <div className="space-y-3">
                  {(invitesQuery.data?.invites ?? []).map((invite) => (
                    <div key={invite.competitionId} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                      <p className="text-sm font-semibold text-text-primary">{invite.name}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        InvitÃ³ {invite.ownerUsername ? `@${invite.ownerUsername}` : invite.ownerName || 'otro usuario'}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleInviteResponse(invite.competitionId, 'accepted')}
                          disabled={busyKey === `invite-${invite.competitionId}-accepted`}
                          className="flex-1 rounded-xl bg-accent-mint/15 px-3 py-2 text-sm text-accent-mint"
                        >
                          Aceptar
                        </button>
                        <button
                          onClick={() => handleInviteResponse(invite.competitionId, 'declined')}
                          disabled={busyKey === `invite-${invite.competitionId}-declined`}
                          className="flex-1 rounded-xl border border-accent-coral/20 bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <SectionTitle title="Mis competencias" subtitle="ElegÃ­ una para abrir el dashboard." />
              {competitions.length === 0 ? (
                <EmptyState title="TodavÃ­a no hay competencias" body="CreÃ¡ la primera para empezar a comparar hÃ¡bitos." />
              ) : (
                <div className="space-y-3">
                  {competitions.map((competition) => (
                    <button
                      key={competition.id}
                      onClick={() => setSelectedCompetitionId(competition.id)}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition-colors',
                        selectedCompetitionId === competition.id
                          ? 'border-accent-mint/35 bg-accent-mint/10'
                          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]',
                      )}
                    >
                      <p className="text-sm font-semibold text-text-primary">{competition.name}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {competition.acceptedCount}/{competition.participantCount} activos
                        {competition.pendingCount > 0 ? ` Â· ${competition.pendingCount} pendientes` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            {!selectedCompetitionId || !competitionDetail ? (
              <EmptyState title="SeleccionÃ¡ una competencia" body="Cuando elijas una, vas a ver participantes, hÃ¡bitos, evoluciÃ³n y comparaciÃ³n por rival." />
            ) : (
              <>`r`n                <Card className="space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-text-primary">{competitionDetail.competition.name}</h2>
                        <p className="mt-1 text-sm text-text-secondary">
                          {competitionStats?.summary.activeParticipants ?? 0} participantes activos · {competitionStats?.summary.habitCount ?? 0} hábitos compartidos
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Período</span>
                        <RangeTabs value={range} onChange={setRange} />
                      </div>
                    </div>
                    <ViewTabs value={view} onChange={setView} />
                  </div>

                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <input
                        value={competitionEditName}
                        onChange={(event) => setCompetitionEditName(event.target.value)}
                        placeholder="Renombrar competencia"
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary outline-none"
                      />
                      <button
                        onClick={handleRenameCompetition}
                        disabled={!competitionEditName.trim() || busyKey === 'rename-competition'}
                        className="rounded-xl bg-accent-mint/15 px-4 py-2.5 text-sm font-semibold text-accent-mint disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Guardar nombre
                      </button>
                      <button
                        onClick={handleDeleteCompetition}
                        disabled={busyKey === 'delete-competition'}
                        className="rounded-xl border border-accent-coral/20 bg-accent-coral/10 px-4 py-2.5 text-sm font-semibold text-accent-coral disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Borrar competencia
                      </button>
                    </div>
                  </div>

                  <CollapsibleCard
                    title="Invitar rival"
                    subtitle="BuscÃ¡ por @username y validÃ¡ antes de mandar la invitaciÃ³n."
                    open={inviteSectionOpen}
                    onToggle={() => setInviteSectionOpen((current) => !current)}
                  >
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card className="space-y-4 bg-white/[0.02]">
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-text-secondary">@username</span>
                        <input
                          value={inviteUsername}
                          onChange={(event) => setInviteUsername(event.target.value)}
                          placeholder="@usuario"
                          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                        />
                      </label>
                      {inviteResult ? (
                        <div
                          className={cn(
                            'rounded-2xl border px-3 py-3 text-sm',
                            inviteResult.canInvite
                              ? 'border-accent-mint/20 bg-accent-mint/[0.08] text-accent-mint'
                              : 'border-white/[0.08] bg-white/[0.03] text-text-secondary',
                          )}
                        >
                          <p className="font-semibold">
                            {inviteResult.user?.username ? `@${inviteResult.user.username}` : 'Resultado'}
                          </p>
                          <p className="mt-1">{inviteResult.message}</p>
                          {inviteResult.canInvite && inviteResult.user?.username ? (
                            <button
                              onClick={() => handleInvite(inviteResult.user!.username!)}
                              disabled={busyKey === 'invite'}
                              className="mt-3 rounded-xl bg-accent-mint/15 px-3 py-2 text-xs font-semibold text-accent-mint"
                            >
                              Invitar a esta competencia
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Candidatos</p>
                        <div className="space-y-2">
                          {(inviteOptionsQuery.data?.candidates ?? []).map((candidate) => (
                            <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">
                                  {candidate.username ? `@${candidate.username}` : candidate.name || `Usuario ${candidate.id}`}
                                </p>
                                <p className="text-xs text-text-secondary">{candidate.message}</p>
                                {!candidate.username ? <p className="mt-1 text-[11px] text-accent-amber">Este usuario no tiene @username configurado.</p> : null}
                              </div>
                              <button
                                onClick={() => candidate.username && handleInvite(candidate.username)}
                                disabled={!candidate.canInvite || busyKey === 'invite'}
                                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {candidate.canInvite ? 'Invitar' : 'No disponible'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>

                    <Card className="space-y-4 bg-white/[0.02]">
                      <SectionTitle title="Participantes" subtitle="Separados por estado para que sea claro quiÃ©n ya estÃ¡ jugando." />
                      <div className="space-y-3">
                        {['accepted', 'pending', 'declined'].map((status) => {
                          const rows = competitionDetail.participants.filter((participant) => participant.inviteStatus === status);
                          if (!rows.length) return null;
                          return (
                            <div key={status} className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                {status === 'accepted' ? 'Activos' : status === 'pending' ? 'Pendientes' : 'Rechazados'}
                              </p>
                              {rows.map((participant) => (
                                <div key={participant.userId} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-sm">
                                  <span className="text-text-primary">{participantLabel(participant.name, participant.username, participant.userId)}</span>
                                  <span className={cn(status === 'accepted' ? 'text-accent-mint' : 'text-text-muted')}>{participant.role}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                    </div>
                  </CollapsibleCard>
                </Card>

                {view === 'summary' ? renderSummaryView() : null}
                {view === 'habit' ? renderHabitView() : null}
                {view === 'rival' ? renderRivalView() : null}

                <CollapsibleCard
                  title="Editar hÃ¡bitos compartidos"
                  subtitle="DefinÃ­ reglas de puntos y elegÃ­ quÃ© hÃ¡bitos querÃ©s unificar con tu tracker personal."
                  open={sharedHabitsSectionOpen}
                  onToggle={() => setSharedHabitsSectionOpen((current) => !current)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleSyncAllHabitsToProfile}
                      disabled={busyKey === 'sync-all-habits' || !competitionDetail.habits.some((habit) => !habit.linkedPersonalHabitId)}
                      className="rounded-2xl bg-accent-mint/15 px-4 py-3 text-sm font-semibold text-accent-mint disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyKey === 'sync-all-habits' ? 'Sincronizando...' : 'Pasar todos al tracker personal'}
                    </button>
                    <p className="text-xs text-text-secondary">
                      Vincula sugeridos y crea los que faltan sin tocar los ya vinculados.
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4">
                      {competitionDetail.habits.map((habit) => (
                        <div key={habit.id} className="rounded-3xl border border-white/[0.06] bg-white/[0.03]">
                          <div className="flex w-full items-center justify-between gap-3 p-4 text-left">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-text-primary">{habit.name}</p>
                              <p className="mt-1 text-xs text-text-secondary">{habit.description || durationConfigLabel(habit)}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                <span className="rounded-xl bg-white/[0.04] px-2 py-1 text-text-muted">
                                  {habit.kind === 'duration' ? durationConfigLabel(habit) : scoringModeLabel(habit.scoringMode)}
                                </span>
                                {habit.kind === 'event' ? (
                                  <>
                                    <span className="rounded-xl bg-accent-mint/[0.08] px-2 py-1 text-accent-mint">
                                      +{habit.pointsPositive}
                                    </span>
                                    <span className="rounded-xl bg-accent-coral/[0.08] px-2 py-1 text-accent-coral">
                                      -{habit.pointsNegative}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-text-muted">{statusLabel(habit)}</span>
                            </div>
                          </div>
                          <div className="border-t border-white/[0.06] px-4 pb-4 pt-4">
                              <div className="mb-4 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Registrar en</span>
                                {retroDateOptions().map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setLogDate(option.value)}
                                    className={cn(
                                      'rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
                                      logDate === option.value
                                        ? 'border-accent-mint/35 bg-accent-mint/10 text-accent-mint'
                                        : 'border-white/[0.08] bg-white/[0.04] text-text-secondary',
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                              {habit.kind === 'duration' ? (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      value={durationInputs[habit.id] ?? ''}
                                      onChange={(event) => setDurationInputs((current) => ({ ...current, [habit.id]: event.target.value }))}
                                      placeholder="Minutos"
                                      className="w-28 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-primary outline-none"
                                    />
                                    <button
                                      onClick={() => handleLogDuration(habit.id)}
                                      disabled={busyKey === `log-duration-${habit.id}`}
                                      className="rounded-xl bg-accent-mint/15 px-3 py-2 text-xs text-accent-mint disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Registrar minutos
                                    </button>
                                    <button
                                      onClick={() => startHabitEdit(habit)}
                                      className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteHabit(habit.id)}
                                      disabled={busyKey === `delete-habit-${habit.id}`}
                                      className="rounded-xl border border-accent-coral/20 bg-accent-coral/10 px-3 py-2 text-xs text-accent-coral disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Borrar
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-text-muted">Bloques: {durationConfigLabel(habit)}</p>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handleLog(habit.id, 'positive')}
                                    disabled={busyKey === `log-${habit.id}-positive`}
                                    className="rounded-xl bg-accent-mint/15 px-3 py-2 text-xs text-accent-mint"
                                  >
                                    Ã‰xito
                                  </button>
                                  {canLogNegative(habit) ? (
                                    <button
                                      onClick={() => handleLog(habit.id, 'negative')}
                                      disabled={busyKey === `log-${habit.id}-negative`}
                                      className="rounded-xl bg-accent-coral/15 px-3 py-2 text-xs text-accent-coral"
                                    >
                                      RecaÃ­da
                                    </button>
                                  ) : null}
                                  <button
                                    onClick={() => handleLog(habit.id, 'clear')}
                                    disabled={busyKey === `log-${habit.id}-clear`}
                                    className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary"
                                  >
                                    Limpiar
                                  </button>
                                  <button
                                    onClick={() => startHabitEdit(habit)}
                                    className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteHabit(habit.id)}
                                    disabled={busyKey === `delete-habit-${habit.id}`}
                                    className="rounded-xl border border-accent-coral/20 bg-accent-coral/10 px-3 py-2 text-xs text-accent-coral disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Borrar
                                  </button>
                                </div>
                              )}

                              {editingHabitId === habit.id ? (
                                <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                                  <input
                                    value={editingHabitName}
                                    onChange={(event) => setEditingHabitName(event.target.value)}
                                    placeholder="Nombre"
                                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                                  />
                                  <input
                                    value={editingHabitDescription}
                                    onChange={(event) => setEditingHabitDescription(event.target.value)}
                                    placeholder="DescripciÃ³n"
                                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                                  />
                                  <div className="grid gap-2">
                                    {([
                                      ['positive_only', 'Solo suma por Ã©xito'],
                                      ['negative_only', 'Solo resta por recaÃ­da'],
                                      ['both', 'Suma por Ã©xito y resta por recaÃ­da'],
                                    ] as Array<[CompetitionScoringMode, string]>).map(([mode, label]) => (
                                      <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setEditingHabitMode(mode)}
                                        className={cn(
                                          'rounded-2xl border px-3 py-3 text-left text-sm transition-colors',
                                          editingHabitMode === mode
                                            ? 'border-accent-mint/35 bg-accent-mint/10 text-accent-mint'
                                            : 'border-white/[0.08] bg-white/[0.04] text-text-secondary hover:text-text-primary',
                                        )}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  {editingHabitKind === 'event' ? (
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <input
                                      type="number"
                                      value={editingPointsPositive}
                                      onChange={(event) => setEditingPointsPositive(Number(event.target.value))}
                                      placeholder="Puntos por Ã©xito"
                                      className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                                    />
                                    <input
                                      type="number"
                                      value={editingPointsNegative}
                                      onChange={(event) => setEditingPointsNegative(Number(event.target.value))}
                                      placeholder="Puntos por recaÃ­da"
                                      className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                                    />
                                  </div>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-3">
                                      <input
                                        type="number"
                                        min={1}
                                        value={editingMinutesPerBlock}
                                        onChange={(event) => setEditingMinutesPerBlock(Number(event.target.value))}
                                        placeholder="Minutos por bloque"
                                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                                      />
                                      <input
                                        type="number"
                                        min={0}
                                        value={editingPointsPerBlock}
                                        onChange={(event) => setEditingPointsPerBlock(Number(event.target.value))}
                                        placeholder="Puntos por bloque"
                                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                                      />
                                      <input
                                        type="number"
                                        min={0}
                                        value={editingDailyTargetMinutes}
                                        onChange={(event) => setEditingDailyTargetMinutes(event.target.value)}
                                        placeholder="Meta diaria opcional"
                                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                                      />
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => handleSaveHabit(habit.id)}
                                      disabled={busyKey === `save-habit-${habit.id}` || !editingHabitName.trim()}
                                      className="rounded-xl bg-accent-mint/15 px-3 py-2 text-xs font-semibold text-accent-mint disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Guardar cambios
                                    </button>
                                    <button
                                      onClick={() => setEditingHabitId(null)}
                                      className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              <div className="mt-4">{renderLinkControls(habit, competitionDetail.personalHabits)}</div>
                            </div>
                        </div>
                      ))}
                    </div>

                    <Card className="space-y-4 bg-white/[0.02]">
                      <SectionTitle title="Agregar hÃ¡bito" subtitle="UsÃ¡ labels claros para que todos entiendan quÃ© puntÃºa." />
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-text-secondary">Nombre</span>
                        <input
                          value={habitName}
                          onChange={(event) => setHabitName(event.target.value)}
                          placeholder="Ej. Leer 30 min"
                          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-text-secondary">DescripciÃ³n</span>
                        <input
                          value={habitDescription}
                          onChange={(event) => setHabitDescription(event.target.value)}
                          placeholder="Opcional"
                          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                        />
                      </label>
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-text-secondary">Tipo</span>
                        <div className="grid gap-2 md:grid-cols-2">
                          {([['event', 'Evento'], ['duration', 'Tiempo']] as Array<[CompetitionHabitKind, string]>).map(([kind, label]) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => setHabitKind(kind)}
                              className={cn(
                                'rounded-2xl border px-3 py-3 text-left text-sm transition-colors',
                                habitKind === kind
                                  ? 'border-accent-mint/35 bg-accent-mint/10 text-accent-mint'
                                  : 'border-white/[0.08] bg-white/[0.04] text-text-secondary hover:text-text-primary',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {habitKind === 'event' ? (
                        <>
                          <div className="space-y-2">
                        <span className="text-xs font-semibold text-text-secondary">Modo de scoring</span>
                        <div className="grid gap-2">
                          {([
                            ['positive_only', 'Solo suma por Ã©xito'],
                            ['negative_only', 'Solo resta por recaÃ­da'],
                            ['both', 'Suma por Ã©xito y resta por recaÃ­da'],
                          ] as Array<[CompetitionScoringMode, string]>).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setHabitMode(mode)}
                              className={cn(
                                'rounded-2xl border px-3 py-3 text-left text-sm transition-colors',
                                habitMode === mode
                                  ? 'border-accent-mint/35 bg-accent-mint/10 text-accent-mint'
                                  : 'border-white/[0.08] bg-white/[0.04] text-text-secondary hover:text-text-primary',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold text-text-secondary">Puntos por Ã©xito</span>
                          <input
                            type="number"
                            value={pointsPositive}
                            onChange={(event) => setPointsPositive(Number(event.target.value))}
                            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold text-text-secondary">Puntos por recaÃ­da</span>
                          <input
                            type="number"
                            value={pointsNegative}
                            onChange={(event) => setPointsNegative(Number(event.target.value))}
                            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                          />
                        </label>
                      </div>
                        </>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-text-secondary">Cada cu??ntos minutos</span>
                            <input
                              type="number"
                              min={1}
                              value={minutesPerBlock}
                              onChange={(event) => setMinutesPerBlock(Number(event.target.value))}
                              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-text-secondary">Puntos por bloque</span>
                            <input
                              type="number"
                              min={0}
                              value={pointsPerBlock}
                              onChange={(event) => setPointsPerBlock(Number(event.target.value))}
                              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-text-secondary">Meta diaria opcional</span>
                            <input
                              type="number"
                              min={0}
                              value={dailyTargetMinutes}
                              onChange={(event) => setDailyTargetMinutes(event.target.value)}
                              placeholder="Ej. 90"
                              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none"
                            />
                          </label>
                        </div>
                      )}
                      <button
                        onClick={handleCreateHabit}
                        disabled={!habitName.trim() || busyKey === 'create-habit'}
                        className="w-full rounded-2xl bg-accent-mint/15 px-4 py-3 text-sm font-semibold text-accent-mint disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busyKey === 'create-habit' ? 'Guardando...' : 'Agregar hÃ¡bito compartido'}
                      </button>
                    </Card>
                  </div>
                </CollapsibleCard>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}



