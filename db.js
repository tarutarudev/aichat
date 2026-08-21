import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';


mkdirSync('./data', { recursive: true });

export const db = new Database('./data/aichat.db', { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');



db.run(`
  CREATE TABLE IF NOT EXISTS plots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT NOT NULL,
    tag TEXT NOT NULL,
    persona TEXT NOT NULL,
    greeting TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    avatar_emoji TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    total_chat_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS chat_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    FOREIGN KEY (plot_id) REFERENCES plots(id)
  )
`);

db.run('CREATE INDEX IF NOT EXISTS idx_chat_events_plot_time ON chat_events(plot_id, occurred_at)');

db.run(`
  CREATE TABLE IF NOT EXISTS user_plot_history (
    user_id TEXT NOT NULL,
    plot_id TEXT NOT NULL,
    session_id TEXT,
    last_message TEXT,
    last_opened_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, plot_id)
  )
`);




function spread(count, hoursAgoMin, hoursAgoMax) {
  const now = Date.now();
  const list = [];
  for (let i = 0; i < count; i++) {
    const hoursAgo = hoursAgoMin + Math.random() * (hoursAgoMax - hoursAgoMin);
    list.push(now - hoursAgo * 60 * 60 * 1000);
  }
  return list;
}

function daysAgo(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function hoursAgo(hours) {
  return Date.now() - hours * 60 * 60 * 1000;
}

// 適当
const PLOT_SEED = [
  {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'testPlot',
    tag: 'tag',
    avatarEmoji: '',
    avatarColor: '#000000',
    creatorName: 'たるたるそーす',
    tagline: 'tagline',
    persona: '',
    greeting: 'message',
    createdAt: "",
    events: [],
  },
];

function seedIfEmpty() {
  const row = db.query('SELECT COUNT(*) AS count FROM plots').get();
  if (row.count > 0) return;

  const insertPlot = db.query(`
    INSERT INTO plots (id, name, tagline, tag, persona, greeting, creator_name, avatar_emoji, avatar_color, total_chat_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);
  const insertEvent = db.query('INSERT INTO chat_events (plot_id, occurred_at) VALUES (?, ?)');

  const seedAll = db.transaction(() => {
    for (const p of PLOT_SEED) {
      insertPlot.run(p.id, p.name, p.tagline, p.tag, p.persona, p.greeting, p.creatorName, p.avatarEmoji, p.avatarColor, p.createdAt);
      for (const occurredAt of p.events) {
        insertEvent.run(p.id, occurredAt);
      }
    }
  });
  seedAll();

  db.run(`
    UPDATE plots SET total_chat_count = (
      SELECT COUNT(*) FROM chat_events WHERE chat_events.plot_id = plots.id
    )
  `);
}

seedIfEmpty();



const CARD_SELECT = `
  SELECT id, name, tagline, tag,
         creator_name AS creatorName,
         avatar_emoji AS avatarEmoji,
         avatar_color AS avatarColor,
         total_chat_count AS chatCount,
         created_at AS createdAt
  FROM plots
`;


export function getHomeFeed() {
  return db.query(`${CARD_SELECT} ORDER BY created_at DESC`).all();
}

const PERIOD_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};


export function getRanking(period) {
  if (period !== 'total' && !PERIOD_MS[period]) period = 'total';

  if (period === 'total') {
    return db.query(`
      SELECT id, name, tagline, tag,
             creator_name AS creatorName,
             avatar_emoji AS avatarEmoji,
             avatar_color AS avatarColor,
             total_chat_count AS chatCount
      FROM plots
      ORDER BY total_chat_count DESC, created_at DESC
      LIMIT 50
    `).all();
  }

  const cutoff = Date.now() - PERIOD_MS[period];
  return db.query(`
    SELECT p.id, p.name, p.tagline, p.tag,
           p.creator_name AS creatorName,
           p.avatar_emoji AS avatarEmoji,
           p.avatar_color AS avatarColor,
           COUNT(c.id) AS chatCount
    FROM plots p
    JOIN chat_events c ON c.plot_id = p.id
    WHERE c.occurred_at >= ?
    GROUP BY p.id
    ORDER BY chatCount DESC
    LIMIT 50
  `).all(cutoff);
}


export function getPlotById(id) {
  const row = db.query(`
    SELECT id, name, tagline, tag, greeting,
           creator_name AS creatorName,
           avatar_emoji AS avatarEmoji,
           avatar_color AS avatarColor,
           total_chat_count AS chatCount,
           created_at AS createdAt
    FROM plots WHERE id = ?
  `).get(id);
  return row ?? null;
}


export function getPlotPersona(id) {
  const row = db.query('SELECT persona FROM plots WHERE id = ?').get(id);
  return row ? row.persona : null;
}


export function recordChatEvent(plotId) {
  const now = Date.now();
  db.run('INSERT INTO chat_events (plot_id, occurred_at) VALUES (?, ?)', [plotId, now]);
  db.run('UPDATE plots SET total_chat_count = total_chat_count + 1 WHERE id = ?', [plotId]);
}



export function touchHistory(userId, plotId, sessionId, lastMessage) {
  if (!userId) return;
  db.run(`
    INSERT INTO user_plot_history (user_id, plot_id, session_id, last_message, last_opened_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, plot_id) DO UPDATE SET
      session_id = COALESCE(excluded.session_id, session_id),
      last_message = COALESCE(excluded.last_message, last_message),
      last_opened_at = excluded.last_opened_at
  `, [userId, plotId, sessionId ?? null, lastMessage ?? null, Date.now()]);
}


export function getHistory(userId) {
  if (!userId) return [];
  return db.query(`
    SELECT h.plot_id AS plotId,
           h.session_id AS sessionId,
           h.last_message AS lastMessage,
           h.last_opened_at AS lastOpenedAt,
           p.name, p.tagline, p.tag,
           p.avatar_emoji AS avatarEmoji,
           p.avatar_color AS avatarColor
    FROM user_plot_history h
    JOIN plots p ON p.id = h.plot_id
    WHERE h.user_id = ?
    ORDER BY h.last_opened_at DESC
  `).all(userId);
}
