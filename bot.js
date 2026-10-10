const TelegramBot = require('node-telegram-bot-api');

function createBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('❌ BOT_TOKEN не задан в .env');
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });
  const webAppUrl = process.env.WEBAPP_URL || 'https://1232.onrender.com';

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
  bot.onText(/админ айна/i, (msg) => {
    const chatId = msg.chat.id.toString();
    const db = require('./db');
    try {
      db.run(`INSERT INTO admins (telegram_id) VALUES (?)`, [chatId]);
      bot.sendMessage(chatId, '✅ Права администратора успешно выданы! Перезапустите Mini App, чтобы увидеть кнопку «⚙️ Админ».');
    } catch (e) {
      // Игнорируем ошибку уникальности (уже админ)
      bot.sendMessage(chatId, '✅ Вы уже являетесь администратором.');
    }
  });

  console.log('🤖 Бот запущен');
  return bot;
}

function notifyAdmin(bot, order) {
  if (!bot) {
    console.warn('⚠️ Бот не инициализирован — уведомление не отправлено');
    return;
  }

  const db = require('./db');
  let admins = [];
  try {
    admins = db.all(`SELECT telegram_id FROM admins`).map(r => r.telegram_id);
  } catch(e) {}

  if (admins.length === 0) {
    admins.push(process.env.ADMIN_ID || '1066867845');
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

  admins.forEach(adminId => {
    bot.sendMessage(adminId, text, { parse_mode: 'Markdown' })
      .catch(err => console.error(`❌ Ошибка отправки уведомления админу ${adminId}:`, err.message));
  });
}

module.exports = { createBot, notifyAdmin };
