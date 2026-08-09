const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ReactionRole = require('../models/ReactionRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole-unbind')
        .setDescription('✂️ Retire une association emoji-rôle d\'un message')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('ID du message concerné')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('L\'emoji à retirer')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.options.getString('message_id');
        const emojiInput = interaction.options.getString('emoji');

        const rr = await ReactionRole.findOne({ messageId });
        if (!rr) {
            return interaction.editReply({ content: '❌ Aucun message de rôles-réactions trouvé avec cet ID.' });
        }

        const bindingIndex = rr.bindings.findIndex(b => b.emoji === emojiInput);
        if (bindingIndex === -1) {
            return interaction.editReply({ content: `❌ L'emoji ${emojiInput} n'est associé à aucun rôle sur ce message.` });
        }

        rr.bindings.splice(bindingIndex, 1);
        await rr.save();

        // Retire aussi la réaction du bot sur le message pour que ce soit cohérent visuellement
        try {
            const channel = await interaction.guild.channels.fetch(rr.channelId);
            const message = await channel.messages.fetch(messageId);
            const reaction = message.reactions.cache.find(r => r.emoji.name === emojiInput || r.emoji.toString() === emojiInput);
            if (reaction) await reaction.users.remove(interaction.client.user.id);
        } catch (err) {
            console.warn('⚠️ Impossible de retirer la réaction du bot (message ou emoji introuvable) :', err.message);
        }

        return interaction.editReply({ content: `✅ L'association ${emojiInput} a été retirée de ce message.` });
    }
};
