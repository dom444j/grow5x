import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardSkeleton, TableRowSkeleton, StatsCardSkeleton } from '../../components/Skeleton';
import HealthIndicator from '../../components/HealthIndicator';
import AdminLayout from '../../components/admin/AdminLayout';
import { useLicenseRealtime, useAdminRealtime } from '../../hooks/useRealtime';
import { RefreshCw, Clock } from 'lucide-react';
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
import { withAuth, api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

// Tipos para las licencias
type License = {
  _id: string;
  user: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  package: {
    _id: string;
    name: string;
  };
  principalUSDT: number;
  accruedUSDT: number;
  ganado: number;
  tope: number;
  restanteUSDT: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  daysGenerated: number;
  createdAt: string;
  activatedAt?: string;
  // Información de wallet y compra
  purchaseId?: string;
  walletAddress?: string;
  paymentHash?: string;
  network?: string;
};

type LicensesResponse = {
  licenses: License[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

const Licenses: React.FC = () => {
  const { token } = useAuth();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLicenses, setTotalLicenses] = useState(0);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'pause' | 'resume' | 'complete' | 'editCap'>('pause');
  const [actionReason, setActionReason] = useState('');
  const [newCapPercent, setNewCapPercent] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Estadísticas
  const [stats, setStats] = useState({
    totalActive: 0,
    totalPaused: 0,
    totalCompleted: 0,
    totalPrincipal: 0,
    totalAccrued: 0
  });

  // Real-time updates for licenses
  useLicenseRealtime((eventType, data) => {
    console.log('License realtime event:', eventType, data);
    
    if (eventType === 'licensePaused' || eventType === 'licenseResumed') {
      toast.success(`Licencia ${eventType === 'licensePaused' ? 'pausada' : 'reanudada'}`);
      fetchLicenses(currentPage, searchTerm, statusFilter);
    }
  });

  // Real-time updates for admin
  useAdminRealtime((eventType, data) => {
    console.log('Admin realtime event:', eventType, data);
    
    if (eventType === 'adminUpdate') {
      // Refresh data when admin updates occur
      fetchLicenses(currentPage, searchTerm, statusFilter);
    }
  });

  const fetchLicenses = async (page = 1, search = '', status = '') => {
    try {
      if (!token) {
        toast.error('Token de acceso requerido');
        return;
      }

      setLoading(page === 1);
      setRefreshing(page !== 1);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (search) params.append('q', search);
      if (status) params.append('status', status);

      const api = withAuth(token);
      const response = await api.GET(`/admin/licenses?${params}`);
      const data = response as LicensesResponse;

      setLicenses(data.licenses);
      setCurrentPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
      setTotalLicenses(data.pagination.total);

      // Calcular estadísticas
      const newStats = data.licenses.reduce((acc, license) => {
        if (license.status === 'ACTIVE') acc.totalActive++;
        else if (license.status === 'PAUSED') acc.totalPaused++;
        else if (license.status === 'COMPLETED') acc.totalCompleted++;
        
        acc.totalPrincipal += license.principalUSDT;
        acc.totalAccrued += license.accruedUSDT;
        return acc;
      }, {
        totalActive: 0,
        totalPaused: 0,
        totalCompleted: 0,
        totalPrincipal: 0,
        totalAccrued: 0
      });

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching licenses:', error);
      toast.error('Error al cargar las licencias');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLicenses(1, searchTerm, statusFilter);
  }, [searchTerm, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLicenses(1, searchTerm, statusFilter);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchLicenses(page, searchTerm, statusFilter);
  };

  const handleAction = (license: License, action: 'pause' | 'resume' | 'complete' | 'editCap') => {
    setSelectedLicense(license);
    setActionType(action);
    setActionReason('');
    setNewCapPercent(action === 'editCap' ? license.tope.toString() : '');
    setShowActionModal(true);
  };

  const executeAction = async () => {
    if (!selectedLicense || !actionType) return;

    if (!actionReason.trim() && actionType !== 'editCap') {
      toast.error('La razón es requerida');
      return;
    }

    if (actionType === 'editCap' && (!newCapPercent || isNaN(Number(newCapPercent)))) {
      toast.error('Porcentaje de tope inválido');
      return;
    }

    try {
      setProcessingAction(true);

      let endpoint = '';
      let payload: any = {};

      switch (actionType) {
        case 'pause':
          endpoint = `/admin/licenses/${selectedLicense._id}/pause`;
          payload = { reason: actionReason };
          break;
        case 'resume':
          endpoint = `/admin/licenses/${selectedLicense._id}/resume`;
          payload = { reason: actionReason };
          break;
        case 'complete':
          endpoint = `/admin/licenses/${selectedLicense._id}/complete`;
          payload = { reason: actionReason };
          break;
        case 'editCap':
          endpoint = `/admin/licenses/${selectedLicense._id}/cap`;
          payload = { capPercentMax: Number(newCapPercent) };
          break;
      }

      const method = actionType === 'editCap' ? 'patch' : 'post';
      await api[method](endpoint, payload);

      toast.success(`Licencia ${actionType === 'pause' ? 'pausada' : actionType === 'resume' ? 'reanudada' : actionType === 'complete' ? 'completada' : 'actualizada'} exitosamente`);
      
      setShowActionModal(false);
      fetchLicenses(currentPage, searchTerm, statusFilter);
    } catch (error: any) {
      console.error('Error executing action:', error);
      toast.error(error.response?.data?.error || 'Error al ejecutar la acción');
    } finally {
      setProcessingAction(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: { color: 'bg-green-100 text-green-800', text: 'Activa' },
      PAUSED: { color: 'bg-yellow-100 text-yellow-800', text: 'Pausada' },
      COMPLETED: { color: 'bg-gray-100 text-gray-800', text: 'Completada' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ACTIVE;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
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
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <DashboardSkeleton />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Licencias en Producción</h1>
            <p className="text-gray-600">Gestión de licencias activas y sus beneficios</p>
          </div>
          <div className="flex items-center space-x-3">
            <HealthIndicator />
            <button
              onClick={() => fetchLicenses(currentPage, searchTerm, statusFilter)}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FiPlay className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Activas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalActive}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FiPause className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pausadas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPaused}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FiCheck className="w-6 h-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completadas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCompleted}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiDollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Principal Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPrincipal)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiTrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Acumulado Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAccrued)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por email del usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos los estados</option>
                <option value="ACTIVE">Activas</option>
                <option value="PAUSED">Pausadas</option>
                <option value="COMPLETED">Completadas</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <FiSearch className="w-4 h-4 mr-2" />
              Buscar
            </button>
          </form>
        </div>

        {/* Licenses Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Licencias ({totalLicenses})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principal USDT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acumulado USDT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ganado %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tope %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Restante USDT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wallet/Hash
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Días Generados
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {licenses.map((license) => (
                  <tr key={license._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {license.user.email}
                        </div>
                        <div className="text-sm text-gray-500">
                          {license.user.firstName} {license.user.lastName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(license.principalUSDT)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(license.accruedUSDT)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {license.ganado.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {license.tope}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(license.restanteUSDT)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs space-y-1">
                        {license.walletAddress && (
                          <div className="mb-1">
                            <span className="text-gray-500">Wallet:</span>
                            <div className="font-mono text-gray-700 cursor-pointer hover:text-blue-600" 
                                 title={license.walletAddress}
                                 onClick={() => navigator.clipboard.writeText(license.walletAddress)}>
                              {license.walletAddress.slice(0, 6)}...{license.walletAddress.slice(-4)}
                            </div>
                            {license.network && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded">
                                {license.network}
                              </span>
                            )}
                          </div>
                        )}
                        {license.paymentHash && (
                          <div className="flex items-center space-x-1">
                            <div>
                              <span className="text-gray-500">Hash:</span>
                              <div className="font-mono text-gray-700 cursor-pointer hover:text-blue-600" 
                                   title={license.paymentHash}
                                   onClick={() => navigator.clipboard.writeText(license.paymentHash)}>
                                {license.paymentHash.slice(0, 8)}...{license.paymentHash.slice(-6)}
                              </div>
                            </div>
                            <a href={`https://bscscan.com/tx/${license.paymentHash}`} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="text-blue-600 hover:text-blue-800">
                              <FiExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {license.purchaseId && (
                          <div className="mt-1">
                            <span className="text-xs text-green-600 bg-green-50 px-1 rounded cursor-pointer hover:bg-green-100" 
                                  title={license.purchaseId}
                                  onClick={() => navigator.clipboard.writeText(license.purchaseId)}>
                              ID: {(() => {
                                const pid = typeof license.purchaseId === 'string'
                                  ? license.purchaseId
                                  : (license.purchaseId?._id ?? String(license.purchaseId ?? ''));
                                return pid.slice(-6);
                              })()}
                            </span>
                          </div>
                        )}
                        {!license.walletAddress && !license.paymentHash && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(license.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {license.daysGenerated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {license.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleAction(license, 'pause')}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Pausar"
                          >
                            <FiPause className="w-4 h-4" />
                          </button>
                        )}
                        {license.status === 'PAUSED' && (
                          <button
                            onClick={() => handleAction(license, 'resume')}
                            className="text-green-600 hover:text-green-900"
                            title="Reanudar"
                          >
                            <FiPlay className="w-4 h-4" />
                          </button>
                        )}
                        {['ACTIVE', 'PAUSED'].includes(license.status) && (
                          <>
                            <button
                              onClick={() => handleAction(license, 'complete')}
                              className="text-gray-600 hover:text-gray-900"
                              title="Completar"
                            >
                              <FiCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAction(license, 'editCap')}
                              className="text-blue-600 hover:text-blue-900"
                              title="Editar Tope"
                            >
                              <FiEdit3 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando página {currentPage} de {totalPages} ({totalLicenses} licencias)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 border rounded-md text-sm ${
                          page === currentPage
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {showActionModal && selectedLicense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {actionType === 'pause' && 'Pausar Licencia'}
              {actionType === 'resume' && 'Reanudar Licencia'}
              {actionType === 'complete' && 'Completar Licencia'}
              {actionType === 'editCap' && 'Editar Tope de Licencia'}
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Usuario: {selectedLicense.user.email}
              </p>
              <p className="text-sm text-gray-600">
                Principal: {formatCurrency(selectedLicense.principalUSDT)}
              </p>
            </div>

            {actionType === 'editCap' ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nuevo Porcentaje de Tope (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  value={newCapPercent}
                  onChange={(e) => setNewCapPercent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: 150"
                />
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón *
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe la razón para esta acción..."
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowActionModal(false)}
                disabled={processingAction}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeAction}
                disabled={processingAction || (!actionReason.trim() && actionType !== 'editCap') || (actionType === 'editCap' && !newCapPercent)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {processingAction && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                {actionType === 'pause' && 'Pausar'}
                {actionType === 'resume' && 'Reanudar'}
                {actionType === 'complete' && 'Completar'}
                {actionType === 'editCap' && 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Licenses;