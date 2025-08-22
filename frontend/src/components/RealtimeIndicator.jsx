import React from 'react';
import { useRealtime } from '../hooks/useRealtime';

const RealtimeIndicator = ({ className = '', showText = true, size = 'sm' }) => {
  const { isConnected, connectionError } = useRealtime({ autoConnect: false });

  const getStatusColor = () => {
    if (connectionError) return 'text-red-500';
    return isConnected ? 'text-green-500' : 'text-yellow-500';
  };

  const getStatusText = () => {
    if (connectionError) return 'Desconectado';
    return isConnected ? 'En línea' : 'Conectando...';
  };

  const getStatusIcon = () => {
    if (connectionError) return '●';
    return isConnected ? '●' : '○';
  };

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <span 
        className={`${getStatusColor()} ${sizeClasses[size]} font-bold`}
        title={getStatusText()}
      >
        {getStatusIcon()}
      </span>
      {showText && (
        <span className={`${getStatusColor()} ${sizeClasses[size]} font-medium`}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
};

export default RealtimeIndicator;