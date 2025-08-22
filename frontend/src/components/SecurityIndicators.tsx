import React from 'react';
import { validatePassword, validateTxHash, validateBEP20Address } from '../utils/validation';

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ 
  password, 
  showRequirements = true 
}) => {
  const validation = validatePassword(password);
  
  const getStrengthColor = (strength?: 'weak' | 'medium' | 'strong') => {
    switch (strength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };
  
  const getStrengthText = (strength?: 'weak' | 'medium' | 'strong') => {
    switch (strength) {
      case 'weak': return 'Débil';
      case 'medium': return 'Media';
      case 'strong': return 'Fuerte';
      default: return 'Sin evaluar';
    }
  };
  
  const requirements = [
    { test: password.length >= 8, text: 'Al menos 8 caracteres' },
    { test: /[a-z]/.test(password), text: 'Una letra minúscula' },
    { test: /[A-Z]/.test(password), text: 'Una letra mayúscula' },
    { test: /\d/.test(password), text: 'Un número' },
    { test: /[^a-zA-Z0-9]/.test(password), text: 'Un carácter especial (recomendado)' }
  ];
  
  if (!password) return null;
  
  return (
    <div className="mt-2">
      {/* Strength Bar */}
      <div className="flex items-center space-x-2 mb-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              getStrengthColor(validation.strength)
            }`}
            style={{
              width: validation.strength === 'strong' ? '100%' : 
                     validation.strength === 'medium' ? '66%' : 
                     validation.strength === 'weak' ? '33%' : '0%'
            }}
          />
        </div>
        <span className={`text-sm font-medium ${
          validation.strength === 'strong' ? 'text-green-600' :
          validation.strength === 'medium' ? 'text-yellow-600' :
          validation.strength === 'weak' ? 'text-red-600' : 'text-gray-500'
        }`}>
          {getStrengthText(validation.strength)}
        </span>
      </div>
      
      {/* Requirements List */}
      {showRequirements && (
        <div className="space-y-1">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                req.test ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {req.test ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className={req.test ? 'text-green-600' : 'text-gray-500'}>
                {req.text}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Error Message */}
      {!validation.isValid && validation.error && (
        <div className="mt-2 text-sm text-red-600">
          {validation.error}
        </div>
      )}
    </div>
  );
};

interface AddressValidatorProps {
  address: string;
  type: 'BEP20' | 'ERC20' | 'TRC20';
  showIcon?: boolean;
}

export const AddressValidator: React.FC<AddressValidatorProps> = ({ 
  address, 
  type, 
  showIcon = true 
}) => {
  const isValid = type === 'BEP20' ? validateBEP20Address(address) : false;
  
  if (!address) return null;
  
  return (
    <div className="flex items-center space-x-2 mt-1">
      {showIcon && (
        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
          isValid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        }`}>
          {isValid ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      )}
      <span className={`text-sm ${
        isValid ? 'text-green-600' : 'text-red-600'
      }`}>
        {isValid ? `Dirección ${type} válida` : `Dirección ${type} inválida`}
      </span>
    </div>
  );
};

interface TxHashValidatorProps {
  txHash: string;
  showIcon?: boolean;
}

export const TxHashValidator: React.FC<TxHashValidatorProps> = ({ 
  txHash, 
  showIcon = true 
}) => {
  const isValid = validateTxHash(txHash);
  
  if (!txHash) return null;
  
  return (
    <div className="flex items-center space-x-2 mt-1">
      {showIcon && (
        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
          isValid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        }`}>
          {isValid ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      )}
      <span className={`text-sm ${
        isValid ? 'text-green-600' : 'text-red-600'
      }`}>
        {isValid ? 'Hash de transacción válido' : 'Hash de transacción inválido'}
      </span>
    </div>
  );
};

interface SecurityBadgeProps {
  level: 'low' | 'medium' | 'high';
  text: string;
  className?: string;
}

export const SecurityBadge: React.FC<SecurityBadgeProps> = ({ 
  level, 
  text, 
  className = '' 
}) => {
  const getBadgeStyles = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  const getIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case 'high':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full border text-xs font-medium ${
      getBadgeStyles(level)
    } ${className}`}>
      {getIcon(level)}
      <span>{text}</span>
    </div>
  );
};

interface SecurityTipProps {
  title: string;
  description: string;
  type?: 'info' | 'warning' | 'success';
}

export const SecurityTip: React.FC<SecurityTipProps> = ({ 
  title, 
  description, 
  type = 'info' 
}) => {
  const getStyles = (type: 'info' | 'warning' | 'success') => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };
  
  const getIcon = (type: 'info' | 'warning' | 'success') => {
    switch (type) {
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };
  
  return (
    <div className={`p-4 rounded-lg border ${
      getStyles(type)
    }`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon(type)}
        </div>
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="mt-1 text-sm opacity-90">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default {
  PasswordStrength,
  AddressValidator,
  TxHashValidator,
  SecurityBadge,
  SecurityTip
};