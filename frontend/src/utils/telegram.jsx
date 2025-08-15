// Configuración de Telegram para Grow5X

// Enlaces de Telegram
export const TELEGRAM_CONFIG = {
  // Canal principal de soporte
  SUPPORT_CHANNEL: 'https://t.me/grow5x_support',
  
  // Bot para notificaciones automáticas
  BOT_USERNAME: '@grow5x_bot',
  BOT_LINK: 'https://t.me/grow5x_bot',
  
  // Canales específicos
  WELCOME_CHANNEL: 'https://t.me/grow5x_welcome',
  WITHDRAWALS_CHANNEL: 'https://t.me/grow5x_withdrawals',
  ANNOUNCEMENTS_CHANNEL: 'https://t.me/grow5x_announcements',
  
  // Grupos de la comunidad
  COMMUNITY_GROUP: 'https://t.me/grow5x_community',
  VIP_GROUP: 'https://t.me/grow5x_vip'
}

// Mensajes predefinidos para diferentes acciones
export const TELEGRAM_MESSAGES = {
  WELCOME: {
    title: '¡Bienvenido a Grow5X! 🎉',
    message: 'Tu cuenta ha sido creada exitosamente. Únete a nuestro canal de Telegram para recibir actualizaciones importantes.',
    action: 'Unirse al Canal'
  },
  
  ACCOUNT_ACTIVATION: {
    title: 'Activación de Cuenta 📧',
    message: 'Para activar tu cuenta, contacta con nuestro soporte en Telegram.',
    action: 'Contactar Soporte'
  },
  
  PASSWORD_RECOVERY: {
    title: 'Recuperar Contraseña 🔐',
    message: 'Para recuperar tu contraseña, contacta con nuestro equipo de soporte.',
    action: 'Recuperar Contraseña'
  },
  
  WITHDRAWAL_REQUEST: {
    title: 'Solicitud de Retiro 💰',
    message: 'Tu solicitud de retiro ha sido procesada. Recibirás actualizaciones en Telegram.',
    action: 'Ver Estado'
  }
}

// Funciones para interactuar con Telegram
export const telegramActions = {
  // Abrir canal de soporte
  openSupport: () => {
    window.open(TELEGRAM_CONFIG.SUPPORT_CHANNEL, '_blank', 'noopener,noreferrer')
  },
  
  // Abrir bot principal
  openBot: () => {
    window.open(TELEGRAM_CONFIG.BOT_LINK, '_blank', 'noopener,noreferrer')
  },
  
  // Unirse al canal de bienvenida
  joinWelcome: () => {
    window.open(TELEGRAM_CONFIG.WELCOME_CHANNEL, '_blank', 'noopener,noreferrer')
  },
  
  // Abrir canal de retiros
  openWithdrawals: () => {
    window.open(TELEGRAM_CONFIG.WITHDRAWALS_CHANNEL, '_blank', 'noopener,noreferrer')
  },
  
  // Unirse a la comunidad
  joinCommunity: () => {
    window.open(TELEGRAM_CONFIG.COMMUNITY_GROUP, '_blank', 'noopener,noreferrer')
  },
  
  // Enviar mensaje predefinido al soporte
  sendSupportMessage: (messageType, userEmail = '') => {
    const message = TELEGRAM_MESSAGES[messageType]
    if (message) {
      const encodedMessage = encodeURIComponent(
        `${message.title}\n\n${message.message}\n\nEmail: ${userEmail}`
      )
      window.open(
        `${TELEGRAM_CONFIG.SUPPORT_CHANNEL}?text=${encodedMessage}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  }
}

// Hook personalizado para usar Telegram en componentes React
export const useTelegram = () => {
  const sendWelcomeMessage = (userEmail) => {
    telegramActions.sendSupportMessage('WELCOME', userEmail)
  }
  
  const requestAccountActivation = (userEmail) => {
    telegramActions.sendSupportMessage('ACCOUNT_ACTIVATION', userEmail)
  }
  
  const requestPasswordRecovery = (userEmail) => {
    telegramActions.sendSupportMessage('PASSWORD_RECOVERY', userEmail)
  }
  
  const requestWithdrawal = (userEmail, amount = '') => {
    const message = `${TELEGRAM_MESSAGES.WITHDRAWAL_REQUEST.title}\n\n${TELEGRAM_MESSAGES.WITHDRAWAL_REQUEST.message}\n\nEmail: ${userEmail}\nMonto: ${amount}`
    const encodedMessage = encodeURIComponent(message)
    window.open(
      `${TELEGRAM_CONFIG.WITHDRAWALS_CHANNEL}?text=${encodedMessage}`,
      '_blank',
      'noopener,noreferrer'
    )
  }
  
  return {
    sendWelcomeMessage,
    requestAccountActivation,
    requestPasswordRecovery,
    requestWithdrawal,
    openSupport: telegramActions.openSupport,
    openBot: telegramActions.openBot,
    joinCommunity: telegramActions.joinCommunity
  }
}

// Componente de notificación para mostrar mensajes de Telegram
export const TelegramNotification = ({ type, userEmail, onClose }) => {
  const message = TELEGRAM_MESSAGES[type]
  
  if (!message) return null
  
  const handleAction = () => {
    telegramActions.sendSupportMessage(type, userEmail)
    if (onClose) onClose()
  }
  
  return (
    <div className="fixed top-4 right-4 bg-white border border-blue-200 rounded-lg shadow-lg p-4 max-w-sm z-50 animate-slide-in-right">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-gray-900">
            {message.title}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {message.message}
          </p>
          <div className="mt-3 flex space-x-2">
            <button
              onClick={handleAction}
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded transition-colors duration-200"
            >
              {message.action}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-3 py-1 rounded transition-colors duration-200"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default {
  TELEGRAM_CONFIG,
  TELEGRAM_MESSAGES,
  telegramActions,
  useTelegram,
  TelegramNotification
}