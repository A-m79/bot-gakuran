const mongoose = require('mongoose');

const bindingSchema = new mongoose.Schema({
    emoji: { type: String, required: true },   // emoji unicode OU ID d'emoji custom
    roleId: { type: String, required: true }
}, { _id: false });

const reactionRoleSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    exclusive: { type: Boolean, default: false }, // true = un seul rôle à la fois parmi ceux du message
    bindings: [bindingSchema]
});

module.exports = mongoose.model('ReactionRole', reactionRoleSchema);
