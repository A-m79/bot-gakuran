const mongoose = require('mongoose');

module.exports = mongoose.model('Relation', new mongoose.Schema({}, { strict: false }));