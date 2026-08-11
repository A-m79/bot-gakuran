const mongoose = require('mongoose');

const loggedMessageSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, required: true },
    guildId:   { type: String, required: true },
    authorId:  { type: String, required: true },
    authorTag: { type: String, required: true },
    content:   { type: String, default: '' },
    attachments: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now, expires: '14d' } // Auto-nettoyage au bout de 14 jours
});

module.exports = mongoose.model('LoggedMessage', loggedMessageSchema);