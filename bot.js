const TelegramBot = require('node-telegram-bot-api');

function createBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('❌ BOT_TOKEN не задан в .env');
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });
  const webAppUrl = process.env.WEBAPP_URL;

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (!webAppUrl) {
      bot.sendMessage(chatId, '⚙️ Приложение настраивается. Попробуйте позже.');
      return;
    }

    bot.sendMessage(chatId, '🍕 Добро пожаловать! Откройте меню и закажите доставку:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🍕 Открыть меню', web_app: { url: webAppUrl } }
        ]]
      }
    });
  });

  bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;

    if (!webAppUrl) {
      bot.sendMessage(chatId, '⚙️ Приложение настраивается. Попробуйте позже.');
      return;
    }

    bot.sendMessage(chatId, '⚙️ Панель администратора:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '⚙️ Админ-панель', web_app: { url: webAppUrl + '/admin.html' } }
        ]]
      }
    });
  });

  console.log('🤖 Бот запущен');
  return bot;
}

function notifyAdmin(bot, order) {
  const adminId = process.env.ADMIN_ID || '1066867845';
  if (!adminId) {
    console.warn('⚠️ ADMIN_ID не задан — уведомление не отправлено');
    return;
  }

  if (!bot) {
    console.warn('⚠️ Бот не инициализирован — уведомление не отправлено');
    return;
  }

  const itemsText = order.items
    .map(item => `  • ${item.name} × ${item.quantity} — ${item.price * item.quantity} ₽`)
    .join('\n');

  const text = `🔔 *Новый заказ #${order.id}*\n\n` +
    `📱 Телефон: ${order.phone}\n` +
    `📍 Адрес: ${order.address}\n` +
    (order.comment ? `💬 Комментарий: ${order.comment}\n` : '') +
    `\n🛒 Состав заказа:\n${itemsText}\n\n` +
    `💰 *Итого: ${order.total} ₽*`;

  bot.sendMessage(adminId, text, { parse_mode: 'Markdown' })
    .catch(err => console.error('❌ Ошибка отправки уведомления:', err.message));
}

module.exports = { createBot, notifyAdmin };
