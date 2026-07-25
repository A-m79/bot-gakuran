const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    prize: { type: String, required: true },
    winnersCount: { type: Number, required: true, default: 1 },
    endsAt: { type: Number, required: true },
    ended: { type: Boolean, default: false },
    hostId: { type: String, required: true },
    participants: { type: [String], default: [] }
});

module.exports = mongoose.model('Giveaway', giveawaySchema);