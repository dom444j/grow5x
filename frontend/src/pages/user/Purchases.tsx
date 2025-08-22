import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyPurchases } from '../../hooks';
import { usePurchaseRealtime } from '../../hooks/useRealtime';
import UserLayout from '../../components/UserLayout';
import { FiCopy, FiExternalLink, FiClock, FiCheck, FiX, FiAlertCircle, FiTrendingUp, FiDollarSign } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { toRenderableNumber } from '../../utils/decimal';

const Purchases: React.FC = () => {
  const { purchases, loading, error, refetch } = useMyPurchases();
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Real-time updates for purchases
  usePurchaseRealtime((eventType, data) => {
    console.log('Purchase realtime event:', eventType, data);
    
    if (eventType === 'purchaseConfirmed') {
      toast.success('¡Compra confirmada! Actualizando datos...');
      refetch();
    }
  });

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(text);
      toast.success(`${type} copiado al portapapeles`);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (err) {
      toast.error('Error al copiar');
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: FiClock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          text: 'Pendiente de Pago'
        };
      case 'hash_submitted':
        return {
          icon: FiAlertCircle,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          text: 'Hash Enviado'
        };
      case 'confirmed':
        return {
          icon: FiCheck,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          text: 'Confirmado'
        };
      case 'rejected':
        return {
          icon: FiX,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          text: 'Rechazado'
        };
      default:
        return {
          icon: FiAlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          text: 'Desconocido'
        };
    }
  };




  if (loading) {
    return (
      <UserLayout title="Mis Compras">
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

  if (error) {
    return (
      <UserLayout title="Mis Compras">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-12">
            <FiX className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-secondary-900 mb-2">Error al cargar compras</h3>
            <p className="text-secondary-600 mb-4">{error.message}</p>
            <button
              onClick={refetch}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout title="Mis Compras">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-secondary-900">Historial de Compras</h2>
            <p className="text-sm text-secondary-600 mt-1">Revisa todas tus compras de paquetes y su estado de confirmación</p>
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <FiExternalLink className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* CTA para Licencias */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">¿Buscas tus licencias en producción?</h3>
              <p className="text-blue-700 mb-4">Ve el progreso y rendimiento de todas tus licencias activas en una vista dedicada.</p>
            </div>
            <Link
              to="/user/licenses"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <FiTrendingUp className="w-4 h-4" />
              Ver Licencias
            </Link>
          </div>
        </div>

        {/* Purchases Content */}
        <div>
            {purchases && purchases.length > 0 ? (
          <div className="space-y-6">
            {purchases.map((purchase: any, index: number) => {
              const statusInfo = getStatusInfo(purchase.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <div key={purchase._id || index} className="bg-gradient-to-r from-white to-primary-50 border border-secondary-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200">
                  <div className="flex flex-col space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
                          <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-secondary-900">
                            {purchase.packageId?.name || purchase.packageName || 'Paquete'}
                          </h3>
                          <p className="text-sm text-secondary-600">
                            ID: {purchase._id?.slice(-8) || 'N/A'}
                          </p>
                          {purchase.licenseId && (
                            <p className="text-xs text-blue-600">
                              Licencia: {purchase.licenseId.slice(-8)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <div className={`flex items-center px-3 py-1 rounded-full ${statusInfo.bgColor}`}>
                          <StatusIcon className={`w-4 h-4 mr-2 ${statusInfo.color}`} />
                          <span className={`text-sm font-medium ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-secondary-100">
                        <div className="flex items-center text-green-600 mb-2">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          <span className="text-sm font-medium">Monto</span>
                        </div>
                        <p className="text-lg font-bold text-secondary-900">
                          ${toRenderableNumber(purchase.amount || purchase.packageId?.price || 0)} USDT
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-secondary-100">
                        <div className="flex items-center text-blue-600 mb-2">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-medium">Fecha</span>
                        </div>
                        <p className="text-sm text-secondary-900">
                          {new Date(purchase.createdAt || purchase.date).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>

                      {purchase.assignedWallet && (
                        <div className="bg-white rounded-lg p-4 border border-secondary-100">
                          <div className="flex items-center text-purple-600 mb-2">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            <span className="text-sm font-medium">Wallet</span>
                          </div>
                          <div className="flex items-center">
                            <p className="text-xs font-mono text-secondary-900 truncate mr-2">
                              {purchase.assignedWallet.address}
                            </p>
                            <button
                              onClick={() => copyToClipboard(purchase.assignedWallet.address, 'Wallet')}
                              className="text-purple-600 hover:text-purple-700 transition-colors"
                            >
                              <FiCopy className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs text-secondary-500 mt-1">
                            {purchase.assignedWallet.network}
                          </p>
                        </div>
                      )}

                      {purchase.confirmedAt && (
                        <div className="bg-white rounded-lg p-4 border border-secondary-100">
                          <div className="flex items-center text-green-600 mb-2">
                            <FiCheck className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">Confirmado</span>
                          </div>
                          <p className="text-sm text-secondary-900">
                            {new Date(purchase.confirmedAt).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}

                      {/* License Progress */}
                      {purchase.licenseStatus && (
                        <div className="bg-white rounded-lg p-4 border border-secondary-100">
                          <div className="flex items-center text-blue-600 mb-2">
                            <FiTrendingUp className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">Licencia</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-secondary-600">Estado:</span>
                              <span className={`text-xs font-medium ${
                                purchase.licenseStatus === 'active' ? 'text-green-600' :
                                purchase.licenseStatus === 'completed' ? 'text-blue-600' :
                                purchase.licenseStatus === 'paused' ? 'text-yellow-600' :
                                'text-gray-600'
                              }`}>
                                {purchase.licenseStatus === 'active' ? 'Activa' :
                                 purchase.licenseStatus === 'completed' ? 'Completada' :
                                 purchase.licenseStatus === 'paused' ? 'Pausada' : 'Pendiente'}
                              </span>
                            </div>
                            {purchase.progressPercent !== undefined && (
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs text-secondary-600">Progreso:</span>
                                  <span className="text-xs font-medium text-secondary-900">
                                    {purchase.progressPercent}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(purchase.progressPercent, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                            {purchase.remainingDays !== undefined && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-secondary-600">Días restantes:</span>
                                <span className="text-xs font-medium text-secondary-900">
                                  {purchase.remainingDays}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}


                    </div>

                    {/* Transaction Hash */}
                    {purchase.paymentHash && (
                      <div className="bg-secondary-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-secondary-700">Hash de Transacción:</span>
                          <button
                            onClick={() => copyToClipboard(purchase.paymentHash, 'Hash')}
                            className={`flex items-center text-sm transition-colors ${
                              copiedHash === purchase.paymentHash
                                ? 'text-green-600'
                                : 'text-primary-600 hover:text-primary-700'
                            }`}
                          >
                            <FiCopy className="w-4 h-4 mr-1" />
                            {copiedHash === purchase.paymentHash ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <div className="font-mono text-sm bg-white px-3 py-2 rounded border break-all text-secondary-900">
                          {purchase.paymentHash}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-secondary-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <h3 className="text-lg font-medium text-secondary-900 mb-2">No tienes compras registradas</h3>
                <p className="text-secondary-600">Tu historial de compras de paquetes aparecerá aquí una vez que realices tu primera transacción.</p>
              </div>
            )}
        </div>
      </div>
    </UserLayout>
  );
};

export default Purchases;