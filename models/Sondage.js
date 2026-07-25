const mongoose = require('mongoose');

const sondageSchema = new mongoose.Schema({
    question: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    date: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sondage', sondageSchema);