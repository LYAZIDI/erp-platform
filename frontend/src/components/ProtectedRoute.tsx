import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const user     = useAuthStore((s) => s.user);
  const loading  = useAuthStore((s) => s.loading);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Chargement..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}
