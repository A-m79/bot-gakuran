const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema({
    messageId: { type: String, default: null },
    channelId: { type: String, default: null },
    ranks: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { strict: false, timestamps: true });

module.exports = mongoose.models.Leaderboard || mongoose.model('Leaderboard', leaderboardSchema);