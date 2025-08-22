import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { RefreshCw, Clock } from 'lucide-react';
import { useAdminHealth } from '../../hooks';
import { LoadingSpinner } from '../../components/Skeleton';
import HealthIndicator from '../../components/HealthIndicator';
import AdminLayout from '../../components/admin/AdminLayout';

interface ServiceStatusProps {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  details?: Record<string, any>;
  icon: React.ReactNode;
}

const ServiceStatus: React.FC<ServiceStatusProps> = ({ name, status, details, icon }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          dotColor: 'bg-green-500',
          bgColor: 'bg-green-50'
        };
      case 'degraded':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          dotColor: 'bg-yellow-500',
          bgColor: 'bg-yellow-50'
        };
      case 'down':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          dotColor: 'bg-red-500',
          bgColor: 'bg-red-50'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          dotColor: 'bg-gray-500',
          bgColor: 'bg-gray-50'
        };
    }
  };

  const config = getStatusConfig();

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <div className={`border rounded-xl p-6 ${config.bgColor} ${config.color.split(' ')[2]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mr-3">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{name}</h3>
            <div className="flex items-center mt-1">
              <div className={`w-2 h-2 rounded-full ${config.dotColor} mr-2`}></div>
              <span className={`text-sm font-medium px-2 py-1 rounded-full ${config.color}`}>
                {status === 'healthy' ? 'Saludable' : status === 'degraded' ? 'Degradado' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {details && (
        <div className="space-y-2 text-sm">
          {details.responseTime !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600">Tiempo de respuesta:</span>
              <span className="font-medium">{details.responseTime}ms</span>
            </div>
          )}
          {details.lastCheck && (
            <div className="flex justify-between">
              <span className="text-gray-600">Última verificación:</span>
              <span className="font-medium">{formatDate(details.lastCheck)}</span>
            </div>
          )}
          {details.lastRun && (
            <div className="flex justify-between">
              <span className="text-gray-600">Última ejecución:</span>
              <span className="font-medium">{formatDate(details.lastRun)}</span>
            </div>
          )}
          {details.nextRun && (
            <div className="flex justify-between">
              <span className="text-gray-600">Próxima ejecución:</span>
              <span className="font-medium">{formatDate(details.nextRun)}</span>
            </div>
          )}
          {details.lastNotification && (
            <div className="flex justify-between">
              <span className="text-gray-600">Última notificación:</span>
              <span className="font-medium">{formatDate(details.lastNotification)}</span>
            </div>
          )}
          {details.uptime !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600">Tiempo activo:</span>
              <span className="font-medium">{formatUptime(details.uptime)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  format?: 'number' | 'percentage';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color, format = 'number' }) => {
  const formatValue = (val: number) => {
    if (format === 'percentage') {
      return `${val.toFixed(1)}%`;
    }
    return val.toLocaleString('es-ES');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{formatValue(value)}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const AdminHealth: React.FC = () => {
  const { health, loading, error, refetch, autoRefresh, setAutoRefresh } = useAdminHealth(30000);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);

  const handleRefreshIntervalChange = (seconds: number) => {
    setRefreshInterval(seconds);
    // Note: This would require modifying the hook to accept dynamic intervals
    // For now, we'll just update the display
  };

  const handleManualRefresh = async () => {
    try {
      await refetch();
      setLastUpdated(new Date());
      toast.success('Estado actualizado correctamente');
    } catch (error) {
      toast.error('Error al actualizar el estado');
    }
  };

  const getOverallStatusConfig = () => {
    if (!health) return { color: 'text-gray-600', bgColor: 'bg-gray-100', text: 'Desconocido' };
    
    switch (health.status) {
      case 'healthy':
        return { color: 'text-green-600', bgColor: 'bg-green-100', text: 'Sistema Saludable' };
      case 'degraded':
        return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', text: 'Sistema Degradado' };
      case 'down':
        return { color: 'text-red-600', bgColor: 'bg-red-100', text: 'Sistema Inactivo' };
      default:
        return { color: 'text-gray-600', bgColor: 'bg-gray-100', text: 'Estado Desconocido' };
    }
  };

  const statusConfig = getOverallStatusConfig();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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
      intervalRef.current = setInterval(fetchData, refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <AdminLayout title="Health">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Monitor de Salud del Sistema
          </h1>
          <p className="text-gray-600">
            Estado en tiempo real de todos los servicios y componentes del sistema
          </p>
          {lastUpdated && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Última actualización: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Health Indicator */}
          <HealthIndicator />
          
          {/* Auto Refresh Toggle */}
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${autoRefresh ? 'bg-primary-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${autoRefresh ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
              <span className="ml-2 text-sm text-gray-600">Auto-actualizar ({refreshInterval}s)</span>
            </label>
          </div>
          
          {/* Manual Refresh */}
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-300 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Actualizar
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div className={`rounded-2xl p-8 mb-8 ${statusConfig.bgColor} border-2 ${statusConfig.bgColor.replace('bg-', 'border-').replace('-100', '-200')}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-16 h-16 rounded-full ${statusConfig.bgColor.replace('-100', '-200')} flex items-center justify-center mr-6`}>
              {health?.status === 'healthy' ? (
                <svg className={`w-8 h-8 ${statusConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : health?.status === 'degraded' ? (
                <svg className={`w-8 h-8 ${statusConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              ) : (
                <svg className={`w-8 h-8 ${statusConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <h2 className={`text-3xl font-bold ${statusConfig.color} mb-2`}>{statusConfig.text}</h2>
              {health?.timestamp && (
                <p className="text-gray-600">
                  Última actualización: {formatDate(health.timestamp)}
                </p>
              )}
            </div>
          </div>
          
          {health && (
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Estado del Sistema</div>
              <div className={`text-2xl font-bold ${statusConfig.color}`}>
                {health.status.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Health+ Mini-tarjetas */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Ventas Hoy */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ventas Hoy</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${health.reports?.salesTodayUSDT?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">USDT</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Cola D+18 Padre Global */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cola D+18 Padre Global</p>
                <p className="text-2xl font-bold text-gray-900">
                  {health.reports?.parentGlobalQueuedD17?.count || '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ${health.reports?.parentGlobalQueuedD17?.amountUSDT?.toLocaleString() || '0'} USDT
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Auditoría 24h */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Auditoría 24h</p>
                <p className="text-2xl font-bold text-gray-900">
                  {health.audit?.actions24h || '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">acciones registradas</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 font-medium">{error || 'Error desconocido'}</p>
          </div>
        </div>
      )}

      {loading && !health ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando estado del sistema...</p>
        </div>
      ) : health ? (
        <>
          {/* System Metrics */}
          {health.metrics && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Métricas del Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title="Usuarios Totales"
                  value={health.metrics.totalUsers}
                  color="text-blue-600"
                  icon={
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  }
                />
                <MetricCard
                  title="Usuarios Activos"
                  value={health.metrics.activeUsers}
                  color="text-green-600"
                  icon={
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                />
                <MetricCard
                  title="Compras Totales"
                  value={health.metrics.totalPurchases}
                  color="text-purple-600"
                  icon={
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  }
                />
                <MetricCard
                  title="Compras Pendientes"
                  value={health.metrics.pendingPurchases}
                  color="text-yellow-600"
                  icon={
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <MetricCard
                  title="Retiros Totales"
                  value={health.metrics.totalWithdrawals}
                  color="text-indigo-600"
                  icon={
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  }
                />
                <MetricCard
                  title="Retiros Pendientes"
                  value={health.metrics.pendingWithdrawals}
                  color="text-orange-600"
                  icon={
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <MetricCard
                  title="Carga del Sistema"
                  value={health.metrics.systemLoad}
                  color="text-red-600"
                  format="percentage"
                  icon={
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                />
                <MetricCard
                  title="Uso de Memoria"
                  value={health.metrics.memoryUsage}
                  color="text-pink-600"
                  format="percentage"
                  icon={
                    <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  }
                />
              </div>
            </div>
          )}

          {/* Services Status */}
          {health.services && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Estado de Servicios</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ServiceStatus
                  name="Base de Datos"
                  status={health.services.database.status}
                  details={health.services.database}
                  icon={
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  }
                />
                <ServiceStatus
                  name="Tareas Programadas (CRON)"
                  status={health.services.cron.status}
                  details={health.services.cron}
                  icon={
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <ServiceStatus
                  name="Notificaciones Telegram"
                  status={health.services.telegram.status}
                  details={health.services.telegram}
                  icon={
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <ServiceStatus
                  name="API del Sistema"
                  status={health.services.api.status}
                  details={health.services.api}
                  icon={
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  }
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos disponibles</h3>
          <p className="text-gray-600">No se pudo obtener el estado del sistema.</p>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminHealth;