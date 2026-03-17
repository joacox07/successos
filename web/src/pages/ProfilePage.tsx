import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTheme, NOTHING_ACCENT_COLORS, type Theme } from '@/contexts/ThemeContext';
import { api, type ProfileData, type AvatarConfig } from '@/lib/api';
import Icon from '@/components/Icon';
import { cn } from '@/lib/utils';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex-1 rounded-xl border border-white/[0.06] bg-bg-card backdrop-blur-sm p-4 text-center">
      <div className="flex items-center justify-center mb-1.5 text-text-muted">
        <Icon name={icon} size={14} />
      </div>
      <p className="text-lg font-bold font-mono text-text-primary">{value}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
    </div>
  );
}

function ResetDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-bg-card p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-coral/15 flex items-center justify-center">
                <Icon name="trash" size={20} className="text-accent-coral" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Borrar todos los datos</h3>
                <p className="text-xs text-text-muted">Esta accion no se puede deshacer</p>
              </div>
            </div>

            <p className="text-sm text-text-secondary">
              Se van a eliminar todas tus entradas, objetivos, habitos y configuraciones.
              Escribi <span className="font-mono font-bold text-accent-coral">BORRAR</span> para confirmar.
            </p>

            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder='Escribi "BORRAR"'
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-coral/50 transition-colors"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-sm font-medium text-text-secondary hover:bg-white/[0.08] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={typed !== 'BORRAR' || loading}
                className={cn(
                  'flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors',
                  typed === 'BORRAR'
                    ? 'bg-accent-coral text-white hover:bg-accent-coral/90'
                    : 'bg-white/[0.04] text-text-muted cursor-not-allowed'
                )}
              >
                {loading ? 'Borrando...' : 'Confirmar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const AVATAR_OPTIONS: Array<{ name: string; color: string; label: string }> = [
  { name: 'rocket', color: '74 222 128', label: 'Cohete' },
  { name: 'lightning', color: '251 191 36', label: 'Rayo' },
  { name: 'star', color: '167 139 250', label: 'Estrella' },
  { name: 'fire', color: '251 113 133', label: 'Fuego' },
  { name: 'brain', color: '74 222 128', label: 'Cerebro' },
  { name: 'target', color: '251 113 133', label: 'Meta' },
  { name: 'trophy', color: '251 191 36', label: 'Trofeo' },
  { name: 'shield', color: '167 139 250', label: 'Escudo' },
  { name: 'crown', color: '251 191 36', label: 'Corona' },
  { name: 'diamond', color: '74 222 128', label: 'Diamante' },
];

function loadAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem('successos-avatar');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { type: 'initials' };
}

function saveAvatar(config: AvatarConfig) {
  localStorage.setItem('successos-avatar', JSON.stringify(config));
}

function AvatarDisplay({
  avatar,
  initials,
  size = 80,
  onClick,
}: {
  avatar: AvatarConfig;
  initials: string;
  size?: number;
  onClick?: () => void;
}) {
  const iconSize = Math.round(size * 0.45);

  if (avatar.type === 'icon') {
    const [r, g, b] = avatar.color.split(' ');
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="relative group"
        style={{ width: size, height: size }}
      >
        <div
          className="w-full h-full rounded-full border border-white/[0.08] flex items-center justify-center"
          style={{ background: `radial-gradient(circle at 30% 30%, rgb(${r} ${g} ${b} / 0.35), rgb(${r} ${g} ${b} / 0.1))` }}
        >
          <Icon name={avatar.name} size={iconSize} style={{ color: `rgb(${r}, ${g}, ${b})` }} />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-bg-card border border-white/[0.1] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Icon name="edit" size={12} className="text-text-muted" />
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative group"
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full rounded-full bg-gradient-to-br from-accent-mint/30 to-accent-violet/30 border border-white/[0.08] flex items-center justify-center">
        <span className="text-2xl font-bold text-text-primary">{initials}</span>
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-bg-card border border-white/[0.1] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Icon name="edit" size={12} className="text-text-muted" />
      </div>
    </motion.button>
  );
}

