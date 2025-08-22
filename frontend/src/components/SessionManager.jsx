/**
 * Session Manager Component
 * Provides session management controls including logout all sessions and session timer
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

const SessionManager = ({ showInHeader = false }) => {
  const { 
    logoutAllSessions, 
    getRemainingTime, 
    isAuthenticated,
    resetActivityTimer 
  } = useAuth();
  
  const [remainingTime, setRemainingTime] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Update remaining time every minute
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateTimer = () => {
      const time = getRemainingTime();
      setRemainingTime(time);
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isAuthenticated, getRemainingTime]);

  // Format time display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Handle logout all sessions
  const handleLogoutAllSessions = async () => {
    setIsLoggingOut(true);
    try {
      await logoutAllSessions();
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      toast.error('Error al cerrar todas las sesiones');
    } finally {
      setIsLoggingOut(false);
      setShowConfirmDialog(false);
    }
  };

  // Extend session by resetting activity timer
  const extendSession = () => {
    resetActivityTimer();
    toast.success('Sesión extendida', { duration: 2000 });
  };

  if (!isAuthenticated) return null;

  // Header version (compact)
  if (showInHeader) {
    return (
      <div className="flex items-center space-x-3 text-sm">
        {/* Session timer */}
        <div className="flex items-center space-x-1 text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formatTime(remainingTime)}</span>
        </div>

        {/* Extend session button */}
        <button
          onClick={extendSession}
          className="text-blue-600 hover:text-blue-800 font-medium"
          title="Extender sesión"
        >
          Extender
        </button>

        {/* Logout all sessions button */}
        <button
          onClick={() => setShowConfirmDialog(true)}
          className="text-red-600 hover:text-red-800 font-medium"
          title="Cerrar todas las sesiones"
        >
          Cerrar Todo
        </button>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Confirmar Cierre de Sesiones</h3>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que quieres cerrar todas las sesiones activas? 
                Esto te desconectará de todos los dispositivos.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isLoggingOut}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLogoutAllSessions}
                  disabled={isLoggingOut}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoggingOut ? 'Cerrando...' : 'Cerrar Todo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full component version
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Gestión de Sesión
      </h3>

      <div className="space-y-4">
        {/* Session Timer */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Tiempo de sesión restante</p>
            <p className="text-sm text-gray-600">Tu sesión se cerrará automáticamente por inactividad</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{formatTime(remainingTime)}</p>
            <button
              onClick={extendSession}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Extender sesión
            </button>
          </div>
        </div>

        {/* Session Warning */}
        {remainingTime < 600 && ( // Less than 10 minutes
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-yellow-800 font-medium">Tu sesión expirará pronto</p>
            </div>
            <p className="text-yellow-700 text-sm mt-1">
              Realiza alguna actividad para mantener tu sesión activa.
            </p>
          </div>
        )}

        {/* Logout All Sessions */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Cerrar todas las sesiones</p>
              <p className="text-sm text-gray-600">
                Cierra tu sesión en todos los dispositivos y navegadores
              </p>
            </div>
            <button
              onClick={() => setShowConfirmDialog(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
            >
              Cerrar Todo
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar Cierre de Sesiones</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres cerrar todas las sesiones activas? 
              Esto te desconectará de todos los dispositivos y tendrás que iniciar sesión nuevamente.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
                disabled={isLoggingOut}
              >
                Cancelar
              </button>
              <button
                onClick={handleLogoutAllSessions}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium flex items-center justify-center"
              >
                {isLoggingOut ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cerrando...
                  </>
                ) : (
                  'Cerrar Todo'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionManager;