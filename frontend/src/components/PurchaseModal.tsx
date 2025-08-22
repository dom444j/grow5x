import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { validateTxHash } from '../utils/validation';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toRenderableNumber } from '../utils/decimal';

interface PurchaseModalProps {
  license: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentInfo {
  orderId: string;
  walletAddress: string;
  network: string;
  amountUSDT: number;
  expiresAt: string;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ 
  license, 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { isAuthenticated, token } = useAuth();
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [txHash, setTxHash] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [isInitialized, setIsInitialized] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-inicializar el pago cuando se abre el modal
  useEffect(() => {
    if (isOpen && license && !isInitialized && !paymentInfo) {
      initializePurchase();
    }
  }, [isOpen, license, isInitialized]);

  // Contador de tiempo
  useEffect(() => {
    if (paymentInfo) {
      const expiresAt = new Date(paymentInfo.expiresAt).getTime();
      
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          toast.error('⏰ El tiempo para realizar el pago ha expirado');
          handleClose();
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [paymentInfo]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (!loading) {
      setPaymentInfo(null);
      setTxHash('');
      setAcceptTerms(false);
      setError('');
      setTimeLeft(30 * 60);
      setIsInitialized(false);
      setCopied(false);
      onClose();
    }
  };

  const getErrorMessage = (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return 'Error desconocido';
  };

  const initializePurchase = async () => {
    if (!isAuthenticated || !token) {
      setError('Debes iniciar sesión para realizar una compra');
      toast.error('🔒 Sesión expirada. Por favor, inicia sesión nuevamente.');
      return;
    }

    setLoading(true);
    setError('');
    setIsInitialized(true);

    try {
      const response = await apiClient.post('/checkout/start', {
        packageId: license.slug,
        amountUSDT: license.price
      });

      if (response?.data?.success) {
        const responseData = response.data;
        
        const checkoutData = responseData.data?.checkout || responseData.checkout;
        const paymentData = responseData.data?.payment || responseData.payment;
        
        if (checkoutData && paymentData) {
          const paymentInfo: PaymentInfo = {
            orderId: checkoutData.orderId,
            walletAddress: paymentData.walletAddress,
            network: paymentData.network,
            amountUSDT: paymentData.amountUSDT,
            expiresAt: checkoutData.expiresAt
          };
          
          setPaymentInfo(paymentInfo);
          toast.success('✅ Información de pago lista. Realiza la transferencia y confirma el hash.');
        } else {
          throw new Error('Estructura de respuesta inválida');
        }
      } else {
        const errorMsg = getErrorMessage(response);
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error('Error en compra:', err);
      
      const errorMessage = getErrorMessage(err);
      const status = err?.response?.status;
      
      setError(`${errorMessage}${status ? ` (${status})` : ''}`);
      toast.error(`❌ Error al inicializar la compra: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!acceptTerms) {
      setError('Debes aceptar los términos y condiciones');
      return;
    }
    
    if (!txHash.trim()) {
      setError('Por favor ingresa el hash de transacción');
      return;
    }
    
    if (!validateTxHash(txHash.trim())) {
      setError('Hash de transacción inválido (debe tener 64 caracteres hexadecimales)');
      return;
    }

    if (!isAuthenticated || !token) {
      setError('Debes iniciar sesión para confirmar el hash');
      toast.error('🔒 Sesión expirada. Por favor, inicia sesión nuevamente.');
      return;
    }

    if (!paymentInfo) {
      setError('No se encontró información de la compra');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post(`/checkout/${paymentInfo.orderId}/confirm`, {
        txHash: txHash.trim()
      });

      if (response?.data?.success) {
        toast.success('🎉 ¡Compra confirmada! Redirigiendo a Mis Compras...');
        onSuccess();
        handleClose();
      } else {
        const errorMsg = getErrorMessage(response);
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error('Error confirmando compra:', err);
      
      const errorMessage = getErrorMessage(err);
      const status = err?.response?.status;
      
      setError(`${errorMessage}${status ? ` (${status})` : ''}`);
      toast.error(`❌ Error al confirmar la compra: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('📋 Copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Error al copiar');
    }
  };

  if (!isOpen || !license) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto shadow-2xl transform transition-all duration-300 animate-slideUp">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 p-6 rounded-t-2xl text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-white bg-opacity-10 backdrop-blur-sm"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Comprar Licencia</h2>
                <p className="text-blue-100 text-sm">Proceso de pago seguro</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Información del paquete con diseño mejorado */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                  {license.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{license.name}</h3>
                  <p className="text-gray-600">Licencia de Producción</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-600">${toRenderableNumber(license.price)}</p>
                <p className="text-sm text-gray-500">USDT • BEP20</p>
              </div>
            </div>
          </div>

          {/* Loading state mejorado */}
          {loading && !paymentInfo && (
            <div className="text-center py-12">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
              </div>
              <p className="text-gray-600 font-medium">Generando información de pago...</p>
              <p className="text-sm text-gray-500 mt-1">Esto puede tomar unos segundos</p>
            </div>
          )}

          {/* Información de pago mejorada */}
          {paymentInfo && (
            <>
              {/* Contador de tiempo con diseño atractivo */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-100 to-orange-100 opacity-50"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-white animate-pulse">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-amber-800 font-semibold">Tiempo restante para el pago</p>
                      <p className="text-sm text-amber-600">La sesión expirará automáticamente</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-amber-800 font-mono">{formatTime(timeLeft)}</p>
                    <p className="text-sm text-amber-600">minutos:segundos</p>
                  </div>
                </div>
              </div>

              {/* Información de pago con diseño premium */}
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-blue-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-blue-900">Información de Pago</h4>
                    <p className="text-blue-700">Transfiere exactamente el monto indicado</p>
                  </div>
                </div>
                
                {/* Dirección de pago */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-blue-800 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                    </svg>
                    Dirección de Wallet
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={paymentInfo.walletAddress}
                      readOnly
                      className="flex-1 px-4 py-3 border-2 border-blue-300 rounded-lg bg-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <button
                      onClick={() => copyToClipboard(paymentInfo.walletAddress)}
                      className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 ${
                        copied 
                          ? 'bg-green-500 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg transform hover:scale-105'
                      }`}
                    >
                      {copied ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Grid de información */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                      <label className="text-sm font-semibold text-gray-700">Monto</label>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{toRenderableNumber(paymentInfo.amountUSDT)} USDT</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      <label className="text-sm font-semibold text-gray-700">Red</label>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{paymentInfo.network}</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      <label className="text-sm font-semibold text-gray-700">ID Orden</label>
                    </div>
                    <p className="text-sm font-mono text-blue-600 break-all">{paymentInfo.orderId}</p>
                  </div>
                </div>
              </div>

              {/* Instrucciones mejoradas */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h5 className="text-lg font-bold text-green-900">Instrucciones de Pago</h5>
                </div>
                <div className="space-y-3">
                  {[
                    { step: '1', text: `Envía exactamente ${toRenderableNumber(paymentInfo.amountUSDT)} USDT a la dirección mostrada`, icon: '💸' },
                    { step: '2', text: `Asegúrate de usar la red ${paymentInfo.network}`, icon: '🌐' },
                    { step: '3', text: 'Copia el hash de transacción de tu wallet', icon: '📋' },
                    { step: '4', text: 'Pega el hash abajo y confirma la compra', icon: '✅' }
                  ].map((instruction, index) => (
                    <div key={index} className="flex items-center space-x-4 p-3 bg-white rounded-lg border border-green-200">
                      <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {instruction.step}
                      </div>
                      <span className="text-2xl">{instruction.icon}</span>
                      <p className="text-green-800 font-medium flex-1">{instruction.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campo de hash mejorado */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="txHash" className="block text-lg font-semibold text-gray-700 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Hash de Transacción
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="txHash"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="0x1234567890abcdef..."
                      className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm transition-all duration-200 pr-12"
                      disabled={loading}
                    />
                    {txHash && validateTxHash(txHash.trim()) && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-2 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Ingresa el hash de transacción de tu envío de USDT (64 caracteres hexadecimales)
                  </p>
                </div>

                {/* Términos y condiciones mejorados */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-all"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <span className="text-gray-700 font-medium">
                        Acepto los términos y condiciones
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        Entiendo que esta compra es final y no reembolsable. He verificado toda la información de pago.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Error mejorado */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 animate-shake">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-800 font-semibold">Error en el proceso</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Botones mejorados */}
          <div className="flex space-x-4 pt-6 border-t border-gray-200">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Cancelar</span>
            </button>
            
            {paymentInfo && (
              <button
                onClick={handleConfirmPurchase}
                disabled={loading || !txHash.trim() || !acceptTerms}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all duration-200 transform hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Confirmar Compra</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseModal;