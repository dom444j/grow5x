import { useState, useCallback, useRef, useEffect } from 'react';
import { clientRateLimit } from '../utils/validation';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface RateLimitState {
  isBlocked: boolean;
  remainingAttempts: number;
  timeUntilReset: number;
  lastAttempt: number | null;
}

interface UseRateLimitReturn {
  canProceed: boolean;
  isBlocked: boolean;
  remainingAttempts: number;
  timeUntilReset: number;
  attempt: () => boolean;
  reset: () => void;
  getBlockedMessage: () => string;
}

export const useRateLimit = (
  key: string,
  config: RateLimitConfig
): UseRateLimitReturn => {
  const [state, setState] = useState<RateLimitState>({
    isBlocked: false,
    remainingAttempts: config.maxAttempts,
    timeUntilReset: 0,
    lastAttempt: null
  });
  
  const intervalRef = useRef<number | null>(null);
  
  const updateState = useCallback(() => {
    const result = clientRateLimit(key, config.maxAttempts, config.windowMs);
    
    setState({
      isBlocked: !result.allowed,
      remainingAttempts: result.remaining,
      timeUntilReset: result.resetTime ? Math.max(0, result.resetTime - Date.now()) : 0,
      lastAttempt: Date.now()
    });
    
    // Start countdown timer if blocked
    if (!result.allowed && result.resetTime) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      intervalRef.current = setInterval(() => {
        const timeLeft = Math.max(0, result.resetTime! - Date.now());
        
        setState(prev => ({
          ...prev,
          timeUntilReset: timeLeft
        }));
        
        if (timeLeft <= 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          updateState(); // Refresh state when timer expires
        }
      }, 1000);
    }
    
    return result.allowed;
  }, [key, config.maxAttempts, config.windowMs]);
  
  const attempt = useCallback((): boolean => {
    return updateState();
  }, [updateState]);
  
  const reset = useCallback(() => {
    // Clear rate limit data from localStorage
    const rateLimitData = JSON.parse(localStorage.getItem('rateLimits') || '{}');
    delete rateLimitData[key];
    localStorage.setItem('rateLimits', JSON.stringify(rateLimitData));
    
    // Clear timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Reset state
    setState({
      isBlocked: false,
      remainingAttempts: config.maxAttempts,
      timeUntilReset: 0,
      lastAttempt: null
    });
  }, [key, config.maxAttempts]);
  
  const getBlockedMessage = useCallback((): string => {
    if (!state.isBlocked) return '';
    
    const minutes = Math.ceil(state.timeUntilReset / 60000);
    const seconds = Math.ceil((state.timeUntilReset % 60000) / 1000);
    
    if (minutes > 0) {
      return `Demasiados intentos. Intenta de nuevo en ${minutes} minuto${minutes > 1 ? 's' : ''}.`;
    } else if (seconds > 0) {
      return `Demasiados intentos. Intenta de nuevo en ${seconds} segundo${seconds > 1 ? 's' : ''}.`;
    } else {
      return 'Demasiados intentos. Intenta de nuevo en unos momentos.';
    }
  }, [state.isBlocked, state.timeUntilReset]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  return {
    canProceed: !state.isBlocked && state.remainingAttempts > 0,
    isBlocked: state.isBlocked,
    remainingAttempts: state.remainingAttempts,
    timeUntilReset: state.timeUntilReset,
    attempt,
    reset,
    getBlockedMessage
  };
};

// Predefined rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  LOGIN: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 15 * 60 * 1000
  },
  PAYMENT_SUBMISSION: {
    maxAttempts: 3,
    windowMs: 5 * 60 * 1000, // 5 minutes
    blockDurationMs: 10 * 60 * 1000
  },
  HASH_CONFIRMATION: {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 10 * 60 * 1000
  },
  WITHDRAWAL_REQUEST: {
    maxAttempts: 2,
    windowMs: 30 * 60 * 1000, // 30 minutes
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  },
  PASSWORD_RESET: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000
  },
  REGISTRATION: {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 30 * 60 * 1000
  }
} as const;

// Specialized hooks for common use cases
export const useLoginRateLimit = () => {
  return useRateLimit('login', RATE_LIMIT_CONFIGS.LOGIN);
};

export const usePaymentRateLimit = () => {
  return useRateLimit('payment', RATE_LIMIT_CONFIGS.PAYMENT_SUBMISSION);
};

export const useHashConfirmationRateLimit = () => {
  return useRateLimit('hash_confirmation', RATE_LIMIT_CONFIGS.HASH_CONFIRMATION);
};

export const useWithdrawalRateLimit = () => {
  return useRateLimit('withdrawal', RATE_LIMIT_CONFIGS.WITHDRAWAL_REQUEST);
};

export const usePasswordResetRateLimit = () => {
  return useRateLimit('password_reset', RATE_LIMIT_CONFIGS.PASSWORD_RESET);
};

export const useRegistrationRateLimit = () => {
  return useRateLimit('registration', RATE_LIMIT_CONFIGS.REGISTRATION);
};

export default useRateLimit;