import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

// Componente de splash para mostrar mientras se hidrata la sesión
const Splash = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
      <h2 className="mt-4 text-lg font-medium text-gray-900">Cargando...</h2>
      <p className="mt-2 text-sm text-gray-500">Verificando sesión</p>
    </div>
  </div>
);

interface UserRouteProps {
  children?: React.ReactNode;
}

const UserRoute: React.FC<UserRouteProps> = ({ children }) => {
  const { ready, session } = useAuth();
  const location = useLocation();

  // Mostrar splash mientras se hidrata la sesión
  if (!ready) {
    return <Splash />;
  }

  // Si no hay token, redirigir al login de usuario con returnTo
  if (!session?.token) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  // Si es admin/support intentando acceder a área de usuario, redirigir a admin
  if (session.role === 'admin' || session.role === 'support') {
    return <Navigate to="/admin/overview" replace />;
  }

  // Verificar que tenga rol de user
  if (session.role !== 'user') {
    return <Navigate to="/403" replace />;
  }

  // Si tiene children, renderizarlos; si no, usar Outlet para rutas anidadas
  return children ? <>{children}</> : <Outlet />;
};

export default UserRoute;