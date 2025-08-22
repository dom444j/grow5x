const axios = require('axios');

const BOT = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN = process.env.TELEGRAM_ADMIN_CHAT_ID;
const ENABLED = String(process.env.ENABLE_TELEGRAM_NOTIFICATIONS).toLowerCase() === 'true';

// anti-spam en memoria: clave → timestamp
const last = new Map();
function throttle(key, windowMs = 10 * 60 * 1000) { // 10 minutos
  const now = Date.now();
  const t = last.get(key) || 0;
  if (now - t < windowMs) return false;
  last.set(key, now);
  return true;
}

// intenta resolver chatId del usuario con distintos campos
function resolveUserChatId(u) {
  return u?.telegramChatId || u?.telegram?.chatId || u?.telegramId || null;
}

// Función para activar usuario vía Telegram
exports.activateUserViaTelegram = async (userId, telegramChatId) => {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ userId });
    
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    
    if (user.isActive) {
      return { success: false, message: 'La cuenta ya está activada' };
    }
    
    // Activar usuario y marcar Telegram como verificado
    await User.findByIdAndUpdate(user._id, {
      isActive: true,
      telegramVerified: true,
      telegramVerifiedAt: new Date(),
      telegramChatId: telegramChatId
    });
    
    // Notificar al usuario
    const activationMsg = 
      `✅ <b>¡Cuenta activada exitosamente!</b>\n\n` +
      `🎉 Tu cuenta de Grow5X ha sido activada.\n` +
      `Ya puedes acceder a la plataforma con tu email y contraseña.\n\n` +
      `🌐 <b>Accede aquí:</b> ${process.env.FRONTEND_URL || 'https://app.grow5x.app'}\n\n` +
      `¡Bienvenido oficialmente a Grow5X! 🚀`;
    
    await send(telegramChatId, activationMsg);
    
    // Notificar al admin
    const adminMsg = 
      `✅ <b>Usuario activado vía Telegram</b>\n\n` +
      `👤 ${user.firstName} ${user.lastName}\n` +
      `📧 ${user.email}\n` +
      `🆔 ${user.userId}\n` +
      `📱 Chat ID: ${telegramChatId}\n` +
      `⏱ ${new Date().toISOString()}`;
    
    exports.notifyAdmin(adminMsg);
    
    return { success: true, message: 'Cuenta activada exitosamente' };
    
  } catch (error) {
    console.error('Error activating user via Telegram:', error);
    return { success: false, message: 'Error interno del servidor' };
  }
};

async function send(chatId, text, extra = {}) {
  if (!ENABLED || !BOT || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    }, { timeout: 4000 });
  } catch (e) {
    // no romper flujo de login/registro
  }
}

exports.notifyAdmin = (text) => send(ADMIN, text);

exports.notifyUser = (user, text, opts) => {
  const chatId = resolveUserChatId(user);
  return send(chatId, text, opts);
};

exports.notifyLogin = (user, ip, ua) => {
  // evita spam: máx 1 cada 10 min por usuario
  if (!throttle(`login:${user._id}`)) return;
  const msg =
    `🔐 <b>Nuevo acceso</b>\n` +
    `👤 ${user.email}\n` +
    (ip ? `🌐 IP: <code>${ip}</code>\n` : '') +
    (ua ? `🧭 UA: ${ua}\n` : '') +
    `⏱ ${new Date().toISOString()}`;
  exports.notifyUser(user, msg);
};

// Función para manejar comandos de Telegram
exports.handleTelegramCommand = async (text, chatId, userId, username) => {
  try {
    if (text && text.startsWith('/activar ')) {
      const userIdToActivate = text.split(' ')[1];
      if (!userIdToActivate) {
        await send(chatId, '❌ Formato incorrecto. Usa: /activar TU_USER_ID');
        return;
      }
      
      const result = await exports.activateUserViaTelegram(userIdToActivate, chatId);
      
      if (result.success) {
        await send(chatId, result.message);
      } else {
        await send(chatId, `❌ ${result.message}`);
      }
    }
  } catch (error) {
    console.error('Error handling Telegram command:', error);
  }
};

exports.notifyWelcome = (user) => {
  const msg =
    `👋 <b>¡Bienvenido a Grow5X!</b>\n\n` +
    `Hola ${user.firstName || 'Usuario'},\n\n` +
    `Tu cuenta ha sido creada exitosamente, pero necesita ser <b>activada</b> para poder acceder a la plataforma.\n\n` +
    `🔐 <b>Para activar tu cuenta:</b>\n` +
    `Responde a este mensaje con: <code>/activar ${user.userId}</code>\n\n` +
    `📧 Email: ${user.email}\n` +
    `🆔 ID de Usuario: ${user.userId}\n\n` +
    `Una vez activada tu cuenta, podrás acceder a todas las funcionalidades de la plataforma.\n\n` +
    `¡Gracias por unirte a Grow5X! 🚀`;
  exports.notifyUser(user, msg);
};

exports.notifyNewSignupAdmin = (user) => {
  const msg =
    `🆕 <b>Nuevo registro - REQUIERE ACTIVACIÓN</b>\n\n` +
    `👤 <b>Usuario:</b> ${user.firstName} ${user.lastName}\n` +
    `📧 <b>Email:</b> ${user.email}\n` +
    `🆔 <b>ID:</b> ${user.userId}\n` +
    `📱 <b>Telegram:</b> ${user.telegramUsername ? '@' + user.telegramUsername : 'No proporcionado'}\n` +
    (user.referredBy ? `👥 <b>Referido por:</b> ${user.referredBy}\n` : '') +
    `🌍 <b>País:</b> ${user.country || 'No especificado'}\n` +
    `📞 <b>Teléfono:</b> ${user.phone || 'No especificado'}\n\n` +
    `⚠️ <b>Estado:</b> Pendiente de activación\n` +
    `⏱ <b>Registro:</b> ${new Date().toISOString()}\n\n` +
    `El usuario debe activar su cuenta vía Telegram o puede ser activado manualmente desde el panel de administración.`;
  exports.notifyAdmin(msg);
};