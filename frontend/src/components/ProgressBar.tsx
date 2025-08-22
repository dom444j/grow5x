import React from 'react';

interface ProgressBarProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gradient';
  showPercentage?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  size = 'md',
  color = 'blue',
  showPercentage = true,
  label,
  animated = true,
  className = ''
}) => {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    gradient: 'bg-gradient-to-r from-blue-500 to-green-500'
  };

  const backgroundClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    purple: 'bg-purple-100',
    orange: 'bg-orange-100',
    red: 'bg-red-100',
    gradient: 'bg-gray-200'
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-600">
              {clampedPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      
      <div className={`w-full ${backgroundClasses[color]} rounded-full ${sizeClasses[size]} overflow-hidden`}>
        <div 
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full ${
            animated ? 'transition-all duration-500 ease-out' : ''
          } relative overflow-hidden`}
          style={{ width: `${clampedPercentage}%` }}
        >
          {animated && (
            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;