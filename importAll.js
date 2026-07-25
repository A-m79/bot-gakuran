require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import des modèles
const models = {
    'absences.json': require('./models/Absence'),
    'activitycheck.json': require('./models/ActivityCheck'),
    'giveaways.json': require('./models/Giveaway'),
    'kos.json': require('./models/Kos'),
    'leaderboard.json': require('./models/Leaderboard'),
    'relations.json': require('./models/Relation'),
};

async function importTout() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté à MongoDB Atlas\n');

        for (const [fileName, Model] of Object.entries(models)) {
            const filePath = path.join(__dirname, 'data', fileName);

            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Fichier introuvable : ${fileName}`);
                continue;
            }

            const rawData = fs.readFileSync(filePath, 'utf8');
            let data = JSON.parse(rawData);

            // Si c'est un objet simple au lieu d'un tableau, on l'englobe dans un tableau
            if (!Array.isArray(data)) {
                data = [data];
            }

            if (data.length === 0) {
                console.log(`ℹ️ Fichier vide : ${fileName}`);
                continue;
            }

            // Nettoyage préalable pour éviter les doublons lors de relances
            await Model.deleteMany({});
            await Model.insertMany(data);
            console.log(`🎉 Importé avec succès (${data.length} entrées) : ${fileName}`);
        }

        console.log('\n🚀 Migration de toutes les données terminée !');
    } catch (err) {
        console.error('❌ Erreur durant l\'importation :', err);
    } finally {
        mongoose.connection.close();
    }
}

importTout();