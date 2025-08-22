import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useMyWithdrawals } from '../../hooks/useMyWithdrawals';
import { useUserSettings } from '../../hooks/useUserSettings';
import { WithdrawalRequest } from '../../hooks/useMyWithdrawals';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';

interface WithdrawalFormData {
  amountUSDT: number;
  address: string;
  otpCode: string;
}

const WITHDRAWAL_LIMITS = {
  min: 10,
  max: 10000
};

const formatAddress = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusBadge = (status: string) => {
  const statusConfig = {
    pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Aprobado', className: 'bg-blue-100 text-blue-800' },
    rejected: { label: 'Rechazado', className: 'bg-red-100 text-red-800' },
    completed: { label: 'Completado', className: 'bg-green-100 text-green-800' }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
};

function Withdrawals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Saldo disponible ahora viene del backend
  
  const {
    data,
    loading: isLoadingList,
    refetch: fetchWithdrawals,
    requestWithdrawal,
    submitting: isCreatingWithdrawal,
    error
  } = useMyWithdrawals();

  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);

  const { settings } = useUserSettings();
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<WithdrawalFormData>();
  const [otpRequested, setOtpRequested] = useState(false);

  // Role guard suave
  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin/overview');
    }
  }, [user, navigate]);

  // Cargar retiros al montar el componente
  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  // Obtener saldo disponible del summary
  const availableBalance = data?.summary?.availableUSDT || 0;
  const withdrawals = data?.items || [];

  // Prellenar dirección por defecto cuando esté disponible
  useEffect(() => {
    if (settings?.defaultWithdrawalAddress) {
      setValue('address', settings.defaultWithdrawalAddress);
    }
  }, [settings, setValue]);

  const handleRequestOtp = async () => {
    if (cooldownSeconds > 0) {
      toast.error('Espera antes de solicitar otro código OTP');
      return;
    }

    setIsRequestingOtp(true);
    try {
      // Simular solicitud de OTP - aquí iría la llamada real al backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      setOtpRequested(true);
      toast.success('Código OTP enviado correctamente');
      
      // Iniciar cooldown de 60 segundos
      setCooldownSeconds(60);
      const interval = setInterval(() => {
        setCooldownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      toast.error('Error al solicitar código OTP');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const onSubmit = async (formData: WithdrawalFormData) => {
    const amount = formData.amountUSDT;
    const minWithdrawal = data?.summary?.minWithdrawalUSDT || WITHDRAWAL_LIMITS.min;
    
    // Validaciones adicionales usando datos del backend
    if (amount < minWithdrawal) {
      toast.error(`El monto mínimo es $${minWithdrawal.toFixed(2)} USDT`);
      return;
    }
    
    if (amount > availableBalance) {
      toast.error('Saldo insuficiente');
      return;
    }
    
    try {
      const request: WithdrawalRequest = {
        amountUSDT: formData.amountUSDT,
        toAddress: formData.address,
        network: 'BEP20'
      };
      
      await requestWithdrawal(request);
      reset();
      setOtpRequested(false);
      toast.success('Solicitud de retiro enviada exitosamente');
    } catch (error) {
      // Error ya manejado en el hook
    }
  };

  const hasActiveWithdrawal = (withdrawals && Array.isArray(withdrawals)) 
    ? withdrawals.some((w: any) => w.status === 'pending' || w.status === 'approved')
    : false;

  const amountValue = watch('amountUSDT');
  const minWithdrawal = data?.summary?.minWithdrawalUSDT || WITHDRAWAL_LIMITS.min;
  const isFormValid = amountValue >= minWithdrawal && 
                     amountValue <= WITHDRAWAL_LIMITS.max && 
                     amountValue <= availableBalance;

  return (
    <UserLayout title="Retiros">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-secondary-900 mb-8">Retiros</h1>
        
        {/* Saldo y límites */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 mb-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-secondary-900 mb-6">Saldo y límites</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-md transition-all">
              <p className="text-sm font-medium text-green-700 mb-2">Saldo disponible</p>
              <p className="text-3xl font-bold text-green-600">${availableBalance.toFixed(2)}</p>
              <p className="text-xs text-green-600 mt-1">USDT</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200 hover:shadow-md transition-all">
              <p className="text-sm font-medium text-orange-700 mb-2">Pendiente</p>
              <p className="text-2xl font-bold text-orange-600">${(data?.summary?.pendingUSDT || 0).toFixed(2)}</p>
              <p className="text-xs text-orange-600 mt-1">USDT</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-md transition-all">
              <p className="text-sm font-medium text-blue-700 mb-2">Mínimo</p>
              <p className="text-2xl font-bold text-blue-600">${(data?.summary?.minWithdrawalUSDT || WITHDRAWAL_LIMITS.min).toFixed(2)}</p>
              <p className="text-xs text-blue-600 mt-1">USDT</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-md transition-all">
              <p className="text-sm font-medium text-purple-700 mb-2">SLA</p>
              <p className="text-lg font-bold text-purple-600">{data?.summary?.sla || '24-48h'}</p>
              <p className="text-xs text-purple-600 mt-1">Tiempo estimado</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Red:</strong> BEP20 (Binance Smart Chain) únicamente
            </p>
          </div>
        </div>

        {/* Formulario de retiro */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 mb-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-secondary-900 mb-6">Solicitar retiro</h2>
        
        {hasActiveWithdrawal && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-orange-800 text-sm">
              Ya tienes un retiro activo. Solo puedes tener una solicitud de retiro a la vez.
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-secondary-700 mb-3">
              Cantidad (USDT)
            </label>
            <input
              type="number"
              step="0.01"
              min={data?.summary?.minWithdrawalUSDT || WITHDRAWAL_LIMITS.min}
              max={Math.min(WITHDRAWAL_LIMITS.max, availableBalance)}
              {...register('amountUSDT', {
                required: 'La cantidad es requerida',
                min: { value: data?.summary?.minWithdrawalUSDT || WITHDRAWAL_LIMITS.min, message: `Mínimo ${(data?.summary?.minWithdrawalUSDT || WITHDRAWAL_LIMITS.min).toFixed(2)} USDT` },
                max: { value: WITHDRAWAL_LIMITS.max, message: `Máximo ${WITHDRAWAL_LIMITS.max} USDT` },
                validate: (value) => value <= availableBalance || 'Cantidad excede el saldo disponible'
              })}
              className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-secondary-400"
              placeholder="Ej: 100.00"
              disabled={hasActiveWithdrawal}
            />
            {errors.amountUSDT && (
              <p className="text-red-500 text-sm mt-1">{errors.amountUSDT.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-secondary-700">
                Dirección de wallet (BEP20)
              </label>
              <Link
                to="/settings"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Configurar dirección por defecto
              </Link>
            </div>
            <input
              type="text"
              {...register('address', {
                required: 'La dirección es requerida',
                pattern: {
                  value: /^0x[a-fA-F0-9]{40}$/,
                  message: 'Dirección BEP20 inválida'
                }
              })}
              className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-secondary-400"
              placeholder="0x..."
              disabled={hasActiveWithdrawal}
            />
            {errors.address && (
              <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>
            )}
            {settings?.defaultWithdrawalAddress && (
              <p className="text-green-600 text-sm mt-1">
                ✓ Usando dirección por defecto configurada
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-secondary-700">
                Código OTP
              </label>
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={isRequestingOtp || cooldownSeconds > 0 || hasActiveWithdrawal}
                className="text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {cooldownSeconds > 0 ? `Esperar ${cooldownSeconds}s` : 'Solicitar OTP'}
              </button>
            </div>
            <input
              type="text"
              maxLength={6}
              {...register('otpCode', {
                required: 'El código OTP es requerido',
                pattern: {
                  value: /^\d{6}$/,
                  message: 'El código OTP debe tener 6 dígitos'
                }
              })}
              className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-secondary-400"
              placeholder="123456"
              disabled={hasActiveWithdrawal}
            />
            {errors.otpCode && (
              <p className="text-red-500 text-sm mt-1">{errors.otpCode.message}</p>
            )}
            {otpRequested && (
              <p className="text-green-600 text-sm mt-1">Código OTP enviado correctamente</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isCreatingWithdrawal || hasActiveWithdrawal || !isFormValid}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-4 px-4 rounded-xl hover:from-green-700 hover:to-green-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
          >
            {isCreatingWithdrawal ? 'Procesando...' : 'Solicitar retiro'}
          </button>
        </form>
        </div>

        {/* Historial de retiros */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-secondary-900 mb-6">Historial de retiros</h2>
          
          {isLoadingList ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Cargando historial...</p>
            </div>
          ) : !withdrawals || withdrawals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No tienes retiros registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Cantidad</th>
                    <th className="text-left py-2 px-4">Dirección</th>
                    <th className="text-left py-2 px-4">Estado</th>
                    <th className="text-left py-2 px-4">Fecha</th>
                    <th className="text-left py-2 px-4">ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {(withdrawals && Array.isArray(withdrawals) ? withdrawals : []).map((withdrawal: any) => (
                    <tr key={withdrawal._id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">
                        ${withdrawal.amount?.toFixed(2) || '0.00'} USDT
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">
                        {formatAddress(withdrawal.walletAddress || withdrawal.address || '')}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(withdrawal.status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(withdrawal.createdAt || withdrawal.requestedAt)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {withdrawal.processingETA ? formatDate(withdrawal.processingETA) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}

export default Withdrawals;