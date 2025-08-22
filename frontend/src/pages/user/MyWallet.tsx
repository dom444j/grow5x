import React, { useState, useEffect } from 'react';
import { useMe } from '../../hooks';
import { useMyWithdrawals } from '../../hooks/useMyWithdrawals';
import { useWithdrawalRealtime } from '../../hooks/useRealtime';
import { withAuth } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import UserLayout from '../../components/UserLayout';
import WithdrawalModal from '../../components/WithdrawalModal';
import WithdrawalHistoryModal from '../../components/WithdrawalHistoryModal';
import { toast } from 'react-hot-toast';

const MyWallet: React.FC = () => {
  const { token } = useAuth();
  const { user: userData, loading } = useMe();
  const { data: withdrawalData, refetch: refetchWithdrawals } = useMyWithdrawals();
  
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Fetch dashboard data for totalInvested
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const client = withAuth(token);
        const res = await client.GET('/api/me/overview', {});
        if ((res as any)?.data) {
          setDashboardData((res as any).data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };
    
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  // Real-time updates for withdrawals
  useWithdrawalRealtime((eventType, data) => {
    console.log('Withdrawal realtime event:', eventType, data);
    
    if (eventType === 'withdrawalRequested') {
      toast.success('Solicitud de retiro procesada');
      refetchWithdrawals();
    }
  });

  if (loading) {
    return (
      <UserLayout title="Mi Wallet">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-secondary-200 rounded mb-6"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-secondary-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </UserLayout>
    );
  }

  // Datos de la wallet con información real de retiros
  const walletData = {
    balance: withdrawalData?.summary?.availableUSDT || userData?.balances?.available || 0,
    totalInvested: dashboardData?.stats?.totalInvested || 0, // Usar datos del dashboard
    totalEarnings: dashboardData?.stats?.totalEarnings || userData?.referralStats?.totalCommissions || 0,
    pendingWithdrawals: withdrawalData?.summary?.pendingUSDT || userData?.balances?.pending || 0,
    walletAddress: userData?.settings?.defaultWithdrawalAddress || 'No configurada'
  };

  const handleWithdrawalSuccess = () => {
    refetchWithdrawals();
  };

  const handleDepositClick = () => {
    // TODO: Implementar modal de depósito o redireccionar a página de depósito
    alert('Funcionalidad de depósito en desarrollo');
  };

  return (
    <UserLayout title="Mi Wallet">
      <div className="space-y-6">
        {/* Resumen de Wallet */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-4">Mi Wallet</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span className="text-sm opacity-90">Saldo Disponible</span>
              </div>
              <div className="text-2xl font-bold">${walletData.balance.toFixed(2)}</div>
              <div className="text-xs opacity-75">USDT</div>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-sm opacity-90">Total Invertido</span>
              </div>
              <div className="text-2xl font-bold">${walletData.totalInvested.toFixed(2)}</div>
              <div className="text-xs opacity-75">USDT</div>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm opacity-90">Ganancias Totales</span>
              </div>
              <div className="text-2xl font-bold">${walletData.totalEarnings.toFixed(2)}</div>
              <div className="text-xs opacity-75">USDT</div>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm opacity-90">Retiros Pendientes</span>
              </div>
              <div className="text-2xl font-bold">${walletData.pendingWithdrawals.toFixed(2)}</div>
              <div className="text-xs opacity-75">USDT</div>
            </div>
          </div>
        </div>

        {/* Configuración de Wallet */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-bold text-secondary-900 mb-4">Configuración de Wallet</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Dirección de Wallet (BEP20)
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-secondary-50 border border-secondary-200 rounded-lg p-3 font-mono text-sm">
                  {walletData.walletAddress}
                </div>
                <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200">
                  Editar
                </button>
              </div>
              <p className="text-xs text-secondary-500 mt-1">
                Esta dirección se usará para todos los retiros. Asegúrate de que sea una dirección BEP20 válida.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-bold text-secondary-900 mb-4">Acciones Rápidas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={handleDepositClick}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-4 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
            >
              <div className="flex items-center justify-center mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>Depositar Fondos</div>
            </button>
            
            <button 
              onClick={() => setIsWithdrawalModalOpen(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-4 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
            >
              <div className="flex items-center justify-center mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>Solicitar Retiro</div>
            </button>
            
            <button 
              onClick={() => setIsHistoryModalOpen(true)}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-4 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
            >
              <div className="flex items-center justify-center mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>Ver Historial</div>
            </button>
          </div>
        </div>

        {/* Información de Seguridad */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800 mb-1">Información de Seguridad</h4>
              <p className="text-sm text-yellow-700">
                • Nunca compartas tu información de wallet con terceros<br/>
                • Verifica siempre las direcciones antes de realizar transacciones<br/>
                • Mantén tu cuenta segura con autenticación de dos factores
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modales */}
      <WithdrawalModal
        isOpen={isWithdrawalModalOpen}
        onClose={() => setIsWithdrawalModalOpen(false)}
        availableBalance={walletData.balance}
        onSuccess={handleWithdrawalSuccess}
      />

      <WithdrawalHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </UserLayout>
  );
};

export default MyWallet;