import React, { useEffect } from 'react';
import { X, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useMyWithdrawals } from '../hooks/useMyWithdrawals';

interface WithdrawalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WithdrawalHistoryModal: React.FC<WithdrawalHistoryModalProps> = ({
  isOpen,
  onClose
}) => {
  const { data, isLoading, refetch } = useMyWithdrawals();

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
      case 'requested':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'approved':
      case 'processing':
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'paid':
        return 'Completado';
      case 'pending':
      case 'requested':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'processing':
        return 'Procesando';
      case 'rejected':
        return 'Rechazado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'paid':
        return 'text-green-600 bg-green-50';
      case 'pending':
      case 'requested':
        return 'text-yellow-600 bg-yellow-50';
      case 'approved':
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'rejected':
      case 'cancelled':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
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

  const truncateAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Historial de Retiros
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Summary */}
          {data?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Disponible</p>
                <p className="text-2xl font-bold text-blue-900">
                  ${data.summary.availableUSDT.toFixed(2)}
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-600 font-medium">Pendiente</p>
                <p className="text-2xl font-bold text-yellow-900">
                  ${data.summary.pendingUSDT.toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 font-medium">Mínimo</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${data.summary.minWithdrawalUSDT}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">SLA</p>
                <p className="text-lg font-bold text-green-900">
                  {data.summary.sla}
                </p>
              </div>
            </div>
          )}

          {/* Withdrawals List */}
          <div className="overflow-auto max-h-96">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : data?.items && data.items.length > 0 ? (
              <div className="space-y-3">
                {data.items.map((withdrawal) => (
                  <div
                    key={withdrawal.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(withdrawal.status)}
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              withdrawal.status
                            )}`}
                          >
                            {getStatusText(withdrawal.status)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Monto</p>
                            <p className="font-semibold text-gray-900">
                              ${withdrawal.amountUSDT.toFixed(2)} USDT
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-gray-500">Dirección</p>
                            <p className="font-mono text-gray-900">
                              {truncateAddress(withdrawal.toAddress)}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-gray-500">Fecha</p>
                            <p className="text-gray-900">
                              {formatDate(withdrawal.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No tienes retiros registrados</p>
                <p className="text-sm text-gray-400 mt-1">
                  Tus retiros aparecerán aquí una vez que los solicites
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t p-6">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalHistoryModal;