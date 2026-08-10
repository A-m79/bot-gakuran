const mongoose = require('mongoose');

const relationSchema = new mongoose.Schema({
    messageId: { type: String, default: null },
    entries: [{
        nom: { type: String, required: true },
        type: { type: String, required: true },
        lead: { type: String, default: '' },
        discord: { type: String, default: '' },
        note: { type: String, default: '' },
        addedBy: { type: String, default: '' }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Relation', relationSchema);