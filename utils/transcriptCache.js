const fs = require('fs');
const path = require('path');

const TRANSCRIPT_DIR = path.join(__dirname, '../transcripts');
const TTL = 3 * 60 * 60 * 1000; // 3 heures

// Crée le dossier automatiquement s'il n'existe pas
if (!fs.existsSync(TRANSCRIPT_DIR)) {
    fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
}

function store(buffer, filename) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filePath = path.join(TRANSCRIPT_DIR, `${id}.json`);

    const data = {
        filename,
        content: buffer.toString('utf-8'),
        timestamp: Date.now()
    };

    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    return id;
}

function retrieve(id) {
    const filePath = path.join(TRANSCRIPT_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const entry = JSON.parse(raw);

        // Si le délai de 3h est dépassé, on supprime le fichier
        if (Date.now() - entry.timestamp > TTL) {
            fs.unlinkSync(filePath);
            return null;
        }

        return {
            buffer: Buffer.from(entry.content, 'utf-8'),
            filename: entry.filename
        };
    } catch (e) {
        return null;
    }
}

// Purge automatique des transcripts expirés sur le disque
function cleanExpired() {
    try {
        const files = fs.readdirSync(TRANSCRIPT_DIR);
        const now = Date.now();

        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const filePath = path.join(TRANSCRIPT_DIR, file);
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                const entry = JSON.parse(raw);
                if (now - entry.timestamp > TTL) {
                    fs.unlinkSync(filePath);
                }
            } catch {
                fs.unlinkSync(filePath); // Nettoie les fichiers corrompus si besoin
            }
        }
    } catch (e) {
        console.error('[TRANSCRIPT CACHE] Erreur lors de la purge :', e);
    }
}

// Vérification toutes les 5 minutes + nettoyage au démarrage
setInterval(cleanExpired, 5 * 60 * 1000);
cleanExpired();

module.exports = { store, retrieve, get: retrieve };