import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, setToken } from '@/lib/api';
import { Background } from '@/components/Background';

const INPUT = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-mint/40 transition-all';

const HABIT_ICONS: Record<string, JSX.Element> = {
  'Ejercicio': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M4 12l-2-2m2 2l-2 2M20 12l2-2m-2 2l2 2"/></svg>,
  'Lectura': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  'Meditación': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v8"/><path d="M8 15c1 2 2 3 4 3s3-1 4-3"/><path d="M6 12c2 1 4 1.5 6 1.5S16 13 18 12"/></svg>,
  'Agua (2L)': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 7.5 2 13a10 10 0 0 0 20 0c0-5.5-4.5-11-10-11z"/></svg>,
  'Dormir 8hs': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  'Comer bien': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  'Sin alcohol': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  'Estudio': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
};

const PRESET_HABITS = [
  { name: 'Ejercicio', category: 'salud' },
  { name: 'Lectura', category: 'personal' },
  { name: 'Meditación', category: 'personal' },
  { name: 'Agua (2L)', category: 'salud' },
  { name: 'Dormir 8hs', category: 'salud' },
  { name: 'Comer bien', category: 'salud' },
  { name: 'Sin alcohol', category: 'salud' },
  { name: 'Estudio', category: 'educacion' },
];

export function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — cuenta
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 — datos
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Step 3 — hábitos
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(habitName: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(habitName)) next.delete(habitName); else next.add(habitName);
      return next;
    });
  }

  function goNext1() {
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('Ingresá un email válido (ej: nombre@gmail.com)'); return; }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 12) { setError('El WhatsApp debe tener código de país + número (mín. 12 dígitos, ej: 5493412123456)'); return; }
    if (!password) { setError('La contraseña es requerida'); return; }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    setError(null);
    setStep(2);
  }

  function goNext2() {
    if (!age) { setError('La edad es requerida'); return; }
    if (!height) { setError('La altura es requerida'); return; }
    if (!weight) { setError('El peso es requerido'); return; }
    setError(null);
    setStep(3);
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const habits = PRESET_HABITS.filter(h => selected.has(h.name));
      const res = await api.setupProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.replace(/\D/g, ''),
        newPassword: password,
        age: Number(age),
        height: Number(height),
        weight: Number(weight),
        habits: habits.length > 0 ? habits : undefined,
      });
      setToken(res.token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ['Tu cuenta', 'Tus datos', 'Hábitos'];

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center p-6">
      <Background />
      <div className="noise-overlay" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-display font-bold text-text-primary tracking-tight">
            Bienvenido a <span className="text-accent-mint">SuccessOS</span>
          </h1>
          <p className="text-text-muted text-sm mt-1">Configurá tu perfil para empezar</p>

          <div className="flex gap-3 justify-center mt-4">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className={`h-1 rounded-full transition-all duration-300 ${i + 1 <= step ? 'w-10 bg-accent-mint' : 'w-5 bg-white/10'}`} />
                <span className={`text-[9px] uppercase tracking-wider transition-colors ${i + 1 === step ? 'text-accent-mint' : 'text-text-muted/40'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 shimmer-border">
          <AnimatePresence mode="wait">

            {step === 1 && (
              <motion.div key="s1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }} className="space-y-3"
              >
                <input type="text" placeholder="Nombre completo *" value={name} onChange={e => setName(e.target.value)} className={INPUT} autoFocus />
                <input type="email" placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
                <input type="tel" placeholder="WhatsApp * (ej: 5493412123456)" value={phone} onChange={e => setPhone(e.target.value)} className={INPUT} />
                <input type="password" placeholder="Nueva contraseña * (mín. 6)" value={password} onChange={e => setPassword(e.target.value)} className={INPUT} />
                <input type="password" placeholder="Confirmar contraseña *" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={INPUT} />
                {error && <p className="text-xs text-accent-coral">{error}</p>}
                <button onClick={goNext1} className="w-full bg-accent-mint/90 hover:bg-accent-mint text-bg-primary font-semibold py-3 rounded-xl text-sm transition-all mt-1">
                  Siguiente →
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }} className="space-y-3"
              >
                <input type="number" placeholder="Edad *" value={age} onChange={e => setAge(e.target.value)} className={INPUT} autoFocus min={1} max={120} />
                <input type="number" placeholder="Altura en cm * (ej: 175)" value={height} onChange={e => setHeight(e.target.value)} className={INPUT} min={100} max={250} />
                <input type="number" placeholder="Peso en kg * (ej: 70)" value={weight} onChange={e => setWeight(e.target.value)} className={INPUT} min={30} max={300} />
                {error && <p className="text-xs text-accent-coral">{error}</p>}
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { setError(null); setStep(1); }} className="flex-1 py-3 rounded-xl border border-white/[0.08] text-sm text-text-muted hover:text-text-secondary transition-colors">
                    ← Atrás
                  </button>
                  <button onClick={goNext2} className="flex-1 bg-accent-mint/90 hover:bg-accent-mint text-bg-primary font-semibold py-3 rounded-xl text-sm transition-all">
                    Siguiente →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }} className="space-y-4"
              >
                <div>
                  <p className="text-sm font-medium text-text-secondary">¿Qué hábitos querés trackear?</p>
                  <p className="text-xs text-text-muted mt-0.5">Opcional — podés cambiarlos después</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_HABITS.map(h => {
                    const on = selected.has(h.name);
                    return (
                      <button
                        key={h.name}
                        onClick={() => toggle(h.name)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${on ? 'border-accent-mint/50 bg-accent-mint/10 text-accent-mint' : 'border-white/[0.08] bg-white/[0.02] text-text-muted hover:border-white/20'}`}
                      >
                        <span className="flex-shrink-0">{HABIT_ICONS[h.name]}</span>
                        <span className="text-xs truncate">{h.name}</span>
                      </button>
                    );
                  })}
                </div>
                {error && <p className="text-xs text-accent-coral">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setError(null); setStep(2); }} className="flex-1 py-3 rounded-xl border border-white/[0.08] text-sm text-text-muted hover:text-text-secondary transition-colors">
                    ← Atrás
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 bg-accent-mint/90 hover:bg-accent-mint text-bg-primary font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-40"
                  >
                    {loading ? 'Guardando...' : 'Empezar →'}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
