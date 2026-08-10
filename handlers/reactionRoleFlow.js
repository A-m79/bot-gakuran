const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const ReactionRole = require('../models/ReactionRole');

// ─── ÉTAPE 1 : Bouton "➕ Ajouter une réaction" → ouvre la modal pour taper l'emoji ───
async function handleAddButton(interaction) {
    const messageId = interaction.customId.replace('rr_add_', '');

    const modal = new ModalBuilder()
        .setCustomId(`rr_emoji_modal_${messageId}`)
        .setTitle('Ajouter une réaction');

    const emojiInput = new TextInputBuilder()
        .setCustomId('emoji_value')
        .setLabel('Quel emoji veux-tu utiliser ?')
        .setPlaceholder('Clique sur 🙂 dans le champ pour choisir un emoji, ou colle-en un custom')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(emojiInput));
    await interaction.showModal(modal);
}

// ─── ÉTAPE 2 : Soumission de la modal → affiche le menu déroulant de rôles ───
async function handleEmojiModal(interaction) {
    const messageId = interaction.customId.replace('rr_emoji_modal_', '');
    const emoji = interaction.fields.getTextInputValue('emoji_value').trim();

    const rr = await ReactionRole.findOne({ messageId });
    if (!rr) {
        return interaction.reply({ content: '❌ Ce message de rôles-réactions n\'existe plus.', ephemeral: true });
    }

    if (rr.bindings.find(b => b.emoji === emoji)) {
        return interaction.reply({ content: `❌ L'emoji ${emoji} est déjà associé à un rôle sur ce message.`, ephemeral: true });
    }

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`rr_roleselect_${messageId}::${encodeURIComponent(emoji)}`)
        .setPlaceholder('Choisis le rôle à associer')
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleSelect);

    await interaction.reply({
        content: `Emoji choisi : ${emoji}\nMaintenant, choisis le rôle à donner :`,
        components: [row],
        ephemeral: true
    });
}

// ─── ÉTAPE 3 : Sélection du rôle → sauvegarde + réaction auto sur le message ───
async function handleRoleSelect(interaction) {
    const [prefix, rest] = interaction.customId.split('::');
    const messageId = prefix.replace('rr_roleselect_', '');
    const emoji = decodeURIComponent(rest);
    const roleId = interaction.values[0];

    await interaction.deferUpdate();

    const guild = interaction.guild;
    const role = guild.roles.cache.get(roleId);

    if (!role) {
        return interaction.editReply({ content: '❌ Rôle introuvable.', components: [] });
    }

    // Sécurités : rôle admin interdit, hiérarchie du bot
    if (role.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: '❌ Impossible d\'associer un rôle Administrateur à une réaction, par sécurité.', components: [] });
    }

    const botMember = guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply({ content: `❌ Le rôle ${role} est plus haut (ou égal) que le rôle du bot — descends-le dans la hiérarchie des rôles pour pouvoir l'utiliser.`, components: [] });
    }

    const rr = await ReactionRole.findOne({ messageId });
    if (!rr) {
        return interaction.editReply({ content: '❌ Ce message de rôles-réactions n\'existe plus.', components: [] });
    }

    if (rr.bindings.find(b => b.emoji === emoji)) {
        return interaction.editReply({ content: `❌ L'emoji ${emoji} est déjà associé à un autre rôle.`, components: [] });
    }
    if (rr.bindings.find(b => b.roleId === roleId)) {
        return interaction.editReply({ content: `❌ Le rôle ${role} est déjà associé à un autre emoji sur ce message.`, components: [] });
    }

    try {
        const channel = await guild.channels.fetch(rr.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.react(emoji);

        rr.bindings.push({ emoji, roleId });
        await rr.save();

        const addAnotherButton = new ButtonBuilder()
            .setCustomId(`rr_add_${messageId}`)
            .setLabel('Ajouter une autre réaction')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(addAnotherButton);

        return interaction.editReply({
            content: `✅ ${emoji} donne maintenant le rôle ${role} !\n\nTu peux continuer à en ajouter d'autres :`,
            components: [row]
        });

    } catch (err) {
        console.error('❌ Erreur lors du bind par menu :', err);
        return interaction.editReply({ content: '❌ Impossible de réagir au message (emoji invalide, ou message supprimé).', components: [] });
    }
}

module.exports = { handleAddButton, handleEmojiModal, handleRoleSelect };