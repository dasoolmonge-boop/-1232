require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { createBot } = require('./bot');
const menuRoutes = require('./routes/menu');
const adminRoutes = require('./routes/admin');

async function start() {
  // Инициализация БД (асинхронная для sql.js)
  await db.init();

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Статические файлы
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Запуск бота
  const bot = createBot();

  // Маршруты
  app.use(menuRoutes(db, bot));
  app.use(adminRoutes(db));

  // Запуск сервера
  app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log(`📱 Клиентская часть: http://localhost:${PORT}/`);
    console.log(`⚙️  Админ-панель: http://localhost:${PORT}/admin.html`);

    if (!process.env.WEBAPP_URL) {
      console.log('\n⚠️  WEBAPP_URL не задан в .env');
      console.log('   Запустите ngrok: ngrok http ' + PORT);
      console.log('   И укажите HTTPS-URL в .env как WEBAPP_URL');
    }

    if (!process.env.ADMIN_ID) {
      console.log('\n⚠️  ADMIN_ID не задан в .env');
      console.log('   Узнайте ваш Telegram ID у @userinfobot');
      console.log('   И укажите его в .env как ADMIN_ID');
    }
  });
}

start().catch(err => {
  console.error('❌ Ошибка запуска сервера:', err);
  process.exit(1);
});
