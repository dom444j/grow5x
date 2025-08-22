import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminReferrals } from '../../hooks/admin/useAdminReferrals';
import { useAdminReferralStats } from '../../hooks/admin/useAdminReferralStats';
import { toast } from 'react-hot-toast';
import { RefreshCw, Clock } from 'lucide-react';

const AdminReferrals: React.FC = () => {
  const { referrals, isLoading, error, refetch, totalUsers, totalReferrals, totalCommissions } = useAdminReferrals();
  const { stats, isLoading: isLoadingStats } = useAdminReferralStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'referrals' | 'commissions' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const filteredReferrals = referrals
    .filter(referral => 
      referral.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.referralCode.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'referrals':
          aValue = a.totalReferrals;
          bValue = b.totalReferrals;
          break;
        case 'commissions':
          aValue = a.totalCommissions;
          bValue = b.totalCommissions;
          break;
        case 'date':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

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

  const copyReferralCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Código copiado al portapapeles');
    } catch (error) {
      toast.error('Error al copiar el código');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (error) {
    return (
      <AdminLayout title="Referidos">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-red-600">{(error as any)?.message || error || 'Error desconocido'}</p>
            <button
              onClick={refetch}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Referidos">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-secondary-900 mb-2">Gestión de Referidos</h1>
              <p className="text-secondary-600">Administra y monitorea el sistema de referidos de la plataforma</p>
              {lastUpdated && (
                <div className="flex items-center gap-2 mt-2 text-sm text-secondary-500">
                  <Clock className="w-4 h-4" />
                  <span>Última actualización: {lastUpdated.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
               <label className="flex items-center gap-2 text-sm text-secondary-600">
                 <input
                   type="checkbox"
                   checked={autoRefresh}
                   onChange={(e) => setAutoRefresh(e.target.checked)}
                   className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                 />
                 Auto-actualizar
               </label>
               <button
                 onClick={() => {
                   refetch();
                   setLastUpdated(new Date());
                 }}
                 disabled={isLoading}
                 className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg transition-colors"
               >
                 <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                 Actualizar
               </button>
             </div>
          </div>
        </div>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 mb-1">Total Usuarios</p>
                <p className="text-3xl font-bold text-blue-600">{totalUsers.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 mb-1">Total Referidos</p>
                <p className="text-3xl font-bold text-green-600">{totalReferrals.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 mb-1">Comisiones Totales</p>
                <p className="text-3xl font-bold text-purple-600">${totalCommissions.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700 mb-1">Tasa Conversión</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.conversionRate?.toFixed(1) || '0'}%</p>
              </div>
              <div className="w-12 h-12 bg-orange-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Top Referrers */}
        {stats?.topReferrers && stats.topReferrers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-secondary-900 mb-6">Top Referidores</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.topReferrers.slice(0, 3).map((referrer, index) => (
                <div key={referrer._id} className="bg-gradient-to-br from-secondary-50 to-secondary-100 rounded-xl p-4 border border-secondary-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-secondary-600">#{index + 1}</span>
                    <span className="text-sm bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                      {referrer.totalReferrals} referidos
                    </span>
                  </div>
                  <h3 className="font-semibold text-secondary-900 mb-1">{referrer.name}</h3>
                  <p className="text-sm text-secondary-600 mb-2">{referrer.email}</p>
                  <p className="text-lg font-bold text-green-600">${referrer.totalCommissions.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros y búsqueda */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar por nombre, email o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 border border-secondary-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              >
                <option value="date">Fecha</option>
                <option value="name">Nombre</option>
                <option value="referrals">Referidos</option>
                <option value="commissions">Comisiones</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-3 bg-secondary-100 hover:bg-secondary-200 text-secondary-700 rounded-xl transition-colors"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de referidos */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 overflow-hidden">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-secondary-600">Cargando referidos...</p>
              </div>
            ) : filteredReferrals.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-16 h-16 text-secondary-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">No hay referidos</h3>
                <p className="text-secondary-600">No se encontraron referidos que coincidan con los criterios de búsqueda.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-secondary-50 border-b border-secondary-200">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Usuario</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Código</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Referidos</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Comisiones</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Referido por</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Fecha</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-200">
                  {filteredReferrals.map((referral) => (
                    <tr key={referral._id} className="hover:bg-secondary-50 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-semibold text-secondary-900">{referral.name}</div>
                          <div className="text-sm text-secondary-600">{referral.email}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => copyReferralCode(referral.referralCode)}
                          className="bg-primary-100 hover:bg-primary-200 text-primary-700 px-3 py-1 rounded-lg text-sm font-mono transition-colors"
                          title="Clic para copiar"
                        >
                          {referral.referralCode}
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                          {referral.totalReferrals || 0}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-green-600">
                          ${(referral.totalCommissions || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {referral.referredBy ? (
                          <div>
                            <div className="text-sm font-medium text-secondary-900">{referral.referredBy.name}</div>
                            <div className="text-xs text-secondary-600">{referral.referredBy.email}</div>
                          </div>
                        ) : (
                          <span className="text-secondary-400 text-sm">Registro directo</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-secondary-600">
                        {formatDate(referral.createdAt)}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          referral.isActive 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {referral.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReferrals;