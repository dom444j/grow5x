/**
 * useOTPCountdown Hook
 * Manages OTP countdown logic with edge cases handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';

const useOTPCountdown = ({
  duration = 300, // 5 minutes default
  maxAttempts = 3,
  blockDuration = 900, // 15 minutes block
  onExpired = () => {},
  onResend = () => {},
  autoStart = false
} = {}) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeLeft, setBlockTimeLeft] = useState(0);
  const [hasExpired, setHasExpired] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  
  const timerRef = useRef(null);
  const blockTimerRef = useRef(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (blockTimerRef.current) clearInterval(blockTimerRef.current);
    };
  }, []);

  // Format time as MM:SS
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Start countdown
  const start = useCallback(() => {
    if (isBlocked) {
      toast.error('PIN bloqueado. Espera antes de solicitar uno nuevo.');
      return false;
    }
    
    setTimeLeft(duration);
    setIsRunning(true);
    setHasExpired(false);
    return true;
  }, [duration, isBlocked]);

  // Stop countdown
  const stop = useCallback(() => {
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset countdown
  const reset = useCallback(() => {
    stop();
    setTimeLeft(duration);
    setHasExpired(false);
  }, [duration, stop]);

  // Handle expiration
  const handleExpiration = useCallback(() => {
    setIsRunning(false);
    setHasExpired(true);
    toast.error('PIN expirado. Solicita uno nuevo.', {
      duration: 4000,
      icon: '⏰'
    });
    onExpired();
  }, [onExpired]);

  // Request new OTP
  const requestOTP = useCallback(async () => {
    if (isBlocked) {
      toast.error(`PIN bloqueado. Espera ${formatTime(blockTimeLeft)}.`);
      return false;
    }

    if (isRequesting) {
      return false;
    }

    try {
      setIsRequesting(true);
      
      // Check if max attempts would be exceeded
      if (attempts >= maxAttempts) {
        setIsBlocked(true);
        setBlockTimeLeft(blockDuration);
        toast.error(`Demasiados intentos. Bloqueado por ${Math.floor(blockDuration / 60)} minutos.`, {
          duration: 6000,
          icon: '🚫'
        });
        return false;
      }

      // Call the onResend function
      await onResend();
      
      // Increment attempts
      setAttempts(prev => {
        const newAttempts = prev + 1;
        
        // Check if this was the last attempt
        if (newAttempts >= maxAttempts) {
          setIsBlocked(true);
          setBlockTimeLeft(blockDuration);
          toast.error(`Último intento usado. Bloqueado por ${Math.floor(blockDuration / 60)} minutos.`, {
            duration: 6000,
            icon: '🚫'
          });
        } else {
          const remaining = maxAttempts - newAttempts;
          toast.success(`PIN enviado. ${remaining} intentos restantes.`, {
            duration: 4000,
            icon: '📱'
          });
        }
        
        return newAttempts;
      });

      // Start countdown if not blocked
      if (attempts + 1 < maxAttempts) {
        start();
      }
      
      return true;
      
    } catch (error) {
      console.error('Error requesting OTP:', error);
      toast.error('Error al solicitar PIN. Intenta nuevamente.', {
        duration: 4000,
        icon: '❌'
      });
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [isBlocked, blockTimeLeft, formatTime, isRequesting, attempts, maxAttempts, blockDuration, onResend, start]);

  // Main countdown effect
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleExpiration();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, timeLeft, handleExpiration]);

  // Block countdown effect
  useEffect(() => {
    if (!isBlocked || blockTimeLeft <= 0) {
      if (blockTimerRef.current) {
        clearInterval(blockTimerRef.current);
        blockTimerRef.current = null;
      }
      return;
    }

    blockTimerRef.current = setInterval(() => {
      setBlockTimeLeft(prev => {
        if (prev <= 1) {
          setIsBlocked(false);
          setAttempts(0);
          toast.success('Bloqueo levantado. Puedes solicitar un nuevo PIN.', {
            duration: 4000,
            icon: '✅'
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (blockTimerRef.current) {
        clearInterval(blockTimerRef.current);
        blockTimerRef.current = null;
      }
    };
  }, [isBlocked, blockTimeLeft]);

  // Auto-start effect
  useEffect(() => {
    if (autoStart && !isBlocked) {
      start();
    }
  }, [autoStart, isBlocked, start]);

  // Get status information
  const getStatus = useCallback(() => {
    if (isBlocked) {
      return {
        type: 'blocked',
        message: `Bloqueado por ${formatTime(blockTimeLeft)}`,
        color: 'red',
        canRequest: false
      };
    }
    
    if (hasExpired) {
      return {
        type: 'expired',
        message: 'PIN expirado',
        color: 'gray',
        canRequest: true
      };
    }
    
    if (isRunning) {
      const urgency = timeLeft <= 30 ? 'critical' : timeLeft <= 60 ? 'warning' : 'normal';
      return {
        type: 'running',
        message: `PIN válido por ${formatTime(timeLeft)}`,
        color: urgency === 'critical' ? 'red' : urgency === 'warning' ? 'yellow' : 'green',
        canRequest: false,
        urgency
      };
    }
    
    return {
      type: 'ready',
      message: 'Listo para solicitar PIN',
      color: 'blue',
      canRequest: true
    };
  }, [isBlocked, blockTimeLeft, formatTime, hasExpired, isRunning, timeLeft]);

  // Get progress percentage
  const getProgress = useCallback(() => {
    if (isBlocked) {
      return (blockTimeLeft / blockDuration) * 100;
    }
    return (timeLeft / duration) * 100;
  }, [isBlocked, blockTimeLeft, blockDuration, timeLeft, duration]);

  // Check if can request OTP
  const canRequest = !isBlocked && !isRunning && !isRequesting && attempts < maxAttempts;

  return {
    // State
    timeLeft,
    isRunning,
    attempts,
    maxAttempts,
    isBlocked,
    blockTimeLeft,
    hasExpired,
    isRequesting,
    canRequest,
    
    // Actions
    start,
    stop,
    reset,
    requestOTP,
    
    // Utilities
    formatTime,
    getStatus,
    getProgress,
    
    // Computed values
    remainingAttempts: Math.max(0, maxAttempts - attempts),
    isNearExpiry: timeLeft <= 60 && isRunning,
    isCritical: timeLeft <= 30 && isRunning,
    progressPercentage: getProgress()
  };
};

export default useOTPCountdown;