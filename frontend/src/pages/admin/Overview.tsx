import React from 'react';
import { useAdminOverview } from '../../hooks/useAdminOverview';
import { RefreshCw, TrendingUp, Users, DollarSign, CreditCard, Database, AlertTriangle, Clock, ArrowUpRight, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminOverview() {
  const { data, loading, error, lastUpdated, refetch } = useAdminOverview();

  if (loading) {
    return (
      <AdminLayout title="Overview">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Cargando overview...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Overview">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Error al cargar datos: {error || 'Error desconocido'}</p>
            <button
              onClick={refetch}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num);
  };

  const formatInterval = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <AdminLayout title="Overview">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
            <p className="text-gray-600 mt-2">
              KPIs ejecutivos • Actualizado: {data ? new Date(data.asOf).toLocaleString('es-ES') : 'N/A'}
            </p>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-1">
                Última actualización: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={refetch}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </button>
          </div>
        </div>

        {/* Main KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Ventas 24h */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Ventas 24h</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data ? formatCurrency(data.sales.amount24hUSDT) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  {data ? `${formatNumber(data.sales.count24h)} transacciones` : 'N/A'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <Link
              to="/admin/reports"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              Ver detalles <ArrowUpRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Ventas 7d */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Ventas 7d</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data ? formatCurrency(data.sales.amount7dUSDT) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  {data ? `${formatNumber(data.sales.count7d)} transacciones` : 'N/A'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
            <Link
              to="/admin/reports"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              Ver detalles <ArrowUpRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Directos 24h */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Referidos Directos 24h</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data ? formatCurrency(data.referrals.direct24hUSDT) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Comisiones directas</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
            <Link
              to="/admin/reports"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              Ver detalles <ArrowUpRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Padre Global (cola D+18) */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Padre Global (cola D+18)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data ? formatCurrency(data.referrals.parentGlobalQueuedUSDT) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Liberado 24h: {data ? formatCurrency(data.referrals.parentGlobalReleased24hUSDT) : 'N/A'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <Link
              to="/admin/reports"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              Ver detalles <ArrowUpRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Beneficios hoy */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Beneficios Hoy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data ? formatCurrency(data.benefits.todayUSDT) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Pendientes: {data ? formatNumber(data.benefits.pendingCount) : 'N/A'} |
                  Pagados: {data ? formatNumber(data.benefits.paidCount) : 'N/A'}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <Link
              to="/admin/reports"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              Ver detalles <ArrowUpRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Retiros pendientes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Retiros Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data ? formatNumber(data.withdrawals.pending) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Aprobados: {data ? formatNumber(data.withdrawals.approved) : 'N/A'} |
                  SLA 7d: {data ? `${data.withdrawals.slaHitRate7d}%` : 'N/A'}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-red-600" />
            </div>
            <Link
              to="/admin/withdrawals"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              Ver detalles <ArrowUpRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Pool V2 Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Pool V2 Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {data ? formatNumber(data.poolV2.total) : 'N/A'}
              </p>
              <p className="text-sm text-gray-500">Total Wallets</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {data ? formatNumber(data.poolV2.available) : 'N/A'}
              </p>
              <p className="text-sm text-gray-500">Disponibles</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {data ? formatInterval(data.poolV2.medianIntervalMs) : 'N/A'}
              </p>
              <p className="text-sm text-gray-500">Intervalo Mediano</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {data ? formatInterval(data.poolV2.p90IntervalMs) : 'N/A'}
              </p>
              <p className="text-sm text-gray-500">P90 Intervalo</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Enlaces Rápidos - Producción</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {/* Operaciones Críticas */}
            <Link
              to="/admin/purchases"
              className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Gestionar Pagos
            </Link>
            <Link
              to="/admin/withdrawals"
              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Retiros Pendientes
            </Link>
            <Link
              to="/admin/users?role=padre"
              className="inline-flex items-center px-4 py-2 border border-purple-300 rounded-md shadow-sm text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
            >
              <Users className="h-4 w-4 mr-2" />
              Roles Padre
            </Link>
            
            {/* Gestión de Usuarios */}
            <Link
              to="/admin/users"
              className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Users className="h-4 w-4 mr-2" />
              Todos los Usuarios
            </Link>
            <Link
              to="/admin/referrals"
              className="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Referidos
            </Link>
            <Link
              to="/admin/cohorts"
              className="inline-flex items-center px-4 py-2 border border-yellow-300 rounded-md shadow-sm text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
            >
              <Users className="h-4 w-4 mr-2" />
              Cohortes
            </Link>
          </div>
          
          {/* Segunda fila - Reportes y Sistema */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mt-4">
            <Link
              to="/admin/reports"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Reportes
            </Link>
            <Link
              to="/admin/packages"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Database className="h-4 w-4 mr-2" />
              Paquetes
            </Link>
            <Link
              to="/admin/health"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Database className="h-4 w-4 mr-2" />
              Estado Sistema
            </Link>
            <Link
              to="/admin/import-jobs"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Database className="h-4 w-4 mr-2" />
              Importaciones
            </Link>
          </div>
        </div>
    </AdminLayout>
  );
}