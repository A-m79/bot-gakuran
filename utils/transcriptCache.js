const cache = new Map(); // id -> { buffer, filename, timestamp }
const TTL = 15 * 60 * 1000; // 15 minutes

function store(buffer, filename) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cache.set(id, { buffer, filename, timestamp: Date.now() });
    return id;
}

function retrieve(id) {
    const entry = cache.get(id);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL) {
        cache.delete(id);
        return null;
    }
    return entry;
}

// Purge automatique des transcripts expirés
setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of cache.entries()) {
        if (now - entry.timestamp > TTL) cache.delete(id);
    }
}, 5 * 60 * 1000);

module.exports = { store, retrieve };
