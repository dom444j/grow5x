import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAdminPurchases } from '../../hooks';
import { DashboardSkeleton, TableRowSkeleton, StatsCardSkeleton } from '../../components/Skeleton';
import HealthIndicator from '../../components/HealthIndicator';
import AdminLayout from '../../components/admin/AdminLayout';
import { RefreshCw, Clock } from 'lucide-react';
import useWallets from '../../hooks/useWallets';
import WalletManagementSection from '../../components/admin/WalletManagementSection';
import { 
  FiSearch, 
  FiFilter, 
  FiDownload, 
  FiEye, 
  FiCheck, 
  FiX, 
  FiClock,
  FiDollarSign,
  FiUsers,
  FiTrendingUp,
  FiCreditCard,
  FiShield,
  FiRotateCcw,
  FiGlobe,
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiPause,
  FiPlay,
  FiExternalLink,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';

// Importar tipos del hook
type AdminPurchase = {
  _id: string;
  userId: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  packageId: {
    _id: string;
    name: string;
    price: number;
  };
  amount: number;
  status: 'pending' | 'hash_submitted' | 'confirmed' | 'rejected';
  paymentHash?: string;
  assignedWallet?: {
    address: string;
    network: string;
  };
  createdAt: string;
  confirmedAt?: string;
  // Información de licencia generada
  licenseId?: string;
  licenseStatus?: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
};

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: AdminPurchase;
  onConfirm: (action: 'confirm' | 'reject', notes?: string) => Promise<void>;
  loading: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  purchase, 
  onConfirm, 
  loading 
}) => {
  const [action, setAction] = useState<'confirm' | 'reject'>('confirm');
  const [notes, setNotes] = useState('');

  if (!isOpen || !purchase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(action, notes.trim() || undefined);
  };

  const handleClose = () => {
    setNotes('');
    setAction('confirm');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-secondary-900">
              {action === 'confirm' ? 'Confirmar' : 'Rechazar'} Pago
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

          {/* Purchase Details */}
          <div className="bg-secondary-50 rounded-xl p-6 mb-6">
            <h4 className="text-lg font-semibold text-secondary-900 mb-4">Detalles de la Compra</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-secondary-600">ID de Compra:</span>
                <p className="font-mono text-sm font-medium">{purchase._id}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Usuario:</span>
                <p className="font-medium">{purchase.userId?.firstName} {purchase.userId?.lastName}</p>
                <p className="text-sm text-secondary-600">{purchase.userId?.email}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Paquete:</span>
                <p className="font-medium">{purchase.packageId?.name}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Monto:</span>
                <p className="font-medium text-lg">{formatAmount((purchase as any)?.payment?.totalAmount || purchase.amount)}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Hash de Transacción:</span>
                <p className="font-mono text-sm break-all">{(purchase as any)?.transaction?.hash || purchase.paymentHash}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Wallet Asignada:</span>
                <p className="font-mono text-sm">{(purchase as any)?.payment?.walletAddress || purchase.assignedWallet?.address}</p>
                <p className="text-xs text-secondary-500">{(purchase as any)?.payment?.network || purchase.assignedWallet?.network}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Enviado:</span>
                <p className="text-sm">{formatDate((purchase as any)?.transaction?.submittedAt || purchase.createdAt)}</p>
              </div>
              <div>
                <span className="text-sm text-secondary-600">Tiempo de Espera:</span>
                <p className="text-sm">{(purchase as any)?.waitingTime || 'N/A'} minutos</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Action Selection */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-3">
                Acción a realizar
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="confirm"
                    checked={action === 'confirm'}
                    onChange={(e) => setAction(e.target.value as 'confirm' | 'reject')}
                    className="mr-2 text-green-600 focus:ring-green-500"
                    disabled={loading}
                  />
                  <span className="text-green-700 font-medium">Confirmar Pago</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="reject"
                    checked={action === 'reject'}
                    onChange={(e) => setAction(e.target.value as 'confirm' | 'reject')}
                    className="mr-2 text-red-600 focus:ring-red-500"
                    disabled={loading}
                  />
                  <span className="text-red-700 font-medium">Rechazar Pago</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Notas {action === 'reject' ? '(requeridas)' : '(opcionales)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                rows={3}
                placeholder={action === 'confirm' 
                  ? 'Ej: Pago verificado en blockchain, hash válido'
                  : 'Ej: Hash de transacción inválido, monto incorrecto'
                }
                disabled={loading}
                required={action === 'reject'}
              />
            </div>

            {/* Warning for reject */}
            {action === 'reject' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">¡Atención!</p>
                    <p>Al rechazar este pago, el usuario deberá realizar una nueva compra. Esta acción no se puede deshacer.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation for approve */}
            {action === 'confirm' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-1">Confirmación</p>
                    <p>Al confirmar este pago, se activará la compra del usuario y comenzarán a generarse los beneficios y comisiones correspondientes.</p>
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
                disabled={loading || (action === 'reject' && !notes.trim())}
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                  action === 'confirm'
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  action === 'confirm' ? 'Confirmar Pago' : 'Rechazar Pago'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const AdminPurchases: React.FC = () => {
  const {
    purchases,
    loading,
    error,
    refetch,
    confirmPayment,
    rejectPayment,
    setFilters,
    filters
  } = useAdminPurchases();
  
  const [selectedPurchase, setSelectedPurchase] = useState<AdminPurchase | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const handleConfirmAction = async (action: 'confirm' | 'reject', notes?: string) => {
    if (!selectedPurchase) return;
    
    try {
      setActionLoading(true);
      
      let success = false;
      if (action === 'confirm') {
        success = await confirmPayment(selectedPurchase._id);
      } else {
        success = await rejectPayment(selectedPurchase._id, notes);
      }
      
      if (success) {
        toast.success(
          action === 'confirm' 
            ? 'Pago confirmado correctamente' 
            : 'Pago rechazado correctamente'
        );
        setShowConfirmModal(false);
        setSelectedPurchase(null);
        refetch();
      }
    } catch (error) {
      // Error ya manejado por el hook
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearch = () => {
    setFilters({ ...filters });
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setFilters({ ...filters, status: status === 'all' ? undefined : status });
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      hash_submitted: { color: 'bg-blue-100 text-blue-800', text: 'Hash Enviado' },
      confirmed: { color: 'bg-green-100 text-green-800', text: 'Confirmado' },
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

  // Filter purchases
  const filteredPurchases = purchases.filter(purchase => {
    // Status filter
    if (statusFilter !== 'all' && purchase.status !== statusFilter) {
      return false;
    }
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        purchase._id.toLowerCase().includes(searchLower) ||
        `${purchase.userId?.firstName} ${purchase.userId?.lastName}`.toLowerCase().includes(searchLower) ||
        purchase.userId?.email?.toLowerCase().includes(searchLower) ||
        purchase.packageId?.name?.toLowerCase().includes(searchLower) ||
        (purchase as any)?.transaction?.hash?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const purchaseDate = new Date(purchase.createdAt);
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          if (purchaseDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (purchaseDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (purchaseDate < monthAgo) return false;
          break;
      }
    }
    
    return true;
  });
  
  // Pagination
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPurchases = filteredPurchases.slice(startIndex, startIndex + itemsPerPage);
  
  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, dateFilter]);
  
  const pendingCount = purchases.filter(p => p.status === 'hash_submitted').length;
  const confirmedCount = purchases.filter(p => p.status === 'confirmed').length;
  const rejectedCount = purchases.filter(p => p.status === 'rejected').length;
  const totalAmount = purchases.reduce((sum, p) => sum + ((p as any)?.payment?.totalAmount || p.amount || 0), 0);

  return (
    <AdminLayout title="Compras">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">
            Gestión de Compras
          </h1>
          <p className="text-secondary-600">
            Administra y confirma los pagos de las compras de usuarios
          </p>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Última actualización: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4">
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
              <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600">Confirmados</p>
              <p className="text-2xl font-bold text-green-600">{confirmedCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600">Monto Total</p>
              <p className="text-2xl font-bold text-secondary-900">{formatAmount(totalAmount)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Management Section */}
      <WalletManagementSection />

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ID de compra, usuario, hash de transacción..."
                className="flex-1 px-4 py-2 border border-secondary-200 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"

              />
              <div className="px-4 py-2 bg-secondary-100 rounded-r-lg flex items-center">
                <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'hash_submitted', label: 'Pendientes' },
                { value: 'confirmed', label: 'Confirmados' },
                { value: 'rejected', label: 'Rechazados' }
              ].map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusFilter(status.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === status.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
            
            {/* Date Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'all', label: 'Todas las fechas' },
                { value: 'today', label: 'Hoy' },
                { value: 'week', label: 'Esta semana' },
                { value: 'month', label: 'Este mes' }
              ].map((date) => (
                <button
                  key={date.value}
                  onClick={() => setDateFilter(date.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    dateFilter === date.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
                >
                  {date.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Results count */}
          <div className="text-sm text-secondary-600">
            Mostrando {paginatedPurchases.length} de {filteredPurchases.length} compras
            {filteredPurchases.length !== purchases.length && ` (${purchases.length} total)`}
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

      {/* Purchases Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-secondary-100">
          <h2 className="text-xl font-semibold text-secondary-900">Lista de Compras</h2>
        </div>
        
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Compra</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Paquete</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRowSkeleton key={index} columns={7} />
                ))}
              </tbody>
            </table>
          </div>
        ) : !purchases || purchases.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-secondary-900 mb-2">No hay compras</h3>
            <p className="text-secondary-600">No se encontraron compras.</p>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-secondary-900 mb-2">No se encontraron resultados</h3>
            <p className="text-secondary-600">No hay compras que coincidan con los filtros aplicados.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setDateFilter('all');
              }}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Paquete</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Wallet/Hash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Licencia</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {paginatedPurchases.map((purchase) => (
                  <tr key={purchase._id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-secondary-900">
                          {purchase.userId?.firstName} {purchase.userId?.lastName}
                        </div>
                        <div className="text-sm text-secondary-500">
                          {purchase.userId?.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-secondary-900">
                        {purchase.packageId?.name}
                      </div>
                      <div className="text-sm text-secondary-500">
                        {formatAmount(purchase.packageId?.price)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">
                      {formatAmount((purchase as any)?.payment?.totalAmount || purchase.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs">
                        {purchase.assignedWallet && (
                          <div className="mb-1">
                            <span className="text-gray-500">Wallet:</span>
                            <div className="font-mono text-gray-700">
                              {purchase.assignedWallet.address.slice(0, 6)}...{purchase.assignedWallet.address.slice(-4)}
                            </div>
                            <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded">
                              {purchase.assignedWallet.network}
                            </span>
                          </div>
                        )}
                        {(purchase as any)?.transaction?.hash && (
                          <div>
                            <span className="text-gray-500">Hash:</span>
                            <div className="font-mono text-gray-700">
                              {(purchase as any).transaction.hash.slice(0, 8)}...{(purchase as any).transaction.hash.slice(-6)}
                            </div>
                          </div>
                        )}
                        {!purchase.assignedWallet && !(purchase as any)?.transaction?.hash && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs">
                        {purchase.licenseId ? (
                          <div>
                            <div className="font-mono text-gray-700 mb-1">
                              ID: {purchase.licenseId.slice(-8)}
                            </div>
                            {purchase.licenseStatus && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                purchase.licenseStatus === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                purchase.licenseStatus === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {purchase.licenseStatus}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Sin licencia</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(purchase.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                      {formatDate((purchase as any)?.transaction?.submittedAt || purchase.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {purchase.status === 'hash_submitted' && (
                        <button
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setShowConfirmModal(true);
                          }}
                          className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-300"
                        >
                          Revisar
                        </button>
                      )}
                      {purchase.status === 'confirmed' && (
                        <span className="text-green-600 font-medium">Confirmado</span>
                      )}
                      {purchase.status === 'rejected' && (
                        <span className="text-red-600 font-medium">Rechazado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-secondary-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-secondary-600">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                
                {/* Page numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'border border-secondary-200 text-secondary-700 hover:bg-secondary-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {selectedPurchase && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setSelectedPurchase(null);
          }}
          purchase={selectedPurchase}
          onConfirm={handleConfirmAction}
          loading={actionLoading}
        />
      )}
    </AdminLayout>
  );
};

export default AdminPurchases;