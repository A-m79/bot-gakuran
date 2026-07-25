const mongoose = require('mongoose');

module.exports = mongoose.model('ActivityCheck', new mongoose.Schema({}, { strict: false }));