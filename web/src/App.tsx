import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api, isAuthenticated, isAdminToken, isProfileComplete } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Background } from '@/components/Background';
import { BottomNav } from '@/components/BottomNav';
import Icon from '@/components/Icon';
import ChatCheckin from '@/components/ChatCheckin';
import DailyCheckin from '@/components/DailyCheckin';
import { CheckinFab } from '@/components/CheckinFab';
import DashboardPage from '@/pages/DashboardPage';
import MetricsPage from '@/pages/MetricsPage';
import GoalsPage from '@/pages/GoalsPage';
import StudyPage from '@/pages/StudyPage';
import ProfilePage from '@/pages/ProfilePage';
import DiaryPage from '@/pages/DiaryPage';
import CalendarPage from '@/pages/CalendarPage';
import CompetitionsPage from '@/pages/CompetitionsPage';
import GuidePage from '@/pages/GuidePage';
import HabitWidgetPage from '@/pages/HabitWidgetPage';
import { LoginPage } from '@/pages/LoginPage';
import { AdminPage } from '@/pages/AdminPage';
import { SetupPage } from '@/pages/SetupPage';

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (isAdminToken()) return <Navigate to="/admin" replace />;
  if (!isProfileComplete()) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

function SetupRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (isAdminToken()) return <Navigate to="/admin" replace />;
  if (isProfileComplete()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdminToken()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppShell() {
  const location = useLocation();
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkinMode, setCheckinMode] = useState<'chat' | 'wizard'>('chat');
  const { data: profileData } = useApi(() => api.getProfile());

  const quickTargetDate = (() => {
    const base = new Date();
    if (profileData?.defaultCheckinDayMode === 'previous_day') {
      base.setDate(base.getDate() - 1);
    }
    return toISODate(base);
  })();
  const checkinTargetLabel = profileData?.defaultCheckinDayMode === 'previous_day' ? 'ayer' : 'hoy';

  const handleCheckinComplete = () => {
    setShowCheckin(false);
    window.dispatchEvent(new Event('checkin-completed'));
  };

  return (
    <>
      <Background />
      <main
        className="relative z-10 min-h-[100dvh]"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
          touchAction: 'pan-y',
          overscrollBehavior: 'none',
        }}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.15 }}
          >
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/diary" element={<DiaryPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/competitions" element={<CompetitionsPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/study" element={<StudyPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <CheckinFab
        routeKey={location.pathname}
        onOpenChat={() => {
          setCheckinMode('chat');
          setShowCheckin(true);
        }}
        onOpenQuick={() => {
          setCheckinMode('wizard');
          setShowCheckin(true);
        }}
      />
      <BottomNav />
      {showCheckin && createPortal(
        <AnimatePresence>
          <motion.div
            key="checkin-overlay-global"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-bg-primary"
          >
            <div className="h-full px-4 pt-4 pb-4 max-w-lg mx-auto w-full flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-text-primary font-[Sora]">
                    {checkinMode === 'chat' ? 'Coach SuccessOS' : (checkinTargetLabel === 'ayer' ? 'Check-in de ayer' : 'Check-in de hoy')}
                  </h2>
                  <button
                    onClick={() => setCheckinMode(checkinMode === 'chat' ? 'wizard' : 'chat')}
                    className="text-[11px] text-accent-violet hover:text-accent-violet/80 transition-colors mt-0.5"
                  >
                    {checkinMode === 'chat' ? 'Cambiar a modo rapido' : 'Cambiar a chat'}
                  </button>
                </div>
                <button
                  onClick={() => setShowCheckin(false)}
                  className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {checkinMode === 'chat' ? (
                  <ChatCheckin onComplete={handleCheckinComplete} />
                ) : (
                  <DailyCheckin targetDate={quickTargetDate} mode="quick" onComplete={handleCheckinComplete} />
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/widget/habits" element={<ProtectedRoute><HabitWidgetPage /></ProtectedRoute>} />
      <Route path="/guide" element={<ProtectedRoute><GuidePage /></ProtectedRoute>} />
      <Route path="/setup" element={<SetupRoute><SetupPage /></SetupRoute>} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
