require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, Events, MessageFlags } = require('discord.js');
const { DISCORD_TOKEN, API_KEY, API_URL = 'http://127.0.0.1:3000' } = process.env;

const express = require('express');
const Database = require('better-sqlite3');
const { PORT = 10000, HOST = '0.0.0.0', DB_PATH = 'ideas.db' } = process.env;

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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function api(path, options = {}) {
  const res = await fetch(API_URL + path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, ...options.headers },
  });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return res.json();
}

const statuses = [
  { name: '/idea add' },
  { name: '/idea delete' },
  { name: '/idea list', },
];

client.once(Events.ClientReady, (c) => {
  console.log(`${c.user.tag} is online.`);
  setInterval(() => {
    c.user.setActivity(statuses[Math.floor(Math.random() * statuses.length)]);
  }, 10000);
});



client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'idea') return;

  try {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const entry = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
          category: interaction.options.getString('category', true),
          text: interaction.options.getString('text', true),
          author: interaction.user.username,
        }),
      });
      return interaction.editReply(`Added #${entry.id} to **${entry.category}**`);
    }

    if (sub === 'list') {
      const category = interaction.options.getString('category');
      const query = category ? `?category=${encodeURIComponent(category.toLowerCase())}&limit=10` : '?limit=10';
      const entries = await api('/entries' + query);
      if (!entries.length) return interaction.editReply('Empty.');

      const lines = entries.map((e) => {
        const text = e.text.length > 150 ? e.text.slice(0, 147) + '...' : e.text;
        return `**#${e.id}** [${e.category}] ${text}`;
      });
      return interaction.editReply(lines.join('\n'));
    }

    if (sub === 'delete') {
      const id = interaction.options.getInteger('id', true);
      await api(`/entries/${id}`, { method: 'DELETE' });
      return interaction.editReply(`Removed #${id}`);
    }
  } catch (error) {
    console.error(error);
    const msg = 'API error';
    if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
    else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.login(DISCORD_TOKEN);
