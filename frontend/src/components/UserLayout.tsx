import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMe } from '../hooks/useMe';
import {
  BarChart3,
  ShoppingCart,
  CreditCard,
  Package,
  LogOut,
  Home,
  User,
  Wallet,
  UserPlus,
  Shield,
  CheckCircle,
  AlertCircle,
  Settings
} from 'lucide-react';

interface UserLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const UserLayout: React.FC<UserLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { user: userData } = useMe();

  // Función para obtener la ruta del dashboard según el rol
  const getDashboardRoute = () => {
    if (user?.role === 'admin') {
      return '/admin/overview'
    } else if (user?.role === 'support') {
      return '/admin/support'
    } else {
      return '/user/dashboard'
    }
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigationItems = [
    {
      name: 'Dashboard',
      href: getDashboardRoute(),
      icon: BarChart3,
      current: location.pathname === '/dashboard' || location.pathname === '/user/dashboard' || location.pathname === '/admin/overview'
    },
    {
      name: 'Paquetes',
      href: '/user/packages',
      icon: Package,
      current: location.pathname === '/user/packages'
    },
    {
      name: 'Mis Compras',
      href: '/user/purchases',
      icon: ShoppingCart,
      current: location.pathname === '/user/purchases'
    },
    {
      name: 'Licencias',
      href: '/user/licenses',
      icon: CheckCircle,
      current: location.pathname === '/user/licenses'
    },
    {
      name: 'Retiros',
      href: '/user/withdrawals',
      icon: CreditCard,
      current: location.pathname === '/user/withdrawals'
    },
    {
      name: 'Mi Wallet',
      href: '/user/wallet',
      icon: Wallet,
      current: location.pathname === '/user/wallet'
    },
    {
      name: 'Referidos',
      href: '/user/referrals',
      icon: UserPlus,
      current: location.pathname === '/user/referrals'
    },
    {
      name: 'Configuración',
      href: '/user/settings',
      icon: Settings,
      current: location.pathname === '/user/settings'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-600 to-primary-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y título */}
            <div className="flex items-center space-x-4">
              <Link to={getDashboardRoute()} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Home className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">Grow5X</span>
              </Link>
              {title && (
                <>
                  <span className="text-white/60">/</span>
                  <span className="text-lg font-medium text-white/90">{title}</span>
                </>
              )}
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-white/80" />
                  <span className="text-sm text-white font-medium">
                    Hola, {userData?.firstName || user?.firstName || user?.email || 'Usuario'}
                  </span>
                </div>
                
                {/* Role Badge */}
                {userData?.role && userData.role !== 'user' && (
                  <div className="flex items-center space-x-1 bg-white/20 rounded-md px-2 py-1">
                    <Shield className="h-3 w-3 text-white/90" />
                    <span className="text-xs text-white/90 font-medium capitalize">
                      {userData.role === 'admin' ? 'Admin' : userData.role === 'support' ? 'Soporte' : userData.role}
                    </span>
                  </div>
                )}
                
                {/* Verification Status */}
                {userData && (
                  <div className="flex items-center">
                    {userData.isActive ? (
                      <div title="Cuenta activa">
                        <CheckCircle className="h-4 w-4 text-green-300" />
                      </div>
                    ) : (
                      <div title="Cuenta inactiva">
                        <AlertCircle className="h-4 w-4 text-red-300" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium rounded-lg text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 hover:scale-105"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center space-x-2 py-3 px-4 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 hover:scale-105
                    ${
                      item.current
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-primary-600 hover:bg-primary-50'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default UserLayout;