import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart3,
  ShoppingCart,
  Users,
  CreditCard,
  Activity,
  FileText,
  Upload,
  UserCheck,
  LogOut,
  Settings,
  Home,
  HeadphonesIcon,
  UserPlus,
  Shield
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/admin/overview',
      icon: BarChart3,
      current: location.pathname === '/admin/overview' || location.pathname === '/admin'
    },
    {
      name: 'Paquetes',
      href: '/admin/packages',
      icon: Settings,
      current: location.pathname === '/admin/packages'
    },
    {
      name: 'Compras',
      href: '/admin/purchases',
      icon: ShoppingCart,
      current: location.pathname === '/admin/purchases'
    },
    {
      name: 'Licencias',
      href: '/admin/licenses',
      icon: Shield,
      current: location.pathname === '/admin/licenses'
    },
    {
      name: 'Usuarios',
      href: '/admin/users',
      icon: Users,
      current: location.pathname === '/admin/users'
    },
    {
      name: 'Retiros',
      href: '/admin/withdrawals',
      icon: CreditCard,
      current: location.pathname === '/admin/withdrawals'
    },
    {
      name: 'Reportes',
      href: '/admin/reports',
      icon: FileText,
      current: location.pathname === '/admin/reports'
    },
    {
      name: 'Cohortes',
      href: '/admin/cohorts',
      icon: UserCheck,
      current: location.pathname === '/admin/cohorts'
    },
    {
      name: 'Importar',
      href: '/admin/import-jobs',
      icon: Upload,
      current: location.pathname === '/admin/import-jobs'
    },
    {
      name: 'Health',
      href: '/admin/health',
      icon: Activity,
      current: location.pathname === '/admin/health'
    },
    {
      name: 'Referidos',
      href: '/admin/referrals',
      icon: UserPlus,
      current: location.pathname === '/admin/referrals'
    },
    {
      name: 'Soporte',
      href: '/admin/support',
      icon: HeadphonesIcon,
      current: location.pathname.startsWith('/admin/support')
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y título */}
            <div className="flex items-center space-x-4">
              <Link to="/admin/overview" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Grow5X Admin</span>
              </Link>
              {title && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="text-lg font-medium text-gray-700">{title}</span>
                </>
              )}
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Hola, {user?.fullName || 'Admin'}</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                    ${
                      item.current
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;