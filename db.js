const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    const SQL = await initSqlJs();

    // Загружаем существующую БД или создаём новую
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    // Создание таблиц
    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price REAL NOT NULL,
        image TEXT DEFAULT '',
        is_stopped INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        comment TEXT DEFAULT '',
        total REAL NOT NULL,
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        menu_item_id INTEGER,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    this.save();
    console.log('✅ База данных инициализирована');
  }

  // Сохранение БД на диск
  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  // SELECT — возвращает массив объектов
  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // SELECT — возвращает первую строку или null
  get(sql, params = []) {
    const results = this.all(sql, params);
    return results[0] || null;
  }

  // INSERT/UPDATE/DELETE — возвращает { lastInsertRowid, changes }
  run(sql, params = []) {
    this.db.run(sql, params);
    const lastId = this.db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] || 0;
    const changes = this.db.getRowsModified();
    this.save();
    return { lastInsertRowid: lastId, changes };
  }

  // Транзакция
  transaction(fn) {
    this.db.run("BEGIN");
    try {
      const result = fn();
      this.db.run("COMMIT");
      this.save();
      return result;
    } catch (e) {
      this.db.run("ROLLBACK");
      throw e;
    }
  }
}

module.exports = new Database();
