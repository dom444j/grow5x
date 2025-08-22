import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

const Status = () => {
  const [status, setStatus] = useState({
    isOnline: null,
    lastCheck: null,
    loading: true,
    error: null
  });

  const checkHealth = async () => {
    setStatus(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/health');
      const isOnline = response.ok;
      
      setStatus({
        isOnline,
        lastCheck: new Date(),
        loading: false,
        error: null
      });
    } catch (error) {
      setStatus({
        isOnline: false,
        lastCheck: new Date(),
        loading: false,
        error: error.message
      });
    }
  };

  useEffect(() => {
    checkHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <>
      <Helmet>
        <title>Estado del Sistema - Grow5X</title>
        <meta name="description" content="Estado en tiempo real del sistema Grow5X" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Estado del Sistema
            </h1>
            <p className="text-lg text-gray-600">
              Monitoreo en tiempo real de la plataforma Grow5X
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              {status.loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-lg text-gray-600">Verificando estado...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <div className={`text-6xl mr-4 ${
                    status.isOnline ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {status.isOnline ? '✅' : '❌'}
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-bold ${
                      status.isOnline ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {status.isOnline ? 'SISTEMA ONLINE' : 'SISTEMA OFFLINE'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Última verificación: {formatTime(status.lastCheck)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {status.error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="text-red-400 mr-3">⚠️</div>
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error de conexión</h3>
                    <p className="text-sm text-red-700 mt-1">{status.error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">API</div>
                <div className={`text-sm font-medium ${
                  status.isOnline ? 'text-green-600' : 'text-red-600'
                }`}>
                  {status.isOnline ? 'Operativo' : 'No disponible'}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">Base de Datos</div>
                <div className={`text-sm font-medium ${
                  status.isOnline ? 'text-green-600' : 'text-red-600'
                }`}>
                  {status.isOnline ? 'Conectada' : 'Sin conexión'}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">Servicios</div>
                <div className={`text-sm font-medium ${
                  status.isOnline ? 'text-green-600' : 'text-red-600'
                }`}>
                  {status.isOnline ? 'Activos' : 'Inactivos'}
                </div>
              </div>
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={checkHealth}
                disabled={status.loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-md font-medium transition-colors"
              >
                {status.loading ? 'Verificando...' : 'Verificar Ahora'}
              </button>
              
              <a
                href="/"
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
              >
                Volver al Inicio
              </a>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
              <p>Esta página se actualiza automáticamente cada 30 segundos</p>
              <p className="mt-1">
                Para soporte técnico: <a href="mailto:soporte@grow5x.app" className="text-blue-600 hover:text-blue-800">soporte@grow5x.app</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Status;