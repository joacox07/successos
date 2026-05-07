import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { isAuthenticated, isAdminToken, isProfileComplete } from '@/lib/api';
import { Background } from '@/components/Background';
import { BottomNav } from '@/components/BottomNav';
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
      <BottomNav />
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
