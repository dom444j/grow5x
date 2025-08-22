import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAdminWithdrawals } from '../../hooks';
import { TableRowSkeleton, StatsCardSkeleton, LoadingSpinner } from '../../components/Skeleton';
import HealthIndicator from '../../components/HealthIndicator';
import AdminLayout from '../../components/admin/AdminLayout';
import { RefreshCw, Clock } from 'lucide-react';

// Importar tipos del hook
type AdminWithdrawal = {
  _id: string;
  userId: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    balance: number;
  };
  amount: number;
  walletAddress: string;
  network: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: {
    _id: string;
    email: string;
  };
};

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  withdrawal: AdminWithdrawal;
  action: 'approve' | 'reject' | 'complete';
  onConfirm: (action: 'approve' | 'reject' | 'complete', data?: any) => Promise<void>;
  loading: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({ 
  isOpen, 
  onClose, 
  withdrawal, 
  action,
  onConfirm, 
  loading 
}) => {
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [txHash, setTxHash] = useState('');

  if (!isOpen || !withdrawal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let data: Record<string, any> = {};
    
    if (action === 'approve') {
      data = { notes: notes.trim() || undefined };
    } else if (action === 'reject') {
      if (!reason.trim()) {
        toast.error('El motivo de rechazo es requerido');
        return;
      }
      data = { reason: reason.trim(), notes: notes.trim() || undefined };
    } else if (action === 'complete') {
      if (!txHash.trim()) {
        toast.error('El hash de transacción es requerido');
        return;
      }
      data = { txHash: txHash.trim(), notes: notes.trim() || undefined };
    }
    
    await onConfirm(action, data);
  };

  const handleClose = () => {
    setNotes('');
    setReason('');
    setTxHash('');
    onClose();
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

  const getActionConfig = () => {
    switch (action) {
      case 'approve':
        return {
          title: 'Aprobar Retiro',
          color: 'green',
          description: 'Al aprobar este retiro, se marcará como listo para procesamiento.',
          buttonText: 'Aprobar Retiro'
        };
      case 'reject':
        return {
          title: 'Rechazar Retiro',
          color: 'red',
          description: 'Al rechazar este retiro, los fondos serán devueltos al usuario.',
          buttonText: 'Rechazar Retiro'
        };
      case 'complete':
        return {
          title: 'Marcar como Completado',
          color: 'blue',
          description: 'Marcar este retiro como completado con el hash de transacción.',
          buttonText: 'Marcar Completado'
        };
      default:
        return {
          title: 'Acción',
          color: 'gray',
          description: '',
          buttonText: 'Confirmar'
        };
    }
  };

  const config = getActionConfig();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-secondary-900">
              {config.title}
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

          {/* Withdrawal Details */}
          <div className="bg-secondary-50 rounded-xl p-6 mb-6">
            <h4 className="text-lg font-semibold text-secondary-900 mb-4">Detalles del Retiro</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-secondary-600">ID de Retiro:</span>
                <p className="font-mono text-sm font-medium">{withdrawal._id}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Usuario:</span>
                <p className="font-medium">{withdrawal.userId?.firstName} {withdrawal.userId?.lastName}</p>
                <p className="text-sm text-secondary-600">{withdrawal.userId?.email}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Monto Solicitado:</span>
                <p className="font-medium text-lg">{formatAmount(withdrawal.amount)}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Monto Neto:</span>
                <p className="font-medium">{formatAmount(withdrawal.amount)}</p>
                <p className="text-xs text-secondary-500">Después de comisiones</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Dirección de Destino:</span>
                <p className="font-mono text-sm break-all">{withdrawal.walletAddress}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Red:</span>
                <p className="font-medium">{withdrawal.network}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Solicitado:</span>
                <p className="text-sm">{formatDate(withdrawal.createdAt)}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Balance del Usuario:</span>
                <p className="text-sm">{formatAmount(withdrawal.userId?.balance || 0)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reason field for reject */}
            {action === 'reject' && (
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Motivo de Rechazo *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                  required
                  disabled={loading}
                >
                  <option value="">Seleccionar motivo...</option>
                  <option value="Dirección inválida">Dirección inválida</option>
                  <option value="Fondos insuficientes">Fondos insuficientes</option>
                  <option value="Actividad sospechosa">Actividad sospechosa</option>
                  <option value="Documentación incompleta">Documentación incompleta</option>
                  <option value="Violación de términos">Violación de términos</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            )}

            {/* TX Hash field for complete */}
            {action === 'complete' && (
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Hash de Transacción *
                </label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                  placeholder="0x..."
                  required
                  disabled={loading}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Notas Administrativas {action === 'reject' ? '(opcionales)' : '(opcionales)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                rows={3}
                placeholder="Notas adicionales sobre esta acción..."
                disabled={loading}
              />
            </div>

            {/* Warning/Info */}
            <div className={`border rounded-lg p-4 ${
              config.color === 'red' ? 'bg-red-50 border-red-200' :
              config.color === 'green' ? 'bg-green-50 border-green-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start">
                <svg className={`w-5 h-5 mt-0.5 mr-2 ${
                  config.color === 'red' ? 'text-red-600' :
                  config.color === 'green' ? 'text-green-600' :
                  'text-blue-600'
                }`} fill="currentColor" viewBox="0 0 20 20">
                  {config.color === 'red' ? (
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  )}
                </svg>
                <div className={`text-sm ${
                  config.color === 'red' ? 'text-red-800' :
                  config.color === 'green' ? 'text-green-800' :
                  'text-blue-800'
                }`}>
                  <p className="font-medium mb-1">
                    {config.color === 'red' ? '¡Atención!' : 'Información'}
                  </p>
                  <p>{config.description}</p>
                </div>
              </div>
            </div>

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
                disabled={loading || (action === 'reject' && !reason.trim()) || (action === 'complete' && !txHash.trim())}
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                  config.color === 'green'
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                    : config.color === 'red'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  config.buttonText
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const AdminWithdrawals: React.FC = () => {
  const {
    withdrawals,
    loading,
    error,
    refetch,
    approveWithdrawal,
    rejectWithdrawal,
    markAsCompleted,
    setFilters,
    filters,
    exportData
  } = useAdminWithdrawals();
  
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawal | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<'approve' | 'reject' | 'complete'>('approve');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const handleAction = async (action: 'approve' | 'reject' | 'complete', data?: Record<string, any>) => {
    if (!selectedWithdrawal) return;
    
    try {
      setActionLoading(true);
      
      let success = false;
      if (action === 'approve') {
        success = await approveWithdrawal(selectedWithdrawal._id, data?.notes);
      } else if (action === 'reject') {
        success = await rejectWithdrawal(selectedWithdrawal._id, data?.reason);
      } else if (action === 'complete') {
        success = await markAsCompleted(selectedWithdrawal._id, data?.txHash);
      }
      
      if (success) {
        const actionText = {
          approve: 'aprobado',
          reject: 'rechazado',
          complete: 'marcado como completado'
        }[action];
        
        toast.success(`Retiro ${actionText} correctamente`);
        setShowActionModal(false);
        setSelectedWithdrawal(null);
        refetch();
      }
    } catch (error) {
      // Error ya manejado por el hook
    } finally {
      setActionLoading(false);
    }
  };

  const openActionModal = (withdrawal: AdminWithdrawal, action: 'approve' | 'reject' | 'complete') => {
    setSelectedWithdrawal(withdrawal);
    setCurrentAction(action);
    setShowActionModal(true);
  };

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm });
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setFilters({ ...filters, status: status === 'all' ? undefined : status });
  };

  const handleNetworkFilter = (network: string) => {
    setNetworkFilter(network);
    setFilters({ ...filters, network: network === 'all' ? undefined : network });
  };

  // Auto-refresh functionality
  useEffect(() => {
    const fetchData = async () => {
      await refetch();
      setLastUpdated(new Date());
    };

    // Initial fetch
    fetchData();

    // Setup auto-refresh
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchData, 60000); // 60 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleExport = async () => {
    try {
      const success = await exportData();
      if (success) {
        toast.success('Datos exportados correctamente');
      }
    } catch (error) {
      // Error ya manejado por el hook
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      approved: { color: 'bg-blue-100 text-blue-800', text: 'Aprobado' },
      processing: { color: 'bg-purple-100 text-purple-800', text: 'Procesando' },
      completed: { color: 'bg-green-100 text-green-800', text: 'Completado' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rechazado' },
      failed: { color: 'bg-gray-100 text-gray-800', text: 'Fallido' }
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

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
  const approvedCount = withdrawals.filter(w => w.status === 'approved').length;
  const completedCount = withdrawals.filter(w => w.status === 'completed').length;
  const rejectedCount = withdrawals.filter(w => w.status === 'rejected').length;

  return (
    <AdminLayout title="Retiros">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">
            Gestión de Retiros
          </h1>
          <p className="text-secondary-600">
            Administra y procesa las solicitudes de retiro de usuarios
          </p>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Última actualización: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-actualizar
          </label>
          <HealthIndicator />
          <button
            onClick={handleExport}
            className="bg-gradient-to-r from-secondary-500 to-secondary-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-secondary-600 hover:to-secondary-700 transition-all duration-300 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar
          </button>
          <button
            onClick={() => {
              refetch();
              setLastUpdated(new Date());
            }}
            disabled={loading}
            className="bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-300 disabled:opacity-50 flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600">Aprobados</p>
              <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600">Completados</p>
              <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600">Rechazados</p>
              <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ID de retiro, usuario o dirección..."
                className="flex-1 px-4 py-2 border border-secondary-200 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-primary-600 text-white rounded-r-lg hover:bg-primary-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'pending', label: 'Pendientes' },
              { value: 'approved', label: 'Aprobados' },
              { value: 'completed', label: 'Completados' },
              { value: 'rejected', label: 'Rechazados' }
            ].map((status) => (
              <button
                key={status.value}
                onClick={() => handleStatusFilter(status.value)}
                className={`px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                  statusFilter === status.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
          
          {/* Network Filter */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'BSC', label: 'BSC' },
              { value: 'ETH', label: 'ETH' },
              { value: 'POLYGON', label: 'POLYGON' }
            ].map((network) => (
              <button
                key={network.value}
                onClick={() => handleNetworkFilter(network.value)}
                className={`px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                  networkFilter === network.value
                    ? 'bg-secondary-600 text-white'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                }`}
              >
                {network.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 font-medium">{(error as any)?.message || error || 'Error desconocido'}</p>
          </div>
        </div>
      )}

      {/* Withdrawals Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-secondary-100">
          <h2 className="text-xl font-semibold text-secondary-900">Lista de Retiros</h2>
        </div>
        
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Dirección</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRowSkeleton key={index} columns={6} />
                ))}
              </tbody>
            </table>
          </div>
        ) : !withdrawals || withdrawals.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-secondary-900 mb-2">No hay retiros</h3>
            <p className="text-secondary-600">No se encontraron retiros con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Red</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {withdrawals.map((withdrawal) => (
                  <tr key={withdrawal._id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-secondary-900">
                          {withdrawal.userId?.firstName} {withdrawal.userId?.lastName}
                        </div>
                        <div className="text-sm text-secondary-500">
                          {withdrawal.userId?.email}
                        </div>
                        <div className="text-xs text-secondary-400">
                          Balance: {formatAmount(withdrawal.userId?.balance || 0)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-secondary-900">
                        {formatAmount(withdrawal.amount)}
                      </div>
                      {withdrawal.amount && (
                        <div className="text-xs text-secondary-500 mt-1">
                          Neto: {formatAmount(withdrawal.amount)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-secondary-600">
                        {withdrawal.walletAddress?.slice(0, 8)}...
                        {withdrawal.walletAddress?.slice(-6)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {withdrawal.network}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(withdrawal.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                      {formatDate(withdrawal.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {withdrawal.status === 'pending' && (
                          <>
                            <button
                              onClick={() => openActionModal(withdrawal, 'approve')}
                              className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 text-xs"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => openActionModal(withdrawal, 'reject')}
                              className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 text-xs"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {withdrawal.status === 'approved' && (
                          <button
                            onClick={() => openActionModal(withdrawal, 'complete')}
                            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 text-xs"
                          >
                            Completar
                          </button>
                        )}
                        {withdrawal.status === 'completed' && (
                          <span className="text-green-600 font-medium text-xs">Completado</span>
                        )}
                        {withdrawal.status === 'rejected' && (
                          <span className="text-red-600 font-medium text-xs">Rechazado</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {selectedWithdrawal && (
        <ActionModal
          isOpen={showActionModal}
          onClose={() => {
            setShowActionModal(false);
            setSelectedWithdrawal(null);
          }}
          withdrawal={selectedWithdrawal}
          action={currentAction}
          onConfirm={handleAction}
          loading={actionLoading}
        />
      )}
    </AdminLayout>
  );
};

export default AdminWithdrawals;