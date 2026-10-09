const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

module.exports = function(db) {
  const router = express.Router();

  // ===== КАТЕГОРИИ =====

  router.get('/api/admin/categories', (req, res) => {
    try {
      const categories = db.all('SELECT * FROM categories ORDER BY sort_order, id');
      res.json(categories);
    } catch (err) {
      console.error('Ошибка получения категорий:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.post('/api/admin/categories', (req, res) => {
    try {
      const { name, sort_order } = req.body;
      if (!name) return res.status(400).json({ error: 'Название обязательно' });

      const result = db.run(
        'INSERT INTO categories (name, sort_order) VALUES (?, ?)',
        [name, sort_order || 0]
      );

      res.json({ success: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      console.error('Ошибка создания категории:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.put('/api/admin/categories/:id', (req, res) => {
    try {
      const { name, sort_order } = req.body;
      const cat = db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
      if (!cat) return res.status(404).json({ error: 'Категория не найдена' });

      db.run(
        'UPDATE categories SET name = ?, sort_order = ? WHERE id = ?',
        [name || cat.name, sort_order !== undefined ? sort_order : cat.sort_order, req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Ошибка обновления категории:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.delete('/api/admin/categories/:id', (req, res) => {
    try {
      db.run('UPDATE menu_items SET category_id = NULL WHERE category_id = ?', [req.params.id]);
      db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Ошибка удаления категории:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // ===== МЕНЮ =====

  router.get('/api/admin/menu', (req, res) => {
    try {
      const items = db.all(`
        SELECT m.*, c.name as category_name
        FROM menu_items m
        LEFT JOIN categories c ON m.category_id = c.id
        ORDER BY m.sort_order, m.id
      `);
      res.json(items);
    } catch (err) {
      console.error('Ошибка получения меню:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.post('/api/admin/menu', upload.single('image'), (req, res) => {
    try {
      const { name, description, price, category_id, sort_order } = req.body;
      if (!name || !price) return res.status(400).json({ error: 'Название и цена обязательны' });

      const image = req.file ? '/uploads/' + req.file.filename : '';

      const result = db.run(
        'INSERT INTO menu_items (name, description, price, category_id, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || '', parseFloat(price), category_id || null, image, sort_order || 0]
      );

      res.json({ success: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      console.error('Ошибка создания позиции:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.put('/api/admin/menu/:id', upload.single('image'), (req, res) => {
    try {
      const { name, description, price, category_id, sort_order } = req.body;
      const id = req.params.id;

      const existing = db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Позиция не найдена' });

      const image = req.file ? '/uploads/' + req.file.filename : existing.image;

      db.run(`
        UPDATE menu_items 
        SET name = ?, description = ?, price = ?, category_id = ?, image = ?, sort_order = ?
        WHERE id = ?
      `, [
        name || existing.name,
        description !== undefined ? description : existing.description,
        price ? parseFloat(price) : existing.price,
        category_id || null,
        image,
        sort_order !== undefined ? sort_order : existing.sort_order,
        id
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('Ошибка обновления позиции:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.put('/api/admin/menu/:id/stop', (req, res) => {
    try {
      const { is_stopped } = req.body;
      db.run('UPDATE menu_items SET is_stopped = ? WHERE id = ?', [is_stopped, req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Ошибка обновления стоп-листа:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.delete('/api/admin/menu/:id', (req, res) => {
    try {
      db.run('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Ошибка удаления позиции:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // ===== ЗАКАЗЫ =====

  router.get('/api/admin/orders', (req, res) => {
    try {
      const orders = db.all('SELECT * FROM orders ORDER BY created_at DESC');

      const result = orders.map(order => ({
        ...order,
        items: db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id])
      }));

      res.json(result);
    } catch (err) {
      console.error('Ошибка получения заказов:', err.message);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  return router;
};
