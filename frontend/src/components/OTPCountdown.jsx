/**
 * OTPCountdown Component
 * Provides visual countdown for OTP expiration with edge cases handling
 */

import React from 'react';
import useOTPCountdown from '../hooks/useOTPCountdown';

const OTPCountdown = ({
  duration = 300, // 5 minutes default
  maxAttempts = 3,
  blockDuration = 900, // 15 minutes block
  onExpired = () => {},
  onResend = () => {},
  autoStart = false,
  className = '',
  showProgress = true,
  showAttempts = true
}) => {
  const {
    timeLeft,
    isRunning,
    attempts,
    isBlocked,
    blockTimeLeft,
    hasExpired,
    isRequesting,
    canRequest,
    requestOTP,
    formatTime,
    getStatus,
    progressPercentage,
    remainingAttempts,
    isNearExpiry,
    isCritical
  } = useOTPCountdown({
    duration,
    maxAttempts,
    blockDuration,
    onExpired,
    onResend,
    autoStart
  });

  const status = getStatus();

  // Get status styling based on current state
  const getStatusStyling = () => {
    switch (status.type) {
      case 'blocked':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: '🚫'
        };
      case 'expired':
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: '⏰'
        };
      case 'running':
        if (isCritical) {
          return {
            color: 'text-red-600',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            icon: '🚨'
          };
        }
        if (isNearExpiry) {
          return {
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200',
            icon: '⚠️'
          };
        }
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: '✅'
        };
      default:
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: '📱'
        };
    }
  };

  const styling = getStatusStyling();

  return (
    <div className={`otp-countdown ${className}`}>
      {/* Status Display */}
      <div className={`p-4 rounded-lg border-2 ${styling.bgColor} ${styling.borderColor} transition-all duration-300`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{styling.icon}</span>
            <span className={`font-medium ${styling.color}`}>
              {status.message}
            </span>
          </div>
          
          {/* Resend Button */}
          {canRequest && (
            <button
              onClick={requestOTP}
              disabled={isRequesting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isRequesting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Enviando...</span>
                </div>
              ) : (
                'Solicitar PIN'
              )}
            </button>
          )}
        </div>
        
        {/* Progress Bar */}
        {showProgress && (isRunning || isBlocked) && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  isBlocked ? 'bg-red-500' : 
                  isCritical ? 'bg-red-500' :
                  isNearExpiry ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Attempts Counter */}
        {showAttempts && (
          <div className="mt-2 text-sm text-gray-600">
            Intentos: {attempts}/{maxAttempts}
            {remainingAttempts > 0 && (
              <span className="ml-2 text-blue-600">
                ({remainingAttempts} restantes)
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
          <div>Running: {isRunning ? 'Yes' : 'No'}</div>
          <div>Blocked: {isBlocked ? 'Yes' : 'No'}</div>
          <div>Expired: {hasExpired ? 'Yes' : 'No'}</div>
          <div>Can Request: {canRequest ? 'Yes' : 'No'}</div>
          <div>Status: {status.type}</div>
        </div>
      )}
    </div>
  );
};

export default OTPCountdown;