const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(process.env.DB_PATH || './todo.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    is_done      INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
    due_date     TEXT,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_todos_due_date    ON todos(due_date);
  CREATE INDEX IF NOT EXISTS idx_todos_category_id ON todos(category_id);
`);

module.exports = db;
