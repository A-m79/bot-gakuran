const {
    ActionRowBuilder,
    RoleSelectMenuBuilder,
    PermissionFlagsBits
} = require('discord.js');
const ReactionRole = require('../models/ReactionRole');

// Sélection du rôle (peut arriver depuis le serveur OU en MP, donc pas de interaction.guild garanti)
async function handleRoleSelect(interaction) {
    const [prefix, rest] = interaction.customId.split('::');
    const messageId = prefix.replace('rr_roleselect_', '');
    const emojiKey = decodeURIComponent(rest);
    const roleId = interaction.values[0];

    await interaction.deferUpdate();

    const rr = await ReactionRole.findOne({ messageId });
    if (!rr) {
        return interaction.editReply({ content: '❌ Ce message de rôles-réactions n\'existe plus.', components: [] });
    }

    // On passe par le client car ceci peut être exécuté depuis un MP (interaction.guild serait null)
    const guild = await interaction.client.guilds.fetch(rr.guildId).catch(() => null);
    if (!guild) {
        return interaction.editReply({ content: '❌ Serveur introuvable.', components: [] });
    }

    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
        return interaction.editReply({ content: '❌ Rôle introuvable.', components: [] });
    }

    if (role.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: '❌ Impossible d\'associer un rôle Administrateur à une réaction, par sécurité.', components: [] });
    }

    const botMember = await guild.members.fetchMe();
    if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply({ content: `❌ Le rôle "${role.name}" est plus haut (ou égal) que le rôle du bot — descends-le dans la hiérarchie des rôles.`, components: [] });
    }

    if (rr.bindings.find(b => b.emoji === emojiKey)) {
        return interaction.editReply({ content: `❌ Cet emoji est déjà associé à un autre rôle sur ce message.`, components: [] });
    }
    if (rr.bindings.find(b => b.roleId === roleId)) {
        return interaction.editReply({ content: `❌ Le rôle "${role.name}" est déjà associé à un autre emoji sur ce message.`, components: [] });
    }

    try {
        const channel = await guild.channels.fetch(rr.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.react(emojiKey);

        rr.bindings.push({ emoji: emojiKey, roleId });
        await rr.save();

        return interaction.editReply({
            content: `✅ ${emojiKey} donne maintenant le rôle **${role.name}** !\n\nTu peux réagir avec un autre emoji sur le message pour en ajouter d'autres.`,
            components: []
        });

    } catch (err) {
        console.error('❌ Erreur lors du bind par menu :', err);
        return interaction.editReply({ content: '❌ Impossible de réagir au message (message supprimé ?).', components: [] });
    }
}

module.exports = { handleRoleSelect };