function AvatarPickerModal({
  open,
  onClose,
  current,
  initials,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  current: AvatarConfig;
  initials: string;
  onSelect: (config: AvatarConfig) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-bg-card p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text-primary">Elegir avatar</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
                <Icon name="x" size={18} className="text-text-muted" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 justify-items-center">
              {/* Initials option */}
              <button
                onClick={() => onSelect({ type: 'initials' })}
                className="flex flex-col items-center gap-1.5"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    'w-14 h-14 rounded-full bg-gradient-to-br from-accent-mint/30 to-accent-violet/30 flex items-center justify-center transition-all duration-200',
                    current.type === 'initials'
                      ? 'ring-2 ring-accent-mint ring-offset-2 ring-offset-[rgb(var(--color-bg-card))] scale-110'
                      : 'hover:scale-105'
                  )}
                >
                  <span className="text-sm font-bold text-text-primary">{initials}</span>
                </motion.div>
                <span className={cn(
                  'text-[10px] transition-colors',
                  current.type === 'initials' ? 'text-text-primary' : 'text-text-muted'
                )}>
                  Iniciales
                </span>
              </button>

              {/* Icon options */}
              {AVATAR_OPTIONS.map((opt) => {
                const isSelected = current.type === 'icon' && current.name === opt.name;
                const [r, g, b] = opt.color.split(' ');
                return (
                  <button
                    key={opt.name}
                    onClick={() => onSelect({ type: 'icon', name: opt.name, color: opt.color })}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className={cn(
                        'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200',
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--color-bg-card))] scale-110'
                          : 'hover:scale-105'
                      )}
                      style={{
                        background: `radial-gradient(circle at 30% 30%, rgb(${r} ${g} ${b} / 0.35), rgb(${r} ${g} ${b} / 0.1))`,
                        '--tw-ring-color': `rgb(${r}, ${g}, ${b})`,
                        boxShadow: isSelected ? `0 0 16px rgb(${r} ${g} ${b} / 0.4)` : undefined,
                      } as React.CSSProperties}
                    >
                      <Icon name={opt.name} size={24} style={{ color: `rgb(${r}, ${g}, ${b})` }} />
                    </motion.div>
                    <span className={cn(
                      'text-[10px] transition-colors',
                      isSelected ? 'text-text-primary' : 'text-text-muted'
                    )}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function ProfilePage() {
  const { theme, setTheme, density, setDensity, nothingAccent, setNothingAccent, isFullscreen, toggleFullscreen } = useTheme();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [morningTime, setMorningTime] = useState('08:00');
  const [eveningTime, setEveningTime] = useState('21:00');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Avatar
  const [avatar, setAvatar] = useState<AvatarConfig>(loadAvatar);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [showNothingColors, setShowNothingColors] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      if (data.morningCheckIn) setMorningTime(data.morningCheckIn);
      if (data.eveningCheckIn) setEveningTime(data.eveningCheckIn);
    } catch {
      // silent fail, show defaults
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Focus the input when entering edit mode
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const handleStartEditName = () => {
    setNameValue(profile?.name || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === profile?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await api.updateProfile({ name: trimmed });
      setProfile((prev) => prev ? { ...prev, name: trimmed } : prev);
    } catch {
      // silent - keep old name
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName();
    if (e.key === 'Escape') setEditingName(false);
  };

  const handleSelectAvatar = (config: AvatarConfig) => {
    setAvatar(config);
    saveAvatar(config);
    setAvatarPickerOpen(false);
    // Fire & forget - if API endpoint exists, it saves; if not, localStorage is the source of truth
    api.updateProfile({ avatar: config }).catch(() => {});
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    setScheduleSaved(false);
    try {
      await api.updateSchedule({ morningCheckIn: morningTime, eveningCheckIn: eveningTime });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2500);
    } catch {
      // silent
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.resetAllData();
      setResetDialogOpen(false);
      window.location.reload();
    } catch {
      // silent
    } finally {
      setResetting(false);
    }
  };

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '--';

  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  const activeDays = profile?.totalEntries != null ? String(profile.totalEntries) : '--';

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Avatar + Name */}
        <motion.div variants={item} className="flex flex-col items-center pt-4">
          {loadingProfile ? (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-mint/30 to-accent-violet/30 border border-white/[0.08] flex items-center justify-center mb-3">
              <span className="text-2xl font-bold text-text-primary">--</span>
            </div>
          ) : (
            <div className="mb-3">
              <AvatarDisplay
                avatar={avatar}
                initials={initials}
                size={80}
                onClick={() => setAvatarPickerOpen(true)}
              />
            </div>
          )}

          {/* Editable name */}
          <AnimatePresence mode="wait">
            {editingName ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleSaveName}
                  disabled={savingName}
                  className="text-xl font-bold text-text-primary bg-transparent border-b-2 border-accent-mint/50 text-center focus:outline-none focus:border-accent-mint px-2 py-0.5 transition-colors w-48"
                  maxLength={40}
                />
              </motion.div>
            ) : (
              <motion.button
                key="display"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={handleStartEditName}
                className="group flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <h1 className="text-xl font-bold text-text-primary">
                  {loadingProfile ? '...' : profile?.name || 'Usuario'}
                </h1>
                <Icon name="edit" size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            )}
          </AnimatePresence>

          <p className="text-xs text-text-muted mt-1">
            {joinDate ? `Miembro desde ${joinDate}` : 'SuccessOS Member'}
          </p>
        </motion.div>

        {/* Stats Row */}
        <motion.div variants={item} className="flex gap-3">
          <StatCard icon="fire" label="Entradas" value={activeDays} />
          <StatCard icon="star" label="Racha" value="--" />
          <StatCard icon="clipboard" label="Registros" value={activeDays} />
        </motion.div>

        {/* Theme Selector */}
        <motion.div variants={item}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2 px-1">Apariencia</p>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex-1 rounded-2xl border p-4 text-center transition-all',
                theme === 'dark'
                  ? 'border-accent-mint/50 bg-accent-mint/10'
                  : 'border-white/[0.06] bg-bg-card hover:bg-bg-card-hover'
              )}
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-accent-mint/30 to-accent-violet/30 flex items-center justify-center mb-2">
                <Icon name="sparkle" size={18} className="text-accent-mint" />
              </div>
              <p className="text-xs font-medium text-text-primary">SuccessOS</p>
            </button>
            <button
              onClick={() => {
                if (theme === 'nothing') {
                  setShowNothingColors(prev => !prev);
                } else {
                  setTheme('nothing');
                  setShowNothingColors(false);
                }
              }}
              className={cn(
                'flex-1 rounded-2xl border p-4 text-center transition-all',
                theme === 'nothing'
                  ? 'border-accent-mint/50 bg-accent-mint/10'
                  : 'border-white/[0.06] bg-bg-card hover:bg-bg-card-hover'
              )}
            >
              <div className="w-10 h-10 mx-auto rounded-xl border border-white/[0.1] flex items-center justify-center mb-2">
                <div className="w-2 h-2 rounded-full bg-accent-coral" />
              </div>
              <p className="text-xs font-medium text-text-primary">Nothing</p>
              {theme === 'nothing' && (
                <p className="text-[10px] text-text-muted mt-0.5">Toca para colores</p>
              )}
            </button>
          </div>
        </motion.div>

        {/* Nothing Accent Color (only when Nothing theme AND second tap) */}
        <AnimatePresence>
          {theme === 'nothing' && showNothingColors && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2 px-1">Color de acento</p>
              <div className="rounded-2xl border border-white/[0.06] bg-bg-card backdrop-blur-sm p-4">
                <div className="flex flex-wrap gap-3 justify-center">
                  {NOTHING_ACCENT_COLORS.map((color) => {
                    const isSelected = nothingAccent === color.rgb;
                    const [r, g, b] = color.rgb.split(' ');
                    return (
                      <button
                        key={color.rgb}
                        onClick={() => setNothingAccent(color.rgb)}
                        className="group flex flex-col items-center gap-1.5"
                      >
                        <motion.div
                          whileTap={{ scale: 0.9 }}
                          className={cn(
                            'w-9 h-9 rounded-full transition-all duration-200',
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--color-bg-primary))] scale-110'
                              : 'hover:scale-105'
                          )}
                          style={{
                            backgroundColor: `rgb(${r}, ${g}, ${b})`,
                            '--tw-ring-color': `rgb(${r}, ${g}, ${b})`,
                            boxShadow: isSelected ? `0 0 16px rgb(${r} ${g} ${b} / 0.4)` : undefined,
                          } as React.CSSProperties}
                        />
                        <span className={cn(
                          'text-[10px] transition-colors',
                          isSelected ? 'text-text-primary' : 'text-text-muted'
                        )}>
                          {color.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Personalizacion */}
        <motion.div variants={item}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2 px-1">Personalizacion</p>
          <div className="rounded-2xl border border-white/[0.06] bg-bg-card backdrop-blur-sm p-4 space-y-4">
            {/* Fullscreen Toggle */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-violet/15 flex items-center justify-center shrink-0">
                <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} className="text-accent-violet" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-primary">Pantalla completa</p>
                <p className="text-[11px] text-text-muted">Experiencia nativa sin bordes</p>
              </div>
              <button
                onClick={() => {
                  toggleFullscreen();
                  localStorage.setItem('successos-fullscreen', (!isFullscreen).toString());
                }}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors duration-200',
                  isFullscreen ? 'bg-accent-mint' : 'bg-white/[0.1]'
                )}
              >
                <motion.div
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ x: isFullscreen ? 20 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            <div className="h-px bg-white/[0.04]" />

            {/* Density Toggle */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-amber/15 flex items-center justify-center shrink-0">
                <Icon name="layout" size={16} className="text-accent-amber" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-primary">Densidad</p>
                <p className="text-[11px] text-text-muted">Ajusta el espaciado general</p>
              </div>
              <div className="flex rounded-xl border border-white/[0.08] overflow-hidden">
                <button
                  onClick={() => setDensity('normal')}
                  className={cn(
                    'px-3 py-1.5 text-[11px] font-medium transition-all duration-200',
                    density === 'normal'
                      ? 'bg-accent-mint/15 text-accent-mint'
                      : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  Normal
                </button>
                <button
                  onClick={() => setDensity('compact')}
                  className={cn(
                    'px-3 py-1.5 text-[11px] font-medium transition-all duration-200',
                    density === 'compact'
                      ? 'bg-accent-mint/15 text-accent-mint'
                      : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  Compacto
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Schedule Configuration */}
        <motion.div variants={item}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2 px-1">
            Horarios de check-in
          </p>
          <div className="rounded-2xl border border-white/[0.06] bg-bg-card backdrop-blur-sm p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-amber/15 flex items-center justify-center shrink-0">
                <Icon name="sun" size={16} className="text-accent-amber" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-primary">Check-in matutino</p>
                <p className="text-[11px] text-text-muted">Arranca el dia con foco</p>
              </div>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-mint/50 transition-colors [color-scheme:dark]"
              />
            </div>

            <div className="h-px bg-white/[0.04]" />

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-violet/15 flex items-center justify-center shrink-0">
                <Icon name="moon" size={16} className="text-accent-violet" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-primary">Check-in nocturno</p>
                <p className="text-[11px] text-text-muted">Refleccion del dia</p>
              </div>
              <input
                type="time"
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-mint/50 transition-colors [color-scheme:dark]"
              />
            </div>

            <button
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className={cn(
                'w-full rounded-xl py-2.5 text-sm font-medium transition-all',
                scheduleSaved
                  ? 'bg-accent-mint/15 text-accent-mint'
                  : 'bg-white/[0.06] text-text-primary hover:bg-white/[0.1]'
              )}
            >
              {savingSchedule ? 'Guardando...' : scheduleSaved ? 'Guardado' : 'Guardar horarios'}
            </button>
          </div>
        </motion.div>

        {/* Goals Management */}
        <motion.div variants={item}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2 px-1">Objetivos</p>
          <button
            onClick={() => navigate('/goals')}
            className="w-full rounded-2xl border border-white/[0.06] bg-bg-card backdrop-blur-sm p-4 flex items-center gap-3 hover:bg-bg-card-hover transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-accent-mint/15 flex items-center justify-center shrink-0">
              <Icon name="target" size={16} className="text-accent-mint" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm text-text-primary">Gestionar objetivos</p>
              <p className="text-[11px] text-text-muted">Crea, edita y segui tus metas</p>
            </div>
            <Icon name="chevron-right" size={16} className="text-text-muted" />
          </button>
        </motion.div>

        {/* Data Reset */}
        <motion.div variants={item}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2 px-1">Zona peligrosa</p>
          <button
            onClick={() => setResetDialogOpen(true)}
            className="w-full rounded-2xl border border-accent-coral/20 bg-accent-coral/5 p-4 flex items-center gap-3 hover:bg-accent-coral/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-accent-coral/15 flex items-center justify-center shrink-0">
              <Icon name="trash" size={16} className="text-accent-coral" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm text-accent-coral font-medium">Borrar todos los datos</p>
              <p className="text-[11px] text-text-muted">Elimina toda tu informacion permanentemente</p>
            </div>
          </button>
        </motion.div>

        {/* Version */}
        <motion.p
          variants={item}
          className="text-center text-[11px] text-text-muted pt-4"
        >
          SuccessOS v1.0
        </motion.p>
      </motion.div>

      <ResetDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        onConfirm={handleReset}
        loading={resetting}
      />

      <AvatarPickerModal
        open={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        current={avatar}
        initials={initials}
        onSelect={handleSelectAvatar}
      />
    </div>
  );
}
