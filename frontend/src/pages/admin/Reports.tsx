import React, { useState, useEffect, useRef } from 'react';
import {
  useAdminReports,
  useAdminReportsSales,
  useAdminReportsReferrals,
  useAdminReportsBenefits,
  useAdminReportsWithdrawals,
  useAdminReportsExport,
  useDefaultDateRanges
} from '../../hooks/useAdminReports';
import { toast } from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import { RefreshCw, Clock } from 'lucide-react';

interface DateRangeInputs {
  from: string;
  to: string;
}

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'referrals' | 'benefits' | 'withdrawals'>('sales');
  const [dateRange, setDateRange] = useState<DateRangeInputs>(() => {
    const defaultRanges = useDefaultDateRanges();
    return {
      from: defaultRanges.last7Days.from.split('T')[0],
      to: defaultRanges.last7Days.to.split('T')[0]
    };
  });
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const { exportCSV, loading: exportLoading, error: exportError } = useAdminReportsExport();

  // Convertir fechas para los hooks
  const apiDateRange = {
    from: `${dateRange.from}T00:00:00Z`,
    to: `${dateRange.to}T23:59:59Z`
  };

  // Nueva API unificada de reportes
  const unifiedReports = useAdminReports(
    `${dateRange.from}T00:00:00Z`,
    `${dateRange.to}T23:59:59Z`,
    'America/Lima'
  );

  // Hooks para datos (mantener compatibilidad)
  const salesData = useAdminReportsSales(apiDateRange);
  const referralsData = useAdminReportsReferrals(apiDateRange);
  const benefitsData = useAdminReportsBenefits(apiDateRange);
  const withdrawalsData = useAdminReportsWithdrawals(apiDateRange, withdrawalStatus);

  // Auto-refresh functionality
  useEffect(() => {
    const fetchData = async () => {
      // Refetch all data
      unifiedReports.refetch();
      salesData.refetch();
      referralsData.refetch();
      benefitsData.refetch();
      withdrawalsData.refetch();
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
  }, [autoRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Manejo de errores según las instrucciones
  React.useEffect(() => {
    if (unifiedReports.error) {
      if (unifiedReports.error.includes('no tiene rol admin')) {
        toast.error('Tu usuario no tiene rol admin');
        // Redirigir a login admin o pantalla de ayuda
        window.location.href = '/admin/login';
      } else {
        toast.error(unifiedReports.error);
      }
    }
  }, [unifiedReports.error]);

  const handleExport = async (dataset: 'sales' | 'referrals' | 'benefits' | 'withdrawals') => {
    await exportCSV(dataset, apiDateRange);
  };

  // Nueva función de exportación usando la API unificada
  const handleUnifiedExport = (type: 'sales' | 'referrals' | 'benefits' | 'withdrawals') => {
    const params = new URLSearchParams({
      type,
      start: `${dateRange.from}T00:00:00Z`,
      end: `${dateRange.to}T23:59:59Z`,
      tz: 'America/Lima'
    });
    
    // Abrir en nueva pestaña según las instrucciones
    window.open(`/api/admin/reports/export?${params}`, '_blank');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const tabs = [
    { id: 'sales', label: 'Ventas', icon: '💰' },
    { id: 'referrals', label: 'Referidos', icon: '👥' },
    { id: 'benefits', label: 'Beneficios', icon: '🎁' },
    { id: 'withdrawals', label: 'Retiros', icon: '💸' }
  ];

  return (
    <AdminLayout title="Reportes">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">📊 Reportes Administrativos</h1>
            <p className="text-gray-600">Análisis y métricas del sistema Grow5X</p>
            {lastUpdated && (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Última actualización: {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-actualizar
            </label>
            <button
              onClick={() => {
                unifiedReports.refetch();
                salesData.refetch();
                referralsData.refetch();
                benefitsData.refetch();
                withdrawalsData.refetch();
                setLastUpdated(new Date());
              }}
              disabled={unifiedReports.loading || salesData.loading || referralsData.loading || benefitsData.loading || withdrawalsData.loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${(unifiedReports.loading || salesData.loading || referralsData.loading || benefitsData.loading || withdrawalsData.loading) ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

        {/* Filtros de fecha */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📅 Filtros de Período</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Desde</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Hasta</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {activeTab === 'withdrawals' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado (Opcional)</label>
                <select
                  value={withdrawalStatus}
                  onChange={(e) => setWithdrawalStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="pending">Pendiente</option>
                  <option value="approved">Aprobado</option>
                  <option value="completed">Completado</option>
                  <option value="rejected">Rechazado</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Sales Tab */}
            {activeTab === 'sales' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">💰 Reportes de Ventas</h3>
                  <button
                    onClick={() => handleExport('sales')}
                    disabled={exportLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium"
                  >
                    {exportLoading ? '⏳ Exportando...' : '📄 Export CSV'}
                  </button>
                </div>
                
                {salesData.loading && <div className="text-center py-8">⏳ Cargando datos...</div>}
                {salesData.error && <div className="text-red-600 py-4">❌ Error: {(salesData.error as any)?.message || salesData.error || 'Error desconocido'}</div>}
                
                {salesData.data && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paquete</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto USDT</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Compras</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {benefitsData.data && [
                          <tr key="today">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              📅 Hoy
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency((benefitsData.data as any)?.todayGenerated || 0)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              -
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date().toLocaleDateString()}
                            </td>
                          </tr>,
                          <tr key="range">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              📊 Rango Seleccionado
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency((benefitsData.data as any)?.rangeGenerated || 0)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              -
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {dateRange.from} - {dateRange.to}
                            </td>
                          </tr>
                        ]}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Referrals Tab */}
            {activeTab === 'referrals' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">👥 Reportes de Referidos</h3>
                  <button
                    onClick={() => handleExport('referrals')}
                    disabled={exportLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium"
                  >
                    {exportLoading ? '⏳ Exportando...' : '📄 Export CSV'}
                  </button>
                </div>
                
                {referralsData.loading && <div className="text-center py-8">⏳ Cargando datos...</div>}
                {referralsData.error && <div className="text-red-600 py-4">❌ Error: {(referralsData.error as any)?.message || referralsData.error || 'Error desconocido'}</div>}
                
                {referralsData.data && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto USDT</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {referralsData.data && [
                          // Fila para referidos directos
                          <tr key="direct-pending">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              🎯 Directo (10%)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                ⏳ Pendiente
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              -
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency((referralsData.data as any)?.direct?.pending || 0)}
                            </td>
                          </tr>,
                          <tr key="direct-released">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              🎯 Directo (10%)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                ✅ Liberado
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              -
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency((referralsData.data as any)?.direct?.released || 0)}
                            </td>
                          </tr>,
                          // Fila para padre global
                          <tr key="parent-pending">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              🌍 Padre Global (10%)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                ⏳ Pendiente
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              -
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency((referralsData.data as any)?.parentGlobal?.pending || 0)}
                            </td>
                          </tr>,
                          <tr key="parent-released">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              🌍 Padre Global (10%)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                ✅ Liberado
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              -
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency((referralsData.data as any)?.parentGlobal?.released || 0)}
                            </td>
                          </tr>
                        ]}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Benefits Tab */}
            {activeTab === 'benefits' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">🎁 Reportes de Beneficios</h3>
                  <button
                    onClick={() => handleExport('benefits')}
                    disabled={exportLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium"
                  >
                    {exportLoading ? '⏳ Exportando...' : '📄 Export CSV'}
                  </button>
                </div>
                
                {benefitsData.loading && <div className="text-center py-8">⏳ Cargando datos...</div>}
                {benefitsData.error && <div className="text-red-600 py-4">❌ Error: {(benefitsData.error as any)?.message || benefitsData.error || 'Error desconocido'}</div>}
                
                {benefitsData.data && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-6 text-white">
                      <div className="text-sm opacity-90 mb-2">📅 Generado Hoy</div>
                      <div className="text-2xl font-bold">{formatCurrency((benefitsData.data as any)?.todayGenerated || 0)}</div>
                      <div className="text-sm opacity-90 mt-4">📊 Generado en Rango</div>
                      <div className="text-xl font-semibold">{formatCurrency((benefitsData.data as any)?.rangeGenerated || 0)}</div>
                      <div className="flex justify-between mt-4 text-sm">
                        <span>📈 Período: {dateRange.from} - {dateRange.to}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Withdrawals Tab */}
            {activeTab === 'withdrawals' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">💸 Reportes de Retiros</h3>
                  <button
                    onClick={() => handleExport('withdrawals')}
                    disabled={exportLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium"
                  >
                    {exportLoading ? '⏳ Exportando...' : '📄 Export CSV'}
                  </button>
                </div>
                
                {withdrawalsData.loading && <div className="text-center py-8">⏳ Cargando datos...</div>}
                {withdrawalsData.error && <div className="text-red-600 py-4">❌ Error: {(withdrawalsData.error as any)?.message || withdrawalsData.error || 'Error desconocido'}</div>}
                
                {withdrawalsData.data && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto USDT</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo Promedio (7d)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA Hit Rate (7d)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {withdrawalsData.data && [
                          // Desglose por estado
                          ...Object.entries((withdrawalsData.data as any)?.statusBreakdown || {}).map(([status, data]) => (
                            <tr key={status}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  status === 'completed' ? 'bg-green-100 text-green-800' :
                                  status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                  status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {status === 'completed' ? '✅ Completado' :
                                   status === 'approved' ? '👍 Aprobado' :
                                   status === 'pending' ? '⏳ Pendiente' :
                                   '❌ Rechazado'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {(data as any)?.count || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatCurrency((data as any)?.amount || 0)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {(withdrawalsData.data as any)?.slaMetrics?.avgProcessingMinutes || 'N/A'} min
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {(withdrawalsData.data as any)?.slaMetrics?.slaHitRate ? ((withdrawalsData.data as any).slaMetrics.slaHitRate * 100).toFixed(1) + '%' : 'N/A'}
                              </td>
                            </tr>
                          ))
                        ]}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Export Error */}
        {exportError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">❌ Error al exportar: {(exportError as any)?.message || exportError || 'Error desconocido'}</div>
          </div>
        )}
    </AdminLayout>
  );
};

export default Reports;