// src/main.tsx — Entry point with proper auth routing
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import Login from './pages/Login';
import FamilyRegister from './pages/FamilyRegister';
import FamilyMemberDashboard from './pages/FamilyMemberDashboard';
import { useAuthStore } from './store/auth.store';
import './index.css';
import { LanguageProvider } from './i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return (
    <div className="loading-screen">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚕️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>CareVista</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Loading your session…</div>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return null;
  // If already logged in, redirect to dashboard
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeShell() {
  const { user } = useAuthStore();
  if (user?.role === 'family') return <FamilyMemberDashboard />;
  return <App />;
}

function Root() {
  const checkAuth = useAuthStore(s => s.checkAuth);
  useEffect(() => { checkAuth(); }, []);

  return (
    <LanguageProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/family-register" element={<FamilyRegister />} />
          <Route path="/*" element={<ProtectedRoute><HomeShell /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </React.StrictMode>
);
