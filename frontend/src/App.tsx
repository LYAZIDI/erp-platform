import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';

import Login    from './pages/Login';
import Register from './pages/Register';
import AppLayout from './layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import UsersPage   from './pages/settings/Users';
import RolesPage   from './pages/settings/Roles';
import ModulesPage from './pages/settings/Modules';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

function AppRouter() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => { init(); }, []);

  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"         element={<Dashboard />} />
        <Route path="settings/users"    element={<UsersPage />} />
        <Route path="settings/roles"    element={<RolesPage />} />
        <Route path="settings/modules"  element={<ModulesPage />} />
        {/* Placeholders pour les modules métier */}
        <Route path="crm/*"         element={<ComingSoon module="CRM" />} />
        <Route path="ventes/*"      element={<ComingSoon module="Ventes" />} />
        <Route path="achats/*"      element={<ComingSoon module="Achats" />} />
        <Route path="stock/*"       element={<ComingSoon module="Stock" />} />
        <Route path="comptabilite/*"element={<ComingSoon module="Comptabilité" />} />
        <Route path="rh/*"          element={<ComingSoon module="RH" />} />
        <Route path="projets/*"     element={<ComingSoon module="Projets" />} />
        <Route path="production/*"  element={<ComingSoon module="Production" />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function ComingSoon({ module }: { module: string }) {
  return (
    <div style={{
      height: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 64 }}>🚧</div>
      <h2>Module {module}</h2>
      <p style={{ color: '#888' }}>Ce module est en cours de développement.</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={frFR} theme={{
        token: {
          colorPrimary:  '#1677ff',
          borderRadius:  8,
          fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}>
        <AntApp>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
