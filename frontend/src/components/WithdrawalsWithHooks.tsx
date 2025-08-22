import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../hooks/useData';
import { useMe } from '../hooks';
import UserHeader from './home/UserHeader';
import Footer from './home/Footer';
import { DashboardSkeleton, LoadingSpinner } from './Skeleton';
import { validateWithdrawalForm, sanitizeInput } from '../utils/validation';
import { AddressValidator, SecurityTip, SecurityBadge } from './SecurityIndicators';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  onSubmit: (data: { amount: number; walletAddress: string; pin: string }) => Promise<void>;
  loading: boolean;
  withdrawalRateLimit?: {
    canProceed: boolean;
    isBlocked: boolean;
    remainingAttempts: number;
    timeUntilReset: number;
    getBlockedMessage: () => string;
  };
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({ 
  isOpen, 
  onClose, 
  availableBalance, 
  onSubmit, 
  loading,
  withdrawalRateLimit
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    walletAddress: '',
    pin: ''
  });
  const [otpRequested, setOtpRequested] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSecurityTips, setShowSecurityTips] = useState(false);

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    const validation = validateWithdrawalForm({
      amount: formData.amount,
      walletAddress: formData.walletAddress,
      pin: formData.pin,
      network: 'BEP20',
      availableBalance
    });
    
    setErrors(validation.errors);
    return validation.isValid;
  };

  const handleRequestOtp = async () => {
    try {
      setRequestingOtp(true);
      // Simular llamada a API para solicitar OTP
      // await apiService.user.requestOtp({ type: 'withdrawal' });
      toast.success('PIN enviado a tu Telegram. Revisa tus mensajes.');
      setOtpRequested(true);
    } catch (error) {
      toast.error('Error al solicitar PIN. Inténtalo de nuevo.');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    await onSubmit({
      amount: parseFloat(formData.amount),
      walletAddress: sanitizeInput(formData.walletAddress.trim()),
      pin: sanitizeInput(formData.pin.trim())
    });
  };

  const handleClose = () => {
    setFormData({ amount: '', walletAddress: '', pin: '' });
    setErrors({});
    setOtpRequested(false);
    onClose();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-secondary-900">
              Solicitar Retiro
            </h3>
            <button
              onClick={handleClose}
              className="text-secondary-400 hover:text-secondary-600 transition-colors"
              disabled={loading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Rate Limit Warning */}
          {withdrawalRateLimit?.isBlocked && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Límite de intentos alcanzado</p>
                  <p>{withdrawalRateLimit.getBlockedMessage()}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-primary-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-secondary-700">Saldo disponible:</span>
              <span className="text-xl font-bold text-primary-600">
                {formatAmount(availableBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-secondary-700">Intentos restantes:</span>
              <span className="text-sm font-medium text-secondary-600">
                {withdrawalRateLimit?.remainingAttempts || 0}
              </span>
            </div>
            <p className="text-sm text-secondary-600">
              Monto mínimo: 10 USDT • Red: BEP-20 (BSC)
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Monto a retirar (USDT)
              </label>
              <input
                type="number"
                min="50"
                max={availableBalance}
                step="0.01"
                value={formData.amount}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, amount: e.target.value }));
                  if (errors.amount) {
                    setErrors(prev => ({ ...prev, amount: '' }));
                  }
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300 ${
                  errors.amount ? 'border-red-300 bg-red-50' : 'border-secondary-200'
                }`}
                placeholder="50.00"
                disabled={loading || (withdrawalRateLimit?.isBlocked ?? false)}
              />
              {errors.amount && (
                <p className="text-red-600 text-sm mt-1">{errors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Dirección de wallet (BEP-20)
              </label>
              <input
                type="text"
                value={formData.walletAddress}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, walletAddress: e.target.value }));
                  if (errors.walletAddress) {
                    setErrors(prev => ({ ...prev, walletAddress: '' }));
                  }
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300 font-mono text-sm ${
                  errors.walletAddress ? 'border-red-300 bg-red-50' : 'border-secondary-200'
                }`}
                placeholder="0x1234567890123456789012345678901234567890"
                disabled={loading || (withdrawalRateLimit?.isBlocked ?? false)}
              />
              {errors.walletAddress && (
                <p className="text-red-600 text-sm mt-1">{errors.walletAddress}</p>
              )}
              <p className="text-xs text-secondary-500 mt-1">
                Asegúrate de que sea una dirección BEP-20 válida (Binance Smart Chain)
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-secondary-700">
                  PIN de Telegram
                </label>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={requestingOtp || loading}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestingOtp ? 'Enviando...' : otpRequested ? 'Reenviar PIN' : 'Solicitar PIN'}
                </button>
              </div>
              <input
                type="text"
                value={formData.pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData(prev => ({ ...prev, pin: value }));
                  if (errors.pin) {
                    setErrors(prev => ({ ...prev, pin: '' }));
                  }
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300 font-mono text-center text-lg tracking-widest ${
                  errors.pin ? 'border-red-300 bg-red-50' : 'border-secondary-200'
                }`}
                placeholder="123456"
                maxLength={6}
                disabled={loading || (withdrawalRateLimit?.isBlocked ?? false)}
              />
              {errors.pin && (
                <p className="text-red-600 text-sm mt-1">{errors.pin}</p>
              )}
              <p className="text-xs text-secondary-500 mt-1">
                {otpRequested 
                  ? 'Revisa tu Telegram y ingresa el PIN de 6 dígitos'
                  : 'Primero solicita el PIN haciendo clic en "Solicitar PIN"'
                }
              </p>
            </div>

            {!otpRequested && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Antes de continuar:</p>
                    <p>Debes solicitar un PIN de seguridad que será enviado a tu cuenta de Telegram vinculada.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-6 py-3 border border-secondary-200 text-secondary-700 rounded-xl hover:bg-secondary-50 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !otpRequested || (withdrawalRateLimit?.isBlocked ?? false)}
                className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (withdrawalRateLimit?.isBlocked ?? false) ? (
                  'Bloqueado temporalmente'
                ) : (
                  'Solicitar Retiro'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const WithdrawalsWithHooks: React.FC = () => {
  const { user } = useAuth();
  const { user: userData, loading: userLoading } = useMe();
  const { 
    withdrawals, 
    balance,
    isLoading: withdrawalsLoading, 
    error: withdrawalsError,
    refreshData
  } = useData();
  
  // TODO: Implement withdrawal rate limit in DataContext
  const withdrawalRateLimit = null;
  
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleWithdrawSubmit = async (data: { amount: number; walletAddress: string; pin: string }) => {
    try {
      setSubmitting(true);
      
      // Check rate limit first
      if (withdrawalRateLimit && !withdrawalRateLimit.canProceed) {
        toast.error(withdrawalRateLimit.getBlockedMessage());
        return;
      }
      
      // Make API call directly
      const response = await fetch('/api/me/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...data,
          network: 'USDT-TRC20' // Default network
        })
      });
      
      if (response.ok) {
        toast.success('Solicitud de retiro enviada correctamente');
        setShowWithdrawModal(false);
        refreshData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error al procesar el retiro');
      }
    } catch (error) {
      toast.error('Error al procesar el retiro');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      approved: { color: 'bg-blue-100 text-blue-800', text: 'Aprobado' },
      completed: { color: 'bg-green-100 text-green-800', text: 'Completado' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rechazado' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isLoading = userLoading || withdrawalsLoading;
  const availableBalance = balance?.available || 0;

  if (isLoading) {
    return (
      <>
        <UserHeader />
        <DashboardSkeleton />
        <Footer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <UserHeader />
      
      <main className="section-padding">
        <div className="container-max">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">
                Mis Retiros
              </h1>
              <p className="text-secondary-600">
                Gestiona tus solicitudes de retiro y revisa su estado
              </p>
            </div>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              Nuevo Retiro
            </button>
          </div>

          {/* Error */}
          {withdrawalsError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-700 font-medium">{(withdrawalsError as any)?.message || (typeof withdrawalsError === 'string' ? withdrawalsError : 'Error desconocido')}</p>
              </div>
            </div>
          )}

          {/* Balance Info */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-secondary-900 mb-4">Saldo Disponible</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-primary-50 rounded-xl">
                <div className="text-2xl font-bold text-primary-600 mb-1">
                  {formatAmount(availableBalance)}
                </div>
                <div className="text-sm text-secondary-600">Disponible para Retiro</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-xl">
                <div className="text-2xl font-bold text-yellow-600 mb-1">
                  {formatAmount(userData?.balances?.pending || 0)}
                </div>
                <div className="text-sm text-secondary-600">Pendiente de Liberación</div>
              </div>
              <div className="text-center p-4 bg-secondary-50 rounded-xl">
                <div className="text-2xl font-bold text-secondary-600 mb-1">
                  {formatAmount((userData?.balances?.total || userData?.balance || 0))}
                </div>
                <div className="text-sm text-secondary-600">Saldo Total</div>
              </div>
            </div>
          </div>

          {/* Withdrawals List */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-secondary-100">
              <h2 className="text-xl font-semibold text-secondary-900">Historial de Retiros</h2>
            </div>
            
            {!withdrawals || withdrawals.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-secondary-900 mb-2">No hay retiros</h3>
                <p className="text-secondary-600 mb-4">Aún no has realizado ninguna solicitud de retiro.</p>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-300"
                >
                  Realizar Primer Retiro
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Monto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Wallet</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Hash</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-secondary-200">
                    {withdrawals.map((withdrawal) => (
                      <tr key={withdrawal._id} className="hover:bg-secondary-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                          {formatDate(withdrawal.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">
                          {formatAmount(withdrawal.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                          <span className="font-mono">
                            {withdrawal.walletAddress.slice(0, 6)}...{withdrawal.walletAddress.slice(-4)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(withdrawal.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                          {withdrawal.txHash ? (
                            <span className="font-mono">
                              {withdrawal.txHash.slice(0, 6)}...{withdrawal.txHash.slice(-4)}
                            </span>
                          ) : (
                            <span className="text-secondary-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        availableBalance={availableBalance}
        onSubmit={handleWithdrawSubmit}
        loading={submitting}
        withdrawalRateLimit={withdrawalRateLimit}
      />

      <Footer />
    </div>
  );
};

export default WithdrawalsWithHooks;