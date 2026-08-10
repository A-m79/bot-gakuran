const {
    ActionRowBuilder,
    RoleSelectMenuBuilder,
    PermissionFlagsBits
} = require('discord.js');
const ReactionRole = require('../models/ReactionRole');

// 1. Bouton temporaire cliqué dans le salon -> Ouverture du menu éphémère
async function handleSetupButton(interaction) {
    const [prefix, rest] = interaction.customId.split('::');
    const messageId = prefix.replace('rr_setup_', '');
    const emojiKey = decodeURIComponent(rest);

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`rr_roleselect_${messageId}::${encodeURIComponent(emojiKey)}`)
        .setPlaceholder('Choisis le rôle à associer')
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleSelect);

    await interaction.reply({
        content: `🎭 Choisis le rôle à associer à l'émoji ${emojiKey} :`,
        components: [row],
        ephemeral: true
    });
}

// 2. Sélection du rôle depuis le menu déroulant
async function handleRoleSelect(interaction) {
    const [prefix, rest] = interaction.customId.split('::');
    const messageId = prefix.replace('rr_roleselect_', '');
    const emojiKey = decodeURIComponent(rest);
    const roleId = interaction.values[0];

    const rr = await ReactionRole.findOne({ messageId });
    if (!rr) {
        return interaction.reply({ content: '❌ Ce message de rôles-réactions n\'existe plus.', ephemeral: true });
    }

    const guild = interaction.guild || await interaction.client.guilds.fetch(rr.guildId).catch(() => null);
    if (!guild) {
        return interaction.reply({ content: '❌ Serveur introuvable.', ephemeral: true });
    }

    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
        return interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });
    }

    if (role.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Impossible d\'associer un rôle Administrateur à une réaction, par sécurité.', ephemeral: true });
    }

    const botMember = await guild.members.fetchMe();
    if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: `❌ Le rôle "${role.name}" est plus haut (ou égal) que le rôle du bot — descends-le dans la hiérarchie des rôles.`, ephemeral: true });
    }

    if (rr.bindings.find(b => b.emoji === emojiKey)) {
        return interaction.reply({ content: `❌ Cet emoji est déjà associé à un autre rôle sur ce message.`, ephemeral: true });
    }
    if (rr.bindings.find(b => b.roleId === roleId)) {
        return interaction.reply({ content: `❌ Le rôle "${role.name}" est déjà associé à un autre emoji sur ce message.`, ephemeral: true });
    }

    try {
        const channel = await guild.channels.fetch(rr.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.react(emojiKey);

        rr.bindings.push({ emoji: emojiKey, roleId });
        await rr.save();

        // Supprimer le message contenant le bouton temporaire dans le salon
        if (interaction.message && interaction.message.deletable) {
            interaction.message.delete().catch(() => null);
        }

        return interaction.update({
            content: `✅ L'émoji ${emojiKey} donne maintenant le rôle **${role.name}** !\n\nTu peux réagir avec un autre émoji sur le message pour continuer.`,
            components: []
        });

    } catch (err) {
        console.error('❌ Erreur lors du bind par menu :', err);
        return interaction.reply({ content: '❌ Impossible de réagir au message (message supprimé ?).', ephemeral: true });
    }
}

module.exports = { handleSetupButton, handleRoleSelect };