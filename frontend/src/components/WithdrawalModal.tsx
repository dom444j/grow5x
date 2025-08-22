import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useMyWithdrawals } from '../hooks/useMyWithdrawals';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  onSuccess?: () => void;
}

interface OtpResponse {
  success: boolean;
  message: string;
  data?: {
    otpId: string;
    expiresAt: string;
  };
}

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  onSuccess
}) => {
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpId, setOtpId] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [formError, setFormError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const { requestWithdrawal, isSubmitting } = useMyWithdrawals();

  // Reset modal state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setAmount('');
      setAddress('');
      setOtpCode('');
      setOtpId('');
      setFormError('');
      setOtpError('');
      setCountdown(0);
    }
  }, [isOpen]);

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validateForm = () => {
    const numAmount = parseFloat(amount);
    
    if (!amount || isNaN(numAmount)) {
      setFormError('Ingresa un monto válido');
      return false;
    }
    
    if (numAmount < 10) {
      setFormError('El monto mínimo es $10 USDT');
      return false;
    }
    
    if (numAmount > availableBalance) {
      setFormError('Saldo insuficiente');
      return false;
    }
    
    if (!address || address.length < 34) {
      setFormError('Ingresa una dirección BEP20 válida');
      return false;
    }
    
    return true;
  };

  const requestOtp = async () => {
    if (!validateForm()) return;
    
    setIsRequestingOtp(true);
    setOtpError('');
    
    try {
      const response = await fetch('/api/me/withdrawals/otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          destinationAddress: address
        })
      });
      
      const data: OtpResponse = await response.json();
      
      if (data.success && data.data) {
        setOtpId(data.data.otpId);
        setStep('otp');
        setCountdown(300); // 5 minutes
      } else {
        setOtpError(data.message || 'Error al solicitar OTP');
      }
    } catch (error) {
      setOtpError('Error de conexión');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const submitWithdrawal = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOtpError('Ingresa un código OTP válido de 6 dígitos');
      return;
    }
    
    try {
      await requestWithdrawal({
        amount: parseFloat(amount),
        destinationAddress: address,
        otpCode,
        otpId
      });
      
      setStep('success');
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      setOtpError(error.message || 'Error al procesar el retiro');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 'form' && 'Solicitar Retiro'}
            {step === 'otp' && 'Verificar OTP'}
            {step === 'success' && 'Retiro Solicitado'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {step === 'form' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.00"
                min="10"
                max={availableBalance}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Disponible: ${availableBalance.toFixed(2)} USDT
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección BEP20
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {formError && (
              <div className="flex items-center space-x-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{formError}</span>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                • Monto mínimo: $10 USDT<br/>
                • Red: BEP20 (Binance Smart Chain)<br/>
                • Tiempo de procesamiento: 24-48h manual
              </p>
            </div>

            <button
              onClick={requestOtp}
              disabled={isRequestingOtp}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRequestingOtp ? 'Enviando OTP...' : 'Continuar'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="text-center">
              <Clock className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">
                Se ha enviado un código de verificación a tu Telegram
              </p>
              <p className="text-sm text-gray-500">
                Tiempo restante: {formatTime(countdown)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código OTP
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
              />
            </div>

            {otpError && (
              <div className="flex items-center space-x-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setStep('form')}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
              >
                Volver
              </button>
              <button
                onClick={submitWithdrawal}
                disabled={isSubmitting || otpCode.length !== 6}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¡Retiro Solicitado!
              </h3>
              <p className="text-gray-600">
                Tu solicitud de retiro por ${amount} USDT ha sido enviada para revisión.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Recibirás una notificación cuando sea procesada.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawalModal;