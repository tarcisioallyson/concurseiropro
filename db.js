/* db.js — IndexedDB abstraction */
const DB = (() => {
  const NAME = 'concurseiroDB';
  const VER  = 1;
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VER);
      req.onupgradeneeded = ({ target: { result: db } }) => {
        if (!db.objectStoreNames.contains('config'))
          db.createObjectStore('config');
        if (!db.objectStoreNames.contains('materias'))
          db.createObjectStore('materias', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sessoes')) {
          const s = db.createObjectStore('sessoes', { keyPath: 'id', autoIncrement: true });
          s.createIndex('discId', 'discId', { unique: false });
          s.createIndex('data',   'data',   { unique: false });
        }
      };
      req.onsuccess = ({ target: { result: db } }) => { _db = db; resolve(db); };
      req.onerror   = ({ target: { error } })      => reject(error);
    });
  }

  function store(name, mode = 'readonly') {
    return open().then(db => db.transaction(name, mode).objectStore(name));
  }

  function wrap(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  }

  const config = {
    get: async key  => wrap((await store('config')).get(key)),
    set: async (key, val) => wrap((await store('config', 'readwrite')).put(val, key)),
  };

  const materias = {
    getAll: async ()    => wrap((await store('materias')).getAll()) .then(r => r || []),
    put:    async (m)   => wrap((await store('materias', 'readwrite')).put(m)),
    delete: async (id)  => wrap((await store('materias', 'readwrite')).delete(id)),
    clear:  async ()    => wrap((await store('materias', 'readwrite')).clear()),
  };

  const sessoes = {
    getAll: async ()    => wrap((await store('sessoes')).getAll()).then(r => r || []),
    add:    async (s)   => wrap((await store('sessoes', 'readwrite')).add(s)),
    put:    async (s)   => wrap((await store('sessoes', 'readwrite')).put(s)),
    delete: async (id)  => wrap((await store('sessoes', 'readwrite')).delete(id)),
    clear:  async ()    => wrap((await store('sessoes', 'readwrite')).clear()),
  };

  /* Migrate old localStorage data on first run */
  async function migrate() {
    const done = await config.get('migrated_v1');
    if (done) return;
    try {
      const em = JSON.parse(localStorage.getItem('con_edital_v33')   || '[]');
      const qm = JSON.parse(localStorage.getItem('con_questoes_v33') || '[]');
      const mm = parseFloat(localStorage.getItem('con_meta_v33')     || '20');
      const dm = localStorage.getItem('con_dark_v33') === 'true';
      for (const m of em) await materias.put(m);
      for (const s of qm) { const { data: _, ...rest } = s; await sessoes.add({ ...rest, data: s.data }); }
      await config.set('metaHoras', mm);
      await config.set('darkMode',  dm);
    } catch (_) {}
    await config.set('migrated_v1', true);
  }

  return { config, materias, sessoes, migrate };
})();
