const mongoose = require('mongoose');

module.exports = mongoose.model('Giveaway', new mongoose.Schema({}, { strict: false }));