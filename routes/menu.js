const express = require('express');
const { notifyAdmin } = require('../bot');

module.exports = function(db, bot) {
  const router = express.Router();

  // Проверка на админа
  router.get('/api/is_admin', (req, res) => {
    try {
      const { id } = req.query;
      if (!id) return res.json({ isAdmin: false });
      // Главный админ
      if (id === '1066867845') return res.json({ isAdmin: true });
      
      const row = db.get('SELECT telegram_id FROM admins WHERE telegram_id = ?', [id.toString()]);
      res.json({ isAdmin: !!row });
    } catch (err) {
      res.json({ isAdmin: false });
    }
  });

  // Получить все категории
  router.get('/api/categories', (req, res) => {
    try {
      const categories = db.all('SELECT * FROM categories ORDER BY sort_order, id');
      res.json(categories);
    } catch (err) {
      console.error('Ошибка получения категорий:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // Получить меню (без стоп-листа)
  router.get('/api/menu', (req, res) => {
    try {
      const items = db.all(`
        SELECT m.*, c.name as category_name
        FROM menu_items m
        LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.is_stopped = 0
        ORDER BY m.sort_order, m.id
      `);
      res.json(items);
    } catch (err) {
      console.error('Ошибка получения меню:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // Создать заказ
  router.post('/api/orders', (req, res) => {
    try {
      const { phone, address, comment, items } = req.body;

      if (!phone || !address || !items || !items.length) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
      }

      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const orderId = db.transaction(() => {
        const result = db.run(
          'INSERT INTO orders (phone, address, comment, total) VALUES (?, ?, ?, ?)',
          [phone, address, comment || '', total]
        );
        const id = result.lastInsertRowid;

        for (const item of items) {
          db.run(
            'INSERT INTO order_items (order_id, menu_item_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)',
            [id, item.id || null, item.name, item.price, item.quantity]
          );
        }

        return id;
      });

      // Уведомляем администратора
      notifyAdmin(bot, {
        id: orderId,
        phone,
        address,
        comment: comment || '',
        total,
        items
      });

      res.json({ success: true, orderId: Number(orderId) });
    } catch (err) {
      console.error('Ошибка создания заказа:', err);
      res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
  });

  return router;
};
