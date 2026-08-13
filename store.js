// Tiny, dependency-free JSON store with serialized atomic writes.
// One file on a persistent disk. Plenty for a personal/family planner backup.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/data';
const FILE = path.join(DATA_DIR, 'db.json');

let db = { users: {} };
let writing = Promise.resolve();

function load() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    db = parsed && typeof parsed === 'object' ? parsed : { users: {} };
    if (!db.users) db.users = {};
  } catch (e) {
    db = { users: {} };
  }
}

// Serialize writes; write to a temp file then atomically rename so the db file
// is never left half-written even if the process is killed mid-save.
function persist() {
  const snapshot = JSON.stringify(db);
  writing = writing.then(() => new Promise((resolve) => {
    const tmp = FILE + '.tmp';
    fs.writeFile(tmp, snapshot, (err) => {
      if (err) { console.error('store write error:', err.message); return resolve(); }
      fs.rename(tmp, FILE, (err2) => {
        if (err2) console.error('store rename error:', err2.message);
        resolve();
      });
    });
  }));
  return writing;
}

load();
module.exports = { db, persist };
