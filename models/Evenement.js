const mongoose = require('mongoose');

const evenementSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    titre:     { type: String, required: true },
    date:      { type: String, required: true },
    heure:     { type: String, required: true },
    lieu:      { type: String, default: 'À définir' },
    type:      { type: String, required: true },
    createdAt: { type: Date, default: Date.now } // Permet de trier automatiquement du plus récent au plus ancien
});

module.exports = mongoose.model('Evenement', evenementSchema);