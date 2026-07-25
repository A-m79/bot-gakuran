const mongoose = require('mongoose');

module.exports = mongoose.model('Kos', new mongoose.Schema({}, { strict: false }));