const DB_NAME = 'daily-habits';
const DB_VERSION = 1;
let _db = null;

function req2p(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function openDB() {
  if (_db) return _db;
  if (!window.indexedDB) throw new Error('IndexedDB not available');
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('habits')) {
        const s = db.createObjectStore('habits', { keyPath: 'id' });
        s.createIndex('order', 'order');
      }
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: ['habitId', 'date'] });
        s.createIndex('habitId', 'habitId');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(storeNames, mode = 'readonly') {
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  return _db.transaction(names, mode);
}

export async function getHabits() {
  await openDB();
  const all = await req2p(tx('habits').objectStore('habits').getAll());
  return all.sort((a, b) => a.order - b.order);
}

export async function saveHabit(habit) {
  await openDB();
  return req2p(tx('habits', 'readwrite').objectStore('habits').put(habit));
}

export async function deleteHabit(id) {
  await openDB();
  const t = tx(['habits', 'entries'], 'readwrite');
  await req2p(t.objectStore('habits').delete(id));
  const keys = await req2p(t.objectStore('entries').index('habitId').getAllKeys(id));
  for (const key of keys) await req2p(t.objectStore('entries').delete(key));
}

export async function getEntriesForHabit(habitId) {
  await openDB();
  const all = await req2p(tx('entries').objectStore('entries').index('habitId').getAll(habitId));
  const map = {};
  for (const e of all) map[e.date] = e.status;
  return map;
}

export async function setEntry(habitId, date, status) {
  await openDB();
  const store = tx('entries', 'readwrite').objectStore('entries');
  if (status === 'not_entered') return req2p(store.delete([habitId, date]));
  return req2p(store.put({ habitId, date, status }));
}

export async function getMeta(key) {
  await openDB();
  const r = await req2p(tx('meta').objectStore('meta').get(key));
  return r?.value;
}

export async function setMeta(key, value) {
  await openDB();
  return req2p(tx('meta', 'readwrite').objectStore('meta').put({ key, value }));
}

export async function getAvailableYears() {
  await openDB();
  const keys = await req2p(tx('entries').objectStore('entries').getAllKeys());
  const years = new Set(keys.map(([, d]) => parseInt(d.slice(0, 4))));
  return [...years].sort((a, b) => a - b);
}

export async function exportAllData() {
  const habits = await getHabits();
  const result = [];
  for (const h of habits) {
    const entries = await getEntriesForHabit(h.id);
    result.push({ ...h, entries });
  }
  return result;
}

export async function importAllData(habits) {
  await openDB();
  const t = _db.transaction(['habits', 'entries'], 'readwrite');
  await req2p(t.objectStore('habits').clear());
  await req2p(t.objectStore('entries').clear());
  for (const h of habits) {
    const { entries, ...habitData } = h;
    await req2p(t.objectStore('habits').put(habitData));
    for (const [date, status] of Object.entries(entries || {})) {
      if (status !== 'not_entered') {
        await req2p(t.objectStore('entries').put({ habitId: h.id, date, status }));
      }
    }
  }
}
