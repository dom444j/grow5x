import React, { useState, useEffect } from 'react';
import { FiX, FiExternalLink, FiCopy, FiCheck, FiArrowRight, FiCalendar, FiDollarSign, FiUser, FiHash } from 'react-icons/fi';
import useWallets from '../../hooks/useWallets';
import { toast } from 'react-hot-toast';

const WalletTransactionsModal = ({ isOpen, onClose, wallet }) => {
  const { getWalletTransactions } = useWallets();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [copiedHash, setCopiedHash] = useState(null);

  // Load transactions when modal opens or page changes
  useEffect(() => {
    if (isOpen && wallet) {
      loadTransactions();
    }
  }, [isOpen, wallet, pagination.page]);

  const loadTransactions = async () => {
    if (!wallet) return;
    
    setLoading(true);
    try {
      const response = await getWalletTransactions(wallet.id, {
        page: pagination.page,
        limit: pagination.limit
      });
      
      setTransactions(response.transactions || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
        totalPages: response.totalPages || 0
      }));
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Error al cargar las transacciones');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(text);
      toast.success(`${type} copiado al portapapeles`);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (error) {
      toast.error('Error al copiar');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallida';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const openBlockExplorer = (hash) => {
    if (!hash) return;
    
    // Determine the appropriate block explorer based on network
    let explorerUrl;
    switch (wallet.network?.toLowerCase()) {
      case 'bep20':
      case 'bsc':
        explorerUrl = `https://bscscan.com/tx/${hash}`;
        break;
      case 'erc20':
      case 'ethereum':
        explorerUrl = `https://etherscan.io/tx/${hash}`;
        break;
      case 'trc20':
      case 'tron':
        explorerUrl = `https://tronscan.org/#/transaction/${hash}`;
        break;
      default:
        explorerUrl = `https://bscscan.com/tx/${hash}`; // Default to BSC
    }
    
    window.open(explorerUrl, '_blank');
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleClose = () => {
    setTransactions([]);
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
    setCopiedHash(null);
    onClose();
  };

  if (!isOpen || !wallet) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FiHash className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Historial de Transacciones</h2>
              <p className="text-sm text-gray-600 font-mono">
                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Wallet Summary */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatAmount(wallet.totalReceived || 0)}
              </div>
              <div className="text-sm text-gray-600">Total Recibido</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {wallet.totalAssigned || 0}
              </div>
              <div className="text-sm text-gray-600">Veces Asignada</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {wallet.successfulTransactions || 0}
              </div>
              <div className="text-sm text-gray-600">Tx Exitosas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {wallet.failedTransactions || 0}
              </div>
              <div className="text-sm text-gray-600">Tx Fallidas</div>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Cargando transacciones...</p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FiHash className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium mb-2">Sin transacciones</p>
                <p className="text-gray-500">Esta wallet aún no tiene transacciones registradas.</p>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {transactions.map((transaction, index) => (
                  <div key={transaction.id || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FiArrowRight className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                              {formatAmount(transaction.amount || transaction.purchase?.amount || 0)}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                              {getStatusLabel(transaction.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FiCalendar className="w-4 h-4" />
                            <span>{formatDate(transaction.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Transaction Hash */}
                      {transaction.transactionHash && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(transaction.transactionHash, 'Hash')}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                            title="Copiar hash"
                          >
                            {copiedHash === transaction.transactionHash ? (
                              <FiCheck className="w-3 h-3 text-green-600" />
                            ) : (
                              <FiCopy className="w-3 h-3" />
                            )}
                            <span className="font-mono">
                              {transaction.transactionHash.slice(0, 6)}...{transaction.transactionHash.slice(-4)}
                            </span>
                          </button>
                          <button
                            onClick={() => openBlockExplorer(transaction.transactionHash)}
                            className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Ver en explorador"
                          >
                            <FiExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Transaction Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {/* User Info */}
                      {transaction.purchase?.user && (
                        <div className="flex items-center gap-2">
                          <FiUser className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">
                              {transaction.purchase.user.name || transaction.purchase.user.email}
                            </div>
                            <div className="text-gray-600">
                              {transaction.purchase.user.email}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Package Info */}
                      {transaction.purchase?.package && (
                        <div className="flex items-center gap-2">
                          <FiDollarSign className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">
                              {transaction.purchase.package.name}
                            </div>
                            <div className="text-gray-600">
                              Paquete de inversión
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Network Info */}
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {wallet.network} - {wallet.currency}
                          </div>
                          <div className="text-gray-600">
                            Red blockchain
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {transaction.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">{transaction.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && transactions.length > 0 && pagination.totalPages > 1 && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} transacciones
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          pageNum === pagination.page
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletTransactionsModal;