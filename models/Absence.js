const mongoose = require('mongoose');

const absenceSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    ingame: { type: String, required: true },
    dateDebut: { type: String, required: true },
    duree: { type: Number, required: true },
    raison: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Absence', absenceSchema);