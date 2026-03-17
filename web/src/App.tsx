import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { isAuthenticated } from '@/lib/api';
import { Background } from '@/components/Background';
import { BottomNav } from '@/components/BottomNav';
import DashboardPage from '@/pages/DashboardPage';
import MetricsPage from '@/pages/MetricsPage';
import GoalsPage from '@/pages/GoalsPage';
import StudyPage from '@/pages/StudyPage';
import ProfilePage from '@/pages/ProfilePage';
import DiaryPage from '@/pages/DiaryPage';
import { LoginPage } from '@/pages/LoginPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppShell() {
  const location = useLocation();

  return (
    <>
      <Background />
      <div className="noise-overlay" />
      <main className="relative z-10 pb-20 min-h-[100dvh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/diary" element={<DiaryPage />} />
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
