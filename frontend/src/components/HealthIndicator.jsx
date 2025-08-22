/**
 * Health Indicator Component
 * Shows system health status with a colored dot and tooltip
 */

import React, { useState, useEffect } from 'react';
import { useAdminHealth } from '../hooks';

const HealthIndicator = ({ className = '' }) => {
  const { healthData, loading, error, refetch } = useAdminHealth();
  const [showTooltip, setShowTooltip] = useState(false);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  const getHealthStatus = () => {
    if (loading || error || !healthData) {
      return {
        status: 'unknown',
        color: 'bg-gray-400',
        text: 'Estado desconocido',
        description: error ? 'Error al obtener estado' : 'Cargando...'
      };
    }

    const { overallStatus } = healthData;
    
    switch (overallStatus) {
      case 'healthy':
        return {
          status: 'healthy',
          color: 'bg-green-500',
          text: 'Sistema saludable',
          description: 'Todos los servicios funcionan correctamente'
        };
      case 'degraded':
        return {
          status: 'degraded',
          color: 'bg-yellow-500',
          text: 'Sistema degradado',
          description: 'Algunos servicios presentan problemas'
        };
      case 'down':
        return {
          status: 'down',
          color: 'bg-red-500',
          text: 'Sistema con problemas',
          description: 'Servicios críticos no funcionan'
        };
      default:
        return {
          status: 'unknown',
          color: 'bg-gray-400',
          text: 'Estado desconocido',
          description: 'No se pudo determinar el estado'
        };
    }
  };

  const healthStatus = getHealthStatus();

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    
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

  const getServiceCount = (status) => {
    if (!healthData?.services) return 0;
    return Object.values(healthData.services).filter(service => service.status === status).length;
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        className="flex items-center cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        {/* Health Status Dot */}
        <div className="relative">
          <div 
            className={`w-3 h-3 rounded-full ${healthStatus.color} transition-all duration-200`}
            title={healthStatus.text}
          >
            {/* Pulse animation for healthy status */}
            {healthStatus.status === 'healthy' && (
              <div className={`absolute inset-0 rounded-full ${healthStatus.color} animate-ping opacity-75`}></div>
            )}
          </div>
        </div>
        
        {/* Optional text label */}
        <span className="ml-2 text-sm text-gray-600 hidden sm:inline">
          Sistema
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full ${healthStatus.color} mr-2`}></div>
              <h3 className="font-semibold text-gray-900">{healthStatus.text}</h3>
            </div>
            <button
              onClick={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-3">{healthStatus.description}</p>

          {/* System Info */}
          {healthData && (
            <div className="space-y-2">
              {/* Uptime */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tiempo activo:</span>
                <span className="font-medium">{formatUptime(healthData.uptime)}</span>
              </div>

              {/* Memory Usage */}
              {healthData.memory && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Memoria:</span>
                  <span className="font-medium">
                    {Math.round((healthData.memory.used / healthData.memory.total) * 100)}% usado
                  </span>
                </div>
              )}

              {/* Services Summary */}
              {healthData.services && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-sm text-gray-500 mb-2">Servicios:</div>
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                      <span>Saludables: {getServiceCount('healthy')}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                      <span>Degradados: {getServiceCount('degraded')}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                      <span>Caídos: {getServiceCount('down')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Last Update */}
              <div className="flex justify-between text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                <span>Última actualización:</span>
                <span>{new Date().toLocaleTimeString('es-ES')}</span>
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => {
              refetch();
              setShowTooltip(false);
            }}
            className="w-full mt-3 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-200"
            disabled={loading}
          >
            {loading ? 'Actualizando...' : 'Actualizar estado'}
          </button>
        </div>
      )}
    </div>
  );
};

export default HealthIndicator;