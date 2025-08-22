import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
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
  FiChevronRight,
  FiSearch,
  FiFilter,
  FiEye,
  FiClock,
  FiDollarSign,
  FiCopy,
  FiCheck
} from 'react-icons/fi';
import useWallets from '../../hooks/useWallets';
import AddWalletModal from './AddWalletModal';
import EditWalletModal from './EditWalletModal';
import WalletTransactionsModal from './WalletTransactionsModal';

const WalletManagementSection = () => {
  const {
    wallets,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    changePage,
    deleteWallet,
    suspendWallet,
    activateWallet
  } = useWallets();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedAddress, setCopiedAddress] = useState(null);

  // Calculate wallet statistics
  const walletStats = {
    total: wallets.length,
    available: wallets.filter(w => w.status === 'AVAILABLE').length,
    maintenance: wallets.filter(w => w.status === 'MAINTENANCE').length,
    disabled: wallets.filter(w => w.status === 'DISABLED').length
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    updateFilters({ search: value });
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    updateFilters({ status });
  };

  const copyToClipboard = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      toast.success('Dirección copiada al portapapeles');
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (error) {
      toast.error('Error al copiar la dirección');
    }
  };

  // Modal handlers
  const handleEditWallet = (wallet) => {
    setSelectedWallet(wallet);
    setShowEditModal(true);
  };

  const handleViewTransactions = (wallet) => {
    setSelectedWallet(wallet);
    setShowTransactionsModal(true);
  };

  const handleDeleteWallet = async (wallet) => {
    if (wallet.status === 'AVAILABLE') {
      toast.error('No se puede eliminar una wallet disponible. Ponla en mantenimiento primero.');
      return;
    }

    if (window.confirm(`¿Estás seguro de que quieres eliminar la wallet ${wallet.address.slice(0, 8)}...?`)) {
      try {
        await deleteWallet(wallet.id);
        toast.success('Wallet eliminada exitosamente');
      } catch (error) {
        toast.error('Error al eliminar la wallet');
      }
    }
  };

  const handleMaintenanceWallet = async (wallet) => {
    const reason = window.prompt('Razón para poner en mantenimiento (opcional):');
    if (reason !== null) { // User didn't cancel
      try {
        await suspendWallet(wallet.id, reason);
        toast.success('Wallet puesta en mantenimiento exitosamente');
      } catch (error) {
        toast.error('Error al poner la wallet en mantenimiento');
      }
    }
  };

  const handleActivateWallet = async (wallet) => {
    try {
      await activateWallet(wallet.id);
      toast.success('Wallet activada exitosamente');
    } catch (error) {
      toast.error('Error al activar la wallet');
    }
  };

  const closeModals = () => {
    setShowEditModal(false);
    setShowTransactionsModal(false);
    setSelectedWallet(null);
  };

  const formatDate = (date) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount) => {
    if (!amount || amount === 0) return '$0.00';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      AVAILABLE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Disponible' },
      MAINTENANCE: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Mantenimiento' },
      DISABLED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Deshabilitada' }
    };
    
    const config = statusConfig[status] || statusConfig.AVAILABLE;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Gestión de Wallets de Recaudo</h2>
          <p className="text-gray-600">Pool V2 - {pagination.total} wallets USDT BEP20 con rotación LRS (sin locks)</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Añadir Wallet
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Wallets</p>
              <p className="text-2xl font-bold text-blue-900">{pagination.total}</p>
            </div>
            <FiCreditCard className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Disponibles</p>
              <p className="text-2xl font-bold text-green-900">{walletStats.available}</p>
            </div>
            <FiShield className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-600 text-sm font-medium">Mantenimiento</p>
              <p className="text-2xl font-bold text-yellow-900">{walletStats.maintenance}</p>
            </div>
            <FiPause className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Rotación LRS</p>
              <p className="text-2xl font-bold text-purple-900">Activa</p>
            </div>
            <FiRotateCcw className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por dirección, label o ID..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="AVAILABLE">Disponibles</option>
            <option value="MAINTENANCE">Mantenimiento</option>
            <option value="DISABLED">Deshabilitadas</option>
          </select>
        </div>
      </div>

      {/* Wallets Table */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No se encontraron wallets</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dirección
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Vez Usada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto Recibido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transacciones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {wallets.map((wallet) => (
                  <tr key={wallet.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900 font-mono">
                            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                          </div>
                          {wallet.label && (
                            <div className="text-sm text-gray-500">{wallet.label}</div>
                          )}
                        </div>
                        <button
                          onClick={() => copyToClipboard(wallet.address)}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded"
                          title="Copiar dirección completa"
                        >
                          {copiedAddress === wallet.address ? (
                            <FiCheck className="w-4 h-4 text-green-600" />
                          ) : (
                            <FiCopy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(wallet.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <FiClock className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(wallet.lastUsed)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <FiDollarSign className="w-4 h-4 mr-2 text-gray-400" />
                        {formatAmount(wallet.totalReceived)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex flex-col">
                        <span className="text-green-600">{wallet.successfulTransactions || 0} exitosas</span>
                        <span className="text-red-600">{wallet.failedTransactions || 0} fallidas</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewTransactions(wallet)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="Ver transacciones"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                         
                         <button
                           onClick={() => handleEditWallet(wallet)}
                           className="text-gray-600 hover:text-gray-900 p-1 rounded"
                           title="Editar"
                         >
                           <FiEdit3 className="w-4 h-4" />
                         </button>
                         
                         {wallet.status === 'AVAILABLE' ? (
                           <button
                             onClick={() => handleMaintenanceWallet(wallet)}
                             className="text-yellow-600 hover:text-yellow-900 p-1 rounded"
                             title="Poner en Mantenimiento"
                           >
                             <FiPause className="w-4 h-4" />
                           </button>
                         ) : (wallet.status === 'MAINTENANCE' || wallet.status === 'DISABLED') ? (
                           <button
                             onClick={() => handleActivateWallet(wallet)}
                             className="text-green-600 hover:text-green-900 p-1 rounded"
                             title="Activar"
                           >
                             <FiPlay className="w-4 h-4" />
                           </button>
                         ) : null}
                         
                         {wallet.status !== 'AVAILABLE' && (
                           <button
                             onClick={() => handleDeleteWallet(wallet)}
                             className="text-red-600 hover:text-red-900 p-1 rounded"
                             title="Eliminar"
                           >
                             <FiTrash2 className="w-4 h-4" />
                           </button>
                         )}
                        
                        <a
                          href={`https://bscscan.com/address/${wallet.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-900 p-1 rounded"
                          title="Ver en BSCScan"
                        >
                          <FiExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} wallets
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => changePage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          pageNum === pagination.page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddWalletModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
        />
      )}
      
      {showEditModal && selectedWallet && (
        <EditWalletModal
          isOpen={showEditModal}
          onClose={closeModals}
          wallet={selectedWallet}
        />
      )}
      
      {showTransactionsModal && selectedWallet && (
        <WalletTransactionsModal
          isOpen={showTransactionsModal}
          onClose={closeModals}
          wallet={selectedWallet}
        />
      )}
    </div>
  );
};

export default WalletManagementSection;