import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../hooks/useData';
import { useMyReferralStats } from '../hooks/user/useMyReferralStats';
import UserLayout from './UserLayout';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, icon, trend, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <div className="animate-pulse">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-secondary-200 rounded-lg"></div>
            <div className="ml-4 flex-1">
              <div className="h-4 bg-secondary-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-secondary-200 rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-2 bg-primary-100 rounded-lg">
            {icon}
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-secondary-600">{title}</p>
            <p className="text-2xl font-bold text-secondary-900">{value}</p>
          </div>
        </div>
        {trend && (
          <div className={`flex items-center text-sm font-medium ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            <svg 
              className={`w-4 h-4 mr-1 ${
                trend.isPositive ? 'transform rotate-0' : 'transform rotate-180'
              }`} 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  );
};

interface ReferralCodeCardProps {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  loading?: boolean;
}

const ReferralCodeCard: React.FC<ReferralCodeCardProps> = ({ referralCode, referralLink, totalReferrals, loading }) => {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success('Código copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Error al copiar el código');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setLinkCopied(true);
      toast.success('Enlace copiado al portapapeles');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast.error('Error al copiar el enlace');
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl shadow-sm p-6 text-white">
        <div className="animate-pulse">
          <div className="h-6 bg-primary-400 rounded w-32 mb-4"></div>
          <div className="h-8 bg-primary-400 rounded w-24 mb-2"></div>
          <div className="h-4 bg-primary-400 rounded w-20"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl shadow-sm p-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Tu Código de Referido</h3>
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
        </svg>
      </div>
      
      {/* Código de Referido */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 opacity-90">Código:</label>
        <div className="flex items-center justify-between bg-white bg-opacity-20 rounded-lg p-3">
          <span className="font-mono text-lg font-bold">{referralCode}</span>
          <button
            onClick={handleCopyCode}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-2 transition-colors"
            title="Copiar código"
          >
            {copied ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Enlace de Referido */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 opacity-90">Enlace de invitación:</label>
        <div className="flex items-center justify-between bg-white bg-opacity-20 rounded-lg p-3">
          <span className="font-mono text-sm truncate mr-2">{referralLink}</span>
          <button
            onClick={handleCopyLink}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-2 transition-colors flex-shrink-0"
            title="Copiar enlace"
          >
            {linkCopied ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      <div className="text-sm opacity-90">
        <span className="font-medium">{totalReferrals}</span> personas se han registrado con tu código
      </div>
    </div>
  );
};



const DashboardWithHooks: React.FC = () => {
  const { user, logout } = useAuth();
  const { balance, purchases, withdrawals, isLoading, error } = useData();
  const { stats, totals, isLoading: referralStatsLoading, error: referralStatsError } = useMyReferralStats();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  return (
    <UserLayout title="Dashboard">
      <div className="bg-gradient-to-br from-primary-50 to-secondary-50 -mx-4 -my-6 px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Main Content */}
        {(error || referralStatsError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 font-medium">{(error as any)?.message || (referralStatsError as any) || (typeof error === 'string' ? error : 'Error desconocido')}</p>
          </div>
        </div>
      )}

        {/* Welcome Section */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-secondary-900 mb-2">
                ¡Bienvenido a Grow5X!
              </h2>
              <p className="text-secondary-600">
                Tu plataforma de inversión inteligente con IA está lista para usar.
              </p>
            </div>
            
            {/* User Status Info */}
            {user && (
              <div className="flex flex-col items-end space-y-2">
                {/* Referral Code */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-secondary-600">Código de referido:</span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 font-mono">
                    {user.referralCode || 'N/A'}
                  </span>
                </div>
                
                {/* Total Referrals */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-secondary-600">Total referidos:</span>
                  <span className="text-sm font-medium text-secondary-900">
                    {totals?.total || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Balance Disponible"
            value={balance?.available ? `$${balance.available.toLocaleString()}` : '$0.00'}
            icon={
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            }
            loading={isLoading}
          />

          <KPICard
            title="Licencias Activas"
            value={Array.isArray(purchases) ? purchases.filter(p => p.status === 'active')?.length : 0}
            icon={
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            loading={isLoading}
          />

          <KPICard
            title="Retiros Pendientes"
            value={Array.isArray(withdrawals) ? withdrawals.filter(w => w.status === 'pending')?.length : 0}
            icon={
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            }
            loading={isLoading}
          />

          <KPICard
            title="Total Referidos"
            value={totals?.total || 0}
            icon={
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            loading={isLoading || referralStatsLoading}
          />
        </div>

        {/* Referral Code and Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ReferralCodeCard
            referralCode={user?.referralCode || 'LOADING...'}
            referralLink={user?.referralLink || ''}
            totalReferrals={totals?.total || 0}
            loading={isLoading || referralStatsLoading}
          />
          
          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Estadísticas Rápidas</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ${Array.isArray(purchases) ? purchases.reduce((total, p) => total + (p.amount || 0), 0)?.toLocaleString() : '0'}
                </div>
                <div className="text-sm text-green-700">Total Invertido</div>
              </div>
              
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  ${Array.isArray(withdrawals) ? withdrawals.filter(w => w.status === 'completed')?.reduce((total, w) => total + (w.amount || 0), 0)?.toLocaleString() : '0'}
                </div>
                <div className="text-sm text-blue-700">Total Retirado</div>
              </div>
            </div>
            
            {Array.isArray(withdrawals) && withdrawals.filter(w => w.status === 'pending')?.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm">
                    <span className="font-medium text-yellow-800">
                      {Array.isArray(withdrawals) ? withdrawals.filter(w => w.status === 'pending')?.length : 0}
                    </span>
                    <span className="text-yellow-700"> retiros pendientes</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">Acciones Rápidas</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button className="p-4 border-2 border-dashed border-secondary-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all duration-200">
              <div className="text-center">
                <svg className="w-8 h-8 text-secondary-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <p className="text-sm font-medium text-secondary-600">Nueva Inversión</p>
              </div>
            </button>
            
            <button className="p-4 border-2 border-dashed border-secondary-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all duration-200">
              <div className="text-center">
                <svg className="w-8 h-8 text-secondary-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-medium text-secondary-600">Ver Portafolio</p>
              </div>
            </button>
            
            <button className="p-4 border-2 border-dashed border-secondary-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all duration-200">
              <div className="text-center">
                <svg className="w-8 h-8 text-secondary-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <p className="text-sm font-medium text-secondary-600">Retirar Fondos</p>
              </div>
            </button>
            
            <a href="/user/settings" className="p-4 border-2 border-dashed border-secondary-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all duration-200">
              <div className="text-center">
                <svg className="w-8 h-8 text-secondary-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-sm font-medium text-secondary-600">Editar Perfil</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
    </UserLayout>
  );
};

export default DashboardWithHooks;