import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../hooks/useData';
import { usePackages, usePayments } from '../hooks';
import { validateTxHash } from '../utils/validation';
import UserHeader from './home/UserHeader';
import Footer from './home/Footer';
import { PackagesGridSkeleton } from './Skeleton';

interface PurchaseModalProps {
  package: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (packageId: string, amount: number) => Promise<void>;
  loading: boolean;
}

interface HashConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseData: any;
  onConfirm: (txHash: string) => Promise<void>;
  loading: boolean;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ 
  package: pkg, 
  isOpen, 
  onClose, 
  onSubmit, 
  loading 
}) => {
  if (!isOpen || !pkg) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(pkg._id, pkg.price);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-secondary-900">
            Confirmar Compra
          </h3>
          <button
            onClick={onClose}
            className="text-secondary-400 hover:text-secondary-600"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-secondary-50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-secondary-900 mb-2">{pkg.name}</h4>
            <p className="text-secondary-600 text-sm mb-3">{pkg.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-primary-600">
                ${pkg.price.toLocaleString()}
              </span>
              <div className="text-right text-sm text-secondary-600">
                <div>Retorno diario: {pkg.benefits?.dailyReturn || 0}%</div>
                <div>Duración: {pkg.benefits?.duration || 0} días</div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Proceso de compra:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Se te asignará una wallet para el pago</li>
                  <li>Realiza la transferencia USDT (BEP20)</li>
                  <li>Confirma el hash de transacción</li>
                  <li>Espera la verificación del admin</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-secondary-300 text-secondary-700 rounded-xl hover:bg-secondary-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-600 text-white px-4 py-3 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                'Confirmar Compra'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HashConfirmModal: React.FC<HashConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  purchaseData, 
  onConfirm, 
  loading 
}) => {
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !purchaseData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!txHash.trim()) {
      setError('Por favor ingresa el hash de transacción');
      return;
    }
    
    if (!validateTxHash(txHash.trim())) {
      setError('Hash de transacción inválido (debe tener 64 caracteres hexadecimales)');
      return;
    }
    
    await onConfirm(txHash.trim());
  };

  const handleClose = () => {
    if (!loading) {
      setTxHash('');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-secondary-900">
            Confirmar Hash de Transacción
          </h3>
          <button
            onClick={handleClose}
            className="text-secondary-400 hover:text-secondary-600"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-green-800">
                <p className="font-medium mb-1">¡Pago iniciado correctamente!</p>
                <p>ID de compra: <span className="font-mono">{purchaseData.purchaseId}</span></p>
                <p>Wallet asignada: <span className="font-mono text-xs">{purchaseData.assignedWallet?.address}</span></p>
                <p>Monto: <span className="font-semibold">${purchaseData.totalAmount} USDT</span></p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Siguiente paso:</p>
                <p>Realiza la transferencia USDT (BEP20) a la wallet asignada y luego ingresa el hash de tu transacción aquí.</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Hash de Transacción
            </label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x1234567890abcdef..."
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
              disabled={loading}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 border border-secondary-300 text-secondary-700 rounded-xl hover:bg-secondary-50 transition-colors"
              disabled={loading}
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={loading || !txHash.trim()}
              className="flex-1 bg-primary-600 text-white px-4 py-3 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Confirmando...
                </>
              ) : (
                'Confirmar Hash'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PackagesWithHooks: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { packages, loading: packagesLoading, error: packagesError } = usePackages();
  const { submitPayment, confirmHash, loading: paymentLoading, isConfirming, error: paymentError } = usePayments();
  const { refreshData } = useData();
  
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showHashModal, setShowHashModal] = useState(false);
  const [purchaseData, setPurchaseData] = useState<any>(null);

  const handlePurchaseClick = (pkg: any) => {
    if (!isAuthenticated) {
      toast.error('Debes iniciar sesión para comprar una licencia');
      return;
    }
    setSelectedPackage(pkg);
    setShowPurchaseModal(true);
  };

  const handlePurchaseSubmit = async (packageId: string, amount: number) => {
    const result = await submitPayment({ packageId, amount });
    
    if (result) {
      setShowPurchaseModal(false);
      setSelectedPackage(null);
      setPurchaseData(result);
      setShowHashModal(true);
      // Refrescar las compras del usuario
      refreshData();
    }
  };

  const handleHashConfirm = async (txHash: string) => {
    if (!purchaseData) return;
    
    const success = await confirmHash({
      purchaseId: purchaseData.purchaseId,
      txHash
    });
    
    if (success) {
      setShowHashModal(false);
      setPurchaseData(null);
      // Refrescar las compras del usuario
      refreshData();
    }
  };

  const getPackageIcon = (name: string) => {
    if (name.toLowerCase().includes('starter')) {
      return (
        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
        </svg>
      </div>
    );
  };

  if (packagesLoading) {
    return (
      <>
        <UserHeader />
        <PackagesGridSkeleton />
        <Footer />
      </>
    );
  }

  if (packagesError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <UserHeader />
        <main className="section-padding">
          <div className="container-max">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="text-red-600 mb-4">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-secondary-600">{(packagesError as any)?.message || (typeof packagesError === 'string' ? packagesError : 'Error desconocido')}</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <UserHeader />
      
      <main className="section-padding">
        <div className="container-max">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Herramientas IA Especializadas
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-secondary-900 mb-6">
              Licencias de Agentes IA
            </h1>
            <p className="text-xl text-secondary-600 max-w-3xl mx-auto">
              Elige la licencia perfecta para acceder a nuestras herramientas tecnológicas avanzadas
            </p>
          </div>

          {/* Error de pago */}
          {paymentError && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800">{(paymentError as any)?.message || (typeof paymentError === 'string' ? paymentError : 'Error desconocido')}</span>
              </div>
            </div>
          )}

          {/* Packages Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {packages.map((pkg) => (
              <div key={pkg._id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-secondary-100">
                {getPackageIcon(pkg.name)}
                
                <h3 className="text-2xl font-bold text-secondary-900 mb-3">
                  {pkg.name}
                </h3>
                
                <p className="text-secondary-600 mb-6 leading-relaxed">
                  {pkg.description}
                </p>
                
                <div className="mb-6">
                  <div className="text-4xl font-bold text-primary-600 mb-2">
                    ${pkg.price.toLocaleString()}
                  </div>
                  {pkg.benefits && (
                    <div className="space-y-1 text-sm text-secondary-600">
                      <div>Retorno diario: {pkg.benefits.dailyReturn}%</div>
                      <div>Duración: {pkg.benefits.duration} días</div>
                      <div>Retorno total: {pkg.benefits.totalReturn}%</div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => handlePurchaseClick(pkg)}
                  className="w-full bg-primary-600 text-white py-3 px-6 rounded-xl hover:bg-primary-700 transition-colors font-medium"
                >
                  Comprar Licencia
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
      
      <Footer />
      
      {/* Purchase Modal */}
      <PurchaseModal
        package={selectedPackage}
        isOpen={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          setSelectedPackage(null);
        }}
        onSubmit={handlePurchaseSubmit}
        loading={paymentLoading}
      />
      
      {/* Hash Confirmation Modal */}
      <HashConfirmModal
        isOpen={showHashModal}
        onClose={() => {
          setShowHashModal(false);
          setPurchaseData(null);
        }}
        purchaseData={purchaseData}
        onConfirm={handleHashConfirm}
        loading={isConfirming}
      />
    </div>
  );
};

export default PackagesWithHooks;