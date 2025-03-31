const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('/var/lib/db/charts.db', err => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS charts (
    id TEXT PRIMARY KEY,
    config TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
  )
`);

module.exports = db;
