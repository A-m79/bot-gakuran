const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ReactionRole = require('../models/ReactionRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole-bind')
        .setDescription('🔗 Associe un emoji à un rôle sur un message de rôles-réactions')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('ID du message (donné par /reactionrole-create)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('L\'emoji à utiliser (unicode ou emoji custom du serveur)')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Le rôle à donner quand on clique sur cet emoji')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.options.getString('message_id');
        const emojiInput = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role');

        // Sécurité : empêche de binder un rôle dangereux (admin, ou plus haut que le bot)
        if (role.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ content: '❌ Impossible d\'associer un rôle Administrateur à une réaction, par sécurité.' });
        }

        const botMember = interaction.guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
            return interaction.editReply({ content: `❌ Le rôle ${role} est plus haut (ou égal) que le rôle du bot dans la hiérarchie — je ne peux pas l'attribuer. Descends-le en dessous du rôle du bot.` });
        }

        const rr = await ReactionRole.findOne({ messageId });
        if (!rr) {
            return interaction.editReply({ content: '❌ Aucun message de rôles-réactions trouvé avec cet ID. Vérifie que tu as bien copié l\'ID retourné par `/reactionrole-create`.' });
        }

        // Empêche d'associer deux fois le même emoji ou le même rôle sur un même message
        const emojiAlreadyUsed = rr.bindings.find(b => b.emoji === emojiInput);
        if (emojiAlreadyUsed) {
            return interaction.editReply({ content: `❌ L'emoji ${emojiInput} est déjà associé à un autre rôle sur ce message.` });
        }
        const roleAlreadyUsed = rr.bindings.find(b => b.roleId === role.id);
        if (roleAlreadyUsed) {
            return interaction.editReply({ content: `❌ Le rôle ${role} est déjà associé à un autre emoji sur ce message.` });
        }

        try {
            const channel = await interaction.guild.channels.fetch(rr.channelId);
            const message = await channel.messages.fetch(messageId);

            // Le bot réagit lui-même avec l'emoji pour que les membres puissent cliquer dessus
            await message.react(emojiInput);

            rr.bindings.push({ emoji: emojiInput, roleId: role.id });
            await rr.save();

            return interaction.editReply({ content: `✅ ${emojiInput} donne maintenant le rôle ${role} sur ce message.` });

        } catch (err) {
            console.error('❌ Erreur bind reaction role :', err);
            return interaction.editReply({ content: '❌ Impossible de réagir au message (emoji invalide, ou message introuvable/supprimé).' });
        }
    }
};
