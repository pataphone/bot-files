require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');

const { API_KEY, PORT = 10000, HOST = '0.0.0.0', DB_PATH = 'ideas.db' } = process.env;

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    category   TEXT NOT NULL,
    text       TEXT NOT NULL,
    author     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
`);

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (req.get('x-api-key') !== API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

app.get('/entries', (req, res) => {
  const { category, q } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  let sql = 'SELECT * FROM entries WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(String(category).toLowerCase()); }
  if (q)        { sql += ' AND text LIKE ?';  params.push(`%${q}%`); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);

  res.json(db.prepare(sql).all(...params));
});

app.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT category, COUNT(*) AS count FROM entries GROUP BY category ORDER BY category').all());
});

app.get('/entries/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

app.post('/entries', (req, res) => {
  const { category, text, author = null } = req.body || {};
  if (!category || !text) return res.status(400).json({ error: 'category and text are required' });

  const info = db
    .prepare('INSERT INTO entries (category, text, author) VALUES (?, ?, ?)')
    .run(String(category).toLowerCase(), String(text), author);
  res.status(201).json(db.prepare('SELECT * FROM entries WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/entries/:id', (req, res) => {
  const info = db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

app.listen(PORT, HOST, () => console.log(`API listening on http://${HOST}:${PORT}`));
