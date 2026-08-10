const ReactionRole = require('../models/ReactionRole');

module.exports = {
    name: 'messageReactionRemove',
    async execute(reaction, user) {
        if (user.bot) return;

        if (reaction.partial) {
            reaction = await reaction.fetch().catch(() => null);
            if (!reaction) return;
        }
        if (reaction.message.partial) {
            await reaction.message.fetch().catch(() => null);
        }

        const guild = reaction.message.guild;
        if (!guild) return;

        const rr = await ReactionRole.findOne({ messageId: reaction.message.id });
        if (!rr || rr.bindings.length === 0) return;

        const emojiKey = reaction.emoji.id ? reaction.emoji.id : reaction.emoji.name;
        const binding = rr.bindings.find(b => b.emoji === emojiKey || b.emoji === reaction.emoji.toString());
        if (!binding) return;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        try {
            if (member.roles.cache.has(binding.roleId)) {
                await member.roles.remove(binding.roleId);

                // Récupération du rôle pour obtenir son nom dans le MP
                const role = guild.roles.cache.get(binding.roleId) || await guild.roles.fetch(binding.roleId).catch(() => null);
                const roleName = role ? role.name : 'inconnu';

                // Envoi du message privé de confirmation
                await user.send(
                    `❌ Le rôle **${roleName}** vous a été retiré sur **${guild.name}**.`
                ).catch(() => null);
            }
        } catch (err) {
            console.error('❌ Erreur retrait rôle-réaction :', err);
        }
    }
};