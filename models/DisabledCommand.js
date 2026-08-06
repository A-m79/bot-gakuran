const mongoose = require('mongoose');

const disabledCommandSchema = new mongoose.Schema({
    commandName: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('DisabledCommand', disabledCommandSchema);