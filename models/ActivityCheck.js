const mongoose = require('mongoose');

const activityCheckSchema = new mongoose.Schema({
    messageId: String,
    channelId: String,
    objectif: Number,
    reached: { type: Boolean, default: false }
}, { strict: false });

module.exports = mongoose.model('ActivityCheck', activityCheckSchema);