/**
 * Telegram Webhook Setup Script
 * Configures the Telegram webhook for the bot
 */

require('dotenv').config();
const telegramService = require('../services/telegram');
const logger = require('../config/logger');

/**
 * Setup Telegram webhook
 */
async function setupTelegramWebhook() {
  try {
    logger.info('Starting Telegram webhook setup...');
    
    // Check if Telegram is enabled
    if (process.env.TELEGRAM_ENABLED !== 'true') {
      logger.info('Telegram is disabled. Skipping webhook setup.');
      return;
    }
    
    // Check required environment variables
    const requiredVars = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL
    };
    
    const missingVars = Object.entries(requiredVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingVars.length > 0) {
      logger.error('Missing required environment variables for Telegram webhook:', {
        missing: missingVars
      });
      return;
    }
    
    // Wait a moment for service to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get current webhook info
    logger.info('Checking current webhook configuration...');
    const currentWebhook = await telegramService.getWebhookInfo();
    
    if (currentWebhook) {
      logger.info('Current webhook info:', {
        url: currentWebhook.url,
        hasCustomCertificate: currentWebhook.has_custom_certificate,
        pendingUpdateCount: currentWebhook.pending_update_count,
        lastErrorDate: currentWebhook.last_error_date,
        lastErrorMessage: currentWebhook.last_error_message
      });
      
      // Check if webhook is already correctly configured
      if (currentWebhook.url === process.env.TELEGRAM_WEBHOOK_URL) {
        logger.info('Webhook is already correctly configured');
        return;
      }
    }
    
    // Set the webhook
    logger.info('Setting up webhook...', {
      url: process.env.TELEGRAM_WEBHOOK_URL,
      secretConfigured: !!process.env.TELEGRAM_SECRET_TOKEN
    });
    
    const success = await telegramService.setWebhook(process.env.TELEGRAM_WEBHOOK_URL);
    
    if (success) {
      logger.info('✅ Telegram webhook configured successfully');
      
      // Verify the webhook was set correctly
      const verifyWebhook = await telegramService.getWebhookInfo();
      if (verifyWebhook && verifyWebhook.url === process.env.TELEGRAM_WEBHOOK_URL) {
        logger.info('✅ Webhook verification successful');
        
        // Send test notification to admin if configured
        if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
          const testMessage = 
            '🤖 <b>Grow5X Bot - Webhook Configurado</b>\n\n' +
            '✅ El webhook ha sido configurado exitosamente\n' +
            `🔗 URL: ${process.env.TELEGRAM_WEBHOOK_URL}\n` +
            `🔐 Token secreto: ${process.env.TELEGRAM_SECRET_TOKEN ? 'Configurado' : 'No configurado'}\n` +
            `🕐 Fecha: ${new Date().toLocaleString('es-ES')}\n\n` +
            '🚀 El bot está listo para recibir actualizaciones.';
          
          await telegramService.sendAdminNotification(testMessage);
          logger.info('Test notification sent to admin');
        }
      } else {
        logger.error('❌ Webhook verification failed');
      }
    } else {
      logger.error('❌ Failed to configure Telegram webhook');
    }
    
  } catch (error) {
    logger.error('Error setting up Telegram webhook:', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Delete Telegram webhook (for development/testing)
 */
async function deleteTelegramWebhook() {
  try {
    logger.info('Deleting Telegram webhook...');
    
    const success = await telegramService.deleteWebhook();
    
    if (success) {
      logger.info('✅ Telegram webhook deleted successfully');
    } else {
      logger.error('❌ Failed to delete Telegram webhook');
    }
    
  } catch (error) {
    logger.error('Error deleting Telegram webhook:', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Get webhook status
 */
async function getWebhookStatus() {
  try {
    logger.info('Getting Telegram webhook status...');
    
    const webhookInfo = await telegramService.getWebhookInfo();
    const serviceStatus = telegramService.getStatus();
    
    console.log('\n📊 Telegram Service Status:');
    console.log('================================');
    console.log(`🤖 Bot initialized: ${serviceStatus.initialized ? '✅' : '❌'}`);
    console.log(`⚙️ Bot configured: ${serviceStatus.botConfigured ? '✅' : '❌'}`);
    console.log(`🔗 Webhook configured: ${serviceStatus.webhookConfigured ? '✅' : '❌'}`);
    console.log(`👤 Admin chat configured: ${serviceStatus.adminChatConfigured ? '✅' : '❌'}`);
    console.log(`🔐 Secret token configured: ${serviceStatus.secretTokenConfigured ? '✅' : '❌'}`);
    console.log(`🟢 Service enabled: ${serviceStatus.enabled ? '✅' : '❌'}`);
    
    if (webhookInfo) {
      console.log('\n🔗 Webhook Information:');
      console.log('========================');
      console.log(`URL: ${webhookInfo.url || 'Not set'}`);
      console.log(`Custom certificate: ${webhookInfo.has_custom_certificate ? 'Yes' : 'No'}`);
      console.log(`Pending updates: ${webhookInfo.pending_update_count}`);
      console.log(`Max connections: ${webhookInfo.max_connections}`);
      console.log(`Allowed updates: ${webhookInfo.allowed_updates?.join(', ') || 'All'}`);
      
      if (webhookInfo.last_error_date) {
        console.log(`\n❌ Last error: ${new Date(webhookInfo.last_error_date * 1000).toLocaleString()}`);
        console.log(`Error message: ${webhookInfo.last_error_message}`);
      } else {
        console.log('\n✅ No recent errors');
      }
    } else {
      console.log('\n❌ Could not retrieve webhook information');
    }
    
    console.log('\n');
    
  } catch (error) {
    logger.error('Error getting webhook status:', {
      error: error.message,
      stack: error.stack
    });
  }
}

// Handle command line arguments
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'setup':
      setupTelegramWebhook().then(() => process.exit(0));
      break;
    case 'delete':
      deleteTelegramWebhook().then(() => process.exit(0));
      break;
    case 'status':
      getWebhookStatus().then(() => process.exit(0));
      break;
    default:
      console.log('\n🤖 Telegram Webhook Management');
      console.log('==============================');
      console.log('Usage: node setup-telegram-webhook.js <command>');
      console.log('\nCommands:');
      console.log('  setup   - Configure the webhook');
      console.log('  delete  - Remove the webhook');
      console.log('  status  - Show webhook status');
      console.log('\nExamples:');
      console.log('  npm run telegram:setup');
      console.log('  npm run telegram:status');
      console.log('  npm run telegram:delete\n');
      process.exit(1);
  }
}

module.exports = {
  setupTelegramWebhook,
  deleteTelegramWebhook,
  getWebhookStatus
};