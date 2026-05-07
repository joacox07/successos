import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, clearToken, type AdminUser } from '@/lib/api';
import { Background } from '@/components/Background';

export function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPass, setNewPass] = useState('');
  const [resetting, setResetting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const res = await api.adminGetUsers();
      setUsers(res.users);
    } catch {
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.password.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.adminCreateUser({ name: form.name.trim(), phone: form.phone.trim() || undefined, password: form.password });
      setForm({ name: '', phone: '', password: '' });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    setError(null);
    try {
      await api.adminDeleteUser(id);
      setDeleteId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
    } finally {
      setDeleting(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetId || !newPass.trim()) return;
    setResetting(true);
    try {
      await api.adminResetPassword(resetId, newPass);
      setResetId(null);
      setNewPass('');
    } catch {
      setError('Error al cambiar contraseña');
    } finally {
      setResetting(false);
    }
  }

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative min-h-[100dvh] p-4 pb-8">
      <Background />
      <div className="noise-overlay" />
      <div className="relative z-10 max-w-lg mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between pt-4 pb-2">
          <div>
            <h1 className="text-2xl font-display font-bold text-text-primary tracking-tight">
              Admin <span className="text-accent-mint">Panel</span>
            </h1>
            <p className="text-text-muted text-xs mt-0.5">SuccessOS — gestión de usuarios</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-text-muted hover:text-text-secondary px-3 py-1.5 rounded-lg border border-white/[0.08] transition-colors"
          >
            Salir
          </button>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-accent-coral bg-accent-coral/10 rounded-xl px-4 py-3"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Users list */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-text-secondary">
              Usuarios ({users.length})
            </span>
            <button
              onClick={() => setShowCreate(v => !v)}
              className="text-xs font-medium text-accent-mint bg-accent-mint/10 hover:bg-accent-mint/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Nuevo usuario
            </button>
          </div>

          {/* Create form */}
          <AnimatePresence>
            {showCreate && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreate}
                className="border border-accent-mint/20 rounded-xl p-3 space-y-2 overflow-hidden"
              >
                <p className="text-xs font-medium text-accent-mint mb-2">Crear usuario</p>
                <input
                  type="text"
                  placeholder="Nombre completo *"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-mint/40 transition-all"
                  required
                />
                <input
                  type="text"
                  placeholder="Teléfono WhatsApp (opcional)"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-mint/40 transition-all"
                />
                <input
                  type="password"
                  placeholder="Contraseña temporal *"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-mint/40 transition-all"
                  required
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-accent-mint/90 hover:bg-accent-mint text-bg-primary font-semibold py-2 rounded-lg text-sm transition-all disabled:opacity-40"
                  >
                    {creating ? 'Creando...' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Users */}
          {loading ? (
            <div className="text-center py-6 text-text-muted text-sm">Cargando...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-6 text-text-muted text-sm">No hay usuarios aún</div>
          ) : (
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="w-9 h-9 rounded-full bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-accent-mint">
                      {(user.name || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary truncate">{user.name || 'Sin nombre'}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${user.profile_complete ? 'bg-accent-mint/15 text-accent-mint' : 'bg-white/[0.06] text-text-muted'}`}>
                        {user.profile_complete ? 'activo' : 'pendiente'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted truncate">{user.email || user.phone}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setResetId(user.id); setNewPass(''); }}
                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-text-secondary transition-colors"
                      title="Cambiar contraseña"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteId(user.id)}
                      className="p-1.5 rounded-lg hover:bg-accent-coral/10 text-text-muted hover:text-accent-coral transition-colors"
                      title="Eliminar"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reset password modal */}
        <AnimatePresence>
          {resetId !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setResetId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="glass-card p-5 w-full max-w-sm"
              >
                <h3 className="text-base font-semibold text-text-primary mb-3">Cambiar contraseña</h3>
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-mint/40 transition-all"
                    autoFocus
                    required
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={resetting || !newPass.trim()}
                      className="flex-1 bg-accent-mint/90 hover:bg-accent-mint text-bg-primary font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-40"
                    >
                      {resetting ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetId(null)}
                      className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete confirm modal */}
        <AnimatePresence>
          {deleteId !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="glass-card p-5 w-full max-w-sm"
              >
                <h3 className="text-base font-semibold text-text-primary mb-2">¿Eliminar usuario?</h3>
                <p className="text-sm text-text-muted mb-4">Esta acción no se puede deshacer.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(deleteId)}
                    disabled={deleting}
                    className="flex-1 bg-accent-coral/80 hover:bg-accent-coral text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    disabled={deleting}
                    className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
