const mongoose = require('mongoose');

module.exports = mongoose.model('Leaderboard', new mongoose.Schema({}, { strict: false }));