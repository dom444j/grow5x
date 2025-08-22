import React from 'react';

interface HealthIndicatorProps {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({ 
  status, 
  label, 
  className = '',
  size = 'md'
}) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✗';
      default:
        return '?';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-1.5 py-0.5 text-xs';
      case 'lg':
        return 'px-3 py-1.5 text-sm';
      default:
        return 'px-2 py-1 text-xs';
    }
  };

  return (
    <div className={`inline-flex items-center rounded-full font-medium border ${getStatusStyles()} ${getSizeStyles()} ${className}`}>
      <span className="mr-1">{getStatusIcon()}</span>
      {label && <span>{label}</span>}
    </div>
  );
};

export default HealthIndicator;