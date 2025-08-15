/**
 * Webhook Routes
 * Handles incoming webhooks from external services
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const telegramService = require('../services/telegram');
const logger = require('../config/logger');

const router = express.Router();

// Rate limiting for webhooks
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    message: 'Demasiadas solicitudes de webhook. Intente nuevamente más tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(webhookLimiter);

/**
 * POST /api/webhooks/telegram
 * Handle incoming Telegram webhook updates
 */
router.post('/telegram', async (req, res) => {
  try {
    // Verify webhook secret token if configured
    const secretToken = process.env.TELEGRAM_SECRET_TOKEN;
    if (secretToken) {
      const providedToken = req.headers['x-telegram-bot-api-secret-token'];
      
      if (!providedToken || providedToken !== secretToken) {
        logger.warn('Telegram webhook unauthorized access attempt', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          providedToken: providedToken ? '[REDACTED]' : 'none'
        });
        
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
      }
    }

    const update = req.body;
    
    logger.info('Telegram webhook received', {
      updateId: update.update_id,
      type: Object.keys(update).filter(key => key !== 'update_id')[0],
      timestamp: new Date().toISOString()
    });

    // Handle different types of updates
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.inline_query) {
      await handleInlineQuery(update.inline_query);
    }

    // Respond with 200 OK to acknowledge receipt
    res.status(200).json({ success: true });
    
  } catch (error) {
    logger.error('Telegram webhook error:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      ip: req.ip
    });
    
    // Still respond with 200 to prevent Telegram from retrying
    res.status(200).json({ success: false });
  }
});

/**
 * Handle incoming text messages
 * @param {Object} message - Telegram message object
 */
async function handleMessage(message) {
  try {
    const chatId = message.chat.id;
    const text = message.text;
    const userId = message.from.id;
    const username = message.from.username;
    
    logger.info('Processing Telegram message', {
      chatId,
      userId,
      username,
      text: text ? text.substring(0, 100) : 'no text',
      messageId: message.message_id
    });

    // Handle /start command
    if (text === '/start') {
      const welcomeMessage = 
        '🚀 <b>¡Bienvenido a Grow5X!</b>\n\n' +
        '🔐 Este bot te ayudará con:\n' +
        '• Códigos de verificación para retiros\n' +
        '• Notificaciones importantes\n' +
        '• Actualizaciones del sistema\n\n' +
        '💡 <i>Para recibir códigos OTP, asegúrate de configurar tu username de Telegram en tu perfil de Grow5X.</i>\n\n' +
        '🌐 Visita: https://grow5x.app';
      
      await telegramService.sendNotification(chatId, welcomeMessage);
    }
    
    // Handle /help command
    else if (text === '/help') {
      const helpMessage = 
        '❓ <b>Ayuda - Grow5X Bot</b>\n\n' +
        '<b>Comandos disponibles:</b>\n' +
        '• /start - Mensaje de bienvenida\n' +
        '• /help - Esta ayuda\n' +
        '• /status - Estado del bot\n\n' +
        '<b>Funciones automáticas:</b>\n' +
        '🔐 Envío de códigos OTP para retiros\n' +
        '📢 Notificaciones administrativas\n' +
        '✅ Confirmaciones de transacciones\n\n' +
        '🌐 <b>Plataforma:</b> https://grow5x.app\n' +
        '💬 <b>Comunidad:</b> https://t.me/grow5x_community';
      
      await telegramService.sendNotification(chatId, helpMessage);
    }
    
    // Handle /status command
    else if (text === '/status') {
      const status = telegramService.getStatus();
      const statusMessage = 
        '📊 <b>Estado del Bot - Grow5X</b>\n\n' +
        `🤖 <b>Bot:</b> ${status.initialized ? '✅ Activo' : '❌ Inactivo'}\n` +
        `⚙️ <b>Configurado:</b> ${status.botConfigured ? '✅ Sí' : '❌ No'}\n` +
        `🕐 <b>Última verificación:</b> ${new Date().toLocaleString('es-ES')}\n\n` +
        '🌐 <b>Plataforma:</b> https://grow5x.app';
      
      await telegramService.sendNotification(chatId, statusMessage);
    }
    
    // Handle unknown commands
    else if (text && text.startsWith('/')) {
      const unknownMessage = 
        '❓ <b>Comando no reconocido</b>\n\n' +
        'Usa /help para ver los comandos disponibles.\n\n' +
        '🌐 <b>Plataforma:</b> https://grow5x.app';
      
      await telegramService.sendNotification(chatId, unknownMessage);
    }
    
  } catch (error) {
    logger.error('Error handling Telegram message:', {
      error: error.message,
      messageId: message.message_id,
      chatId: message.chat.id
    });
  }
}

/**
 * Handle callback queries from inline keyboards
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleCallbackQuery(callbackQuery) {
  try {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const queryId = callbackQuery.id;
    
    logger.info('Processing Telegram callback query', {
      chatId,
      data,
      queryId
    });

    // Answer the callback query to remove loading state
    // Note: This would require bot.telegram.answerCbQuery() but we're keeping it simple
    
  } catch (error) {
    logger.error('Error handling Telegram callback query:', {
      error: error.message,
      queryId: callbackQuery.id
    });
  }
}

/**
 * Handle inline queries
 * @param {Object} inlineQuery - Telegram inline query object
 */
async function handleInlineQuery(inlineQuery) {
  try {
    const queryId = inlineQuery.id;
    const query = inlineQuery.query;
    
    logger.info('Processing Telegram inline query', {
      queryId,
      query: query.substring(0, 50)
    });

    // For now, we don't handle inline queries
    // Could be extended in the future for quick actions
    
  } catch (error) {
    logger.error('Error handling Telegram inline query:', {
      error: error.message,
      queryId: inlineQuery.id
    });
  }
}

/**
 * GET /api/webhooks/telegram/status
 * Get webhook status and configuration
 */
router.get('/telegram/status', (req, res) => {
  try {
    const telegramStatus = telegramService.getStatus();
    
    res.json({
      success: true,
      data: {
        webhook: {
          enabled: !!process.env.TELEGRAM_WEBHOOK_URL,
          url: process.env.TELEGRAM_WEBHOOK_URL || null,
          secretConfigured: !!process.env.TELEGRAM_SECRET_TOKEN
        },
        bot: telegramStatus,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          telegramEnabled: process.env.TELEGRAM_ENABLED === 'true'
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Webhook status error:', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;