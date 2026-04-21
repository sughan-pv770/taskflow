import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';

import LoginPage       from './pages/LoginPage';
import RegisterPage    from './pages/RegisterPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import DashboardPage   from './pages/DashboardPage';
import TasksPage       from './pages/TasksPage';
import BoardPage       from './pages/BoardPage';
import TaskDetailPage  from './pages/TaskDetailPage';
import AdminPage       from './pages/AdminPage';
import NotFoundPage    from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false } },
});

const PrivateRoute = ({ children, adminOnly = false }) => {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/"              element={<Navigate to="/dashboard" replace />} />
    <Route path="/login"         element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register"      element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/accept-invite" element={<AcceptInvitePage />} />

    <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/tasks"     element={<TasksPage />} />
      <Route path="/tasks/:id" element={<TaskDetailPage />} />
      <Route path="/board"     element={<BoardPage />} />
      <Route path="/admin"     element={<PrivateRoute adminOnly><AdminPage /></PrivateRoute>} />
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#faf7f2', color: '#1c1814',
                border: '1.5px solid #ddd6c8',
                borderRadius: '8px', fontSize: '13.5px',
                boxShadow: '0 4px 12px rgba(28,24,20,.1)',
              },
              success: { iconTheme: { primary: '#2d5a3d', secondary: '#faf7f2' } },
              error:   { iconTheme: { primary: '#9b3a3a', secondary: '#faf7f2' } },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
