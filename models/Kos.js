const mongoose = require('mongoose');

const kosSchema = new mongoose.Schema({
    messageId: { type: String, default: null },
    entries: [{
        nom: { type: String, required: true },
        raison: { type: String, required: true },
        addedBy: { type: String, default: '' },
        addedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Kos', kosSchema);